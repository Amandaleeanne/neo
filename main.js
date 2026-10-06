// NEO — main process
// Owns the window and all file-system access. The renderer talks to this
// through the IPC handlers below (see preload.js for the exposed API).

const { app, BrowserWindow, ipcMain, dialog, Menu, MenuItem, utilityProcess, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Every disk request from the page passes through here: a write the system
// refuses (see reportBlockedWrite) is explained to the writer, then the error
// goes back to the page as before.
{
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = (channel, fn) => handle(channel, (...args) => {
    // a handler's answer keeps its own timing: sync stays sync
    let out;
    try { out = fn(...args); } catch (err) { reportBlockedWrite(err); throw err; }
    if (out && typeof out.then === 'function') out.catch((err) => reportBlockedWrite(err));
    return out;
  });
}

// macOS Chromium's "smart delete" also removes whitespace around a deleted
// selection, and that pass can duplicate characters. Deletes stay literal.
app.commandLine.appendSwitch('blink-settings', 'smartInsertDeleteEnabled=false');

// ---------------------------------------------------------------------------
// Library location: a folder of plain files the user can inspect, sync, back up.
// ---------------------------------------------------------------------------
// Resolved properly at startup via app.getPath('documents') — this default
// covers any early access and non-redirected setups.
let LIBRARY_DIR = path.join(os.homedir(), 'Documents', 'NEO Library');
let LIBRARY_FILE = path.join(LIBRARY_DIR, 'library.json');

// NEO's few app-level settings (today: a custom library folder) live in the
// system's per-app data folder, since they must exist before the library
// is found. Everything about the writing stays in the library itself.
function settingsPath() { return path.join(app.getPath('userData'), 'settings.json'); }
function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch { return {}; }
}
function writeSettings(obj) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(obj, null, 2));
}

// ---------------------------------------------------------------------------
// Interface language: one JSON file per language in locales/ (see i18n.js).
// The choice is app-level, like the library folder, so it lives in
// settings.json. First launch follows the system language when NEO has it.
// ---------------------------------------------------------------------------
const NeoI18n = require('./i18n.js');
const { t } = NeoI18n;
const LOCALES_DIR = path.join(__dirname, 'locales');
let uiLanguage = 'en';

function readLocaleFile(code) {
  if (!/^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(code)) return null;
  try { return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, code + '.json'), 'utf8')); } catch { return null; }
}

