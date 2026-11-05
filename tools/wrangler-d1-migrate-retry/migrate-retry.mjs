// `npm run db:migrate` with retries. Cloudflare's API intermittently answers the D1 migrations call with
// "account is not valid or is not authorized [code: 7403]" (2026-11); a second try a few seconds later works.
// Migrations are idempotent (wrangler tracks applied ones), so retrying is safe. Any other error still fails fast.
import { spawnSync } from 'node:child_process';
const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const DB = process.env.D1_DATABASE ?? 'my-database'; // your D1 database name (or binding) as wrangler knows it
const args = ['wrangler', 'd1', 'migrations', 'apply', DB, '--remote'];
const transient = /7403|not authorized to access this service|ECONNRESET|ETIMEDOUT|fetch failed|502|503|504/i;
for (let attempt = 1; attempt <= 4; attempt++) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', shell: process.platform === 'win32' });
  process.stdout.write(r.stdout ?? ''); process.stderr.write(r.stderr ?? '');
  if (r.status === 0) process.exit(0);
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  if (attempt === 4 || !transient.test(out)) process.exit(r.status ?? 1);
  const wait = attempt * 5;
  console.log(`\n[db:migrate] transient Cloudflare API error (attempt ${attempt}); retrying in ${wait}s…\n`);
  spawnSync(process.execPath, ['-e', `setTimeout(() => {}, ${wait * 1000})`]);
}
