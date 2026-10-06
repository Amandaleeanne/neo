/* =============================== NEO =============================== */

'use strict';

// ---------- interface language (see i18n.js and locales/) ----------
// The English text is the key: t('Cancel') shows the translation when the
// chosen language has one, and the English original otherwise.
(() => {
  const l = (window.neo && window.neo.i18n) || {};
  NeoI18n.setLocale(l.locale || 'en', l.dict || {}, l.base || {});
})();
const { t, fmtNum, fmtDate } = NeoI18n;

// index.html marks its words with data-i18n (text), data-i18n-title,
// data-i18n-placeholder and data-i18n-ph (the empty-field hints)
function applyStaticI18n(root = document) {
  document.documentElement.lang = NeoI18n.getLocale();
  root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.textContent.replace(/\s+/g, ' ').trim()); });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => { if (el.title) el.title = t(el.title); });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.placeholder); });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.dataset.ph = t(el.dataset.ph); });
  // names for screen readers, where a symbol or a placeholder is all the eye gets
  root.querySelectorAll('[data-i18n-label]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nLabel)); });
  // hints that styles.css draws with ::before read these custom properties
  const cssHints = {
    '--ph-add-title': t('add a title'),
    '--ph-write-freely': t('Write freely…'),
    '--ph-ol-chapter': t('What happens in this chapter…'),
    '--ph-ol-section': t('What happens here…'),
    '--ph-ol-beat': t('What happens here…'),
    '--ph-nav-note': t('What happens here…')
  };
  for (const [name, text] of Object.entries(cssHints)) {
    document.documentElement.style.setProperty(name, JSON.stringify(text));
  }
}
applyStaticI18n();

// Books keep the title they were created with, so "Untitled" may be stored
// in any language: both the English word and the current one count.
// tk() marks a string for translation where it is defined and t() is
// applied later, when it is shown
const tk = (s) => s;

// The Notes and Outline tabs keep their default names in English and show
// them in the current language; a name the writer chose shows as written.
const tabName = (kind) => {
  const n = (book && book.tabNames && book.tabNames[kind]) || (kind === 'notes' ? 'Notes' : kind === 'outline' ? 'Outline' : kind);
  return n === 'Notes' || n === 'Outline' ? t(n) : n;
};

