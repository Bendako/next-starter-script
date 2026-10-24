import { Sandbox } from '@vercel/sandbox';
import type { SandboxOpener, SandboxSession } from './sandbox.js';

// 1 vCPU gets 2048 MB. The probe used that size, persistent false, and a 5 minute cap.
export const openVercelSandbox: SandboxOpener = async (spec) => {
  const sandbox = await Sandbox.create({
    resources: { vcpus: spec.resources.vcpus },
    persistent: spec.persistent,
    timeout: spec.timeout,
    image: spec.image,
    networkPolicy: { allow: [...spec.networkPolicy.allow] },
  });
  const session: SandboxSession = {
    writeFiles: (files) => sandbox.writeFiles(files),
    async runCommand(params) {
      const result = await sandbox.runCommand({
        cmd: params.cmd,
        args: params.args,
        cwd: params.cwd,
      });
      return {
        exitCode: result.exitCode,
        stdout: await result.stdout(),
        stderr: await result.stderr(),
      };
    },
    async readFileToBuffer(file) {
      const buffer = await sandbox.readFileToBuffer(file);
      return buffer;
    },
    stop: async () => {
      await sandbox.stop();
    },
  };
  return session;
};
