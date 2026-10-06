'use strict';

/*  FOCUS MODE: dim everything but the sentence or paragraph           */
/* ================================================================== */
// Painted with the CSS Custom Highlight API (like search and spellcheck),
// so the manuscript DOM is never touched and nothing leaks into saved HTML.
// also the order ⌘⇧O steps through: off → paragraph → sentence → off
const FOCUS_LEVELS = ['off', 'paragraph', 'sentence'];
const FOCUS_LABELS = { off: tk('Focus mode off'), sentence: tk('Focus: sentence'), paragraph: tk('Focus: paragraph') };
let focusLevel = 'off';

// the View menu's ticks (focus level, page, brighter interface) follow the page
function reportViewState() {
  if (!window.neo.viewState || !library) return;
  window.neo.viewState({ focus: focusLevel, pageTheme: library.pageTheme || 'night', uiBright: document.body.classList.contains('bright') });
}

function applyFocus() {
  reportViewState();
  document.body.classList.toggle('focus-mode', focusLevel !== 'off');
  if (focusLevel === 'off') {
    if (window.CSS && CSS.highlights) CSS.highlights.delete('neo-focus');
  } else updateFocus();
}
function setFocus(level) {
  if (!FOCUS_LEVELS.includes(level)) return;
  focusLevel = level;
  library.focus = level;
  writeLibrary(library);
  applyFocus();
  toast(t(FOCUS_LABELS[level] || ''));
}
function cycleFocus() { setFocus(FOCUS_LEVELS[(FOCUS_LEVELS.indexOf(focusLevel) + 1) % FOCUS_LEVELS.length]); }

// the paragraph (direct <p> child of a chapter body) holding the caret
function focusParagraph() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  let el = sel.focusNode;
  if (el && el.nodeType === Node.TEXT_NODE) el = el.parentElement;
  if (!el || !el.closest) return null;
  const body = el.closest('.chapter-body');
  if (!body) return null;
  let p = el;
  while (p && p.parentElement !== body) p = p.parentElement;
  return p && p.tagName === 'P' ? p : null;
}

// caret position as a character offset into p.textContent
function caretOffsetIn(p) {
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(p);
  try { r.setEnd(sel.focusNode, sel.focusOffset); } catch { return 0; }
  return r.toString().length;
}

// character offsets within p → a DOM Range over its text nodes
function rangeFromOffsets(p, start, end) {
  const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
  const r = document.createRange();
  let pos = 0, n, startSet = false;
  while ((n = walker.nextNode())) {
    const len = n.textContent.length;
    if (!startSet && start <= pos + len) { r.setStart(n, start - pos); startSet = true; }
    if (startSet && end <= pos + len) { r.setEnd(n, end - pos); return r; }
    pos += len;
  }
  if (!startSet) return null;
  r.setEndAfter(p.lastChild || p);
  return r;
}

let focusSegmenter = null;
function sentenceRange(p) {
  const text = p.textContent;
  if (!text.trim()) return null;
  const at = caretOffsetIn(p);
  if (!focusSegmenter && window.Intl && Intl.Segmenter) {
    focusSegmenter = new Intl.Segmenter((library.spellLanguage || 'en').split('-')[0], { granularity: 'sentence' });
  }
  if (!focusSegmenter) return null;
  let hit = null, last = null;
  for (const seg of focusSegmenter.segment(text)) {
    last = seg;
    // caret at the very end of a sentence still belongs to it
    if (at >= seg.index && at <= seg.index + seg.segment.length) { hit = seg; if (at < seg.index + seg.segment.length) break; }
  }
  hit = hit || last;
  // trim trailing whitespace so the highlight hugs the words
  const start = hit.index;
  const end = hit.index + hit.segment.replace(/\s+$/, '').length;
  return rangeFromOffsets(p, start, Math.max(end, start));
}

