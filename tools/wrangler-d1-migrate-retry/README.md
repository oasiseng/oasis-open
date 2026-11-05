# wrangler-d1-migrate-retry

`wrangler d1 migrations apply <db> --remote` intermittently fails with

```
account is not valid or is not authorized to access this service [code: 7403]
```

even when nothing is wrong with the account or token; a second try a few seconds later succeeds. If your deploy script runs migrations first, that one flake blocks every deploy.

This 17-line script retries only on transient errors (7403, "not authorized to access this service", `ECONNRESET`, `ETIMEDOUT`, `fetch failed`, 502/503/504) with a growing wait (5 s, 10 s, 15 s), up to four attempts. Any other error fails fast with wrangler's own output. Migrations are idempotent (wrangler records applied ones), so a retry is safe.

## Use

Copy `migrate-retry.mjs` into your project, set the database name on the `DB` line (or pass `D1_DATABASE=<name>` in the environment), and point your `db:migrate` script at it:

```json
"scripts": {
  "db:migrate": "node scripts/migrate-retry.mjs",
  "deploy": "npm run db:migrate && wrangler deploy"
}
```

Works on Windows (`npx.cmd` via a shell) and POSIX. No dependencies.
