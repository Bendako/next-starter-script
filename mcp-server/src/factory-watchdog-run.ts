import { appendFile, mkdir, writeFile } from 'node:fs/promises';
import { collect, pilot, report, type Get } from './factory-watchdog-github.js';

if (process.env.GITHUB_REPOSITORY !== pilot) throw new Error('Watchdog is restricted to the pilot repository');
const token = process.env.GITHUB_TOKEN;
if (!token) throw new Error('GITHUB_TOKEN is required');
const get: Get = async path => {
  if (!path.startsWith(`/repos/${pilot}/`)) throw new Error('Outside pilot scope');
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: AbortSignal.timeout(30_000), redirect: 'error',
  });
  if (!response.ok) throw new Error(`GitHub read failed (${response.status})`);
  return response.json();
};
const collection = await collect(get, new Date().toISOString(), process.env.FACTORY_REVIEWER_LOGIN ?? '');
const result = report(collection);
await mkdir('watchdog-output', { recursive: true });
await writeFile('watchdog-output/health.json', JSON.stringify({ ...collection, stages: result.stages }, null, 2));
await writeFile('watchdog-output/health.md', result.markdown);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, result.markdown);
if (result.failed) process.exitCode = 1;