// What each entry in the Chapters pane is. Every entry is a chapter unless
// the writer makes it something else (right-click its box, or add one with
// the faint + between boxes): a page a published book carries, a part, a
// prologue or an epilogue. book.chapterKinds holds the ones that aren't
// chapters. Chapters are numbered; parts are numbered on their own; the rest
// go by their names. An unnumbered chapter is a chapter that goes by its
// title alone and stays out of the count — a run of named chapters before
// the numbering starts, say. Prologues, epilogues and chapters (numbered or
// not) are the story: they count toward the words. book.restartNumbering
// starts the chapter count again at 1 after every part.
const CHAPTER_KINDS = ['copyright', 'dedication', 'epigraph', 'contents', 'prologue', 'part', 'chapter', 'unnumbered', 'epilogue', 'acknowledgments', 'about'];
const STORY_KINDS = ['chapter', 'unnumbered', 'prologue', 'epilogue'];
// what comes after the story, where a new chapter never goes
const BACK_KINDS = ['epilogue', 'acknowledgments', 'about'];
function chapterKind(chId, meta = book) {
  const k = meta && meta.chapterKinds && meta.chapterKinds[chId];
  if (k && CHAPTER_KINDS.includes(k)) return k;
  // NEO 1.0 kept a prologue and an epilogue as roles of the first and last
  // chapters (a book not opened since reads that way until it is)
  const order = (meta && meta.chapterOrder) || [];
  if (order.length >= 2) {
    if (meta.prologue === chId && order[0] === chId) return 'prologue';
    if (meta.epilogue === chId && order[order.length - 1] === chId) return 'epilogue';
  }
  return 'chapter';
}
const isStory = (chId, meta = book) => STORY_KINDS.includes(chapterKind(chId, meta));
// a prologue or an epilogue: story that stands outside the numbering
function chapterRole(chId, meta = book) {
  const k = chapterKind(chId, meta);
  return k === 'prologue' || k === 'epilogue' ? k : null;
}
// a chapter's number counts chapters only; a part's, parts only
function kindCount(chId, kind, meta = book) {
  let n = 0;
  for (const c of meta.chapterOrder) {
    const k = chapterKind(c, meta);
    if (k === kind) n++;
    // numbering that restarts with each part
    else if (kind === 'chapter' && k === 'part' && meta.restartNumbering) n = 0;
    if (c === chId) break;
  }
  return n;
}
const chapterNumber = (chId, meta = book) => kindCount(chId, 'chapter', meta);
function chapterName(chId, meta = book) {
  const k = chapterKind(chId, meta);
  if (k === 'chapter') return t('Chapter {n}', { n: chapterNumber(chId, meta) });
  if (k === 'part') return partLabel(kindCount(chId, 'part', meta));
  // an unnumbered chapter is its title
  if (k === 'unnumbered') return ((meta.chapterTitles || {})[chId] || '').trim() || t('Untitled');
  return kindName(k);
}
// a chapter's heading as the reader sees it: its name, then any title —
// once, for an unnumbered chapter, whose name is its title
function chapterHeading(chId, meta = book, sep = ' — ') {
  const title = ((meta.chapterTitles || {})[chId] || '').trim();
  const k = chapterKind(chId, meta);
  if (k === 'unnumbered') return title;
  if (!title) return chapterName(chId, meta);
  return library.exportCustomChapterTitles ? title : chapterName(chId, meta) + sep + title;
}
function kindName(kind) {
  if (kind === 'chapter') return t('Chapter');
  if (kind === 'unnumbered') return t('Unnumbered Chapter');
  if (kind === 'contents') return t('Contents');
  return pageKindName(kind);
}
// where there's only room for a number: a chapter's, a part's in roman
// numerals, and a fleuron for the rest
function chapterMark(chId, meta = book) {
  const k = chapterKind(chId, meta);
  if (k === 'chapter') return String(chapterNumber(chId, meta));
  if (k === 'part') return roman(kindCount(chId, 'part', meta));
  return '❦';
}
// how many numbered chapters the book has — or, when numbering restarts
// with each part, how many share chId's part
function numberedChapters(meta = book, chId = null) {
  let n = 0, total = 0, found = false;
  for (const c of meta.chapterOrder) {
    const k = chapterKind(c, meta);
    if (k === 'part' && meta.restartNumbering && chId) {
      if (found) break;
      n = 0;
    }
    if (c === chId) found = true;
    if (k === 'chapter') { n++; total++; }
  }
  return chId && meta.restartNumbering ? n : total;
}
// A story of one chapter is just "the story": no heading, no number, until a
// second chapter (or a prologue, an epilogue or a part) joins it. The pages
// around it don't count.
function soloStory(meta = book) {
  const story = meta.chapterOrder.filter((c) => isStory(c, meta) || chapterKind(c, meta) === 'part');
  return story.length === 1 && chapterKind(story[0], meta) === 'chapter' ? story[0] : null;
}
// NEO 1.0's roles become kinds the first time a book opens here, and a kind
// whose entry is gone is let go
function settleChapterKinds() {
  let changed = false;
  for (const role of ['prologue', 'epilogue']) {
    if (!(role in book)) continue;
    const id = book[role];
    if (chapterKind(id) === role) (book.chapterKinds = book.chapterKinds || {})[id] = role;
    delete book[role];
    changed = true;
  }
  for (const id of Object.keys(book.chapterKinds || {})) {
    const k = book.chapterKinds[id];
    if (!book.chapterOrder.includes(id) || k === 'chapter' || !CHAPTER_KINDS.includes(k)) {
      delete book.chapterKinds[id];
      changed = true;
    }
  }
  if (changed) scheduleMetaSave();
}
function setChapterKind(chId, kind) {
  book.chapterKinds = book.chapterKinds || {};
  if (kind === 'chapter') delete book.chapterKinds[chId];
  else book.chapterKinds[chId] = kind;
}

const isUntitled = (s) => !s || s === 'Untitled' || s === t('Untitled');

