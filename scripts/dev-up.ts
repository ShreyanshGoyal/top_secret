import { spawnSync } from 'node:child_process';
const result = spawnSync('docker', ['compose', '-f', 'infra/compose.yaml', 'up', '-d'], { stdio: 'inherit' });
if (result.status !== 0) process.exitCode = result.status ?? 1;