// Every locales/<code>.json is a language on the menu, named in its own words
function listLanguages() {
  const out = [];
  try {
    for (const f of fs.readdirSync(LOCALES_DIR)) {
      const m = f.match(/^([a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*)\.json$/);
      if (!m) continue;
      const data = readLocaleFile(m[1]);
      if (!data) continue;
      out.push({ code: m[1], name: (data._meta && data._meta.name) || m[1] });
    }
  } catch (err) {
    logError('locales', err);
  }
  if (!out.some((l) => l.code === 'en')) out.push({ code: 'en', name: 'English' });
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

// Codes follow BCP 47 (fr-CA); the POSIX spelling (fr_CA) is accepted too.
// A regional file (fr-CA.json) holds only what differs from its language's
// base file (fr.json): fr-CA falls back to fr, then to English.
const normCode = (c) => String(c || '').replace(/_/g, '-');

function resolveLanguage(wanted) {
  wanted = normCode(wanted);
  const codes = listLanguages().map((l) => l.code);
  const tries = [wanted, wanted && wanted.split('-')[0]].filter(Boolean);
  for (const c of tries) {
    const hit = codes.find((x) => x.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }
  return null;
}

// The chosen language's strings: its base language first, then the
// regional file's own wording on top
function localeDict(code) {
  if (code === 'en') return readLocaleFile('en') || {};
  const base = code.split('-')[0];
  const dict = base !== code ? { ...(readLocaleFile(base) || {}) } : {};
  Object.assign(dict, readLocaleFile(code) || {});
  return dict;
}

function loadLanguage(code) {
  uiLanguage = resolveLanguage(code) || 'en';
  const english = readLocaleFile('en') || {};
  const dict = localeDict(uiLanguage);
  NeoI18n.setLocale(uiLanguage, dict, english);
  return { locale: uiLanguage, dict, base: english };
}

function initLanguage() {
  const saved = readSettings().uiLanguage;
  let sys = 'en';
  try { sys = app.getLocale(); } catch { /* early start */ }
  loadLanguage(saved || resolveLanguage(sys) || 'en');
}

// The window asks once, synchronously, before any of its code runs
ipcMain.on('i18n:get', (e) => {
  const english = readLocaleFile('en') || {};
  e.returnValue = { locale: uiLanguage, dict: localeDict(uiLanguage), base: english };
});

// View → Language: save the choice, redraw the menus, and let the window
// save its pages before it reloads in the new language
function setUiLanguage(code) {
  loadLanguage(code);
  const settings = readSettings();
  settings.uiLanguage = uiLanguage;
  writeSettings(settings);
  // no dictionary picked yet: spellcheck moves with the interface
  if (!SPELL_LANGUAGES[chosenSpellLanguage()] && defaultSpellLanguage() !== spellLanguage) {
    spellLanguage = defaultSpellLanguage();
    loadSpellDictionary(spellLanguage);
  }
  try { buildMenu(); } catch (err) { logError('menu', err); }
  sendToWindow({ type: 'uiLanguage', value: uiLanguage });
}

ipcMain.handle('i18n:reload', (e) => {
  e.sender.reload();
  return true;
});

// File → Library Folder…: point NEO at any folder, or back at the default.
// The library is plain files, so the writer moves them; NEO only follows.
async function chooseLibraryFolder() {
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const defaultDir = path.join(app.getPath('documents'), 'NEO Library');
  const custom = LIBRARY_DIR !== defaultDir;
  const ask = await dialog.showMessageBox(win, {
    type: 'question',
    message: t('Library folder'),
    detail: t('Your books live in:\n{dir}\n\nChoose another folder and NEO restarts there. Existing books stay where they are — move the files yourself if you want them along.', { dir: LIBRARY_DIR }),
    buttons: custom ? [t('Choose Folder…'), t('Use Default Folder'), t('Cancel')] : [t('Choose Folder…'), t('Cancel')],
    defaultId: 0,
    cancelId: custom ? 2 : 1
  });
  let next = null;
  if (ask.response === 0) {
    const r = await dialog.showOpenDialog(win, {
      title: t('Choose a folder for your NEO library'),
      defaultPath: LIBRARY_DIR,
      properties: ['openDirectory', 'createDirectory']
    });
    if (r.canceled || !r.filePaths[0]) return;
    next = r.filePaths[0];
  } else if (custom && ask.response === 1) {
    next = null; // back to the default
  } else {
    return;
  }
  if (next === LIBRARY_DIR) return;
  const settings = readSettings();
  if (next) settings.libraryDir = next; else delete settings.libraryDir;
  writeSettings(settings);
  app.relaunch();
  app.exit(0);
}

// Can NEO write in this folder? Windows' Controlled folder access (Defender's
// ransomware protection) refuses new files in Documents to apps it doesn't
// know, and NEO is one. A small file written and removed tells.
function folderWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, '.neo-write-test');
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch (err) {
    logError('library folder not writable: ' + dir, err);
    return false;
  }
}
const isBlockedWrite = (err) => !!err && ['EPERM', 'EACCES', 'EROFS'].includes(err.code);
function blockedDetail(dir) {
  return t('Your books can\'t be saved in:\n{dir}', { dir }) + '\n\n' + (process.platform === 'win32'
    ? t('This is usually Windows Security\'s Controlled folder access (Virus & threat protection → Ransomware protection). Allow NEO there, or keep your library in another folder.')
    : t('Check that the folder exists and that NEO may write to it, or keep your library in another folder.'));
}
// At startup, before any window: a library that can't be written is said
// plainly, once, with a way out — not a hiccup at "Start writing"
function checkLibraryWritable() {
  // (only where it can happen: on Windows, and anywhere before a first
  // library exists; a synced library elsewhere isn't sent a test file
  // every launch)
  if (process.platform !== 'win32' && fs.existsSync(LIBRARY_FILE)) return;
  while (!folderWritable(LIBRARY_DIR)) {
    const r = dialog.showMessageBoxSync({
      type: 'warning',
      message: t('NEO can\'t save in your library folder'),
      detail: blockedDetail(LIBRARY_DIR),
      buttons: [t('Choose Folder…'), t('Try Again'), t('Continue')],
      defaultId: 0,
      cancelId: 2
    });
    if (r === 2) return;
    if (r === 0) {
      const picked = dialog.showOpenDialogSync({
        title: t('Choose a folder for your NEO library'),
        defaultPath: os.homedir(),
        properties: ['openDirectory', 'createDirectory']
      });
      if (!picked || !picked[0]) continue;
      LIBRARY_DIR = picked[0];
      LIBRARY_FILE = path.join(LIBRARY_DIR, 'library.json');
      const settings = readSettings();
      settings.libraryDir = LIBRARY_DIR;
      try { writeSettings(settings); } catch (err) { logError('settings', err); }
    }
  }
}
// Later on (the protection switched on mid-session), a refused save says so
// once. The words stay on the page; NEO saves them as soon as it may.
let blockedShown = false;
function reportBlockedWrite(err) {
  if (blockedShown || !isBlockedWrite(err)) return;
  // the library's own files only (an export to a protected folder is the
  // export's business)
  const rel = err.path ? path.relative(LIBRARY_DIR, err.path) : '..';
  if (rel.startsWith('..') || path.isAbsolute(rel)) return;
  blockedShown = true;
  const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  const opts = {
    type: 'warning',
    message: t('NEO can\'t save in your library folder'),
    detail: blockedDetail(LIBRARY_DIR) + '\n\n' + t('Your words stay on the page until it can.'),
    buttons: [t('OK')]
  };
  (win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)).catch(() => {});
}

