/**
 * seal-check — a dependency-free PDF scanner that measures the tells of a pasted or fabricated engineer's seal.
 *
 * For any PDF it answers, deterministically and in a few milliseconds:
 *   - is there a real cryptographic signature (a /Sig object with /ByteRange + /Contents), or none at all;
 *   - are the pages flat pictures (no text operators, no drawing operators) — rasterized or generated sheets;
 *   - is one seal-sized bitmap pasted across pages (same stream bytes, same size);
 *   - what produced the file and when (iOS Quartz, Word, AutoCAD, Bluebeam…), creation vs modification time;
 *   - do page images have the exact sizes image generators emit.
 *
 * It reports facts; it never calls anyone anything. Florida's Rule 61G15-23 (and its equivalents elsewhere) requires
 * electronically delivered sealed documents to carry a digital signature with a certificate, so "no cryptographic
 * signature" is a technical fact a reviewer can act on. Exotic encodings and object streams degrade to "unknown",
 * never to a wrong accusation.
 */

export interface SealScan {
  /** PDF parsed at all */
  ok: boolean;
  pages: number;
  /** /Sig objects (signature dictionaries) — a real digital signature leaves at least one */
  signatures: number;
  /** of those, with a certificate-style /Contents and a /ByteRange (the shape every PAdES/Adobe signature has) */
  signaturesWithByteRange: number;
  producer: string | null;
  creator: string | null;
  created: string | null;
  modified: string | null;
  /** pages whose content stream has no text and (almost) no drawing operators but draws an image */
  imageOnlyPages: number;
  /** pages that draw text or vectors (a CAD / Bluebeam / Word export) */
  vectorPages: number;
  images: Array<{ w: number; h: number; bytes: number; uses: number; sha: string }>;
  /** one image stream (by bytes) drawn on more than one page, or several pages carrying a bitmap of the same size & bytes */
  reusedImages: Array<{ w: number; h: number; bytes: number; uses: number }>;
  /** page image sizes typical of image generators (1024/1536/1448×1086 and friends) */
  generatorSizedPages: number;
  flags: string[];
}

const dec = new TextDecoder('latin1');
const GEN_SIZES = new Set(['1024x1024', '1536x1024', '1024x1536', '1448x1086', '1086x1448', '1792x1024', '1024x1792', '1344x768', '768x1344', '1152x896', '896x1152', '1216x832', '832x1216']);

/** Pure-JS scan. Handles the common producers (Quartz, Word, Acrobat, Bluebeam, AutoCAD) well enough; object streams and
 *  exotic encodings degrade to "unknown", never to a wrong accusation. Bounded work: at most ~40 MB in, a few ms. */
