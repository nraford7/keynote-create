export function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: text };
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*"?(.*?)"?\s*$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: m[2] };
}


export function parseSlide(chunk) {
  const lines = chunk.split('\n');
  let title = '';
  let id = '';
  const bullets = [];
  let speakerNote = '';
  let image = '';    // keynote: full-bleed image src
  let art = '';      // keynote: art-direction note (presenter-only)
  let layout = '';   // keynote: explicit layout hint
  let i = 0;
  // pull title (## ...)
  while (i < lines.length && !lines[i].trim()) i++;
  if (lines[i] && lines[i].startsWith('## ')) {
    title = lines[i].replace(/^##\s+/, '').trim();
    i++;
  } else if (lines[i] && lines[i].startsWith('# ')) {
    title = lines[i].replace(/^#\s+/, '').trim();
    i++;
  }
  for (; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;
    // Narrative Engine's labeled fields; metadata sidecars are never renderer inputs.
    const field = l.match(/^\*\*(Headline|Spotlight(?:\s*\([^)]*\))?|Design note|Narration|Speaker note):\*\*\s*(.*)$/i);
    if (field) {
      const key = field[1].toLowerCase(), value = field[2].trim();
      if (key === 'headline') title = value;
      else if (key.startsWith('spotlight')) { if (value) bullets.push(value); }
      else if (key === 'design note') art = value;
      else speakerNote = [speakerNote, value].filter(Boolean).join(' ');
      continue;
    }
    if (/^>\s*Slide ID:/i.test(l)) {
      id = l.replace(/^>\s*Slide ID:\s*/i, '').trim();
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(id)) throw Error(`Invalid slide ID: ${id}`);
      continue;
    }
    // keynote directives — matched before the generic "> " catch-all
    const imgMd = l.match(/^!\[[^\]]*\]\(([^)]+)\)/);
    if (imgMd) { image = imgMd[1].trim(); continue; }
    if (/^>\s*Image:/i.test(l))  { image  = l.replace(/^>\s*Image:\s*/i, '').trim(); continue; }
    if (/^>\s*Art:/i.test(l))    { art    = l.replace(/^>\s*Art:\s*/i, '').trim(); continue; }
    if (/^>\s*Layout:/i.test(l)) { layout = l.replace(/^>\s*Layout:\s*/i, '').trim().toLowerCase(); continue; }
    if (l.startsWith('- ') || l.startsWith('* ')) {
      bullets.push(l.replace(/^[-*]\s+/, ''));
    } else if (l.startsWith('> Speaker note:') || l.startsWith('> Speaker Note:')) {
      speakerNote = l.replace(/^>\s*Speaker [Nn]ote:\s*/, '');
    } else if (l.startsWith('> ')) {
      // Quotations and citations are audience-facing. Only explicit notes are hidden.
      bullets.push(l.replace(/^>\s*/, ''));
    } else {
      // Preserve ordinary supporting prose instead of silently dropping it.
      bullets.push(l);
    }
  }
  title = title.replace(/^Slide\s+\d+\s*[—–:]\s*/i, '');
  return { id, title, bullets, speakerNote, image, art, layout };
}


export function parseDeck(text) {
  const { meta, body } = parseFrontmatter(text.replace(/\r\n/g, '\n'));
  const slides = body.split(/\n---+\n/g).map(s => s.trim()).filter(Boolean)
    .filter(chunk => !/^# /.test(chunk) && !/^##\s+title\s+sequence/i.test(chunk))
    .map(parseSlide).filter(s => s.title || s.bullets.length || s.image || s.art || s.layout);
  const used = new Set();
  for (const slide of slides) {
    if (slide.id && used.has(slide.id)) throw Error(`Duplicate slide ID: ${slide.id}`);
    if (slide.id) used.add(slide.id);
  }
  return { meta, body, slides };
}