const { ensureLibrary, libName, bookDir, writeCatalog, writeFileDurable, parseJSONFile, readJSON, writeJSON, rebuildBookMeta } = require('./src/main/library.js')({
  fs, path, ipcMain, t, logError, getLibraryDir: () => LIBRARY_DIR, getLibraryFile: () => LIBRARY_FILE
});

const COVER_EXTS = ['png', 'jpg', 'jpeg', 'webp'];

ipcMain.handle('library:path', () => LIBRARY_DIR);

ipcMain.handle('cover:pick', async () => {
  const win = BrowserWindow.getFocusedWindow();
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: t('Choose cover art'),
    properties: ['openFile'],
    filters: [{ name: t('Images'), extensions: COVER_EXTS }]
  });
  return canceled || !filePaths.length ? null : filePaths[0];
});

function clearCovers(dir) {
  for (const f of fs.readdirSync(dir)) {
    if (/^cover-\d+\./.test(f)) fs.unlinkSync(path.join(dir, f));
  }
}

ipcMain.handle('cover:set', (_e, bookId, srcPath) => {
  const ext = path.extname(srcPath).toLowerCase().replace('.', '');
  if (!COVER_EXTS.includes(ext)) return null;
  const dir = bookDir(bookId);
  if (!fs.existsSync(dir)) return null;
  clearCovers(dir);
  const fname = 'cover-' + Date.now() + '.' + (ext === 'jpeg' ? 'jpg' : ext);
  fs.copyFileSync(srcPath, path.join(dir, fname));
  return fname;
});

ipcMain.handle('cover:remove', (_e, bookId) => {
  const dir = bookDir(bookId);
  if (fs.existsSync(dir)) clearCovers(dir);
  return true;
});

ipcMain.handle('cover:read', (_e, bookId, fname) => {
  try {
    if (!/^(cover|art)-\d+\.(png|jpg|webp)$/.test(fname)) return null;
    const buf = fs.readFileSync(path.join(bookDir(bookId), fname));
    const ext = path.extname(fname).slice(1);
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    return { base64: buf.toString('base64'), mime, ext };
  } catch {
    return null;
  }
});

// ---------------------------------------------------------------------------
// Painted covers: once a story passes a thousand words, NEO reads it and
// paints an abstract cover (art.js). The API key lives encrypted in the
// app's own data folder — never in the library, which gets synced and
// backed up as plain files.
// ---------------------------------------------------------------------------

const SECRETS_FILE = () => path.join(app.getPath('userData'), 'secrets.json');

function readSecret(name) {
  try {
    const { safeStorage } = require('electron');
    const all = readJSON(SECRETS_FILE(), {});
    if (!all[name]) return null;
    if (all[name].enc && safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(all[name].value, 'base64'));
    }
    return all[name].value;
  } catch (err) {
    logError('secret', err);
    return null;
  }
}

ipcMain.handle('secret:set', (_e, name, value) => {
  const { safeStorage } = require('electron');
  const all = readJSON(SECRETS_FILE(), {});
  if (!value) {
    delete all[name];
  } else if (safeStorage.isEncryptionAvailable()) {
    all[name] = { enc: true, value: safeStorage.encryptString(String(value)).toString('base64') };
  } else {
    all[name] = { enc: false, value: String(value) };
  }
  writeJSON(SECRETS_FILE(), all);
  return true;
});

ipcMain.handle('secret:has', (_e, name) => !!readSecret(name));

// One painting at a time per book; a second request while one is running
// simply gets the running one's answer.
const paintJobs = new Map();

