/**
 * Anixss-PDFer - Client-side Cross-Page File Transfer (file-transfer.js)
 * Enables passing selected files from the homepage hero dropzone
 * to dedicated tool pages via browser IndexedDB.
 */

(function () {
  'use strict';

  const DB_NAME = 'anixss_transfer_db';
  const STORE_NAME = 'pending_files';

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
    /**
     * Stores files in IndexedDB and sessionStorage before navigating to a tool page.
     * @param {string} toolKey
     * @param {Array<File>} files
     */
    async setPendingFiles(toolKey, files) {
      if (!files || files.length === 0) return;

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
