#!/usr/bin/env node
// Check reviewed visible text after rendering or manual layout promotion.
import path from 'node:path';
import {readSlides,withDeck,renderedSlides,fidelity} from './lib/production.mjs';
const [source,html,...extra]=process.argv.slice(2);
if (!source || !html || extra.length) {
 console.error('Usage: keynote-fidelity.mjs <production.md> <deck.html>'); process.exit(2);
}
try {
 const slides=readSlides(source);
 const failures=await withDeck(path.resolve(html),async page=>fidelity(slides,await renderedSlides(page)));
 for(const failure of failures) console.log(`FAIL ${failure}`);
 if(failures.length) process.exitCode=1;
 else console.log(`PASS visible text, order and count for ${slides.length} slides. Images, charts, clipping and semantic edits still need visual/source review.`);
} catch(error) { console.error(error.message); process.exitCode=2; }
