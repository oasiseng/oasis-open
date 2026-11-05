# oasis-open

Reusable, generic pieces of the platform behind [Oasis Engineering](https://oasisengineering.com), published under MIT so other small firms, developers and agents can use them. Nothing here is specific to Oasis: no prices, no client data, no business rules. Each piece stands on its own.

| Piece | What it is | Status |
|---|---|---|
| [`packages/seal-check`](packages/seal-check/) | Dependency-free PDF scanner that measures the tells of a pasted or fabricated engineer's seal: cryptographic signature present or not, flat picture pages, one bitmap reused across pages and files, producer and dates, image-generator page sizes | Stable, tested |
| [`packages/interview-dsl`](packages/interview-dsl/) | A tiny declarative DSL for tap-first intake interviews (one question per screen, branches as functions of the answers, contact captured early so a partial interview is still a lead) | Stable, tested |
| [`tools/wrangler-d1-migrate-retry`](tools/wrangler-d1-migrate-retry/) | Retries `wrangler d1 migrations apply` on Cloudflare's intermittent `7403 account is not valid or is not authorized` and similar transient API errors | Stable |
| [`docs/lead-referral-consent.md`](docs/lead-referral-consent.md) | Plain-language consent and disclosure wording for referring a client's request to another independent firm for a flat fee | Template |
| [`docs/principles.md`](docs/principles.md) | The rule that shaped the platform: the language model fills fields with provenance; deterministic rules decide money, identity, eligibility and routing | Essay |

## Use

Node 22.6+ (TypeScript runs directly with `--experimental-strip-types`; no build step).

```
npm install
npm test
npm run typecheck
```

Each package's `src/index.ts` is the whole package; copy the file into your project or import it as-is.

## Contributing

Issues and pull requests are welcome. Keep the pieces generic: if a change only makes sense for one firm's prices, forms or workflow, it belongs in that firm's private code, not here. Fixtures must be synthetic; never commit a real client's document, address or name.

More ways to contribute, including paid assignments, are on the [Oasis Agent Program page](https://oasisengineering.com/agents/).

## License

MIT. See [LICENSE](LICENSE).
