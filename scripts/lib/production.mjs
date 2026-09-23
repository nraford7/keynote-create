import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {getPlaywright} from './playwright.mjs';
import {parseDeck} from './deck-content.mjs';
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');
export function readSlides(file) {
  const {slides} = parseDeck(fs.readFileSync(file,'utf8'));
  if (!slides.length) throw Error('No source slides found');
  return slides;
}
export async function withDeck(file, action) {
  const browser = await getPlaywright().chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1920,height:1080}});
    await page.goto(pathToFileURL(file).href,{waitUntil:'load'});
    // Evaluate all slides in reading mode, not only the current presentation slide.
    await page.evaluate(()=>document.body.classList.remove('show'));
    return await action(page);
  } finally { await browser.close(); }
}
export async function renderedSlides(page) {
 return page.locator('.slide-wrap').evaluateAll(wraps=>wraps.map(w=>{
   const parts=[];
   const walk=document.createTreeWalker(w,NodeFilter.SHOW_TEXT);
   let node;
   while((node=walk.nextNode())) {
     const parent=node.parentElement;
     if (!parent || parent.closest('.speaker-note,script,style,.footer,.pageno,.kn-placeholder')) continue;
     if (!parent.checkVisibility({checkOpacity:true,checkVisibilityCSS:true})) continue;
     parts.push(node.nodeValue);
   }
   return {id:w.dataset.slideId||'',text:parts.join(' '),html:w.outerHTML};
 }));
}
const normalize = text => text.replace(/\*\*([^*]+?)\*\*/g,'$1').replace(/(^|[^*])\*([^*\s][^*]*?)\*(?!\*)/g,'$1$2').replace(/\s*[·•]\s*/g,' ').replace(/\s+/g,' ').replace(/\s+([.,;:!?])/g,'$1').trim();
export function fidelity(slides, rendered) {
 const failures=[];
 if (slides.length!==rendered.length) failures.push(`Slide count: expected ${slides.length}, found ${rendered.length}`);
 slides.forEach((s,i)=>{
   const r=rendered[i];
   if (!r) return;
   if (s.id && s.id!==r.id) failures.push(`Slide order/ID at ${i+1}: expected ${s.id}, found ${r.id||'(missing)'}`);
   const visible=normalize(r.text);
   for (const expected of [s.title,...s.bullets].filter(Boolean)) {
     if (!visible.includes(normalize(expected))) failures.push(`Slide ${s.id||i+1} missing visible content: ${expected}`);
   }
 });
 return failures;
}
export async function styleFingerprint(page) {
 const styles=await page.locator('style,link[rel="stylesheet"],meta[name="keynote-render-context"]').evaluateAll(nodes=>nodes.map(n=>n.outerHTML).join('\n'));
 const branding=await page.locator('.footer .brand,.kn-sub').evaluateAll(nodes=>[...new Set(nodes.map(n=>n.textContent))].sort().join('\n'));
 return hash(styles+'\n'+branding);
}

// Embedded assets can change while their Markdown path stays the same.
export function sourceFingerprint(slide, sourceFile) {
 const refs=[slide.image].filter(Boolean);
 const frames=/(?:three dated|two) frames:\s*(.+?)(?=\.\s|$)/i.exec(slide.art||'');
 if(frames) refs.push(...frames[1].split('/').map(s=>s.trim()));
 let reusable=true;
 const assets=refs.map(ref=>{
   if(/^data:/i.test(ref)) return [ref];
   if(/^[a-z][a-z0-9+.-]*:/i.test(ref)&&!/^file:/i.test(ref)) {reusable=false;return [ref,'external'];}
   const file=/^file:/i.test(ref)?fileURLToPath(ref):path.resolve(path.dirname(sourceFile),ref);
   try {return [ref,hash(fs.readFileSync(file))];}
   catch {reusable=false;return [ref,'missing'];}
 });
 return {sourceHash:hash(JSON.stringify({slide,assets})),reusable};
}
