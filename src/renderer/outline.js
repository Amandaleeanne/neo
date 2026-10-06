'use strict';

/* ================================================================== */
/*  STRUCTURED OUTLINE                                                 */
/*  Chapter lines are the book's real chapters. Scene and beat notes  */
/*  become grayed "ghost" paragraphs in the manuscript                */
/* ================================================================== */

const secLetter = (i) => String.fromCharCode(65 + (i % 26));

/**
 * Where the caret goes after a section is removed from the outline: the end of the section ABOVE it,
 * the way a text editor behaves. Only the first section has no line above it, and then the chapter's
 * own line is where the caret belongs.
 */
function focusAfterSectionRemoved(list, index, chId) {
  const above = index > 0 ? list[index - 1] : undefined;
  return above ? { secId: above.id } : { chId };
}

function renderOutline(focusTarget) {
  book.sectionNotes = book.sectionNotes || {};
  book.chapterNotes = book.chapterNotes || {};
  const wrap = $('#outline-list');
  wrap.innerHTML = '';

  // the story's lines, with each part standing over its chapters (the pages
  // a book carries have nothing to outline)
  book.chapterOrder.forEach((chId, i) => {
    const kind = chapterKind(chId);
    if (kind === 'part') { wrap.appendChild(outlinePartLine(chId)); return; }
    if (!STORY_KINDS.includes(kind)) return;
    wrap.appendChild(outlineLine('chapter', chId, null, i, chapterMark(chId),
      book.chapterNotes[chId] || ''));
    (book.sectionNotes[chId] || []).forEach((sec, j) => {
      wrap.appendChild(outlineLine('section', chId, sec.id, j, secLetter(j), sec.text));
      (sec.beats || []).forEach((beat, k) => {
        wrap.appendChild(outlineLine('beat', chId, sec.id, k, roman(k + 1).toLowerCase(), beat.text, beat.id));
      });
    });
  });

  const hint = document.createElement('div');
  hint.className = 'ol-hint';
  hint.textContent = t('Enter — new line · Tab — chapter to scene, or scene to beat · Shift+Tab — scene to chapter, or beat to scene · Backspace on an empty line removes it');
  wrap.appendChild(hint);

  if (focusTarget) {
    const selector = focusTarget.beatId
      ? `.ol-line[data-beat-id="${focusTarget.beatId}"] .ol-text`
      : focusTarget.secId
        ? `.ol-line[data-sec-id="${focusTarget.secId}"] .ol-text`
        : `.ol-line.ol-chapter[data-ch-id="${focusTarget.chId}"] .ol-text`;
    const el = wrap.querySelector(selector);
    if (el) {
      el.focus();
      const r = document.createRange();
      r.selectNodeContents(el);
      r.collapse(false);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
  }
}

// a part in the outline: its name and title, over the chapters it holds
function outlinePartLine(chId) {
  const line = document.createElement('div');
  line.className = 'ol-line ol-part';
  line.dataset.chId = chId;
  const num = document.createElement('span');
  num.className = 'ol-num';
  num.textContent = chapterMark(chId);
  const name = document.createElement('div');
  name.className = 'ol-part-name';
  const title = partTitleOf(chId);
  name.textContent = chapterName(chId) + (title ? ': ' + title : '');
  line.append(num, name);
  line.addEventListener('contextmenu', (e) => { e.preventDefault(); chapterMenu(chId, e.clientX, e.clientY, line); });
  return line;
}

// the story entry before this one (pages and parts aren't where sections go)
function storyBefore(chId) {
  const order = book.chapterOrder;
  for (let i = order.indexOf(chId) - 1; i >= 0; i--) if (isStory(order[i])) return order[i];
  return null;
}

let freshSceneId = null;

function addBeat(chId, secId, index) {
  const sec = (book.sectionNotes[chId] || []).find((s) => s.id === secId);
  if (!sec) return;
  sec.beats = sec.beats || [];
  const beat = { id: 'beat-' + Date.now().toString(36), text: '' };
  sec.beats.splice(index, 0, beat);
  scheduleMetaSave();
  syncGhosts(chId);
  renderOutline({ beatId: beat.id });
}

function indentFreshScene(chId, secId) {
  const list = book.sectionNotes[chId] || [];
  const index = list.findIndex((s) => s.id === secId);
  if (index <= 0) return false;

  const scene = list[index];
  const parent = list[index - 1];
  const beat = { id: 'beat-' + Date.now().toString(36), text: scene.text };
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  const paragraph = body && body.querySelector(`p[data-sec-id="${secId}"]`);
  if (paragraph) {
    paragraph.removeAttribute('data-sec-id');
    paragraph.dataset.beatId = beat.id;
  }
  const sceneBreak = body && body.querySelector(`p.scene-break[data-sec-brk="${secId}"]`);
  if (sceneBreak) sceneBreak.remove();

  parent.beats = [...(parent.beats || []), beat, ...(scene.beats || [])];
  list.splice(index, 1);
  freshSceneId = null;
  scheduleMetaSave();
  syncGhosts(chId);
  renderOutline({ beatId: beat.id });
  return true;
}

function removeBeat(chId, secId, beatId, index) {
  const sec = (book.sectionNotes[chId] || []).find((s) => s.id === secId);
  if (!sec) return;
  const beats = sec.beats || [];
  const focus = beats.length > 1
    ? { beatId: beats[index > 0 ? index - 1 : 1].id }
    : { secId };
  sec.beats = beats.filter((b) => b.id !== beatId);
  scheduleMetaSave();
  syncGhosts(chId);
  renderOutline(focus);
}

function removeScene(chId, secId, index) {
  const list = book.sectionNotes[chId] || [];
  const scene = list[index];
  if (!scene || scene.id !== secId) return;
  const above = index > 0 ? list[index - 1] : null;
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  const focus = above ? { secId: above.id } : { chId };
  const scenePara = body && body.querySelector(`p[data-sec-id="${secId}"]`);
  if (scenePara && !scenePara.classList.contains('ghost')) scenePara.removeAttribute('data-sec-id');

  if (library.mergeBeatsOnSceneDelete && scene.beats && scene.beats.length) {
    if (above) {
      above.beats = [...(above.beats || []), ...scene.beats];
    }
  }
  if (!library.mergeBeatsOnSceneDelete || !above) {
    for (const beat of scene.beats || []) {
      const paragraph = body && body.querySelector(`p[data-beat-id="${beat.id}"]:not(.ghost)`);
      if (paragraph) paragraph.removeAttribute('data-beat-id');
    }
  }

  list.splice(index, 1);
  scheduleMetaSave();
  syncGhosts(chId);
  renderOutline(focus);
}

function outlineLine(kind, chId, secId, index, label, text, beatId = null) {
  const line = document.createElement('div');
  line.className = 'ol-line ol-' + kind;
  line.dataset.chId = chId;
  if (secId) line.dataset.secId = secId;
  if (beatId) line.dataset.beatId = beatId;
  const num = document.createElement('span');
  num.className = 'ol-num';
  num.textContent = label;
  if (kind === 'chapter' && chapterKind(chId) !== 'chapter') num.title = chapterName(chId);
  const txt = document.createElement('div');
  txt.className = 'ol-text';
  txt.contentEditable = 'true';
  txt.spellcheck = false;
  txt.textContent = text;

  const save = () => {
    const val = txt.textContent.trim();
    if (kind === 'chapter') {
      book.chapterNotes[chId] = val;
    } else if (kind === 'section') {
      const sec = (book.sectionNotes[chId] || []).find((s) => s.id === secId);
      if (sec) sec.text = val;
    } else {
      const sec = (book.sectionNotes[chId] || []).find((s) => s.id === secId);
      const beat = sec && (sec.beats || []).find((b) => b.id === beatId);
      if (beat) beat.text = val;
    }
    scheduleMetaSave();
  };

  txt.addEventListener('blur', () => {
    save();
    if (kind !== 'chapter') syncGhosts(chId);
    renderNav();
  });

  // Enter at the very start of a line that has text makes the new line
  // ABOVE it (the only way to put something before "A"); anywhere else,
  // below — the way a text editor's outline behaves
  const caretAtStart = () => {
    if (!txt.textContent.trim()) return false;
    const sel = window.getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const r = sel.getRangeAt(0);
    if (!txt.contains(r.startContainer)) return false;
    const head = document.createRange();
    head.selectNodeContents(txt);
    head.setEnd(r.startContainer, r.startOffset);
    return head.toString().length === 0;
  };

  txt.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const above = caretAtStart();
      save();
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
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const lines = [...document.querySelectorAll('.ol-line .ol-text')];
      const next = lines[lines.indexOf(txt) + (e.key === 'ArrowDown' ? 1 : -1)];
      if (next) {
        next.focus();
        const r = document.createRange();
        r.selectNodeContents(next);
        r.collapse(false);
        const s = window.getSelection();
        s.removeAllRanges(); s.addRange(r);
      }
    }
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
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
      save();
      book.sectionNotes[prevCh] = book.sectionNotes[prevCh] || [];
      const newSec = { id: 'sec-' + Date.now().toString(36), text: txt.textContent.trim() };
      book.sectionNotes[prevCh].push(newSec);
      deleteChapterQuiet(chId).then(() => {
        syncGhosts(prevCh);
        renderOutline({ secId: newSec.id });
      });
    }
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      if (kind === 'beat') {
        save();
        const list = book.sectionNotes[chId] || [];
        const parent = list.find((s) => s.id === secId);
        if (!parent) return;
        const beat = (parent.beats || []).find((b) => b.id === beatId);
        if (!beat) return;
        parent.beats = parent.beats.filter((b) => b.id !== beatId);
        const newSec = { id: beat.id, text: beat.text };
        list.splice(list.indexOf(parent) + 1, 0, newSec);
        const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
        const written = body && body.querySelector(`p[data-beat-id="${beatId}"]:not(.ghost)`);
        if (written) {
          let prior = written.previousElementSibling;
          let earlierText = false;
          while (prior) {
            if (prior.textContent.trim() && !prior.classList.contains('scene-break')) {
              earlierText = true;
              break;
            }
            prior = prior.previousElementSibling;
          }
          if (earlierText && !(written.previousElementSibling && written.previousElementSibling.classList.contains('scene-break'))) {
            const brk = document.createElement('p');
            brk.className = 'scene-break';
            brk.textContent = '***';
            written.before(brk);
          }
          written.removeAttribute('data-beat-id');
          written.dataset.secId = newSec.id;
        }
        scheduleMetaSave();
        syncGhosts(chId);
        renderOutline({ secId: newSec.id });
        return;
      }
      if (kind !== 'section') return;
      save();
      const list = book.sectionNotes[chId];
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
      const at = book.chapterOrder.indexOf(chId) + 1;
      const newId = createChapterAt(at);
      book.chapterNotes[newId] = sec.text;
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
      scheduleMetaSave();
      renderOutline({ chId: newId });
    }
    if (e.key === 'Backspace' && txt.textContent.trim() === '') {
      e.preventDefault();
      if (kind === 'section' || kind === 'beat') {
        const list = book.sectionNotes[chId] || [];
        if (kind === 'section') {
          removeScene(chId, secId, index);
        } else {
          removeBeat(chId, secId, beatId, index);
        }
      } else if (book.chapterOrder.filter((c) => isStory(c)).length > 1 && countWords(chapterText(chId)) === 0) {
        const prevCh = storyBefore(chId) || book.chapterOrder.find((c) => c !== chId && isStory(c));
        deleteChapterQuiet(chId).then(() => renderOutline({ chId: prevCh }));
      }
    }
    e.stopPropagation();
  });

  // right-click any outline line to delete it
  line.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    if (kind === 'chapter') {
      await chapterMenu(chId, e.clientX, e.clientY, line);
    } else {
      const choice = await optionModal(
        kind === 'beat' ? t('Delete this beat?') : t('Delete this scene?'), null,
        [{ label: kind === 'beat' ? t('Delete beat') : t('Delete scene'), desc: t('Removes the outline line and its gray ghost from the manuscript. Written prose is never touched.'), danger: true, value: 'delete' }]);
      if (choice === 'delete') {
        if (kind === 'beat') {
          removeBeat(chId, secId, beatId, index);
        } else {
          removeScene(chId, secId, index);
        }
      }
    }
  });

  line.appendChild(num);
  line.appendChild(txt);
  return line;
}

