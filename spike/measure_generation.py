#!/usr/bin/env python3
"""Measure create-next-starter.sh on this machine.

One JSON object per run goes to the results file. The script under test is
the repo copy. A second mode copies it and replaces the counter that aborts
under set -e, so a finished scaffold can be measured too. Nothing here talks
to Vercel.
"""

from __future__ import annotations

import json
import os
import resource
import shutil
import signal
import socket
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "create-next-starter.sh"
OUT_DIR = Path("/tmp/spike-work")
RESULTS = OUT_DIR / "results.jsonl"
IFACE = "enp0s3"
SAMPLE_S = 0.2
CGROUP = Path(
    "/sys/fs/cgroup"
    + Path("/proc/self/cgroup").read_text().strip().split(":")[-1]
    + "/spike-measure"
)


def now() -> float:
    return time.perf_counter()


def read_iface() -> tuple[int, int]:
    for line in Path("/proc/net/dev").read_text().splitlines():
        if line.strip().startswith(IFACE + ":"):
            parts = line.split(":")[1].split()
            return int(parts[0]), int(parts[8])
    raise SystemExit(f"interface {IFACE} not in /proc/net/dev")


def read_cpu_jiffies() -> tuple[int, int]:
    parts = Path("/proc/stat").read_text().splitlines()[0].split()
    # user nice system idle iowait
    idle = int(parts[4])
    iowait = int(parts[5])
    total = sum(int(x) for x in parts[1:])
    return iowait, total


def cgroup_cpu_usec() -> int | None:
    stat = CGROUP / "cpu.stat"
    if not stat.exists():
        return None
    for line in stat.read_text().splitlines():
        if line.startswith("usage_usec "):
            return int(line.split()[1])
    return None


def proc_rss_bytes(pid: int) -> int | None:
    try:
        statm = Path(f"/proc/{pid}/statm").read_text().split()
    except OSError:
        return None
    return int(statm[1]) * os.sysconf("SC_PAGE_SIZE")


def proc_state(pid: int) -> str | None:
    try:
        text = Path(f"/proc/{pid}/stat").read_text()
    except OSError:
        return None
    # state is the field after the comm, which is wrapped in parens
    end = text.rfind(")")
    if end < 0:
        return None
    rest = text[end + 2 :].split()
    return rest[0] if rest else None


def proc_exe(pid: int) -> str | None:
    try:
        return os.readlink(f"/proc/{pid}/exe")
    except OSError:
        return None


def descendants(root: int) -> list[int]:
    children: dict[int, list[int]] = {}
    found: list[int] = []
    for entry in Path("/proc").iterdir():
        if not entry.name.isdigit():
            continue
        pid = int(entry.name)
        try:
            raw = (entry / "stat").read_text()
        except OSError:
            continue
        end = raw.rfind(")")
        if end < 0:
            continue
        fields = raw[end + 2 :].split()
        if len(fields) < 2:
            continue
        ppid = int(fields[1])
        children.setdefault(ppid, []).append(pid)
    stack = [root]
    while stack:
        pid = stack.pop()
        found.append(pid)
        stack.extend(children.get(pid, []))
    return found


def socket_inodes(pids: list[int]) -> set[str]:
    inodes: set[str] = set()
    for pid in pids:
        fd_dir = Path(f"/proc/{pid}/fd")
        try:
            names = list(fd_dir.iterdir())
        except OSError:
            continue
        for fd in names:
            try:
                target = os.readlink(fd)
            except OSError:
                continue
            if target.startswith("socket:[") and target.endswith("]"):
                inodes.add(target[8:-1])
    return inodes


def decode_ipv4(hexaddr: str) -> str:
    ip_hex, _port = hexaddr.split(":")
    raw = int(ip_hex, 16).to_bytes(4, "little")
    return ".".join(str(b) for b in raw)


def decode_ipv6(hexaddr: str) -> str:
    ip_hex, _port = hexaddr.split(":")
    words = [ip_hex[i : i + 8] for i in range(0, 32, 8)]
    raw = b"".join(int(word, 16).to_bytes(4, "little") for word in words)
    return socket.inet_ntop(socket.AF_INET6, raw)


