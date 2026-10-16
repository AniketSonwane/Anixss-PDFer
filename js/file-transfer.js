/**
 * Anixss-PDFer - Client-side Cross-Page File Transfer (file-transfer.js)
 * Enables passing selected files between pages and tools via browser IndexedDB
 * with smooth loading animations and zero-delay dropzone management.
 */

(function () {
  'use strict';

  const DB_NAME = 'anixss_transfer_db';
  const STORE_NAME = 'pending_files';

  let loadingEl = null;

  function injectLoadingStyles() {
    if (document.getElementById('transferLoadingStyles')) return;
    const style = document.createElement('style');
    style.id = 'transferLoadingStyles';
    style.textContent = `
      @keyframes transferBarSlide {
        0% { transform: translateX(-100%); }
        50% { transform: translateX(25%); }
        100% { transform: translateX(250%); }
      }
      .transfer-animated-bar {
        width: 45%;
        height: 100%;
        background-color: #000000;
        animation: transferBarSlide 1.4s ease-in-out infinite;
        will-change: transform;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureLoadingElement() {
    injectLoadingStyles();
    if (loadingEl && document.body && document.body.contains(loadingEl)) return loadingEl;
    loadingEl = document.createElement('div');
    loadingEl.id = 'anixssTransferOverlay';
    loadingEl.className = 'fixed inset-0 z-[9999] bg-white/90 backdrop-blur-sm flex items-center justify-center p-4 transition-opacity duration-200 opacity-0 pointer-events-none select-none';
    loadingEl.innerHTML = `
      <div class="border-2 border-black bg-white p-5 sm:p-6 max-w-md w-full shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] space-y-4 font-mono">
        <div class="flex items-center justify-between border-b border-black pb-2.5">
          <span class="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 bg-black animate-pulse"></span>
            <span id="transferOverlayBadge">PREPARING WORKSPACE</span>
          </span>
          <span class="text-[10px] bg-black text-white px-1.5 py-0.5 font-bold tracking-wider">CLIENT-SIDE</span>
        </div>
        
        <div class="space-y-1 py-1">
          <div id="transferOverlayTitle" class="font-bold text-sm text-black truncate">Loading document...</div>
          <div id="transferOverlayMeta" class="text-xs text-neutral-600 truncate">Please wait...</div>
        </div>

        <!-- Smooth indeterminate terminal progress bar -->
        <div class="w-full bg-neutral-100 border border-black h-3 relative overflow-hidden">
          <div class="transfer-animated-bar"></div>
        </div>

        <div class="text-[11px] text-neutral-500 flex items-center justify-between pt-1 border-t border-neutral-200">
          <span>100% Private In Browser</span>
          <span>Zero Server Uploads</span>
        </div>
      </div>
    `;
    if (document.body) {
      document.body.appendChild(loadingEl);
    }
    return loadingEl;
  }

  function showLoading(title = 'Loading document...', meta = 'Please wait...') {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', () => showLoading(title, meta), { once: true });
      return;
    }
    const el = ensureLoadingElement();
    const titleEl = document.getElementById('transferOverlayTitle');
    const metaEl = document.getElementById('transferOverlayMeta');
    if (titleEl) titleEl.textContent = title;
    if (metaEl) metaEl.textContent = meta;

    requestAnimationFrame(() => {
      el.classList.remove('opacity-0', 'pointer-events-none');
      el.classList.add('opacity-100', 'pointer-events-auto');
    });
  }

  function hideLoading() {
    if (!loadingEl) return;
    loadingEl.classList.remove('opacity-100', 'pointer-events-auto');
    loadingEl.classList.add('opacity-0', 'pointer-events-none');
  }

  function hideAllDropzones() {
    const ids = [
      'addPrimaryDropzone', 'addDropzone',
      'nupDropzone', 'nUpDropzone',
      'img2pdfDropzone', 'img2pdfEmptyState',
      'splitDropzone',
      'rotateDropzone',
      'removeDropzone',
      'resizeDropzone',
      'watermarkDropzone',
      'redactDropzone',
      'pageNumbersDropzone',
      'pdf2imgDropzone',
      'mergeEmptyState'
    ];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.term-dropzone').forEach((el) => {
      if (el.id !== 'addSecDropzone') {
        el.classList.add('hidden');
      }
    });
  }

  function openDB() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          }
        };
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = () => resolve(null);
        request.onblocked = () => resolve(null);
      } catch (err) {
        resolve(null);
      }
    });
  }

  function withTimeout(promise, ms = 1000) {
    return Promise.race([
      promise,
      new Promise((resolve) => setTimeout(() => resolve(null), ms))
    ]);
  }

  function fileToBase64(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  function base64ToFile(dataUrl, filename, mimeType) {
    const arr = dataUrl.split(',');
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mimeType || 'application/pdf', lastModified: Date.now() });
  }

  const FileTransfer = {
    showLoading,
    hideLoading,
    hideCurrentToolDropzone: hideAllDropzones,

    /**
     * Stores files in IndexedDB and sessionStorage before navigating to a tool page.
     * @param {string} toolKey
     * @param {Array<File>} files
     */
    async setPendingFiles(toolKey, files) {
      if (!files || files.length === 0) return;

      const firstFileName = files[0]?.name || 'document.pdf';
      showLoading(`Transferring to ${toolKey.toUpperCase()}...`, firstFileName);

      // 1. Synchronously backup to sessionStorage if under 8MB for instant cross-page transfer
      try {
        const backupRecords = [];
        for (const f of files) {
          if (f.size < 8 * 1024 * 1024) {
            const b64 = await fileToBase64(f);
            if (b64) {
              backupRecords.push({ name: f.name, type: f.type, data: b64 });
            }
          }
        }
        if (backupRecords.length > 0) {
          sessionStorage.setItem('anixss_transfer_backup', JSON.stringify({
            tool: toolKey,
            files: backupRecords,
            timestamp: Date.now()
          }));
        }
      } catch (e) {
        console.warn('SessionStorage backup failed:', e);
      }

      // 2. Store in IndexedDB with timeout protection (handles large files)
      try {
        const idbSave = async () => {
          const db = await openDB();
          if (!db) return;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);

          const records = files.map((f) => ({
            name: f.name,
            type: f.type,
            lastModified: f.lastModified,
            blob: f
          }));

          store.put({ id: 'transfer_queue', tool: toolKey, files: records, timestamp: Date.now() });

          await new Promise((resolve) => {
            tx.oncomplete = resolve;
            tx.onerror = resolve;
          });
        };

        await withTimeout(idbSave(), 1000);
      } catch (e) {
        console.warn('File transfer store failed in IndexedDB:', e);
      }
    },

    /**
     * Retrieves and clears pending files on the tool page.
     * @param {string} expectedTool
     * @returns {Promise<Array<File>|null>}
     */
    async getPendingFiles(expectedTool) {
      // 1. Try IndexedDB first with timeout protection
      try {
        const idbFetch = async () => {
          const db = await openDB();
          if (!db) return null;
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get('transfer_queue');

          const result = await new Promise((resolve) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          });

          if (result && result.files && result.files.length > 0) {
            if (!expectedTool || result.tool === expectedTool) {
              store.delete('transfer_queue');
              try { sessionStorage.removeItem('anixss_transfer_backup'); } catch (e) {}

              hideAllDropzones();

              return result.files.map((item) => {
                return new File([item.blob], item.name, {
                  type: item.type,
                  lastModified: item.lastModified || Date.now()
                });
              });
            }
          }
          return null;
        };

        const idbFiles = await withTimeout(idbFetch(), 1000);
        if (idbFiles && idbFiles.length > 0) return idbFiles;
      } catch (e) {
        console.warn('IndexedDB retrieval failed:', e);
      }

      // 2. Fallback to sessionStorage backup
      try {
        const raw = sessionStorage.getItem('anixss_transfer_backup');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (!expectedTool || parsed.tool === expectedTool) {
            sessionStorage.removeItem('anixss_transfer_backup');
            if (parsed.files && parsed.files.length > 0) {
              hideAllDropzones();
              return parsed.files.map((item) => base64ToFile(item.data, item.name, item.type));
            }
          }
        }
      } catch (e) {
        console.warn('SessionStorage fallback retrieval error:', e);
      }

      return null;
    }
  };

  window.FileTransfer = FileTransfer;
})();