// ---------- state ----------
let library = null;          // library.json
let book = null;             // current book.json
let chapterHTML = {};        // chapterId -> html (loaded at open)
let savedHTML = {};          // chapterId -> html as last read from / written to disk
let savedMetaSig = '';       // book.json as last read/written, minus the volatile bits
let diskStamps = {};         // chapterId -> file mtime as of the last look at the disk
let writing = {};            // chapterId -> chapter writes still on their way to disk
let stickies = [];           // [{id, chapterId, text, resolved}]
let darlings = [];           // [{id, html, text, chapterId, chapterLabel, date}]
let currentTab = 'manuscript';
let currentChapterId = null; // chapter the caret/scroll is in
let wordMode = 'book';       // 'book' | 'chapter'
let saveTimers = {};

// Every library.json write from this window goes through here. A look at the
// disk (refreshFromDisk) can then tell its own writes from another device's:
// a read that a write here crossed, or that finished while one was still on
// its way, is older than the library in memory and must not replace it.
let libraryGeneration = 0;
let libraryWritesPending = 0;
function writeLibrary(lib = library) {
  libraryGeneration++;
  libraryWritesPending++;
  return new Promise((resolve) => resolve(window.neo.writeLibrary(lib)))
    .finally(() => { libraryWritesPending--; });
}

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

// Platform-aware key labels: Macs read ⌘⇧X, everyone else reads Ctrl+Shift+X
const IS_MAC = navigator.platform.toLowerCase().includes('mac');
// a touch screen (Pocket): nothing to hover, no right button
const NO_HOVER = !!(window.matchMedia && window.matchMedia('(hover: none)').matches) || !!window.Capacitor;
// NEO Pocket (the Android and iOS shell)
const IS_POCKET = !!window.Capacitor;

// Touch has no right-click: a long press on a book, a shelf name or a chapter
// heading opens the same menu. Not inside the text itself — there a long
// press belongs to the system's own selection handles.
(() => {
  let timer = null;
  let start = null;
  let swallowClick = false;
  let armed = false; // held long enough; the menu opens when the finger lifts
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    const target = e.target;
    if (!target.closest) return;
    // shelf names are editable on tap, but a long press on one is a menu
    if (target.closest('[contenteditable="true"], input, textarea')) return;
    if (target.closest('#pocket-chapters')) return;
    const p = e.touches[0];
    start = { x: p.clientX, y: p.clientY, target };
    armed = false;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; armed = true; }, 550);
  }, { passive: true });
  const cancel = () => { clearTimeout(timer); timer = null; armed = false; };
  document.addEventListener('touchmove', (e) => {
    if (!start) return;
    const p = e.touches[0];
    if (Math.hypot(p.clientX - start.x, p.clientY - start.y) > 10) cancel();
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (armed && start) {
      // iOS usually sends no click after a long press; when it does, it
      // comes at once — so the guard lifts itself before the menu's first tap
      swallowClick = true;
      setTimeout(() => { swallowClick = false; }, 300);
      const { target, x, y } = start;
      setTimeout(() => target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })), 30);
    }
    cancel();
  }, { passive: true });
  document.addEventListener('touchcancel', cancel, { passive: true });
  // the tap that ends a long press must not also open the book
  document.addEventListener('click', (e) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
})();
const K = (mac, pc) => (IS_MAC ? mac : pc);
const KZ = K('⌘Z', 'Ctrl+Z');
const KPH = K('⌘⇧X', 'Ctrl+Shift+X');
const KDA = K('⌘⇧D', 'Ctrl+Shift+D');
const KHELP = K('⌘/', 'Ctrl+/');

// Scrollbars stay invisible until you scroll, then fade away again —
// chrome only when needed.
document.addEventListener('scroll', (e) => {
  const el = e.target;
  if (!el || !el.classList) return;
  el.classList.add('show-scrollbar');
  clearTimeout(el._neoSbHide);
  el._neoSbHide = setTimeout(() => el.classList.remove('show-scrollbar'), 750);
}, true);

