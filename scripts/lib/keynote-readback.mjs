// keynote-readback.mjs — read a built .key back out of Keynote, for the
// round-trip test (Keynote export, plan Task 7). Test helper only.
//
// The AppleScript opens the .key (a native file: no import dialog), reads every
// slide's text items with the font, size and colour of EVERY character, the
// presenter notes, table cell values and chart count, then closes its own
// document without saving. Output uses ASCII separators (RS between records,
// US between fields, GS between list items) so text with quotes, line breaks
// or emoji survives.

import { posixFile } from './keynote-applescript.mjs';

const RS = '\x1e';
const US = '\x1f';
const GS = '\x1d';

// readbackScript(keyPath) → AppleScript source
export function readbackScript(keyPath) {
  return `on joinList(L, sep)
  set AppleScript's text item delimiters to sep
  set s to L as text
  set AppleScript's text item delimiters to ""
  return s
end joinList

on cellText(v)
  if v is missing value then return ""
  try
    return v as text
  on error
    return ""
  end try
end cellText

set RS to character id 30
set US to character id 31
set GS to character id 29
set out to {}
tell application "Keynote"
  set d to open (${posixFile(keyPath)})
  try
    set end of out to "N" & US & ((count of slides of d) as text)
    repeat with s in slides of d
      set end of out to "S"
      repeat with t in text items of s
        set fs to font of every character of object text of t
        set zs to size of every character of object text of t
        set cs to color of every character of object text of t
        set cl to {}
        repeat with c in cs
          set end of cl to ((item 1 of c) as text) & "," & ((item 2 of c) as text) & "," & ((item 3 of c) as text)
        end repeat
        set zl to {}
        repeat with z in zs
          set end of zl to (z as text)
        end repeat
        set end of out to "T" & US & ((object text of t) as text) & US & my joinList(fs, GS) & US & my joinList(zl, GS) & US & my joinList(cl, GS) & US & ((height of t) as text)
      end repeat
      repeat with tb in tables of s
        set vl to {}
        repeat with c in cells of tb
          set end of vl to my cellText(value of c)
        end repeat
        set end of out to "B" & US & ((count of rows of tb) as text) & US & ((count of columns of tb) as text) & US & my joinList(vl, GS)
      end repeat
      set end of out to "C" & US & ((count of charts of s) as text)
      set end of out to "P" & US & ((presenter notes of s) as text)
    end repeat
    close d saving no
  on error errMsg number errNum
    try
      close d saving no
    end try
    error errMsg number errNum
  end try
end tell
return my joinList(out, RS)
`;
}

const num = (s) => Number(String(s).replace(',', '.'));
const list = (s) => (s === '' ? [] : s.split(GS));

// parseReadback(stdout) → { count, slides: [{ texts, notes, tables, charts }] }
//   texts: [{ text, h, chars: [{ font, size, color: [r,g,b] 8-bit }] }]  (h = item height, pt)
//   tables: [{ rows, cols, cells: string[] row-major }]
export function parseReadback(stdout) {
  const out = { count: 0, slides: [] };
  let cur = null;
  for (const rec of stdout.split(RS)) {
    const f = rec.split(US);
    switch (f[0]) {
      case 'N': out.count = Number(f[1]); break;
      case 'S': cur = { texts: [], notes: '', tables: [], charts: 0 }; out.slides.push(cur); break;
      case 'T': {
        const fonts = list(f[2]);
        const sizes = list(f[3]).map(num);
        const colours = list(f[4]).map((c) => c.split(',').map((v) => Math.round(Number(v) / 257)));
        cur.texts.push({ text: f[1].replace(/\r\n?/g, '\n'), h: num(f[5]),
          chars: fonts.map((font, i) => ({ font, size: sizes[i], color: colours[i] })) });
        break;
      }
      case 'B': cur.tables.push({ rows: Number(f[1]), cols: Number(f[2]), cells: list(f[3]) }); break;
      case 'C': cur.charts = Number(f[1]); break;
      case 'P': cur.notes = (f[1] ?? '').replace(/\r\n?/g, '\n'); break;
      default: if (rec.trim()) throw new Error(`readback: unexpected record ${JSON.stringify(rec.slice(0, 40))}`);
    }
  }
  return out;
}
