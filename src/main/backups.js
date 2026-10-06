'use strict';

module.exports = function createDailyBackup({ fs, path, logError, ensureLibrary, getLibraryDir }) {
  // One zip of the whole library per day, keeping the last 14. Cheap insurance.
  async function dailyBackup() {
    const LIBRARY_DIR = getLibraryDir();
    try {
      ensureLibrary();
      const backupsDir = path.join(LIBRARY_DIR, 'Backups');
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      const today = new Date().toISOString().slice(0, 10);
      const target = path.join(backupsDir, `neo-backup-${today}.zip`);
      if (fs.existsSync(target)) return;

      const JSZip = require('jszip');
      const zip = new JSZip();
      const skip = new Set(['Backups', 'Exports']);
      // One file the system won't hand over (in iCloud but not downloaded yet,
      // held by a sync tool) used to throw, and cost the whole day's backup,
      // every day. Now it's left out, named in the zip and in the error log.
      const missed = [];
      const walk = (dir, rel) => {
        let names = [];
        try { names = fs.readdirSync(dir); } catch (err) { missed.push(`${rel || '.'} (${err.code || err.message})`); return; }
        for (const name of names) {
          if (rel === '' && skip.has(name)) continue;
          if (name === '.DS_Store' || /^\..+\.icloud$/.test(name)) continue; // Finder litter; iCloud's stand-in for a file not downloaded
          const full = path.join(dir, name);
          const relPath = rel ? rel + '/' + name : name;
          try {
            const stat = fs.statSync(full);
            if (stat.isDirectory()) walk(full, relPath);
            else zip.file(relPath, fs.readFileSync(full));
          } catch (err) {
            missed.push(`${relPath} (${err.code || err.message})`);
          }
        }
      };
      walk(LIBRARY_DIR, '');
      if (missed.length) {
        zip.file('_left-out-of-this-backup.txt', missed.join('\n') + '\n');
        logError('backup', new Error('left out of today\'s backup: ' + missed.join(', ')));
      }
      fs.writeFileSync(target, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }));

      // prune old backups
      const backups = fs.readdirSync(backupsDir).filter((f) => f.startsWith('neo-backup-')).sort();
      while (backups.length > 14) fs.unlinkSync(path.join(backupsDir, backups.shift()));
    } catch (err) {
      logError('backup', err);
    }
  }


  return dailyBackup;
};