function updateFocus() {
  if (focusLevel === 'off' || !book || currentTab !== 'manuscript') return;
  if (!window.Highlight || !window.CSS || !CSS.highlights) return;
  const p = focusParagraph();
  if (!p) return;   // caret elsewhere (title, panels): keep the last focus
  let r = null;
  if (isBreakPara(p)) r = null;
  else if (focusLevel === 'sentence') r = sentenceRange(p);
  else if (focusLevel === 'paragraph') { r = document.createRange(); r.selectNodeContents(p); }
  if (r) CSS.highlights.set('neo-focus', new Highlight(r));
  else CSS.highlights.delete('neo-focus');
  // highlights can't reach ::first-letter, so the drop cap gets a class
  // on its chapter body (a class on the body itself is never saved)
  document.querySelectorAll('.chapter-body.focus-cap').forEach((b) => b.classList.remove('focus-cap'));
  const body = p.parentElement;
  const first = body.querySelector('p[data-first]'); // the paragraph with the drop cap (openingPara)
  const firstText = first && document.createTreeWalker(first, NodeFilter.SHOW_TEXT).nextNode();
  if (r && firstText && r.comparePoint(firstText, 0) === 0) body.classList.add('focus-cap');
}
function isBreakPara(p) { return p.classList.contains('scene-break'); }

document.addEventListener('selectionchange', () => {
  if (focusLevel === 'off') return;
  requestAnimationFrame(() => { try { updateFocus(); } catch { /* mid-mutation */ } });
});
document.addEventListener('input', () => {
  if (focusLevel === 'off') return;
  requestAnimationFrame(() => { try { updateFocus(); } catch { /* mid-mutation */ } });
});

/* ================================================================== */
/*  GOALS, SPRINTS, AND THE CHART                                      */
/* ================================================================== */

let sprint = null;

function statsChartSvg() {
  const W = 520, H = 200, PAD = 6;
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(writingDay(d));
  }
  const counts = book.dailyCounts || {};
  const daily = days.map((d) => counts[d] ? Math.max(0, counts[d].end - counts[d].start) : 0);
  // cumulative: carry the last known total forward
  let last = 0;
  const firstKnown = days.find((d) => counts[d]);
  if (firstKnown) last = counts[firstKnown].start;
  const cumulative = days.map((d) => {
    if (counts[d]) last = counts[d].end;
    return last;
  });
  const goal = book.wordGoal || 0;
  const maxC = Math.max(...cumulative, goal, 1);
  const maxD = Math.max(...daily, library.dailyGoal || 0, 1);
  const bw = (W - PAD * 2) / 30;

  const bars = daily.map((v, i) => {
    const h = Math.round((v / maxD) * (H * 0.45));
    return `<rect x="${(PAD + i * bw).toFixed(1)}" y="${H - PAD - h}" width="${(bw - 2).toFixed(1)}" height="${h}" rx="1.5" fill="#3d5a4f"/>`;
  }).join('');
  const line = cumulative.map((v, i) => {
    const x = (PAD + i * bw + bw / 2).toFixed(1);
    const y = (H - PAD - (v / maxC) * (H - PAD * 2 - 20)).toFixed(1);
    return (i === 0 ? 'M' : 'L') + x + ',' + y;
  }).join(' ');
  const goalLine = goal
    ? `<line x1="${PAD}" x2="${W - PAD}" y1="${(H - PAD - (goal / maxC) * (H - PAD * 2 - 20)).toFixed(1)}" y2="${(H - PAD - (goal / maxC) * (H - PAD * 2 - 20)).toFixed(1)}" stroke="#c9a86a" stroke-dasharray="5,4" stroke-width="1" opacity="0.7"/>`
    : '';
  return `<svg id="stats-chart" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escHtml(t('Words written over the last 30 days')).replace(/"/g, '&quot;')}">
    ${bars}
    <path d="${line}" fill="none" stroke="#c9a86a" stroke-width="2"/>
    ${goalLine}
  </svg>
  <div class="stats-legend">
    <span>${t('30 days ago')}</span>
    <span class="sl-daily">▮ ${t('daily words')}</span>
    <span style="color:var(--accent)">— ${t('total')}${goal ? ' · - - ' + t('goal') : ''}</span>
    <span>${t('today')}</span>
  </div>`;
}

/* ================================================================== */
