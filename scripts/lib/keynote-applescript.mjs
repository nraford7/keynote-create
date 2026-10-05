// keynote-applescript.mjs — slide model → one AppleScript program that builds
// a native, editable Keynote document (Keynote export, plan Task 2).
//
// Pure string generation; nothing here talks to Keynote. Rules that come from
// Keynote's scripting dictionary and from probes on 2026-10-05:
// - Hold the reference returned by `make new document`. Never `front document`
//   or a document addressed by name: other open documents must stay untouched.
// - Constants are unquoted (`vertical_bar_2d`, `chart column`).
// - Style a text item BEFORE its geometry. Changing font size after setting the
//   position moves the box (probe: y 200 → 168 at 100 pt).
// - Per-run styling uses `characters a thru b of object text` (1-based,
//   inclusive). Keynote counts Unicode code points (probe 2026-10-05: an
//   emoji is 1, a flag is 2, e + combining accent is 2), not UTF-16 units.
// - Keynote inserts a large image asynchronously: right after `make new image`
//   the reference can still be "Invalid index" (-1719; seen on a 3840×2160
//   plate, 2026-10-05). Wait until the image answers before styling it.
// - On any error: close our own document without saving and re-raise with the
//   slide and object that failed, so the CLI can name it.

const CHART_TYPE = {
  bar: 'vertical_bar_2d',
  horizontal_bar: 'horizontal_bar_2d',
  stacked_bar: 'stacked_vertical_bar_2d',
  line: 'line_2d',
  area: 'area_2d',
  pie: 'pie_2d',
};

const ALIGN = { left: 'left', center: 'center', right: 'right', justify: 'justify' };

// asString(s) → AppleScript string expression. Line breaks become
// `" & linefeed & "` joins; quotes and backslashes are escaped.
export function asString(s) {
  const parts = String(s).replace(/\r\n?/g, '\n').split('\n')
    .map((p) => '"' + p.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"');
  return parts.join(' & linefeed & ');
}

// colour16([r,g,b]) → "{R, G, B}" on Keynote's 16-bit scale (v × 257).
// Anything but three finite numbers throws.
export function colour16(rgb, what = 'colour') {
  if (!Array.isArray(rgb) || rgb.length !== 3) throw new Error(`invalid ${what}: ${JSON.stringify(rgb)}`);
  return '{' + rgb.map((v) => Math.round(Math.max(0, Math.min(255, Number(num(v, what))))) * 257).join(', ') + '}';
}

// posixFile(p) → `POSIX file "…"`. Only a string literal works here: inside a
// `tell application "Keynote"` block a computed string (one joined with
// `& linefeed &`) is sent to Keynote, which fails with -1728 (probe
// 2026-10-05). So a path with a line break is refused up front.
export function posixFile(p) {
  if (/[\r\n]/.test(String(p))) throw new Error(`path contains a line break: ${JSON.stringify(String(p))}`);
  return `POSIX file ${asString(p)}`;
}

// runRanges(runs) → [{start, end}] 1-based inclusive, in code points.
export function runRanges(runs) {
  const out = [];
  let pos = 1;
  for (const r of runs) {
    const len = [...String(r.text)].length; // code points, as Keynote counts
    out.push({ start: pos, end: pos + len - 1 });
    pos += len;
  }
  return out;
}

// num(v, what) → AppleScript number literal; anything not finite throws, so a
// bad model value can never reach the script as NaN or undefined.
function finite(v, what) {
  const n = Number(v);
  if (v === null || typeof v === 'boolean' || typeof v === 'object' || (typeof v === 'string' && !v.trim()) || !Number.isFinite(n)) {
    throw new Error(`invalid ${what}: ${JSON.stringify(v)}`);
  }
  return n;
}

function num(v, what = 'number') {
  return String(Math.round(finite(v, what) * 100) / 100);
}

// exact(v) → full-precision AppleScript number literal (chart data must not be
// rounded: 0.004 stays 0.004). Plain decimal, never exponent notation.
function exact(v, what) {
  const n = finite(v, what);
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return Math.abs(n) < 1 ? n.toFixed(20).replace(/0+$/, '').replace(/\.$/, '') : BigInt(Math.round(n)).toString();
}

function int(v, what) {
  const n = Number(v ?? 0);
  if (!Number.isInteger(n) || n < 0) throw new Error(`invalid ${what}: ${v}`);
  return n;
}

const has = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);
const lf = (t) => String(t).replace(/\r\n?/g, '\n');
const list = (items) => '{' + items.join(', ') + '}';

function dominantRun(runs) {
  const cp = (r) => [...String(r.text)].length;
  return runs.reduce((best, r) => (cp(r) > cp(best) ? r : best), runs[0]);
}

function sameStyle(a, b) {
  return a.ps === b.ps && Math.round(a.size) === Math.round(b.size)
    && a.color.every((v, i) => Math.round(v) === Math.round(b.color[i]));
}