ipcMain.handle('cover:paint', (_e, bookId, text, options) => {
  if (paintJobs.has(bookId)) return paintJobs.get(bookId);
  const job = (async () => {
    const provider = (options && options.provider) || 'openai';
    const apiKey = readSecret(provider);
    if (!apiKey) return { error: t('No API key for {provider} — add one under File → Cover Art…', { provider }) };
    const dir = bookDir(bookId);
    if (!fs.existsSync(dir)) return { error: t('Book folder is missing') };
    try {
      const art = require('./art.js');
      const out = await art.paintCover({
        provider,
        apiKey,
        text: String(text || ''),
        textModel: options && options.textModel,
        imageModel: options && options.imageModel,
        quality: options && options.quality
      });
      // sweep older paintings; the writer's own cover-*.png files are untouched
      for (const f of fs.readdirSync(dir)) {
        if (/^art-\d+\.(png|jpg|webp)$/.test(f)) fs.unlinkSync(path.join(dir, f));
      }
      const fname = 'art-' + Date.now() + '.' + (out.ext || 'jpg');
      fs.writeFileSync(path.join(dir, fname), out.buffer);
      // the brief sits beside the picture, so a future repaint can start from it
      writeJSON(path.join(dir, 'art.json'), {
        file: fname,
        brief: out.brief,
        provider,
        textModel: out.textModel,
        imageModel: out.imageModel,
        painted: new Date().toISOString()
      });
      return { file: fname, brief: out.brief };
    } catch (err) {
      logError('paint', err);
      return { error: String((err && err.message) || err) };
    }
  })();
  paintJobs.set(bookId, job);
  job.finally(() => paintJobs.delete(bookId));
  return job;
});

// ---------------------------------------------------------------------------
// Fullscreen
// ---------------------------------------------------------------------------

// ⌘Enter / Ctrl+Enter toggles fullscreen
ipcMain.handle('fullscreen:toggle', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.setFullScreen(!win.isFullScreen());
  return true;
});

// Regular fullscreen: Esc walks you out like any civilized app
ipcMain.handle('fullscreen:escape', (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win && win.isFullScreen()) {
    win.setFullScreen(false);
    return true;
  }
  return false;
});

// ---------------------------------------------------------------------------
require('./src/main/export.js')({
  app, BrowserWindow, ipcMain, dialog, fs, path, os, process, logError,
  getLibraryDir: () => LIBRARY_DIR
});

require('./src/main/import.js')({ ipcMain, BrowserWindow, dialog, fs, path, t, logError });

// Robustness: error log, daily backups, single instance
// ---------------------------------------------------------------------------
const ERROR_LOG = () => path.join(LIBRARY_DIR, 'neo-errors.log');

function logError(source, err) {
  const line = `[${new Date().toISOString()}] [${source}] ${err && err.stack ? err.stack : String(err)}\n`;
  try {
    ensureLibrary();
    fs.appendFileSync(ERROR_LOG(), line);
  } catch {
    // the library can't be written (the very case worth logging): NEO's own
    // app folder takes the line instead
    try { fs.appendFileSync(path.join(app.getPath('userData'), 'neo-errors.log'), line); } catch { /* never let logging crash the app */ }
  }
}

process.on('uncaughtException', (err) => logError('main', err));
process.on('unhandledRejection', (err) => logError('main-promise', err));
ipcMain.handle('log:error', (_e, msg) => logError('renderer', msg));

const dailyBackup = require('./src/main/backups.js')({
  fs, path, logError, ensureLibrary, getLibraryDir: () => LIBRARY_DIR
});