function askInput(title, placeholder, value = '') {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.innerHTML = `
      <div class="modal" style="width:380px">
        <h2 style="font-size:16px">${title}</h2>
        <input type="text" spellcheck="false" placeholder="${placeholder}" />
        <div style="text-align:right;margin-top:14px">
          <button class="m-cancel btn-quiet" style="margin-right:10px">${t('Cancel')}</button>
          <button class="m-ok btn-gold">${t('OK')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    const input = bd.querySelector('input');
    input.value = value;
    input.focus();
    input.select();
    const done = (val) => { bd.remove(); resolve(val); };
    bd.querySelector('.m-ok').onclick = () => done(input.value.trim());
    bd.querySelector('.m-cancel').onclick = () => done(null);
    input.onkeydown = (e) => {
      if (e.key === 'Enter') done(input.value.trim());
      // the prompt is gone by the time Esc bubbles up, so without this the
      // editor's own Esc would close the book too
      if (e.key === 'Escape') { e.stopPropagation(); done(null); }
    };
  });
}

// A list of choices, null on cancel.
function optionModal(title, message, options) {
  return new Promise((resolve) => {
    const bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    const buttons = options.map((o, i) =>
      `<button class="fr-choice${o.danger ? ' danger' : ''}" data-i="${i}" style="width:100%;margin-bottom:8px">
        <strong>${o.label}</strong>
        ${o.desc ? `<span>${o.desc}</span>` : ''}
      </button>`).join('');
    bd.innerHTML = `
      <div class="modal" style="width:420px">
        <h2 style="font-size:16px">${title}</h2>
        ${message ? `<p>${message}</p>` : ''}
        ${buttons}
        <div style="text-align:right;margin-top:6px">
          <button class="m-cancel btn-quiet">${t('Cancel')}</button>
        </div>
      </div>`;
    document.body.appendChild(bd);
    const done = (val) => { bd.remove(); resolve(val); };
    bd.querySelectorAll('.fr-choice').forEach((b) => {
      b.onclick = () => done(options[+b.dataset.i].value);
    });
    bd.querySelector('.m-cancel').onclick = () => done(null);
    bd.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(null); } });
  });
}

// A small menu at the pointer, the way a right-click menu opens: items are
// {label, value, checked, disabled, danger} or '-' for a line between them.
// Resolves to the chosen value, or null. Arrow keys, Enter and Esc work.
function popMenu(x, y, items, { title = '', from = null } = {}) {
  if (popMenu.close) popMenu.close(); // one at a time
  return new Promise((resolve) => {
    const menu = document.createElement('div');
    menu.className = 'pop-menu';
    menu.setAttribute('role', 'menu');
    if (title) {
      const h = document.createElement('div');
      h.className = 'pm-title';
      h.textContent = title;
      menu.setAttribute('aria-label', title);
      menu.appendChild(h);
    }
    for (const it of items) {
      if (it === '-') {
        const sep = document.createElement('div');
        sep.className = 'pm-sep';
        menu.appendChild(sep);
        continue;
      }
      const b = document.createElement('button');
      b.setAttribute('role', it.checked !== undefined ? 'menuitemradio' : 'menuitem');
      if (it.checked !== undefined) b.setAttribute('aria-checked', it.checked ? 'true' : 'false');
      b.className = (it.checked ? 'on' : '') + (it.danger ? ' danger' : '');
      b.textContent = it.label;
      b.disabled = !!it.disabled;
      b.tabIndex = -1;
      b.onclick = () => done(it.value);
      b.onmouseenter = () => { if (!b.disabled) b.focus({ preventScroll: true }); };
      menu.appendChild(b);
    }
    document.body.appendChild(menu);
    // opened from the keyboard (no pointer), it hangs from the thing it's for
    if ((!x && !y) && from) {
      const r = from.getBoundingClientRect();
      x = r.left + 12;
      y = r.bottom;
    }
    const zoom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-zoom')) || 1;
    const w = menu.offsetWidth * zoom;
    const h = menu.offsetHeight * zoom;
    const left = Math.max(4, Math.min(x, window.innerWidth - w - 4));
    const top = y + h > window.innerHeight - 4 ? Math.max(4, y - h) : y;
    menu.style.left = left / zoom + 'px';
    menu.style.top = top / zoom + 'px';
    const back = document.activeElement;
    const buttons = [...menu.querySelectorAll('button:not(:disabled)')];
    const done = (value) => {
      if (!menu.isConnected) return;
      menu.remove();
      popMenu.close = null;
      document.removeEventListener('mousedown', outside, true);
      window.removeEventListener('blur', cancel);
      // the Chapters pane it kept open closes if the pointer has left it
      const nav = $('#nav-pane');
      if (nav && nav.dataset.pinned !== '1' && !nav.matches(':hover')) nav.classList.remove('open');
      if (value === null && back && back.isConnected && back.focus) back.focus({ preventScroll: true });
      resolve(value);
    };
    const cancel = () => done(null);
    popMenu.close = cancel;
    const outside = (e) => { if (!menu.contains(e.target)) done(null); };
    document.addEventListener('mousedown', outside, true);
    window.addEventListener('blur', cancel);
    menu.addEventListener('keydown', (e) => {
      const at = buttons.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); done(null); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const next = buttons[(at + (e.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length];
        if (next) next.focus();
      } else if (e.key === 'Tab') e.preventDefault();
      e.stopPropagation();
    });
    (buttons.find((b) => b.classList.contains('on')) || buttons[0] || menu).focus({ preventScroll: true });
  });
}

// A click (or tap) on the dim page around any dialog dismisses it the way
// its own quiet button would — Cancel or Later where there is one, else
// Done/OK. Dialogs that must be answered have neither and stay put.
document.addEventListener('mousedown', (e) => {
  const bd = e.target && e.target.classList && e.target.classList.contains('modal-backdrop') ? e.target : null;
  if (!bd || bd.dataset.stay === '1') return;
  const btn = bd.querySelector('.m-cancel') || bd.querySelector('.m-ok');
  if (btn) btn.click();
});

function toast(msg, ms = 4000) {
  const h = $('#hint');
  h.textContent = msg;
  h.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { h.hidden = true; }, ms);
}

// Scripts that do not separate words with spaces: a whitespace count reports
// one "word" for a whole sentence, so word goals and statistics read far too
// low. Intl.Segmenter knows their boundaries; the same API already runs the
// focus mode (see sentenceRange), and one segmenter is kept per script.
const SEGMENTED_SCRIPTS = [
  { lang: 'th', chars: /[\u0E00-\u0E7F]/ }, // Thai
  { lang: 'lo', chars: /[\u0E80-\u0EFF]/ }, // Lao
  { lang: 'my', chars: /[\u1000-\u109F]/ }, // Myanmar
  { lang: 'km', chars: /[\u1780-\u17FF]/ }  // Khmer
];
let wordSegmenter = null;
let wordSegmenterLang = '';

// a word holds at least one letter or digit, so French « » and spaced
// dashes are not counted as words
function countWords(text) {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  if (window.Intl && Intl.Segmenter) {
    const script = SEGMENTED_SCRIPTS.find((s) => s.chars.test(trimmed));
    if (script) {
      if (wordSegmenterLang !== script.lang) {
        wordSegmenter = new Intl.Segmenter(script.lang, { granularity: 'word' });
        wordSegmenterLang = script.lang;
      }
      let words = 0;
      for (const part of wordSegmenter.segment(trimmed)) if (part.isWordLike) words += 1;
      return words;
    }
  }
  return (trimmed.match(/\S+/g) || []).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function cleanChapterEl(id) {
  const el = document.querySelector(`.chapter[data-id="${id}"] .chapter-body`);
  const holder = document.createElement('div');
  holder.innerHTML = el ? el.innerHTML : (chapterHTML[id] || '');
  holder.querySelectorAll('.darling-anchor, .ph-mark, .ghost').forEach((n) => n.remove());
  return holder;
}
// Text a line to each paragraph. innerText does that only for what is laid
// out on screen: of a copy held aside, like the one above, it runs one
// paragraph's last word into the next one's first ("end.Next"), and the two
// count as one word. A range's toString runs them together the same way.
function plainText(root) {
  root.querySelectorAll('p, div, br').forEach((el) => el.after('\n'));
  return root.textContent;
}
const chapterText = (id) => plainText(cleanChapterEl(id));

// Word counts are cached per chapter and only recomputed for the chapter being edited.
let wordCache = {};
function chapterWords(chId) {
  if (wordCache[chId] == null) wordCache[chId] = countWords(chapterText(chId));
  return wordCache[chId];
}

/* ================================================================== */
