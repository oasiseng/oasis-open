# seal-check

A dependency-free PDF scanner that measures the tells of a pasted or fabricated engineer's seal. Pure JavaScript, runs anywhere (Node, Cloudflare Workers, the browser), a few milliseconds per file, bounded to about 40 MB of input.

It reports facts. It never decides that a document is fake; a person does that, with the facts in front of them.

## What it measures

For any PDF, `scanPdf(bytes)` returns a `SealScan`:

- `signatures` / `signaturesWithByteRange`: `/Sig` objects, and how many have the `/ByteRange` + hex `/Contents` shape every real digital signature (Adobe, PAdES, DocuSign-style certificates) has. Zero means no cryptographic signature anywhere in the file, which in Florida (Rule 61G15-23) and most states means an electronically delivered sealed document is not validly sealed, whatever picture is on the page.
- `imageOnlyPages` / `vectorPages`: pages whose content stream draws only an image versus pages with text or drawing operators. A CAD, Bluebeam or Word export has vector pages; a photographed or generated sheet is a flat picture.
- `reusedImages`: one bitmap (same bytes, same size) drawn on several pages, which is what a seal pasted as an image looks like.
- `generatorSizedPages`: page images with the exact dimensions image generators emit (1024×1024, 1536×1024, 1448×1086 and friends).
- `producer`, `creator`, `created`, `modified`: what made the file and when. "iOS Quartz PDFContext, created 11 minutes before upload" is a fact worth seeing next to a seal dated two years ago.
- `flags`: the above as short sentences, ready to show on a review card.

`crossFileReuse(scans)` finds the same bitmap across several files in a batch. `sealVerdict(scan, model?)` collapses a scan into `clean | concerns | no-signature | unknown`, taking an optional second opinion (for example from a vision model that looked at the page) about whether a seal is present or looks pasted. With no seal seen, an unsigned PDF is `unknown`, not a problem: surveys and spec sheets are unsigned too.

Handles the common producers well. Object streams and exotic encodings degrade to `ok: false` or fewer measurements, never to a wrong accusation.

## Use

```ts
import { scanPdf, sealVerdict, crossFileReuse } from './src/index.ts';

const scan = await scanPdf(new Uint8Array(await file.arrayBuffer()));
console.log(scan.flags);
// [ 'No cryptographic digital signature in the file (no signature object or certificate). Any "digitally signed" wording is part of the picture.',
//   'Every page is a flat picture (2 of 2): no text or CAD/vector content — a scan, a photo, or a generated image.',
//   'The same bitmap is drawn on 2 pages (1320×1158, 1 KB) — consistent with one seal image pasted onto each sheet.',
//   '2 page image(s) at sizes typical of AI image generators (e.g. 1536×1024, 1448×1086). Consistent with generation, not proof.',
//   'Made on an iPhone/iPad (iOS Version 26.5.2 (Build 23F84) Quartz PDFContext), not by CAD or a PDF signing tool.' ]
console.log(sealVerdict(scan, { present: true })); // 'no-signature'
```

## Fixtures

`fixtures/` holds three synthetic PDFs: a signed vector drawing, the same drawing unsigned, and a two-page flat-image file with one pasted seal bitmap. They were generated for the tests and contain no real names, seals or projects. Please keep it that way in pull requests.

## Why this exists

Small engineering firms get sent "sealed" plans to validate, re-stamp or build from. Some of those seals were lifted from another engineer's real documents. Checking by eye is slow and unreliable; checking the file's structure is instant and objective, and leaves a due-diligence record. This scanner is the deterministic half of that check; a vision model reading the seal block (name, license, whether it looks pasted) is the other half, and the two are combined with `sealVerdict`.