function emitImage(lines, where, img) {
  lines.push(`set kxWhere to ${asString(where)}`);
  lines.push('tell s');
  lines.push(`  set kxObj to make new image with properties {file:${posixFile(img.path)}}`);
  lines.push('end tell');
  lines.push('repeat 50 times');
  lines.push('  try');
  lines.push('    get width of kxObj');
  lines.push('    exit repeat');
  lines.push('  on error');
  lines.push('    delay 0.1');
  lines.push('  end try');
  lines.push('end repeat');
  lines.push(`set width of kxObj to ${num(img.w, `width (${where})`)}`);
  lines.push(`set height of kxObj to ${num(img.h, `height (${where})`)}`);
  lines.push(`set position of kxObj to {${num(img.x, `x (${where})`)}, ${num(img.y, `y (${where})`)}}`);
}

function emitTable(lines, where, tb) {
  const R = tb.rows.length;
  const C = Math.max(0, ...tb.rows.map((r) => r.length));
  if (!R || !C) return;
  // Keynote refuses tables under 2 rows or 2 columns (-2700, probe 2026-10-05).
  // A spare row is deleted after creation; a spare column can't be (deleting
  // or resizing it is ignored), so a one-column table keeps an empty column.
  const RK = Math.max(R, 2);
  const CK = Math.max(C, 2);
  lines.push(`set kxWhere to ${asString(where)}`);
  lines.push('tell s');
  lines.push(`  set kxObj to make new table with properties {row count:${RK}, column count:${CK}, header row count:${Math.min(int(tb.headerRows, `header rows (${where})`), R)}, header column count:0, footer row count:0}`);
  lines.push('end tell');
  lines.push(`set width of kxObj to ${num(tb.w, `width (${where})`)}`);
  lines.push(`set height of kxObj to ${num(tb.h, `height (${where})`)}`);
  lines.push(`set position of kxObj to {${num(tb.x, `x (${where})`)}, ${num(tb.y, `y (${where})`)}}`);
  lines.push('tell kxObj');
  if (RK > R) lines.push(`  delete row ${RK}`);
  // the HTML's column widths and row heights (settable, probe 2026-10-05);
  // Keynote still grows a row whose text needs more room
  if (Array.isArray(tb.colWidths) && tb.colWidths.length === C && C >= 2) {
    tb.colWidths.forEach((w, c) => lines.push(`  set width of column ${c + 1} to ${num(w, `column width (${where})`)}`));
  }
  if (Array.isArray(tb.rowHeights) && tb.rowHeights.length === R) {
    tb.rowHeights.forEach((h, r) => lines.push(`  set height of row ${r + 1} to ${num(h, `row height (${where})`)}`));
  }
  tb.rows.forEach((row, r) => row.forEach((val, c) => {
    const cell = `cell ${c + 1} of row ${r + 1}`;
    // text format first: otherwise Keynote reads "+3" as the number 3
    lines.push(`  set format of ${cell} to text`);
    lines.push(`  set value of ${cell} to ${asString(val ?? '')}`);
    const st = tb.styles?.[r]?.[c];
    if (!st) return;
    if (st.ps) lines.push(`  set font name of ${cell} to ${asString(st.ps)}`);
    if (st.size) lines.push(`  set font size of ${cell} to ${num(st.size, `font size (${where})`)}`);
    if (st.color) lines.push(`  set text color of ${cell} to ${colour16(st.color, `text colour (${where})`)}`);
    if (st.bg) lines.push(`  set background color of ${cell} to ${colour16(st.bg, `background (${where})`)}`);
    if (has(ALIGN, st.align)) lines.push(`  set alignment of ${cell} to ${ALIGN[st.align]}`);
  }));
  lines.push('end tell');
}

function emitChart(lines, where, ch) {
  const type = has(CHART_TYPE, ch.type) ? CHART_TYPE[ch.type] : null;
  if (!type) throw new Error(`unsupported chart type "${ch.type}" (${where})`);
  const ok = Array.isArray(ch.rows) && Array.isArray(ch.columns) && Array.isArray(ch.data) && ch.rows.length && ch.columns.length
    && ch.data.length === ch.rows.length && ch.data.every((r) => Array.isArray(r) && r.length === ch.columns.length);
  if (!ok) throw new Error(`chart data shape does not match its rows and columns (${where})`);
  const rows = list(ch.rows.map(asString));
  const cols = list(ch.columns.map(asString));
  const data = list(ch.data.map((r) => list(r.map((v) => exact(v, `chart value (${where})`)))));
  lines.push(`set kxWhere to ${asString(where)}`);
  lines.push('tell s');
  lines.push(`  add chart row names ${rows} column names ${cols} data ${data} type ${type} group by chart column`);
  lines.push('end tell');
  lines.push('set kxObj to last chart of s');
  lines.push(`set width of kxObj to ${num(ch.w, `width (${where})`)}`);
  lines.push(`set height of kxObj to ${num(ch.h, `height (${where})`)}`);
  lines.push(`set position of kxObj to {${num(ch.x, `x (${where})`)}, ${num(ch.y, `y (${where})`)}}`);
}

