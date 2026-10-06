'use strict';

module.exports = function registerUpdateHandlers({ app, ipcMain, sendToWindow, logError }) {
  // Manual update check (Help → Check for Update…): a direct GitHub Releases
  // lookup, separate from the silent auto-updater. Works in dev builds too.
  let lastReleaseUrl = null;

  function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0, nb = pb[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  // toggling at the session level forces the engine to re-scan visible text —
  // newer Chromium ignores attribute changes on text it has already looked at
  ipcMain.handle('app:version', () => app.getVersion());

  // Updating
  //
  // Packaged builds keep themselves current without being asked: a few seconds
  // after launch (and every few hours after that) NEO looks at the latest
  // GitHub release, and if it's newer, electron-updater starts downloading it
  // straight away, quietly. The new version goes in the next time NEO quits
  // and opens again. Help → Check for Update… shows where that stands — most
  // often it's already downloaded, and the window offers "Restart to update"
  // (the page saves itself first). A build that can't self-update — `npm
  // start`, the Windows portable .exe, anything unsigned — falls back to the
  // release page on GitHub, as before.
  let updater = null;          // electron-updater's autoUpdater, wired once
  let updaterReady = false;    // an update is downloaded and waiting
  // where the background download stands, so the window can pick it up mid-way
  const upd = { state: 'idle', version: '', percent: 0, transferred: 0, total: 0, message: '' };
  function getUpdater() {
    if (updater || !app.isPackaged) return updater;
    const { autoUpdater } = require('electron-updater');
    autoUpdater.logger = null;
    autoUpdater.autoDownload = true;       // found it? fetch it — nobody should have to ask
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.on('update-available', (info) => {
      Object.assign(upd, { state: 'downloading', version: info && info.version || '', percent: 0, transferred: 0, total: 0, message: '' });
      sendToWindow({ type: 'update', ...upd });
    });
    autoUpdater.on('download-progress', (p) => {
      Object.assign(upd, { state: 'downloading', percent: p.percent, transferred: p.transferred, total: p.total });
      sendToWindow({ type: 'update', ...upd });
    });
    autoUpdater.on('update-downloaded', (info) => {
      updaterReady = true;
      Object.assign(upd, { state: 'ready', percent: 100 });
      if (info && info.version) upd.version = info.version;
      sendToWindow({ type: 'update', ...upd });
    });
    autoUpdater.on('error', (err) => {
      logError('updater', err);
      if (updaterReady) return; // a failed later look doesn't undo a finished download
      Object.assign(upd, { state: 'error', message: String(err && err.message || err) });
      sendToWindow({ type: 'update', ...upd });
    });
    updater = autoUpdater;
    return updater;
  }

  // one look at GitHub; if something newer is there, the download starts on
  // its own (autoDownload). Never twice at once, and not again once it's here.
  let updateLook = null;
  function lookForUpdate() {
    const u = getUpdater();
    if (!u) return Promise.resolve(null);
    if (updaterReady || upd.state === 'downloading') return Promise.resolve(null);
    if (!updateLook) {
      updateLook = u.checkForUpdates()
        .catch((err) => { logError('updater', err); throw err; })
        .finally(() => { updateLook = null; });
    }
    return updateLook;
  }

  // what's on GitHub, for the fallback path and the release link
  async function latestReleaseFromGitHub() {
    const res = await fetch('https://api.github.com/repos/hughhowey/neo/releases/latest', {
      headers: { 'User-Agent': 'NEO-App' }
    });
    if (!res.ok) throw new Error('GitHub API returned ' + res.status);
    const data = await res.json();
    lastReleaseUrl = data.html_url || null;
    return String(data.tag_name || '').replace(/^v/, '');
  }

  ipcMain.handle('update:check', async () => {
    const currentVersion = app.getVersion();
    try {
      const u = getUpdater();
      if (u) {
        // already on its way (or already here): just say where it is
        if (!updaterReady && upd.state !== 'downloading') {
          if (upd.state === 'error') upd.state = 'idle'; // asking again is a retry
          const result = await lookForUpdate();
          const v = result && result.updateInfo && result.updateInfo.version || '';
          if (v && compareVersions(v, currentVersion) > 0 && upd.state === 'idle') {
            Object.assign(upd, { state: 'downloading', version: v });
          }
        }
        latestReleaseFromGitHub().catch(() => {}); // the release link, for the fallback button
        const latestVersion = upd.version;
        const hasUpdate = !!latestVersion && compareVersions(latestVersion, currentVersion) > 0;
        return { ...upd, hasUpdate, latestVersion, currentVersion, canInstall: true, ready: updaterReady };
      }
    } catch (err) {
      logError('update', err); // fall through to the plain check
    }
    try {
      const latestVersion = await latestReleaseFromGitHub();
      return {
        hasUpdate: !!latestVersion && compareVersions(latestVersion, currentVersion) > 0,
        latestVersion,
        currentVersion,
        canInstall: false
      };
    } catch (err) {
      logError('update', err);
      return { error: true };
    }
  });

  ipcMain.handle('update:install', () => {
    const u = getUpdater();
    if (!u || !updaterReady) return false;
    setImmediate(() => u.quitAndInstall(false, true));
    return true;
  });

  // the renderer may only open the release page fetched above — never arbitrary URLs
  ipcMain.handle('update:openRelease', () => {
    if (lastReleaseUrl && /^https:\/\/github\.com\//.test(lastReleaseUrl)) {
      require('electron').shell.openExternal(lastReleaseUrl);
    }
    return true;
  });


  // The background look: a few seconds after launch, every hour after that
  // for a writer who leaves NEO open for days, and whenever the computer
  // wakes (a laptop lid is how most NEO sessions end and begin). Nothing pops
  // up; any failure is logged and swallowed, so an offline machine or an
  // unsigned build never notices.
  const UPDATE_EVERY = 60 * 60 * 1000;
  function checkForUpdates() {
    if (!app.isPackaged) return;
    const look = () => { lookForUpdate().catch(() => { /* logged in lookForUpdate */ }); };
    setTimeout(look, 8000);
    const timer = setInterval(look, UPDATE_EVERY);
    if (timer.unref) timer.unref();
    try {
      // after a wake the network needs a moment
      require('electron').powerMonitor.on('resume', () => setTimeout(look, 15000));
    } catch (err) { logError('updater', err); }
  }

  return checkForUpdates;
};