// ---------------------------------------------------------------------------
// Window
// The window's own color, seen for a moment before the page draws and at the
// edges while it resizes: the room's color, dark or (View → Page → Light) light
function roomColor(theme) { return theme === 'light' ? '#efede8' : '#191919'; }
function libraryPageTheme() {
  try { return JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8')).pageTheme || 'night'; } catch { return 'night'; }
}

// ---------------------------------------------------------------------------
function createWindow() {
  // the window comes back the size and place it was left, when that place
  // is still on a screen (a monitor unplugged since gets the default)
  const saved = readSettings().window || {};
  let bounds = { width: 1200, height: 800 };
  if (saved.width >= 800 && saved.height >= 600) {
    bounds = { width: saved.width, height: saved.height };
    if (typeof saved.x === 'number' && typeof saved.y === 'number') {
      const onScreen = screen.getAllDisplays().some((d) => {
        const a = d.workArea;
        return saved.x + 100 < a.x + a.width && saved.x + saved.width - 100 > a.x &&
          saved.y + 40 < a.y + a.height && saved.y >= a.y - 20;
      });
      if (onScreen) Object.assign(bounds, { x: saved.x, y: saved.y });
    }
  }
  const win = new BrowserWindow({
    ...bounds,
    minWidth: 700,
    minHeight: 600,
    // the Mac's inset traffic lights. Only there: on Linux any title bar
    // style but the default leaves the window frameless, and on Wayland the
    // menu bar lives in that frame (KDE Plasma showed no menu, and Alt
    // found nothing to show)
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    backgroundColor: roomColor(libraryPageTheme()),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // The engine is available, but every editable element starts with
      // spellcheck="false" — NEO never nags. A spellcheck pass is a
      // deliberate act (Edit → Spellcheck Pass), not a klaxon.
      spellcheck: true
    }
  });
  win.loadFile('index.html');
  // The menu bar follows the real full-screen state, whoever changed it.
  // Electron only puts the bar back after a full screen it entered itself,
  // so once a window manager's own full-screen key had been used (Sway, i3),
  // NEO's toggle left the bar hidden for good. Run a tick later, after
  // Electron's own show/hide, so this has the last word.
  const fullScreenChanged = (full) => setImmediate(() => {
    if (win.isDestroyed()) return;
    win.webContents.send('menu', { type: 'fullScreen', value: full }); // the page's bottom bar too
    if (process.platform === 'darwin') return;
    // full screen hides the bar until Alt brings it up (and it tucks away
    // again after a choice), the way Windows apps do; out of full screen
    // it's always there
    win.setAutoHideMenuBar(full);
    win.setMenuBarVisibility(!full);
  });
  win.on('enter-full-screen', () => fullScreenChanged(true));
  win.on('leave-full-screen', () => fullScreenChanged(false));
  win.webContents.on('did-finish-load', () => { if (win.isFullScreen()) fullScreenChanged(true); });
  const remember = () => {
    if (win.isDestroyed() || win.isFullScreen() || win.isMinimized()) return;
    writeSettings({ ...readSettings(), window: win.getNormalBounds() });
  };
  win.on('resize', remember);
  win.on('move', remember);
  win.on('close', remember);

  // Right-click on text: Cut, Copy, Paste, Select All — and nothing else.
  // Handing macOS the frame (where the selection sits) is what invites it to
  // add Writing Tools, and NEO carries no generative-AI tools, ever, so the
  // frame stays out. NEO's own right-click menus (shelves, covers, chapter
  // headings, flagged words) cancel the event first, so this never comes up
  // over them.
  win.webContents.on('context-menu', (_e, params) => {
    if (!params.isEditable && !params.selectionText) return;
    const can = params.editFlags || {};
    const items = [];
    if (params.isEditable) items.push({ role: 'cut', label: t('Cut'), enabled: !!can.canCut });
    items.push({ role: 'copy', label: t('Copy'), enabled: !!can.canCopy });
    if (params.isEditable) items.push({ role: 'paste', label: t('Paste'), enabled: !!can.canPaste });
    items.push({ type: 'separator' }, { role: 'selectAll', label: t('Select All') });
    Menu.buildFromTemplate(items).popup({ window: win });
  });

  // NEO does its own spellchecking (see spell:* handlers) — the engine's
  // checker proved unreliable at scanning existing text, so it stays off
  win.webContents.session.setSpellCheckerEnabled(false);
}

// ---------------------------------------------------------------------------
// Spellcheck: NEO's own bundled Hunspell dictionaries, checked by Hunspell
// itself (WebAssembly, in spell-worker.js), identical
// on every platform. The renderer paints the squiggles and asks for
// suggestions. Edit → Spellcheck Language picks the dictionary; the choice
// lives in library.json so it travels with the writer's books.
// (Languages beyond US English: idea and dictionary set from Zaim Halili.)
// ---------------------------------------------------------------------------
let spellLanguage = 'en-US';
const SPELL_LANGUAGES = {
  'en-US': { label: 'English (US)', pkg: 'dictionary-en-us' },
  'en-GB': { label: 'English (UK)', pkg: 'dictionary-en-gb' },
  'en-CA': { label: 'English (Canada)', pkg: 'dictionary-en-ca' },
  'en-AU': { label: 'English (Australia)', pkg: 'dictionary-en-au' },
  'fr': { label: 'Français', pkg: 'dictionary-fr' },
  'es': { label: 'Español', pkg: 'dictionary-es' },
  'de': { label: 'Deutsch', pkg: 'dictionary-de' },
  'nl': { label: 'Nederlands', pkg: 'dictionary-nl' },
  'pl': { label: 'Polski', pkg: 'dictionary-pl' },
  'pt-BR': { label: 'Português (Brasil)', pkg: 'dictionary-pt' },
  'ro': { label: 'Română', pkg: 'dictionary-ro' },
  'ru': { label: 'Русский', pkg: 'dictionary-ru' },
  'el': { label: 'Ελληνικά', pkg: 'dictionary-el' }
};

// The dictionary work runs in a helper process (spell-worker.js), so the
// writing room never waits for a dictionary to load.
let spellChild = null;
let spellSeq = 0;
const spellWaiting = new Map();

function spellRequest(msg) {
  return new Promise((resolve) => {
    if (!spellChild) { resolve({ ok: false, error: 'no spell process' }); return; }
    const id = ++spellSeq;
    spellWaiting.set(id, resolve);
    spellChild.postMessage({ ...msg, id });
  });
}

function startSpellProcess() {
  if (spellChild) return;
  try {
    spellChild = utilityProcess.fork(path.join(__dirname, 'spell-worker.js'), [], { serviceName: 'NEO spellcheck' });
    spellChild.on('message', (m) => {
      const done = spellWaiting.get(m.id);
      if (done) { spellWaiting.delete(m.id); done(m); }
    });
    spellChild.on('exit', () => {
      spellChild = null;
      for (const done of spellWaiting.values()) done({ ok: false, error: 'spell process exited' });
      spellWaiting.clear();
    });
  } catch (err) {
    logError('spell', err);
    spellChild = null;
  }
}

