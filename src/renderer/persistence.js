'use strict';

/*  SAVING                                                             */
/* ================================================================== */

// One door for chapter writes, so NEO always knows what is on disk. That
// knowledge is what lets it write only what changed (a library shared over
// iCloud or Syncthing must not be re-written every twenty seconds) and, in
// refreshFromDisk, tell another device's edits from its own.
function persistChapter(chId, html) {
  if (!book) return Promise.resolve(false);
  if (html === undefined) html = chapterHTML[chId] || '';
  const before = savedHTML[chId];
  savedHTML[chId] = html;
  writing[chId] = (writing[chId] || 0) + 1;
  return new Promise((resolve) => resolve(window.neo.writeChapter(book.id, chId, html))).catch((err) => {
    // It never reached the disk. Book it as unsaved again, so the next flush
    // tries once more, and so a look at the disk can't take the old file
    // for news and put it back on the page.
    if (savedHTML[chId] === html) savedHTML[chId] = before;
    throw err;
  }).finally(() => { writing[chId]--; });
}

function scheduleChapterSave(chId) {
  clearTimeout(saveTimers[chId]);
  const bookId = book && book.id;
  saveTimers[chId] = setTimeout(() => {
    if (!book) return; // the book closed before the timer fired; flushAllSaves already wrote it
    // another book is open, or the chapter was deleted or merged into the one
    // above while this save waited: its words are already where they belong,
    // and writing now would only leave an empty stray file in chapters/
    if (book.id !== bookId || !book.chapterOrder.includes(chId)) return;
    persistChapter(chId);
  }, 800);
}

// book.json minus the parts every device changes constantly, and minus
// empty defaults (NEO fills in chapterTitles: {} and friends after opening;
// the file on disk may not have them yet — same book either way)
function metaSig(m) {
  if (!m) return '';
  const c = {};
  for (const k of Object.keys(m).sort()) {
    if (k === 'lastPosition' || k === 'modified' || k === 'wordCount' || k === 'dailyCounts') continue; // bookkeeping, not the book
    const v = m[k];
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'object' && Object.keys(v).length === 0) continue;
    c[k] = v;
  }
  return JSON.stringify(c);
}

function scheduleMetaSave() {
  clearTimeout(saveTimers.meta);
  saveTimers.meta = setTimeout(saveMeta, 800);
}
async function saveMeta() {
  if (!book) return;
  const sig = metaSig(book);
  const stamp = await writeBookMeta(book.id, book);
  if (book && typeof stamp === 'string') book.modified = stamp;
  savedMetaSig = sig;
}

function flushAllSaves(e) {
  if (!book) return;
  // remember where you were, for next session and for the other device:
  // the chapter, the paragraph and the letter (the same place on any
  // screen) plus the scroll (this screen's). `at` changes only when the
  // caret does, so a device that merely scrolled never calls the other
  // one back to an old spot.
  const prev = book.lastPosition || {};
  const caret = captureCaret();
  const spot = caret
    ? { chapterId: caret.chId, pIdx: caret.pIdx, off: caret.off }
    : prev.chapterId === currentChapterId ? { chapterId: prev.chapterId, pIdx: prev.pIdx, off: prev.off } : { chapterId: currentChapterId };
  const scroll = $('#paper-scroll').scrollTop;
  const newSpot = spot.chapterId !== prev.chapterId || spot.pIdx !== prev.pIdx;
  const newLetter = newSpot || spot.off !== prev.off;
  // the regular tick while writing saves a new paragraph; leaving NEO (a
  // blur, the app going to the background, closing) saves the exact letter
  const moved = newSpot || (e !== 'tick' && newLetter) || Math.abs((prev.scroll || 0) - scroll) > 40;
  if (moved) book.lastPosition = { ...spot, scroll, at: newLetter ? Date.now() : (prev.at || Date.now()) };
  for (const chId of book.chapterOrder) {
    if (chapterHTML[chId] !== undefined && chapterHTML[chId] !== savedHTML[chId]) {
      persistChapter(chId);
    }
  }
  flushAux();
  flushStickiesSave();
  if (moved || metaSig(book) !== savedMetaSig) saveMeta();
}