// Push scene and beat notes into the manuscript as gray ghost paragraphs,
// with real *** scene breaks between scenes and none between beats.
// Once a ghost has been written over, it goes away.
function syncGhosts(chId) {
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  if (!body) return;
  const list = (book.sectionNotes && book.sectionNotes[chId]) || [];
  const keep = new Set(list.map((s) => s.id));
  const keepBeats = new Set(list.flatMap((s) => (s.beats || []).map((b) => b.id)));

  const breakFor = (secId) => body.querySelector(`p.scene-break[data-sec-brk="${secId}"]`);

  // 1. Sections deleted from the outline: remove their ghost + its break
  //    (but never touch paragraphs that have been written over)
  body.querySelectorAll('p.ghost[data-sec-id]').forEach((p) => {
    if (!keep.has(p.dataset.secId)) {
      const brk = breakFor(p.dataset.secId);
      if (brk) brk.remove();
      p.remove();
    }
  });
  body.querySelectorAll('p.ghost[data-beat-id]').forEach((p) => {
    if (!keepBeats.has(p.dataset.beatId)) p.remove();
  });

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
    }
  }
  syncChapter(body, chId);
}

let auxDirty = false;
$('#aux-editor').addEventListener('keydown', (e) => { if (styleKeepScroll(e)) return; smartKeys(e, e.currentTarget); });
$('#aux-editor').addEventListener('input', () => {
  auxDirty = true;
  scheduleAuxSave();
  if (spellOn) {
    const key = 'aux-' + ($('#aux-editor').dataset.kind || 'notes');
    scheduleSpellRescan(key, $('#aux-editor'));
  }
});
// notes paste arrives clean, same as the manuscript
$('#aux-editor').addEventListener('paste', (e) => {
  e.preventDefault();
  const html = e.clipboardData.getData('text/html');
  const text = e.clipboardData.getData('text/plain');
  if (html) document.execCommand('insertHTML', false, cleanPasteHtml(html));
  else if (text) document.execCommand('insertText', false, text.replace(/\r/g, ''));
});
function scheduleAuxSave() {
  clearTimeout(saveTimers.aux);
  saveTimers.aux = setTimeout(flushAux, 800);
}
function flushAux() {
  if (!auxDirty || !book) return;
  const kind = $('#aux-editor').dataset.kind;
  if (kind) window.neo.writeAux(book.id, kind, $('#aux-editor').innerHTML);
  auxDirty = false;
}