// The dictionary packages differ in how they export (callback, ES module),
// so the helper reads their .aff/.dic files directly — the one shape they
// all share. (Not require.resolve: the newer packages seal package.json.)
async function loadSpellDictionary(code) {
  const known = SPELL_LANGUAGES[code] ? code : 'en-US';
  const entry = SPELL_LANGUAGES[known];
  startSpellProcess();
  let custom = [];
  try { custom = readJSON(LIBRARY_FILE, {}).customWords || []; } catch { /* a nicety */ }
  const res = await spellRequest({ type: 'load', language: known, dir: path.join(__dirname, 'node_modules', entry.pkg), custom });
  if (!res.ok) { logError('spell', new Error(res.error || 'dictionary failed to load')); return false; }
  spellLanguage = known;
  return true;
}

// One rule for every language: a dictionary picked in Edit → Spellcheck
// Language wins. Until there is one, spellcheck follows the interface
// language when NEO has its dictionary (fr-CA → fr), else US English.
// Nothing is saved on the writer's behalf, so switching the interface back
// takes the dictionary (and the typed quotes) along with it.
function chosenSpellLanguage() {
  const saved = readJSON(LIBRARY_FILE, null);
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved.spellLanguage : undefined;
}

function defaultSpellLanguage() {
  const ui = String(uiLanguage || 'en');
  if (SPELL_LANGUAGES[ui]) return ui;
  // NEO's Portuguese interface is Brazilian; the dictionary is too. The
  // European interface (pt-PT) leaves the choice to the writer.
  if (ui === 'pt' || ui === 'pt-BR') return 'pt-BR';
  const base = ui.split('-')[0];
  return SPELL_LANGUAGES[base] ? base : 'en-US';
}

function initSpell() {
  const chosen = chosenSpellLanguage();
  spellLanguage = SPELL_LANGUAGES[chosen] ? chosen : defaultSpellLanguage();
  loadSpellDictionary(spellLanguage);
}

ipcMain.handle('spell:setLanguage', async (_e, code) => {
  if (!SPELL_LANGUAGES[code]) return false;
  const ok = await loadSpellDictionary(code);
  if (ok) { try { buildMenu(); } catch (err) { logError('menu', err); } }
  return ok;
});

ipcMain.handle('spell:check', async (_e, words) => {
  const res = await spellRequest({ type: 'check', words });
  if (res.ok) return res.result;
  const out = {};
  for (const w of words) out[w] = true; // no checker: nothing is wrong
  return out;
});

ipcMain.handle('spell:suggest', async (_e, word) => {
  const res = await spellRequest({ type: 'suggest', word });
  return res.ok ? res.result : [];
});

ipcMain.handle('spell:learn', async (_e, word) => {
  if (typeof word === 'string') await spellRequest({ type: 'add', word });
  return true;
});

// ---------------------------------------------------------------------------
// Application menu — Help and Format live here, out of the writing room
// ---------------------------------------------------------------------------
function sendToWindow(msg) {
  const w = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (w) w.webContents.send('menu', msg);
}

