'use strict';

module.exports = function registerExportHandlers({
  app, BrowserWindow, ipcMain, dialog, fs, path, os, process, logError, getLibraryDir
}) {
  // Export + email
  // ---------------------------------------------------------------------------

  const SCREENPLAY_PRINT = {
    pageSize: 'Letter',
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    printBackground: false,
    preferCSSPageSize: true,
    generateTaggedPDF: true,
    generateDocumentOutline: false
  };

  async function renderPDF(html, print) {
    // The book reaches the PDF printer as a file, not as a data: URL. A URL
    // stops at 2 MB, and a long novel is bigger than that once it's encoded; a
    // book in Russian or Chinese gets there far sooner, because every letter
    // becomes six to nine characters. Past that the export (and ⌘E) saved
    // nothing at all.
    const tmp = path.join(app.getPath('temp'), `neo-print-${process.pid}-${Date.now()}.html`);
    fs.writeFileSync(tmp, html, 'utf8');
    const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    // Letter is a North American habit; most of the world prints A4.
    const letterCountries = ['US', 'CA', 'MX', 'PH'];
    const options = print === 'screenplay' ? SCREENPLAY_PRINT : {
      pageSize: letterCountries.includes(app.getLocaleCountryCode()) ? 'Letter' : 'A4',
      margins: { top: 1, bottom: 1, left: 1, right: 1 },
      printBackground: false,
      // chapter headings become the PDF's bookmarks, for jumping around in
      // Preview or Acrobat, and the text is tagged for screen readers
      generateTaggedPDF: true,
      generateDocumentOutline: true
    };
    try {
      await pdfWin.loadFile(tmp);
      let pdf = await pdfWin.webContents.printToPDF(options);
      // A book's contents page can't know its page numbers until the book has
      // been printed once: read where each entry landed from that printing,
      // write the numbers in, and print again. Each number has a fixed width
      // on the page, so nothing moves between the two printings.
      if (html.includes('class="toc-pg"')) {
        const pages = pdfAnchorPages(pdf);
        if (Object.keys(pages).length) {
          await pdfWin.webContents.executeJavaScript(`(() => {
            const pages = ${JSON.stringify(pages)};
            for (const el of document.querySelectorAll('.toc-pg')) el.textContent = pages[el.dataset.for] || '';
          })()`);
          pdf = await pdfWin.webContents.printToPDF(options);
        }
      }
      return pdf;
    } finally {
      pdfWin.destroy();
      try { fs.unlinkSync(tmp); } catch { /* already gone */ }
    }
  }

  // The page each link target starts on (1 for the first page), read from a
  // PDF Chromium just printed. Skia writes the file's objects as plain text
  // (only page contents are compressed) and lists every linked-to anchor in
  // the catalog's /Dests, so the cross-reference table leads straight to them.
  // Anything laid out otherwise gives {}, and the contents go without numbers.
  function pdfAnchorPages(buf) {
    try {
      const s = buf.toString('latin1');
      const sx = s.lastIndexOf('startxref');
      const xref = parseInt(s.slice(sx + 9, sx + 40).trim(), 10);
      const head = /^xref\s+(\d+)\s+(\d+)\s*?[\r\n]+/.exec(s.slice(xref, xref + 64));
      const root = /\/Root (\d+) 0 R/.exec(s.slice(Math.max(0, sx - 4000), sx));
      if (!head || !root) return {};
      const first = +head[1];
      const count = +head[2];
      const table = xref + head[0].length;
      const obj = (n) => {
        if (n - first < 0 || n - first >= count) return '';
        const at = parseInt(s.substr(table + (n - first) * 20, 10), 10);
        return s.slice(at, s.indexOf('endobj', at));
      };
      const catalog = obj(+root[1]);
      const pagesRef = /\/Pages (\d+) 0 R/.exec(catalog);
      const destsRef = /\/Dests (\d+) 0 R/.exec(catalog);
      if (!pagesRef || !destsRef) return {};
      const order = [];
      const walk = (n, depth) => {
        const o = obj(n);
        const kids = /\/Kids\s*\[([^\]]*)\]/.exec(o);
        if (/\/Type\s*\/Pages\b/.test(o) && kids && depth < 32) {
          for (const k of kids[1].matchAll(/(\d+) 0 R/g)) walk(+k[1], depth + 1);
        } else order.push(n);
      };
      walk(+pagesRef[1], 0);
      const index = new Map(order.map((n, i) => [n, i + 1]));
      const out = {};
      for (const m of obj(+destsRef[1]).matchAll(/\/([A-Za-z0-9_.-]+)\s*\[\s*(\d+) 0 R/g)) {
        if (index.has(+m[2])) out[m[1]] = index.get(+m[2]);
      }
      return out;
    } catch {
      return {};
    }
  }

  // zipEntries: [{path, content, base64?, store?}] — order matters (EPUB mimetype first)
  async function buildZip(zipEntries) {
    const JSZip = require('jszip');
    const zip = new JSZip();
    for (const e of zipEntries) {
      zip.file(e.path, e.base64 ? Buffer.from(e.content, 'base64') : e.content, {
        compression: e.store ? 'STORE' : 'DEFLATE'
      });
    }
    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      mimeType: 'application/epub+zip'
    });
  }

  ipcMain.handle('export:save', async (_e, { format, defaultName, content, zipEntries, base64, print }) => {
    const win = BrowserWindow.getFocusedWindow();
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: path.join(os.homedir(), 'Documents', defaultName + '.' + format),
      filters: [{ name: format.toUpperCase(), extensions: [format] }]
    });
    if (canceled || !filePath) return null;
    try {
      if (zipEntries) {
        fs.writeFileSync(filePath, await buildZip(zipEntries));
      } else if (base64) {
        // pictures (a saved cover) arrive as base64
        fs.writeFileSync(filePath, Buffer.from(content, 'base64'));
      } else if (format === 'pdf') {
        fs.writeFileSync(filePath, await renderPDF(content, print));
      } else {
        fs.writeFileSync(filePath, content, 'utf8');
      }
    } catch (err) {
      // Main-process export failures used to vanish: the renderer saw a bare
      // rejection and nothing reached neo-errors.log. Log it here, and hand the
      // renderer a sentence it can show the writer.
      logError('export save', err);
      throw new Error('Could not write the file (' + ((err && err.message) || err) + ')');
    }
    return filePath;
  });

  // Writes a timestamped snapshot to the library's Exports folder, then hands it
  // to your email — an outside-the-machine paper trail for provenance.
  ipcMain.handle('email:draft', async (_e, { to, subject, body, html, defaultName, method, print }) => {
    const { shell } = require('electron');
    const exportsDir = path.join(LIBRARY_DIR, 'Exports');
    if (!fs.existsSync(exportsDir)) fs.mkdirSync(exportsDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const file = path.join(exportsDir, `${defaultName}-${stamp}.pdf`);
    fs.writeFileSync(file, await renderPDF(html, print));

    if (method === 'gmail') {
      // Gmail compose in the browser can't take an attachment from outside,
      // so open the draft pre-filled and reveal the PDF right next to it to drag in.
      const url = 'https://mail.google.com/mail/?view=cm&fs=1'
        + '&to=' + encodeURIComponent(to)
        + '&su=' + encodeURIComponent(subject)
        + '&body=' + encodeURIComponent(body);
      await shell.openExternal(url);
      shell.showItemInFolder(file);
      return { ok: true, method: 'gmail', file };
    }

    const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const script = `
      tell application "Mail"
        set msg to make new outgoing message with properties {subject:"${esc(subject)}", content:"${esc(body)}" & return & return, visible:true}
        tell msg to make new to recipient at end of to recipients with properties {address:"${esc(to)}"}
        tell msg to make new attachment with properties {file name:(POSIX file "${esc(file)}")} at after the last paragraph of content
        activate
      end tell`;
  return new Promise((resolve) => {
    require('child_process').execFile('osascript', ['-e', script], (err) => {
      if (err) {
        // Mail not available — at least reveal the snapshot we saved
        shell.showItemInFolder(file);
        resolve({ ok: false, file });
      } else {
        resolve({ ok: true, method: 'mail', file });
      }
    });
  });
});

// ---------------------------------------------------------------------------

};
