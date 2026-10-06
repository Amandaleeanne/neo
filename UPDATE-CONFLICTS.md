# Upstream sync conflicts

---

## Upstream sync conflict — 2026-10-06T16:42:06.646Z

- Upstream: `upstream/main` at `accb7960924a080ddfac6f91ffabed25f6c2ad97`
- Common base: `db326f75645c4e51506cf30889cd3bd23fb3dc72`
- No source files were changed by this run.

### Renderer module `vim-keys.js` — conflict 1

- Fork module: [`src/renderer/vim-keys.js` lines 397-399](./src/renderer/vim-keys.js#L397)
- Common base: [`app.js` lines 4591-4591](./app.js#L4591)
- Upstream: [`app.js` lines 4766-6174](./app.js#L4766)

```diff
<<<<<<< fork

'use strict';

||||||| common base

=======
/*  SCREENPLAYS                                                        */
/*  A script is a book whose book.json says "format": "screenplay".    */
/*  It lives on the shelves like any book (right-click a shelf's + for */
/*  New Script) and is set as it prints: Courier Prime on letter       */
/*  paper. The whole script is one chapter, one typing area, so a      */
/*  selection and the arrow keys run straight through the scenes; the  */
/*  scenes are found by their headings. Each line is a paragraph of    */
/*  one of seven elements, its class sp-<element> (action has none).   */
/*  Nobody has to pick an element: INT. or EXT. makes a scene heading, */
/*  a short line in capitals followed by Enter makes a character, and  */
/*  Enter on an empty line changes what that line is (the rules of     */
/*  Fountain, the plain-text screenplay format). Page breaks, page     */
/*  numbers, (CONT'D) and the gray suggestions are drawn from data-*   */
/*  marks that captureBody strips: nothing on screen is saved.         */
/* ================================================================== */

// ---- screenplay rules: plain functions of the lines, no page (see scripts/screenplay.test.js) ----
const SP_TYPES = ['heading', 'action', 'character', 'paren', 'dialogue', 'transition', 'shot'];
// blank lines above each element (two above a scene heading, so each scene
// stands apart; it costs a few pages, as it does in Final Draft)
const SP_BEFORE = { heading: 2, action: 1, character: 1, paren: 0, dialogue: 0, transition: 1, shot: 2 };
// Enter at the end of a line with words: what the next line is
const SP_AFTER = { heading: 'action', action: 'action', character: 'dialogue', paren: 'dialogue', dialogue: 'action', transition: 'heading', shot: 'action' };
// Enter on an empty line: what that line becomes. Enter twice after a
// speech brings in the next speaker
const SP_EMPTY = { action: 'character', character: 'action', dialogue: 'action', paren: 'dialogue', heading: 'action', transition: 'action', shot: 'action' };
// Tab steps through these (in a speech, Tab trades dialogue and parenthetical)
const SP_CYCLE = ['action', 'character', 'transition', 'heading', 'shot'];
const SP_LINES_PER_PAGE = 54;
const SP_HEAD_RE = /^(?:INT\.?\/EXT|INT\/EXT|I\/E|INT|EXT|EST)(?:\.|\s)/i;
const SP_HEAD_PARSE = /^(INT\.?\/EXT\.?|INT\/EXT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)\s+(.*)$/i;
const SP_TIMES = ['DAY', 'NIGHT', 'CONTINUOUS', 'LATER', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'MOMENTS LATER', 'SAME TIME'];
const SP_TRANSITIONS = ['CUT TO:', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'FADE OUT.', 'FADE TO BLACK.', 'INTERCUT WITH:'];
const SP_EXTENSIONS = ['V.O.)', 'O.S.)', 'O.C.)', "CONT'D)"];

// a speaker's name without (V.O.) and the like
function spBareName(t) {
  return String(t || '').replace(/\s*\^\s*$/, '').replace(/\s*\([^)]*\)?\s*$/, '').trim().toUpperCase();
}
// Fountain's transition: capitals ending in TO:, or a fade out (the usual
// ones also as typed, "Cut to:", since NEO capitalizes a line's first word)
function spLooksLikeTransition(t) {
  const s = String(t || '').trim();
  if (SP_TRANSITIONS.includes(s.toUpperCase())) return true;
  return !!s && s === s.toUpperCase() && /\p{Lu}/u.test(s) && (/TO:$/.test(s) || s === 'FADE OUT.' || s === 'FADE TO BLACK.');
}
// Fountain's character: a short line all in capitals (an extension in
// parentheses may follow), not a sentence
function spLooksLikeCharacter(t) {
  const s = String(t || '').trim();
  if (!s || s.length > 38 || s !== s.toUpperCase() || !/\p{Lu}/u.test(s)) return false;
  const name = s.replace(/\s*\^\s*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!name || !/\p{Lu}/u.test(name)) return false;
  if (/[.!?,;:—–-]$/.test(name) && !/^(MR|MRS|MS|DR|ST|JR|SR)\.$/.test(name.split(/\s+/).pop())) return false;
  return name.split(/\s+/).length <= 4;
}
function spParseHeading(t) {
  const m = String(t || '').match(SP_HEAD_PARSE);
  if (!m) return null;
  const rest = m[2];
  const d = rest.search(/\s+[-–—]\s*/);
  if (d < 0) return { prefix: m[1], loc: rest, time: null };
  return { prefix: m[1], loc: rest.slice(0, d).trim(), time: rest.slice(d).replace(/^\s+[-–—]\s*/, '') };
}
// the rest of the first word in the pool that starts with what's typed
function spComplete(partial, pool) {
  if (!partial) return '';
  const p = partial.toUpperCase();
  // a name or place already used just as typed is what's meant (KIM, not KIMBERLY)
  if (pool.includes(p)) return '';
  for (const w of pool) if (w.startsWith(p) && w.length > p.length) return w.slice(p.length);
  return '';
}
// who speaks most, then most lately
function spNames(lines, skip) {
  const seen = new Map();
  lines.forEach((l, i) => {
    if (l.type !== 'character' || i === skip) return;
    const n = spBareName(l.text);
    if (!n) return;
    const e = seen.get(n) || { name: n, count: 0, last: 0 };
    e.count++; e.last = i;
    seen.set(n, e);
  });
  return [...seen.values()].sort((a, b) => b.count - a.count || b.last - a.last).map((e) => e.name);
}
function spLocations(lines, skip) {
  const out = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].type !== 'heading' || i === skip) continue;
    const h = spParseHeading(lines[i].text);
    const loc = h && h.loc.trim().toUpperCase();
    if (loc && !out.includes(loc)) out.push(loc);
  }
  return out;
}
function spTimesUsed(lines, skip) {
  const out = [];
  lines.forEach((l, i) => {
    if (l.type !== 'heading' || i === skip) return;
    const h = spParseHeading(l.text);
    const time = h && h.time && h.time.trim().toUpperCase();
    if (time && !out.includes(time)) out.push(time);
  });
  return out;
}
// the one being answered: the speaker before the last one, in this scene
function spPartner(lines, i) {
  const order = [];
  for (let j = i - 1; j >= 0; j--) {
    const l = lines[j];
    if (l.type === 'heading') break;
    if (l.type !== 'character') continue;
    const n = spBareName(l.text);
    if (n && !order.includes(n)) order.push(n);
    if (order.length === 2) break;
  }
  return order.length === 2 ? order[1] : '';
}
// The gray suggestion for line i, the caret at its end: only names and
// places this script already has (and the usual times and transitions)
function spGhost(lines, i) {
  const l = lines[i];
  const text = l.text;
  if (l.type === 'character') {
    const open = text.lastIndexOf('(');
    if (open >= 0 && text.indexOf(')', open) < 0) return spComplete(text.slice(open + 1), SP_EXTENSIONS);
    if (!text.trim()) return spPartner(lines, i);
    return spComplete(text.trimStart(), spNames(lines, i));
  }
  if (l.type === 'heading') {
    const h = spParseHeading(text);
    if (!h) return '';
    if (h.time === null) return /\s$/.test(text) ? '' : spComplete(h.loc, spLocations(lines, i));
    return spComplete(h.time, [...spTimesUsed(lines, i), ...SP_TIMES]);
  }
  if (l.type === 'transition') {
    const used = lines.filter((x, j) => x.type === 'transition' && j !== i && x.text.trim()).map((x) => x.text.trim().toUpperCase());
    return spComplete(text.trimStart(), [...used, ...SP_TRANSITIONS]);
  }
  return '';
}
// (CONT'D): the same voice again, after action, in the same scene
function spContd(lines, i) {
  const me = spBareName(lines[i].text);
  if (!me || /\(/.test(lines[i].text)) return false;
  let between = false;
  for (let j = i - 1; j >= 0; j--) {
    const l = lines[j];
    if (l.type === 'heading' || l.type === 'transition') return false;
    if (l.type === 'character') return between && spBareName(l.text) === me;
    if ((l.type === 'action' || l.type === 'shot') && l.text.trim()) between = true;
  }
  return false;
}
// The pages, as they print: 54 lines, a speech kept with its speaker, a
// scene heading never alone at the foot of a page. items: [{ type, lines }]
// (lines = how many lines the element takes). For each item: the page it's
// on, the blank lines above it, and, where a page starts, how many lines
// were left blank at the foot of the page before (fill).
function spPaginate(items, perPage = SP_LINES_PER_PAGE) {
  const n = items.length;
  const blocks = [];
  for (let i = 0; i < n;) {
    let j = i + 1;
    if (items[i].type === 'character') while (j < n && (items[j].type === 'dialogue' || items[j].type === 'paren')) j++;
    blocks.push([i, j]);
    i = j;
  }
  const at = items.map(() => ({ page: 1, before: 0, brk: false, fill: 0 }));
  let page = 1;
  let used = 0;
  const above = (x, top) => (top || x === 0 ? 0 : SP_BEFORE[items[x].type] || 0);
  const height = (b, top) => {
    let h = 0;
    for (let x = b[0]; x < b[1]; x++) h += items[x].lines + above(x, top && x === b[0]);
    return h;
  };
  blocks.forEach((b, bi) => {
    let need = height(b, used === 0);
    const next = blocks[bi + 1];
    if (items[b[0]].type === 'heading' && next) need += items[next[0]].lines + above(next[0], false);
    if (used > 0 && used + need > perPage) {
      at[b[0]].brk = true;
      at[b[0]].fill = Math.max(0, perPage - used);
      page++;
      used = 0;
    }
    for (let x = b[0]; x < b[1]; x++) {
      at[x].before = above(x, used === 0 && x === b[0]);
      at[x].page = page;
      used += at[x].before + items[x].lines;
      // longer than a page: it runs on over the next one
      while (used > perPage) { used -= perPage; page++; }
    }
  });
  return { at, pages: page, used };
}
// a length in eighths of a page, the way a production counts it
function spEighths(lines, perPage = SP_LINES_PER_PAGE) {
  return Math.max(1, Math.round(lines / perPage * 8));
}
// Fountain text from the script's lines ([{type, text}], text already in
// Fountain's emphasis). A line that Fountain would read as something else
// is forced: ! for action, . for a heading, > for a transition, @ for a name.
function spToFountain(lines, title = {}) {
  const out = [];
  const keys = [['Title', title.title], ['Credit', title.credit], ['Author', title.author], ['Draft date', title.draft], ['Contact', title.contact]];
  for (const [k, v] of keys) {
    const s = String(v || '').trim();
    if (!s) continue;
    const rows = s.split(/\n/).map((r) => r.trim()).filter(Boolean);
    if (rows.length === 1) out.push(`${k}: ${rows[0]}`);
    else out.push(`${k}:`, ...rows.map((r) => '    ' + r));
  }
  if (out.length) out.push('');
  let inSpeech = false;
  const gap = () => { if (out.length && out[out.length - 1] !== '') out.push(''); };
  for (const l of lines) {
    const text = String(l.text || '').trim();
    if (!text) { inSpeech = false; continue; }
    const caps = text.toUpperCase();
    if ((l.type === 'dialogue' || l.type === 'paren') && inSpeech) {
      out.push(l.type === 'paren' && !/^\(/.test(text) ? `(${text})` : text);
      continue;
    }
    inSpeech = false;
    gap();
    if (l.type === 'heading') out.push(SP_HEAD_RE.test(caps) ? caps : '.' + caps);
    else if (l.type === 'character') {
      out.push(/\p{Ll}/u.test(caps) ? '@' + text : caps);
      inSpeech = true;
    } else if (l.type === 'transition') out.push(/TO:$/.test(caps) ? caps : '>' + caps);
    else if (l.type === 'shot') out.push('!' + caps);
    else {
      // action (or a speech with no speaker): forced when it would read as
      // a heading, a name, a transition or a Fountain mark
      const misread = SP_HEAD_RE.test(text) || (text === caps && /\p{Lu}/u.test(text)) || /^[.!@~>#=[]/.test(text);
      out.push(misread ? '!' + text : text);
    }
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}
// Fountain (or a plain-text script) into lines: [{type, text}], the text
// keeping Fountain's *emphasis* for the caller to set. The title page is
// left out; notes, boneyard, sections, synopses and page breaks too.
// A speaker's (CONT'D) is NEO's to draw: one typed in, or carried in from
// Final Draft or a PDF, comes off the name
const spDropContd = (t) => String(t || '').replace(/\s*\(\s*cont(?:['’]?d|inued)\s*\)\s*$/i, '').trim();
// lines a PDF's text carries that aren't the script: page numbers, (MORE),
// CONTINUED
const SP_PDF_NOISE = /^(?:\d{1,3}[A-Z]?\.|\(MORE\)|\(?CONTINUED\)?:?|CONTINUED:)$/i;
function spFromFountain(src) {
  let text = String(src || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
  let rows = text.split('\n');
  if (SP_TITLE_KEY.test(rows[0] || '')) {
    let k = 0;
    while (k < rows.length && rows[k].trim() !== '') k++;
    rows = rows.slice(k);
  }
  const blank = (k) => k < 0 || k >= rows.length || rows[k].trim() === '';
  const out = [];
  let inSpeech = false;
  // a block's lines run on into one paragraph: Fountain keeps a writer's
  // line breaks, and a script copied from a PDF is broken at every line
  let joinable = false;
  const push = (type, t, join = false) => {
    const last = out[out.length - 1];
    if (join && joinable && last && last.type === type) last.text += ' ' + t;
    else out.push({ type, text: t });
    joinable = join;
  };
  for (let k = 0; k < rows.length; k++) {
    const s = rows[k].trim();
    if (!s) { inSpeech = false; joinable = false; continue; }
    if (/^={3,}$/.test(s) || /^#/.test(s) || /^=[^=]/.test(s) || s === '=' || SP_PDF_NOISE.test(s)) continue;
    if (inSpeech) {
      if (/^\(.*\)$/.test(s)) push('paren', s);
      else push('dialogue', s.replace(/^~\s*/, ''), true);
      continue;
    }
    if (s.startsWith('!')) { push('action', s.slice(1).trim(), true); continue; }
    if (/^\.[^.\s]/.test(s)) { push('heading', s.slice(1).trim().replace(/\s*#[^#\s]+#$/, '')); continue; }
    if (s.startsWith('>') && s.endsWith('<')) { push('action', s.slice(1, -1).trim()); continue; }
    if (s.startsWith('>')) { push('transition', s.slice(1).trim()); continue; }
    if (s.startsWith('~')) { push('action', s.slice(1).trim()); continue; }
    if (s.startsWith('@')) { push('character', spDropContd(s.slice(1).trim().replace(/\s*\^$/, ''))); inSpeech = true; continue; }
    if (SP_HEAD_RE.test(s) && blank(k - 1)) { push('heading', s.replace(/\s*#[^#\s]+#$/, '')); continue; }
    if (spLooksLikeTransition(s) && blank(k - 1) && blank(k + 1)) { push('transition', s); continue; }
    if (blank(k - 1) && !blank(k + 1) && spLooksLikeCharacter(s.replace(/\s*\^$/, ''))) {
      push('character', spDropContd(s.replace(/\s*\^$/, '')));
      inSpeech = true;
      continue;
    }
    push('action', s, true);
  }
  return out;
}
// Fountain's title page: Title, Credit, Author, Draft date, Contact (a value
// on its own line or on indented lines below its key). Markup comes off.
const SP_TITLE_KEY = /^(title|credit|author|authors|source|draft date|date|contact|copyright|notes|revision)\s*:/i;
function spFountainTitle(src) {
  const rows = String(src || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out = {};
  if (!SP_TITLE_KEY.test(rows[0] || '')) return out;
  const vals = {};
  let key = null;
  for (const row of rows) {
    if (!row.trim()) break;
    const m = !/^\s/.test(row) && row.match(/^([^:]+):\s*(.*)$/);
    if (m) { key = m[1].trim().toLowerCase(); vals[key] = m[2].trim() ? [m[2].trim()] : []; } else if (key) vals[key].push(row.trim());
  }
  const plain = (a) => (a || []).map((r) => spRunsFromFountain(r.replace(/^>\s*|\s*<$/g, '')).map((x) => x.text).join('').trim()).filter(Boolean);
  if (vals.title) out.title = plain(vals.title).join(' ');
  if (vals.credit) out.credit = plain(vals.credit).join(' ');
  if (vals.author || vals.authors) out.author = plain(vals.author || vals.authors).join(' & ');
  if (vals['draft date'] || vals.date) out.draft = plain(vals['draft date'] || vals.date).join('\n');
  if (vals.contact) out.contact = plain(vals.contact).join('\n');
  return out;
}
// Fountain's emphasis as runs: *italic*, **bold**, ***both***, _underline_,
// with a backslash keeping a mark as itself
function spRunsFromFountain(t) {
  const runs = [];
  const st = { b: false, i: false, u: false };
  let buf = '';
  const flush = () => { if (buf) runs.push({ text: buf, b: st.b, i: st.i, u: st.u, s: false }); buf = ''; };
  // a mark only counts where a closing one follows on the line
  const closes = (from, mark) => t.indexOf(mark, from) > -1;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (c === '\\' && k + 1 < t.length) { buf += t[++k]; continue; }
    if (c === '*') {
      let n = 1;
      while (t[k + n] === '*' && n < 3) n++;
      const on = n === 3 ? st.b && st.i : n === 2 ? st.b : st.i;
      if (on || closes(k + n, '*'.repeat(n))) {
        flush();
        if (n === 3) { st.b = !on; st.i = !on; } else if (n === 2) st.b = !st.b; else st.i = !st.i;
        k += n - 1;
        continue;
      }
    }
    if (c === '_' && (st.u || closes(k + 1, '_'))) { flush(); st.u = !st.u; continue; }
    buf += c;
  }
  flush();
  return runs;
}
// Final Draft's .fdx is XML: a <Paragraph Type="…"> per line, its words in
// <Text Style="Bold+Italic"> runs. Read without a parser, so the same code
// runs in the tests. Dual dialogue comes in as two speeches in a row.
const SP_FDX_TYPES = {
  'scene heading': 'heading', action: 'action', character: 'character', parenthetical: 'paren',
  dialogue: 'dialogue', transition: 'transition', shot: 'shot', lyrics: 'dialogue', general: 'action'
};
const spXmlText = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const spXmlAttr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? spXmlText(m[1]) : ''; };
function spFdxParas(xml) {
  xml = xml.replace(/<Paragraph\b[^>]*>\s*<DualDialogue>([\s\S]*?)<\/DualDialogue>\s*<\/Paragraph>/g, '$1');
  const out = [];
  for (const m of xml.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g)) {
    const runs = [];
    for (const r of m[2].matchAll(/<Text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Text>)/g)) {
      const text = spXmlText(r[2] || '').replace(/\s*\n\s*/g, ' ');
      if (!text) continue;
      const style = spXmlAttr(r[1], 'Style').toLowerCase().split('+');
      runs.push({ text, b: style.includes('bold'), i: style.includes('italic'), u: style.includes('underline'), s: style.includes('strikeout') });
    }
    out.push({ type: spXmlAttr(m[1], 'Type'), align: spXmlAttr(m[1], 'Alignment').toLowerCase(), runs });
  }
  return out;
}
function spFromFdx(xml) {
  xml = String(xml || '');
  const body = (xml.match(/<Content>([\s\S]*?)<\/Content>/) || [])[1] || '';
  const lines = [];
  for (const p of spFdxParas(body)) {
    const text = p.runs.map((r) => r.text).join('').trim();
    if (!text) continue;
    const type = SP_FDX_TYPES[p.type.toLowerCase()] || 'action';
    let runs = p.runs;
    if (type === 'character') runs = [{ text: spDropContd(text), b: false, i: false, u: false, s: false }];
    if (type === 'paren' && !text.startsWith('(')) runs = [{ text: '(' + text + ')', b: false, i: false, u: false, s: false }];
    lines.push({ type, runs });
  }
  // the title page: the centered lines are the title, the credit and the
  // writer; lines set left, below them, the contact; set right, the draft
  const title = {};
  const page = (xml.match(/<TitlePage>[\s\S]*?<Content>([\s\S]*?)<\/Content>/) || [])[1] || '';
  const tp = spFdxParas(page).map((p) => ({ align: p.align, text: p.runs.map((r) => r.text).join('').trim() })).filter((p) => p.text);
  const centered = tp.filter((p) => p.align === 'center').map((p) => p.text);
  if (centered.length) {
    title.title = centered[0];
    const c = centered.findIndex((x, k) => k > 0 && /^(?:written by|screenplay by|teleplay by|story by|by)$/i.test(x));
    if (c > 0) { title.credit = centered[c]; if (centered[c + 1]) title.author = centered[c + 1]; } else if (centered[1]) title.author = centered[1];
  }
  const left = tp.filter((p) => p.align !== 'center' && p.align !== 'right').map((p) => p.text);
  const right = tp.filter((p) => p.align === 'right').map((p) => p.text);
  if (left.length) title.contact = left.join('\n');
  if (right.length) title.draft = right.join('\n');
  return { lines, title };
}
// …and back out: lines [{type, runs}] (runs as paraRuns gives them)
function spToFdx(lines, title = {}) {
  const NAMES = { heading: 'Scene Heading', action: 'Action', character: 'Character', paren: 'Parenthetical', dialogue: 'Dialogue', transition: 'Transition', shot: 'Shot' };
  const CAPS = ['heading', 'character', 'transition', 'shot'];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const textEl = (r, caps) => {
    const style = [r.b && 'Bold', r.i && 'Italic', r.u && 'Underline', r.s && 'Strikeout'].filter(Boolean).join('+');
    return `      <Text${style ? ` Style="${style}"` : ''}>${esc(caps ? r.text.toUpperCase() : r.text)}</Text>\n`;
  };
  let out = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<FinalDraft DocumentType="Script" Template="No" Version="1">\n\n  <Content>\n';
  for (const l of lines) {
    const runs = (l.runs || []).filter((r) => r.text);
    if (!runs.length) continue;
    out += `    <Paragraph Type="${NAMES[l.type] || 'Action'}">\n${runs.map((r) => textEl(r, CAPS.includes(l.type))).join('')}    </Paragraph>\n`;
  }
  out += '  </Content>\n';
  const para = (text, align) => `    <Paragraph Alignment="${align}">\n      <Text>${esc(text)}</Text>\n    </Paragraph>\n`;
  const gap = (n) => '    <Paragraph Alignment="Center">\n      <Text></Text>\n    </Paragraph>\n'.repeat(n);
  const tp = [];
  if (title.title) tp.push(gap(18), para(String(title.title).toUpperCase(), 'Center'));
  if (title.credit) tp.push(gap(1), para(title.credit, 'Center'));
  if (title.author) tp.push(gap(1), para(title.author, 'Center'));
  const rows = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (rows(title.draft).length || rows(title.contact).length) tp.push(gap(16));
  for (const r of rows(title.draft)) tp.push(para(r, 'Right'));
  for (const r of rows(title.contact)) tp.push(para(r, 'Left'));
  if (tp.length) out += '  <TitlePage>\n    <Content>\n' + tp.join('').replace(/^ {4}/gm, '      ') + '    </Content>\n  </TitlePage>\n';
  return out + '</FinalDraft>\n';
}
// ---- end of screenplay rules ----

const isScript = (meta = book) => !!meta && meta.format === 'screenplay';
const SP_CLASSES = SP_TYPES.filter((x) => x !== 'action').map((x) => 'sp-' + x);
const SP_NAMES = {
  heading: tk('Scene Heading'), action: tk('Action'), character: tk('Character'), paren: tk('Parenthetical'),
  dialogue: tk('Dialogue'), transition: tk('Transition'), shot: tk('Shot')
};
const spKey = (n) => K('⌘' + n, 'Ctrl+' + n);
// the screen's own marks on a script's lines, never saved
const SP_SCREEN_ATTRS = ['data-pg', 'data-fill', 'data-contd', 'data-ghost', 'data-ghost-empty'];
// characters NEO guessed from a line in capitals, and headings it made of
// INT./EXT.: either goes back to action when the guess turns out wrong
const spGuessed = new WeakSet();
const spDismissed = new WeakMap(); // a line → its text when Esc sent its suggestion away

function spType(p) {
  if (!p || !p.classList) return 'action';
  for (const x of SP_TYPES) if (x !== 'action' && p.classList.contains('sp-' + x)) return x;
  return 'action';
}
function spSetClass(p, type) {
  p.classList.remove(...SP_CLASSES, 'poetry', 'flush', 'scene-break', 'ghost');
  if (type !== 'action') p.classList.add('sp-' + type);
  if (!p.className) p.removeAttribute('class');
  spGuessed.delete(p);
}
function spCleanMarks(p) {
  for (const a of SP_SCREEN_ATTRS) if (p.hasAttribute(a)) p.removeAttribute(a);
}
// a page break's fill, as a custom property the stylesheet can read
(() => {
  const st = document.createElement('style');
  let css = '';
  for (let n = 0; n <= SP_LINES_PER_PAGE; n++) css += `.sp-geom>p[data-fill="${n}"]{--fill:${n}}`;
  st.textContent = css;
  document.head.appendChild(st);
})();

// the bodies and the lines of the open script, top to bottom
function spBodies() { return $$('#chapters .chapter-body.script-body'); }
function spParas() {
  const out = [];
  for (const b of spBodies()) for (const p of b.children) if (p.tagName === 'P') out.push(p);
  return out;
}
const spLinesOf = (ps) => ps.map((p) => ({ type: spType(p), text: p.textContent }));
// the line the caret is in (or was, before a click in the pane took focus)
let spLastPara = null;
function spCaretPara() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    let el = sel.anchorNode;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    const p = el && el.closest ? el.closest('p') : null;
    if (p && p.parentElement && p.parentElement.classList.contains('script-body')) return p;
  }
  return spLastPara && spLastPara.isConnected ? spLastPara : null;
}
const spBodyOf = (p) => p && p.closest('.chapter-body');
const spChapterOf = (p) => { const s = p && p.closest('.chapter'); return s ? s.dataset.id : null; };
function spCaretAtEnd(p) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !p.contains(sel.anchorNode) && sel.anchorNode !== p) return false;
  const r = document.createRange();
  r.selectNodeContents(p);
  try { r.setStart(sel.anchorNode, sel.anchorOffset); } catch { return false; }
  return r.toString().length === 0;
}
function spCaretAtStart(p) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const r = document.createRange();
  r.selectNodeContents(p);
  try { r.setEnd(sel.anchorNode, sel.anchorOffset); } catch { return false; }
  return r.toString().length === 0;
}
function spCaretToEnd(p) {
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = w.nextNode(); n; n = w.nextNode()) last = n;
  if (last) placeCaret(last, last.length); else placeCaret(p, 0);
}
// typed in, so ⌘Z takes it back like any typing
function spInsert(text) { document.execCommand('insertText', false, text); }
function spReplaceAll(p, text) {
  selectChars(p, 0, p.textContent.length);
  if (text) spInsert(text); else document.execCommand('delete');
  if (!p.textContent && !p.querySelector('br')) p.appendChild(document.createElement('br'));
}

// One element for a line: from the pane, the Format menu, ⌘1–7 or Tab.
// A parenthetical gets its parentheses, and loses them when it stops being one.
function spSetType(p, type) {
  const was = spType(p);
  if (!p || was === type) return;
  const text = p.textContent;
  if (was === 'paren' && /^\s*\(/.test(text)) {
    const inner = text.trim().replace(/^\(/, '').replace(/\)$/, '');
    spReplaceAll(p, inner);
  }
  spSetClass(p, type);
  if (type === 'paren') {
    const inner = p.textContent.trim().replace(/^\(/, '').replace(/\)$/, '');
    spReplaceAll(p, '(' + inner + ')');
    const pos = p.textContent.length - 1;
    selectChars(p, pos, pos);
  } else {
    spCaretToEnd(p);
  }
}
function spAfterChange(p) {
  const body = spBodyOf(p);
  if (!body) return;
  spLastPara = p;
  syncChapter(body, spChapterOf(p));
  spSchedule();
  spRefreshGhost();
  spShowElement();
}
// ⌘1–7, a click in the pane, the Format menu
function spSetElement(type) {
  const p = spCaretPara();
  if (!p || !SP_TYPES.includes(type)) return;
  const body = spBodyOf(p);
  if (document.activeElement !== body) {
    body.focus({ preventScroll: true });
    spCaretToEnd(p);
  }
  if (spType(p) !== type) spSetType(p, type);
  spAfterChange(p);
}

// The keys of a script. True when the key was handled here.
function scriptKey(e, body) {
  const cmd = IS_POCKET ? (e.metaKey !== e.ctrlKey) : (IS_MAC ? e.metaKey : e.ctrlKey);
  if (cmd && !e.shiftKey && !e.altKey && /^Digit[1-7]$/.test(e.code || '')) {
    e.preventDefault();
    spSetElement(SP_TYPES[Number(e.code.slice(5)) - 1]);
    return true;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!sel.isCollapsed) document.execCommand('delete');
    const p = caretBlock(body);
    if (p) spEnter(p, body);
    return true;
  }
  if (!sel.isCollapsed) return false;
  const p = caretBlock(body);
  if (!p) return false;
  const ghost = p.getAttribute('data-ghost') || '';
  if (e.key === 'Escape' && ghost) {
    // not this one: gone until the line changes
    e.preventDefault();
    e.stopPropagation();
    spDismissed.set(p, p.textContent);
    spRefreshGhost();
    return true;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    spTab(p, e.shiftKey, ghost && !e.shiftKey && spCaretAtEnd(p) ? ghost : '');
    return true;
  }
  if (e.key === 'ArrowRight' && !e.shiftKey && ghost && spCaretAtEnd(p)) {
    e.preventDefault();
    spInsert(ghost);
    spAfterChange(p);
    return true;
  }
  if (e.key === 'Backspace' && spCaretAtStart(p)) {
    const prev = p.previousElementSibling;
    // an empty speech under a name NEO guessed: it was action after all
    if (!p.textContent.trim() && spType(p) === 'dialogue' && prev && spType(prev) === 'character' && spGuessed.has(prev)) {
      e.preventDefault();
      spSetClass(prev, 'action');
      p.remove();
      spCaretToEnd(prev);
      spAfterChange(prev);
      return true;
    }
  }
  return false;
}

function spEnter(p, body) {
  let type = spType(p);
  // Enter takes the gray suggestion, as in Final Draft: on an empty name
  // line the one being answered, on a half-typed one the rest of the name
  // (or place, time, transition). A name already used as typed gets no
  // suggestion (spComplete), and Esc sends one away.
  if (p.getAttribute('data-ghost') && spCaretAtEnd(p)) spInsert(p.getAttribute('data-ghost'));
  const text = p.textContent;
  enterRun = 0;
  // (an empty parenthetical is its parentheses)
  if (!(type === 'paren' ? text.replace(/[()]/g, '') : text).trim()) {
    // Enter on an empty line changes what it is
    if (text) spReplaceAll(p, '');
    spSetClass(p, SP_EMPTY[type]);
    placeCaret(p, 0);
    spAfterChange(p);
    return;
  }
  // in a parenthetical, the caret before its closing ) is at its end
  if (type === 'paren') {
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(p);
    try { r.setStart(sel.anchorNode, sel.anchorOffset); } catch { /* where it is */ }
    if (r.toString().trim() === ')') spCaretToEnd(p);
  }
  if (spCaretAtStart(p)) {
    // at the start of a line with words: an empty line opens above it, a
    // line of the speech inside a speech, action anywhere else
    document.execCommand('insertParagraph');
    const above = p.previousElementSibling;
    if (above && above.tagName === 'P') { spSetClass(above, type === 'dialogue' || type === 'paren' ? 'dialogue' : 'action'); spCleanMarks(above); }
    spAfterChange(p);
    return;
  }
  if (!spCaretAtEnd(p)) {
    // mid-line: the rest becomes the next line
    document.execCommand('insertParagraph');
    const next = caretBlock(body);
    if (next && next !== p) {
      spCleanMarks(next);
      spSetClass(next, type === 'dialogue' || type === 'action' ? type : SP_AFTER[type]);
      spSetClass(p, type); // the engine may have moved the class along
      spAfterChange(next);
    }
    return;
  }
  // at the end: settle what this line is, then the next one
  if (type === 'action') {
    if (spLooksLikeTransition(text)) { spSetClass(p, 'transition'); type = 'transition'; }
    else if (spLooksLikeCharacter(text)) { spSetClass(p, 'character'); spGuessed.add(p); type = 'character'; }
  }
  if (type === 'paren' && !/\)\s*$/.test(text)) spInsert(')');
  const guessed = spGuessed.has(p);
  document.execCommand('insertParagraph');
  const next = caretBlock(body);
  if (next && next !== p) {
    spCleanMarks(next);
    spSetClass(next, SP_AFTER[type]);
    if (guessed) spGuessed.add(p);
    placeCaret(next, 0);
    spAfterChange(next);
  }
}

function spTab(p, back, ghost) {
  if (ghost) { spInsert(ghost); spAfterChange(p); return; }
  const type = spType(p);
  const text = p.textContent;
  // INT, EXT and the like, then Tab: a scene heading, with its period
  const prefix = /^(INT|EXT|EST|I\/E|INT\.?\/EXT)\.?$/i.test(text.trim());
  if ((type === 'heading' || (type === 'action' && prefix)) && !back) {
    const t = text.replace(/\s+$/, '');
    const h = spParseHeading(text);
    if (prefix) {
      spReplaceAll(p, t.replace(/\.$/, '') + '. ');
      spSetClass(p, 'heading');
      spGuessed.add(p);
      spCaretToEnd(p);
      spAfterChange(p);
      return;
    }
    if (h && h.loc && h.time === null) {
      spReplaceAll(p, t + ' - ');
      spAfterChange(p);
      return;
    }
  }
  let to;
  if (type === 'dialogue' || type === 'paren') to = type === 'dialogue' ? 'paren' : 'dialogue';
  else {
    const k = SP_CYCLE.indexOf(type);
    to = SP_CYCLE[(k + (back ? -1 : 1) + SP_CYCLE.length) % SP_CYCLE.length];
  }
  spSetType(p, to);
  spAfterChange(p);
}

// As the writer types: INT. or EXT. makes a heading, an opening "(" in a
// speech makes a parenthetical
function scriptInput(body) {
  const p = caretBlock(body);
  if (p) {
    const type = spType(p);
    const text = p.textContent;
    if (type === 'action' && SP_HEAD_RE.test(text)) { spSetClass(p, 'heading'); spGuessed.add(p); }
    else if (type === 'heading' && spGuessed.has(p) && !SP_HEAD_RE.test(text)) spSetClass(p, 'action');
    else if (type === 'dialogue' && text.startsWith('(')) spSetClass(p, 'paren');
    // "(" opening the line after a speech: a parenthetical inside it, and
    // Enter after it goes back to the speech
    else if (type === 'action' && text.startsWith('(') && p.previousElementSibling &&
      ['dialogue', 'paren'].includes(spType(p.previousElementSibling))) spSetClass(p, 'paren');
    spLastPara = p;
  }
  spSchedule();
  spRefreshGhost();
  spShowElement();
}

// ---- the gray suggestion at the caret ----
function spRefreshGhost() {
  const p = spCaretPara();
  let ghost = '';
  if (p && document.activeElement === spBodyOf(p) && ['character', 'heading', 'transition'].includes(spType(p)) && spCaretAtEnd(p) && spDismissed.get(p) !== p.textContent) {
    const ps = spParas();
    ghost = spGhost(spLinesOf(ps), ps.indexOf(p));
  }
  for (const q of $$('#chapters p[data-ghost]')) {
    if (q !== p || !ghost) { q.removeAttribute('data-ghost'); q.removeAttribute('data-ghost-empty'); }
  }
  if (p && ghost) {
    if (p.getAttribute('data-ghost') !== ghost) p.setAttribute('data-ghost', ghost);
    p.toggleAttribute('data-ghost-empty', !p.textContent);
  }
}

// ---- pages ----
let spLayout = { ps: [], at: [], pages: 1, used: 0, scenes: [] };
let spTimer = null;
const SP_NARROW = window.matchMedia ? window.matchMedia('(max-width: 599px)') : { matches: false };
function spSchedule(ms = 140) {
  clearTimeout(spTimer);
  spTimer = setTimeout(spRepaginate, ms);
}
// How many lines each element takes on the printed page. Read from the
// page itself when it is showing at its true shape; otherwise laid out in
// a measuring room off screen (on a phone, from another tab, for the PDF).
function spMeasure(ps, live) {
  if (live && ps.length) {
    const lh = parseFloat(getComputedStyle(ps[0]).lineHeight) || 0;
    const first = ps[0].getBoundingClientRect().height;
    if (lh > 0 && first > 0) return ps.map((p) => Math.max(1, Math.round(p.getBoundingClientRect().height / lh)));
  }
  let room = $('#sp-measure');
  if (!room) {
    room = document.createElement('div');
    room.id = 'sp-measure';
    room.className = 'sp-measure';
    room.setAttribute('aria-hidden', 'true');
    room.innerHTML = '<div class="sp-geom"></div>';
    document.body.appendChild(room);
  }
  const inner = room.firstElementChild;
  inner.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const p of ps) {
    const c = p.cloneNode(true);
    for (const a of ['data-pg', 'data-fill', 'data-ghost', 'data-ghost-empty']) c.removeAttribute(a);
    frag.appendChild(c);
  }
  inner.appendChild(frag);
  const out = [...inner.children].map((c) => Math.max(1, Math.round(c.getBoundingClientRect().height / 20)));
  inner.innerHTML = '';
  return out;
}
function spRepaginate() {
  clearTimeout(spTimer);
  if (!book || !isScript() || !$('#paper').classList.contains('script')) return;
  const ps = spParas();
  const lines = spLinesOf(ps);
  // (CONT'D) first: it makes a name's line longer
  ps.forEach((p, i) => {
    const c = lines[i].type === 'character' && spContd(lines, i);
    if (p.hasAttribute('data-contd') !== c) p.toggleAttribute('data-contd', c);
  });
  const narrow = $('#paper').classList.contains('narrow');
  const live = !narrow && currentTab === 'manuscript' && !$('#paper').hidden;
  const counts = spMeasure(ps, live);
  const pg = spPaginate(ps.map((p, i) => ({ type: lines[i].type, lines: counts[i] })));
  ps.forEach((p, i) => {
    const a = pg.at[i];
    const page = a.brk ? String(a.page) : null;
    if (p.getAttribute('data-pg') !== page) { if (page) p.setAttribute('data-pg', page); else p.removeAttribute('data-pg'); }
    const fill = a.brk ? String(Math.min(SP_LINES_PER_PAGE, a.fill)) : null;
    if (p.getAttribute('data-fill') !== fill) { if (fill) p.setAttribute('data-fill', fill); else p.removeAttribute('data-fill'); }
  });
  const chapters = $('#chapters');
  chapters.style.setProperty('--sp-last', String(Math.max(0, SP_LINES_PER_PAGE - pg.used)));
  if (narrow) chapters.style.setProperty('--sp-fullw', chapters.clientWidth + 'px');
  // the scenes: where each starts and how long it runs
  const scenes = [];
  ps.forEach((p, i) => {
    if (lines[i].type === 'heading') scenes.push({ p, i, slug: lines[i].text.trim(), lines: 0 });
    if (scenes.length) scenes[scenes.length - 1].lines += counts[i] + pg.at[i].before;
  });
  const before = spLayout.scenes.map((s) => s.slug + s.lines).join('|');
  spLayout = { ps, at: pg.at, pages: pg.pages, used: pg.used, scenes, counts };
  if (scenes.map((s) => s.slug + s.lines).join('|') !== before) scheduleNavRefresh();
  updateCounters();
}
// The script's length as a production reads it: pages in eighths, and a
// page a minute
function spLengthText() {
  const eighths = Math.max(1, Math.round(((spLayout.pages - 1) * SP_LINES_PER_PAGE + spLayout.used) / SP_LINES_PER_PAGE * 8));
  return { eighths, text: spEighthsText(eighths), minutes: Math.max(1, Math.round(eighths / 8)) };
}
function spEighthsText(e) {
  const whole = Math.floor(e / 8);
  const rem = e % 8;
  if (!whole) return rem + '/8';
  return rem ? `${fmtNum(whole)} ${rem}/8` : fmtNum(whole);
}
function spCurrentPage() {
  const p = spCaretPara();
  const i = p ? spLayout.ps.indexOf(p) : -1;
  if (i >= 0 && spLayout.at[i]) return spLayout.at[i].page;
  // no caret: the page at the top of the window
  const top = $('#paper-scroll').getBoundingClientRect().top + 40;
  let page = 1;
  spLayout.ps.forEach((q, k) => { if (q.isConnected && q.getBoundingClientRect().top < top && spLayout.at[k]) page = spLayout.at[k].page; });
  return page;
}
function spCurrentScene() {
  const p = spCaretPara();
  const i = p ? spLayout.ps.indexOf(p) : -1;
  let n = 0;
  spLayout.scenes.forEach((s, k) => { if (s.i <= i) n = k + 1; });
  return n;
}
let spPosScene = false; // the page counter, clicked, counts scenes instead
function spCounters() {
  const len = spLengthText();
  const wc = $('#word-counter');
  if (wordMode === 'book') setText(wc, t('{pages} pages · ~{n} min', { pages: len.text, n: len.minutes }));
  else setText(wc, t('{n} words', { n: bookWordCount() }));
  const pos = $('#pos-counter');
  setText(pos, spPosScene
    ? t('scene {n} of {total}', { n: spCurrentScene(), total: spLayout.scenes.length })
    : t('page {p} of {total}', { p: spCurrentPage(), total: spLayout.pages }));
}

// ---- the pane: the elements on top, the scenes beneath ----
let spShownElement = null;
function spShowElement() {
  const p = spCaretPara();
  const type = p ? spType(p) : null;
  if (type === spShownElement) return;
  spShownElement = type;
  for (const el of $$('#nav-list .sp-el')) el.classList.toggle('current', el.dataset.el === type);
  spReportState();
}
// the scene the caret is in, lit in the pane
function spHighlightScene() {
  const n = spCurrentScene();
  $$('#nav-list .sp-scene').forEach((el, k) => el.classList.toggle('current', k + 1 === n));
}
function spReportState() {
  if (!window.neo.scriptState) return;
  const on = !!book && isScript() && !$('#editor-view').hidden;
  window.neo.scriptState({ on, element: on ? spShownElement || 'action' : null });
}
function renderScriptNav() {
  const list = $('#nav-list');
  list.innerHTML = '';
  setText($('#nav-head span'), t('Elements'));
  SP_TYPES.forEach((type, k) => {
    const item = document.createElement('div');
    item.className = 'nav-item sp-el';
    item.dataset.el = type;
    item.innerHTML = '<div class="n-row"><span class="n-label"></span><span class="n-words"></span></div>';
    item.querySelector('.n-label').textContent = t(SP_NAMES[type]);
    item.querySelector('.n-words').textContent = spKey(k + 1);
    // the caret stays in the script while the pane is used
    item.addEventListener('mousedown', (e) => e.preventDefault());
    item.onclick = () => spSetElement(type);
    pressable(item, t(SP_NAMES[type]));
    list.appendChild(item);
  });
  spShownElement = null;
  spShowElement();
  const head = document.createElement('div');
  head.className = 'sp-scenes-head';
  head.textContent = t('Scenes');
  list.appendChild(head);
  const caret = spCaretPara();
  const at = caret ? spLayout.ps.indexOf(caret) : -1;
  spLayout.scenes.forEach((s, k) => {
    const item = document.createElement('div');
    item.className = 'nav-item sp-scene';
    const next = spLayout.scenes[k + 1];
    if (at >= s.i && (!next || at < next.i)) item.classList.add('current');
    item.innerHTML = '<div class="n-row"><span class="n-num"></span><span class="n-label"></span><span class="n-words"></span></div>';
    item.querySelector('.n-num').textContent = String(k + 1);
    item.querySelector('.n-label').textContent = s.slug || '…';
    item.querySelector('.n-words').textContent = spEighthsText(spEighths(s.lines));
    const row = item.querySelector('.n-row');
    row.draggable = true;
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-neo-scene', String(k));
      item.classList.add('dragging');
      $('#nav-pane').classList.add('open');
    });
    row.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      const ind = list.querySelector('.nav-drop-ind');
      if (ind) ind.remove();
    });
    item.onclick = () => {
      switchTab('manuscript');
      const p = s.p;
      if (!p.isConnected) return;
      const body = spBodyOf(p);
      body.focus({ preventScroll: true });
      spCaretToEnd(p);
      spLastPara = p;
      const sc = $('#paper-scroll');
      sc.scrollTop += p.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientHeight / 4;
      updateCounters();
      if (IS_POCKET && $('#nav-pane').dataset.pinned !== '1') $('#nav-pane').classList.remove('open');
    };
    pressable(row, [String(k + 1), s.slug].join(' '));
    list.appendChild(item);
  });
}
// a scene dragged in the pane: it moves, heading and all, to the gold line
(() => {
  const list = $('#nav-list');
  if (!list) return;
  list.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-neo-scene')) return;
    e.preventDefault();
    const ind = navDropInd();
    let placed = false;
    for (const it of list.querySelectorAll('.sp-scene:not(.dragging)')) {
      const r = it.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { list.insertBefore(ind, it); placed = true; break; }
    }
    if (!placed) list.appendChild(ind);
  });
  list.addEventListener('drop', (e) => {
    const from = e.dataTransfer.getData('application/x-neo-scene');
    if (from === '') return;
    e.preventDefault();
    const ind = list.querySelector('.nav-drop-ind');
    let to = spLayout.scenes.length;
    if (ind) {
      to = 0;
      for (const c of list.children) {
        if (c === ind) break;
        if (c.classList.contains('sp-scene')) to++;
      }
      ind.remove();
    }
    spMoveScene(Number(from), to);
  });
})();
// scene k, heading and all, to just before scene `to` (or the end)
function spMoveScene(k, to) {
  const scenes = spLayout.scenes;
  const s = scenes[k];
  if (!s || to === k || to === k + 1 || !s.p.isConnected) return;
  const body = spBodyOf(s.p);
  const nodes = [s.p];
  for (let n = s.p.nextElementSibling; n && !(n.tagName === 'P' && spType(n) === 'heading'); n = n.nextElementSibling) nodes.push(n);
  snapshotStructure('scene moved');
  const target = scenes[to] && scenes[to].p.isConnected ? scenes[to].p : null;
  const dest = target ? spBodyOf(target) : spBodies()[spBodies().length - 1];
  for (const n of nodes) {
    if (target) target.before(n); else dest.appendChild(n);
  }
  if (!body.querySelector('p')) body.innerHTML = '<p><br></p>';
  for (const b of new Set([body, dest])) syncChapter(b, b.closest('.chapter').dataset.id);
  breakRun++;
  spRepaginate();
  renderNav();
}

// ---- the title page: title, "Written by", the writer, and at the foot
// the contact (one for the whole library) and the draft ----
function spTitlePage(on) {
  const page = $('#title-page');
  for (const id of ['tp-credit', 'tp-contact', 'tp-draft']) {
    const old = document.getElementById(id);
    if (old) old.remove();
  }
  if (!on) return;
  const field = (id, ph, value, after, save) => {
    const el = document.createElement('div');
    el.id = id;
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', ph);
    el.dataset.ph = ph;
    el.textContent = value || '';
    if (after) after.after(el); else page.appendChild(el);
    el.addEventListener('input', () => save(el.innerText.replace(/\n+$/, '')));
    return el;
  };
  const credit = field('tp-credit', t('Written by'), book.credit === undefined ? t('Written by') : book.credit, $('#tp-subtitle'), (v) => { book.credit = v.trim(); scheduleMetaSave(); });
  credit.addEventListener('keydown', titleEnter);
  const contact = field('tp-contact', t('Contact'), library.scriptContact || '', null, (v) => {
    library.scriptContact = v;
    clearTimeout(spTitlePage.t);
    spTitlePage.t = setTimeout(() => writeLibrary(library), 800);
  });
  contact.setAttribute('aria-multiline', 'true');
  // Enter starts a new line of the block (a line break, not a paragraph)
  const lineBreak = (e) => { if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); } };
  contact.addEventListener('keydown', lineBreak);
  const draft = field('tp-draft', t('Draft and date'), book.draft || '', null, (v) => { book.draft = v; scheduleMetaSave(); });
  draft.setAttribute('aria-multiline', 'true');
  draft.addEventListener('keydown', lineBreak);
}

// The look of the editor for a script, or back to a book's
function spEditorMode() {
  const on = isScript();
  const narrow = on && SP_NARROW.matches;
  $('#paper').classList.toggle('script', on);
  $('#paper').classList.toggle('narrow', narrow);
  $('#editor-view').classList.toggle('script-mode', on);
  $('#nav-pane').classList.toggle('script', on);
  // novel and script each keep their own page zoom: entering one applies its own
  applyPageZoom();
  const tabM = $('.tab[data-tab="manuscript"]');
  if (tabM) setText(tabM, on ? t('Script') : t('Manuscript'));
  const tabO = $('.tab[data-tab="outline"]');
  if (tabO) tabO.hidden = false; // a script's outline is its scenes, as cards
  const add = $('#nav-add');
  if (add) add.hidden = on;
  if (!on) setText($('#nav-head span'), t('Chapters'));
  spTitlePage(on);
  // the pane stays open beside a script, unless the writer unpinned it there
  if (!NO_HOVER) {
    let kept = {};
    try { kept = JSON.parse(localStorage.getItem('neo-pinned-panes') || '{}'); } catch { /* nothing kept */ }
    pinPane('nav', on ? kept.scriptNav !== false : !!kept.nav, on ? 'scriptNav' : 'nav');
  }
}
if (SP_NARROW.addEventListener) {
  SP_NARROW.addEventListener('change', () => { if (book && isScript() && !$('#editor-view').hidden) { const c = captureCaret(); renderChapters(); restoreCaret(c); } });
}
window.addEventListener('resize', () => { if (book && isScript() && $('#paper').classList.contains('narrow')) spSchedule(200); });

// Pasting into a script: lines copied from a script keep their elements,
// and a script pasted as plain text (Fountain, or copied from a PDF) is
// read line by line the way Fountain reads it
function spPaste(e, body, chId) {
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  let lines = null;
  if (html && /class="[^"]*\bsp-|script-body/.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    lines = [...doc.body.querySelectorAll('p')].map((p) => ({ type: spType(p), html: paraRuns(p.innerHTML, false).filter((r) => r.text).map(runHtml).join('') }));
  } else if (text && /\n/.test(text.trim())) {
    lines = spFromFountain(text).map((l) => ({ type: l.type, html: spRunsFromFountain(l.text).map((x) => runHtml(x)).join('') }));
  }
  if (!lines || !lines.length) return false;
  e.preventDefault();
  if (lines.length > 60) { spPasteMany(lines, body, chId); return true; }
  const marker = 'sp' + Date.now().toString(36);
  const out = lines.map((l, i) => `<p${l.type === 'action' ? '' : ` class="sp-${l.type}"`}${i === lines.length - 1 ? ` data-sp-paste="${marker}"` : ''}>${l.html || '<br>'}</p>`).join('');
  document.execCommand('insertHTML', false, out);
  stripJunkSpans(body);
  const last = body.querySelector(`p[data-sp-paste="${marker}"]`);
  if (last) last.removeAttribute('data-sp-paste');
  for (const p of body.querySelectorAll('p[data-sp-paste]')) p.removeAttribute('data-sp-paste');
  for (const p of body.querySelectorAll('p')) {
    for (const a of ['style']) if (p.getAttribute(a) && !/text-align/.test(p.getAttribute(a))) p.removeAttribute(a);
  }
  syncChapter(body, chId);
  spSchedule();
  return true;
}

// Lines joined by a delete: the engine keeps the upper line and pours the
// lower one into it. When the upper line goes entirely (a shot selected and
// deleted, an empty line Backspaced away from below), what's left is the
// lower line, so it stays what it was: a scene heading stays a heading, and
// its card keeps its note. NEO makes that cut itself; ⌘Z puts it back.
document.addEventListener('beforeinput', (e) => {
  const body = e.target && e.target.closest ? e.target.closest('.script-body') : null;
  if (!body || e.defaultPrevented || !/^delete(Content|Word|SoftLine|HardLine|ByCut)/.test(e.inputType || '')) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  const lineOf = (n) => {
    const el = n && n.nodeType === Node.TEXT_NODE ? n.parentElement : n;
    const p = el && el.closest ? el.closest('p') : null;
    return p && p.parentElement === body ? p : null;
  };
  let upper = null;
  let lower = null;
  if (!r.collapsed) {
    upper = lineOf(r.startContainer);
    lower = lineOf(r.endContainer);
    if (!upper || !lower || upper === lower) return;
    // the upper line keeps words: the join is the engine's, as usual
    const before = document.createRange();
    before.selectNodeContents(upper);
    before.setEnd(r.startContainer, r.startOffset);
    if (before.toString().length) return;
  } else if (/Backward$/.test(e.inputType)) {
    lower = lineOf(r.startContainer);
    upper = lower && lower.previousElementSibling;
    if (!upper || upper.tagName !== 'P' || upper.textContent.length || !spCaretAtStart(lower)) return;
  } else if (/Forward$/.test(e.inputType)) {
    upper = lineOf(r.startContainer);
    lower = upper && upper.nextElementSibling;
    if (!lower || lower.tagName !== 'P' || upper.textContent.length) return;
  } else return;
  e.preventDefault();
  const chId = spChapterOf(lower);
  snapshotStructure('lines removed');
  if (!r.collapsed) {
    const cut = document.createRange();
    cut.setStart(lower, 0);
    cut.setEnd(r.endContainer, r.endOffset);
    cut.deleteContents();
  }
  for (let n = upper; n && n !== lower;) { const next = n.nextElementSibling; n.remove(); n = next; }
  if (!lower.textContent && !lower.querySelector('br')) lower.appendChild(document.createElement('br'));
  placeCaret(lower, 0);
  syncChapter(body, chId);
  breakRun++;
  spAfterChange(lower);
}, true);

// A whole script pasted in: the engine's own paste takes seconds per few
// hundred lines (and minutes for a feature), so the lines go straight onto
// the page, and ⌘Z takes the paste back as one move
function spPasteMany(lines, body, chId) {
  snapshotStructure('paste');
  const sel = window.getSelection();
  if (!sel.isCollapsed) document.execCommand('delete');
  let p = caretBlock(body);
  let atEnd = false;
  if (!p) {
    // a caret on the page itself, between its lines: the line beside it
    const kids = [...body.children].filter((c) => c.tagName === 'P');
    p = sel.anchorNode === body ? kids[Math.min(sel.anchorOffset, kids.length - 1)] : kids[kids.length - 1];
    atEnd = true;
    if (!p) { p = document.createElement('p'); p.innerHTML = '<br>'; body.appendChild(p); }
  }
  // the words after the caret wait below what's pasted, as a line of their own
  const tail = document.createRange();
  try {
    if (atEnd) throw new Error('at the line\'s end');
    tail.setStart(sel.anchorNode, sel.anchorOffset);
  } catch { tail.setStart(p, p.childNodes.length); }
  tail.setEnd(p, p.childNodes.length);
  const after = tail.extractContents();
  const frag = document.createDocumentFragment();
  let last = null;
  for (const l of lines) {
    const q = document.createElement('p');
    if (l.type !== 'action') q.className = 'sp-' + l.type;
    q.innerHTML = l.html || '<br>';
    frag.appendChild(q);
    last = q;
  }
  if (after.textContent) {
    const q = p.cloneNode(false);
    spCleanMarks(q);
    q.appendChild(after);
    frag.appendChild(q);
  }
  p.after(frag);
  if (!p.textContent.trim() && !p.querySelector('.ph-mark')) p.remove();
  spCaretToEnd(last);
  syncChapter(body, chId);
  resetNativeUndo();
  breakRun++;
  spSchedule();
  revealCaret();
}

// A .fountain or .fdx file, dropped on a shelf or picked with Import: a new
// script on that shelf, title page and all
async function importScript(r, shelf) {
  const parsed = r.script === 'fdx'
    ? spFromFdx(r.source)
    : { lines: spFromFountain(r.source).map((l) => ({ type: l.type, runs: spRunsFromFountain(l.text) })), title: spFountainTitle(r.source) };
  if (!parsed.lines.length) return false;
  const tp = parsed.title || {};
  const title = tp.title || r.name;
  const meta = await window.neo.createBook({ author: tp.author || displayAuthor(), title });
  const chId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const html = parsed.lines.map((l) => `<p${l.type === 'action' ? '' : ` class="sp-${l.type}"`}>${l.runs.map((x) => runHtml(x)).join('') || '<br>'}</p>`).join('');
  await window.neo.writeChapter(meta.id, chId, html);
  meta.title = title;
  meta.format = 'screenplay';
  meta.chapterOrder = [chId];
  meta.credit = tp.credit || t('Written by');
  if (tp.draft) meta.draft = tp.draft;
  meta.tabNames = { notes: (library.tabDefaults && library.tabDefaults.notes) || 'Notes', outline: 'Outline' };
  meta.wordCount = parsed.lines.reduce((n, l) => n + countWords(l.runs.map((x) => x.text).join('')), 0);
  // the contact block is the writer's, for every script: one carried in
  // fills it only when it's still empty
  if (tp.contact && !library.scriptContact) library.scriptContact = tp.contact;
  await writeBookMeta(meta.id, meta);
  await placeTitle(shelf, meta.id);
  return true;
}

// ---- out of NEO: the PDF, as the industry prints a script, and Fountain ----
// The script's lines for the exports: each with its element, its runs of
// bold/italic/underline, and (CONT'D) where the screen shows it
function spExportLines() {
  const lines = [];
  for (const chId of book.chapterOrder) {
    const holder = cleanChapterEl(chId);
    for (const p of holder.querySelectorAll('p')) {
      const runs = paraRuns(p.innerHTML, false).filter((r) => r.text && r.mark === undefined);
      const text = runs.map((r) => r.text).join('').replace(/\s+$/, '');
      lines.push({ type: spType(p), runs, text });
    }
  }
  const plain = lines.map((l) => ({ type: l.type, text: l.text }));
  lines.forEach((l, i) => { l.contd = l.type === 'character' && spContd(plain, i); });
  return lines;
}
const SP_CAPS = ['heading', 'character', 'transition', 'shot'];
function spRunsHtml(l) {
  const caps = SP_CAPS.includes(l.type);
  return l.runs.map((r) => runHtml({ ...r, text: caps ? r.text.toUpperCase() : r.text })).join('') + (l.contd ? " (CONT'D)" : '');
}
async function spPdfHtml() {
  const lines = spExportLines().filter((l, i, all) => l.text.trim() || (i > 0 && i < all.length - 1));
  // lay the lines out off screen, as they print, to count them
  const holder = document.createElement('div');
  const ps = lines.map((l) => {
    const p = document.createElement('p');
    if (l.type !== 'action') p.className = 'sp-' + l.type;
    p.innerHTML = spRunsHtml(l) || '<br>';
    holder.appendChild(p);
    return p;
  });
  await document.fonts.load('1em "Courier Prime"').catch(() => {});
  const counts = spMeasure(ps, false);
  const pg = spPaginate(lines.map((l, i) => ({ type: l.type, lines: counts[i] })));
  const pages = [];
  lines.forEach((l, i) => {
    const a = pg.at[i];
    if (!pages[a.page - 1]) pages[a.page - 1] = [];
    const cls = l.type === 'action' ? '' : ` class="sp-${l.type}"`;
    pages[a.page - 1].push(`<p${cls} style="margin-top:${a.before}em">${spRunsHtml(l) || '&nbsp;'}</p>`);
  });
  const esc = (s) => escHtml(String(s || ''));
  const title = book.title && !isUntitled(book.title) ? book.title : t('Untitled');
  const credit = book.credit === undefined ? t('Written by') : book.credit;
  const fonts = await spFontFaces();
  const lines2 = (s) => esc(s).replace(/\n/g, '<br>');
  const titlePage = `<div class="page title">
    <div class="tp-main"><div>${esc(title.toUpperCase())}</div>${credit ? `<div class="gap">${esc(credit)}</div>` : ''}<div class="${credit ? '' : 'gap'}">${esc(book.author || '')}</div></div>
    <div class="tp-contact">${lines2(library.scriptContact || '')}</div>
    <div class="tp-draft">${lines2(book.draft || '')}</div>
  </div>`;
  const body = pages.map((rows, k) => `<div class="page">${k ? `<div class="num">${k + 1}.</div>` : ''}${(rows || []).join('')}</div>`).join('');
  return `<!DOCTYPE html><html lang="${escHtml(writingLanguage())}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${fonts}
@page { size: 8.5in 11in; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: 'Courier Prime', 'Courier New', Courier, monospace; font-size: 12pt; line-height: 12pt; color: #000; }
.page { width: 8.5in; height: 11in; box-sizing: border-box; padding: 1in 1in 0 1.5in; position: relative; overflow: hidden; break-after: page; }
.page:last-child { break-after: auto; }
.num { position: absolute; top: 0.5in; right: 1in; }
p { margin: 0; width: 36.3em; white-space: pre-wrap; overflow-wrap: anywhere; }
p.sp-character { margin-left: 13.2em; width: 23.1em; }
p.sp-paren { margin-left: 9.6em; width: 15.3em; }
p.sp-dialogue { margin-left: 6em; width: 21.3em; }
p.sp-transition { text-align: right; }
p.sp-heading, p.sp-shot { font-weight: bold; }
.title { text-align: center; }
.tp-main { position: absolute; top: 3.5in; left: 1.5in; width: 6in; }
.tp-main .gap { margin-top: 2em; }
.tp-main div + div:not(.gap) { margin-top: 1em; }
.tp-contact { position: absolute; left: 1.5in; bottom: 1in; width: 3.5in; text-align: left; }
.tp-draft { position: absolute; right: 1in; bottom: 1in; width: 2.5in; text-align: right; }
</style></head><body>${titlePage}${body}</body></html>`;
}
// Courier Prime travels inside the PDF
async function spFontFaces() {
  let css = '';
  for (const sheet of document.styleSheets) {
    let rules = [];
    try { rules = [...sheet.cssRules]; } catch { continue; }
    for (const r of rules) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      if (r.style.getPropertyValue('font-family').replace(/["']/g, '').trim() !== 'Courier Prime') continue;
      const src = r.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/);
      if (!src) continue;
      try {
        const bytes = new Uint8Array(await (await fetch(new URL(src[1], sheet.href || location.href))).arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const range = r.style.getPropertyValue('unicode-range');
        css += `@font-face { font-family: 'Courier Prime'; src: url(data:font/woff2;base64,${btoa(bin)}) format('woff2'); font-weight: ${r.style.getPropertyValue('font-weight') || 400}; font-style: ${r.style.getPropertyValue('font-style') || 'normal'};${range ? ` unicode-range: ${range};` : ''} }\n`;
      } catch { /* the PDF falls back on Courier */ }
    }
  }
  return css;
}
function spFountain() {
  const lines = spExportLines().map((l) => ({
    type: l.type,
    text: l.runs.map((r) => {
      const s = r.text.replace(/([\\*_])/g, '\\$1');
      const lead = s.match(/^\s*/)[0];
      const trail = s.match(/\s*$/)[0];
      let core = s.slice(lead.length, s.length - trail.length);
      if (!core) return s;
      const mark = r.b && r.i ? '***' : r.b ? '**' : r.i ? '*' : '';
      if (r.u) core = '_' + core + '_';
      return lead + mark + core + mark + trail;
    }).join('')
  }));
  return spToFountain(lines, spTitleFields());
}
// what the title page says, for the files a script leaves as
function spTitleFields() {
  return {
    title: book.title && !isUntitled(book.title) ? book.title : '',
    credit: book.credit === undefined ? t('Written by') : book.credit,
    author: book.author || '',
    draft: book.draft || '',
    contact: library.scriptContact || ''
  };
}
async function spExport(format) {
  flushAllSaves();
  const defaultName = safeName(book.title);
  try {
    let payload;
    if (format === 'pdf') payload = { format: 'pdf', defaultName, content: await spPdfHtml(), print: 'screenplay' };
    else if (format === 'fdx') payload = { format: 'fdx', defaultName, content: spToFdx(spExportLines(), spTitleFields()) };
    else payload = { format: 'fountain', defaultName, content: spFountain() };
    const saved = await window.neo.exportSave(payload);
    if (saved) toast(t('Exported: {file}', { file: saved.split('/').pop() }));
  } catch (err) {
    window.neo.logError('export ' + format + ': ' + (err && err.stack || err));
    toast(t('Couldn’t export: {error}', { error: plainError(err) }), 8000);
  }
}

// ---- the shelf: a new script, and its tile ----
async function createScriptOnShelf(shelf) {
  const meta = await window.neo.createBook({ author: displayAuthor() });
  const chId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  await window.neo.writeChapter(meta.id, chId, '<p><br></p>');
  meta.format = 'screenplay';
  meta.chapterOrder = [chId];
  meta.credit = t('Written by');
  meta.tabNames = { notes: (library.tabDefaults && library.tabDefaults.notes) || 'Notes', outline: 'Outline' };
  await writeBookMeta(meta.id, meta);
  await placeTitle(shelf, meta.id);
  await writeLibrary(library);
  await openBook(meta.id);
}
function scriptTile(el, meta) {
  el.classList.add('script-tile');
  el.innerHTML = `
    <div class="st-text"><div class="st-title"></div><div class="st-author"></div></div>
    <span class="st-brad top"></span><span class="st-hole"></span><span class="st-brad bot"></span>
    <div class="b-progress" hidden><div></div></div>`;
  const title = isUntitled(meta.title) ? t('Untitled') : meta.title;
  const tEl = el.querySelector('.st-title');
  tEl.textContent = title;
  tEl.classList.toggle('long', title.length > 36);
  el.querySelector('.st-author').textContent = meta.author || '';
}

/* ================================================================== */
>>>>>>> upstream
```

### Upstream source mapping failure

The sync could not safely map upstream changes into the fork modules.

- Fork module: [`app.js` line 1](./app.js#L1)
- Upstream source: [`app.js` line 1](./app.js#L1)

```diff
- Mapping failed
+ git merge-file failed
```

---

## Upstream sync conflict — 2026-10-06T16:45:29.917Z

- Upstream: `upstream/main` at `accb7960924a080ddfac6f91ffabed25f6c2ad97`
- Common base: `db326f75645c4e51506cf30889cd3bd23fb3dc72`
- No source files were changed by this run.

### Renderer module `vim-keys.js` — conflict 1

- Fork module: [`src/renderer/vim-keys.js` lines 397-399](./src/renderer/vim-keys.js#L397)
- Common base: [`app.js` lines 4591-4591](./app.js#L4591)
- Upstream: [`app.js` lines 4766-6174](./app.js#L4766)

```diff
<<<<<<< fork

'use strict';

||||||| common base

=======
/*  SCREENPLAYS                                                        */
/*  A script is a book whose book.json says "format": "screenplay".    */
/*  It lives on the shelves like any book (right-click a shelf's + for */
/*  New Script) and is set as it prints: Courier Prime on letter       */
/*  paper. The whole script is one chapter, one typing area, so a      */
/*  selection and the arrow keys run straight through the scenes; the  */
/*  scenes are found by their headings. Each line is a paragraph of    */
/*  one of seven elements, its class sp-<element> (action has none).   */
/*  Nobody has to pick an element: INT. or EXT. makes a scene heading, */
/*  a short line in capitals followed by Enter makes a character, and  */
/*  Enter on an empty line changes what that line is (the rules of     */
/*  Fountain, the plain-text screenplay format). Page breaks, page     */
/*  numbers, (CONT'D) and the gray suggestions are drawn from data-*   */
/*  marks that captureBody strips: nothing on screen is saved.         */
/* ================================================================== */

// ---- screenplay rules: plain functions of the lines, no page (see scripts/screenplay.test.js) ----
const SP_TYPES = ['heading', 'action', 'character', 'paren', 'dialogue', 'transition', 'shot'];
// blank lines above each element (two above a scene heading, so each scene
// stands apart; it costs a few pages, as it does in Final Draft)
const SP_BEFORE = { heading: 2, action: 1, character: 1, paren: 0, dialogue: 0, transition: 1, shot: 2 };
// Enter at the end of a line with words: what the next line is
const SP_AFTER = { heading: 'action', action: 'action', character: 'dialogue', paren: 'dialogue', dialogue: 'action', transition: 'heading', shot: 'action' };
// Enter on an empty line: what that line becomes. Enter twice after a
// speech brings in the next speaker
const SP_EMPTY = { action: 'character', character: 'action', dialogue: 'action', paren: 'dialogue', heading: 'action', transition: 'action', shot: 'action' };
// Tab steps through these (in a speech, Tab trades dialogue and parenthetical)
const SP_CYCLE = ['action', 'character', 'transition', 'heading', 'shot'];
const SP_LINES_PER_PAGE = 54;
const SP_HEAD_RE = /^(?:INT\.?\/EXT|INT\/EXT|I\/E|INT|EXT|EST)(?:\.|\s)/i;
const SP_HEAD_PARSE = /^(INT\.?\/EXT\.?|INT\/EXT\.?|I\/E\.?|INT\.?|EXT\.?|EST\.?)\s+(.*)$/i;
const SP_TIMES = ['DAY', 'NIGHT', 'CONTINUOUS', 'LATER', 'MORNING', 'EVENING', 'DAWN', 'DUSK', 'MOMENTS LATER', 'SAME TIME'];
const SP_TRANSITIONS = ['CUT TO:', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:', 'JUMP CUT TO:', 'FADE OUT.', 'FADE TO BLACK.', 'INTERCUT WITH:'];
const SP_EXTENSIONS = ['V.O.)', 'O.S.)', 'O.C.)', "CONT'D)"];

// a speaker's name without (V.O.) and the like
function spBareName(t) {
  return String(t || '').replace(/\s*\^\s*$/, '').replace(/\s*\([^)]*\)?\s*$/, '').trim().toUpperCase();
}
// Fountain's transition: capitals ending in TO:, or a fade out (the usual
// ones also as typed, "Cut to:", since NEO capitalizes a line's first word)
function spLooksLikeTransition(t) {
  const s = String(t || '').trim();
  if (SP_TRANSITIONS.includes(s.toUpperCase())) return true;
  return !!s && s === s.toUpperCase() && /\p{Lu}/u.test(s) && (/TO:$/.test(s) || s === 'FADE OUT.' || s === 'FADE TO BLACK.');
}
// Fountain's character: a short line all in capitals (an extension in
// parentheses may follow), not a sentence
function spLooksLikeCharacter(t) {
  const s = String(t || '').trim();
  if (!s || s.length > 38 || s !== s.toUpperCase() || !/\p{Lu}/u.test(s)) return false;
  const name = s.replace(/\s*\^\s*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim();
  if (!name || !/\p{Lu}/u.test(name)) return false;
  if (/[.!?,;:—–-]$/.test(name) && !/^(MR|MRS|MS|DR|ST|JR|SR)\.$/.test(name.split(/\s+/).pop())) return false;
  return name.split(/\s+/).length <= 4;
}
function spParseHeading(t) {
  const m = String(t || '').match(SP_HEAD_PARSE);
  if (!m) return null;
  const rest = m[2];
  const d = rest.search(/\s+[-–—]\s*/);
  if (d < 0) return { prefix: m[1], loc: rest, time: null };
  return { prefix: m[1], loc: rest.slice(0, d).trim(), time: rest.slice(d).replace(/^\s+[-–—]\s*/, '') };
}
// the rest of the first word in the pool that starts with what's typed
function spComplete(partial, pool) {
  if (!partial) return '';
  const p = partial.toUpperCase();
  // a name or place already used just as typed is what's meant (KIM, not KIMBERLY)
  if (pool.includes(p)) return '';
  for (const w of pool) if (w.startsWith(p) && w.length > p.length) return w.slice(p.length);
  return '';
}
// who speaks most, then most lately
function spNames(lines, skip) {
  const seen = new Map();
  lines.forEach((l, i) => {
    if (l.type !== 'character' || i === skip) return;
    const n = spBareName(l.text);
    if (!n) return;
    const e = seen.get(n) || { name: n, count: 0, last: 0 };
    e.count++; e.last = i;
    seen.set(n, e);
  });
  return [...seen.values()].sort((a, b) => b.count - a.count || b.last - a.last).map((e) => e.name);
}
function spLocations(lines, skip) {
  const out = [];
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].type !== 'heading' || i === skip) continue;
    const h = spParseHeading(lines[i].text);
    const loc = h && h.loc.trim().toUpperCase();
    if (loc && !out.includes(loc)) out.push(loc);
  }
  return out;
}
function spTimesUsed(lines, skip) {
  const out = [];
  lines.forEach((l, i) => {
    if (l.type !== 'heading' || i === skip) return;
    const h = spParseHeading(l.text);
    const time = h && h.time && h.time.trim().toUpperCase();
    if (time && !out.includes(time)) out.push(time);
  });
  return out;
}
// the one being answered: the speaker before the last one, in this scene
function spPartner(lines, i) {
  const order = [];
  for (let j = i - 1; j >= 0; j--) {
    const l = lines[j];
    if (l.type === 'heading') break;
    if (l.type !== 'character') continue;
    const n = spBareName(l.text);
    if (n && !order.includes(n)) order.push(n);
    if (order.length === 2) break;
  }
  return order.length === 2 ? order[1] : '';
}
// The gray suggestion for line i, the caret at its end: only names and
// places this script already has (and the usual times and transitions)
function spGhost(lines, i) {
  const l = lines[i];
  const text = l.text;
  if (l.type === 'character') {
    const open = text.lastIndexOf('(');
    if (open >= 0 && text.indexOf(')', open) < 0) return spComplete(text.slice(open + 1), SP_EXTENSIONS);
    if (!text.trim()) return spPartner(lines, i);
    return spComplete(text.trimStart(), spNames(lines, i));
  }
  if (l.type === 'heading') {
    const h = spParseHeading(text);
    if (!h) return '';
    if (h.time === null) return /\s$/.test(text) ? '' : spComplete(h.loc, spLocations(lines, i));
    return spComplete(h.time, [...spTimesUsed(lines, i), ...SP_TIMES]);
  }
  if (l.type === 'transition') {
    const used = lines.filter((x, j) => x.type === 'transition' && j !== i && x.text.trim()).map((x) => x.text.trim().toUpperCase());
    return spComplete(text.trimStart(), [...used, ...SP_TRANSITIONS]);
  }
  return '';
}
// (CONT'D): the same voice again, after action, in the same scene
function spContd(lines, i) {
  const me = spBareName(lines[i].text);
  if (!me || /\(/.test(lines[i].text)) return false;
  let between = false;
  for (let j = i - 1; j >= 0; j--) {
    const l = lines[j];
    if (l.type === 'heading' || l.type === 'transition') return false;
    if (l.type === 'character') return between && spBareName(l.text) === me;
    if ((l.type === 'action' || l.type === 'shot') && l.text.trim()) between = true;
  }
  return false;
}
// The pages, as they print: 54 lines, a speech kept with its speaker, a
// scene heading never alone at the foot of a page. items: [{ type, lines }]
// (lines = how many lines the element takes). For each item: the page it's
// on, the blank lines above it, and, where a page starts, how many lines
// were left blank at the foot of the page before (fill).
function spPaginate(items, perPage = SP_LINES_PER_PAGE) {
  const n = items.length;
  const blocks = [];
  for (let i = 0; i < n;) {
    let j = i + 1;
    if (items[i].type === 'character') while (j < n && (items[j].type === 'dialogue' || items[j].type === 'paren')) j++;
    blocks.push([i, j]);
    i = j;
  }
  const at = items.map(() => ({ page: 1, before: 0, brk: false, fill: 0 }));
  let page = 1;
  let used = 0;
  const above = (x, top) => (top || x === 0 ? 0 : SP_BEFORE[items[x].type] || 0);
  const height = (b, top) => {
    let h = 0;
    for (let x = b[0]; x < b[1]; x++) h += items[x].lines + above(x, top && x === b[0]);
    return h;
  };
  blocks.forEach((b, bi) => {
    let need = height(b, used === 0);
    const next = blocks[bi + 1];
    if (items[b[0]].type === 'heading' && next) need += items[next[0]].lines + above(next[0], false);
    if (used > 0 && used + need > perPage) {
      at[b[0]].brk = true;
      at[b[0]].fill = Math.max(0, perPage - used);
      page++;
      used = 0;
    }
    for (let x = b[0]; x < b[1]; x++) {
      at[x].before = above(x, used === 0 && x === b[0]);
      at[x].page = page;
      used += at[x].before + items[x].lines;
      // longer than a page: it runs on over the next one
      while (used > perPage) { used -= perPage; page++; }
    }
  });
  return { at, pages: page, used };
}
// a length in eighths of a page, the way a production counts it
function spEighths(lines, perPage = SP_LINES_PER_PAGE) {
  return Math.max(1, Math.round(lines / perPage * 8));
}
// Fountain text from the script's lines ([{type, text}], text already in
// Fountain's emphasis). A line that Fountain would read as something else
// is forced: ! for action, . for a heading, > for a transition, @ for a name.
function spToFountain(lines, title = {}) {
  const out = [];
  const keys = [['Title', title.title], ['Credit', title.credit], ['Author', title.author], ['Draft date', title.draft], ['Contact', title.contact]];
  for (const [k, v] of keys) {
    const s = String(v || '').trim();
    if (!s) continue;
    const rows = s.split(/\n/).map((r) => r.trim()).filter(Boolean);
    if (rows.length === 1) out.push(`${k}: ${rows[0]}`);
    else out.push(`${k}:`, ...rows.map((r) => '    ' + r));
  }
  if (out.length) out.push('');
  let inSpeech = false;
  const gap = () => { if (out.length && out[out.length - 1] !== '') out.push(''); };
  for (const l of lines) {
    const text = String(l.text || '').trim();
    if (!text) { inSpeech = false; continue; }
    const caps = text.toUpperCase();
    if ((l.type === 'dialogue' || l.type === 'paren') && inSpeech) {
      out.push(l.type === 'paren' && !/^\(/.test(text) ? `(${text})` : text);
      continue;
    }
    inSpeech = false;
    gap();
    if (l.type === 'heading') out.push(SP_HEAD_RE.test(caps) ? caps : '.' + caps);
    else if (l.type === 'character') {
      out.push(/\p{Ll}/u.test(caps) ? '@' + text : caps);
      inSpeech = true;
    } else if (l.type === 'transition') out.push(/TO:$/.test(caps) ? caps : '>' + caps);
    else if (l.type === 'shot') out.push('!' + caps);
    else {
      // action (or a speech with no speaker): forced when it would read as
      // a heading, a name, a transition or a Fountain mark
      const misread = SP_HEAD_RE.test(text) || (text === caps && /\p{Lu}/u.test(text)) || /^[.!@~>#=[]/.test(text);
      out.push(misread ? '!' + text : text);
    }
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out.join('\n') + '\n';
}
// Fountain (or a plain-text script) into lines: [{type, text}], the text
// keeping Fountain's *emphasis* for the caller to set. The title page is
// left out; notes, boneyard, sections, synopses and page breaks too.
// A speaker's (CONT'D) is NEO's to draw: one typed in, or carried in from
// Final Draft or a PDF, comes off the name
const spDropContd = (t) => String(t || '').replace(/\s*\(\s*cont(?:['’]?d|inued)\s*\)\s*$/i, '').trim();
// lines a PDF's text carries that aren't the script: page numbers, (MORE),
// CONTINUED
const SP_PDF_NOISE = /^(?:\d{1,3}[A-Z]?\.|\(MORE\)|\(?CONTINUED\)?:?|CONTINUED:)$/i;
function spFromFountain(src) {
  let text = String(src || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  text = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
  let rows = text.split('\n');
  if (SP_TITLE_KEY.test(rows[0] || '')) {
    let k = 0;
    while (k < rows.length && rows[k].trim() !== '') k++;
    rows = rows.slice(k);
  }
  const blank = (k) => k < 0 || k >= rows.length || rows[k].trim() === '';
  const out = [];
  let inSpeech = false;
  // a block's lines run on into one paragraph: Fountain keeps a writer's
  // line breaks, and a script copied from a PDF is broken at every line
  let joinable = false;
  const push = (type, t, join = false) => {
    const last = out[out.length - 1];
    if (join && joinable && last && last.type === type) last.text += ' ' + t;
    else out.push({ type, text: t });
    joinable = join;
  };
  for (let k = 0; k < rows.length; k++) {
    const s = rows[k].trim();
    if (!s) { inSpeech = false; joinable = false; continue; }
    if (/^={3,}$/.test(s) || /^#/.test(s) || /^=[^=]/.test(s) || s === '=' || SP_PDF_NOISE.test(s)) continue;
    if (inSpeech) {
      if (/^\(.*\)$/.test(s)) push('paren', s);
      else push('dialogue', s.replace(/^~\s*/, ''), true);
      continue;
    }
    if (s.startsWith('!')) { push('action', s.slice(1).trim(), true); continue; }
    if (/^\.[^.\s]/.test(s)) { push('heading', s.slice(1).trim().replace(/\s*#[^#\s]+#$/, '')); continue; }
    if (s.startsWith('>') && s.endsWith('<')) { push('action', s.slice(1, -1).trim()); continue; }
    if (s.startsWith('>')) { push('transition', s.slice(1).trim()); continue; }
    if (s.startsWith('~')) { push('action', s.slice(1).trim()); continue; }
    if (s.startsWith('@')) { push('character', spDropContd(s.slice(1).trim().replace(/\s*\^$/, ''))); inSpeech = true; continue; }
    if (SP_HEAD_RE.test(s) && blank(k - 1)) { push('heading', s.replace(/\s*#[^#\s]+#$/, '')); continue; }
    if (spLooksLikeTransition(s) && blank(k - 1) && blank(k + 1)) { push('transition', s); continue; }
    if (blank(k - 1) && !blank(k + 1) && spLooksLikeCharacter(s.replace(/\s*\^$/, ''))) {
      push('character', spDropContd(s.replace(/\s*\^$/, '')));
      inSpeech = true;
      continue;
    }
    push('action', s, true);
  }
  return out;
}
// Fountain's title page: Title, Credit, Author, Draft date, Contact (a value
// on its own line or on indented lines below its key). Markup comes off.
const SP_TITLE_KEY = /^(title|credit|author|authors|source|draft date|date|contact|copyright|notes|revision)\s*:/i;
function spFountainTitle(src) {
  const rows = String(src || '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ').split('\n');
  const out = {};
  if (!SP_TITLE_KEY.test(rows[0] || '')) return out;
  const vals = {};
  let key = null;
  for (const row of rows) {
    if (!row.trim()) break;
    const m = !/^\s/.test(row) && row.match(/^([^:]+):\s*(.*)$/);
    if (m) { key = m[1].trim().toLowerCase(); vals[key] = m[2].trim() ? [m[2].trim()] : []; } else if (key) vals[key].push(row.trim());
  }
  const plain = (a) => (a || []).map((r) => spRunsFromFountain(r.replace(/^>\s*|\s*<$/g, '')).map((x) => x.text).join('').trim()).filter(Boolean);
  if (vals.title) out.title = plain(vals.title).join(' ');
  if (vals.credit) out.credit = plain(vals.credit).join(' ');
  if (vals.author || vals.authors) out.author = plain(vals.author || vals.authors).join(' & ');
  if (vals['draft date'] || vals.date) out.draft = plain(vals['draft date'] || vals.date).join('\n');
  if (vals.contact) out.contact = plain(vals.contact).join('\n');
  return out;
}
// Fountain's emphasis as runs: *italic*, **bold**, ***both***, _underline_,
// with a backslash keeping a mark as itself
function spRunsFromFountain(t) {
  const runs = [];
  const st = { b: false, i: false, u: false };
  let buf = '';
  const flush = () => { if (buf) runs.push({ text: buf, b: st.b, i: st.i, u: st.u, s: false }); buf = ''; };
  // a mark only counts where a closing one follows on the line
  const closes = (from, mark) => t.indexOf(mark, from) > -1;
  for (let k = 0; k < t.length; k++) {
    const c = t[k];
    if (c === '\\' && k + 1 < t.length) { buf += t[++k]; continue; }
    if (c === '*') {
      let n = 1;
      while (t[k + n] === '*' && n < 3) n++;
      const on = n === 3 ? st.b && st.i : n === 2 ? st.b : st.i;
      if (on || closes(k + n, '*'.repeat(n))) {
        flush();
        if (n === 3) { st.b = !on; st.i = !on; } else if (n === 2) st.b = !st.b; else st.i = !st.i;
        k += n - 1;
        continue;
      }
    }
    if (c === '_' && (st.u || closes(k + 1, '_'))) { flush(); st.u = !st.u; continue; }
    buf += c;
  }
  flush();
  return runs;
}
// Final Draft's .fdx is XML: a <Paragraph Type="…"> per line, its words in
// <Text Style="Bold+Italic"> runs. Read without a parser, so the same code
// runs in the tests. Dual dialogue comes in as two speeches in a row.
const SP_FDX_TYPES = {
  'scene heading': 'heading', action: 'action', character: 'character', parenthetical: 'paren',
  dialogue: 'dialogue', transition: 'transition', shot: 'shot', lyrics: 'dialogue', general: 'action'
};
const spXmlText = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const spXmlAttr = (tag, name) => { const m = tag.match(new RegExp('\\b' + name + '="([^"]*)"')); return m ? spXmlText(m[1]) : ''; };
function spFdxParas(xml) {
  xml = xml.replace(/<Paragraph\b[^>]*>\s*<DualDialogue>([\s\S]*?)<\/DualDialogue>\s*<\/Paragraph>/g, '$1');
  const out = [];
  for (const m of xml.matchAll(/<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g)) {
    const runs = [];
    for (const r of m[2].matchAll(/<Text\b([^>]*?)(?:\/>|>([\s\S]*?)<\/Text>)/g)) {
      const text = spXmlText(r[2] || '').replace(/\s*\n\s*/g, ' ');
      if (!text) continue;
      const style = spXmlAttr(r[1], 'Style').toLowerCase().split('+');
      runs.push({ text, b: style.includes('bold'), i: style.includes('italic'), u: style.includes('underline'), s: style.includes('strikeout') });
    }
    out.push({ type: spXmlAttr(m[1], 'Type'), align: spXmlAttr(m[1], 'Alignment').toLowerCase(), runs });
  }
  return out;
}
function spFromFdx(xml) {
  xml = String(xml || '');
  const body = (xml.match(/<Content>([\s\S]*?)<\/Content>/) || [])[1] || '';
  const lines = [];
  for (const p of spFdxParas(body)) {
    const text = p.runs.map((r) => r.text).join('').trim();
    if (!text) continue;
    const type = SP_FDX_TYPES[p.type.toLowerCase()] || 'action';
    let runs = p.runs;
    if (type === 'character') runs = [{ text: spDropContd(text), b: false, i: false, u: false, s: false }];
    if (type === 'paren' && !text.startsWith('(')) runs = [{ text: '(' + text + ')', b: false, i: false, u: false, s: false }];
    lines.push({ type, runs });
  }
  // the title page: the centered lines are the title, the credit and the
  // writer; lines set left, below them, the contact; set right, the draft
  const title = {};
  const page = (xml.match(/<TitlePage>[\s\S]*?<Content>([\s\S]*?)<\/Content>/) || [])[1] || '';
  const tp = spFdxParas(page).map((p) => ({ align: p.align, text: p.runs.map((r) => r.text).join('').trim() })).filter((p) => p.text);
  const centered = tp.filter((p) => p.align === 'center').map((p) => p.text);
  if (centered.length) {
    title.title = centered[0];
    const c = centered.findIndex((x, k) => k > 0 && /^(?:written by|screenplay by|teleplay by|story by|by)$/i.test(x));
    if (c > 0) { title.credit = centered[c]; if (centered[c + 1]) title.author = centered[c + 1]; } else if (centered[1]) title.author = centered[1];
  }
  const left = tp.filter((p) => p.align !== 'center' && p.align !== 'right').map((p) => p.text);
  const right = tp.filter((p) => p.align === 'right').map((p) => p.text);
  if (left.length) title.contact = left.join('\n');
  if (right.length) title.draft = right.join('\n');
  return { lines, title };
}
// …and back out: lines [{type, runs}] (runs as paraRuns gives them)
function spToFdx(lines, title = {}) {
  const NAMES = { heading: 'Scene Heading', action: 'Action', character: 'Character', paren: 'Parenthetical', dialogue: 'Dialogue', transition: 'Transition', shot: 'Shot' };
  const CAPS = ['heading', 'character', 'transition', 'shot'];
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const textEl = (r, caps) => {
    const style = [r.b && 'Bold', r.i && 'Italic', r.u && 'Underline', r.s && 'Strikeout'].filter(Boolean).join('+');
    return `      <Text${style ? ` Style="${style}"` : ''}>${esc(caps ? r.text.toUpperCase() : r.text)}</Text>\n`;
  };
  let out = '<?xml version="1.0" encoding="UTF-8" standalone="no" ?>\n<FinalDraft DocumentType="Script" Template="No" Version="1">\n\n  <Content>\n';
  for (const l of lines) {
    const runs = (l.runs || []).filter((r) => r.text);
    if (!runs.length) continue;
    out += `    <Paragraph Type="${NAMES[l.type] || 'Action'}">\n${runs.map((r) => textEl(r, CAPS.includes(l.type))).join('')}    </Paragraph>\n`;
  }
  out += '  </Content>\n';
  const para = (text, align) => `    <Paragraph Alignment="${align}">\n      <Text>${esc(text)}</Text>\n    </Paragraph>\n`;
  const gap = (n) => '    <Paragraph Alignment="Center">\n      <Text></Text>\n    </Paragraph>\n'.repeat(n);
  const tp = [];
  if (title.title) tp.push(gap(18), para(String(title.title).toUpperCase(), 'Center'));
  if (title.credit) tp.push(gap(1), para(title.credit, 'Center'));
  if (title.author) tp.push(gap(1), para(title.author, 'Center'));
  const rows = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (rows(title.draft).length || rows(title.contact).length) tp.push(gap(16));
  for (const r of rows(title.draft)) tp.push(para(r, 'Right'));
  for (const r of rows(title.contact)) tp.push(para(r, 'Left'));
  if (tp.length) out += '  <TitlePage>\n    <Content>\n' + tp.join('').replace(/^ {4}/gm, '      ') + '    </Content>\n  </TitlePage>\n';
  return out + '</FinalDraft>\n';
}
// ---- end of screenplay rules ----

const isScript = (meta = book) => !!meta && meta.format === 'screenplay';
const SP_CLASSES = SP_TYPES.filter((x) => x !== 'action').map((x) => 'sp-' + x);
const SP_NAMES = {
  heading: tk('Scene Heading'), action: tk('Action'), character: tk('Character'), paren: tk('Parenthetical'),
  dialogue: tk('Dialogue'), transition: tk('Transition'), shot: tk('Shot')
};
const spKey = (n) => K('⌘' + n, 'Ctrl+' + n);
// the screen's own marks on a script's lines, never saved
const SP_SCREEN_ATTRS = ['data-pg', 'data-fill', 'data-contd', 'data-ghost', 'data-ghost-empty'];
// characters NEO guessed from a line in capitals, and headings it made of
// INT./EXT.: either goes back to action when the guess turns out wrong
const spGuessed = new WeakSet();
const spDismissed = new WeakMap(); // a line → its text when Esc sent its suggestion away

function spType(p) {
  if (!p || !p.classList) return 'action';
  for (const x of SP_TYPES) if (x !== 'action' && p.classList.contains('sp-' + x)) return x;
  return 'action';
}
function spSetClass(p, type) {
  p.classList.remove(...SP_CLASSES, 'poetry', 'flush', 'scene-break', 'ghost');
  if (type !== 'action') p.classList.add('sp-' + type);
  if (!p.className) p.removeAttribute('class');
  spGuessed.delete(p);
}
function spCleanMarks(p) {
  for (const a of SP_SCREEN_ATTRS) if (p.hasAttribute(a)) p.removeAttribute(a);
}
// a page break's fill, as a custom property the stylesheet can read
(() => {
  const st = document.createElement('style');
  let css = '';
  for (let n = 0; n <= SP_LINES_PER_PAGE; n++) css += `.sp-geom>p[data-fill="${n}"]{--fill:${n}}`;
  st.textContent = css;
  document.head.appendChild(st);
})();

// the bodies and the lines of the open script, top to bottom
function spBodies() { return $$('#chapters .chapter-body.script-body'); }
function spParas() {
  const out = [];
  for (const b of spBodies()) for (const p of b.children) if (p.tagName === 'P') out.push(p);
  return out;
}
const spLinesOf = (ps) => ps.map((p) => ({ type: spType(p), text: p.textContent }));
// the line the caret is in (or was, before a click in the pane took focus)
let spLastPara = null;
function spCaretPara() {
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    let el = sel.anchorNode;
    if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
    const p = el && el.closest ? el.closest('p') : null;
    if (p && p.parentElement && p.parentElement.classList.contains('script-body')) return p;
  }
  return spLastPara && spLastPara.isConnected ? spLastPara : null;
}
const spBodyOf = (p) => p && p.closest('.chapter-body');
const spChapterOf = (p) => { const s = p && p.closest('.chapter'); return s ? s.dataset.id : null; };
function spCaretAtEnd(p) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed || !p.contains(sel.anchorNode) && sel.anchorNode !== p) return false;
  const r = document.createRange();
  r.selectNodeContents(p);
  try { r.setStart(sel.anchorNode, sel.anchorOffset); } catch { return false; }
  return r.toString().length === 0;
}
function spCaretAtStart(p) {
  const sel = window.getSelection();
  if (!sel.rangeCount || !sel.isCollapsed) return false;
  const r = document.createRange();
  r.selectNodeContents(p);
  try { r.setEnd(sel.anchorNode, sel.anchorOffset); } catch { return false; }
  return r.toString().length === 0;
}
function spCaretToEnd(p) {
  const w = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  let last = null;
  for (let n = w.nextNode(); n; n = w.nextNode()) last = n;
  if (last) placeCaret(last, last.length); else placeCaret(p, 0);
}
// typed in, so ⌘Z takes it back like any typing
function spInsert(text) { document.execCommand('insertText', false, text); }
function spReplaceAll(p, text) {
  selectChars(p, 0, p.textContent.length);
  if (text) spInsert(text); else document.execCommand('delete');
  if (!p.textContent && !p.querySelector('br')) p.appendChild(document.createElement('br'));
}

// One element for a line: from the pane, the Format menu, ⌘1–7 or Tab.
// A parenthetical gets its parentheses, and loses them when it stops being one.
function spSetType(p, type) {
  const was = spType(p);
  if (!p || was === type) return;
  const text = p.textContent;
  if (was === 'paren' && /^\s*\(/.test(text)) {
    const inner = text.trim().replace(/^\(/, '').replace(/\)$/, '');
    spReplaceAll(p, inner);
  }
  spSetClass(p, type);
  if (type === 'paren') {
    const inner = p.textContent.trim().replace(/^\(/, '').replace(/\)$/, '');
    spReplaceAll(p, '(' + inner + ')');
    const pos = p.textContent.length - 1;
    selectChars(p, pos, pos);
  } else {
    spCaretToEnd(p);
  }
}
function spAfterChange(p) {
  const body = spBodyOf(p);
  if (!body) return;
  spLastPara = p;
  syncChapter(body, spChapterOf(p));
  spSchedule();
  spRefreshGhost();
  spShowElement();
}
// ⌘1–7, a click in the pane, the Format menu
function spSetElement(type) {
  const p = spCaretPara();
  if (!p || !SP_TYPES.includes(type)) return;
  const body = spBodyOf(p);
  if (document.activeElement !== body) {
    body.focus({ preventScroll: true });
    spCaretToEnd(p);
  }
  if (spType(p) !== type) spSetType(p, type);
  spAfterChange(p);
}

// The keys of a script. True when the key was handled here.
function scriptKey(e, body) {
  const cmd = IS_POCKET ? (e.metaKey !== e.ctrlKey) : (IS_MAC ? e.metaKey : e.ctrlKey);
  if (cmd && !e.shiftKey && !e.altKey && /^Digit[1-7]$/.test(e.code || '')) {
    e.preventDefault();
    spSetElement(SP_TYPES[Number(e.code.slice(5)) - 1]);
    return true;
  }
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  const sel = window.getSelection();
  if (!sel.rangeCount) return false;
  if (e.key === 'Enter') {
    e.preventDefault();
    if (!sel.isCollapsed) document.execCommand('delete');
    const p = caretBlock(body);
    if (p) spEnter(p, body);
    return true;
  }
  if (!sel.isCollapsed) return false;
  const p = caretBlock(body);
  if (!p) return false;
  const ghost = p.getAttribute('data-ghost') || '';
  if (e.key === 'Escape' && ghost) {
    // not this one: gone until the line changes
    e.preventDefault();
    e.stopPropagation();
    spDismissed.set(p, p.textContent);
    spRefreshGhost();
    return true;
  }
  if (e.key === 'Tab') {
    e.preventDefault();
    spTab(p, e.shiftKey, ghost && !e.shiftKey && spCaretAtEnd(p) ? ghost : '');
    return true;
  }
  if (e.key === 'ArrowRight' && !e.shiftKey && ghost && spCaretAtEnd(p)) {
    e.preventDefault();
    spInsert(ghost);
    spAfterChange(p);
    return true;
  }
  if (e.key === 'Backspace' && spCaretAtStart(p)) {
    const prev = p.previousElementSibling;
    // an empty speech under a name NEO guessed: it was action after all
    if (!p.textContent.trim() && spType(p) === 'dialogue' && prev && spType(prev) === 'character' && spGuessed.has(prev)) {
      e.preventDefault();
      spSetClass(prev, 'action');
      p.remove();
      spCaretToEnd(prev);
      spAfterChange(prev);
      return true;
    }
  }
  return false;
}

function spEnter(p, body) {
  let type = spType(p);
  // Enter takes the gray suggestion, as in Final Draft: on an empty name
  // line the one being answered, on a half-typed one the rest of the name
  // (or place, time, transition). A name already used as typed gets no
  // suggestion (spComplete), and Esc sends one away.
  if (p.getAttribute('data-ghost') && spCaretAtEnd(p)) spInsert(p.getAttribute('data-ghost'));
  const text = p.textContent;
  enterRun = 0;
  // (an empty parenthetical is its parentheses)
  if (!(type === 'paren' ? text.replace(/[()]/g, '') : text).trim()) {
    // Enter on an empty line changes what it is
    if (text) spReplaceAll(p, '');
    spSetClass(p, SP_EMPTY[type]);
    placeCaret(p, 0);
    spAfterChange(p);
    return;
  }
  // in a parenthetical, the caret before its closing ) is at its end
  if (type === 'paren') {
    const sel = window.getSelection();
    const r = document.createRange();
    r.selectNodeContents(p);
    try { r.setStart(sel.anchorNode, sel.anchorOffset); } catch { /* where it is */ }
    if (r.toString().trim() === ')') spCaretToEnd(p);
  }
  if (spCaretAtStart(p)) {
    // at the start of a line with words: an empty line opens above it, a
    // line of the speech inside a speech, action anywhere else
    document.execCommand('insertParagraph');
    const above = p.previousElementSibling;
    if (above && above.tagName === 'P') { spSetClass(above, type === 'dialogue' || type === 'paren' ? 'dialogue' : 'action'); spCleanMarks(above); }
    spAfterChange(p);
    return;
  }
  if (!spCaretAtEnd(p)) {
    // mid-line: the rest becomes the next line
    document.execCommand('insertParagraph');
    const next = caretBlock(body);
    if (next && next !== p) {
      spCleanMarks(next);
      spSetClass(next, type === 'dialogue' || type === 'action' ? type : SP_AFTER[type]);
      spSetClass(p, type); // the engine may have moved the class along
      spAfterChange(next);
    }
    return;
  }
  // at the end: settle what this line is, then the next one
  if (type === 'action') {
    if (spLooksLikeTransition(text)) { spSetClass(p, 'transition'); type = 'transition'; }
    else if (spLooksLikeCharacter(text)) { spSetClass(p, 'character'); spGuessed.add(p); type = 'character'; }
  }
  if (type === 'paren' && !/\)\s*$/.test(text)) spInsert(')');
  const guessed = spGuessed.has(p);
  document.execCommand('insertParagraph');
  const next = caretBlock(body);
  if (next && next !== p) {
    spCleanMarks(next);
    spSetClass(next, SP_AFTER[type]);
    if (guessed) spGuessed.add(p);
    placeCaret(next, 0);
    spAfterChange(next);
  }
}

function spTab(p, back, ghost) {
  if (ghost) { spInsert(ghost); spAfterChange(p); return; }
  const type = spType(p);
  const text = p.textContent;
  // INT, EXT and the like, then Tab: a scene heading, with its period
  const prefix = /^(INT|EXT|EST|I\/E|INT\.?\/EXT)\.?$/i.test(text.trim());
  if ((type === 'heading' || (type === 'action' && prefix)) && !back) {
    const t = text.replace(/\s+$/, '');
    const h = spParseHeading(text);
    if (prefix) {
      spReplaceAll(p, t.replace(/\.$/, '') + '. ');
      spSetClass(p, 'heading');
      spGuessed.add(p);
      spCaretToEnd(p);
      spAfterChange(p);
      return;
    }
    if (h && h.loc && h.time === null) {
      spReplaceAll(p, t + ' - ');
      spAfterChange(p);
      return;
    }
  }
  let to;
  if (type === 'dialogue' || type === 'paren') to = type === 'dialogue' ? 'paren' : 'dialogue';
  else {
    const k = SP_CYCLE.indexOf(type);
    to = SP_CYCLE[(k + (back ? -1 : 1) + SP_CYCLE.length) % SP_CYCLE.length];
  }
  spSetType(p, to);
  spAfterChange(p);
}

// As the writer types: INT. or EXT. makes a heading, an opening "(" in a
// speech makes a parenthetical
function scriptInput(body) {
  const p = caretBlock(body);
  if (p) {
    const type = spType(p);
    const text = p.textContent;
    if (type === 'action' && SP_HEAD_RE.test(text)) { spSetClass(p, 'heading'); spGuessed.add(p); }
    else if (type === 'heading' && spGuessed.has(p) && !SP_HEAD_RE.test(text)) spSetClass(p, 'action');
    else if (type === 'dialogue' && text.startsWith('(')) spSetClass(p, 'paren');
    // "(" opening the line after a speech: a parenthetical inside it, and
    // Enter after it goes back to the speech
    else if (type === 'action' && text.startsWith('(') && p.previousElementSibling &&
      ['dialogue', 'paren'].includes(spType(p.previousElementSibling))) spSetClass(p, 'paren');
    spLastPara = p;
  }
  spSchedule();
  spRefreshGhost();
  spShowElement();
}

// ---- the gray suggestion at the caret ----
function spRefreshGhost() {
  const p = spCaretPara();
  let ghost = '';
  if (p && document.activeElement === spBodyOf(p) && ['character', 'heading', 'transition'].includes(spType(p)) && spCaretAtEnd(p) && spDismissed.get(p) !== p.textContent) {
    const ps = spParas();
    ghost = spGhost(spLinesOf(ps), ps.indexOf(p));
  }
  for (const q of $$('#chapters p[data-ghost]')) {
    if (q !== p || !ghost) { q.removeAttribute('data-ghost'); q.removeAttribute('data-ghost-empty'); }
  }
  if (p && ghost) {
    if (p.getAttribute('data-ghost') !== ghost) p.setAttribute('data-ghost', ghost);
    p.toggleAttribute('data-ghost-empty', !p.textContent);
  }
}

// ---- pages ----
let spLayout = { ps: [], at: [], pages: 1, used: 0, scenes: [] };
let spTimer = null;
const SP_NARROW = window.matchMedia ? window.matchMedia('(max-width: 599px)') : { matches: false };
function spSchedule(ms = 140) {
  clearTimeout(spTimer);
  spTimer = setTimeout(spRepaginate, ms);
}
// How many lines each element takes on the printed page. Read from the
// page itself when it is showing at its true shape; otherwise laid out in
// a measuring room off screen (on a phone, from another tab, for the PDF).
function spMeasure(ps, live) {
  if (live && ps.length) {
    const lh = parseFloat(getComputedStyle(ps[0]).lineHeight) || 0;
    const first = ps[0].getBoundingClientRect().height;
    if (lh > 0 && first > 0) return ps.map((p) => Math.max(1, Math.round(p.getBoundingClientRect().height / lh)));
  }
  let room = $('#sp-measure');
  if (!room) {
    room = document.createElement('div');
    room.id = 'sp-measure';
    room.className = 'sp-measure';
    room.setAttribute('aria-hidden', 'true');
    room.innerHTML = '<div class="sp-geom"></div>';
    document.body.appendChild(room);
  }
  const inner = room.firstElementChild;
  inner.innerHTML = '';
  const frag = document.createDocumentFragment();
  for (const p of ps) {
    const c = p.cloneNode(true);
    for (const a of ['data-pg', 'data-fill', 'data-ghost', 'data-ghost-empty']) c.removeAttribute(a);
    frag.appendChild(c);
  }
  inner.appendChild(frag);
  const out = [...inner.children].map((c) => Math.max(1, Math.round(c.getBoundingClientRect().height / 20)));
  inner.innerHTML = '';
  return out;
}
function spRepaginate() {
  clearTimeout(spTimer);
  if (!book || !isScript() || !$('#paper').classList.contains('script')) return;
  const ps = spParas();
  const lines = spLinesOf(ps);
  // (CONT'D) first: it makes a name's line longer
  ps.forEach((p, i) => {
    const c = lines[i].type === 'character' && spContd(lines, i);
    if (p.hasAttribute('data-contd') !== c) p.toggleAttribute('data-contd', c);
  });
  const narrow = $('#paper').classList.contains('narrow');
  const live = !narrow && currentTab === 'manuscript' && !$('#paper').hidden;
  const counts = spMeasure(ps, live);
  const pg = spPaginate(ps.map((p, i) => ({ type: lines[i].type, lines: counts[i] })));
  ps.forEach((p, i) => {
    const a = pg.at[i];
    const page = a.brk ? String(a.page) : null;
    if (p.getAttribute('data-pg') !== page) { if (page) p.setAttribute('data-pg', page); else p.removeAttribute('data-pg'); }
    const fill = a.brk ? String(Math.min(SP_LINES_PER_PAGE, a.fill)) : null;
    if (p.getAttribute('data-fill') !== fill) { if (fill) p.setAttribute('data-fill', fill); else p.removeAttribute('data-fill'); }
  });
  const chapters = $('#chapters');
  chapters.style.setProperty('--sp-last', String(Math.max(0, SP_LINES_PER_PAGE - pg.used)));
  if (narrow) chapters.style.setProperty('--sp-fullw', chapters.clientWidth + 'px');
  // the scenes: where each starts and how long it runs
  const scenes = [];
  ps.forEach((p, i) => {
    if (lines[i].type === 'heading') scenes.push({ p, i, slug: lines[i].text.trim(), lines: 0 });
    if (scenes.length) scenes[scenes.length - 1].lines += counts[i] + pg.at[i].before;
  });
  const before = spLayout.scenes.map((s) => s.slug + s.lines).join('|');
  spLayout = { ps, at: pg.at, pages: pg.pages, used: pg.used, scenes, counts };
  if (scenes.map((s) => s.slug + s.lines).join('|') !== before) scheduleNavRefresh();
  updateCounters();
}
// The script's length as a production reads it: pages in eighths, and a
// page a minute
function spLengthText() {
  const eighths = Math.max(1, Math.round(((spLayout.pages - 1) * SP_LINES_PER_PAGE + spLayout.used) / SP_LINES_PER_PAGE * 8));
  return { eighths, text: spEighthsText(eighths), minutes: Math.max(1, Math.round(eighths / 8)) };
}
function spEighthsText(e) {
  const whole = Math.floor(e / 8);
  const rem = e % 8;
  if (!whole) return rem + '/8';
  return rem ? `${fmtNum(whole)} ${rem}/8` : fmtNum(whole);
}
function spCurrentPage() {
  const p = spCaretPara();
  const i = p ? spLayout.ps.indexOf(p) : -1;
  if (i >= 0 && spLayout.at[i]) return spLayout.at[i].page;
  // no caret: the page at the top of the window
  const top = $('#paper-scroll').getBoundingClientRect().top + 40;
  let page = 1;
  spLayout.ps.forEach((q, k) => { if (q.isConnected && q.getBoundingClientRect().top < top && spLayout.at[k]) page = spLayout.at[k].page; });
  return page;
}
function spCurrentScene() {
  const p = spCaretPara();
  const i = p ? spLayout.ps.indexOf(p) : -1;
  let n = 0;
  spLayout.scenes.forEach((s, k) => { if (s.i <= i) n = k + 1; });
  return n;
}
let spPosScene = false; // the page counter, clicked, counts scenes instead
function spCounters() {
  const len = spLengthText();
  const wc = $('#word-counter');
  if (wordMode === 'book') setText(wc, t('{pages} pages · ~{n} min', { pages: len.text, n: len.minutes }));
  else setText(wc, t('{n} words', { n: bookWordCount() }));
  const pos = $('#pos-counter');
  setText(pos, spPosScene
    ? t('scene {n} of {total}', { n: spCurrentScene(), total: spLayout.scenes.length })
    : t('page {p} of {total}', { p: spCurrentPage(), total: spLayout.pages }));
}

// ---- the pane: the elements on top, the scenes beneath ----
let spShownElement = null;
function spShowElement() {
  const p = spCaretPara();
  const type = p ? spType(p) : null;
  if (type === spShownElement) return;
  spShownElement = type;
  for (const el of $$('#nav-list .sp-el')) el.classList.toggle('current', el.dataset.el === type);
  spReportState();
}
// the scene the caret is in, lit in the pane
function spHighlightScene() {
  const n = spCurrentScene();
  $$('#nav-list .sp-scene').forEach((el, k) => el.classList.toggle('current', k + 1 === n));
}
function spReportState() {
  if (!window.neo.scriptState) return;
  const on = !!book && isScript() && !$('#editor-view').hidden;
  window.neo.scriptState({ on, element: on ? spShownElement || 'action' : null });
}
function renderScriptNav() {
  const list = $('#nav-list');
  list.innerHTML = '';
  setText($('#nav-head span'), t('Elements'));
  SP_TYPES.forEach((type, k) => {
    const item = document.createElement('div');
    item.className = 'nav-item sp-el';
    item.dataset.el = type;
    item.innerHTML = '<div class="n-row"><span class="n-label"></span><span class="n-words"></span></div>';
    item.querySelector('.n-label').textContent = t(SP_NAMES[type]);
    item.querySelector('.n-words').textContent = spKey(k + 1);
    // the caret stays in the script while the pane is used
    item.addEventListener('mousedown', (e) => e.preventDefault());
    item.onclick = () => spSetElement(type);
    pressable(item, t(SP_NAMES[type]));
    list.appendChild(item);
  });
  spShownElement = null;
  spShowElement();
  const head = document.createElement('div');
  head.className = 'sp-scenes-head';
  head.textContent = t('Scenes');
  list.appendChild(head);
  const caret = spCaretPara();
  const at = caret ? spLayout.ps.indexOf(caret) : -1;
  spLayout.scenes.forEach((s, k) => {
    const item = document.createElement('div');
    item.className = 'nav-item sp-scene';
    const next = spLayout.scenes[k + 1];
    if (at >= s.i && (!next || at < next.i)) item.classList.add('current');
    item.innerHTML = '<div class="n-row"><span class="n-num"></span><span class="n-label"></span><span class="n-words"></span></div>';
    item.querySelector('.n-num').textContent = String(k + 1);
    item.querySelector('.n-label').textContent = s.slug || '…';
    item.querySelector('.n-words').textContent = spEighthsText(spEighths(s.lines));
    const row = item.querySelector('.n-row');
    row.draggable = true;
    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-neo-scene', String(k));
      item.classList.add('dragging');
      $('#nav-pane').classList.add('open');
    });
    row.addEventListener('dragend', () => {
      item.classList.remove('dragging');
      const ind = list.querySelector('.nav-drop-ind');
      if (ind) ind.remove();
    });
    item.onclick = () => {
      switchTab('manuscript');
      const p = s.p;
      if (!p.isConnected) return;
      const body = spBodyOf(p);
      body.focus({ preventScroll: true });
      spCaretToEnd(p);
      spLastPara = p;
      const sc = $('#paper-scroll');
      sc.scrollTop += p.getBoundingClientRect().top - sc.getBoundingClientRect().top - sc.clientHeight / 4;
      updateCounters();
      if (IS_POCKET && $('#nav-pane').dataset.pinned !== '1') $('#nav-pane').classList.remove('open');
    };
    pressable(row, [String(k + 1), s.slug].join(' '));
    list.appendChild(item);
  });
}
// a scene dragged in the pane: it moves, heading and all, to the gold line
(() => {
  const list = $('#nav-list');
  if (!list) return;
  list.addEventListener('dragover', (e) => {
    if (!e.dataTransfer.types.includes('application/x-neo-scene')) return;
    e.preventDefault();
    const ind = navDropInd();
    let placed = false;
    for (const it of list.querySelectorAll('.sp-scene:not(.dragging)')) {
      const r = it.getBoundingClientRect();
      if (e.clientY < r.top + r.height / 2) { list.insertBefore(ind, it); placed = true; break; }
    }
    if (!placed) list.appendChild(ind);
  });
  list.addEventListener('drop', (e) => {
    const from = e.dataTransfer.getData('application/x-neo-scene');
    if (from === '') return;
    e.preventDefault();
    const ind = list.querySelector('.nav-drop-ind');
    let to = spLayout.scenes.length;
    if (ind) {
      to = 0;
      for (const c of list.children) {
        if (c === ind) break;
        if (c.classList.contains('sp-scene')) to++;
      }
      ind.remove();
    }
    spMoveScene(Number(from), to);
  });
})();
// scene k, heading and all, to just before scene `to` (or the end)
function spMoveScene(k, to) {
  const scenes = spLayout.scenes;
  const s = scenes[k];
  if (!s || to === k || to === k + 1 || !s.p.isConnected) return;
  const body = spBodyOf(s.p);
  const nodes = [s.p];
  for (let n = s.p.nextElementSibling; n && !(n.tagName === 'P' && spType(n) === 'heading'); n = n.nextElementSibling) nodes.push(n);
  snapshotStructure('scene moved');
  const target = scenes[to] && scenes[to].p.isConnected ? scenes[to].p : null;
  const dest = target ? spBodyOf(target) : spBodies()[spBodies().length - 1];
  for (const n of nodes) {
    if (target) target.before(n); else dest.appendChild(n);
  }
  if (!body.querySelector('p')) body.innerHTML = '<p><br></p>';
  for (const b of new Set([body, dest])) syncChapter(b, b.closest('.chapter').dataset.id);
  breakRun++;
  spRepaginate();
  renderNav();
}

// ---- the title page: title, "Written by", the writer, and at the foot
// the contact (one for the whole library) and the draft ----
function spTitlePage(on) {
  const page = $('#title-page');
  for (const id of ['tp-credit', 'tp-contact', 'tp-draft']) {
    const old = document.getElementById(id);
    if (old) old.remove();
  }
  if (!on) return;
  const field = (id, ph, value, after, save) => {
    const el = document.createElement('div');
    el.id = id;
    el.contentEditable = 'true';
    el.spellcheck = false;
    el.setAttribute('role', 'textbox');
    el.setAttribute('aria-label', ph);
    el.dataset.ph = ph;
    el.textContent = value || '';
    if (after) after.after(el); else page.appendChild(el);
    el.addEventListener('input', () => save(el.innerText.replace(/\n+$/, '')));
    return el;
  };
  const credit = field('tp-credit', t('Written by'), book.credit === undefined ? t('Written by') : book.credit, $('#tp-subtitle'), (v) => { book.credit = v.trim(); scheduleMetaSave(); });
  credit.addEventListener('keydown', titleEnter);
  const contact = field('tp-contact', t('Contact'), library.scriptContact || '', null, (v) => {
    library.scriptContact = v;
    clearTimeout(spTitlePage.t);
    spTitlePage.t = setTimeout(() => writeLibrary(library), 800);
  });
  contact.setAttribute('aria-multiline', 'true');
  // Enter starts a new line of the block (a line break, not a paragraph)
  const lineBreak = (e) => { if (e.key === 'Enter') { e.preventDefault(); document.execCommand('insertLineBreak'); } };
  contact.addEventListener('keydown', lineBreak);
  const draft = field('tp-draft', t('Draft and date'), book.draft || '', null, (v) => { book.draft = v; scheduleMetaSave(); });
  draft.setAttribute('aria-multiline', 'true');
  draft.addEventListener('keydown', lineBreak);
}

// The look of the editor for a script, or back to a book's
function spEditorMode() {
  const on = isScript();
  const narrow = on && SP_NARROW.matches;
  $('#paper').classList.toggle('script', on);
  $('#paper').classList.toggle('narrow', narrow);
  $('#editor-view').classList.toggle('script-mode', on);
  $('#nav-pane').classList.toggle('script', on);
  // novel and script each keep their own page zoom: entering one applies its own
  applyPageZoom();
  const tabM = $('.tab[data-tab="manuscript"]');
  if (tabM) setText(tabM, on ? t('Script') : t('Manuscript'));
  const tabO = $('.tab[data-tab="outline"]');
  if (tabO) tabO.hidden = false; // a script's outline is its scenes, as cards
  const add = $('#nav-add');
  if (add) add.hidden = on;
  if (!on) setText($('#nav-head span'), t('Chapters'));
  spTitlePage(on);
  // the pane stays open beside a script, unless the writer unpinned it there
  if (!NO_HOVER) {
    let kept = {};
    try { kept = JSON.parse(localStorage.getItem('neo-pinned-panes') || '{}'); } catch { /* nothing kept */ }
    pinPane('nav', on ? kept.scriptNav !== false : !!kept.nav, on ? 'scriptNav' : 'nav');
  }
}
if (SP_NARROW.addEventListener) {
  SP_NARROW.addEventListener('change', () => { if (book && isScript() && !$('#editor-view').hidden) { const c = captureCaret(); renderChapters(); restoreCaret(c); } });
}
window.addEventListener('resize', () => { if (book && isScript() && $('#paper').classList.contains('narrow')) spSchedule(200); });

// Pasting into a script: lines copied from a script keep their elements,
// and a script pasted as plain text (Fountain, or copied from a PDF) is
// read line by line the way Fountain reads it
function spPaste(e, body, chId) {
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  let lines = null;
  if (html && /class="[^"]*\bsp-|script-body/.test(html)) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    lines = [...doc.body.querySelectorAll('p')].map((p) => ({ type: spType(p), html: paraRuns(p.innerHTML, false).filter((r) => r.text).map(runHtml).join('') }));
  } else if (text && /\n/.test(text.trim())) {
    lines = spFromFountain(text).map((l) => ({ type: l.type, html: spRunsFromFountain(l.text).map((x) => runHtml(x)).join('') }));
  }
  if (!lines || !lines.length) return false;
  e.preventDefault();
  if (lines.length > 60) { spPasteMany(lines, body, chId); return true; }
  const marker = 'sp' + Date.now().toString(36);
  const out = lines.map((l, i) => `<p${l.type === 'action' ? '' : ` class="sp-${l.type}"`}${i === lines.length - 1 ? ` data-sp-paste="${marker}"` : ''}>${l.html || '<br>'}</p>`).join('');
  document.execCommand('insertHTML', false, out);
  stripJunkSpans(body);
  const last = body.querySelector(`p[data-sp-paste="${marker}"]`);
  if (last) last.removeAttribute('data-sp-paste');
  for (const p of body.querySelectorAll('p[data-sp-paste]')) p.removeAttribute('data-sp-paste');
  for (const p of body.querySelectorAll('p')) {
    for (const a of ['style']) if (p.getAttribute(a) && !/text-align/.test(p.getAttribute(a))) p.removeAttribute(a);
  }
  syncChapter(body, chId);
  spSchedule();
  return true;
}

// Lines joined by a delete: the engine keeps the upper line and pours the
// lower one into it. When the upper line goes entirely (a shot selected and
// deleted, an empty line Backspaced away from below), what's left is the
// lower line, so it stays what it was: a scene heading stays a heading, and
// its card keeps its note. NEO makes that cut itself; ⌘Z puts it back.
document.addEventListener('beforeinput', (e) => {
  const body = e.target && e.target.closest ? e.target.closest('.script-body') : null;
  if (!body || e.defaultPrevented || !/^delete(Content|Word|SoftLine|HardLine|ByCut)/.test(e.inputType || '')) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const r = sel.getRangeAt(0);
  const lineOf = (n) => {
    const el = n && n.nodeType === Node.TEXT_NODE ? n.parentElement : n;
    const p = el && el.closest ? el.closest('p') : null;
    return p && p.parentElement === body ? p : null;
  };
  let upper = null;
  let lower = null;
  if (!r.collapsed) {
    upper = lineOf(r.startContainer);
    lower = lineOf(r.endContainer);
    if (!upper || !lower || upper === lower) return;
    // the upper line keeps words: the join is the engine's, as usual
    const before = document.createRange();
    before.selectNodeContents(upper);
    before.setEnd(r.startContainer, r.startOffset);
    if (before.toString().length) return;
  } else if (/Backward$/.test(e.inputType)) {
    lower = lineOf(r.startContainer);
    upper = lower && lower.previousElementSibling;
    if (!upper || upper.tagName !== 'P' || upper.textContent.length || !spCaretAtStart(lower)) return;
  } else if (/Forward$/.test(e.inputType)) {
    upper = lineOf(r.startContainer);
    lower = upper && upper.nextElementSibling;
    if (!lower || lower.tagName !== 'P' || upper.textContent.length) return;
  } else return;
  e.preventDefault();
  const chId = spChapterOf(lower);
  snapshotStructure('lines removed');
  if (!r.collapsed) {
    const cut = document.createRange();
    cut.setStart(lower, 0);
    cut.setEnd(r.endContainer, r.endOffset);
    cut.deleteContents();
  }
  for (let n = upper; n && n !== lower;) { const next = n.nextElementSibling; n.remove(); n = next; }
  if (!lower.textContent && !lower.querySelector('br')) lower.appendChild(document.createElement('br'));
  placeCaret(lower, 0);
  syncChapter(body, chId);
  breakRun++;
  spAfterChange(lower);
}, true);

// A whole script pasted in: the engine's own paste takes seconds per few
// hundred lines (and minutes for a feature), so the lines go straight onto
// the page, and ⌘Z takes the paste back as one move
function spPasteMany(lines, body, chId) {
  snapshotStructure('paste');
  const sel = window.getSelection();
  if (!sel.isCollapsed) document.execCommand('delete');
  let p = caretBlock(body);
  let atEnd = false;
  if (!p) {
    // a caret on the page itself, between its lines: the line beside it
    const kids = [...body.children].filter((c) => c.tagName === 'P');
    p = sel.anchorNode === body ? kids[Math.min(sel.anchorOffset, kids.length - 1)] : kids[kids.length - 1];
    atEnd = true;
    if (!p) { p = document.createElement('p'); p.innerHTML = '<br>'; body.appendChild(p); }
  }
  // the words after the caret wait below what's pasted, as a line of their own
  const tail = document.createRange();
  try {
    if (atEnd) throw new Error('at the line\'s end');
    tail.setStart(sel.anchorNode, sel.anchorOffset);
  } catch { tail.setStart(p, p.childNodes.length); }
  tail.setEnd(p, p.childNodes.length);
  const after = tail.extractContents();
  const frag = document.createDocumentFragment();
  let last = null;
  for (const l of lines) {
    const q = document.createElement('p');
    if (l.type !== 'action') q.className = 'sp-' + l.type;
    q.innerHTML = l.html || '<br>';
    frag.appendChild(q);
    last = q;
  }
  if (after.textContent) {
    const q = p.cloneNode(false);
    spCleanMarks(q);
    q.appendChild(after);
    frag.appendChild(q);
  }
  p.after(frag);
  if (!p.textContent.trim() && !p.querySelector('.ph-mark')) p.remove();
  spCaretToEnd(last);
  syncChapter(body, chId);
  resetNativeUndo();
  breakRun++;
  spSchedule();
  revealCaret();
}

// A .fountain or .fdx file, dropped on a shelf or picked with Import: a new
// script on that shelf, title page and all
async function importScript(r, shelf) {
  const parsed = r.script === 'fdx'
    ? spFromFdx(r.source)
    : { lines: spFromFountain(r.source).map((l) => ({ type: l.type, runs: spRunsFromFountain(l.text) })), title: spFountainTitle(r.source) };
  if (!parsed.lines.length) return false;
  const tp = parsed.title || {};
  const title = tp.title || r.name;
  const meta = await window.neo.createBook({ author: tp.author || displayAuthor(), title });
  const chId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  const html = parsed.lines.map((l) => `<p${l.type === 'action' ? '' : ` class="sp-${l.type}"`}>${l.runs.map((x) => runHtml(x)).join('') || '<br>'}</p>`).join('');
  await window.neo.writeChapter(meta.id, chId, html);
  meta.title = title;
  meta.format = 'screenplay';
  meta.chapterOrder = [chId];
  meta.credit = tp.credit || t('Written by');
  if (tp.draft) meta.draft = tp.draft;
  meta.tabNames = { notes: (library.tabDefaults && library.tabDefaults.notes) || 'Notes', outline: 'Outline' };
  meta.wordCount = parsed.lines.reduce((n, l) => n + countWords(l.runs.map((x) => x.text).join('')), 0);
  // the contact block is the writer's, for every script: one carried in
  // fills it only when it's still empty
  if (tp.contact && !library.scriptContact) library.scriptContact = tp.contact;
  await writeBookMeta(meta.id, meta);
  await placeTitle(shelf, meta.id);
  return true;
}

// ---- out of NEO: the PDF, as the industry prints a script, and Fountain ----
// The script's lines for the exports: each with its element, its runs of
// bold/italic/underline, and (CONT'D) where the screen shows it
function spExportLines() {
  const lines = [];
  for (const chId of book.chapterOrder) {
    const holder = cleanChapterEl(chId);
    for (const p of holder.querySelectorAll('p')) {
      const runs = paraRuns(p.innerHTML, false).filter((r) => r.text && r.mark === undefined);
      const text = runs.map((r) => r.text).join('').replace(/\s+$/, '');
      lines.push({ type: spType(p), runs, text });
    }
  }
  const plain = lines.map((l) => ({ type: l.type, text: l.text }));
  lines.forEach((l, i) => { l.contd = l.type === 'character' && spContd(plain, i); });
  return lines;
}
const SP_CAPS = ['heading', 'character', 'transition', 'shot'];
function spRunsHtml(l) {
  const caps = SP_CAPS.includes(l.type);
  return l.runs.map((r) => runHtml({ ...r, text: caps ? r.text.toUpperCase() : r.text })).join('') + (l.contd ? " (CONT'D)" : '');
}
async function spPdfHtml() {
  const lines = spExportLines().filter((l, i, all) => l.text.trim() || (i > 0 && i < all.length - 1));
  // lay the lines out off screen, as they print, to count them
  const holder = document.createElement('div');
  const ps = lines.map((l) => {
    const p = document.createElement('p');
    if (l.type !== 'action') p.className = 'sp-' + l.type;
    p.innerHTML = spRunsHtml(l) || '<br>';
    holder.appendChild(p);
    return p;
  });
  await document.fonts.load('1em "Courier Prime"').catch(() => {});
  const counts = spMeasure(ps, false);
  const pg = spPaginate(lines.map((l, i) => ({ type: l.type, lines: counts[i] })));
  const pages = [];
  lines.forEach((l, i) => {
    const a = pg.at[i];
    if (!pages[a.page - 1]) pages[a.page - 1] = [];
    const cls = l.type === 'action' ? '' : ` class="sp-${l.type}"`;
    pages[a.page - 1].push(`<p${cls} style="margin-top:${a.before}em">${spRunsHtml(l) || '&nbsp;'}</p>`);
  });
  const esc = (s) => escHtml(String(s || ''));
  const title = book.title && !isUntitled(book.title) ? book.title : t('Untitled');
  const credit = book.credit === undefined ? t('Written by') : book.credit;
  const fonts = await spFontFaces();
  const lines2 = (s) => esc(s).replace(/\n/g, '<br>');
  const titlePage = `<div class="page title">
    <div class="tp-main"><div>${esc(title.toUpperCase())}</div>${credit ? `<div class="gap">${esc(credit)}</div>` : ''}<div class="${credit ? '' : 'gap'}">${esc(book.author || '')}</div></div>
    <div class="tp-contact">${lines2(library.scriptContact || '')}</div>
    <div class="tp-draft">${lines2(book.draft || '')}</div>
  </div>`;
  const body = pages.map((rows, k) => `<div class="page">${k ? `<div class="num">${k + 1}.</div>` : ''}${(rows || []).join('')}</div>`).join('');
  return `<!DOCTYPE html><html lang="${escHtml(writingLanguage())}"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
${fonts}
@page { size: 8.5in 11in; margin: 0; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: 'Courier Prime', 'Courier New', Courier, monospace; font-size: 12pt; line-height: 12pt; color: #000; }
.page { width: 8.5in; height: 11in; box-sizing: border-box; padding: 1in 1in 0 1.5in; position: relative; overflow: hidden; break-after: page; }
.page:last-child { break-after: auto; }
.num { position: absolute; top: 0.5in; right: 1in; }
p { margin: 0; width: 36.3em; white-space: pre-wrap; overflow-wrap: anywhere; }
p.sp-character { margin-left: 13.2em; width: 23.1em; }
p.sp-paren { margin-left: 9.6em; width: 15.3em; }
p.sp-dialogue { margin-left: 6em; width: 21.3em; }
p.sp-transition { text-align: right; }
p.sp-heading, p.sp-shot { font-weight: bold; }
.title { text-align: center; }
.tp-main { position: absolute; top: 3.5in; left: 1.5in; width: 6in; }
.tp-main .gap { margin-top: 2em; }
.tp-main div + div:not(.gap) { margin-top: 1em; }
.tp-contact { position: absolute; left: 1.5in; bottom: 1in; width: 3.5in; text-align: left; }
.tp-draft { position: absolute; right: 1in; bottom: 1in; width: 2.5in; text-align: right; }
</style></head><body>${titlePage}${body}</body></html>`;
}
// Courier Prime travels inside the PDF
async function spFontFaces() {
  let css = '';
  for (const sheet of document.styleSheets) {
    let rules = [];
    try { rules = [...sheet.cssRules]; } catch { continue; }
    for (const r of rules) {
      if (!(r instanceof CSSFontFaceRule)) continue;
      if (r.style.getPropertyValue('font-family').replace(/["']/g, '').trim() !== 'Courier Prime') continue;
      const src = r.style.getPropertyValue('src').match(/url\(["']?([^"')]+)["']?\)/);
      if (!src) continue;
      try {
        const bytes = new Uint8Array(await (await fetch(new URL(src[1], sheet.href || location.href))).arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const range = r.style.getPropertyValue('unicode-range');
        css += `@font-face { font-family: 'Courier Prime'; src: url(data:font/woff2;base64,${btoa(bin)}) format('woff2'); font-weight: ${r.style.getPropertyValue('font-weight') || 400}; font-style: ${r.style.getPropertyValue('font-style') || 'normal'};${range ? ` unicode-range: ${range};` : ''} }\n`;
      } catch { /* the PDF falls back on Courier */ }
    }
  }
  return css;
}
function spFountain() {
  const lines = spExportLines().map((l) => ({
    type: l.type,
    text: l.runs.map((r) => {
      const s = r.text.replace(/([\\*_])/g, '\\$1');
      const lead = s.match(/^\s*/)[0];
      const trail = s.match(/\s*$/)[0];
      let core = s.slice(lead.length, s.length - trail.length);
      if (!core) return s;
      const mark = r.b && r.i ? '***' : r.b ? '**' : r.i ? '*' : '';
      if (r.u) core = '_' + core + '_';
      return lead + mark + core + mark + trail;
    }).join('')
  }));
  return spToFountain(lines, spTitleFields());
}
// what the title page says, for the files a script leaves as
function spTitleFields() {
  return {
    title: book.title && !isUntitled(book.title) ? book.title : '',
    credit: book.credit === undefined ? t('Written by') : book.credit,
    author: book.author || '',
    draft: book.draft || '',
    contact: library.scriptContact || ''
  };
}
async function spExport(format) {
  flushAllSaves();
  const defaultName = safeName(book.title);
  try {
    let payload;
    if (format === 'pdf') payload = { format: 'pdf', defaultName, content: await spPdfHtml(), print: 'screenplay' };
    else if (format === 'fdx') payload = { format: 'fdx', defaultName, content: spToFdx(spExportLines(), spTitleFields()) };
    else payload = { format: 'fountain', defaultName, content: spFountain() };
    const saved = await window.neo.exportSave(payload);
    if (saved) toast(t('Exported: {file}', { file: saved.split('/').pop() }));
  } catch (err) {
    window.neo.logError('export ' + format + ': ' + (err && err.stack || err));
    toast(t('Couldn’t export: {error}', { error: plainError(err) }), 8000);
  }
}

// ---- the shelf: a new script, and its tile ----
async function createScriptOnShelf(shelf) {
  const meta = await window.neo.createBook({ author: displayAuthor() });
  const chId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
  await window.neo.writeChapter(meta.id, chId, '<p><br></p>');
  meta.format = 'screenplay';
  meta.chapterOrder = [chId];
  meta.credit = t('Written by');
  meta.tabNames = { notes: (library.tabDefaults && library.tabDefaults.notes) || 'Notes', outline: 'Outline' };
  await writeBookMeta(meta.id, meta);
  await placeTitle(shelf, meta.id);
  await writeLibrary(library);
  await openBook(meta.id);
}
function scriptTile(el, meta) {
  el.classList.add('script-tile');
  el.innerHTML = `
    <div class="st-text"><div class="st-title"></div><div class="st-author"></div></div>
    <span class="st-brad top"></span><span class="st-hole"></span><span class="st-brad bot"></span>
    <div class="b-progress" hidden><div></div></div>`;
  const title = isUntitled(meta.title) ? t('Untitled') : meta.title;
  const tEl = el.querySelector('.st-title');
  tEl.textContent = title;
  tEl.classList.toggle('long', title.length > 36);
  el.querySelector('.st-author').textContent = meta.author || '';
}

/* ================================================================== */
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 1

- Fork module: [`src/renderer/outline.js` lines 59-59](./src/renderer/outline.js#L59)
- Common base: [`app.js` lines 5506-5506](./app.js#L5506)
- Upstream: [`app.js` lines 7131-7131](./app.js#L7131)

```diff
<<<<<<< fork
  hint.textContent = t('Enter — new line · Tab — chapter to scene, or scene to beat · Shift+Tab — scene to chapter, or beat to scene · Backspace on an empty line removes it');
||||||| common base
  hint.textContent = t('Enter — new chapter (or section, from a section line) · Tab — turn a fresh chapter line into a section · Shift+Tab — turn a section into a chapter · Backspace on an empty line removes it');
=======
  hint.textContent = t('Enter — new chapter · Tab — make it a section, or a new section below one · ⇧Tab — make it a chapter again · Backspace on an empty line removes it');
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 2

- Fork module: [`src/renderer/outline.js` lines 274-288](./src/renderer/outline.js#L274)
- Common base: [`app.js` lines 5721-5732](./app.js#L5721)
- Upstream: [`app.js` lines 7346-7350](./app.js#L7346)

```diff
<<<<<<< fork
      if (kind === 'chapter') {
        const at = book.chapterOrder.indexOf(chId) + (above ? 0 : 1);
        const newId = createChapterAt(at);
        renderOutline({ chId: newId });
      } else if (kind === 'section') {
        const list = book.sectionNotes[chId];
        const newSec = { id: 'sec-' + Date.now().toString(36), text: '' };
        list.splice(index + (above ? 0 : 1), 0, newSec);
        freshSceneId = newSec.id;
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ secId: newSec.id });
      } else {
        addBeat(chId, secId, index + (above ? 0 : 1));
      }
||||||| common base
      if (kind === 'chapter') {
        const at = book.chapterOrder.indexOf(chId) + (above ? 0 : 1);
        const newId = createChapterAt(at);
        renderOutline({ chId: newId });
      } else {
        const list = book.sectionNotes[chId];
        const newSec = { id: 'sec-' + Date.now().toString(36), text: '' };
        list.splice(index + (above ? 0 : 1), 0, newSec);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ secId: newSec.id });
      }
=======
      snapshotStructure('outline new chapter', { outlineFocus: here() });
      const at = book.chapterOrder.indexOf(chId) + (above ? 0 : 1);
      const newId = createChapterAt(at);
      updateCounters();
      renderOutline({ chId: newId });
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 3

- Fork module: [`src/renderer/outline.js` lines 321-334](./src/renderer/outline.js#L321)
- Common base: [`app.js` lines 5768-5774](./app.js#L5768)
- Upstream: [`app.js` lines 7393-7393](./app.js#L7393)

```diff
<<<<<<< fork
      if (kind === 'section') {
        save();
        if (secId === freshSceneId && indentFreshScene(chId, secId)) return;
        if (secId === freshSceneId) freshSceneId = null;
        addBeat(chId, secId, ((book.sectionNotes[chId] || []).find((s) => s.id === secId)?.beats || []).length);
        return;
      }
      if (kind !== 'chapter') return;
      const prevCh = storyBefore(chId);
      if (!prevCh) { toast(t('The first line has to be a chapter')); return; }
      if (countWords(chapterText(chId)) > 0) {
        toast(t('This chapter already has words in it — only empty chapter lines can become scenes'));
        return;
      }
||||||| common base
      if (kind !== 'chapter') return;
      const prevCh = storyBefore(chId);
      if (!prevCh) { toast(t('The first line has to be a chapter')); return; }
      if (countWords(chapterText(chId)) > 0) {
        toast(t('This chapter already has words in it — only empty chapter lines can become sections'));
        return;
      }
=======
      e.stopPropagation();
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 4

- Fork module: [`src/renderer/outline.js` lines 407-421](./src/renderer/outline.js#L407)
- Common base: [`app.js` lines 5854-5855](./app.js#L5854)
- Upstream: [`app.js` lines 7479-7485](./app.js#L7479)

```diff
<<<<<<< fork
      const sec = list.find((s) => s.id === secId);
      if (!sec) return;
      const beats = sec.beats || [];
      const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
      const writtenBeats = new Map(beats.map((beat) => {
        const p = body && body.querySelector(`p[data-beat-id="${beat.id}"]:not(.ghost)`);
        if (!p) return null;
        const copy = p.cloneNode(true);
        copy.removeAttribute('data-beat-id');
        copy.dataset.secId = beat.id;
        p.remove();
        return [beat.id, copy.outerHTML];
      }).filter(Boolean));
      list.splice(list.indexOf(sec), 1);
      syncGhosts(chId);
||||||| common base
      const sec = list.find((s) => s.id === secId);
      list.splice(list.indexOf(sec), 1);
=======
      const from = list.findIndex((s) => s.id === secId);
      // the section and the ones after it leave together, so the book's order
      // holds (B in A B C: B and C make the next chapter, A stays). Sections
      // already written over keep their prose here, so those stay here too.
      const [sec, ...after] = list.splice(from);
      const carry = after.length > 0 && !after.some((s) => sectionWritten(chId, s.id));
      if (!carry) list.push(...after);
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 5

- Fork module: [`src/renderer/outline.js` lines 438-451](./src/renderer/outline.js#L438)
- Common base: [`app.js` lines 5885-5885](./app.js#L5885)
- Upstream: [`app.js` lines 7510-7510](./app.js#L7510)

```diff
<<<<<<< fork
      if (beats.length) {
        book.sectionNotes[newId] = beats.map((beat) => ({ id: beat.id, text: beat.text }));
        const content = [];
        for (const beat of beats) {
          const para = writtenBeats.get(beat.id) ||
            (beat.text ? `<p class="ghost" data-sec-id="${beat.id}">${escHtml(beat.text)}</p>` : '');
          if (!para) continue;
          if (content.length) content.push(`<p class="scene-break" data-sec-brk="${beat.id}">***</p>`);
          content.push(para);
        }
        chapterHTML[newId] = content.join('') || '<p><br></p>';
        persistChapter(newId);
        renderChapters();
      }
||||||| common base

=======
      if (carry) book.sectionNotes[newId] = after;
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 6

- Fork module: [`src/renderer/outline.js` lines 458-458](./src/renderer/outline.js#L458)
- Common base: [`app.js` lines 5905-5905](./app.js#L5905)
- Upstream: [`app.js` lines 7530-7531](./app.js#L7530)

```diff
<<<<<<< fork

||||||| common base
      syncGhosts(chId);
=======
      syncGhosts(chId);
      if (carry) syncGhosts(newId);
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 7

- Fork module: [`src/renderer/outline.js` lines 469-469](./src/renderer/outline.js#L469)
- Common base: [`app.js` lines 5916-5916](./app.js#L5916)
- Upstream: [`app.js` lines 7541-7542](./app.js#L7541)

```diff
<<<<<<< fork
      if (kind === 'section' || kind === 'beat') {
||||||| common base
      if (kind === 'section') {
=======
      if (kind === 'section') {
        snapshotStructure('outline section removed', { outlineFocus: here() });
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 8

- Fork module: [`src/renderer/outline.js` lines 502-506](./src/renderer/outline.js#L502)
- Common base: [`app.js` lines 5949-5954](./app.js#L5949)
- Upstream: [`app.js` lines 7574-7580](./app.js#L7574)

```diff
<<<<<<< fork
        if (kind === 'beat') {
          removeBeat(chId, secId, beatId, index);
        } else {
          removeScene(chId, secId, index);
        }
||||||| common base
        const list = book.sectionNotes[chId] || [];
        const focus = focusAfterSectionRemoved(list, index, chId);
        book.sectionNotes[chId] = list.filter((s) => s.id !== secId);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline(focus);
=======
        snapshotStructure('outline section removed', { outlineFocus: here() });
        const list = book.sectionNotes[chId] || [];
        const focus = focusAfterSectionRemoved(list, index, chId);
        book.sectionNotes[chId] = list.filter((s) => s.id !== secId);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline(focus);
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 9

- Fork module: [`src/renderer/outline.js` lines 533-535](./src/renderer/outline.js#L533)
- Common base: [`app.js` lines 5980-5982](./app.js#L5980)
- Upstream: [`app.js` lines 7605-7615](./app.js#L7605)

```diff
<<<<<<< fork
// Push scene and beat notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between scenes and none between beats.
// Once a ghost has been written over, it goes away.
||||||| common base
// Push section notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between sections.
// Once a ghost has been written over, it goes away.
=======
// a section whose outline line the writer has written over: prose of their
// own now stands where its gray ghost was
function sectionWritten(chId, secId) {
  return !!document.querySelector(`.chapter[data-id="${chId}"] .chapter-body p[data-sec-id="${secId}"]:not(.ghost)`);
}

// Push section notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between sections. A ghost stays where it is
// (the cards can set one between two written sections); a note the page
// doesn't have yet goes in before the next section that's already there,
// else at the end. Once a ghost has been written over, it's prose.
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 10

- Fork module: [`src/renderer/outline.js` lines 558-559](./src/renderer/outline.js#L558)
- Common base: [`app.js` lines 6005-6005](./app.js#L6005)
- Upstream: [`app.js` lines 7630-7630](./app.js#L7630)

```diff
<<<<<<< fork
  const keep = new Set(list.map((s) => s.id));
  const keepBeats = new Set(list.flatMap((s) => (s.beats || []).map((b) => b.id)));
||||||| common base
  const keep = new Set(list.map((s) => s.id));
=======
  const notes = new Map(list.map((s) => [s.id, s]));
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 11

- Fork module: [`src/renderer/outline.js` lines 588-590](./src/renderer/outline.js#L588)
- Common base: [`app.js` lines 6035-6035](./app.js#L6035)
- Upstream: [`app.js` lines 7660-7661](./app.js#L7660)

```diff
<<<<<<< fork
  body.querySelectorAll('p.ghost[data-beat-id]').forEach((p) => {
    if (!keepBeats.has(p.dataset.beatId)) p.remove();
  });
||||||| common base

=======
  syncChapter(body, chId);
}
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 12

- Fork module: [`src/renderer/outline.js` lines 598-639](./src/renderer/outline.js#L598)
- Common base: [`app.js` lines 6045-6064](./app.js#L6045)
- Upstream: [`app.js` lines 7670-8599](./app.js#L7670)

```diff
<<<<<<< fork
  // 2. Pull all still-ghost paragraphs out, then re-append in outline order
  //    so the ghosts always mirror the outline's sequence
  for (const p of [...body.querySelectorAll('p.ghost[data-sec-id]')]) {
    const brk = breakFor(p.dataset.secId);
    if (brk) brk.remove();
    p.remove();
  }
  body.querySelectorAll('p.ghost[data-beat-id]').forEach((p) => p.remove());
  for (const sec of list) {
    let scene = body.querySelector(`p[data-sec-id="${sec.id}"]`);
    if (!scene && sec.text) {
      // *** between this scene and whatever comes before it
      const hasContent = body.innerText.trim() !== '';
      if (hasContent && !(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) {
        const brk = document.createElement('p');
        brk.className = 'scene-break';
        brk.dataset.secBrk = sec.id;
        brk.textContent = '***';
        body.appendChild(brk);
      }
      scene = document.createElement('p');
      scene.className = 'ghost';
      scene.dataset.secId = sec.id;
      scene.textContent = sec.text;
      body.appendChild(scene);
    }
    let anchor = scene;
    for (const beat of sec.beats || []) {
      const written = body.querySelector(`p[data-beat-id="${beat.id}"]:not(.ghost)`);
      if (written) { anchor = written; continue; }
      if (!beat.text) continue;
      const p = document.createElement('p');
      p.className = 'ghost';
      p.dataset.beatId = beat.id;
      p.textContent = beat.text;
      if (anchor) {
        anchor.after(p);
        anchor = p;
      } else {
        body.appendChild(p);
        anchor = p;
      }
||||||| common base
  // 2. Pull all still-ghost paragraphs out, then re-append in outline order
  //    so the ghosts always mirror the outline's sequence
  for (const p of [...body.querySelectorAll('p.ghost[data-sec-id]')]) {
    const brk = breakFor(p.dataset.secId);
    if (brk) brk.remove();
    p.remove();
  }
  for (const sec of list) {
    // written over already? Leave it alone
    const written = body.querySelector(`p[data-sec-id="${sec.id}"]:not(.ghost)`);
    if (written) continue;
    if (!sec.text) continue;
    // *** between this ghost and whatever comes before it
    const hasContent = body.innerText.trim() !== '';
    if (hasContent && !(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) {
      const brk = document.createElement('p');
      brk.className = 'scene-break';
      brk.dataset.secBrk = sec.id;
      brk.textContent = '***';
      body.appendChild(brk);
=======
// where the section holding el begins: its *** (or the body's first line)
function segmentStartEl(body, el) {
  let n = el;
  while (n.parentElement && n.parentElement !== body) n = n.parentElement;
  for (let q = n; q; q = q.previousElementSibling) {
    if (q.classList.contains('scene-break')) return q;
    if (!q.previousElementSibling) return q;
  }
  return n;
}

function newSceneBreak(secId) {
  const b = document.createElement('p');
  b.className = 'scene-break';
  if (secId) b.dataset.secBrk = secId;
  b.textContent = '***';
  return b;
}

function placeGhost(body, sec, before) {
  const p = document.createElement('p');
  p.className = 'ghost';
  p.dataset.secId = sec.id;
  p.textContent = sec.text;
  if (before && before.parentElement === body) {
    if (before.classList.contains('scene-break')) {
      body.insertBefore(newSceneBreak(sec.id), before);
      body.insertBefore(p, before);
    } else {
      // the first section of the chapter: the ghost goes ahead of it
      body.insertBefore(p, before);
      body.insertBefore(newSceneBreak(sec.id), before);
    }
    return p;
  }
  const hasContent = body.innerText.trim() !== '';
  if (hasContent && !(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) {
    body.appendChild(newSceneBreak(sec.id));
  }
  body.appendChild(p);
  return p;
}

// a ghost leaves, and so does the *** that set it apart
function removeGhost(body, p) {
  const prev = p.previousElementSibling;
  const next = p.nextElementSibling;
  const isBrk = (q) => q && q.classList.contains('scene-break');
  if (isBrk(prev) && (!next || isBrk(next))) prev.remove();
  else if (!prev && isBrk(next)) next.remove();
  p.remove();
  if (!body.firstElementChild) body.innerHTML = '<p><br></p>';
}

/* ================================================================== */
/*  OUTLINE CARDS                                                      */
/*  The outline as index cards, set like a page: they read left to    */
/*  right, line after line, so any shape of book fills the window. A   */
/*  chapter starts at its numeral, and its cards share a mat, rounded  */
/*  where the chapter starts and ends and cut square where it wraps.   */
/*  Parts start a fresh line. Sections are the manuscript's own: every */
/*  *** makes one, outlined or not, and a card shows its note or else  */
/*  the section's first line, in quotes. Dragging a card moves the     */
/*  writing with it (⌘Z puts it back). Loose cards, ideas that don't   */
/*  have a chapter yet, wait in the right-hand pane (book.looseCards). */
/*  A script's cards are its scenes (book.sceneNotes holds their notes). */
/* ================================================================== */

const outlineCardsOn = () => !!book && (isScript() || (library.outlineView || 'cards') === 'cards');
const chapterBodyEl = (chId) => document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
const newSectionId = () => 'sec-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// A chapter cut at its *** lines. Each piece: its *** (none for the first),
// its paragraphs, the outline note it belongs to (if any), and what's on it.
// A paragraph split from a written ghost carries the ghost's id along, so
// only the first piece to hold an id is that note's.
function chapterSegments(chId) {
  const body = chapterBodyEl(chId);
  if (!body) return [];
  const segs = [];
  let cur = { brk: null, ps: [] };
  for (const el of body.children) {
    if (el.classList.contains('scene-break')) { segs.push(cur); cur = { brk: el, ps: [] }; }
    else cur.ps.push(el);
  }
  segs.push(cur);
  const notes = new Set(((book.sectionNotes || {})[chId] || []).map((s) => s.id));
  const claimed = new Set();
  for (const seg of segs) {
    const tagged = seg.ps.find((p) => p.dataset && notes.has(p.dataset.secId) && !claimed.has(p.dataset.secId));
    seg.id = tagged ? tagged.dataset.secId : null;
    if (seg.id) claimed.add(seg.id);
    const prose = seg.ps.filter((p) => !p.classList.contains('ghost'));
    seg.words = countWords(prose.map((p) => p.textContent).join('\n'));
    seg.first = prose.map((p) => p.textContent.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
    seg.flag = seg.ps.some((p) => p.querySelector && p.querySelector('.ph-mark'));
  }
  return segs;
}

// the note a section has, if it has one
const sectionNote = (chId, secId) => ((book.sectionNotes || {})[chId] || []).find((s) => s.id === secId) || null;

// keep a chapter's notes in the order their sections stand on the page
// (a note with no place yet keeps to the end)
function orderSectionNotes(chId) {
  const list = (book.sectionNotes || {})[chId];
  if (!list) return;
  const ids = chapterSegments(chId).map((s) => s.id).filter(Boolean);
  const placed = ids.map((id) => list.find((s) => s.id === id)).filter(Boolean);
  book.sectionNotes[chId] = placed.concat(list.filter((s) => !ids.includes(s.id)));
}

// Zoom is per mode and per device. Novel and script keep their own page zoom, and the outline's
// cards keep their own; none of them travel in library.json, so a phone never inherits the zoom a
// desktop set. `library.pageZoom` / `library.cardZoom` stay as the fallback for devices that have
// not chosen yet, which keeps an existing zoom as the default.
const PAGE_ZOOM_RANGE = { min: 0.75, max: 3 };
const CARD_ZOOM_RANGE = { min: 0.55, max: 1.5 };
const CARD_ZOOM_KEY = 'neo.cardZoom';
const pageZoomKey = () => 'neo.pageZoom.' + (isScript() ? 'script' : 'novel');

/** The stored zoom, or the fallback, always inside the range. Split out so a test can hold it. */
function resolveStoredZoom(raw, fallback, min, max) {
  const value = raw === null || raw === '' ? NaN : Number(raw);
  const chosen = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, chosen));
}

function readStoredZoom(key, fallback, range) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { /* storage can be off */ }
  return resolveStoredZoom(raw, fallback || 1, range.min, range.max);
}

function rememberZoom(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* storage can be off */ }
}

const activePageZoom = () => readStoredZoom(pageZoomKey(), library.pageZoom || 1, PAGE_ZOOM_RANGE);
function applyPageZoom() {
  document.documentElement.style.setProperty('--page-zoom', activePageZoom());
  updateZoomDisplay();
}

function cardZoom() { return readStoredZoom(CARD_ZOOM_KEY, library.cardZoom || 1, CARD_ZOOM_RANGE); }
const CARD_ZOOMS = [0.55, 0.7, 0.85, 1, 1.15, 1.3, 1.5];
function stepCardZoom(dir) {
  const now = cardZoom();
  let next = now;
  if (dir === 0) next = 1;
  else if (dir > 0) next = CARD_ZOOMS.find((z) => z > now + 0.001) || now;
  else next = [...CARD_ZOOMS].reverse().find((z) => z < now - 0.001) || now;
  if (next === now) return;
  rememberZoom(CARD_ZOOM_KEY, next);
  renderBoard();
  updateZoomDisplay();
}

// ---- the board ----

function outlineBoard() {
  let board = $('#outline-board');
  if (board) return board;
  board = document.createElement('div');
  board.id = 'outline-board';
  board.hidden = true;
  board.setAttribute('role', 'list');
  board.setAttribute('aria-label', t('Outline cards'));
  $('#outline-list').after(board);
  board.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.ob-cell');
    if (!cell || e.button !== 0 || cell.classList.contains('open')) return;
    if (e.target.closest('button')) return;
    cardPress(e, { kind: cell.dataset.kind, cell });
  });
  board.addEventListener('contextmenu', (e) => {
    const cell = e.target.closest('.ob-cell');
    if (!cell || cell.classList.contains('open')) return;
    e.preventDefault();
    if (NO_HOVER) return; // a long press is the menu there (cardPress)
    cardMenu(cell, e.clientX, e.clientY);
  });
  board.addEventListener('keydown', (e) => {
    const cell = e.target.closest && e.target.closest('.ob-cell');
    if (!cell || cell.classList.contains('open')) return;
    if (e.key === 'Enter' && e.altKey) { e.preventDefault(); newCardAfter(cell); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(cell); }
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); cardMenu(cell, 0, 0); }
    else if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const cells = [...board.querySelectorAll('.ob-cell')];
      const i = cells.indexOf(cell);
      let next = null;
      if (e.key === 'ArrowRight') next = cells[i + 1];
      else if (e.key === 'ArrowLeft') next = cells[i - 1];
      else {
        // the card above or below: the nearest one in the next line
        const r = cell.getBoundingClientRect();
        const down = e.key === 'ArrowDown';
        let best = Infinity;
        for (const c of cells) {
          const q = c.getBoundingClientRect();
          if (down ? q.top <= r.top + 4 : q.top >= r.top - 4) continue;
          const d = Math.abs(q.top - r.top) * 4 + Math.abs(q.left - r.left);
          if (d < best) { best = d; next = c; }
        }
      }
      if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }); }
    }
  });
  return board;
}

function viewSwitch() {
  let sw = $('#outline-views');
  if (sw) return sw;
  sw = document.createElement('div');
  sw.id = 'outline-views';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', t('Outline view'));
  for (const [value, label] of [['list', t('List')], ['cards', t('Cards')]]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.view = value;
    b.textContent = label;
    b.onclick = () => {
      if ((library.outlineView || 'cards') === value) return;
      closeCardEditor();
      library.outlineView = value;
      writeLibrary(library);
      renderOutline();
    };
    sw.appendChild(b);
  }
  $('#aux-title').after(sw);
  return sw;
}

// called by renderOutline: shows the list or the board
function showOutlineView() {
  const sw = viewSwitch();
  const cards = outlineCardsOn();
  sw.hidden = !book || isScript(); // a script has only the cards
  for (const b of sw.querySelectorAll('button')) {
    const on = b.dataset.view === (cards ? 'cards' : 'list');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  $('#outline-list').hidden = cards;
  outlineBoard().hidden = !cards;
  $('#editor-view').classList.toggle('board-on', cards);
  updateZoomDisplay();
  return cards;
}

function renderBoard() {
  const board = outlineBoard();
  if (!book) return;
  closeCardEditor(true);
  board.innerHTML = '';
  const z = cardZoom();
  board.style.setProperty('--cz', z);
  board.classList.toggle('tiles', z < 0.8);
  board.classList.remove('script-board');
  if (isScript()) { renderScriptBoard(board); boardAddCard(board); boardHint(board); return; }
  const solo = soloStory();
  for (const chId of book.chapterOrder) {
    const kind = chapterKind(chId);
    if (kind === 'part') { board.appendChild(boardPartRow(chId)); continue; }
    if (!STORY_KINDS.includes(kind)) continue;
    const segs = chapterSegments(chId);
    const opening = segs[0] && !segs[0].id ? segs[0] : null;
    const run = [chapterCard(chId, opening, solo === chId)];
    let letter = 0;
    segs.forEach((seg, i) => {
      if (seg === opening) return;
      run.push(sectionCard(chId, seg, i, letter++));
    });
    // notes the page doesn't hold yet (written but emptied, or just made)
    const onPage = new Set(segs.map((s) => s.id).filter(Boolean));
    for (const sec of (book.sectionNotes || {})[chId] || []) {
      if (onPage.has(sec.id)) continue;
      run.push(sectionCard(chId, { id: sec.id, ps: [], words: 0, first: '', flag: false, virtual: true }, -1, letter++));
    }
    run.forEach((cell, i) => {
      if (i === 0) cell.classList.add('first');
      if (i === run.length - 1) cell.classList.add('last');
      board.appendChild(cell);
    });
  }
  boardAddCard(board);
  boardHint(board);
}

function boardHint(board) {
  let hint = $('#outline-board-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'outline-board-hint';
    hint.className = 'ol-hint';
    board.after(hint);
  }
  hint.hidden = false;
  hint.textContent = NO_HOVER
    ? t('Tap a card to write on it · hold a card to move it · hold and let go for more · + adds a card')
    : isScript()
      ? t('Click a card to write on it · drag it to move the scene · right-click for more · + adds a scene')
      : t('Click a card to write on it · drag it to move it, writing and all · right-click for more · + adds a card');
}

function boardPartRow(chId) {
  const row = document.createElement('div');
  row.className = 'ob-part';
  row.setAttribute('role', 'heading');
  row.setAttribute('aria-level', '3');
  const title = partTitleOf(chId);
  const label = document.createElement('span');
  label.textContent = chapterName(chId) + (title ? ' · ' + title : '');
  const rule = document.createElement('span');
  rule.className = 'ob-rule';
  row.append(label, rule);
  row.addEventListener('contextmenu', (e) => { e.preventDefault(); chapterMenu(chId, e.clientX, e.clientY, row); });
  return row;
}

function cardCell(kind, chId) {
  const cell = document.createElement('div');
  cell.className = 'ob-cell';
  cell.dataset.kind = kind;
  cell.dataset.ch = chId;
  cell.tabIndex = 0;
  cell.setAttribute('role', 'listitem');
  const card = document.createElement('div');
  card.className = 'ob-card ob-' + kind;
  cell.appendChild(card);
  if (kind !== 'loose') {
    // a + on the seam after the card: a new card right there
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'ob-plus';
    plus.textContent = '+';
    plus.title = kind === 'scene' ? t('New scene after this one') : t('New card after this one');
    plus.setAttribute('aria-label', plus.title);
    plus.tabIndex = -1; // the keyboard has ⌥Enter
    plus.addEventListener('click', (e) => { e.stopPropagation(); if (!cell.dataset.new) newCardAfter(cell); });
    cell.appendChild(plus);
  }
  return { cell, card };
}

// the last place on the board: a new chapter (or scene) at the end
function boardAddCard(board) {
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'ob-add';
  const script = isScript();
  add.textContent = script ? t('+ Scene') : t('+ Chapter');
  add.addEventListener('click', () => {
    if (script) {
      const cells = [...board.querySelectorAll('.ob-cell[data-kind="scene"]')];
      const last = cells[cells.length - 1];
      if (last) { newCardAfter(last); return; }
      const fresh = sceneCard({ k: -1, s: { p: null }, id: null, slug: '', eighths: 0, cast: [], first: '' });
      fresh.dataset.new = '1';
      fresh.dataset.after = '-1';
      add.before(fresh);
      openCard(fresh, { fresh: true });
      return;
    }
    newChapterCard(storyEnd());
  });
  board.appendChild(add);
}

const cardWords = (n) => (n ? t('{n} words', { n: n.toLocaleString() }) : '');
const quoted = (s) => '“' + (s.length > 220 ? s.slice(0, 220).trim() + '…' : s) + '”';

function chapterCard(chId, opening, solo) {
  const { cell, card } = cardCell('chapter', chId);
  const kind = chapterKind(chId);
  const head = document.createElement('div');
  head.className = 'ob-head';
  const mark = document.createElement('span');
  mark.className = 'ob-mark';
  if (solo) { mark.textContent = t('The story'); mark.classList.add('ob-word'); }
  else if (kind === 'chapter') mark.textContent = String(chapterNumber(chId));
  else { mark.textContent = chapterName(chId); mark.classList.add('ob-word'); }
  const words = document.createElement('span');
  words.className = 'ob-words';
  const n = countWords(chapterText(chId));
  words.textContent = cardWords(n);
  head.append(mark, words);
  if (chapterHasFlag(chId)) head.appendChild(cardFlag());
  const text = document.createElement('div');
  text.className = 'ob-text';
  card.append(head, text);
  cell.dataset.excerpt = opening && opening.first ? quoted(opening.first) : '';
  fillCardText(cell, (book.chapterNotes || {})[chId] || '');
  cell.setAttribute('aria-label', (solo ? t('The story') : chapterName(chId)) + '. ' + text.textContent);
  return cell;
}

function sectionCard(chId, seg, segIdx, letterIdx) {
  const { cell, card } = cardCell('section', chId);
  cell.dataset.seg = String(segIdx);
  if (seg.id) cell.dataset.sec = seg.id;
  if (seg.virtual) cell.dataset.virtual = '1';
  const note = seg.id ? sectionNote(chId, seg.id) : null;
  const head = document.createElement('div');
  head.className = 'ob-head';
  const letter = document.createElement('span');
  letter.className = 'ob-letter';
  letter.textContent = secLetter(letterIdx);
  head.appendChild(letter);
  if (seg.flag) head.appendChild(cardFlag());
  const text = document.createElement('div');
  text.className = 'ob-text';
  const foot = document.createElement('div');
  foot.className = 'ob-foot';
  foot.textContent = seg.words ? cardWords(seg.words) : t('not written yet');
  card.append(head, text, foot);
  card.classList.toggle('unwritten', !seg.words);
  cell.dataset.written = seg.words ? '1' : '';
  cell.dataset.excerpt = seg.first ? quoted(seg.first) : '';
  fillCardText(cell, note ? note.text : '');
  cell.setAttribute('aria-label', t('Section {letter}', { letter: letter.textContent }) + '. ' + text.textContent + '. ' + foot.textContent);
  return cell;
}

// a card shows its note; with none, the section's first line, in quotes
function fillCardText(cell, note) {
  const text = cell.querySelector('.ob-text');
  text.classList.remove('excerpt', 'empty');
  if (note) text.textContent = note;
  else if (cell.dataset.excerpt) { text.textContent = cell.dataset.excerpt; text.classList.add('excerpt'); }
  else {
    text.textContent = cell.dataset.kind === 'chapter' ? t('What happens in this chapter…') : cell.dataset.kind === 'scene' ? t('What happens in this scene…') : t('What happens in this section…');
    text.classList.add('empty');
  }
}

function cardFlag() {
  const f = document.createElement('span');
  f.className = 'ob-flag';
  f.title = t('Unresolved placeholder');
  return f;
}
function chapterHasFlag(chId) {
  const body = chapterBodyEl(chId);
  return !!(body && body.querySelector('.ph-mark'));
}

// ---- writing on a card ----

let cardEditor = null; // { cell, text, before }

function openCard(cell, { fresh = false } = {}) {
  closeCardEditor();
  const text = cell.querySelector('.ob-text');
  const note = cardNoteOf(cell);
  cell.classList.add('open');
  // a card near the right edge opens toward the left
  const board = outlineBoard();
  const r = cell.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  cell.classList.toggle('open-left', r.left + r.width * 2 > b.right + 4);
  text.classList.remove('excerpt', 'empty');
  text.textContent = note;
  // the page's own first line stays in view above the note, so opening a
  // card never looks like it wiped what was on it
  if (cell.dataset.excerpt && cell.dataset.kind !== 'loose') {
    const from = document.createElement('div');
    from.className = 'ob-from';
    from.textContent = cell.dataset.excerpt;
    text.before(from);
    text.dataset.ph = t('Write a note…');
  } else {
    text.dataset.ph = cell.dataset.kind === 'chapter' ? t('What happens in this chapter…') : cell.dataset.kind === 'scene' ? t('What happens in this scene…') : cell.dataset.kind === 'loose' ? t('Write a note…') : t('What happens in this section…');
  }
  text.contentEditable = 'true';
  text.spellcheck = false;
  text.setAttribute('role', 'textbox');
  // a scene's heading can be set right on its card
  const slug = cell.querySelector('.ob-slug');
  if (slug) {
    slug.contentEditable = 'true';
    slug.spellcheck = false;
    slug.setAttribute('role', 'textbox');
    slug.addEventListener('keydown', slugKeys);
    if (!slug.textContent.trim()) slug.textContent = '';
  }
  // the way to the page, and what Enter does
  const tools = document.createElement('div');
  tools.className = 'ob-tools';
  if (!cell.dataset.new && !cell.dataset.virtual) {
    const go = document.createElement('button');
    go.className = 'ob-go';
    go.type = 'button';
    go.textContent = t('Go to the page');
    go.addEventListener('mousedown', (e) => e.preventDefault()); // keep the note's focus until we leave
    go.onclick = () => { const c = cardEditor && cardEditor.cell; closeCardEditor(); if (c) goToCard(c); };
    tools.appendChild(go);
  }
  if (cell.dataset.kind !== 'loose') {
    const more = document.createElement('button');
    more.type = 'button';
    more.textContent = cell.dataset.kind === 'scene' ? t('New scene') : t('New card');
    more.addEventListener('mousedown', (e) => e.preventDefault());
    more.onclick = () => { const c = cardEditor && cardEditor.cell; if (c) newCardAfter(c); };
    tools.appendChild(more);
  }
  const tip = document.createElement('span');
  tip.textContent = t('Enter: done · Tab: next card · {key}: new card', { key: K('⌥Enter', 'Alt+Enter') });
  tools.appendChild(tip);
  cell.querySelector('.ob-card').appendChild(tools);
  cardEditor = { cell, text, slug, before: note, slugBefore: slug ? slug.textContent : null, fresh };
  text.addEventListener('keydown', cardKeys);
  text.addEventListener('blur', cardBlur);
  text.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' '));
  });
  const first = slug && fresh ? slug : text;
  first.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(first);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  cell.scrollIntoView({ block: 'nearest' });
}

function cardNoteOf(cell) {
  if (cell.dataset.new) return '';
  const chId = cell.dataset.ch;
  if (cell.dataset.kind === 'chapter') return (book.chapterNotes || {})[chId] || '';
  if (cell.dataset.kind === 'loose') return (book.looseCards || []).find((c) => c.id === cell.dataset.loose)?.text || '';
  if (cell.dataset.kind === 'scene') return (cell.dataset.sid && (book.sceneNotes || {})[cell.dataset.sid]) || '';
  const note = cell.dataset.sec ? sectionNote(chId, cell.dataset.sec) : null;
  return note ? note.text : '';
}

function cardBlur() {
  // the window losing focus isn't the writer leaving the card
  setTimeout(() => {
    if (!cardEditor || !document.hasFocus()) return;
    if (cardEditor.cell.contains(document.activeElement) && document.activeElement.isContentEditable) return;
    closeCardEditor();
  }, 0);
}

// save what's on the open card and put it down
function closeCardEditor(quiet = false) {
  const ed = cardEditor;
  if (!ed) return;
  cardEditor = null;
  const { cell, text, slug } = ed;
  text.removeEventListener('keydown', cardKeys);
  text.removeEventListener('blur', cardBlur);
  text.contentEditable = 'false';
  text.removeAttribute('role');
  cell.classList.remove('open', 'open-left');
  cell.querySelector('.ob-tools')?.remove();
  cell.querySelector('.ob-from')?.remove();
  const val = text.textContent.replace(/\s+/g, ' ').trim();
  if (slug) {
    slug.removeEventListener('keydown', slugKeys);
    slug.removeEventListener('blur', cardBlur);
    slug.contentEditable = 'false';
    slug.removeAttribute('role');
    const sv = slug.textContent.replace(/\s+/g, ' ').trim();
    if (!quiet || val !== ed.before || sv !== ed.slugBefore) saveSceneCard(cell, val, sv);
    if (cell.isConnected && cell.dataset.new) cell.remove();
    else if (cell.isConnected) { fillCardText(cell, val); renderBoardLater(); }
    return;
  }
  if (!quiet || val !== ed.before) saveCard(cell, val);
  if (!cell.isConnected) return;
  if (cell.dataset.new && !val) { cell.remove(); return; }
  if (cell.dataset.kind !== 'loose') fillCardText(cell, cardNoteOf(cell));
}

function saveCard(cell, val) {
  if (!book) return;
  const chId = cell.dataset.ch;
  const kind = cell.dataset.kind;
  if (kind === 'loose') { saveLooseCard(cell.dataset.loose, val); return; }
  if (kind === 'chapter') {
    book.chapterNotes = book.chapterNotes || {};
    if ((book.chapterNotes[chId] || '') === val) return;
    book.chapterNotes[chId] = val;
    scheduleMetaSave();
    scheduleNavRefresh();
    return;
  }
  book.sectionNotes = book.sectionNotes || {};
  const list = book.sectionNotes[chId] = book.sectionNotes[chId] || [];
  if (cell.dataset.new) {
    if (!val) return;
    // a new card: a gray ghost on the page, after the card it came from
    const sec = { id: newSectionId(), text: val };
    const body = chapterBodyEl(chId);
    if (!body) return;
    const segs = chapterSegments(chId);
    const after = Number(cell.dataset.after);
    const next = segs[after + 1];
    list.push(sec);
    placeGhost(body, sec, next ? (next.brk || next.ps[0]) : null);
    orderSectionNotes(chId);
    syncChapter(body, chId);
    scheduleMetaSave();
    delete cell.dataset.new;
    cell.dataset.sec = sec.id;
    reindexChapterCards(chId);
    return;
  }
  if (cell.dataset.sec) {
    const sec = list.find((s) => s.id === cell.dataset.sec);
    if (!sec || sec.text === val) return;
    sec.text = val;
    scheduleMetaSave();
    syncGhosts(chId);
    return;
  }
  if (!val) return;
  // a section written without an outline gets its first note: its first
  // line of prose carries the note's id from now on
  const seg = chapterSegments(chId)[Number(cell.dataset.seg)];
  const anchor = seg && seg.ps.find((p) => !p.classList.contains('ghost'));
  if (!anchor) return;
  const sec = { id: newSectionId(), text: val };
  anchor.dataset.secId = sec.id;
  list.push(sec);
  orderSectionNotes(chId);
  syncChapter(chapterBodyEl(chId), chId);
  scheduleMetaSave();
  cell.dataset.sec = sec.id;
}

// after a card is set on the page, the chapter's cards learn their places
// (and letters) again, without redrawing the board under the writer's hand
function reindexChapterCards(chId) {
  const segs = chapterSegments(chId);
  const placed = segs.filter((sg, i) => !(i === 0 && !sg.id));
  const cells = [...outlineBoard().querySelectorAll(`.ob-cell[data-kind="section"][data-ch="${chId}"]`)];
  let k = 0;
  let letter = 0;
  for (const cell of cells) {
    if (!cell.dataset.new) cell.querySelector('.ob-letter').textContent = secLetter(letter++);
    if (cell.dataset.new || cell.dataset.virtual) continue;
    const seg = placed[k++];
    if (seg) cell.dataset.seg = String(segs.indexOf(seg));
  }
}

function cardKeys(e) {
  const ed = cardEditor;
  if (!ed) return;
  const { cell, text } = ed;
  e.stopPropagation();
  if (e.key === 'Escape') {
    e.preventDefault();
    closeCardEditor();
    if (cell.isConnected) cell.focus();
    return;
  }
  if (e.isComposing || e.keyCode === 229) return;
  // Enter: the card is done (and stays where the keyboard is)
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    closeCardEditor();
    if (cell.isConnected) cell.focus();
    else renderBoardFocus(cell);
    return;
  }
  // Tab and ⇧Tab: on to the next card, or back to the one before
  if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    const list = cell.closest('#loose-list') || outlineBoard();
    const cells = [...list.querySelectorAll('.ob-cell')];
    const at = cells.indexOf(cell);
    const ahead = e.shiftKey ? cells.slice(0, at).reverse() : cells.slice(at + 1);
    closeCardEditor();
    const next = ahead.find((c) => c.isConnected);
    if (next) openCard(next);
    else if (cell.isConnected) cell.focus();
    return;
  }
  // ⌥Enter (Alt+Enter): a new card after this one; on an empty new card,
  // a new chapter instead (the manuscript's Enter, Enter)
  if (e.key === 'Enter' && e.altKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    const empty = !text.textContent.trim();
    if (empty && cell.dataset.new && cell.dataset.kind === 'section') {
      const chId = cell.dataset.ch;
      cardEditor = null;
      cell.remove();
      newChapterCard(book.chapterOrder.indexOf(chId) + 1);
      return;
    }
    if (cell.dataset.kind === 'loose') { closeCardEditor(); addLooseCard(); return; }
    newCardAfter(cell);
    return;
  }
  if (e.key === 'Backspace' && !text.textContent) {
    e.preventDefault();
    if (cell.dataset.new) {
      const prev = cell.previousElementSibling;
      cardEditor = null;
      cell.remove();
      if (prev && prev.classList.contains('ob-cell')) openCard(prev);
      return;
    }
    if (cell.dataset.kind === 'loose') { cardEditor = null; removeLooseCard(cell.dataset.loose); return; }
    if (cell.dataset.kind === 'section' && cell.dataset.sec && !cell.dataset.written) {
      const chId = cell.dataset.ch;
      cardEditor = null;
      deleteSectionNote(chId, cell.dataset.sec);
    }
  }
}

// a new card after this one, open to write on
function newCardAfter(cell) {
  closeCardEditor();
  if (!cell.isConnected) return;
  const fresh = makeNewCardAfter(cell, cell.dataset.ch);
  if (fresh) openCard(fresh, { fresh: true });
}

// a new chapter at this place in the book, its card open to write on
function newChapterCard(at) {
  closeCardEditor();
  snapshotStructure('card new chapter');
  const newId = createChapterAt(at);
  updateCounters();
  renderBoard();
  const nc = outlineBoard().querySelector(`.ob-cell[data-kind="chapter"][data-ch="${newId}"]`);
  if (nc) openCard(nc, { fresh: true });
}

// after a redraw, the keyboard goes back to the card it was on
function renderBoardFocus(cell) {
  const sel = cell.dataset.sec ? `.ob-cell[data-sec="${cell.dataset.sec}"]` : cell.dataset.kind === 'chapter' ? `.ob-cell[data-kind="chapter"][data-ch="${cell.dataset.ch}"]` : null;
  setTimeout(() => { const c = sel && outlineBoard().querySelector(sel); if (c) c.focus(); }, 150);
}

// in a scene's heading: Enter or Tab moves on to the note
function slugKeys(e) {
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); const c = cardEditor && cardEditor.cell; closeCardEditor(); if (c && c.isConnected) c.focus(); return; }
  if ((e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    const text = cardEditor && cardEditor.text;
    if (!text) return;
    text.focus();
    const r = document.createRange();
    r.selectNodeContents(text);
    r.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(r);
  }
}

// once a scene card is put down, the board takes in what changed
let boardLater = null;
function renderBoardLater() {
  clearTimeout(boardLater);
  boardLater = setTimeout(() => {
    if (!cardEditor && !cardDrag && currentTab === 'outline' && boardShowing()) renderBoard();
  }, 120);
}

// a blank card right after this one, in its chapter
function makeNewCardAfter(cell, chId) {
  if (!cell.isConnected) return null;
  if (cell.dataset.kind === 'scene') {
    const fresh = sceneCard({ k: -1, s: { p: null }, id: null, slug: '', eighths: 0, cast: [], first: '' });
    fresh.dataset.new = '1';
    fresh.dataset.after = cell.dataset.scene;
    fresh.querySelector('.ob-letter').textContent = '+';
    cell.after(fresh);
    return fresh;
  }
  const segs = chapterSegments(chId);
  let after;
  if (cell.dataset.kind === 'chapter') after = segs[0] && !segs[0].id ? 0 : -1;
  else if (cell.dataset.virtual || Number(cell.dataset.seg) < 0) after = segs.length - 1;
  else after = Number(cell.dataset.seg);
  const fresh = sectionCard(chId, { id: null, ps: [], words: 0, first: '', flag: false }, -1, 0);
  fresh.dataset.new = '1';
  fresh.dataset.after = String(after);
  fresh.querySelector('.ob-letter').textContent = '+';
  // it joins the chapter's mat
  cell.classList.remove('last');
  fresh.classList.add('last');
  let spot = cell;
  // a chapter card's new card goes before its first section
  if (cell.dataset.kind === 'chapter') spot = cell;
  spot.after(fresh);
  // if it landed mid-chapter, it isn't the end of the mat
  const n = fresh.nextElementSibling;
  if (n && n.classList.contains('ob-cell') && n.dataset.ch === chId) fresh.classList.remove('last');
  return fresh;
}

function deleteSectionNote(chId, secId) {
  snapshotStructure('card removed');
  book.sectionNotes[chId] = (book.sectionNotes[chId] || []).filter((s) => s.id !== secId);
  scheduleMetaSave();
  syncGhosts(chId);
  renderBoard();
}

// the card's place in the manuscript
function goToCard(cell) {
  if (cell.dataset.kind === 'scene') { goToScene(cell); return; }
  const chId = cell.dataset.ch;
  switchTab('manuscript');
  if (cell.dataset.kind === 'chapter') {
    focusChapterStart(chId);
    document.querySelector(`.chapter[data-id="${chId}"]`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    return;
  }
  const seg = chapterSegments(chId)[Number(cell.dataset.seg)];
  const p = seg && seg.ps[0];
  const body = chapterBodyEl(chId);
  if (!p || !body) { focusChapterStart(chId); return; }
  body.focus({ preventScroll: true });
  const r = document.createRange();
  if (p.classList.contains('ghost')) r.selectNodeContents(p); // ready to be written over
  else { r.setStart(p, 0); r.collapse(true); }
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  currentChapterId = chId;
  highlightNav();
  p.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
}

async function cardMenu(cell, x, y) {
  const chId = cell.dataset.ch;
  if (cell.dataset.kind === 'chapter') { await chapterMenu(chId, x, y, cell); return; }
  if (cell.dataset.kind === 'loose') {
    const v = await popMenu(x, y, [{ label: t('Delete card'), value: 'delete', danger: true }], { from: cell });
    if (v === 'delete') removeLooseCard(cell.dataset.loose);
    return;
  }
  if (cell.dataset.new) return;
  if (cell.dataset.kind === 'scene') {
    const v = await popMenu(x, y, [
      { label: t('Go to the page'), value: 'go' },
      '-',
      { label: t('Delete the note'), value: 'delete', danger: true, disabled: !cell.dataset.sid }
    ], { from: cell });
    if (v === 'go') goToScene(cell);
    else if (v === 'delete') {
      snapshotStructure('scene note removed');
      delete book.sceneNotes[cell.dataset.sid];
      scheduleMetaSave();
      renderBoard();
    }
    return;
  }
  const linked = !!cell.dataset.sec;
  const written = !!cell.dataset.written;
  const choice = await popMenu(x, y, [
    { label: t('Go to the page'), value: 'go', disabled: !!cell.dataset.virtual },
    { label: t('Make it a chapter'), value: 'chapter', disabled: !!cell.dataset.virtual },
    { label: t('Move to loose cards'), value: 'loose', disabled: written || !linked },
    '-',
    { label: t('Delete the note'), value: 'delete', danger: true, disabled: !linked }
  ], { from: cell });
  if (choice === 'go') goToCard(cell);
  else if (choice === 'chapter') sectionToChapter(chId, Number(cell.dataset.seg));
  else if (choice === 'loose') sectionToLoose(chId, Number(cell.dataset.seg));
  else if (choice === 'delete') {
    deleteSectionNote(chId, cell.dataset.sec);
    if (written) toast(t('The note is gone; the writing stays on the page'));
  }
}

// ---- moving cards ----

// lift a section out of its chapter: its *** and its lines
function liftSegment(body, seg) {
  if (seg.brk) seg.brk.remove();
  for (const p of seg.ps) p.remove();
  // the chapter's first section left: the next one's *** would open the chapter
  if (!seg.brk) {
    const f = body.firstElementChild;
    if (f && f.classList.contains('scene-break')) f.remove();
  }
  if (!body.firstElementChild) body.innerHTML = '<p><br></p>';
}

// set lines down in a chapter, before a section (or at the end)
function setSegmentDown(body, ps, brk, target) {
  const blank = !body.innerText.trim() && !body.querySelector('.scene-break, .ghost, .ph-mark');
  if (!target && blank) {
    body.innerHTML = '';
    for (const p of ps) body.appendChild(p);
    return;
  }
  const tBrk = target && target.brk && target.brk.isConnected ? target.brk : null;
  const tFirst = target && target.ps.find((p) => p.isConnected);
  if (tBrk) {
    body.insertBefore(brk || newSceneBreak(), tBrk);
    for (const p of ps) body.insertBefore(p, tBrk);
    return;
  }
  if (tFirst) {
    // ahead of the chapter's first section
    for (const p of ps) body.insertBefore(p, tFirst);
    body.insertBefore(brk || newSceneBreak(), tFirst);
    return;
  }
  if (!(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) body.appendChild(brk || newSceneBreak());
  for (const p of ps) body.appendChild(p);
}

// placeholders keep their sticky notes pointed at the chapter they're in
function repointStickies(ps, chId) {
  let changed = false;
  for (const p of ps) {
    for (const m of p.querySelectorAll ? p.querySelectorAll('.ph-mark') : []) {
      const s = stickies.find((x) => x.id === m.dataset.sid);
      if (s && s.chapterId !== chId) { s.chapterId = chId; changed = true; }
>>>>>>> upstream
```

### File `.github/workflows/pocket.yml` — conflict 1

- Fork module: [`.github/workflows/pocket.yml` lines 75-83](./.github/workflows/pocket.yml#L75)
- Common base: [`.github/workflows/pocket.yml` lines 75-80](./.github/workflows/pocket.yml#L75)
- Upstream: [`.github/workflows/pocket.yml` lines 75-75](./.github/workflows/pocket.yml#L75)

```diff
<<<<<<< fork
          cp ../app.js www/app.js
          cp ../covers.js www/covers.js
          cp ../styles.css www/styles.css
          cp ../i18n.js www/i18n.js
          rm -rf www/src/renderer
          mkdir -p www/src/renderer
          cp ../src/renderer/*.js www/src/renderer/
          cp ../node_modules/jszip/dist/jszip.min.js www/jszip.min.js
          rm -rf www/fonts www/locales && cp -R ../fonts www/fonts && cp -R ../locales www/locales
||||||| common base
          cp ../app.js www/app.js
          cp ../covers.js www/covers.js
          cp ../styles.css www/styles.css
          cp ../i18n.js www/i18n.js
          cp ../node_modules/jszip/dist/jszip.min.js www/jszip.min.js
          rm -rf www/fonts www/locales && cp -R ../fonts www/fonts && cp -R ../locales www/locales
=======

>>>>>>> upstream
```

### File `AGENTS.md` — conflict 1

- Fork module: [`AGENTS.md` lines 36-36](./AGENTS.md#L36)
- Common base: [`AGENTS.md` lines 36-36](./AGENTS.md#L36)
- Upstream: [`AGENTS.md` lines 36-36](./AGENTS.md#L36)

```diff
<<<<<<< fork
Renderer modules are loaded in order by `index.html`; their responsibilities are listed in [ARCHITECTURE.md](ARCHITECTURE.md).
||||||| common base
`app.js` section banners look like `/*  SAVING  */`. Start there: bookshelf, bound shelves, editor open, typing, poetry, placeholders, nav, tabs, outline, darlings, counters, saving, refresh, structural undo, find, import, spellcheck, focus, goals, export.
=======
`app.js` section banners look like `/*  SAVING  */`. Start there: bookshelf, bound shelves, editor open, typing, poetry, screenplays, placeholders, nav, tabs, outline, outline cards, darlings, counters, saving, refresh, structural undo, find, import, spellcheck, focus, goals, export.
>>>>>>> upstream
```

### File `README.md` — conflict 1

- Fork module: [`README.md` lines 52-52](./README.md#L52)
- Common base: [`README.md` lines 52-52](./README.md#L52)
- Upstream: [`README.md` lines 52-52](./README.md#L52)

```diff
<<<<<<< fork
Outline chapters, scenes, and beats in the Outline tab. Tab on a chapter line makes a scene. Tab on an existing scene adds a beat; Tab on a scene line you just made with Enter turns it into a beat under the scene above. Shift+Tab moves a beat back to the scene level. Their notes appear in the manuscript as gray ghost paragraphs, ready to be overwritten. Scene breaks separate scenes, not beats, and ghost prompts never print. **Format → Merge beats upward when deleting a scene** (⌘⇧M / Ctrl+Shift+M) moves a deleted scene's beats to the scene above; if there isn't one, the prompts go with the scene and the chapter stays. Off by default.
||||||| common base
Outline chapters and sections in the Outline tab; section notes appear in the manuscript as gray ghost paragraphs, ready to be overwritten. Pantsers can ignore all of it or learn to draw a freakin' map for the first time. Try it. You might like it!
=======
The Outline tab lays your book out as index cards, set like a page: they read left to right, line after line, so forty short chapters or a story of thirty scenes both fill the window. Each chapter starts at its big numeral, with its sections following on the same mat. Click a card and write a few lines on it. A section's note shows up in the manuscript as a gray ghost paragraph, and once you start writing, it rides one line below your words until you dismiss it. Drag a card to move it and the writing moves with it (⌘Z puts it back). Pantsers get cards too: every chapter and every *** section is already a card, showing its first line until you give it a note. Ideas without a home wait on loose cards in the right-hand panel. ⌘− shrinks the cards until a whole novel fits on one screen, and the old list is one click away. Pantsers can ignore all of it or learn to draw a freakin' map for the first time. Try it. You might like it!
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 1

- Fork module: [`locales/_template.json` lines 166-167](./locales/_template.json#L166)
- Common base: [`locales/_template.json` lines 166-166](./locales/_template.json#L166)
- Upstream: [`locales/_template.json` lines 166-167](./locales/_template.json#L166)

```diff
<<<<<<< fork
  "Delete this beat?": "",
  "Delete this scene?": "",
||||||| common base
  "Delete this section?": "",
=======
  "Delete the note": "",
  "Delete this section?": "",
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 2

- Fork module: [`locales/_template.json` lines 206-206](./locales/_template.json#L206)
- Common base: [`locales/_template.json` lines 206-206](./locales/_template.json#L206)
- Upstream: [`locales/_template.json` lines 206-207](./locales/_template.json#L206)

```diff
<<<<<<< fork
  "Enter — new line · Tab — chapter to scene, or scene to beat · Shift+Tab — scene to chapter, or beat to scene · Backspace on an empty line removes it": "",
||||||| common base
  "Enter — new chapter (or section, from a section line) · Tab — turn a fresh chapter line into a section · Shift+Tab — turn a section into a chapter · Backspace on an empty line removes it": "",
=======
  "Enter": "",
  "Enter — new chapter · Tab — make it a section, or a new section below one · ⇧Tab — make it a chapter again · Backspace on an empty line removes it": "",
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 3

- Fork module: [`locales/_template.json` lines 279-279](./locales/_template.json#L279)
- Common base: [`locales/_template.json` lines 279-279](./locales/_template.json#L279)
- Upstream: [`locales/_template.json` lines 279-279](./locales/_template.json#L279)

```diff
<<<<<<< fork
  "If there is no scene above, the scene and its beats are removed; the chapter stays.": "",
||||||| common base

=======
  "Ideas without a chapter yet. Drag one onto the board when it finds its place.": "",
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 4

- Fork module: [`locales/_template.json` lines 558-558](./locales/_template.json#L558)
- Common base: [`locales/_template.json` lines 558-558](./locales/_template.json#L558)
- Upstream: [`locales/_template.json` lines 558-558](./locales/_template.json#L558)

```diff
<<<<<<< fork
  "This chapter already has words in it — only empty chapter lines can become scenes": "",
||||||| common base
  "This chapter already has words in it — only empty chapter lines can become sections": "",
=======

>>>>>>> upstream
```

### File `locales/_template.json` — conflict 5

- Fork module: [`locales/_template.json` lines 613-613](./locales/_template.json#L613)
- Common base: [`locales/_template.json` lines 613-613](./locales/_template.json#L613)
- Upstream: [`locales/_template.json` lines 613-614](./locales/_template.json#L613)

```diff
<<<<<<< fork

||||||| common base
  "What happens in this section…": "",
=======
  "What happens in this scene…": "",
  "What happens in this section…": "",
>>>>>>> upstream
```

### File `locales/fr.json` — conflict 1

- Fork module: [`locales/fr.json` lines 153-153](./locales/fr.json#L153)
- Common base: [`locales/fr.json` lines 153-153](./locales/fr.json#L153)
- Upstream: [`locales/fr.json` lines 153-154](./locales/fr.json#L153)

```diff
<<<<<<< fork

||||||| common base
  "Delete this section?": "Supprimer cette section ?",
=======
  "Delete the note": "Supprimer la note",
  "Delete this section?": "Supprimer cette section ?",
>>>>>>> upstream
```

### File `locales/fr.json` — conflict 2

- Fork module: [`locales/fr.json` lines 543-543](./locales/fr.json#L543)
- Common base: [`locales/fr.json` lines 543-543](./locales/fr.json#L543)
- Upstream: [`locales/fr.json` lines 543-544](./locales/fr.json#L543)

```diff
<<<<<<< fork

||||||| common base
  "What happens in this section…": "Que se passe-t-il dans cette section ?",
=======
  "What happens in this scene…": "Ce qui se passe dans cette scène…",
  "What happens in this section…": "Que se passe-t-il dans cette section ?",
>>>>>>> upstream
```

---

## Upstream sync conflict — 2026-10-06T16:48:06.384Z

- Upstream: `upstream/main` at `accb7960924a080ddfac6f91ffabed25f6c2ad97`
- Common base: `db326f75645c4e51506cf30889cd3bd23fb3dc72`
- No source files were changed by this run.

### Renderer module `outline.js` — conflict 1

- Fork module: [`src/renderer/outline.js` lines 59-59](./src/renderer/outline.js#L59)
- Common base: [`app.js` lines 5506-5506](./app.js#L5506)
- Upstream: [`app.js` lines 7131-7131](./app.js#L7131)

```diff
<<<<<<< fork
  hint.textContent = t('Enter — new line · Tab — chapter to scene, or scene to beat · Shift+Tab — scene to chapter, or beat to scene · Backspace on an empty line removes it');
||||||| common base
  hint.textContent = t('Enter — new chapter (or section, from a section line) · Tab — turn a fresh chapter line into a section · Shift+Tab — turn a section into a chapter · Backspace on an empty line removes it');
=======
  hint.textContent = t('Enter — new chapter · Tab — make it a section, or a new section below one · ⇧Tab — make it a chapter again · Backspace on an empty line removes it');
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 2

- Fork module: [`src/renderer/outline.js` lines 274-288](./src/renderer/outline.js#L274)
- Common base: [`app.js` lines 5721-5732](./app.js#L5721)
- Upstream: [`app.js` lines 7346-7350](./app.js#L7346)

```diff
<<<<<<< fork
      if (kind === 'chapter') {
        const at = book.chapterOrder.indexOf(chId) + (above ? 0 : 1);
        const newId = createChapterAt(at);
        renderOutline({ chId: newId });
      } else if (kind === 'section') {
        const list = book.sectionNotes[chId];
        const newSec = { id: 'sec-' + Date.now().toString(36), text: '' };
        list.splice(index + (above ? 0 : 1), 0, newSec);
        freshSceneId = newSec.id;
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ secId: newSec.id });
      } else {
        addBeat(chId, secId, index + (above ? 0 : 1));
      }
||||||| common base
      if (kind === 'chapter') {
        const at = book.chapterOrder.indexOf(chId) + (above ? 0 : 1);
        const newId = createChapterAt(at);
        renderOutline({ chId: newId });
      } else {
        const list = book.sectionNotes[chId];
        const newSec = { id: 'sec-' + Date.now().toString(36), text: '' };
        list.splice(index + (above ? 0 : 1), 0, newSec);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ secId: newSec.id });
      }
=======
      snapshotStructure('outline new chapter', { outlineFocus: here() });
      const at = book.chapterOrder.indexOf(chId) + (above ? 0 : 1);
      const newId = createChapterAt(at);
      updateCounters();
      renderOutline({ chId: newId });
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 3

- Fork module: [`src/renderer/outline.js` lines 321-334](./src/renderer/outline.js#L321)
- Common base: [`app.js` lines 5768-5774](./app.js#L5768)
- Upstream: [`app.js` lines 7393-7393](./app.js#L7393)

```diff
<<<<<<< fork
      if (kind === 'section') {
        save();
        if (secId === freshSceneId && indentFreshScene(chId, secId)) return;
        if (secId === freshSceneId) freshSceneId = null;
        addBeat(chId, secId, ((book.sectionNotes[chId] || []).find((s) => s.id === secId)?.beats || []).length);
        return;
      }
      if (kind !== 'chapter') return;
      const prevCh = storyBefore(chId);
      if (!prevCh) { toast(t('The first line has to be a chapter')); return; }
      if (countWords(chapterText(chId)) > 0) {
        toast(t('This chapter already has words in it — only empty chapter lines can become scenes'));
        return;
      }
||||||| common base
      if (kind !== 'chapter') return;
      const prevCh = storyBefore(chId);
      if (!prevCh) { toast(t('The first line has to be a chapter')); return; }
      if (countWords(chapterText(chId)) > 0) {
        toast(t('This chapter already has words in it — only empty chapter lines can become sections'));
        return;
      }
=======
      e.stopPropagation();
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 4

- Fork module: [`src/renderer/outline.js` lines 407-421](./src/renderer/outline.js#L407)
- Common base: [`app.js` lines 5854-5855](./app.js#L5854)
- Upstream: [`app.js` lines 7479-7485](./app.js#L7479)

```diff
<<<<<<< fork
      const sec = list.find((s) => s.id === secId);
      if (!sec) return;
      const beats = sec.beats || [];
      const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
      const writtenBeats = new Map(beats.map((beat) => {
        const p = body && body.querySelector(`p[data-beat-id="${beat.id}"]:not(.ghost)`);
        if (!p) return null;
        const copy = p.cloneNode(true);
        copy.removeAttribute('data-beat-id');
        copy.dataset.secId = beat.id;
        p.remove();
        return [beat.id, copy.outerHTML];
      }).filter(Boolean));
      list.splice(list.indexOf(sec), 1);
      syncGhosts(chId);
||||||| common base
      const sec = list.find((s) => s.id === secId);
      list.splice(list.indexOf(sec), 1);
=======
      const from = list.findIndex((s) => s.id === secId);
      // the section and the ones after it leave together, so the book's order
      // holds (B in A B C: B and C make the next chapter, A stays). Sections
      // already written over keep their prose here, so those stay here too.
      const [sec, ...after] = list.splice(from);
      const carry = after.length > 0 && !after.some((s) => sectionWritten(chId, s.id));
      if (!carry) list.push(...after);
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 5

- Fork module: [`src/renderer/outline.js` lines 438-451](./src/renderer/outline.js#L438)
- Common base: [`app.js` lines 5885-5885](./app.js#L5885)
- Upstream: [`app.js` lines 7510-7510](./app.js#L7510)

```diff
<<<<<<< fork
      if (beats.length) {
        book.sectionNotes[newId] = beats.map((beat) => ({ id: beat.id, text: beat.text }));
        const content = [];
        for (const beat of beats) {
          const para = writtenBeats.get(beat.id) ||
            (beat.text ? `<p class="ghost" data-sec-id="${beat.id}">${escHtml(beat.text)}</p>` : '');
          if (!para) continue;
          if (content.length) content.push(`<p class="scene-break" data-sec-brk="${beat.id}">***</p>`);
          content.push(para);
        }
        chapterHTML[newId] = content.join('') || '<p><br></p>';
        persistChapter(newId);
        renderChapters();
      }
||||||| common base

=======
      if (carry) book.sectionNotes[newId] = after;
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 6

- Fork module: [`src/renderer/outline.js` lines 458-458](./src/renderer/outline.js#L458)
- Common base: [`app.js` lines 5905-5905](./app.js#L5905)
- Upstream: [`app.js` lines 7530-7531](./app.js#L7530)

```diff
<<<<<<< fork

||||||| common base
      syncGhosts(chId);
=======
      syncGhosts(chId);
      if (carry) syncGhosts(newId);
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 7

- Fork module: [`src/renderer/outline.js` lines 469-469](./src/renderer/outline.js#L469)
- Common base: [`app.js` lines 5916-5916](./app.js#L5916)
- Upstream: [`app.js` lines 7541-7542](./app.js#L7541)

```diff
<<<<<<< fork
      if (kind === 'section' || kind === 'beat') {
||||||| common base
      if (kind === 'section') {
=======
      if (kind === 'section') {
        snapshotStructure('outline section removed', { outlineFocus: here() });
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 8

- Fork module: [`src/renderer/outline.js` lines 502-506](./src/renderer/outline.js#L502)
- Common base: [`app.js` lines 5949-5954](./app.js#L5949)
- Upstream: [`app.js` lines 7574-7580](./app.js#L7574)

```diff
<<<<<<< fork
        if (kind === 'beat') {
          removeBeat(chId, secId, beatId, index);
        } else {
          removeScene(chId, secId, index);
        }
||||||| common base
        const list = book.sectionNotes[chId] || [];
        const focus = focusAfterSectionRemoved(list, index, chId);
        book.sectionNotes[chId] = list.filter((s) => s.id !== secId);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline(focus);
=======
        snapshotStructure('outline section removed', { outlineFocus: here() });
        const list = book.sectionNotes[chId] || [];
        const focus = focusAfterSectionRemoved(list, index, chId);
        book.sectionNotes[chId] = list.filter((s) => s.id !== secId);
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline(focus);
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 9

- Fork module: [`src/renderer/outline.js` lines 533-535](./src/renderer/outline.js#L533)
- Common base: [`app.js` lines 5980-5982](./app.js#L5980)
- Upstream: [`app.js` lines 7605-7615](./app.js#L7605)

```diff
<<<<<<< fork
// Push scene and beat notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between scenes and none between beats.
// Once a ghost has been written over, it goes away.
||||||| common base
// Push section notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between sections.
// Once a ghost has been written over, it goes away.
=======
// a section whose outline line the writer has written over: prose of their
// own now stands where its gray ghost was
function sectionWritten(chId, secId) {
  return !!document.querySelector(`.chapter[data-id="${chId}"] .chapter-body p[data-sec-id="${secId}"]:not(.ghost)`);
}

// Push section notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between sections. A ghost stays where it is
// (the cards can set one between two written sections); a note the page
// doesn't have yet goes in before the next section that's already there,
// else at the end. Once a ghost has been written over, it's prose.
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 10

- Fork module: [`src/renderer/outline.js` lines 558-559](./src/renderer/outline.js#L558)
- Common base: [`app.js` lines 6005-6005](./app.js#L6005)
- Upstream: [`app.js` lines 7630-7630](./app.js#L7630)

```diff
<<<<<<< fork
  const keep = new Set(list.map((s) => s.id));
  const keepBeats = new Set(list.flatMap((s) => (s.beats || []).map((b) => b.id)));
||||||| common base
  const keep = new Set(list.map((s) => s.id));
=======
  const notes = new Map(list.map((s) => [s.id, s]));
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 11

- Fork module: [`src/renderer/outline.js` lines 588-590](./src/renderer/outline.js#L588)
- Common base: [`app.js` lines 6035-6035](./app.js#L6035)
- Upstream: [`app.js` lines 7660-7661](./app.js#L7660)

```diff
<<<<<<< fork
  body.querySelectorAll('p.ghost[data-beat-id]').forEach((p) => {
    if (!keepBeats.has(p.dataset.beatId)) p.remove();
  });
||||||| common base

=======
  syncChapter(body, chId);
}
>>>>>>> upstream
```

### Renderer module `outline.js` — conflict 12

- Fork module: [`src/renderer/outline.js` lines 598-639](./src/renderer/outline.js#L598)
- Common base: [`app.js` lines 6045-6064](./app.js#L6045)
- Upstream: [`app.js` lines 7670-8599](./app.js#L7670)

```diff
<<<<<<< fork
  // 2. Pull all still-ghost paragraphs out, then re-append in outline order
  //    so the ghosts always mirror the outline's sequence
  for (const p of [...body.querySelectorAll('p.ghost[data-sec-id]')]) {
    const brk = breakFor(p.dataset.secId);
    if (brk) brk.remove();
    p.remove();
  }
  body.querySelectorAll('p.ghost[data-beat-id]').forEach((p) => p.remove());
  for (const sec of list) {
    let scene = body.querySelector(`p[data-sec-id="${sec.id}"]`);
    if (!scene && sec.text) {
      // *** between this scene and whatever comes before it
      const hasContent = body.innerText.trim() !== '';
      if (hasContent && !(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) {
        const brk = document.createElement('p');
        brk.className = 'scene-break';
        brk.dataset.secBrk = sec.id;
        brk.textContent = '***';
        body.appendChild(brk);
      }
      scene = document.createElement('p');
      scene.className = 'ghost';
      scene.dataset.secId = sec.id;
      scene.textContent = sec.text;
      body.appendChild(scene);
    }
    let anchor = scene;
    for (const beat of sec.beats || []) {
      const written = body.querySelector(`p[data-beat-id="${beat.id}"]:not(.ghost)`);
      if (written) { anchor = written; continue; }
      if (!beat.text) continue;
      const p = document.createElement('p');
      p.className = 'ghost';
      p.dataset.beatId = beat.id;
      p.textContent = beat.text;
      if (anchor) {
        anchor.after(p);
        anchor = p;
      } else {
        body.appendChild(p);
        anchor = p;
      }
||||||| common base
  // 2. Pull all still-ghost paragraphs out, then re-append in outline order
  //    so the ghosts always mirror the outline's sequence
  for (const p of [...body.querySelectorAll('p.ghost[data-sec-id]')]) {
    const brk = breakFor(p.dataset.secId);
    if (brk) brk.remove();
    p.remove();
  }
  for (const sec of list) {
    // written over already? Leave it alone
    const written = body.querySelector(`p[data-sec-id="${sec.id}"]:not(.ghost)`);
    if (written) continue;
    if (!sec.text) continue;
    // *** between this ghost and whatever comes before it
    const hasContent = body.innerText.trim() !== '';
    if (hasContent && !(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) {
      const brk = document.createElement('p');
      brk.className = 'scene-break';
      brk.dataset.secBrk = sec.id;
      brk.textContent = '***';
      body.appendChild(brk);
=======
// where the section holding el begins: its *** (or the body's first line)
function segmentStartEl(body, el) {
  let n = el;
  while (n.parentElement && n.parentElement !== body) n = n.parentElement;
  for (let q = n; q; q = q.previousElementSibling) {
    if (q.classList.contains('scene-break')) return q;
    if (!q.previousElementSibling) return q;
  }
  return n;
}

function newSceneBreak(secId) {
  const b = document.createElement('p');
  b.className = 'scene-break';
  if (secId) b.dataset.secBrk = secId;
  b.textContent = '***';
  return b;
}

function placeGhost(body, sec, before) {
  const p = document.createElement('p');
  p.className = 'ghost';
  p.dataset.secId = sec.id;
  p.textContent = sec.text;
  if (before && before.parentElement === body) {
    if (before.classList.contains('scene-break')) {
      body.insertBefore(newSceneBreak(sec.id), before);
      body.insertBefore(p, before);
    } else {
      // the first section of the chapter: the ghost goes ahead of it
      body.insertBefore(p, before);
      body.insertBefore(newSceneBreak(sec.id), before);
    }
    return p;
  }
  const hasContent = body.innerText.trim() !== '';
  if (hasContent && !(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) {
    body.appendChild(newSceneBreak(sec.id));
  }
  body.appendChild(p);
  return p;
}

// a ghost leaves, and so does the *** that set it apart
function removeGhost(body, p) {
  const prev = p.previousElementSibling;
  const next = p.nextElementSibling;
  const isBrk = (q) => q && q.classList.contains('scene-break');
  if (isBrk(prev) && (!next || isBrk(next))) prev.remove();
  else if (!prev && isBrk(next)) next.remove();
  p.remove();
  if (!body.firstElementChild) body.innerHTML = '<p><br></p>';
}

/* ================================================================== */
/*  OUTLINE CARDS                                                      */
/*  The outline as index cards, set like a page: they read left to    */
/*  right, line after line, so any shape of book fills the window. A   */
/*  chapter starts at its numeral, and its cards share a mat, rounded  */
/*  where the chapter starts and ends and cut square where it wraps.   */
/*  Parts start a fresh line. Sections are the manuscript's own: every */
/*  *** makes one, outlined or not, and a card shows its note or else  */
/*  the section's first line, in quotes. Dragging a card moves the     */
/*  writing with it (⌘Z puts it back). Loose cards, ideas that don't   */
/*  have a chapter yet, wait in the right-hand pane (book.looseCards). */
/*  A script's cards are its scenes (book.sceneNotes holds their notes). */
/* ================================================================== */

const outlineCardsOn = () => !!book && (isScript() || (library.outlineView || 'cards') === 'cards');
const chapterBodyEl = (chId) => document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
const newSectionId = () => 'sec-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

// A chapter cut at its *** lines. Each piece: its *** (none for the first),
// its paragraphs, the outline note it belongs to (if any), and what's on it.
// A paragraph split from a written ghost carries the ghost's id along, so
// only the first piece to hold an id is that note's.
function chapterSegments(chId) {
  const body = chapterBodyEl(chId);
  if (!body) return [];
  const segs = [];
  let cur = { brk: null, ps: [] };
  for (const el of body.children) {
    if (el.classList.contains('scene-break')) { segs.push(cur); cur = { brk: el, ps: [] }; }
    else cur.ps.push(el);
  }
  segs.push(cur);
  const notes = new Set(((book.sectionNotes || {})[chId] || []).map((s) => s.id));
  const claimed = new Set();
  for (const seg of segs) {
    const tagged = seg.ps.find((p) => p.dataset && notes.has(p.dataset.secId) && !claimed.has(p.dataset.secId));
    seg.id = tagged ? tagged.dataset.secId : null;
    if (seg.id) claimed.add(seg.id);
    const prose = seg.ps.filter((p) => !p.classList.contains('ghost'));
    seg.words = countWords(prose.map((p) => p.textContent).join('\n'));
    seg.first = prose.map((p) => p.textContent.replace(/\s+/g, ' ').trim()).find(Boolean) || '';
    seg.flag = seg.ps.some((p) => p.querySelector && p.querySelector('.ph-mark'));
  }
  return segs;
}

// the note a section has, if it has one
const sectionNote = (chId, secId) => ((book.sectionNotes || {})[chId] || []).find((s) => s.id === secId) || null;

// keep a chapter's notes in the order their sections stand on the page
// (a note with no place yet keeps to the end)
function orderSectionNotes(chId) {
  const list = (book.sectionNotes || {})[chId];
  if (!list) return;
  const ids = chapterSegments(chId).map((s) => s.id).filter(Boolean);
  const placed = ids.map((id) => list.find((s) => s.id === id)).filter(Boolean);
  book.sectionNotes[chId] = placed.concat(list.filter((s) => !ids.includes(s.id)));
}

// Zoom is per mode and per device. Novel and script keep their own page zoom, and the outline's
// cards keep their own; none of them travel in library.json, so a phone never inherits the zoom a
// desktop set. `library.pageZoom` / `library.cardZoom` stay as the fallback for devices that have
// not chosen yet, which keeps an existing zoom as the default.
const PAGE_ZOOM_RANGE = { min: 0.75, max: 3 };
const CARD_ZOOM_RANGE = { min: 0.55, max: 1.5 };
const CARD_ZOOM_KEY = 'neo.cardZoom';
const pageZoomKey = () => 'neo.pageZoom.' + (isScript() ? 'script' : 'novel');

/** The stored zoom, or the fallback, always inside the range. Split out so a test can hold it. */
function resolveStoredZoom(raw, fallback, min, max) {
  const value = raw === null || raw === '' ? NaN : Number(raw);
  const chosen = Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, chosen));
}

function readStoredZoom(key, fallback, range) {
  let raw = null;
  try { raw = localStorage.getItem(key); } catch { /* storage can be off */ }
  return resolveStoredZoom(raw, fallback || 1, range.min, range.max);
}

function rememberZoom(key, value) {
  try { localStorage.setItem(key, String(value)); } catch { /* storage can be off */ }
}

const activePageZoom = () => readStoredZoom(pageZoomKey(), library.pageZoom || 1, PAGE_ZOOM_RANGE);
function applyPageZoom() {
  document.documentElement.style.setProperty('--page-zoom', activePageZoom());
  updateZoomDisplay();
}

function cardZoom() { return readStoredZoom(CARD_ZOOM_KEY, library.cardZoom || 1, CARD_ZOOM_RANGE); }
const CARD_ZOOMS = [0.55, 0.7, 0.85, 1, 1.15, 1.3, 1.5];
function stepCardZoom(dir) {
  const now = cardZoom();
  let next = now;
  if (dir === 0) next = 1;
  else if (dir > 0) next = CARD_ZOOMS.find((z) => z > now + 0.001) || now;
  else next = [...CARD_ZOOMS].reverse().find((z) => z < now - 0.001) || now;
  if (next === now) return;
  rememberZoom(CARD_ZOOM_KEY, next);
  renderBoard();
  updateZoomDisplay();
}

// ---- the board ----

function outlineBoard() {
  let board = $('#outline-board');
  if (board) return board;
  board = document.createElement('div');
  board.id = 'outline-board';
  board.hidden = true;
  board.setAttribute('role', 'list');
  board.setAttribute('aria-label', t('Outline cards'));
  $('#outline-list').after(board);
  board.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.ob-cell');
    if (!cell || e.button !== 0 || cell.classList.contains('open')) return;
    if (e.target.closest('button')) return;
    cardPress(e, { kind: cell.dataset.kind, cell });
  });
  board.addEventListener('contextmenu', (e) => {
    const cell = e.target.closest('.ob-cell');
    if (!cell || cell.classList.contains('open')) return;
    e.preventDefault();
    if (NO_HOVER) return; // a long press is the menu there (cardPress)
    cardMenu(cell, e.clientX, e.clientY);
  });
  board.addEventListener('keydown', (e) => {
    const cell = e.target.closest && e.target.closest('.ob-cell');
    if (!cell || cell.classList.contains('open')) return;
    if (e.key === 'Enter' && e.altKey) { e.preventDefault(); newCardAfter(cell); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(cell); }
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); cardMenu(cell, 0, 0); }
    else if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      const cells = [...board.querySelectorAll('.ob-cell')];
      const i = cells.indexOf(cell);
      let next = null;
      if (e.key === 'ArrowRight') next = cells[i + 1];
      else if (e.key === 'ArrowLeft') next = cells[i - 1];
      else {
        // the card above or below: the nearest one in the next line
        const r = cell.getBoundingClientRect();
        const down = e.key === 'ArrowDown';
        let best = Infinity;
        for (const c of cells) {
          const q = c.getBoundingClientRect();
          if (down ? q.top <= r.top + 4 : q.top >= r.top - 4) continue;
          const d = Math.abs(q.top - r.top) * 4 + Math.abs(q.left - r.left);
          if (d < best) { best = d; next = c; }
        }
      }
      if (next) { next.focus(); next.scrollIntoView({ block: 'nearest' }); }
    }
  });
  return board;
}

function viewSwitch() {
  let sw = $('#outline-views');
  if (sw) return sw;
  sw = document.createElement('div');
  sw.id = 'outline-views';
  sw.setAttribute('role', 'group');
  sw.setAttribute('aria-label', t('Outline view'));
  for (const [value, label] of [['list', t('List')], ['cards', t('Cards')]]) {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.view = value;
    b.textContent = label;
    b.onclick = () => {
      if ((library.outlineView || 'cards') === value) return;
      closeCardEditor();
      library.outlineView = value;
      writeLibrary(library);
      renderOutline();
    };
    sw.appendChild(b);
  }
  $('#aux-title').after(sw);
  return sw;
}

// called by renderOutline: shows the list or the board
function showOutlineView() {
  const sw = viewSwitch();
  const cards = outlineCardsOn();
  sw.hidden = !book || isScript(); // a script has only the cards
  for (const b of sw.querySelectorAll('button')) {
    const on = b.dataset.view === (cards ? 'cards' : 'list');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  }
  $('#outline-list').hidden = cards;
  outlineBoard().hidden = !cards;
  $('#editor-view').classList.toggle('board-on', cards);
  updateZoomDisplay();
  return cards;
}

function renderBoard() {
  const board = outlineBoard();
  if (!book) return;
  closeCardEditor(true);
  board.innerHTML = '';
  const z = cardZoom();
  board.style.setProperty('--cz', z);
  board.classList.toggle('tiles', z < 0.8);
  board.classList.remove('script-board');
  if (isScript()) { renderScriptBoard(board); boardAddCard(board); boardHint(board); return; }
  const solo = soloStory();
  for (const chId of book.chapterOrder) {
    const kind = chapterKind(chId);
    if (kind === 'part') { board.appendChild(boardPartRow(chId)); continue; }
    if (!STORY_KINDS.includes(kind)) continue;
    const segs = chapterSegments(chId);
    const opening = segs[0] && !segs[0].id ? segs[0] : null;
    const run = [chapterCard(chId, opening, solo === chId)];
    let letter = 0;
    segs.forEach((seg, i) => {
      if (seg === opening) return;
      run.push(sectionCard(chId, seg, i, letter++));
    });
    // notes the page doesn't hold yet (written but emptied, or just made)
    const onPage = new Set(segs.map((s) => s.id).filter(Boolean));
    for (const sec of (book.sectionNotes || {})[chId] || []) {
      if (onPage.has(sec.id)) continue;
      run.push(sectionCard(chId, { id: sec.id, ps: [], words: 0, first: '', flag: false, virtual: true }, -1, letter++));
    }
    run.forEach((cell, i) => {
      if (i === 0) cell.classList.add('first');
      if (i === run.length - 1) cell.classList.add('last');
      board.appendChild(cell);
    });
  }
  boardAddCard(board);
  boardHint(board);
}

function boardHint(board) {
  let hint = $('#outline-board-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'outline-board-hint';
    hint.className = 'ol-hint';
    board.after(hint);
  }
  hint.hidden = false;
  hint.textContent = NO_HOVER
    ? t('Tap a card to write on it · hold a card to move it · hold and let go for more · + adds a card')
    : isScript()
      ? t('Click a card to write on it · drag it to move the scene · right-click for more · + adds a scene')
      : t('Click a card to write on it · drag it to move it, writing and all · right-click for more · + adds a card');
}

function boardPartRow(chId) {
  const row = document.createElement('div');
  row.className = 'ob-part';
  row.setAttribute('role', 'heading');
  row.setAttribute('aria-level', '3');
  const title = partTitleOf(chId);
  const label = document.createElement('span');
  label.textContent = chapterName(chId) + (title ? ' · ' + title : '');
  const rule = document.createElement('span');
  rule.className = 'ob-rule';
  row.append(label, rule);
  row.addEventListener('contextmenu', (e) => { e.preventDefault(); chapterMenu(chId, e.clientX, e.clientY, row); });
  return row;
}

function cardCell(kind, chId) {
  const cell = document.createElement('div');
  cell.className = 'ob-cell';
  cell.dataset.kind = kind;
  cell.dataset.ch = chId;
  cell.tabIndex = 0;
  cell.setAttribute('role', 'listitem');
  const card = document.createElement('div');
  card.className = 'ob-card ob-' + kind;
  cell.appendChild(card);
  if (kind !== 'loose') {
    // a + on the seam after the card: a new card right there
    const plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'ob-plus';
    plus.textContent = '+';
    plus.title = kind === 'scene' ? t('New scene after this one') : t('New card after this one');
    plus.setAttribute('aria-label', plus.title);
    plus.tabIndex = -1; // the keyboard has ⌥Enter
    plus.addEventListener('click', (e) => { e.stopPropagation(); if (!cell.dataset.new) newCardAfter(cell); });
    cell.appendChild(plus);
  }
  return { cell, card };
}

// the last place on the board: a new chapter (or scene) at the end
function boardAddCard(board) {
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'ob-add';
  const script = isScript();
  add.textContent = script ? t('+ Scene') : t('+ Chapter');
  add.addEventListener('click', () => {
    if (script) {
      const cells = [...board.querySelectorAll('.ob-cell[data-kind="scene"]')];
      const last = cells[cells.length - 1];
      if (last) { newCardAfter(last); return; }
      const fresh = sceneCard({ k: -1, s: { p: null }, id: null, slug: '', eighths: 0, cast: [], first: '' });
      fresh.dataset.new = '1';
      fresh.dataset.after = '-1';
      add.before(fresh);
      openCard(fresh, { fresh: true });
      return;
    }
    newChapterCard(storyEnd());
  });
  board.appendChild(add);
}

const cardWords = (n) => (n ? t('{n} words', { n: n.toLocaleString() }) : '');
const quoted = (s) => '“' + (s.length > 220 ? s.slice(0, 220).trim() + '…' : s) + '”';

function chapterCard(chId, opening, solo) {
  const { cell, card } = cardCell('chapter', chId);
  const kind = chapterKind(chId);
  const head = document.createElement('div');
  head.className = 'ob-head';
  const mark = document.createElement('span');
  mark.className = 'ob-mark';
  if (solo) { mark.textContent = t('The story'); mark.classList.add('ob-word'); }
  else if (kind === 'chapter') mark.textContent = String(chapterNumber(chId));
  else { mark.textContent = chapterName(chId); mark.classList.add('ob-word'); }
  const words = document.createElement('span');
  words.className = 'ob-words';
  const n = countWords(chapterText(chId));
  words.textContent = cardWords(n);
  head.append(mark, words);
  if (chapterHasFlag(chId)) head.appendChild(cardFlag());
  const text = document.createElement('div');
  text.className = 'ob-text';
  card.append(head, text);
  cell.dataset.excerpt = opening && opening.first ? quoted(opening.first) : '';
  fillCardText(cell, (book.chapterNotes || {})[chId] || '');
  cell.setAttribute('aria-label', (solo ? t('The story') : chapterName(chId)) + '. ' + text.textContent);
  return cell;
}

function sectionCard(chId, seg, segIdx, letterIdx) {
  const { cell, card } = cardCell('section', chId);
  cell.dataset.seg = String(segIdx);
  if (seg.id) cell.dataset.sec = seg.id;
  if (seg.virtual) cell.dataset.virtual = '1';
  const note = seg.id ? sectionNote(chId, seg.id) : null;
  const head = document.createElement('div');
  head.className = 'ob-head';
  const letter = document.createElement('span');
  letter.className = 'ob-letter';
  letter.textContent = secLetter(letterIdx);
  head.appendChild(letter);
  if (seg.flag) head.appendChild(cardFlag());
  const text = document.createElement('div');
  text.className = 'ob-text';
  const foot = document.createElement('div');
  foot.className = 'ob-foot';
  foot.textContent = seg.words ? cardWords(seg.words) : t('not written yet');
  card.append(head, text, foot);
  card.classList.toggle('unwritten', !seg.words);
  cell.dataset.written = seg.words ? '1' : '';
  cell.dataset.excerpt = seg.first ? quoted(seg.first) : '';
  fillCardText(cell, note ? note.text : '');
  cell.setAttribute('aria-label', t('Section {letter}', { letter: letter.textContent }) + '. ' + text.textContent + '. ' + foot.textContent);
  return cell;
}

// a card shows its note; with none, the section's first line, in quotes
function fillCardText(cell, note) {
  const text = cell.querySelector('.ob-text');
  text.classList.remove('excerpt', 'empty');
  if (note) text.textContent = note;
  else if (cell.dataset.excerpt) { text.textContent = cell.dataset.excerpt; text.classList.add('excerpt'); }
  else {
    text.textContent = cell.dataset.kind === 'chapter' ? t('What happens in this chapter…') : cell.dataset.kind === 'scene' ? t('What happens in this scene…') : t('What happens in this section…');
    text.classList.add('empty');
  }
}

function cardFlag() {
  const f = document.createElement('span');
  f.className = 'ob-flag';
  f.title = t('Unresolved placeholder');
  return f;
}
function chapterHasFlag(chId) {
  const body = chapterBodyEl(chId);
  return !!(body && body.querySelector('.ph-mark'));
}

// ---- writing on a card ----

let cardEditor = null; // { cell, text, before }

function openCard(cell, { fresh = false } = {}) {
  closeCardEditor();
  const text = cell.querySelector('.ob-text');
  const note = cardNoteOf(cell);
  cell.classList.add('open');
  // a card near the right edge opens toward the left
  const board = outlineBoard();
  const r = cell.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  cell.classList.toggle('open-left', r.left + r.width * 2 > b.right + 4);
  text.classList.remove('excerpt', 'empty');
  text.textContent = note;
  // the page's own first line stays in view above the note, so opening a
  // card never looks like it wiped what was on it
  if (cell.dataset.excerpt && cell.dataset.kind !== 'loose') {
    const from = document.createElement('div');
    from.className = 'ob-from';
    from.textContent = cell.dataset.excerpt;
    text.before(from);
    text.dataset.ph = t('Write a note…');
  } else {
    text.dataset.ph = cell.dataset.kind === 'chapter' ? t('What happens in this chapter…') : cell.dataset.kind === 'scene' ? t('What happens in this scene…') : cell.dataset.kind === 'loose' ? t('Write a note…') : t('What happens in this section…');
  }
  text.contentEditable = 'true';
  text.spellcheck = false;
  text.setAttribute('role', 'textbox');
  // a scene's heading can be set right on its card
  const slug = cell.querySelector('.ob-slug');
  if (slug) {
    slug.contentEditable = 'true';
    slug.spellcheck = false;
    slug.setAttribute('role', 'textbox');
    slug.addEventListener('keydown', slugKeys);
    if (!slug.textContent.trim()) slug.textContent = '';
  }
  // the way to the page, and what Enter does
  const tools = document.createElement('div');
  tools.className = 'ob-tools';
  if (!cell.dataset.new && !cell.dataset.virtual) {
    const go = document.createElement('button');
    go.className = 'ob-go';
    go.type = 'button';
    go.textContent = t('Go to the page');
    go.addEventListener('mousedown', (e) => e.preventDefault()); // keep the note's focus until we leave
    go.onclick = () => { const c = cardEditor && cardEditor.cell; closeCardEditor(); if (c) goToCard(c); };
    tools.appendChild(go);
  }
  if (cell.dataset.kind !== 'loose') {
    const more = document.createElement('button');
    more.type = 'button';
    more.textContent = cell.dataset.kind === 'scene' ? t('New scene') : t('New card');
    more.addEventListener('mousedown', (e) => e.preventDefault());
    more.onclick = () => { const c = cardEditor && cardEditor.cell; if (c) newCardAfter(c); };
    tools.appendChild(more);
  }
  const tip = document.createElement('span');
  tip.textContent = t('Enter: done · Tab: next card · {key}: new card', { key: K('⌥Enter', 'Alt+Enter') });
  tools.appendChild(tip);
  cell.querySelector('.ob-card').appendChild(tools);
  cardEditor = { cell, text, slug, before: note, slugBefore: slug ? slug.textContent : null, fresh };
  text.addEventListener('keydown', cardKeys);
  text.addEventListener('blur', cardBlur);
  text.addEventListener('paste', (e) => {
    e.preventDefault();
    document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' '));
  });
  const first = slug && fresh ? slug : text;
  first.focus();
  const sel = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(first);
  range.collapse(false);
  sel.removeAllRanges();
  sel.addRange(range);
  cell.scrollIntoView({ block: 'nearest' });
}

function cardNoteOf(cell) {
  if (cell.dataset.new) return '';
  const chId = cell.dataset.ch;
  if (cell.dataset.kind === 'chapter') return (book.chapterNotes || {})[chId] || '';
  if (cell.dataset.kind === 'loose') return (book.looseCards || []).find((c) => c.id === cell.dataset.loose)?.text || '';
  if (cell.dataset.kind === 'scene') return (cell.dataset.sid && (book.sceneNotes || {})[cell.dataset.sid]) || '';
  const note = cell.dataset.sec ? sectionNote(chId, cell.dataset.sec) : null;
  return note ? note.text : '';
}

function cardBlur() {
  // the window losing focus isn't the writer leaving the card
  setTimeout(() => {
    if (!cardEditor || !document.hasFocus()) return;
    if (cardEditor.cell.contains(document.activeElement) && document.activeElement.isContentEditable) return;
    closeCardEditor();
  }, 0);
}

// save what's on the open card and put it down
function closeCardEditor(quiet = false) {
  const ed = cardEditor;
  if (!ed) return;
  cardEditor = null;
  const { cell, text, slug } = ed;
  text.removeEventListener('keydown', cardKeys);
  text.removeEventListener('blur', cardBlur);
  text.contentEditable = 'false';
  text.removeAttribute('role');
  cell.classList.remove('open', 'open-left');
  cell.querySelector('.ob-tools')?.remove();
  cell.querySelector('.ob-from')?.remove();
  const val = text.textContent.replace(/\s+/g, ' ').trim();
  if (slug) {
    slug.removeEventListener('keydown', slugKeys);
    slug.removeEventListener('blur', cardBlur);
    slug.contentEditable = 'false';
    slug.removeAttribute('role');
    const sv = slug.textContent.replace(/\s+/g, ' ').trim();
    if (!quiet || val !== ed.before || sv !== ed.slugBefore) saveSceneCard(cell, val, sv);
    if (cell.isConnected && cell.dataset.new) cell.remove();
    else if (cell.isConnected) { fillCardText(cell, val); renderBoardLater(); }
    return;
  }
  if (!quiet || val !== ed.before) saveCard(cell, val);
  if (!cell.isConnected) return;
  if (cell.dataset.new && !val) { cell.remove(); return; }
  if (cell.dataset.kind !== 'loose') fillCardText(cell, cardNoteOf(cell));
}

function saveCard(cell, val) {
  if (!book) return;
  const chId = cell.dataset.ch;
  const kind = cell.dataset.kind;
  if (kind === 'loose') { saveLooseCard(cell.dataset.loose, val); return; }
  if (kind === 'chapter') {
    book.chapterNotes = book.chapterNotes || {};
    if ((book.chapterNotes[chId] || '') === val) return;
    book.chapterNotes[chId] = val;
    scheduleMetaSave();
    scheduleNavRefresh();
    return;
  }
  book.sectionNotes = book.sectionNotes || {};
  const list = book.sectionNotes[chId] = book.sectionNotes[chId] || [];
  if (cell.dataset.new) {
    if (!val) return;
    // a new card: a gray ghost on the page, after the card it came from
    const sec = { id: newSectionId(), text: val };
    const body = chapterBodyEl(chId);
    if (!body) return;
    const segs = chapterSegments(chId);
    const after = Number(cell.dataset.after);
    const next = segs[after + 1];
    list.push(sec);
    placeGhost(body, sec, next ? (next.brk || next.ps[0]) : null);
    orderSectionNotes(chId);
    syncChapter(body, chId);
    scheduleMetaSave();
    delete cell.dataset.new;
    cell.dataset.sec = sec.id;
    reindexChapterCards(chId);
    return;
  }
  if (cell.dataset.sec) {
    const sec = list.find((s) => s.id === cell.dataset.sec);
    if (!sec || sec.text === val) return;
    sec.text = val;
    scheduleMetaSave();
    syncGhosts(chId);
    return;
  }
  if (!val) return;
  // a section written without an outline gets its first note: its first
  // line of prose carries the note's id from now on
  const seg = chapterSegments(chId)[Number(cell.dataset.seg)];
  const anchor = seg && seg.ps.find((p) => !p.classList.contains('ghost'));
  if (!anchor) return;
  const sec = { id: newSectionId(), text: val };
  anchor.dataset.secId = sec.id;
  list.push(sec);
  orderSectionNotes(chId);
  syncChapter(chapterBodyEl(chId), chId);
  scheduleMetaSave();
  cell.dataset.sec = sec.id;
}

// after a card is set on the page, the chapter's cards learn their places
// (and letters) again, without redrawing the board under the writer's hand
function reindexChapterCards(chId) {
  const segs = chapterSegments(chId);
  const placed = segs.filter((sg, i) => !(i === 0 && !sg.id));
  const cells = [...outlineBoard().querySelectorAll(`.ob-cell[data-kind="section"][data-ch="${chId}"]`)];
  let k = 0;
  let letter = 0;
  for (const cell of cells) {
    if (!cell.dataset.new) cell.querySelector('.ob-letter').textContent = secLetter(letter++);
    if (cell.dataset.new || cell.dataset.virtual) continue;
    const seg = placed[k++];
    if (seg) cell.dataset.seg = String(segs.indexOf(seg));
  }
}

function cardKeys(e) {
  const ed = cardEditor;
  if (!ed) return;
  const { cell, text } = ed;
  e.stopPropagation();
  if (e.key === 'Escape') {
    e.preventDefault();
    closeCardEditor();
    if (cell.isConnected) cell.focus();
    return;
  }
  if (e.isComposing || e.keyCode === 229) return;
  // Enter: the card is done (and stays where the keyboard is)
  if (e.key === 'Enter' && !e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    closeCardEditor();
    if (cell.isConnected) cell.focus();
    else renderBoardFocus(cell);
    return;
  }
  // Tab and ⇧Tab: on to the next card, or back to the one before
  if (e.key === 'Tab' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    const list = cell.closest('#loose-list') || outlineBoard();
    const cells = [...list.querySelectorAll('.ob-cell')];
    const at = cells.indexOf(cell);
    const ahead = e.shiftKey ? cells.slice(0, at).reverse() : cells.slice(at + 1);
    closeCardEditor();
    const next = ahead.find((c) => c.isConnected);
    if (next) openCard(next);
    else if (cell.isConnected) cell.focus();
    return;
  }
  // ⌥Enter (Alt+Enter): a new card after this one; on an empty new card,
  // a new chapter instead (the manuscript's Enter, Enter)
  if (e.key === 'Enter' && e.altKey && !e.metaKey && !e.ctrlKey) {
    e.preventDefault();
    const empty = !text.textContent.trim();
    if (empty && cell.dataset.new && cell.dataset.kind === 'section') {
      const chId = cell.dataset.ch;
      cardEditor = null;
      cell.remove();
      newChapterCard(book.chapterOrder.indexOf(chId) + 1);
      return;
    }
    if (cell.dataset.kind === 'loose') { closeCardEditor(); addLooseCard(); return; }
    newCardAfter(cell);
    return;
  }
  if (e.key === 'Backspace' && !text.textContent) {
    e.preventDefault();
    if (cell.dataset.new) {
      const prev = cell.previousElementSibling;
      cardEditor = null;
      cell.remove();
      if (prev && prev.classList.contains('ob-cell')) openCard(prev);
      return;
    }
    if (cell.dataset.kind === 'loose') { cardEditor = null; removeLooseCard(cell.dataset.loose); return; }
    if (cell.dataset.kind === 'section' && cell.dataset.sec && !cell.dataset.written) {
      const chId = cell.dataset.ch;
      cardEditor = null;
      deleteSectionNote(chId, cell.dataset.sec);
    }
  }
}

// a new card after this one, open to write on
function newCardAfter(cell) {
  closeCardEditor();
  if (!cell.isConnected) return;
  const fresh = makeNewCardAfter(cell, cell.dataset.ch);
  if (fresh) openCard(fresh, { fresh: true });
}

// a new chapter at this place in the book, its card open to write on
function newChapterCard(at) {
  closeCardEditor();
  snapshotStructure('card new chapter');
  const newId = createChapterAt(at);
  updateCounters();
  renderBoard();
  const nc = outlineBoard().querySelector(`.ob-cell[data-kind="chapter"][data-ch="${newId}"]`);
  if (nc) openCard(nc, { fresh: true });
}

// after a redraw, the keyboard goes back to the card it was on
function renderBoardFocus(cell) {
  const sel = cell.dataset.sec ? `.ob-cell[data-sec="${cell.dataset.sec}"]` : cell.dataset.kind === 'chapter' ? `.ob-cell[data-kind="chapter"][data-ch="${cell.dataset.ch}"]` : null;
  setTimeout(() => { const c = sel && outlineBoard().querySelector(sel); if (c) c.focus(); }, 150);
}

// in a scene's heading: Enter or Tab moves on to the note
function slugKeys(e) {
  e.stopPropagation();
  if (e.key === 'Escape') { e.preventDefault(); const c = cardEditor && cardEditor.cell; closeCardEditor(); if (c && c.isConnected) c.focus(); return; }
  if ((e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) || (e.key === 'Tab' && !e.shiftKey)) {
    e.preventDefault();
    const text = cardEditor && cardEditor.text;
    if (!text) return;
    text.focus();
    const r = document.createRange();
    r.selectNodeContents(text);
    r.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(r);
  }
}

// once a scene card is put down, the board takes in what changed
let boardLater = null;
function renderBoardLater() {
  clearTimeout(boardLater);
  boardLater = setTimeout(() => {
    if (!cardEditor && !cardDrag && currentTab === 'outline' && boardShowing()) renderBoard();
  }, 120);
}

// a blank card right after this one, in its chapter
function makeNewCardAfter(cell, chId) {
  if (!cell.isConnected) return null;
  if (cell.dataset.kind === 'scene') {
    const fresh = sceneCard({ k: -1, s: { p: null }, id: null, slug: '', eighths: 0, cast: [], first: '' });
    fresh.dataset.new = '1';
    fresh.dataset.after = cell.dataset.scene;
    fresh.querySelector('.ob-letter').textContent = '+';
    cell.after(fresh);
    return fresh;
  }
  const segs = chapterSegments(chId);
  let after;
  if (cell.dataset.kind === 'chapter') after = segs[0] && !segs[0].id ? 0 : -1;
  else if (cell.dataset.virtual || Number(cell.dataset.seg) < 0) after = segs.length - 1;
  else after = Number(cell.dataset.seg);
  const fresh = sectionCard(chId, { id: null, ps: [], words: 0, first: '', flag: false }, -1, 0);
  fresh.dataset.new = '1';
  fresh.dataset.after = String(after);
  fresh.querySelector('.ob-letter').textContent = '+';
  // it joins the chapter's mat
  cell.classList.remove('last');
  fresh.classList.add('last');
  let spot = cell;
  // a chapter card's new card goes before its first section
  if (cell.dataset.kind === 'chapter') spot = cell;
  spot.after(fresh);
  // if it landed mid-chapter, it isn't the end of the mat
  const n = fresh.nextElementSibling;
  if (n && n.classList.contains('ob-cell') && n.dataset.ch === chId) fresh.classList.remove('last');
  return fresh;
}

function deleteSectionNote(chId, secId) {
  snapshotStructure('card removed');
  book.sectionNotes[chId] = (book.sectionNotes[chId] || []).filter((s) => s.id !== secId);
  scheduleMetaSave();
  syncGhosts(chId);
  renderBoard();
}

// the card's place in the manuscript
function goToCard(cell) {
  if (cell.dataset.kind === 'scene') { goToScene(cell); return; }
  const chId = cell.dataset.ch;
  switchTab('manuscript');
  if (cell.dataset.kind === 'chapter') {
    focusChapterStart(chId);
    document.querySelector(`.chapter[data-id="${chId}"]`)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    return;
  }
  const seg = chapterSegments(chId)[Number(cell.dataset.seg)];
  const p = seg && seg.ps[0];
  const body = chapterBodyEl(chId);
  if (!p || !body) { focusChapterStart(chId); return; }
  body.focus({ preventScroll: true });
  const r = document.createRange();
  if (p.classList.contains('ghost')) r.selectNodeContents(p); // ready to be written over
  else { r.setStart(p, 0); r.collapse(true); }
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(r);
  currentChapterId = chId;
  highlightNav();
  p.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
}

async function cardMenu(cell, x, y) {
  const chId = cell.dataset.ch;
  if (cell.dataset.kind === 'chapter') { await chapterMenu(chId, x, y, cell); return; }
  if (cell.dataset.kind === 'loose') {
    const v = await popMenu(x, y, [{ label: t('Delete card'), value: 'delete', danger: true }], { from: cell });
    if (v === 'delete') removeLooseCard(cell.dataset.loose);
    return;
  }
  if (cell.dataset.new) return;
  if (cell.dataset.kind === 'scene') {
    const v = await popMenu(x, y, [
      { label: t('Go to the page'), value: 'go' },
      '-',
      { label: t('Delete the note'), value: 'delete', danger: true, disabled: !cell.dataset.sid }
    ], { from: cell });
    if (v === 'go') goToScene(cell);
    else if (v === 'delete') {
      snapshotStructure('scene note removed');
      delete book.sceneNotes[cell.dataset.sid];
      scheduleMetaSave();
      renderBoard();
    }
    return;
  }
  const linked = !!cell.dataset.sec;
  const written = !!cell.dataset.written;
  const choice = await popMenu(x, y, [
    { label: t('Go to the page'), value: 'go', disabled: !!cell.dataset.virtual },
    { label: t('Make it a chapter'), value: 'chapter', disabled: !!cell.dataset.virtual },
    { label: t('Move to loose cards'), value: 'loose', disabled: written || !linked },
    '-',
    { label: t('Delete the note'), value: 'delete', danger: true, disabled: !linked }
  ], { from: cell });
  if (choice === 'go') goToCard(cell);
  else if (choice === 'chapter') sectionToChapter(chId, Number(cell.dataset.seg));
  else if (choice === 'loose') sectionToLoose(chId, Number(cell.dataset.seg));
  else if (choice === 'delete') {
    deleteSectionNote(chId, cell.dataset.sec);
    if (written) toast(t('The note is gone; the writing stays on the page'));
  }
}

// ---- moving cards ----

// lift a section out of its chapter: its *** and its lines
function liftSegment(body, seg) {
  if (seg.brk) seg.brk.remove();
  for (const p of seg.ps) p.remove();
  // the chapter's first section left: the next one's *** would open the chapter
  if (!seg.brk) {
    const f = body.firstElementChild;
    if (f && f.classList.contains('scene-break')) f.remove();
  }
  if (!body.firstElementChild) body.innerHTML = '<p><br></p>';
}

// set lines down in a chapter, before a section (or at the end)
function setSegmentDown(body, ps, brk, target) {
  const blank = !body.innerText.trim() && !body.querySelector('.scene-break, .ghost, .ph-mark');
  if (!target && blank) {
    body.innerHTML = '';
    for (const p of ps) body.appendChild(p);
    return;
  }
  const tBrk = target && target.brk && target.brk.isConnected ? target.brk : null;
  const tFirst = target && target.ps.find((p) => p.isConnected);
  if (tBrk) {
    body.insertBefore(brk || newSceneBreak(), tBrk);
    for (const p of ps) body.insertBefore(p, tBrk);
    return;
  }
  if (tFirst) {
    // ahead of the chapter's first section
    for (const p of ps) body.insertBefore(p, tFirst);
    body.insertBefore(brk || newSceneBreak(), tFirst);
    return;
  }
  if (!(body.lastElementChild && body.lastElementChild.classList.contains('scene-break'))) body.appendChild(brk || newSceneBreak());
  for (const p of ps) body.appendChild(p);
}

// placeholders keep their sticky notes pointed at the chapter they're in
function repointStickies(ps, chId) {
  let changed = false;
  for (const p of ps) {
    for (const m of p.querySelectorAll ? p.querySelectorAll('.ph-mark') : []) {
      const s = stickies.find((x) => x.id === m.dataset.sid);
      if (s && s.chapterId !== chId) { s.chapterId = chId; changed = true; }
>>>>>>> upstream
```

### File `.github/workflows/pocket.yml` — conflict 1

- Fork module: [`.github/workflows/pocket.yml` lines 75-83](./.github/workflows/pocket.yml#L75)
- Common base: [`.github/workflows/pocket.yml` lines 75-80](./.github/workflows/pocket.yml#L75)
- Upstream: [`.github/workflows/pocket.yml` lines 75-75](./.github/workflows/pocket.yml#L75)

```diff
<<<<<<< fork
          cp ../app.js www/app.js
          cp ../covers.js www/covers.js
          cp ../styles.css www/styles.css
          cp ../i18n.js www/i18n.js
          rm -rf www/src/renderer
          mkdir -p www/src/renderer
          cp ../src/renderer/*.js www/src/renderer/
          cp ../node_modules/jszip/dist/jszip.min.js www/jszip.min.js
          rm -rf www/fonts www/locales && cp -R ../fonts www/fonts && cp -R ../locales www/locales
||||||| common base
          cp ../app.js www/app.js
          cp ../covers.js www/covers.js
          cp ../styles.css www/styles.css
          cp ../i18n.js www/i18n.js
          cp ../node_modules/jszip/dist/jszip.min.js www/jszip.min.js
          rm -rf www/fonts www/locales && cp -R ../fonts www/fonts && cp -R ../locales www/locales
=======

>>>>>>> upstream
```

### File `AGENTS.md` — conflict 1

- Fork module: [`AGENTS.md` lines 36-36](./AGENTS.md#L36)
- Common base: [`AGENTS.md` lines 36-36](./AGENTS.md#L36)
- Upstream: [`AGENTS.md` lines 36-36](./AGENTS.md#L36)

```diff
<<<<<<< fork
Renderer modules are loaded in order by `index.html`; their responsibilities are listed in [ARCHITECTURE.md](ARCHITECTURE.md).
||||||| common base
`app.js` section banners look like `/*  SAVING  */`. Start there: bookshelf, bound shelves, editor open, typing, poetry, placeholders, nav, tabs, outline, darlings, counters, saving, refresh, structural undo, find, import, spellcheck, focus, goals, export.
=======
`app.js` section banners look like `/*  SAVING  */`. Start there: bookshelf, bound shelves, editor open, typing, poetry, screenplays, placeholders, nav, tabs, outline, outline cards, darlings, counters, saving, refresh, structural undo, find, import, spellcheck, focus, goals, export.
>>>>>>> upstream
```

### File `README.md` — conflict 1

- Fork module: [`README.md` lines 52-52](./README.md#L52)
- Common base: [`README.md` lines 52-52](./README.md#L52)
- Upstream: [`README.md` lines 52-52](./README.md#L52)

```diff
<<<<<<< fork
Outline chapters, scenes, and beats in the Outline tab. Tab on a chapter line makes a scene. Tab on an existing scene adds a beat; Tab on a scene line you just made with Enter turns it into a beat under the scene above. Shift+Tab moves a beat back to the scene level. Their notes appear in the manuscript as gray ghost paragraphs, ready to be overwritten. Scene breaks separate scenes, not beats, and ghost prompts never print. **Format → Merge beats upward when deleting a scene** (⌘⇧M / Ctrl+Shift+M) moves a deleted scene's beats to the scene above; if there isn't one, the prompts go with the scene and the chapter stays. Off by default.
||||||| common base
Outline chapters and sections in the Outline tab; section notes appear in the manuscript as gray ghost paragraphs, ready to be overwritten. Pantsers can ignore all of it or learn to draw a freakin' map for the first time. Try it. You might like it!
=======
The Outline tab lays your book out as index cards, set like a page: they read left to right, line after line, so forty short chapters or a story of thirty scenes both fill the window. Each chapter starts at its big numeral, with its sections following on the same mat. Click a card and write a few lines on it. A section's note shows up in the manuscript as a gray ghost paragraph, and once you start writing, it rides one line below your words until you dismiss it. Drag a card to move it and the writing moves with it (⌘Z puts it back). Pantsers get cards too: every chapter and every *** section is already a card, showing its first line until you give it a note. Ideas without a home wait on loose cards in the right-hand panel. ⌘− shrinks the cards until a whole novel fits on one screen, and the old list is one click away. Pantsers can ignore all of it or learn to draw a freakin' map for the first time. Try it. You might like it!
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 1

- Fork module: [`locales/_template.json` lines 166-167](./locales/_template.json#L166)
- Common base: [`locales/_template.json` lines 166-166](./locales/_template.json#L166)
- Upstream: [`locales/_template.json` lines 166-167](./locales/_template.json#L166)

```diff
<<<<<<< fork
  "Delete this beat?": "",
  "Delete this scene?": "",
||||||| common base
  "Delete this section?": "",
=======
  "Delete the note": "",
  "Delete this section?": "",
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 2

- Fork module: [`locales/_template.json` lines 206-206](./locales/_template.json#L206)
- Common base: [`locales/_template.json` lines 206-206](./locales/_template.json#L206)
- Upstream: [`locales/_template.json` lines 206-207](./locales/_template.json#L206)

```diff
<<<<<<< fork
  "Enter — new line · Tab — chapter to scene, or scene to beat · Shift+Tab — scene to chapter, or beat to scene · Backspace on an empty line removes it": "",
||||||| common base
  "Enter — new chapter (or section, from a section line) · Tab — turn a fresh chapter line into a section · Shift+Tab — turn a section into a chapter · Backspace on an empty line removes it": "",
=======
  "Enter": "",
  "Enter — new chapter · Tab — make it a section, or a new section below one · ⇧Tab — make it a chapter again · Backspace on an empty line removes it": "",
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 3

- Fork module: [`locales/_template.json` lines 279-279](./locales/_template.json#L279)
- Common base: [`locales/_template.json` lines 279-279](./locales/_template.json#L279)
- Upstream: [`locales/_template.json` lines 279-279](./locales/_template.json#L279)

```diff
<<<<<<< fork
  "If there is no scene above, the scene and its beats are removed; the chapter stays.": "",
||||||| common base

=======
  "Ideas without a chapter yet. Drag one onto the board when it finds its place.": "",
>>>>>>> upstream
```

### File `locales/_template.json` — conflict 4

- Fork module: [`locales/_template.json` lines 558-558](./locales/_template.json#L558)
- Common base: [`locales/_template.json` lines 558-558](./locales/_template.json#L558)
- Upstream: [`locales/_template.json` lines 558-558](./locales/_template.json#L558)

```diff
<<<<<<< fork
  "This chapter already has words in it — only empty chapter lines can become scenes": "",
||||||| common base
  "This chapter already has words in it — only empty chapter lines can become sections": "",
=======

>>>>>>> upstream
```

### File `locales/_template.json` — conflict 5

- Fork module: [`locales/_template.json` lines 613-613](./locales/_template.json#L613)
- Common base: [`locales/_template.json` lines 613-613](./locales/_template.json#L613)
- Upstream: [`locales/_template.json` lines 613-614](./locales/_template.json#L613)

```diff
<<<<<<< fork

||||||| common base
  "What happens in this section…": "",
=======
  "What happens in this scene…": "",
  "What happens in this section…": "",
>>>>>>> upstream
```

### File `locales/fr.json` — conflict 1

- Fork module: [`locales/fr.json` lines 153-153](./locales/fr.json#L153)
- Common base: [`locales/fr.json` lines 153-153](./locales/fr.json#L153)
- Upstream: [`locales/fr.json` lines 153-154](./locales/fr.json#L153)

```diff
<<<<<<< fork

||||||| common base
  "Delete this section?": "Supprimer cette section ?",
=======
  "Delete the note": "Supprimer la note",
  "Delete this section?": "Supprimer cette section ?",
>>>>>>> upstream
```

### File `locales/fr.json` — conflict 2

- Fork module: [`locales/fr.json` lines 543-543](./locales/fr.json#L543)
- Common base: [`locales/fr.json` lines 543-543](./locales/fr.json#L543)
- Upstream: [`locales/fr.json` lines 543-544](./locales/fr.json#L543)

```diff
<<<<<<< fork

||||||| common base
  "What happens in this section…": "Que se passe-t-il dans cette section ?",
=======
  "What happens in this scene…": "Ce qui se passe dans cette scène…",
  "What happens in this section…": "Que se passe-t-il dans cette section ?",
>>>>>>> upstream
```