function renderDarlings() {
  const wrap = $('#darlings-list');
  wrap.innerHTML = '';
  if (darlings.length === 0) {
    wrap.innerHTML = `<div class="darlings-empty">${t('When a beautiful paragraph is gumming up the works, select it and drag it onto the Darlings tab below.')}<br>${t('It leaves your manuscript but it is never lost.')}</div>`;
    return;
  }
  for (const d of darlings) {
    const el = document.createElement('div');
    el.className = 'darling';
    const content = document.createElement('div');
    if (d.html) content.innerHTML = d.html;
    else content.textContent = d.text;
    const meta = document.createElement('div');
    meta.className = 'd-meta';
    const when = fmtDate(d.date);
    meta.innerHTML = `<span>${t('from {label} · {date} · {n} words', { label: d.chapterLabel, date: when, n: countWords(d.text) })}</span>
      <span><button class="d-restore">${t('Restore')}</button> <button class="d-del">${t('Delete forever')}</button></span>`;
    meta.querySelector('.d-restore').onclick = () => restoreDarling(d.id);
    meta.querySelector('.d-del').onclick = async () => {
      snapshotStructure('darling delete');
      // tidy up the invisible anchor the darling left behind
      const anchor = document.querySelector(`.darling-anchor[data-did="${d.id}"]`);
      if (anchor) {
        const body = anchor.closest('.chapter-body');
        const chId = anchor.closest('.chapter').dataset.id;
        anchor.remove();
        syncChapter(body, chId);
      }
      darlings = darlings.filter((x) => x.id !== d.id);
      await window.neo.writeJSON(book.id, 'darlings', darlings);
      renderDarlings();
    };
    el.appendChild(content);
    el.appendChild(meta);
    wrap.appendChild(el);
  }
}