def peers_for_inodes(inodes: set[str]) -> set[str]:
    peers: set[str] = set()
    if not inodes:
        return peers
    tables = (
        ("/proc/net/tcp", decode_ipv4),
        ("/proc/net/tcp6", decode_ipv6),
    )
    for path, decode in tables:
        lines = Path(path).read_text().splitlines()[1:]
        for line in lines:
            cols = line.split()
            if len(cols) < 10:
                continue
            if cols[3] != "01":
                continue
            if cols[9] not in inodes:
                continue
            peers.add(decode(cols[2]))
    return peers


def du_bytes(path: Path) -> int:
    if not path.exists():
        return 0
    out = subprocess.check_output(["du", "-sB1", str(path)], text=True)
    return int(out.split()[0])


def zip_bytes(parent: Path, app_name: str, dest: Path, exclude: bool) -> int:
    cmd = ["zip", "-r", "-q", "-y", str(dest), app_name]
    if exclude:
        cmd += [
            "-x",
            f"{app_name}/node_modules/*",
            f"{app_name}/.next/*",
            f"{app_name}/.git/*",
        ]
    subprocess.run(cmd, cwd=parent, check=True)
    size = dest.stat().st_size
    dest.unlink()
    return size


def step_seconds(log_text: str) -> dict[str, int]:
    steps: dict[str, int] = {}
    for line in log_text.splitlines():
        marker = " completed in "
        if marker not in line or not line.rstrip().endswith("s"):
            continue
        body = line.split(marker, 1)[1]
        name = line.split(marker, 1)[0]
        name = name.split("✅")[-1].strip()
        number = body[:-1].strip()
        if number.isdigit():
            steps[name] = int(number)
    return steps


def patch_script(dest: Path) -> None:
    text = SCRIPT.read_text()
    old = "      ((installed_count++))"
    new = "      installed_count=$((installed_count + 1))"
    if old not in text:
        raise SystemExit("expected counter line is missing")
    dest.write_text(text.replace(old, new, 1))
    dest.chmod(0o755)


def reverse_names(ips: set[str]) -> dict[str, str]:
    names: dict[str, str] = {}
    for ip in sorted(ips):
        try:
            names[ip] = socket.gethostbyaddr(ip)[0]
        except OSError:
            names[ip] = ""
    return names