/* ================================================================== */
/*  REFRESH — picking up what another device wrote                     */
/*  A library shared over iCloud or Syncthing changes underneath NEO.  */
/*  Whenever NEO comes back into view it looks again: a chapter that   */
/*  changed on disk and not here is simply adopted; one that changed   */
/*  in both places keeps the local text on the page and lands the      */
/*  other device's version in a new chapter right after it, so that    */
/*  nothing is ever lost quietly.                                      */
/* ================================================================== */

// True when the disk copy of a chapter has no word the page lacks, but the
// page has words it lacks: an older copy, not an edit made somewhere else.
function onlyDrops(page, disk) {
  const bag = (html) => {
    const m = new Map();
    for (const w of String(html || '').replace(/<[^>]*>/g, ' ').split(/\s+/)) if (w) m.set(w, (m.get(w) || 0) + 1);
    return m;
  };
  const here = bag(page);
  const there = bag(disk);
  for (const [w, n] of there) if (n > (here.get(w) || 0)) return false;
  for (const [w, n] of here) if (n > (there.get(w) || 0)) return true;
  return false;
}

let refreshing = false;
async function refreshFromDisk() {
  if (refreshing) return;
  refreshing = true;
  bookMetaCache.clear(); // whatever another device wrote, the next redraw reads
  try {
    if (!book) {
      if (library && !$('#bookshelf-view').hidden) {
        const gen = libraryGeneration;
        const lib = await window.neo.readLibrary();
        // a change made here while that read was out (a new shelf, a rename)
        // is newer than what came back: taking it would undo the change,
        // and the next save would make that stick. Look again next time.
        if (gen !== libraryGeneration || libraryWritesPending) return;
        if (lib && lib.firstRunDone && JSON.stringify(lib) !== JSON.stringify(library)) {
          library = lib;
          const shelf = $('#bookshelf-view');
          const keep = shelf.scrollTop;
          await renderShelves();
          shelf.scrollTop = keep;
        }
      }
      return;
    }
    const bookId = book.id;
    if (window.neo.refreshBook) await window.neo.refreshBook(bookId);
    const meta = await window.neo.readBookMeta(bookId);
    if (!book || book.id !== bookId || !meta) return;

    // First read everything that changed; the page is left alone until it is
    // all in. (Deciding chapter by chapter between reads let a keystroke land
    // on a page that no longer matched what NEO held, and reopening the book
    // for a new book.json dropped whatever was typed while it loaded.)
    const theirs = metaSig(meta) !== savedMetaSig && Array.isArray(meta.chapterOrder);
    const sigHere = metaSig(book);
    const mine = sigHere !== savedMetaSig; // restructured here too, not saved yet
    const incoming = {}; // chapters new to this device
    let side = null;
    if (theirs) {
      for (const chId of meta.chapterOrder) {
        if (chapterHTML[chId] !== undefined) continue;
        incoming[chId] = await window.neo.readChapter(bookId, chId);
        if (!book || book.id !== bookId) return;
      }
      side = {
        stickies: await window.neo.readJSON(bookId, 'stickies', stickies),
        darlings: await window.neo.readJSON(bookId, 'darlings', darlings)
      };
    }
    // file times first, so only chapters that changed on disk are re-read
    // (a whole novel crossing the bridge every half minute is a hiccup)
    let stamps = null;
    if (window.neo.chapterStamps) {
      try { stamps = await window.neo.chapterStamps(bookId); } catch { stamps = null; }
    }
    const fresh = [];
    for (const chId of [...book.chapterOrder]) {
      if (writing[chId]) continue; // a save of ours is on its way: the file is ours, not news
      const st = stamps ? stamps[chId] : undefined;
      if (st !== undefined && st === diskStamps[chId]) continue;
      const before = savedHTML[chId];
      const disk = await window.neo.readChapter(bookId, chId);
      if (!book || book.id !== bookId) return;
      fresh.push({ chId, st, before, disk });
    }
    if (!book || book.id !== bookId) return;

    // Then decide it all in one go: nothing waits from here to the page.
    let restructured = false;
    if (theirs && metaSig(book) === sigHere) {
      // The other device added, renamed or moved chapters. Whichever
      // book.json stands, no chapter holding words is dropped: theirs keeps
      // the chapters with unsaved words here, and ours (when this device
      // restructured too and hasn't saved yet) takes in the chapters they wrote.
      const order = [...(mine ? book.chapterOrder : meta.chapterOrder)];
      const other = mine ? meta.chapterOrder : book.chapterOrder;
      other.forEach((chId, i) => {
        if (order.includes(chId)) return;
        if (mine ? !/[^\s]/.test(String(incoming[chId] || '').replace(/<[^>]*>/g, '')) : chapterHTML[chId] === savedHTML[chId]) return;
        const prev = other.slice(0, i).reverse().find((c) => order.includes(c));
        order.splice(prev ? order.indexOf(prev) + 1 : 0, 0, chId);
      });
      if (!mine || order.length !== book.chapterOrder.length) {
        for (const chId of order) {
          if (!(chId in incoming)) continue;
          chapterHTML[chId] = incoming[chId];
          savedHTML[chId] = incoming[chId];
        }
        if (mine) {
          book.chapterOrder = order;
        } else {
          book = { ...meta, chapterOrder: order, lastPosition: book.lastPosition };
          savedMetaSig = metaSig(meta);
          stickies = side.stickies;
          darlings = side.darlings;
        }
        if (metaSig(book) !== savedMetaSig) scheduleMetaSave();
        if (!book.chapterOrder.includes(currentChapterId)) currentChapterId = null;
        undoStack = []; // snapshots of the old structure must not replay over the new one
        restructured = true;
      }
    }
    let adopted = 0;
    let conflicts = 0;
    const replaced = []; // page text a disk copy would otherwise have taken away
    for (const { chId, st, before, disk } of fresh) {
      if (!book.chapterOrder.includes(chId)) continue;
      // A save of ours crossed this read, so what came back can be older
      // than the page. Taking it put the old text back on the page, and the
      // next save made that stick. Look again next time.
      if (writing[chId] || savedHTML[chId] !== before) continue;
      if (typeof disk !== 'string') continue;
      if (disk === '' && savedHTML[chId]) continue; // unreadable or still downloading: not a change
      if (stamps) diskStamps[chId] = st; // seen; a file not read stays on the list
      if (disk === savedHTML[chId]) continue;
      if (chapterHTML[chId] === savedHTML[chId]) {
        // A copy with nothing new in it, only fewer words, is an older copy
        // coming back (or text cut on the other device): the page's version
        // goes to Darlings instead of nowhere.
        if (onlyDrops(chapterHTML[chId], disk)) {
          const holder = document.createElement('div');
          holder.innerHTML = chapterHTML[chId];
          replaced.push({
            id: 'd-' + Date.now().toString(36) + replaced.length,
            html: chapterHTML[chId],
            text: [...holder.children].map((p) => p.textContent).join('\n\n').slice(0, 2000),
            chapterId: chId,
            chapterLabel: t('Chapter {n}', { n: book.chapterOrder.indexOf(chId) + 1 }),
            date: new Date().toISOString()
          });
        }
        chapterHTML[chId] = disk;
        savedHTML[chId] = disk;
        wordCache[chId] = null;
        adopted++;
      } else {
        savedHTML[chId] = disk; // what's on disk now; our text goes over it on the next save
        const idx = book.chapterOrder.indexOf(chId);
        const twinId = 'ch-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        book.chapterOrder.splice(idx + 1, 0, twinId);
        book.chapterTitles = book.chapterTitles || {};
        const when = new Date().toLocaleTimeString(NeoI18n.getLocale(), { hour: 'numeric', minute: '2-digit' });
        book.chapterTitles[twinId] = ((book.chapterTitles[chId] || '') + ' ' + t('from other device, {time}', { time: when })).trim();
        chapterHTML[twinId] = disk;
        persistChapter(twinId, disk);
        persistChapter(chId);
        scheduleMetaSave();
        conflicts++;
      }
    }
    if (restructured || adopted || conflicts) {
      const caret = captureCaret();
      const keepScroll = $('#paper-scroll').scrollTop;
      renderChapters();
      $('#paper-scroll').scrollTop = keepScroll;
      if (caret) restoreCaret(caret);
      if (restructured) {
        const show = (el, text) => { if (el.textContent !== text) el.textContent = text; };
        show($('#tp-title'), isUntitled(book.title) ? '' : book.title);
        show($('#tp-subtitle'), book.subtitle || '');
        show($('#tp-author'), book.author || t('Anonymous'));
        $$('.tab[data-tab="notes"]')[0].textContent = tabName('notes');
        $$('.tab[data-tab="outline"]')[0].textContent = tabName('outline');
        renderStickies();
        if (currentTab === 'outline') renderOutline();
      }
      updateCounters();
      scheduleNavRefresh();
      if (replaced.length) {
        darlings.unshift(...replaced);
        window.neo.writeJSON(bookId, 'darlings', darlings);
      }
      if (currentTab === 'darlings' && (restructured || replaced.length)) renderDarlings();
      if (conflicts) toast(t('This chapter also changed on another device. That version is saved as the chapter after it.'), 8000);
      else if (replaced.length) toast(t('Updated from your other device — the text it replaced is in Darlings'), 8000);
      else toast(t('Updated from your other device'));
    }

    // The writer moved on to the other device since last touching this one:
    // the caret goes where they left off there. (Its chapter's words may
    // still be crossing over; the spot waits a little for its paragraph.)
    const there = meta.lastPosition;
    const here = book.lastPosition || {};
    if (there && typeof there.at === 'number' && there.at > (here.at || 0) && there.at > lastHereActivity &&
        currentTab === 'manuscript' && !document.querySelector('.modal-backdrop:not([hidden])') &&
        book.chapterOrder.includes(there.chapterId)) {
      const body = document.querySelector(`.chapter[data-id="${there.chapterId}"] .chapter-body`);
      const arrived = body && (typeof there.pIdx !== 'number' || body.querySelectorAll('p').length > there.pIdx);
      if ((arrived || Date.now() - there.at > 120000) && resumePosition(there)) {
        book.lastPosition = { ...there, scroll: $('#paper-scroll').scrollTop };
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    refreshing = false;
  }
}
window.addEventListener('focus', () => setTimeout(refreshFromDisk, 300));
// and a quiet look every half minute while NEO is on screen, for the writer
// who left both machines open
setInterval(() => { if (document.visibilityState === 'visible') refreshFromDisk(); }, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') setTimeout(refreshFromDisk, 300);
  else if (book) flushAllSaves(); // iOS may end a backgrounded app without warning
});

window.addEventListener('beforeunload', flushAllSaves);
// flush whenever focus leaves NEO, and every 20 seconds
window.addEventListener('blur', () => { if (book) flushAllSaves(); });
setInterval(() => { if (book) flushAllSaves('tick'); }, 20000);

async function backToShelf() {
  if (reading) stopReadAloud(false);
  flushAllSaves();
  tabPlaces = {};
  book = null;
  currentChapterId = null;
  undoStack = [];
  spEditorMode();
  spReportState();
  $('#editor-view').hidden = true;
  $('#bookshelf-view').hidden = false;
  renderShelves();
}
$('#back-to-shelf').onclick = backToShelf;

/* ================================================================== */