async function restoreDarling(id) {
  const d = darlings.find((x) => x.id === id);
  if (!d) return;
  snapshotStructure('darling restore');
  switchTab('manuscript');

  // Preferred: put it back in the exact spot it was cut from, located by
  // the remembered text surrounding the cut point
  if (d.chapterId && book.chapterOrder.includes(d.chapterId)) {
    const body = document.querySelector(`.chapter[data-id="${d.chapterId}"] .chapter-body`);
    const pos = body ? findDarlingPosition(body, d) : -1;
    if (body && pos !== -1) {
      const at = textPosToRange(body, pos);
      if (at) {
        let scrollTo = at.startContainer.parentElement?.closest?.('p') || body;
        if (d.html && /<p[\s>]/i.test(d.html)) {
          // block content: paragraphs go back in after the host paragraph
          const holder = document.createElement('div');
          holder.innerHTML = d.html;
          let ref = scrollTo === body ? body.lastElementChild : scrollTo;
          scrollTo = holder.firstElementChild || scrollTo;
          for (const n of [...holder.childNodes]) { ref.after(n); ref = n; }
        } else {
          // inline content: slot it right where the caret was
          at.insertNode(document.createRange().createContextualFragment(d.html || d.text));
        }
        syncChapter(body, d.chapterId);
        darlings = darlings.filter((x) => x.id !== id);
        await window.neo.writeJSON(book.id, 'darlings', darlings);
        scrollTo.scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
        toast(t('Darling restored to its original spot'));
        return;
      }
    }
  }

  // Fallback: the spot no longer exists — end of its chapter (or the last one)
  let chId = d.chapterId && book.chapterOrder.includes(d.chapterId)
    ? d.chapterId
    : book.chapterOrder[book.chapterOrder.length - 1];
  if (!chId) { newChapter(); chId = book.chapterOrder[0]; }
  const body = document.querySelector(`.chapter[data-id="${chId}"] .chapter-body`);
  const frag = d.html ? d.html : '<p>' + d.text.replace(/\n+/g, '</p><p>') + '</p>';
  body.insertAdjacentHTML('beforeend', frag);
  chapterHTML[chId] = captureBody(body);
  scheduleChapterSave(chId);
  darlings = darlings.filter((x) => x.id !== id);
  await window.neo.writeJSON(book.id, 'darlings', darlings);
  focusChapter(chId);
  toast(t('Original spot is gone — restored to the end of {label}', { label: d.chapterLabel || t('the manuscript') }));
}