def run_one(spec: dict) -> dict:
    run_id = spec["run_id"]
    work = OUT_DIR / "runs" / run_id
    if work.exists():
        shutil.rmtree(work)
    work.mkdir(parents=True)
    # prime_warm keeps a cold run's cache for the later warm runs.
    # The directory starts empty, so that cold run still downloads.
    if spec["cache"] == "warm" or spec.get("prime_warm"):
        cache = OUT_DIR / "npm-cache-warm"
    else:
        cache = work / "cache"
    cache.mkdir(parents=True, exist_ok=True)

    script = SCRIPT
    if spec.get("patch_counter"):
        script = work / "create-next-starter.patched.sh"
        patch_script(script)

    app_name = spec.get("app_name")
    args = list(spec["args"])
    if app_name:
        args.append(app_name)

    env = os.environ.copy()
    env["NODE_ENV"] = "development"
    env["npm_config_registry"] = "https://registry.npmjs.org/"
    env["npm_config_fund"] = "false"
    env["npm_config_audit"] = "false"
    env["NPM_CONFIG_CACHE"] = str(cache)
    env["GIT_TERMINAL_PROMPT"] = "0"
    env["npm_config_update_notifier"] = "false"

    log_path = work / "output.log"
    cache_before = du_bytes(cache)
    rx0, tx0 = read_iface()
    io0, cpu0 = read_cpu_jiffies()
    ru0 = resource.getrusage(resource.RUSAGE_CHILDREN)
    cg0 = cgroup_cpu_usec()

    stdin_mode = spec.get("stdin", "devnull")
    stdin = subprocess.DEVNULL if stdin_mode == "devnull" else subprocess.PIPE
    log_f = open(log_path, "wb", buffering=0)
    started = time.time()
    t0 = now()
    proc = subprocess.Popen(
        ["bash", str(script), *args],
        cwd=work,
        env=env,
        stdin=stdin,
        stdout=log_f,
        stderr=subprocess.STDOUT,
        start_new_session=True,
    )
    try:
        (CGROUP / "cgroup.procs").write_text(str(proc.pid))
    except OSError as exc:
        cgroup_error = str(exc)
    else:
        cgroup_error = ""

    peak_rss = 0
    samples = 0
    states = {"R": 0, "S": 0, "D": 0, "other": 0}
    binaries: set[str] = set()
    peers: set[str] = set()
    saw_prompt = False
    prompt_seen_at = t0
    timeout_s = spec["timeout_s"]
    timed_out = False
    blocked_on_prompt = False

    while True:
        pids = descendants(proc.pid)
        rss = 0
        for pid in pids:
            value = proc_rss_bytes(pid)
            if value:
                rss += value
            state = proc_state(pid)
            if state == "R":
                states["R"] += 1
            elif state == "S":
                states["S"] += 1
            elif state == "D":
                states["D"] += 1
            elif state:
                states["other"] += 1
            exe = proc_exe(pid)
            if exe:
                binaries.add(os.path.basename(exe))
        peers.update(peers_for_inodes(socket_inodes(pids)))
        peak_rss = max(peak_rss, rss)
        samples += 1

        if stdin_mode == "pipe" and not saw_prompt:
            text = log_path.read_text(errors="replace")
            if "Do you want to remove it?" in text:
                saw_prompt = True
                prompt_seen_at = now()
        if saw_prompt and now() - prompt_seen_at > 10:
            blocked_on_prompt = True
            os.killpg(proc.pid, signal.SIGKILL)
            break

        if proc.poll() is not None:
            break
        if now() - t0 > timeout_s:
            timed_out = True
            os.killpg(proc.pid, signal.SIGKILL)
            break
        time.sleep(SAMPLE_S)

    proc.wait(timeout=30)
    log_f.close()
    wall = now() - t0
    ru1 = resource.getrusage(resource.RUSAGE_CHILDREN)
    rx1, tx1 = read_iface()
    io1, cpu1 = read_cpu_jiffies()
    cg1 = cgroup_cpu_usec()
    log_text = log_path.read_text(errors="replace")

    app_dir = work / app_name if app_name else None
    disk = None
    parts = {}
    zip_all = None
    zip_source = None
    next_version = None
    deps = {}
    markers = {
        "package_json": False,
        "node_modules": False,
        "utils": False,
        "convex_schema": False,
        "loading_tsx": False,
        "success_line": "Setup completed successfully" in log_text,
        "prompt_line": "Do you want to remove it?" in log_text,
    }
    if app_dir and app_dir.exists():
        disk = du_bytes(app_dir)
        for label, rel in (
            ("node_modules", "node_modules"),
            ("next_build", ".next"),
            ("git", ".git"),
        ):
            parts[label] = du_bytes(app_dir / rel)
        parts["source"] = max(0, disk - sum(parts.values()))
        markers["package_json"] = (app_dir / "package.json").exists()
        markers["node_modules"] = (app_dir / "node_modules").exists()
        markers["utils"] = (app_dir / "src" / "lib" / "utils.ts").exists()
        markers["convex_schema"] = (app_dir / "convex" / "schema.ts").exists()
        markers["loading_tsx"] = (app_dir / "src" / "components" / "ui" / "loading.tsx").exists()
        pkg_path = app_dir / "package.json"
        if pkg_path.exists():
            pkg = json.loads(pkg_path.read_text())
            all_deps = {}
            all_deps.update(pkg.get("dependencies") or {})
            all_deps.update(pkg.get("devDependencies") or {})
            for key in ("next", "react", "convex", "@clerk/nextjs"):
                if key in all_deps:
                    deps[key] = all_deps[key]
        next_pkg = app_dir / "node_modules" / "next" / "package.json"
        if next_pkg.exists():
            next_version = json.loads(next_pkg.read_text()).get("version")
        if spec.get("zip") and markers["package_json"]:
            zip_all = zip_bytes(work, app_name, work / "all.zip", exclude=False)
            zip_source = zip_bytes(work, app_name, work / "source.zip", exclude=True)

    busy = states["R"] + states["D"]
    waited = states["S"]
    jiffy_delta = max(1, cpu1 - cpu0)
    record = {
        "run_id": run_id,
        "kind": spec["kind"],
        "template": spec.get("template"),
        "skip_convex": spec.get("skip_convex"),
        "skip_clerk": spec.get("skip_clerk"),
        "cache": spec["cache"],
        "patch_counter": bool(spec.get("patch_counter")),
        "stdin": stdin_mode,
        "started_unix": started,
        "exit_code": proc.returncode,
        "timed_out": timed_out,
        "blocked_on_prompt": blocked_on_prompt,
        "wall_s": round(wall, 3),
        "cpu_user_s": round(ru1.ru_utime - ru0.ru_utime, 3),
        "cpu_sys_s": round(ru1.ru_stime - ru0.ru_stime, 3),
        "cpu_cgroup_s": None
        if cg0 is None or cg1 is None
        else round((cg1 - cg0) / 1_000_000, 3),
        "cgroup_error": cgroup_error,
        "peak_rss_bytes": peak_rss,
        "rss_samples": samples,
        "rss_sample_s": SAMPLE_S,
        "proc_state_samples": states,
        "runnable_sample_share": round(busy / max(1, busy + waited), 3),
        "iowait_share": round((io1 - io0) / jiffy_delta, 3),
        "disk_bytes": disk,
        "disk_parts": parts,
        "zip_all_bytes": zip_all,
        "zip_source_bytes": zip_source,
        "net_rx_bytes": rx1 - rx0,
        "net_tx_bytes": tx1 - tx0,
        "npm_cache_bytes": du_bytes(cache) - cache_before,
        "peer_ips": sorted(peers),
        "binaries": sorted(binaries),
        "step_seconds": step_seconds(log_text),
        "markers": markers,
        "package_versions": deps,
        "next_version": next_version,
        "log_tail": "\n".join(log_text.splitlines()[-40:]),
    }
    if app_dir and app_dir.exists() and not spec.get("keep"):
        shutil.rmtree(app_dir)
    return record