// No generative-AI tools in NEO — not now, not later.
//
// macOS inserts "Writing Tools" (Apple Intelligence) and "AutoFill" into
// any app's Edit menu while the menu is opening, and Electron has no
// switch for either. Deleting them doesn't last (macOS puts them back);
// hiding them does. NEO reaches the real menu through the Objective-C
// runtime (koffi, a small FFI library) and listens for the notice AppKit
// sends whenever an item is added to or changed in a menu. The moment
// anything lands in the Edit menu, NEO walks the menu alongside the one it
// built and hides every item that isn't its own, in any language. Should
// anything here fail, the menu is left as macOS made it: this never stops
// NEO from working.
let objc = null;
function objcRuntime() {
  if (objc) return objc;
  const koffi = require('koffi');
  const lib = koffi.load('/usr/lib/libobjc.A.dylib');
  const NoteIMP = koffi.proto('void NoteIMP(void *self, void *cmd, void *note)');
  objc = {
    koffi,
    NoteIMP,
    cls: lib.func('void *objc_getClass(const char *name)'),
    sel: lib.func('void *sel_registerName(const char *name)'),
    allocClass: lib.func('void *objc_allocateClassPair(void *superclass, const char *name, size_t extra)'),
    registerClass: lib.func('void objc_registerClassPair(void *cls)'),
    addMethod: lib.func('bool class_addMethod(void *cls, void *name, NoteIMP *imp, const char *types)'),
    // objc_msgSend, typed once per shape it is called with
    obj: lib.func('objc_msgSend', 'void *', ['void *', 'void *']),
    objAt: lib.func('objc_msgSend', 'void *', ['void *', 'void *', 'long']),
    objStr: lib.func('objc_msgSend', 'void *', ['void *', 'void *', 'const char *']),
    count: lib.func('objc_msgSend', 'long', ['void *', 'void *']),
    flag: lib.func('objc_msgSend', 'bool', ['void *', 'void *']),
    str: lib.func('objc_msgSend', 'const char *', ['void *', 'void *']),
    setFlag: lib.func('objc_msgSend', 'void', ['void *', 'void *', 'bool']),
    selName: lib.func('const char *sel_getName(void *sel)'),
    actionOf: lib.func('objc_msgSend', 'void *', ['void *', 'void *']),
    observe: lib.func('objc_msgSend', 'void', ['void *', 'void *', 'void *', 'void *', 'void *', 'void *'])
  };
  return objc;
}
const editMenuState = { index: -1, ours: [], edit: null, watching: false, hiding: false };
// macOS drops the & that Electron reads as a keyboard mnemonic ("Find & Replace"
// arrives as "Find  Replace"), so titles are compared without it
const menuTitle = (s) => String(s || '').replace(/&/g, '').replace(/\s+/g, ' ').trim();
// the actions Electron gives the items it builds: never macOS's own
const ELECTRON_ACTIONS = new Set(['itemSelected:', 'undo:', 'redo:', 'cut:', 'copy:', 'paste:', 'pasteAndMatchStyle:', 'selectAll:']);
const addr = (p) => (p ? objc.koffi.address(p) : 0n);
// the Edit menu as AppKit holds it right now
function nativeEditMenu() {
  const o = objcRuntime();
  const S = (name) => o.sel(name);
  const app = o.obj(o.cls('NSApplication'), S('sharedApplication'));
  const bar = app && o.obj(app, S('mainMenu'));
  const i = editMenuState.index;
  if (!bar || i < 0 || i >= o.count(bar, S('numberOfItems'))) return null;
  const item = o.objAt(bar, S('itemAtIndex:'), i);
  return item ? o.obj(item, S('submenu')) : null;
}
// hide what isn't NEO's; returns the menu as seen, for the log
function hideForeignItems(edit) {
  const o = objc;
  const S = (name) => o.sel(name);
  const ours = editMenuState.ours;
  const n = o.count(edit, S('numberOfItems'));
  const seen = [];
  let j = 0; // the next of NEO's own items to find, in order
  for (let i = 0; i < n; i++) {
    const item = o.objAt(edit, S('itemAtIndex:'), i);
    if (!item) continue;
    const sep = o.flag(item, S('isSeparatorItem'));
    const titleObj = sep ? null : o.obj(item, S('title'));
    const title = titleObj ? o.str(titleObj, S('UTF8String')) : '';
    const mine = j < ours.length && (sep ? ours[j] === null : ours[j] === menuTitle(title));
    if (mine) j++;
    else {
      // a safety net: whatever happens to titles, an item Electron made
      // for NEO is never the one hidden
      const act = sep ? null : o.actionOf(item, S('action'));
      const electrons = act && ELECTRON_ACTIONS.has(o.selName(act));
      if (!electrons && !o.flag(item, S('isHidden'))) o.setFlag(item, S('setHidden:'), true);
    }
    seen.push((mine ? '' : '[not NEO\'s] ') + (sep ? '—' : title));
  }
  return seen;
}
function hideSystemEditItems() {
  if (process.platform !== 'darwin' || editMenuState.hiding) return;
  editMenuState.hiding = true;
  try {
    const edit = editMenuState.edit || (editMenuState.edit = nativeEditMenu());
    if (edit) hideForeignItems(edit);
  } catch (err) {
    logError('edit menu', err);
  } finally {
    editMenuState.hiding = false;
  }
}
// a tiny Objective-C class whose one method AppKit calls whenever a menu
// gains or changes an item; it hides foreign items in the Edit menu
function watchEditMenu() {
  if (process.platform !== 'darwin' || editMenuState.watching) return;
  editMenuState.watching = true;
  try {
    const o = objcRuntime();
    const S = (name) => o.sel(name);
    // AppKit calls this for every menu in the app as items come and go
    // (mostly while a menu opens): one lookup, and a pass over the Edit
    // menu only when it's the Edit menu that changed
    const imp = o.koffi.register((_self, _cmd, note) => {
      try {
        if (editMenuState.hiding || !note) return;
        const menu = o.obj(note, S('object'));
        const edit = editMenuState.edit || (editMenuState.edit = nativeEditMenu());
        if (menu && edit && addr(menu) === addr(edit)) hideSystemEditItems();
      } catch (err) {
        logError('edit menu', err);
      }
    }, o.koffi.pointer(o.NoteIMP));
    let cls = o.allocClass(o.cls('NSObject'), 'NEOEditMenuWatcher', 0);
    if (cls) {
      o.addMethod(cls, S('neoMenuChanged:'), imp, 'v@:@');
      o.registerClass(cls);
    } else cls = o.cls('NEOEditMenuWatcher');
    const watcher = o.obj(o.obj(cls, S('alloc')), S('init'));
    const center = o.obj(o.cls('NSNotificationCenter'), S('defaultCenter'));
    for (const name of ['NSMenuDidAddItemNotification', 'NSMenuDidChangeItemNotification']) {
      const nsName = o.objStr(o.cls('NSString'), S('stringWithUTF8String:'), name);
      o.observe(center, S('addObserver:selector:name:object:'), watcher, S('neoMenuChanged:'), nsName, null);
    }
  } catch (err) {
    logError('edit menu', err);
  }
}

