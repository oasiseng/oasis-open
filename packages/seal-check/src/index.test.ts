import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanPdf, sealVerdict, crossFileReuse } from './index.ts';

const fx = (n: string) => new Uint8Array(readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', n)));

describe('seal-check: deterministic PDF scan', () => {
  it('a real digital signature on a CAD-style PDF → clean', async () => {
    const s = await scanPdf(fx('signed-vector.pdf'));
    assert.equal(s.ok, true); assert.equal(s.pages, 2); assert.equal(s.signatures, 1); assert.equal(s.signaturesWithByteRange, 1);
    assert.equal(s.imageOnlyPages, 0); assert.equal(s.vectorPages, 2); assert.deepEqual(s.flags, []);
    assert.equal(sealVerdict(s, { present: true }), 'clean');
  });

  it('the same drawing unsigned → "no cryptographic signature", and only a verdict when a seal is actually seen', async () => {
    const s = await scanPdf(fx('unsigned-vector.pdf'));
    assert.equal(s.signatures, 0); assert.equal(s.vectorPages, 2);
    assert.match(s.flags[0]!, /No cryptographic digital signature/);
    assert.equal(sealVerdict(s, { present: true }), 'no-signature');
    assert.equal(sealVerdict(s, null), 'unknown', 'an unsigned survey or spec sheet is not a problem');
  });

  it('flat picture pages with one pasted seal bitmap (phone-made) → every tell flagged', async () => {
    const s = await scanPdf(fx('flat-pasted-seal.pdf'));
    assert.equal(s.pages, 2); assert.equal(s.signatures, 0); assert.equal(s.imageOnlyPages, 2); assert.equal(s.vectorPages, 0);
    assert.equal(s.generatorSizedPages, 2);
    assert.deepEqual(s.reusedImages.map((i) => `${i.w}x${i.h}x${i.uses}`), ['1320x1158x2']);
    assert.match(s.producer!, /Quartz PDFContext/); assert.equal(s.created, '2026-08-13T16:07:49Z');
    const text = s.flags.join('\n');
    assert.match(text, /No cryptographic digital signature/);
    assert.match(text, /Every page is a flat picture \(2 of 2\)/);
    assert.match(text, /same bitmap is drawn on 2 pages \(1320×1158/);
    assert.match(text, /AI image generators/);
    assert.match(text, /Made on an iPhone/);
    assert.equal(sealVerdict(s, { present: true }), 'no-signature');
    assert.equal(sealVerdict(s, { present: true, looksPasted: true }), 'no-signature');
    const reuse = crossFileReuse([{ name: 'a.pdf', scan: s }, { name: 'b.pdf', scan: await scanPdf(fx('flat-pasted-seal.pdf')) }]);
    assert.ok(reuse.some((l) => /identical 1320×1158 image .* appears in 2 files: a\.pdf, b\.pdf/.test(l)), reuse.join('\n'));
  });

  it('not a PDF → ok:false, no flags, no verdict', async () => {
    const s = await scanPdf(new TextEncoder().encode('hello'));
    assert.equal(s.ok, false); assert.deepEqual(s.flags, []); assert.equal(sealVerdict(s, { present: true }), 'unknown');
  });
});
