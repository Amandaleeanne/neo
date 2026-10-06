'use strict';

module.exports = function registerLibraryStorage({ fs, path, ipcMain, BrowserWindow, dialog, shell, t, logError, getLibraryDir, getLibraryFile }) {
  function ensureLibrary() {
    if (!fs.existsSync(getLibraryDir())) fs.mkdirSync(getLibraryDir(), { recursive: true });
    if (!fs.existsSync(getLibraryFile())) {
      const seed = {
        authorName: '',
        penNames: [],
        firstRunDone: false,
        pageTheme: 'night',
        shelves: [{ id: 'shelf-1', name: t('Works in Progress'), bookIds: [] }]
      };
      fs.writeFileSync(getLibraryFile(), JSON.stringify(seed, null, 2));
    }
  }

  // Every book, chapter and sidecar name the page sends is one plain name
  // inside the library: ".", ".." and path separators never reach the disk.
  // Any name NEO ever made passes, and so does a folder named by hand.
  function libName(name) {
    if (typeof name !== 'string' || !name || name === '.' || name === '..' || /[\\/\0]/.test(name)) {
      throw new Error('Invalid library name');
    }
    return name;
  }

  function bookDir(bookId) {
    return path.join(getLibraryDir(), libName(bookId));
  }

  // A human-readable map of the library, regenerated on every change:
  // which folder is which book, and what shelf it lives on. Sorts to the
  // top of the folder so browsing writers can always find their way.
  function writeCatalog() {
    try {
      const lib = readJSON(getLibraryFile(), { shelves: [] });
      const onShelf = {};
      for (const s of lib.shelves || []) {
        for (const id of s.bookIds) onShelf[id] = s.name;
      }
      const lines = [];
      for (const d of fs.readdirSync(getLibraryDir())) {
        if (!d.startsWith('book-')) continue;
        try {
          const m = JSON.parse(fs.readFileSync(path.join(getLibraryDir(), d, 'book.json'), 'utf8'));
          lines.push(`${m.title || t('Untitled')}  —  ${d}  —  ${t('shelf:')} ${onShelf[m.id] || t('(none — removed from shelves)')}`);
        } catch { /* not a valid book folder */ }
      }
      lines.sort((a, b) => a.localeCompare(b));
      fs.writeFileSync(path.join(getLibraryDir(), '_catalog.txt'),
        t('NEO LIBRARY CATALOG — which folder is which book') + '\n' +
        t('(regenerated automatically; edits here do nothing)') + '\n\n' +
        lines.join('\n') + '\n');
    } catch (err) {
      logError('catalog', err);
    }
  }

  // Writing that survives the power going out. A new file is written beside
  // the old one, pushed all the way to the disk (fsync), and only then swapped
  // in. Without the push, a power cut right after the swap can leave the swap
  // done and the words not: an empty book.json, and the book gone from its
  // shelf (#219). A missing file or an unlucky moment never costs more than
  // the last few seconds.
  function writeFileDurable(file, data) {
    const tmp = file + '.tmp';
    const fd = fs.openSync(tmp, 'w');
    try {
      fs.writeSync(fd, typeof data === 'string' ? data : Buffer.from(data));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tmp, file);
    // the swap itself, on systems that let a folder be pushed too
    if (process.platform !== 'win32') {
      try { const d = fs.openSync(path.dirname(file), 'r'); try { fs.fsyncSync(d); } finally { fs.closeSync(d); } } catch { /* fine */ }
    }
  }

  // JSON reads fall back on the copies a write leaves: the .tmp a write was
  // making when it stopped, then .bak, the last version that read whole. What
  // they recover is put back as the file itself.
  function parseJSONFile(file) {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return undefined; }
  }
  function readJSON(file, fallback) {
    const main = parseJSONFile(file);
    if (main !== undefined) return main;
    if (!fs.existsSync(file) && !fs.existsSync(file + '.bak')) return fallback;
    for (const spare of [file + '.tmp', file + '.bak']) {
      const v = parseJSONFile(spare);
      if (v === undefined) continue;
      logError('recovered', `${file} was unreadable; restored from ${path.basename(spare)}`);
      try { writeFileDurable(file, JSON.stringify(v, null, 2)); } catch (err) { logError('recover write', err); }
      return v;
    }
    return fallback;
  }

  function writeJSON(file, data) {
    // the version on disk, while it reads whole, becomes the .bak
    if (parseJSONFile(file) !== undefined) {
      try { fs.copyFileSync(file, file + '.bak'); } catch { /* the write still goes ahead */ }
    }
    writeFileDurable(file, JSON.stringify(data, null, 2));
  }

  // A book whose book.json is gone for good (and no .bak) still has its
  // chapters: the book comes back with them in the order they were made, its
  // title from the catalog, rather than vanishing from the shelf.
  function rebuildBookMeta(bookId) {
    const dir = bookDir(bookId);
    const chDir = path.join(dir, 'chapters');
    if (!fs.existsSync(chDir)) return null;
    let title = '';
    try {
      const cat = fs.readFileSync(path.join(getLibraryDir(), '_catalog.txt'), 'utf8');
      const line = cat.split('\n').find((l) => l.includes('  —  ' + bookId + '  —  '));
      if (line) title = line.split('  —  ')[0].trim();
    } catch { /* no catalog */ }
    const order = fs.readdirSync(chDir).filter((f) => f.endsWith('.html')).map((f) => f.slice(0, -5)).sort();
    const meta = {
      id: bookId,
      title: title || t('Untitled'),
      subtitle: '', series: '', author: t('Anonymous'), wordGoal: 0,
      created: new Date().toISOString(), modified: new Date().toISOString(),
      chapterOrder: order,
      tabNames: { notes: 'Notes', outline: 'Outline' }
    };
    logError('recovered', `${bookId}/book.json was lost; rebuilt from ${order.length} chapter files`);
    try { writeJSON(path.join(dir, 'book.json'), meta); } catch (err) { logError('recover write', err); }
    return meta;
  }

  // ---------------------------------------------------------------------------
  // IPC — the renderer's whole view of the disk
  // ---------------------------------------------------------------------------

  ipcMain.handle('library:read', () => {
    ensureLibrary();
    const lib = readJSON(getLibraryFile(), null);
    if (lib) return lib;
    // library.json lost with no copy to fall back on: every book in the
    // folder goes onto one shelf, so nothing disappears
    const ids = [];
    try {
      for (const d of fs.readdirSync(getLibraryDir())) {
        if (d.startsWith('book-') && fs.existsSync(path.join(getLibraryDir(), d, 'chapters'))) ids.push(d);
      }
    } catch { /* empty */ }
    const seed = { authorName: '', penNames: [], firstRunDone: ids.length > 0, pageTheme: 'night',
      shelves: [{ id: 'shelf-1', name: t('Works in Progress'), bookIds: ids }] };
    logError('recovered', `library.json was lost; ${ids.length} books put back on one shelf`);
    try { writeJSON(getLibraryFile(), seed); } catch (err) { logError('recover write', err); }
    return seed;
  });

  ipcMain.handle('library:write', (_e, data) => {
    ensureLibrary();
    writeJSON(getLibraryFile(), data);
    writeCatalog();
    return true;
  });

  // A book is a folder: book.json + chapters/*.html + notes.html + outline.html + darlings.json
  ipcMain.handle('book:create', (_e, meta) => {
    ensureLibrary();
    // folders carry a slug of the title when it's known at creation (imports),
    // so the library reads like a bookshelf in Finder too. Accents come off
    // first, so "Capítulo" reads "capitulo", not "cap-tulo"
    const slug = String(meta.title || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);
    const id = 'book-' + (slug ? slug + '-' : '') +
      Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
    const dir = bookDir(id);
    fs.mkdirSync(path.join(dir, 'chapters'), { recursive: true });
    const book = {
      id,
      title: meta.title || t('Untitled'),
      subtitle: '',
      series: '',
      author: meta.author || t('Anonymous'),
      wordGoal: 0,
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      chapterOrder: [],
      tabNames: { notes: 'Notes', outline: 'Outline' } // shown translated (see tabName in app.js)
    };
    writeJSON(path.join(dir, 'book.json'), book);
    fs.writeFileSync(path.join(dir, 'notes.html'), '');
    fs.writeFileSync(path.join(dir, 'outline.html'), '');
    writeJSON(path.join(dir, 'darlings.json'), []);
    writeJSON(path.join(dir, 'stickies.json'), []);
    return book;
  });

  // every book folder in the library, shelved or not — for File → Reshelve
  ipcMain.handle('library:listBooks', () => {
    const out = [];
    try {
      for (const d of fs.readdirSync(getLibraryDir())) {
        if (!d.startsWith('book-')) continue;
        const m = readJSON(path.join(getLibraryDir(), d, 'book.json'), null);
        if (m && m.id) out.push({ id: m.id, title: m.title || t('Untitled'), author: m.author || '', modified: m.modified || '', kind: m.kind || '' });
      }
    } catch (err) { logError('listBooks', err); }
    return out;
  });

  ipcMain.handle('book:readMeta', (_e, bookId) => {
    return readJSON(path.join(bookDir(bookId), 'book.json'), null) || rebuildBookMeta(bookId);
  });

  ipcMain.handle('book:writeMeta', (_e, bookId, meta) => {
    meta.modified = new Date().toISOString();
    writeJSON(path.join(bookDir(bookId), 'book.json'), meta);
    writeCatalog();
    return meta.modified;
  });

  // {chapterId: mtime and size} for a book's chapter files — how refreshFromDisk
  // tells what changed without re-reading every chapter. The size is there
  // because sync tools hand over the other device's mtime, and on disks that
  // keep whole seconds two saves a second apart would otherwise look the same.
  ipcMain.handle('chapter:stamps', (_e, bookId) => {
    const out = {};
    try {
      const dir = path.join(bookDir(bookId), 'chapters');
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith('.html')) continue;
        try {
          const st = fs.statSync(path.join(dir, f));
          out[f.slice(0, -5)] = st.mtimeMs + ':' + st.size;
        } catch { /* vanished */ }
      }
    } catch { /* no chapters folder yet */ }
    return out;
  });

  ipcMain.handle('chapter:read', (_e, bookId, chapterId) => {
    const file = path.join(bookDir(bookId), 'chapters', libName(chapterId) + '.html');
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  });

  ipcMain.handle('chapter:write', (_e, bookId, chapterId, html) => {
    const dir = path.join(bookDir(bookId), 'chapters');
    const file = path.join(dir, libName(chapterId) + '.html');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    writeFileDurable(file, html);
    return true;
  });

  ipcMain.handle('chapter:delete', (_e, bookId, chapterId) => {
    const file = path.join(bookDir(bookId), 'chapters', libName(chapterId) + '.html');
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return true;
  });

  ipcMain.handle('aux:read', (_e, bookId, name) => {
    // name: 'notes' | 'outline'
    const file = path.join(bookDir(bookId), libName(name) + '.html');
    try {
      return fs.readFileSync(file, 'utf8');
    } catch {
      return '';
    }
  });

  ipcMain.handle('aux:write', (_e, bookId, name, html) => {
    writeFileDurable(path.join(bookDir(bookId), libName(name) + '.html'), html);
    return true;
  });

  ipcMain.handle('json:read', (_e, bookId, name, fallback) => {
    return readJSON(path.join(bookDir(bookId), libName(name) + '.json'), fallback);
  });

  ipcMain.handle('json:write', (_e, bookId, name, data) => {
    writeJSON(path.join(bookDir(bookId), libName(name) + '.json'), data);
    return true;
  });

  ipcMain.handle('book:delete', async (_e, bookId, title) => {
    const win = BrowserWindow.getFocusedWindow();
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: [t('Cancel'), process.platform === 'win32' ? t('Move to Recycle Bin') : t('Move to Trash')],
      defaultId: 0,
      cancelId: 0,
      message: process.platform === 'win32' ? t('Move “{title}” to the Recycle Bin?', { title }) : t('Move “{title}” to the Trash?', { title }),
      detail: t('The book folder goes to your system trash, so you can recover it.')
    });
    if (response === 1) {
      try {
        await shell.trashItem(bookDir(bookId));
        return true;
      } catch (err) {
        // Some filesystems have no Trash (network mounts, odd drives).
        // Words are never lost: leave the book alone and show the writer where it lives.
        logError('trash', err);
        shell.showItemInFolder(bookDir(bookId));
        dialog.showMessageBox(win, {
          message: t('NEO couldn’t move that folder to the Trash.'),
          detail: t('The book is untouched. Its folder is highlighted so you can deal with it yourself.')
        });
        return false;
      }
    }
    return false;
  });

  // ---------------------------------------------------------------------------
  // Cover art: images live inside the book's folder, so covers travel with
  // the library. Timestamped filenames sidestep every caching gremlin.
  // ---------------------------------------------------------------------------


  return { ensureLibrary, libName, bookDir, writeCatalog, writeFileDurable, parseJSONFile, readJSON, writeJSON, rebuildBookMeta };
};
