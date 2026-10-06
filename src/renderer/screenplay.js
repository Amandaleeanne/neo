'use strict';

/* ================================================================== */
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
  if (wordMode === 'book') wc.textContent = t('{pages} pages · ~{n} min', { pages: len.text, n: len.minutes });
  else wc.textContent = t('{n} words', { n: bookWordCount() });
  const pos = $('#pos-counter');
  pos.textContent = spPosScene
    ? t('scene {n} of {total}', { n: spCurrentScene(), total: spLayout.scenes.length })
    : t('page {p} of {total}', { p: spCurrentPage(), total: spLayout.pages });
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
document.addEventListener('selectionchange', () => {
  if (!book || !isScript() || $('#editor-view').hidden) return;
  const p = spCaretPara();
  if (p) spLastPara = p;
  spShowElement();
  spHighlightScene();
});

function spOutlineScenes() {
  spRepaginate();
  const notes = book.sceneNotes || {};
  const claimed = new Set();
  return (spLayout.scenes || []).filter((scene) => scene.p.isConnected).map((scene, index) => {
    const paragraphs = [scene.p];
    for (let p = scene.p.nextElementSibling; p && spType(p) !== 'heading'; p = p.nextElementSibling) paragraphs.push(p);
    let id = scene.p.dataset.sceneId || null;
    if (id && (claimed.has(id) || !Object.hasOwn(notes, id))) id = null;
    if (id) claimed.add(id);
    const cast = [];
    for (const p of paragraphs) {
      if (spType(p) !== 'character') continue;
      const name = p.textContent.replace(/\(.*?\)/g, '').replace(/\^$/, '').trim().toUpperCase();
      if (name && !cast.includes(name)) cast.push(name);
    }
    const action = paragraphs.slice(1).find((p) => spType(p) === 'action' && p.textContent.trim());
    return {
      index,
      paragraph: scene.p,
      id,
      slug: scene.slug,
      length: spEighths(scene.lines),
      cast,
      excerpt: action ? action.textContent.replace(/\s+/g, ' ').trim() : ''
    };
  });
}

function spOutlineSaveNote(sceneId, paragraph, note) {
  const text = note.innerText.replace(/\r/g, '').replace(/\n+$/, '');
  if (!sceneId && !text.trim()) return null;
  const id = sceneId || ('sc-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
  paragraph.dataset.sceneId = id;
  (book.sceneNotes = book.sceneNotes || {})[id] = text;
  if (!sceneId) syncChapter(spBodyOf(paragraph), spChapterOf(paragraph));
  scheduleMetaSave();
  return id;
}

function spOutlineNoteField(value, label, onSave) {
  const field = document.createElement('div');
  field.className = 'sp-outline-note';
  field.contentEditable = 'true';
  field.spellcheck = false;
  field.setAttribute('role', 'textbox');
  field.setAttribute('aria-label', label);
  field.setAttribute('aria-multiline', 'true');
  field.dataset.ph = t('Add a scene note');
  field.textContent = value || '';
  field.addEventListener('input', onSave);
  field.addEventListener('blur', onSave);
  field.addEventListener('keydown', (e) => e.stopPropagation());
  return field;
}

function spOutlineCard(scene, notes) {
  const card = document.createElement('article');
  card.className = 'sp-outline-card';
  const head = document.createElement('div');
  head.className = 'sp-outline-head';
  const number = document.createElement('span');
  number.className = 'sp-outline-number';
  number.textContent = String(scene.index + 1);
  const length = document.createElement('span');
  length.className = 'sp-outline-length';
  length.textContent = spEighthsText(scene.length);
  head.append(number, length);

  const slug = document.createElement('div');
  slug.className = 'sp-outline-slug';
  slug.contentEditable = 'true';
  slug.spellcheck = false;
  slug.setAttribute('role', 'textbox');
  slug.setAttribute('aria-label', t('Scene {n}', { n: scene.index + 1 }));
  slug.textContent = scene.slug;
  const saveSlug = () => {
    const value = slug.textContent.trim().replace(/\s[–—]\s/g, ' - ');
    if (value === scene.paragraph.textContent) return;
    scene.paragraph.textContent = value;
    if (!value) scene.paragraph.appendChild(document.createElement('br'));
    const body = spBodyOf(scene.paragraph);
    syncChapter(body, spChapterOf(scene.paragraph));
    spRepaginate();
    renderNav();
  };
  slug.addEventListener('blur', saveSlug);
  slug.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') { e.preventDefault(); slug.blur(); }
    if (e.key === 'Escape') { slug.textContent = scene.paragraph.textContent; slug.blur(); }
  });

  const excerpt = document.createElement('div');
  excerpt.className = 'sp-outline-excerpt';
  excerpt.textContent = scene.excerpt;
  const cast = document.createElement('div');
  cast.className = 'sp-outline-cast';
  cast.textContent = scene.cast.join(' · ');
  const note = spOutlineNoteField(scene.id ? notes[scene.id] : '', t('Scene note'), () => {
    scene.id = spOutlineSaveNote(scene.id, scene.paragraph, note) || scene.id;
  });
  const go = document.createElement('button');
  go.className = 'sp-outline-go';
  go.type = 'button';
  go.textContent = t('Go to scene');
  go.addEventListener('click', () => {
    switchTab('manuscript');
    const body = spBodyOf(scene.paragraph);
    if (body) body.focus({ preventScroll: true });
    spCaretToEnd(scene.paragraph);
    const scroll = $('#paper-scroll');
    scroll.scrollTop += scene.paragraph.getBoundingClientRect().top - scroll.getBoundingClientRect().top - scroll.clientHeight / 4;
    updateCounters();
  });
  card.append(head, slug, excerpt, cast, note, go);
  return card;
}

