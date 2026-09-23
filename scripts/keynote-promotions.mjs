#!/usr/bin/env node
// Preserve rich slide markup by stable ID; changed source or style cannot reuse it silently.
import fs from 'node:fs';
import path from 'node:path';
import {sourceFingerprint,readSlides,withDeck,renderedSlides,fidelity,styleFingerprint} from './lib/production.mjs';
const [operation,source,htmlFile,recordFile,...extra]=process.argv.slice(2);
if (!['capture','apply'].includes(operation)||!source||!htmlFile||!recordFile||extra.length) {
 console.error('Usage: keynote-promotions.mjs capture|apply <production.md> <deck.html> <layouts.json>'); process.exit(2);
}
try {
 const slides=readSlides(source);
 if(slides.some(s=>!s.id)) throw Error('Every production slide needs a stable > Slide ID: before saving or restoring layouts.');
 const html=path.resolve(htmlFile);
 const records=operation==='apply'?JSON.parse(fs.readFileSync(recordFile,'utf8')):null;
 await withDeck(html,async page=>{
   const rendered=await renderedSlides(page);
   const failures=fidelity(slides,rendered);
   if(failures.length) throw Error(failures.join('\n'));
   const style=await styleFingerprint(page);
   if(operation==='capture') {
     const entries=Object.fromEntries(slides.map((s,i)=>[s.id,{...sourceFingerprint(s,source),html:rendered[i].html}]));
     fs.writeFileSync(recordFile,JSON.stringify({schema:1,style,slides:entries},null,2)+'\n');
     console.log(`Saved ${slides.length} slide layouts. This is text fidelity, not visual approval.`);
   } else {
     if(records.schema!==1||!records.slides||records.style!==style) throw Error('Saved layout style or branding differs or record is invalid; review the new style and capture fresh layouts.');
     const replacements=[];
     for(const [i,s] of slides.entries()) {
       const prior=records.slides[s.id];
       const current=sourceFingerprint(s,source);
       if(!prior||!prior.reusable||!current.reusable||prior.sourceHash!==current.sourceHash) { console.log(`REVIEW ${s.id}: new/changed source or unverified asset; retaining fresh render.`); continue; }
       replacements.push({id:s.id,html:prior.html,pageno:i+1});
     }
     await page.evaluate(items=>{
       for(const item of items) {
         const current=[...document.querySelectorAll('.slide-wrap')].find(n=>n.dataset.slideId===item.id);
         const template=document.createElement('template');template.innerHTML=item.html;
         const next=template.content.firstElementChild;
         if(!current||!next||next.dataset.slideId!==item.id) throw Error('Invalid saved slide '+item.id);
         for(const number of next.querySelectorAll('.pageno,.kn-pageno')) number.textContent=String(item.pageno).padStart(2,'0');
         current.replaceWith(next);
       }
     },replacements);
     const after=fidelity(slides,await renderedSlides(page));
     if(after.length) throw Error(after.join('\n'));
     // Replace only slide spans in the original file. Keep head, script, and unrelated bytes intact.
     const final=await page.locator('.slide-wrap').evaluateAll(nodes=>nodes.map(n=>n.outerHTML));
     const original=fs.readFileSync(html,'utf8');
     const spans=slideSpans(original);
     if(spans.length!==final.length) throw Error('Cannot map HTML slide spans safely');
     let out=original;
     for(let i=spans.length-1;i>=0;i--) if(replacements.some(r=>r.id===slides[i].id)) out=out.slice(0,spans[i].start)+final[i]+out.slice(spans[i].end);
     fs.writeFileSync(html,out);
     console.log(`Restored ${replacements.length} unchanged layouts; inspect changed slides, then re-export PDF.`);
   }
 });
} catch(error) {console.error(error.message);process.exitCode=1;}

function slideSpans(html) {
 const spans=[];
 // Renderer/promoted slides are balanced div trees; ignore comments and raw script/style text.
 const token=/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>|<\/?div\b(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
 let match,depth=0,start=-1;
 while((match=token.exec(html))) {
   const t=match[0]; if(!/^<\/?div\b/i.test(t)) continue;
   if(/^<\/div/i.test(t)) { if(start>=0&&--depth===0){spans.push({start,end:token.lastIndex});start=-1;} }
   else if(start>=0) depth++;
   else if(/\bclass\s*=\s*["'][^"']*\bslide-wrap\b[^"']*["']/i.test(t)) {start=match.index;depth=1;}
 }
 if(start>=0) throw Error('Unbalanced slide markup');
 return spans;
}