const buildMenu = require('./src/main/menu.js')({
  BrowserWindow, ipcMain, Menu, process, t, sendToWindow, readJSON,
  getLibraryFile: () => LIBRARY_FILE, chooseLibraryFolder, logError, roomColor,
  spellLanguages: SPELL_LANGUAGES, getSpellLanguage: () => spellLanguage,
  getUiLanguage: () => uiLanguage, listLanguages, setUiLanguage, editMenuState,
  menuTitle, watchEditMenu, hideSystemEditItems
});

const checkForUpdates = require('./src/main/updates.js')({ app, ipcMain, sendToWindow, logError });

// Two copies of NEO editing the same library is how words get eaten
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

app.whenReady().then(() => {
  // Packaged builds get name/icon from electron-builder; this covers `npm start`.
  try {
    const devIcon = path.join(__dirname, 'build', 'icon.png');
    if (process.platform === 'darwin' && fs.existsSync(devIcon)) {
      if (app.dock) app.dock.setIcon(devIcon);
      app.setAboutPanelOptions({
        applicationName: 'NEO',
        applicationVersion: app.getVersion(),
        iconPath: devIcon
      });
    }
  } catch { /* cosmetic only */ }
  // Startup discipline: the window is created first, and every other step is
  // individually guarded so no single failure can leave the app running
  // invisibly with no window.
  try {
    // the real Documents folder (handles OneDrive-redirected Windows setups)
    try {
      LIBRARY_DIR = path.join(app.getPath('documents'), 'NEO Library');
      // …unless the writer chose their own folder (File → Library Folder…)
      const chosen = readSettings().libraryDir;
      if (chosen && fs.existsSync(chosen) && fs.statSync(chosen).isDirectory()) LIBRARY_DIR = chosen;
      LIBRARY_FILE = path.join(LIBRARY_DIR, 'library.json');
    } catch (err) {
      logError('paths', err);
    }

    // macOS press-and-hold accent picker can open invisibly inside Chromium
    // and re-emit swallowed keys as phantom repeated letters. Within NEO,
    // held keys simply repeat — which is what writers expect anyway.
    if (process.platform === 'darwin') {
      try {
        const { systemPreferences } = require('electron');
        systemPreferences.setUserDefault('ApplePressAndHoldEnabled', 'boolean', false);
        // macOS injects its own items into any menu named "Edit" —
        // these two official switches remove the ones writers can't use here
        systemPreferences.setUserDefault('NSDisabledDictationMenuItem', 'boolean', true);
        systemPreferences.setUserDefault('NSDisabledCharacterPaletteMenuItem', 'boolean', true);
        // AutoFill (contacts, passwords) has no business on a manuscript page
        systemPreferences.setUserDefault('NSAutoFillHeuristicControllerEnabled', 'boolean', false);
        // …and "Enter Full Screen" into the View menu, next to NEO's own
        // Full Screen item (⇧⌘F): one is enough
        systemPreferences.setUserDefault('NSFullScreenMenuItemEverywhere', 'boolean', false);
      } catch (err) {
        logError('prefs', err);
      }
    }

    try { initLanguage(); } catch (err) { logError('language', err); }
    try { checkLibraryWritable(); } catch (err) { logError('library check', err); }
    try { ensureLibrary(); } catch (err) { logError('library', err); }
    createWindow();
    try { initSpell(); } catch (err) { logError('spell', err); }
    try { buildMenu(); } catch (err) { logError('menu', err); }
    try { dailyBackup(); } catch (err) { logError('backup', err); }
    try { checkForUpdates(); } catch (err) { logError('updater', err); }
  } catch (err) {
    // catastrophic: tell the human instead of dying in silence
    logError('startup', err);
    try {
      dialog.showErrorBox(t('NEO failed to start'),
        t('Please report this at github.com/hughhowey/neo/issues:') + '\n\n' + String((err && err.stack) || err));
    } catch { /* nothing left to try */ }
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
