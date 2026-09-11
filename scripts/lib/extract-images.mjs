// extract-images.mjs — extraction + signature dedupe for web-optimize (plan Task 3).
//
// Finds every image data URI in a deck HTML with span positions so the caller
// can rewrite them back-to-front, and groups identical images by a cheap
// content signature (the brief's formula) so duplicated embeds produce ONE
// asset file. Only image/ URIs are touched — font data URIs must survive.

const URI_RE = /data:image\/(jpeg|png|svg\+xml);base64,([A-Za-z0-9+/=]+)/g;

// Brief's signature: length + first-24 + last-24 of the unpadded base64.
// Identical bytes ⇒ identical signature; different lengths or differing
// head/tail ⇒ different signature (good enough for deck-sized embeds).
export function signature(b64) {
  const t = b64.replaceAll('=', '');
  return t.length + ':' + t.slice(0, 24) + ':' + t.slice(-24);
}

// extractSpans(html) → [{ start, end, mime, b64, sig }]
//   span [start, end) covers the whole data URI (mime through final base64 char).
export function extractSpans(html) {
  const spans = [];
  for (const m of html.matchAll(URI_RE)) {
    spans.push({
      start: m.index,
      end: m.index + m[0].length,
      mime: m[1],
      b64: m[2],
      sig: signature(m[2]),
    });
  }
  return spans;
}

// dedupe(spans) → Map sig → { sig, mime, b64, firstStart }
//   First occurrence wins (deterministic ordering for filenames).
export function dedupe(spans) {
  const bySig = new Map();
  for (const s of spans) {
    if (!bySig.has(s.sig)) bySig.set(s.sig, { sig: s.sig, mime: s.mime, b64: s.b64, firstStart: s.start });
  }
  return bySig;
}