export async function scanPdf(bytes: Uint8Array): Promise<SealScan> {
  const out: SealScan = { ok: false, pages: 0, signatures: 0, signaturesWithByteRange: 0, producer: null, creator: null, created: null, modified: null, imageOnlyPages: 0, vectorPages: 0, images: [], reusedImages: [], generatorSizedPages: 0, flags: [] };
  if (bytes.length < 8 || dec.decode(bytes.subarray(0, 5)) !== '%PDF-') return out;
  const text = dec.decode(bytes.subarray(0, Math.min(bytes.length, 40 * 1024 * 1024)));
  out.ok = true;
  // --- info dictionary (may be inside an object stream for newer producers; then stays null)
  const meta = (key: string) => { const m = text.match(new RegExp(`/${key}\\s*\\(((?:\\\\.|[^\\\\)])*)\\)`)); if (m) return m[1]!.replace(/\\(.)/g, '$1').slice(0, 120); const h = text.match(new RegExp(`/${key}\\s*<([0-9A-Fa-f]+)>`)); return h ? hexToStr(h[1]!).slice(0, 120) : null; };
  out.producer = meta('Producer'); out.creator = meta('Creator'); out.created = pdfDate(meta('CreationDate')); out.modified = pdfDate(meta('ModDate'));
  // --- signatures
  // A signature value dictionary: /Type /Sig (any key order), with /ByteRange and a hex /Contents (the PKCS#7 blob).
  // Scanned over whole objects, since producers order keys differently. /Contents <…> can be tens of KB: look at the object head only.
  const sigObjs = [...text.matchAll(/\d+\s+\d+\s+obj\b([\s\S]{0,120000}?)endobj/g)].map((m) => m[1]!).filter((b) => /\/Type\s*\/Sig\b/.test(b) || (/\/ByteRange\s*\[/.test(b) && /\/SubFilter\s*\//.test(b)));
  out.signatures = sigObjs.length;
  out.signaturesWithByteRange = sigObjs.filter((b) => /\/ByteRange\s*\[/.test(b) && /\/Contents\s*<[0-9A-Fa-f]{64,}/.test(b)).length;
  if (!out.signatures && /\/ByteRange\s*\[/.test(text) && /\/SubFilter\s*\/(adbe|ETSI)/i.test(text)) { out.signatures = 1; out.signaturesWithByteRange = 1; } // producer put the dict in an object stream
  // --- objects: content streams and image XObjects
  // incremental updates (iOS re-saves, Acrobat edits) rewrite objects: keep the LAST copy of each object number
  const lastByNum = new Map<string, RegExpMatchArray>();
  for (const m of text.matchAll(/(\d+)\s+(\d+)\s+obj\b([\s\S]*?)endobj/g)) lastByNum.set(m[1]!, m);
  const objs = [...lastByNum.values()];
  const imagesByRef = new Map<string, { w: number; h: number; bytes: number; sha: string }>();
  const streamsByRef = new Map<string, { dict: string; start: number; len: number }>();
  for (const m of objs) {
    const ref = `${m[1]} ${m[2]} R`;
    const body = m[3]!;
    const si = body.indexOf('stream');
    if (si < 0) continue;
    const dict = body.slice(0, si);
    const lenM = dict.match(/\/Length\s+(\d+)(?:\s+0\s+R)?/);
    const after = body.slice(si + 6).replace(/^\r?\n/, '');
    const bodyStart = m.index! + m[0].indexOf('stream') + 6 + (body.slice(si + 6).startsWith('\r\n') ? 2 : 1);
    const len = lenM && !/R$/.test(lenM[0]) ? Number(lenM[1]) : Math.max(0, after.indexOf('endstream'));
    if (/\/Subtype\s*\/Image\b/.test(dict)) {
      const w = Number(dict.match(/\/Width\s+(\d+)/)?.[1] ?? 0), h = Number(dict.match(/\/Height\s+(\d+)/)?.[1] ?? 0);
      const raw = bytes.subarray(bodyStart, bodyStart + Math.min(len, 2_000_000));
      imagesByRef.set(ref, { w, h, bytes: len, sha: await sha1(raw) });
    } else {
      streamsByRef.set(ref, { dict, start: bodyStart, len });
    }
  }
  // --- pages
  const pageObjs = objs.filter((m) => /\/Type\s*\/Page\b/.test(m[3]!) && !/\/Type\s*\/Pages\b/.test(m[3]!));
  out.pages = pageObjs.length;
  const uses = new Map<string, number>();
  const sizeUses = new Map<string, number>();
  for (const pm of pageObjs) {
    const body = pm[3]!;
    const contentsRefs = [...(body.match(/\/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)/)?.[1] ?? '').matchAll(/(\d+\s+\d+\s+R)/g)].map((x) => x[1]!);
    let content = '';
    for (const r of contentsRefs) {
      const s = streamsByRef.get(r); if (!s) continue;
      content += await decodeStream(bytes.subarray(s.start, s.start + s.len), s.dict);
    }
    const hasText = /\bT[jJ]\b/.test(content) && /\bBT\b/.test(content);
    const vectorOps = (content.match(/\b(l|c|re|v|y)\b/g) ?? []).length;
    const drawsImage = /\bDo\b/.test(content);
    // which images does this page draw? resources may be inline or by reference
    let res = balanced(body, body.indexOf('/Resources'));
    const resRef = body.match(/\/Resources\s+(\d+\s+\d+\s+R)/)?.[1];
    if (resRef) { const ro = objs.find((o) => `${o[1]} ${o[2]} R` === resRef); res = ro?.[3] ?? ''; }
    // XObject dict may itself be a reference
    const xoRef = res.match(/\/XObject\s+(\d+\s+\d+\s+R)/)?.[1];
    if (xoRef) { const xo = objs.find((o) => `${o[1]} ${o[2]} R` === xoRef); res += xo?.[3] ?? ''; }
    const xobjRefs = [...new Set([...res.matchAll(/\/[\w.]+\s+(\d+\s+\d+\s+R)/g)].map((x) => x[1]!).filter((r) => imagesByRef.has(r)))];
    let pageImgPx = 0;
    for (const r of xobjRefs) { uses.set(r, (uses.get(r) ?? 0) + 1); const im = imagesByRef.get(r)!; sizeUses.set(`${im.sha}`, (sizeUses.get(im.sha) ?? 0) + 1); if (im.w * im.h > pageImgPx) pageImgPx = im.w * im.h; if (GEN_SIZES.has(`${im.w}x${im.h}`)) out.generatorSizedPages++; }
    if (!hasText && vectorOps <= 3 && drawsImage && xobjRefs.length) out.imageOnlyPages++;
    else if (hasText || vectorOps > 3) out.vectorPages++;
  }
  const bySha = new Map<string, { w: number; h: number; bytes: number; uses: number; sha: string }>();
  for (const [ref, im] of imagesByRef) { const u = uses.get(ref) ?? 0; const cur = bySha.get(im.sha); if (cur) cur.uses += u; else bySha.set(im.sha, { ...im, uses: u }); }
  out.images = [...bySha.values()].sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 20);
  out.reusedImages = out.images.filter((i) => i.uses > 1).map(({ w, h, bytes, uses }) => ({ w, h, bytes, uses }));
  // --- flags (facts, in the owner's words)
  if (!out.signatures) out.flags.push('No cryptographic digital signature in the file (no signature object or certificate). Any "digitally signed" wording is part of the picture.');
  else if (!out.signaturesWithByteRange) out.flags.push(`${out.signatures} signature object(s) but no byte-range / certificate data — not a verifiable digital signature.`);
  if (out.pages && out.imageOnlyPages === out.pages) out.flags.push(`Every page is a flat picture (${out.pages} of ${out.pages}): no text or CAD/vector content — a scan, a photo, or a generated image.`);
  else if (out.imageOnlyPages) out.flags.push(`${out.imageOnlyPages} of ${out.pages} pages are flat pictures with no text or vector content.`);
  if (out.reusedImages.length) out.flags.push(`The same bitmap is drawn on ${out.reusedImages[0]!.uses} pages (${out.reusedImages[0]!.w}×${out.reusedImages[0]!.h}, ${Math.round(out.reusedImages[0]!.bytes / 1024)} KB) — consistent with one seal image pasted onto each sheet.`);
  if (out.generatorSizedPages) out.flags.push(`${out.generatorSizedPages} page image(s) at sizes typical of AI image generators (e.g. 1536×1024, 1448×1086). Consistent with generation, not proof.`);
  if (out.producer && /quartz pdfcontext|ios version/i.test(out.producer)) out.flags.push(`Made on an iPhone/iPad (${out.producer.slice(0, 60)}), not by CAD or a PDF signing tool.`);
  return out;
}

/** Same seal bitmap across several FILES (one pasted seal image reused in a batch of PDFs). Call with each file's scan. */
export function crossFileReuse(scans: Array<{ name: string; scan: SealScan }>): string[] {
  const seen = new Map<string, string[]>();
  for (const { name, scan } of scans) for (const im of scan.images) { if (!im.uses) continue; const k = `${im.sha}`; seen.set(k, [...(seen.get(k) ?? []), name]); } // uses=0: soft masks and unused objects
  return [...seen.entries()].filter(([, files]) => new Set(files).size > 1).map(([k, files]) => { const im = scans.flatMap((s) => s.scan.images).find((i) => i.sha === k)!; return `The identical ${im.w}×${im.h} image (${Math.round(im.bytes / 1024)} KB) appears in ${new Set(files).size} files: ${[...new Set(files)].join(', ')}.`; });
}

export function sealVerdict(scan: SealScan, model?: { present?: boolean; looksPasted?: boolean; looksGenerated?: boolean } | null): 'clean' | 'concerns' | 'no-signature' | 'unknown' {
  if (!scan.ok) return 'unknown';
  const sealy = !!model?.present;
  if (scan.signaturesWithByteRange && !model?.looksPasted && !model?.looksGenerated) return scan.imageOnlyPages === scan.pages && scan.pages > 0 ? 'concerns' : 'clean';
  if (!scan.signatures && sealy) return 'no-signature';
  if (model?.looksPasted || model?.looksGenerated || scan.reusedImages.length || (scan.pages > 0 && scan.imageOnlyPages === scan.pages && sealy)) return 'concerns';
  return scan.signatures ? 'concerns' : 'unknown';
}

// ───────────────────────────── helpers ─────────────────────────────

/** The balanced `<< … >>` dictionary that starts after position i (or '' when none). */
function balanced(src: string, i: number): string {
  if (i < 0) return '';
  const start = src.indexOf('<<', i); if (start < 0) return '';
  let depth = 0;
  for (let j = start; j < src.length - 1; j++) {
    if (src[j] === '<' && src[j + 1] === '<') { depth++; j++; }
    else if (src[j] === '>' && src[j + 1] === '>') { depth--; j++; if (depth === 0) return src.slice(start, j + 1); }
  }
  return src.slice(start);
}

async function decodeStream(raw: Uint8Array, dict: string): Promise<string> {
  const filters = [...(dict.match(/\/Filter\s*(\[[^\]]*\]|\/\w+)/)?.[1] ?? '').matchAll(/\/(\w+)/g)].map((m) => m[1]!);
  let data: Uint8Array = raw;
  try {
    for (const f of filters) {
      if (f === 'ASCII85Decode') data = ascii85(data);
      else if (f === 'ASCIIHexDecode') data = new Uint8Array((dec.decode(data).replace(/[^0-9A-Fa-f]/g, '').match(/../g) ?? []).map((h) => parseInt(h, 16)));
      else if (f === 'FlateDecode' && typeof DecompressionStream !== 'undefined') {
        const ds = new DecompressionStream('deflate');
        const w = ds.writable.getWriter(); void w.write(data as BufferSource).catch(() => undefined); void w.close().catch(() => undefined);
        data = new Uint8Array(await new Response(ds.readable).arrayBuffer());
      } else return ''; // LZW, DCT, etc.: unknown content, never a verdict
    }
    return dec.decode(data.subarray(0, 2_000_000));
  } catch { return ''; }
}
function ascii85(data: Uint8Array): Uint8Array {
  let s = dec.decode(data).replace(/^<~/, '').replace(/~>[\s\S]*$/, '').replace(/\s+/g, '');
  const out: number[] = [];
  for (let i = 0; i < s.length;) {
    if (s[i] === 'z') { out.push(0, 0, 0, 0); i++; continue; }
    const chunk = s.slice(i, i + 5); i += 5;
    const pad = 5 - chunk.length;
    let v = 0; for (const ch of (chunk + 'uuuu').slice(0, 5)) v = v * 85 + (ch.charCodeAt(0) - 33);
    const b = [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
    out.push(...b.slice(0, 4 - pad));
  }
  return new Uint8Array(out);
}
async function sha1(bytes: Uint8Array): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', bytes as BufferSource);
  return [...new Uint8Array(h)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function hexToStr(h: string): string { let s = ''; for (let i = 0; i + 1 < h.length; i += 2) s += String.fromCharCode(parseInt(h.slice(i, i + 2), 16)); return s.replace(/^\xfe\xff/, '').replace(/\0/g, ''); }
function pdfDate(s: string | null): string | null {
  if (!s) return null;
  const m = s.match(/D:(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?([+\-Z])?(\d{2})?'?(\d{2})?/);
  if (!m) return s;
  const [, y, mo, d, hh = '00', mi = '00', ss = '00', tz = 'Z', th = '00', tm = '00'] = m;
  const off = tz === 'Z' || !tz ? 'Z' : `${tz}${th}:${tm}`;
  return `${y}-${mo}-${d}T${hh}:${mi}:${ss}${off}`;
}
