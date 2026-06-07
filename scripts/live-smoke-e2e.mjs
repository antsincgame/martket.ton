/**
 * Delegates to canonical backend live-smoke E2E (Phase 1 → listing → PayEscrow → minted).
 */
import { spawnSync } from 'child_process';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const script = join(root, 'backend', 'scripts', 'live-smoke-e2e.mjs');
const result = spawnSync(process.execPath, ['--import', 'tsx', script], {
  stdio: 'inherit',
  cwd: join(root, 'backend'),
  env: process.env,
});
process.exit(result.status ?? 1);