def append(record: dict) -> None:
    with RESULTS.open("a") as handle:
        handle.write(json.dumps(record) + "\n")
        handle.flush()
    print(
        json.dumps(
            {
                "run_id": record["run_id"],
                "exit": record["exit_code"],
                "wall_s": record["wall_s"],
                "cpu_user_s": record["cpu_user_s"],
                "cpu_sys_s": record["cpu_sys_s"],
                "peak_rss_bytes": record["peak_rss_bytes"],
                "disk_bytes": record["disk_bytes"],
                "zip_source_bytes": record["zip_source_bytes"],
                "zip_all_bytes": record["zip_all_bytes"],
                "net_rx_bytes": record["net_rx_bytes"],
                "net_tx_bytes": record["net_tx_bytes"],
                "blocked_on_prompt": record["blocked_on_prompt"],
                "success": record["markers"]["success_line"],
                "steps": record["step_seconds"],
            }
        ),
        flush=True,
    )


def generation_args(template: str, skip_convex: bool, skip_clerk: bool) -> list[str]:
    args = ["--template", template]
    if skip_convex:
        args.append("--skip-convex")
    if skip_clerk:
        args.append("--skip-clerk")
    return args


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    warm = OUT_DIR / "npm-cache-warm"
    if warm.exists():
        shutil.rmtree(warm)
    if RESULTS.exists():
        RESULTS.unlink()
    meta = {
        "run_id": "meta",
        "kind": "meta",
        "template": None,
        "skip_convex": None,
        "skip_clerk": None,
        "cache": "none",
        "nproc": os.cpu_count(),
        "loadavg": os.getloadavg(),
        "node": subprocess.check_output(["node", "-v"], text=True).strip(),
        "npm": subprocess.check_output(["npm", "-v"], text=True).strip(),
        "bash": subprocess.check_output(["bash", "--version"], text=True).splitlines()[0],
        "git": subprocess.check_output(["git", "--version"], text=True).strip(),
        "iface": IFACE,
        "note": "MCP env match: NODE_ENV=development, npm registry, fund and audit off. GIT_TERMINAL_PROMPT=0 is extra so git cannot block.",
    }
    # Idle interface rate, so generation deltas can be compared with it.
    rx0, tx0 = read_iface()
    time.sleep(10)
    rx1, tx1 = read_iface()
    meta["idle_10s_rx"] = rx1 - rx0
    meta["idle_10s_tx"] = tx1 - tx0
    with RESULTS.open("a") as handle:
        handle.write(json.dumps(meta) + "\n")
    print(json.dumps({"run_id": "meta", "idle_10s_rx": meta["idle_10s_rx"], "idle_10s_tx": meta["idle_10s_tx"]}), flush=True)

    specs: list[dict] = []
    for tool, args in (
        ("help", ["--help"]),
        ("test", ["--test"]),
        ("dry_run", ["--dry-run", "--template", "default", "dry-app"]),
    ):
        for index in range(1, 6):
            specs.append(
                {
                    "run_id": f"{tool}-{index}",
                    "kind": tool,
                    "template": "default" if tool == "dry_run" else None,
                    "cache": "none",
                    "args": args,
                    "timeout_s": 60,
                    "stdin": "devnull",
                }
            )
    specs.append(
        {
            "run_id": "prompt-no-flags",
            "kind": "prompt",
            "template": None,
            "cache": "none",
            "args": ["prompt-app"],
            "app_name": None,
            "timeout_s": 8,
            "stdin": "devnull",
        }
    )
    # args already include the name for the prompt test. Avoid a second name.
    specs[-1]["args"] = ["prompt-app"]

    specs.append(
        {
            "run_id": "shipped-default-open-stdin",
            "kind": "generate",
            "template": "default",
            "skip_convex": False,
            "skip_clerk": False,
            "cache": "cold",
            "patch_counter": False,
            "args": generation_args("default", False, False),
            "app_name": "shipped-default",
            "timeout_s": 1200,
            "stdin": "pipe",
            "zip": True,
        }
    )

    matrix = [
        ("minimal", True, True, 1),
        ("default", False, False, 3),
        ("full", False, False, 1),
        ("default", True, True, 1),
    ]
    for template, skip_convex, skip_clerk, count in matrix:
        tag = f"{template}-{'skip' if skip_convex and skip_clerk else 'with'}"
        for index in range(1, count + 1):
            specs.append(
                {
                    "run_id": f"cold-{tag}-{index}",
                    "kind": "generate",
                    "template": template,
                    "skip_convex": skip_convex,
                    "skip_clerk": skip_clerk,
                    "cache": "cold",
                    "prime_warm": template == "default" and not skip_convex and index == 1,
                    "patch_counter": True,
                    "args": generation_args(template, skip_convex, skip_clerk),
                    "app_name": f"c-{tag}-{index}",
                    "timeout_s": 1200,
                    "stdin": "devnull",
                    "zip": index == 1,
                }
            )
    for template, skip_convex, skip_clerk, count in (
        ("minimal", True, True, 1),
        ("default", False, False, 3),
        ("full", False, False, 1),
        ("default", True, True, 1),
    ):
        tag = f"{template}-{'skip' if skip_convex and skip_clerk else 'with'}"
        for index in range(1, count + 1):
            specs.append(
                {
                    "run_id": f"warm-{tag}-{index}",
                    "kind": "generate",
                    "template": template,
                    "skip_convex": skip_convex,
                    "skip_clerk": skip_clerk,
                    "cache": "warm",
                    "patch_counter": True,
                    "args": generation_args(template, skip_convex, skip_clerk),
                    "app_name": f"w-{tag}-{index}",
                    "timeout_s": 1200,
                    "stdin": "devnull",
                    "zip": False,
                }
            )

    for spec in specs:
        append(run_one(spec))


if __name__ == "__main__":
    main()