function spOrphanSceneNote(id, text) {
  const card = document.createElement('article');
  card.className = 'sp-outline-card sp-outline-orphan';
  const label = document.createElement('div');
  label.className = 'sp-outline-orphan-label';
  label.textContent = t('Unplaced scene note');
  const note = spOutlineNoteField(text, t('Unplaced scene note'), () => {
    (book.sceneNotes = book.sceneNotes || {})[id] = note.innerText.replace(/\r/g, '').replace(/\n+$/, '');
    scheduleMetaSave();
  });
  card.append(label, note);
  return card;
}

function renderScriptOutline(container) {
  const notes = book.sceneNotes || {};
  const scenes = spOutlineScenes();
  const placed = new Set();
  for (const scene of scenes) {
    if (scene.id) placed.add(scene.id);
    container.appendChild(spOutlineCard(scene, notes));
  }
  for (const [id, text] of Object.entries(notes)) {
    if (!placed.has(id) && String(text || '').trim()) container.appendChild(spOrphanSceneNote(id, text));
  }
  if (!scenes.length && !Object.values(notes).some((text) => String(text || '').trim())) {
    const hint = document.createElement('div');
    hint.className = 'sp-outline-hint';
    hint.textContent = t('Scene headings appear here as you write them.');
    container.appendChild(hint);
  }
}

function renderScriptNav() {
  const list = $('#nav-list');
  list.innerHTML = '';
  $('#nav-head span').textContent = t('Elements');
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
  const credit = field('tp-credit', t('Written by'), book.credit === undefined ? t('Written by') : book.credit, $('#tp-subtitle'), (v) => {
    if (!book) return;
    book.credit = v.trim();
    scheduleMetaSave();
  });
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
  const draft = field('tp-draft', t('Draft and date'), book.draft || '', null, (v) => {
    if (!book) return;
    book.draft = v;
    scheduleMetaSave();
  });
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
  if (tabM) tabM.textContent = on ? t('Script') : t('Manuscript');
  const tabO = $('.tab[data-tab="outline"]');
  if (tabO) tabO.hidden = false; // a script's outline is its scenes, as cards
  const add = $('#nav-add');
  if (add) add.hidden = on;
  if (!on) $('#nav-head span').textContent = t('Chapters');
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
