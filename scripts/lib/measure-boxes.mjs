// measure-boxes.mjs — rendered-box measurement for web-optimize (plan Task 3).
//
// Launches headless chromium at viewport 2000x1200 (slides render at zoom
// var(--fit,1) = 1, so 1920px decks fit fully), loads the deck over file://,
// and records the on-screen box of every <img> and of every element with a
// data: CSS background-image. Backgrounds are matched GENERICALLY (any
// element, any class): this repo's keynote renderer emits full-bleed covers
// as `.kn-bg` background divs, while hand-styled decks use `.photo` — the
// measurement must not depend on knowing the class name in advance.
// Boxes are keyed by the image's base64 signature and
// the MAX box per signature wins — an image reused at several sizes is resized
// once, for its largest appearance.

import path from 'node:path';
import { getPlaywright } from './playwright.mjs';
import { signature } from './extract-images.mjs';

// measureBoxes(htmlPath) → Map sig → { boxW, boxH }
export async function measureBoxes(htmlPath) {
  const { chromium } = getPlaywright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 2000, height: 1200 } });
    await page.goto('file://' + path.resolve(htmlPath), { waitUntil: 'load' });
    // let layout + images settle (no nav script in some decks; fonts decode async)
    await page.waitForTimeout(300);

    const found = await page.evaluate(() => {
      const out = [];
      for (const img of document.querySelectorAll('img')) {
        if (!img.src || !img.src.startsWith('data:')) continue;
        out.push({
          src: img.src,
          w: Math.round(img.getBoundingClientRect().width),
          h: Math.round(img.getBoundingClientRect().height),
        });
      }
      // any element with a data: background-image (renderer .kn-bg, hand-styled
      // .photo, anything else) — computed style, so inline/CSS/rule origins all
      // match; matchAll covers multi-url backgrounds (gradients + url())
      for (const el of document.querySelectorAll('*')) {
        const bg = getComputedStyle(el).backgroundImage || '';
        for (const m of bg.matchAll(/url\(['"]?(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+)['"]?\)/g)) {
          out.push({
            src: m[1],
            w: Math.round(el.getBoundingClientRect().width),
            h: Math.round(el.getBoundingClientRect().height),
          });
        }
      }
      return out;
    });

    const boxes = new Map(); // sig → { boxW, boxH } (max box per signature)
    for (const { src, w, h } of found) {
      const m = src.match(/;base64,([A-Za-z0-9+/=]+)/);
      if (!m) continue;
      const sig = signature(m[1]);
      const prev = boxes.get(sig);
      if (!prev || w * h > prev.boxW * prev.boxH) boxes.set(sig, { boxW: w, boxH: h });
    }
    return boxes;
  } finally {
    await browser.close();
  }
}
