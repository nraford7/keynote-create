import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (name, args) => spawnSync(process.execPath, [path.join(root, 'scripts', name), ...args], {encoding:'utf8'});
function fixture(t) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kc-production-'));
 t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const md=path.join(dir,'deck.md'), html=path.join(dir,'deck.html'), saved=path.join(dir,'layouts.json');
 const a='## Pilot result\n> Slide ID: result\n- Nonrandom sample; not a population estimate.\n> Speaker note: Private preparation.';
 const b='## Measure before expanding\n> Slide ID: next\n- No intervention has been tested.';
 const source=parts=>'# Pilot\n\n---\n\n'+parts.join('\n\n---\n\n')+'\n';
 const slide=(id,title,support,n,extra='')=>`<div class="slide-wrap" data-slide-id="${id}"><div class="slide"><h2>${title}</h2><p>${support}</p>${extra}<div class="pageno">${n}</div></div></div>`;
 const envelope=content=>`<!doctype html><html><head><style>.speaker-note{display:none}.slide{width:1000px;height:500px}</style></head><body>${content}</body></html>`;
 const aa=slide('result','Pilot result','Nonrandom sample; not a population estimate.',1,'<div class="speaker-note">Private preparation.</div>');
 const bb=slide('next','Measure before expanding','No intervention has been tested.',2);
 fs.writeFileSync(md,source([a,b])); fs.writeFileSync(html,envelope(aa+bb));
 return {dir,md,html,saved,a,b,source,slide,envelope,aa,bb};
}
test('fidelity checks visible text, order and count, not hidden copies',t=>{
 const f=fixture(t);
 let r=run('keynote-fidelity.mjs',[f.md,f.html]); assert.equal(r.status,0,r.stderr+r.stdout);
 fs.writeFileSync(f.html,f.envelope(f.aa.replace('<p>','<p style="display:none">')+f.bb));
 r=run('keynote-fidelity.mjs',[f.md,f.html]); assert.equal(r.status,1,r.stderr+r.stdout); assert.match(r.stdout,/Nonrandom/);
 fs.writeFileSync(f.html,f.envelope(f.bb+f.aa));
 r=run('keynote-fidelity.mjs',[f.md,f.html]); assert.equal(r.status,1); assert.match(r.stdout,/order/i);
 fs.writeFileSync(f.html,f.envelope(f.aa));
 r=run('keynote-fidelity.mjs',[f.md,f.html]); assert.equal(r.status,1); assert.match(r.stdout,/count/i);
});
test('promotion capture and replay retain unchanged design by ID and skip changed content',t=>{
 const f=fixture(t);
 fs.writeFileSync(f.html,f.envelope(f.aa.replace('class="slide"','class="slide custom-layout"')+f.bb));
 let r=run('keynote-promotions.mjs',['capture',f.md,f.html,f.saved]); assert.equal(r.status,0,r.stderr+r.stdout);
 fs.writeFileSync(f.md,f.source([f.b,f.a]));
 fs.writeFileSync(f.html,f.envelope(f.bb.replace('>2<','>1<')+f.aa.replace('>1<','>2<')));
 r=run('keynote-promotions.mjs',['apply',f.md,f.html,f.saved]); assert.equal(r.status,0,r.stderr+r.stdout);
 let html=fs.readFileSync(f.html,'utf8'); assert.match(html,/custom-layout/); assert.ok(html.indexOf('data-slide-id="next"')<html.indexOf('data-slide-id="result"')); assert.match(html,/Private preparation/);
 assert.match(html,/class="pageno">0?2<\/div>/);
 fs.writeFileSync(f.md,f.source([f.b,f.a.replace('Nonrandom sample; not a population estimate.','A new qualified finding.')]));
 fs.writeFileSync(f.html,f.envelope(f.bb+f.aa.replace('Nonrandom sample; not a population estimate.','A new qualified finding.')));
 r=run('keynote-promotions.mjs',['apply',f.md,f.html,f.saved]); assert.equal(r.status,0,r.stderr+r.stdout); assert.match(r.stdout,/REVIEW.*result/);
 html=fs.readFileSync(f.html,'utf8'); assert.doesNotMatch(html,/custom-layout/); assert.match(html,/A new qualified finding/);
});
test('promotion replay does not replace a newly rendered style with an old one',t=>{
 const f=fixture(t); let r=run('keynote-promotions.mjs',['capture',f.md,f.html,f.saved]); assert.equal(r.status,0,r.stderr+r.stdout);
 fs.writeFileSync(f.html,fs.readFileSync(f.html,'utf8').replace('width:1000px','width:1100px'));
 r=run('keynote-promotions.mjs',['apply',f.md,f.html,f.saved]); assert.equal(r.status,1); assert.match(r.stderr,/style/i);
});
test('a comparison can separate its year and label without losing fidelity',t=>{
 const f=fixture(t);
 fs.writeFileSync(f.md,'# Timeline\n\n---\n\n## Evidence over time\n> Slide ID: timeline\n- 2020 · Pilot begins\n- 2021 · Follow-up remains preliminary\n');
 fs.writeFileSync(f.html,f.envelope('<div class="slide-wrap" data-slide-id="timeline"><h2>Evidence over time</h2><div>2020</div><div>Pilot begins</div><div>2021</div><div>Follow-up remains preliminary</div></div>'));
 const r=run('keynote-fidelity.mjs',[f.md,f.html]); assert.equal(r.status,0,r.stderr+r.stdout);
});
test('replacing a local asset invalidates its saved slide even at the same filename',t=>{
 const f=fixture(t); const asset=path.join(f.dir,'evidence.svg');
 fs.writeFileSync(asset,'<svg xmlns="http://www.w3.org/2000/svg"><text>old</text></svg>');
 fs.writeFileSync(f.md,f.source([f.a+'\n> Image: evidence.svg',f.b]));
 fs.writeFileSync(f.html,f.envelope(f.aa.replace('class="slide"','class="slide old-image"')+f.bb));
 let r=run('keynote-promotions.mjs',['capture',f.md,f.html,f.saved]); assert.equal(r.status,0,r.stderr+r.stdout);
 fs.writeFileSync(asset,'<svg xmlns="http://www.w3.org/2000/svg"><text>new</text></svg>');
 fs.writeFileSync(f.html,f.envelope(f.aa.replace('class="slide"','class="slide new-image"')+f.bb));
 r=run('keynote-promotions.mjs',['apply',f.md,f.html,f.saved]);assert.equal(r.status,0,r.stderr+r.stdout);
 assert.match(r.stdout,/REVIEW.*result/);assert.match(fs.readFileSync(f.html,'utf8'),/new-image/);assert.doesNotMatch(fs.readFileSync(f.html,'utf8'),/old-image/);
});
test('changing deck branding invalidates saved layouts',t=>{
 const f=fixture(t);
 const branded=label=>f.envelope((f.aa+f.bb).replaceAll('<div class="pageno">',`<div class="footer"><span class="brand">${label}</span></div><div class="pageno">`));
 fs.writeFileSync(f.html,branded('Old client'));
 let r=run('keynote-promotions.mjs',['capture',f.md,f.html,f.saved]);assert.equal(r.status,0,r.stderr+r.stdout);
 fs.writeFileSync(f.html,branded('New client'));
 r=run('keynote-promotions.mjs',['apply',f.md,f.html,f.saved]);assert.equal(r.status,1);assert.match(r.stderr,/style|branding/i);
 assert.match(fs.readFileSync(f.html,'utf8'),/New client/);assert.doesNotMatch(fs.readFileSync(f.html,'utf8'),/Old client/);
});