function emitText(lines, where, tx) {
  // one line-break convention for the text AND the ranges: asString turns
  // \r\n into one linefeed, so the ranges must count it as one character
  const runs = tx.runs.map((r) => ({ ...r, text: lf(r.text) })).filter((r) => r.text.length > 0);
  if (!runs.length) return;
  const text = runs.map((r) => r.text).join('');
  const dom = dominantRun(runs);
  lines.push(`set kxWhere to ${asString(where)}`);
  lines.push('tell s');
  lines.push(`  set kxObj to make new text item with properties {object text:${asString(text)}}`);
  lines.push('end tell');
  // style first (whole item from the dominant run), then per-run overrides
  lines.push(`set font of object text of kxObj to ${asString(dom.ps)}`);
  lines.push(`set size of object text of kxObj to ${num(dom.size, `font size (${where})`)}`);
  lines.push(`set color of object text of kxObj to ${colour16(dom.color, `colour (${where})`)}`);
  const ranges = runRanges(runs);
  runs.forEach((r, i) => {
    if (r === dom || sameStyle(r, dom)) return;
    const chars = `characters ${ranges[i].start} thru ${ranges[i].end} of object text of kxObj`;
    if (r.ps !== dom.ps) lines.push(`set font of ${chars} to ${asString(r.ps)}`);
    if (Math.round(r.size) !== Math.round(dom.size)) lines.push(`set size of ${chars} to ${num(r.size, `font size (${where})`)}`);
    lines.push(`set color of ${chars} to ${colour16(r.color, `colour (${where})`)}`);
  });
  // geometry last; height is left to Keynote (text boxes grow to fit)
  lines.push(`set width of kxObj to ${num(tx.w, `width (${where})`)}`);
  lines.push(`set position of kxObj to {${num(tx.x, `x (${where})`)}, ${num(tx.y, `y (${where})`)}}`);
}

// buildAppleScript(deck, { savePath, keepOpen, timeoutS }) → AppleScript source.
// Everything runs inside `with timeout of timeoutS seconds`, so a slow save
// fails inside AppleScript (and closes our document) instead of being killed.
// Prints "OK" on success; on failure raises "kx-failed at <where>: <msg>".
export function buildAppleScript(deck, { savePath, keepOpen = false, timeoutS = 1200 }) {
  if (!savePath) throw new Error('buildAppleScript: savePath required');
  const W = num(deck.width ?? 1920, 'deck width');
  const H = num(deck.height ?? 1080, 'deck height');
  const L = [];
  L.push('set kxWhere to "document"');
  L.push('tell application "Keynote"');
  L.push(`with timeout of ${int(timeoutS, 'timeout')} seconds`);
  L.push(`set d to make new document with properties {document theme:theme "Basic White", width:${W}, height:${H}}`);
  L.push('try');
  deck.slides.forEach((slide, si) => {
    const src = int(slide.index ?? si + 1, `slide index (slide ${si + 1})`);
    // n names the slide in errors as "slide <output> (source <deck slide>)"
    const n = src === si + 1 ? `${si + 1}` : `${si + 1} (source ${src})`;
    L.push(`-- slide ${si + 1} (source slide ${src})`);
    L.push(`set kxWhere to "slide ${n}"`);
    if (si === 0) L.push('set s to slide 1 of d');
    else L.push('set s to make new slide at end of slides of d');
    L.push('set base layout of s to master slide "Blank" of d');
    if (slide.plate?.path) emitImage(L, `slide ${n} plate`, { path: slide.plate.path, x: 0, y: 0, w: W, h: H });
    (slide.media || []).forEach((m, i) => emitImage(L, `slide ${n} media ${i + 1}`, m));
    (slide.tables || []).forEach((t, i) => emitTable(L, `slide ${n} table ${i + 1}`, t));
    (slide.charts || []).forEach((c, i) => emitChart(L, `slide ${n} chart ${i + 1}`, c));
    (slide.texts || []).forEach((t, i) => emitText(L, `slide ${n} text ${i + 1}`, t));
    L.push(`set kxWhere to "slide ${n} notes"`);
    L.push(`set presenter notes of s to ${asString(slide.notes || '')}`);
  });
  L.push('set kxWhere to "save"');
  L.push(`save d in (${posixFile(savePath)})`);
  if (!keepOpen) L.push('close d saving no');
  L.push('on error errMsg number errNum');
  L.push('  try');
  L.push('    close d saving no');
  L.push('  end try');
  L.push('  error "kx-failed at " & kxWhere & ": " & errMsg number errNum');
  L.push('end try');
  L.push('end timeout');
  L.push('end tell');
  L.push('return "OK"');
  return L.join('\n') + '\n';
}
