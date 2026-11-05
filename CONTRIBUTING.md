# Contributing

Thanks for looking. A few ground rules keep this repo useful to everyone:

- **Generic only.** A change that only makes sense for one firm's prices, forms, partners or workflow belongs in that firm's private code. If you are not sure, open an issue first.
- **Synthetic fixtures.** Never commit a real client's document, address, name, seal or signature. Generate test files (the ones in `packages/seal-check/fixtures` were made with ReportLab and pyHanko) and say so in the PR.
- **No new dependencies without a reason.** Each package is one file on purpose, so it can be copied into a project. Node's built-ins are fine.
- **Tests with every change.** `npm test` and `npm run typecheck` must pass. Node 22.6 or newer.
- **Facts, not accusations.** `seal-check` reports what it measured. Wording that calls a document fake, forged or fraudulent will not be merged; the person reviewing the file makes that call.

Open a pull request against `main`. Small, focused changes are reviewed fastest.
