/**
 * Anixss-PDFer - Main Application Controller (app.js)
 * Manages UI navigation, drag-and-drop workspace, tool execution,
 * live thumbnail rendering, error handling, and terminal logging.
 */

(function () {
  'use strict';

  // Global State
  const AppState = {
    activeTool: null, // null = home, or 'merge'|'remove'|'add'|'resize'|'rotate'|'img2pdf'|'pdf2img'
    
    // Merge Tool State
    mergeFiles: [], // Array of { id, name, size, buffer, pageCount, pdfDoc, rotation }
    mergePageSequence: [], // Array of { id, type, fileId, fileName, pageIndex, pageNumber, buffer, rotation }
    mergeViewMode: 'files', // 'files' | 'pages'
    mergeLayout: 'grid', // 'grid' | 'list'
    mergeBlankRule: 'none', // 'none' | 'odd_page' | 'odd_file_pad' | 'between_files'
    mergeSelectedIds: new Set(),
    mergeSortAsc: true,
    thumbnailCache: new Map(),

    // Remove Tool State
    removeDoc: null,
    removeBuffer: null,
    removeFilename: '',
    removeSelectedPages: new Set(), // 1-indexed

    // Add Tool State
    addDoc: null,
    addBuffer: null,
    addFilename: '',
    addSecDoc: null,
    addSecBuffer: null,
    addSecFilename: '',
    addPages: [],
    addSelectedIds: new Set(),
    _insertAddAtIndex: -1,

    // Resize Tool State
    resizeDoc: null,
    resizeBuffer: null,
    resizeFilename: '',

    // Rotate Tool State
    rotateDoc: null,
    rotateBuffer: null,
    rotateFilename: '',
    rotateAngles: {}, // { [pageNum]: deltaAngle }

    // Image to PDF State
    img2pdfFiles: [], // Array of { id, file, name, size, width, height, url }

    // PDF to Image State
    pdf2imgDoc: null,
    pdf2imgBuffer: null,
    pdf2imgFilename: '',
    pdf2imgResults: [], // Array of { pageNum, blob, dataUrl, filename }

    // Watermark Tool State
    watermarkDoc: null,
    watermarkBuffer: null,
    watermarkFilename: '',
    watermarkCurrentPage: 1,
    watermarkMode: 'text', // 'text' | 'image'
    watermarkImageBuffer: null,
    watermarkImageType: 'png',
    watermarkImageUrl: null,

    // Redact Tool State
    redactDoc: null,
    redactBuffer: null,
    redactFilename: '',
    redactCurrentPage: 1,
    redactBoxes: {}, // Map of pageNum -> Array of { id, normX, normY, normW, normH, type, color }
    redactActiveStyle: 'blackout', // 'blackout' | 'whiteout'
    isDrawingRedact: false,
    redactStartX: 0,
    redactStartY: 0,

    // Page Numbers Tool State
    pageNumbersDoc: null,
    pageNumbersBuffer: null,
    pageNumbersFilename: '',
    pageNumbersCurrentPage: 1,

    // N-Up Tool State
    nUpDoc: null,
    nUpBuffer: null,
    nUpFilename: '',
    nUpCurrentSheet: 1,

    // Split Tool State (Interactive Visual Scissor Suite)
    splitDoc: null,
    splitBuffer: null,
    splitFilename: '',
    splitPages: [], // Array of { id, fileId, fileName, fileBuffer, pageNumber, pageIndex, rotation, pdfDoc }
    splitCuts: new Set(), // 1-indexed cut positions: cut after page 1 => 1 in splitCuts
    splitSelectedPageId: null,
    splitSortAsc: true,

    // Last Result
    lastResultBlob: null,
    lastResultFilename: '',
    lastResultType: 'pdf' // 'pdf' | 'zip'
  };

  // DOM Elements Cache
  const UI = {
    navHome: document.getElementById('navHome'),
    navTools: document.getElementById('navTools'),
    navAbout: document.getElementById('navAbout'),
    homeSection: document.getElementById('homeSection'),
    toolWorkspace: document.getElementById('toolWorkspace'),
    aboutSection: document.getElementById('aboutSection'),
    globalDropzone: document.getElementById('globalDropzone'),
    globalFileInput: document.getElementById('globalFileInput'),
    btnGlobalSelect: document.getElementById('btnGlobalSelect'),
    toolGrid: document.getElementById('toolGrid'),
    terminalConsole: document.getElementById('terminalConsole'),
    consoleLines: document.getElementById('consoleLines'),
    resultModal: document.getElementById('resultModal'),
    resultTitle: document.getElementById('resultTitle'),
    resultMeta: document.getElementById('resultMeta'),
    btnDownloadResult: document.getElementById('btnDownloadResult'),
    btnPrintResult: document.getElementById('btnPrintResult'),
    btnStartNew: document.getElementById('btnStartNew'),
    btnCloseResult: document.getElementById('btnCloseResult'),
    quickToolModal: document.getElementById('quickToolModal'),
    quickFilename: document.getElementById('quickFilename'),
    btnBackToHome: document.getElementById('btnBackToHome'),
    workspaceTitle: document.getElementById('workspaceTitle'),
    workspaceBadge: document.getElementById('workspaceBadge'),
    btnClearTool: document.getElementById('btnClearTool')
  };

  // Helper: Log message to terminal console (and DevTools console)
  function termLog(msg, type = 'info') {
    if (type === 'error') console.error(`[PDFer] ${msg}`);
    else if (type === 'warn') console.warn(`[PDFer] ${msg}`);
    else console.log(`[PDFer] ${msg}`);

    if (!UI.consoleLines) return;
    const now = new Date();
    const timeStr = [
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
      String(now.getSeconds()).padStart(2, '0')
    ].join(':');

    const line = document.createElement('div');
    line.className = 'term-console-line';

    let prefix = `[${timeStr}] `;
    let typeClass = '';
    if (type === 'success') typeClass = 'term-console-success';
    else if (type === 'warn') typeClass = 'term-console-warn';
    else if (type === 'error') typeClass = 'term-console-error';

    line.innerHTML = `<span class="term-console-time">${prefix}</span><span class="${typeClass}">${escapeHtml(msg)}</span>`;
    UI.consoleLines.appendChild(line);
    if (UI.terminalConsole) {
      UI.terminalConsole.scrollTop = UI.terminalConsole.scrollHeight;
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Helper to extract and sanitize a custom output filename from a toolbar input
  function getCustomFilename(inputId, defaultName, defaultExt = '.pdf') {
    let raw = defaultName;
    if (inputId) {
      const inputEl = document.getElementById(inputId);
      if (inputEl && inputEl.value && inputEl.value.trim().length > 0) {
        raw = inputEl.value.trim();
      }
    }
    // Remove extension if user entered or copied it
    if (defaultExt) {
      const extRegex = new RegExp(`\\${defaultExt}$`, 'i');
      raw = raw.replace(extRegex, '');
    }
    // Sanitize illegal characters for filenames: / \ : * ? " < > |
    let sanitized = raw.replace(/[\\/:*?"<>|]/g, '_').trim();
    if (!sanitized) {
      sanitized = defaultName.replace(new RegExp(`\\${defaultExt}$`, 'i'), '');
    }

    // Ensure locked extension is appended
    return defaultExt ? `${sanitized}${defaultExt}` : sanitized;
  }

  // Helper to prefill a tool's output filename input based on primary input file
  function setToolOutputFilename(inputId, sourceFilename, suffix = '', defaultExt = '.pdf') {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    let base = 'document';
    if (sourceFilename) {
      base = sourceFilename.replace(/\.[^/.]+$/, '').trim();
    }
    const cleanBase = base.replace(/[\\/:*?"<>|]/g, '_');
    // Set base name without extension so extension remains non-editable in UI
    inputEl.value = `${cleanBase}${suffix}`;
  }

  // File drag-and-drop helper
  function setupDropzone(el, onFiles) {
    if (!el) return;
    ['dragenter', 'dragover'].forEach((eventName) => {
      el.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      el.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove('dragover');
      }, false);
    });

    el.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt ? Array.from(dt.files) : [];
      if (files.length > 0) {
        onFiles(files);
      }
    }, false);
  }

  const TOOL_PAGE_MAP = {
    merge: 'merge.html',
    organize: 'organize-pages.html',
    remove: 'remove-pages.html',
    add: 'add-pages.html',
    resize: 'resize.html',
    rotate: 'rotate.html',
    img2pdf: 'image-to-pdf.html',
    pdf2img: 'pdf-to-image.html',
    watermark: 'watermark.html',
    redact: 'redact.html',
    'page-numbers': 'page-numbers.html',
    'n-up': 'n-up.html',
    split: 'split.html'
  };

  // Navigation Controller
  function switchView(view) {
    if (view === 'home') {
      if (UI.homeSection) {
        AppState.activeTool = null;
        UI.homeSection.classList.remove('hidden');
        UI.toolWorkspace?.classList.add('hidden');
        UI.aboutSection?.classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = 'index.html';
      }
    } else if (view === 'about') {
      if (UI.aboutSection) {
        AppState.activeTool = null;
        UI.homeSection?.classList.add('hidden');
        UI.toolWorkspace?.classList.add('hidden');
        UI.aboutSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.location.href = 'about.html';
      }
    }
  }

  function activateTool(toolKey, preloadedFiles = null) {
    AppState.activeTool = toolKey;
    if (UI.homeSection) UI.homeSection.classList.add('hidden');
    if (UI.aboutSection) UI.aboutSection.classList.add('hidden');
    if (UI.toolWorkspace) UI.toolWorkspace.classList.remove('hidden');

    // Hide all tool containers if any exist
    document.querySelectorAll('.tool-panel').forEach((panel) => {
      panel.classList.add('hidden');
    });

    // Update Workspace Header
    const toolMeta = {
      merge: { title: 'TOOL // 01: MERGE PDF', badge: 'BATCH PROCESSING' },
      organize: { title: 'TOOL // 13: ORGANIZE PAGES', badge: 'PAGE REORDER' },
      remove: { title: 'TOOL // 02: REMOVE PAGES', badge: 'PAGE EXTRACTION' },
      add: { title: 'TOOL // 03: ADD PAGES', badge: 'PAGE INSERTER' },
      resize: { title: 'TOOL // 04: RESIZE PDF', badge: 'DIMENSION SCALER' },
      rotate: { title: 'TOOL // 05: ROTATE PDF', badge: 'ORIENTATION FIX' },
      img2pdf: { title: 'TOOL // 06: IMAGE TO PDF', badge: 'MEDIA COMPILER' },
      pdf2img: { title: 'TOOL // 07: PDF TO IMAGE', badge: 'RASTER EXPORTER' },
      watermark: { title: 'TOOL // 08: WATERMARK PDF', badge: 'SECURITY & BRANDING' },
      redact: { title: 'TOOL // 09: HIDE CONTENT (REDACT)', badge: 'PRIVACY SANITIZER' },
      'page-numbers': { title: 'TOOL // 10: ADD PAGE NUMBERS', badge: 'PAGINATION' },
      'n-up': { title: 'TOOL // 11: MULTIPLE PAGES PER SHEET', badge: 'LAYOUT COMPOSER' },
      split: { title: 'TOOL // 12: SPLIT PDF', badge: 'PAGE SEPARATOR' }
    };

    const meta = toolMeta[toolKey] || { title: `TOOL: ${toolKey.toUpperCase()}`, badge: 'ACTIVE' };
    if (UI.workspaceTitle) UI.workspaceTitle.textContent = meta.title;
    if (UI.workspaceBadge) UI.workspaceBadge.textContent = meta.badge;

    // Show active container
    const activePanel = document.getElementById(`panel_${toolKey}`);
    if (activePanel) {
      activePanel.classList.remove('hidden');
    }

    termLog(`Active: ${meta.title}`);

    // If preloaded files passed, feed into tool
    if (preloadedFiles && preloadedFiles.length > 0) {
      handleFilesForTool(toolKey, preloadedFiles);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function hideCurrentToolDropzone(toolKey) {
    if (window.FileTransfer && window.FileTransfer.hideCurrentToolDropzone) {
      window.FileTransfer.hideCurrentToolDropzone();
    }
    const dropzoneIds = [
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
    dropzoneIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    document.querySelectorAll('.term-dropzone').forEach((el) => {
      if (el.id !== 'addSecDropzone') {
        el.classList.add('hidden');
      }
    });
  }

  function showCurrentToolDropzone(toolKey) {
    const dropzoneIds = [
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
    dropzoneIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.classList.remove('hidden');
    });
    document.querySelectorAll('.term-dropzone').forEach((el) => {
      el.classList.remove('hidden');
    });
  }

  // Handle files passed into a specific tool
  async function handleFilesForTool(toolKey, files) {
    if (!files || files.length === 0) return;

    hideCurrentToolDropzone(toolKey);

    if (toolKey === 'merge' || toolKey === 'organize') {
      const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFiles.length === 0) {
        termLog(`No valid PDF files selected for ${toolKey === 'organize' ? 'Organize Pages' : 'Merge'}.`, 'error');
        return;
      }
      for (const file of pdfFiles) {
        await addMergeFile(file);
      }
      if (toolKey === 'organize' || document.body.dataset.page === 'organize') {
        AppState.mergeViewMode = 'pages';
        renderMergeView();
      }
    } else if (toolKey === 'remove') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadRemovePdf(pdfFile);
    } else if (toolKey === 'add') {
      const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFiles.length > 0) {
        if (!AppState.addDoc || !AppState.addPages || AppState.addPages.length === 0) {
          await loadAddPrimaryPdf(pdfFiles[0]);
          if (pdfFiles.length > 1) {
            await insertAddPdfFiles(pdfFiles.slice(1));
          }
        } else {
          await insertAddPdfFiles(pdfFiles);
        }
      }
    } else if (toolKey === 'resize') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadResizePdf(pdfFile);
    } else if (toolKey === 'rotate') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadRotatePdf(pdfFile);
    } else if (toolKey === 'img2pdf') {
      const imgFiles = files.filter((f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(f.name));
      if (imgFiles.length === 0) {
        termLog('No valid image files selected for Image to PDF.', 'error');
        return;
      }
      for (const img of imgFiles) {
        await addImg2PdfFile(img);
      }
    } else if (toolKey === 'pdf2img') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadPdf2ImgPdf(pdfFile);
    } else if (toolKey === 'watermark') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadWatermarkPdf(pdfFile);
    } else if (toolKey === 'redact') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadRedactPdf(pdfFile);
    } else if (toolKey === 'page-numbers') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadPageNumbersPdf(pdfFile);
    } else if (toolKey === 'n-up') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadNUpPdf(pdfFile);
    } else if (toolKey === 'split') {
      const pdfFile = files.find((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      if (pdfFile) await loadSplitPdf(pdfFile);
    }
  }

  // ==========================================
  // TOOL 01: MERGE PDF (Enhanced Suite)
  // ==========================================

  // Add a file (PDF or Image) to the merge queue
  async function addMergeFile(file) {
    try {
      termLog(`Loading file: ${file.name} (${Converters.formatBytes(file.size)})...`);

      let buffer;
      let isImage = false;

      // Handle direct image files (JPG, PNG, WebP)
      if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) {
        termLog(`Compiling image "${file.name}" to PDF page...`);
        const imgPdfBytes = await Converters.imagesToPdf([file], { pageSize: 'A4', fit: 'contain' });
        buffer = imgPdfBytes.buffer;
        isImage = true;
      } else {
        buffer = await file.arrayBuffer();
      }

      // Load PDF proxy for rendering previews & dimensions
      let pageCount = 0;
      let pdfDoc = null;
      let defaultWidth = 595.28;
      let defaultHeight = 841.89;
      try {
        pdfDoc = await PdfPreview.loadDocument(buffer.slice(0));
        pageCount = pdfDoc.numPages;
        if (pageCount > 0) {
          const firstPage = await pdfDoc.getPage(1);
          const vp = firstPage.getViewport({ scale: 1.0 });
          defaultWidth = vp.width;
          defaultHeight = vp.height;
        }
      } catch (err) {
        termLog(`Warning: Live preview engine fallback for ${file.name}: ${err.message}`, 'warn');
        try {
          const doc = await window.PDFLib.PDFDocument.load(buffer.slice(0), { ignoreEncryption: true });
          pageCount = doc.getPageCount();
          if (pageCount > 0) {
            const sz = doc.getPage(0).getSize();
            defaultWidth = sz.width;
            defaultHeight = sz.height;
          }
        } catch (e2) {
          pageCount = 1;
        }
      }

      const fileItem = {
        id: 'file_' + Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        buffer: buffer,
        originalPageCount: pageCount,
        pageCount: pageCount,
        firstActivePageNumber: 1,
        firstActivePageRotation: 0,
        pageWidth: defaultWidth,
        pageHeight: defaultHeight,
        pdfDoc: pdfDoc,
        rotation: 0,
        isImage: isImage
      };

      const insertAt = (typeof AppState._insertFileAtIndex === 'number' && AppState._insertFileAtIndex >= 0 && AppState._insertFileAtIndex <= AppState.mergeFiles.length)
        ? AppState._insertFileAtIndex
        : -1;
      AppState._insertFileAtIndex = null;

      if (insertAt >= 0) {
        AppState.mergeFiles.splice(insertAt, 0, fileItem);
      } else {
        AppState.mergeFiles.push(fileItem);
      }

      // Append pages of this file to the global page sequence with dimensions
      for (let p = 1; p <= pageCount; p++) {
        AppState.mergePageSequence.push({
          id: 'page_' + Math.random().toString(36).substr(2, 9),
          type: 'pdfPage',
          fileId: fileItem.id,
          fileName: fileItem.name,
          pageIndex: p - 1,
          pageNumber: p,
          width: defaultWidth,
          height: defaultHeight,
          buffer: buffer,
          rotation: 0
        });
      }

      // Reorder existing pages in mergePageSequence according to mergeFiles order
      reorderPageSequenceByFiles();

      // If any blank pages were created before files were loaded, update them to match this file's dimensions
      AppState.mergePageSequence.forEach((p) => {
        if (p.type === 'blankPage' && (!p.width || p.width === 595.28)) {
          p.width = defaultWidth;
          p.height = defaultHeight;
        }
      });

      if (AppState.mergeFiles.length === 1) {
        setToolOutputFilename('mergeOutputFilename', file.name, '_merged');
      }

      renderMergeView();
      termLog(`Added ${file.name} (${pageCount} page${pageCount === 1 ? '' : 's'}). Queue: ${AppState.mergeFiles.length} file(s).`, 'success');
    } catch (e) {
      termLog(`Failed to load ${file.name}: ${e.message}`, 'error');
      alert(`Error loading file ${file.name}: ${e.message}`);
    }
  }

  // Insert a blank page into the sequence matching existing file size
  function addMergeBlankPage(insertAtIndex = -1, isSeparate = null) {
    const isSeparateFile = isSeparate !== null ? isSeparate : (AppState.mergeViewMode === 'files');
    let targetW = 595.28;
    let targetH = 841.89;

    // Helper: find nearest page with dimensions in sequence or files
    function findClosestDimensions(idx) {
      if (AppState.mergePageSequence.length > 0) {
        if (idx >= 0) {
          // Search backwards from idx - 1
          for (let i = idx - 1; i >= 0; i--) {
            const p = AppState.mergePageSequence[i];
            if (p && p.width && p.height) return { w: p.width, h: p.height };
          }
          // Search forwards from idx
          for (let i = idx; i < AppState.mergePageSequence.length; i++) {
            const p = AppState.mergePageSequence[i];
            if (p && p.width && p.height) return { w: p.width, h: p.height };
          }
        } else {
          // Search backwards from end
          for (let i = AppState.mergePageSequence.length - 1; i >= 0; i--) {
            const p = AppState.mergePageSequence[i];
            if (p && p.width && p.height) return { w: p.width, h: p.height };
          }
        }
      }
      // Check loaded mergeFiles
      for (const f of AppState.mergeFiles) {
        if (f.pageWidth && f.pageHeight) return { w: f.pageWidth, h: f.pageHeight };
      }
      return null;
    }

    const dims = findClosestDimensions(insertAtIndex);
    if (dims) {
      targetW = dims.w;
      targetH = dims.h;
    }

    const blankId = 'blank_' + Math.random().toString(36).substr(2, 9);

    if (isSeparateFile) {
      // Standalone blank page item visible in Files mode
      const blankFileItem = {
        id: blankId,
        type: 'blankPage',
        name: '[Blank Page]',
        size: 0,
        pageCount: 1,
        originalPageCount: 1,
        firstActivePageNumber: 1,
        firstActivePageRotation: 0,
        pageWidth: targetW,
        pageHeight: targetH,
        rotation: 0
      };

      const blankPageItem = {
        id: 'page_' + Math.random().toString(36).substr(2, 9),
        type: 'blankPage',
        fileId: blankId,
        fileName: '[Blank Page]',
        pageNumber: 1,
        width: targetW,
        height: targetH,
        note: 'Blank Page'
      };

      if (insertAtIndex >= 0 && insertAtIndex <= AppState.mergeFiles.length) {
        AppState.mergeFiles.splice(insertAtIndex, 0, blankFileItem);
      } else {
        AppState.mergeFiles.push(blankFileItem);
      }

      AppState.mergePageSequence.push(blankPageItem);
      reorderPageSequenceByFiles();
    } else {
      // In Pages mode: insert at page sequence index
      const blankPageItem = {
        id: blankId,
        type: 'blankPage',
        fileId: null,
        fileName: '[Blank Page]',
        pageNumber: 1,
        width: targetW,
        height: targetH,
        note: 'Blank Page'
      };

      if (insertAtIndex >= 0 && insertAtIndex <= AppState.mergePageSequence.length) {
        AppState.mergePageSequence.splice(insertAtIndex, 0, blankPageItem);
      } else {
        AppState.mergePageSequence.push(blankPageItem);
      }
    }

    renderMergeView();
    termLog(`Inserted blank page (${Math.round(targetW)} × ${Math.round(targetH)} pt, matching file size).`, 'success');
  }

  // Synchronize mergeFiles with current mergePageSequence after deletions, additions, or rotations
  function syncMergeStateAfterPageChange() {
    const activePagesByFile = new Map();
    AppState.mergePageSequence.forEach((p) => {
      if (p.fileId) {
        if (!activePagesByFile.has(p.fileId)) {
          activePagesByFile.set(p.fileId, []);
        }
        activePagesByFile.get(p.fileId).push(p);
      }
    });

    const remainingFiles = [];
    AppState.mergeFiles.forEach((fileItem) => {
      if (fileItem.type === 'blankPage') {
        const remainingBlankPages = AppState.mergePageSequence.filter((p) => p.fileId === fileItem.id || p.id === fileItem.id);
        if (remainingBlankPages.length > 0) {
          fileItem.pageCount = remainingBlankPages.length;
          remainingFiles.push(fileItem);
        } else {
          AppState.mergeSelectedIds.delete(fileItem.id);
        }
        return;
      }

      const remainingPages = activePagesByFile.get(fileItem.id) || [];
      if (remainingPages.length > 0) {
        fileItem.pageCount = remainingPages.length;
        fileItem.firstActivePageNumber = remainingPages[0].pageNumber;
        fileItem.firstActivePageRotation = remainingPages[0].rotation || 0;
        remainingFiles.push(fileItem);
      } else {
        termLog(`All pages of "${fileItem.name}" deleted. File removed from document queue.`, 'warn');
        AppState.mergeSelectedIds.delete(fileItem.id);
      }
    });

    AppState.mergeFiles = remainingFiles;

    // Prune stale selection IDs
    const validIds = new Set([
      ...AppState.mergeFiles.map((f) => f.id),
      ...AppState.mergePageSequence.map((p) => p.id)
    ]);
    AppState.mergeSelectedIds.forEach((id) => {
      if (!validIds.has(id)) AppState.mergeSelectedIds.delete(id);
    });
  }

  // Reorder existing pages in mergePageSequence according to mergeFiles order without losing deletions
  function reorderPageSequenceByFiles() {
    const pagesByFile = new Map();
    const unassignedPages = [];

    AppState.mergePageSequence.forEach((p) => {
      if (p.fileId) {
        if (!pagesByFile.has(p.fileId)) pagesByFile.set(p.fileId, []);
        pagesByFile.get(p.fileId).push(p);
      } else {
        unassignedPages.push(p);
      }
    });

    const newSeq = [];
    AppState.mergeFiles.forEach((f) => {
      const filePages = pagesByFile.get(f.id) || [];
      newSeq.push(...filePages);
    });
    newSeq.push(...unassignedPages);
    AppState.mergePageSequence = newSeq;
  }

  // Unified, cached thumbnail renderer with immediate high-contrast fallback
  async function renderMergeThumbnail(fileItem, pageNumber, canvas, options = {}) {
    if (!canvas) return;

    const rotation = options.rotation || 0;
    const maxWidth = options.maxWidth || 160;
    const maxHeight = options.maxHeight || 180;
    const cacheKey = `${fileItem.id}_p${pageNumber}_r${rotation}_w${maxWidth}_h${maxHeight}`;

    // 1. Instant cache hit
    if (AppState.thumbnailCache && AppState.thumbnailCache.has(cacheKey)) {
      const cached = AppState.thumbnailCache.get(cacheKey);
      canvas.width = cached.width;
      canvas.height = cached.height;
      canvas.style.width = cached.style.width;
      canvas.style.height = cached.style.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cached, 0, 0);
      return;
    }

    // 2. Immediate clean monochrome fallback (canvas never sits empty or blank)
    PdfPreview.drawFallbackPage(canvas, pageNumber, fileItem.name, rotation, { maxWidth, maxHeight });

    // 3. Render via PDF.js worker asynchronously and cache result
    if (fileItem.pdfDoc) {
      try {
        await PdfPreview.renderPageToCanvas(fileItem.pdfDoc, pageNumber, canvas, {
          maxWidth,
          maxHeight,
          rotation
        });

        // Store offscreen copy in cache
        if (!AppState.thumbnailCache) AppState.thumbnailCache = new Map();
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        offscreen.style.width = canvas.style.width;
        offscreen.style.height = canvas.style.height;
        const offCtx = offscreen.getContext('2d');
        offCtx.drawImage(canvas, 0, 0);
        AppState.thumbnailCache.set(cacheKey, offscreen);
      } catch (err) {
        // Fallback already rendered cleanly on canvas
        console.warn(`Preview fallback used for ${fileItem.name} p.${pageNumber}:`, err);
      }
    }
  }

  // Calculate the active page sequence applying the current blank page rule
  function getEffectivePageList() {
    const rule = AppState.mergeBlankRule;
    const base = AppState.mergePageSequence;

    if (rule === 'none') {
      return base.slice(0);
    }

    if (rule === 'odd_page') {
      // Add a blank page after each odd page (1, 3, 5...)
      const result = [];
      let outputNum = 1;
      for (let i = 0; i < base.length; i++) {
        const item = base[i];
        result.push(item);
        if (outputNum % 2 === 1 && i < base.length - 1) {
          const w = item.width || (item.fileId && AppState.mergeFiles.find((f) => f.id === item.fileId)?.pageWidth) || 595.28;
          const h = item.height || (item.fileId && AppState.mergeFiles.find((f) => f.id === item.fileId)?.pageHeight) || 841.89;
          result.push({
            id: `auto_odd_${i}`,
            type: 'blankPage',
            isAutoOddPad: true,
            note: 'Odd-Page Blank Pad',
            width: w,
            height: h
          });
          outputNum++;
        }
        outputNum++;
      }
      return result;
    }

    if (rule === 'odd_file_pad') {
      // Pad odd-paged files to even for duplex double-sided printing
      const result = [];
      for (let i = 0; i < base.length; i++) {
        const item = base[i];
        result.push(item);
        const nextItem = base[i + 1];
        if (nextItem && item.fileId !== nextItem.fileId) {
          const file = AppState.mergeFiles.find((f) => f.id === item.fileId);
          if (file && file.pageCount % 2 === 1) {
            const w = item.width || file.pageWidth || 595.28;
            const h = item.height || file.pageHeight || 841.89;
            result.push({
              id: `auto_pad_${item.fileId}`,
              type: 'blankPage',
              isAutoOddPad: true,
              note: 'Duplex Pad (Even File)',
              width: w,
              height: h
            });
          }
        }
      }
      return result;
    }

    if (rule === 'between_files') {
      // Insert a blank separator page between each file
      const result = [];
      for (let i = 0; i < base.length; i++) {
        const item = base[i];
        result.push(item);
        const nextItem = base[i + 1];
        if (nextItem && item.fileId !== nextItem.fileId) {
          const w = item.width || (item.fileId && AppState.mergeFiles.find((f) => f.id === item.fileId)?.pageWidth) || 595.28;
          const h = item.height || (item.fileId && AppState.mergeFiles.find((f) => f.id === item.fileId)?.pageHeight) || 841.89;
          result.push({
            id: `auto_sep_${i}`,
            type: 'blankPage',
            isAutoOddPad: true,
            note: 'File Separator',
            width: w,
            height: h
          });
        }
      }
      return result;
    }

    return base.slice(0);
  }

  // Render the Merge Tool Workspace
  function renderMergeView() {
    // Keep file stats and page sequence synchronized before rendering
    syncMergeStateAfterPageChange();

    const filesContainer = document.getElementById('mergeFilesContainer');
    const filesGrid = document.getElementById('mergeFilesGrid');
    const pagesContainer = document.getElementById('mergePagesContainer');
    const pagesGrid = document.getElementById('mergePagesGrid');
    const listContainer = document.getElementById('mergeListContainer');
    const listTable = document.getElementById('mergeFileListTable');
    const emptyState = document.getElementById('mergeEmptyState');
    const btnFinish = document.getElementById('btnProcessMerge');
    const btnPreviewDoc = document.getElementById('btnPreviewMergedDoc');
    const summaryText = document.getElementById('mergeSummaryText');
    const selectedCount = document.getElementById('mergeSelectedCount');
    const selectAllCheckbox = document.getElementById('mergeSelectAll');
    const pagesSummaryBadge = document.getElementById('mergePagesSummaryBadge');

    const totalFiles = AppState.mergeFiles.length;

    if (totalFiles === 0) {
      emptyState?.classList.remove('hidden');
      filesContainer?.classList.add('hidden');
      pagesContainer?.classList.add('hidden');
      listContainer?.classList.add('hidden');
      if (btnFinish) btnFinish.disabled = true;
      if (btnPreviewDoc) btnPreviewDoc.disabled = true;
      if (summaryText) summaryText.textContent = 'OUTPUT: 0 FILES // 0 PAGES';
      if (selectedCount) selectedCount.textContent = '(0 selected)';
      if (selectAllCheckbox) selectAllCheckbox.checked = false;
      return;
    }

    emptyState?.classList.add('hidden');
    if (btnFinish) btnFinish.disabled = false;
    if (btnPreviewDoc) btnPreviewDoc.disabled = false;

    const effectivePages = getEffectivePageList();
    if (summaryText) {
      const blankCount = effectivePages.filter((p) => p.type === 'blankPage').length;
      summaryText.textContent = `OUTPUT: ${totalFiles} FILE${totalFiles === 1 ? '' : 'S'} // ${effectivePages.length} TOTAL PAGES${blankCount > 0 ? ` (${blankCount} BLANK)` : ''}`;
    }
    if (pagesSummaryBadge) {
      pagesSummaryBadge.textContent = `${effectivePages.length} PAGES TOTAL`;
    }

    // Toggle Tab Headers
    const isFilesMode = AppState.mergeViewMode === 'files';
    const tabFiles = document.getElementById('btnMergeTabFiles');
    const tabPages = document.getElementById('btnMergeTabPages');
    if (tabFiles) {
      tabFiles.classList.toggle('bg-black', isFilesMode);
      tabFiles.classList.toggle('text-white', isFilesMode);
      tabFiles.classList.toggle('text-black', !isFilesMode);
    }
    if (tabPages) {
      tabPages.classList.toggle('bg-black', !isFilesMode);
      tabPages.classList.toggle('text-white', !isFilesMode);
      tabPages.classList.toggle('text-black', isFilesMode);
    }

    // Toggle Grid / List Layout Switcher Buttons
    const isGrid = AppState.mergeLayout === 'grid';
    const btnGrid = document.getElementById('btnMergeLayoutGrid');
    const btnList = document.getElementById('btnMergeLayoutList');
    if (btnGrid) {
      btnGrid.className = isGrid
        ? 'p-1 border border-black bg-black text-white cursor-pointer transition-none'
        : 'p-1 border border-transparent hover:border-black bg-white text-black cursor-pointer transition-none';
    }
    if (btnList) {
      btnList.className = !isGrid
        ? 'p-1 border border-black bg-black text-white cursor-pointer transition-none'
        : 'p-1 border border-transparent hover:border-black bg-white text-black cursor-pointer transition-none';
    }

    // ----------------------------------------------------
    // VIEW 3: LIST VIEW (When List toggle is selected)
    // ----------------------------------------------------
    if (!isGrid) {
      filesContainer?.classList.add('hidden');
      pagesContainer?.classList.add('hidden');
      listContainer?.classList.remove('hidden');

      renderMergeListView(isFilesMode, effectivePages);
      updateSelectionCounts();
      return;
    }

    listContainer?.classList.add('hidden');

    // ----------------------------------------------------
    // VIEW 1: FILES MODE (Stacked Paper Cards)
    // ----------------------------------------------------
    if (isFilesMode) {
      filesContainer?.classList.remove('hidden');
      pagesContainer?.classList.add('hidden');

      if (filesGrid) {
        filesGrid.innerHTML = '';

        AppState.mergeFiles.forEach((fileItem, index) => {
          const isSelected = AppState.mergeSelectedIds.has(fileItem.id);
          const firstPageNum = fileItem.firstActivePageNumber || 1;
          const displayRotation = ((fileItem.rotation || 0) + (fileItem.firstActivePageRotation || 0)) % 360;

          const cardWrapper = document.createElement('div');
          cardWrapper.className = 'flex items-center gap-3 sm:gap-4 my-2';

          if (fileItem.type === 'blankPage') {
            cardWrapper.innerHTML = `
              <div class="stacked-paper group cursor-grab" draggable="true" data-file-index="${index}">
                <div class="stacked-paper-content border-2 border-black p-2.5 bg-neutral-100 w-48 sm:w-52 flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  
                  <!-- Card Header: Checkbox & Quick Actions -->
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="flex items-center cursor-pointer">
                      <input type="checkbox" class="w-4 h-4 accent-black cursor-pointer file-select-checkbox" data-file-id="${fileItem.id}" ${isSelected ? 'checked' : ''} />
                    </label>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" class="term-btn text-[10px] p-0.5 px-1.5 btn-file-preview" title="Full page preview">👁</button>
                      <button type="button" class="term-btn text-[10px] p-0.5 px-1.5 btn-file-del" title="Remove blank page">✕</button>
                    </div>
                  </div>

                  <!-- Solid White Paper Sheet (No text on paper) -->
                  <div class="relative bg-white border border-neutral-300 shadow-[1px_1px_2px_rgba(0,0,0,0.15)] flex items-center justify-center overflow-hidden my-1 cursor-pointer file-thumb-preview-trigger group/thumb w-full" style="height: 180px; background-color: #ffffff;" title="Click for full page preview">
                    <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                      <span class="opacity-0 group-hover/thumb:opacity-100 bg-black text-white text-[9px] font-mono px-2 py-0.5 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                        <span>👁</span><span>FULL PREVIEW</span>
                      </span>
                    </div>
                  </div>

                  <!-- File Info Pill -->
                  <div class="pt-2 border-t border-black space-y-0.5 text-center font-mono">
                    <div class="inline-block bg-white border border-black px-1.5 py-0.5 text-xs font-bold truncate max-w-full">
                      [Blank Page]
                    </div>
                    <div class="text-[11px] text-neutral-600 font-bold">
                      1 page
                    </div>
                  </div>

                </div>
              </div>

              <!-- In-Between (+) Button -->
              <div class="flex flex-col items-center justify-center relative">
                <button type="button" class="card-plus-btn btn-insert-divider" data-insert-index="${index + 1}" title="Insert file or blank page here">
                  +
                </button>
              </div>
            `;

            // Preview blank page
            cardWrapper.querySelector('.btn-file-preview')?.addEventListener('click', (e) => {
              e.stopPropagation();
              const pageSeqIdx = AppState.mergePageSequence.findIndex((p) => p.fileId === fileItem.id || p.id === fileItem.id);
              openFullPagePreview(pageSeqIdx >= 0 ? pageSeqIdx : 0);
            });
            cardWrapper.querySelector('.file-thumb-preview-trigger')?.addEventListener('click', () => {
              const pageSeqIdx = AppState.mergePageSequence.findIndex((p) => p.fileId === fileItem.id || p.id === fileItem.id);
              openFullPagePreview(pageSeqIdx >= 0 ? pageSeqIdx : 0);
            });

            // Delete blank page
            cardWrapper.querySelector('.btn-file-del')?.addEventListener('click', () => {
              const fileId = fileItem.id;
              AppState.mergeFiles.splice(index, 1);
              AppState.mergeSelectedIds.delete(fileId);
              AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => p.fileId !== fileId && p.id !== fileId);
              syncMergeStateAfterPageChange();
              renderMergeView();
              termLog('Removed blank page from document queue.');
            });
          } else {
            // Standard PDF File Card
            cardWrapper.innerHTML = `
              <div class="stacked-paper group cursor-grab" draggable="true" data-file-index="${index}">
                <div class="stacked-paper-content border-2 border-black p-2.5 bg-white w-48 sm:w-52 flex flex-col justify-between shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  
                  <!-- Card Header: Checkbox & Quick Actions -->
                  <div class="flex items-center justify-between mb-1.5">
                    <label class="flex items-center cursor-pointer">
                      <input type="checkbox" class="w-4 h-4 accent-black cursor-pointer file-select-checkbox" data-file-id="${fileItem.id}" ${isSelected ? 'checked' : ''} />
                    </label>
                    <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button type="button" class="term-btn text-[10px] p-0.5 px-1.5 btn-file-preview" title="Full page preview">👁</button>
                      <button type="button" class="term-btn text-[10px] p-0.5 px-1.5 btn-file-rot" title="Rotate document +90°">↷</button>
                      <button type="button" class="term-btn text-[10px] p-0.5 px-1.5 btn-file-del" title="Remove file">✕</button>
                    </div>
                  </div>

                  <!-- Canvas Preview (Shows first active page with rotation, clickable for full preview) -->
                  <div class="relative bg-neutral-50 border border-neutral-300 flex items-center justify-center overflow-hidden my-1 cursor-pointer file-thumb-preview-trigger group/thumb" style="height: 180px;" title="Click for full page preview">
                    <canvas id="file_thumb_${fileItem.id}"></canvas>
                    <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                      <span class="opacity-0 group-hover/thumb:opacity-100 bg-black text-white text-[9px] font-mono px-2 py-0.5 font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                        <span>👁</span><span>FULL PREVIEW</span>
                      </span>
                    </div>
                    ${displayRotation ? `<span class="absolute top-1 right-1 bg-black text-white text-[9px] px-1 font-bold">+${displayRotation}°</span>` : ''}
                  </div>

                  <!-- File Info Pill (Shows dynamic active page count) -->
                  <div class="pt-2 border-t border-black space-y-0.5 text-center font-mono">
                    <div class="inline-block bg-neutral-100 border border-black px-1.5 py-0.5 text-xs font-bold truncate max-w-full" title="${escapeHtml(fileItem.name)}">
                      ${escapeHtml(fileItem.name)}
                    </div>
                    <div class="text-[11px] text-neutral-600 font-bold">
                      ${fileItem.pageCount} page${fileItem.pageCount === 1 ? '' : 's'}
                    </div>
                  </div>

                </div>
              </div>

              <!-- In-Between (+) Button -->
              <div class="flex flex-col items-center justify-center relative">
                <button type="button" class="card-plus-btn btn-insert-divider" data-insert-index="${index + 1}" title="Insert file or blank page here">
                  +
                </button>
              </div>
            `;

            // Bind preview
            cardWrapper.querySelector('.btn-file-preview')?.addEventListener('click', (e) => {
              e.stopPropagation();
              openFullFilePreview(fileItem, firstPageNum);
            });
            cardWrapper.querySelector('.file-thumb-preview-trigger')?.addEventListener('click', () => {
              openFullFilePreview(fileItem, firstPageNum);
            });

            // Bind rotate document
            cardWrapper.querySelector('.btn-file-rot')?.addEventListener('click', () => {
              fileItem.rotation = (fileItem.rotation + 90) % 360;
              renderMergeView();
              termLog(`Rotated "${fileItem.name}" to ${fileItem.rotation}°.`);
            });

            // Bind delete file (and its pages)
            cardWrapper.querySelector('.btn-file-del')?.addEventListener('click', () => {
              const fileId = fileItem.id;
              AppState.mergeFiles.splice(index, 1);
              AppState.mergeSelectedIds.delete(fileId);
              AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => p.fileId !== fileId);
              syncMergeStateAfterPageChange();
              renderMergeView();
              termLog(`Removed "${fileItem.name}" and all its pages from queue.`);
            });
          }

          // Common bindings (checkbox, in-between +, drag-drop)
          cardWrapper.querySelector('.file-select-checkbox')?.addEventListener('change', (e) => {
            if (e.target.checked) AppState.mergeSelectedIds.add(fileItem.id);
            else AppState.mergeSelectedIds.delete(fileItem.id);
            updateSelectionCounts();
          });

          cardWrapper.querySelector('.btn-insert-divider')?.addEventListener('click', (e) => {
            e.stopPropagation();
            showInlineInsertMenu(e.currentTarget, index + 1);
          });

          setupFileCardDrag(cardWrapper.querySelector('.stacked-paper'), index, fileItem.id);
          filesGrid.appendChild(cardWrapper);

          // Asynchronously render preview of first active page (only for PDF files)
          if (fileItem.type !== 'blankPage') {
            const canvas = cardWrapper.querySelector(`#file_thumb_${fileItem.id}`);
            if (canvas) {
              renderMergeThumbnail(fileItem, firstPageNum, canvas, { maxWidth: 180, maxHeight: 180, rotation: displayRotation });
            }
          }
        });

        // Add the End (+) Add card matching the screenshot
        const endAddCard = document.createElement('div');
        endAddCard.className = 'border-2 border-dashed border-black bg-neutral-50 p-6 w-48 sm:w-52 h-[260px] flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-neutral-100 transition-none select-none my-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
        endAddCard.innerHTML = `
          <div class="w-8 h-8 rounded-full border border-black flex items-center justify-center text-lg font-bold bg-white">+</div>
          <div class="text-xs font-bold font-mono">Add PDF, image files</div>
          <div class="text-[10px] text-neutral-500 font-mono">or drag & drop here</div>
        `;
        endAddCard.addEventListener('click', () => {
          document.getElementById('mergeFileInput')?.click();
        });
        setupDropzone(endAddCard, (files) => {
          files.forEach((f) => addMergeFile(f));
        });

        filesGrid.appendChild(endAddCard);
      }
    }

    // ----------------------------------------------------
    // VIEW 2: PAGES MODE (Individual Page Cards + Drag Reorder)
    // ----------------------------------------------------
    if (!isFilesMode) {
      filesContainer?.classList.add('hidden');
      pagesContainer?.classList.remove('hidden');
      listContainer?.classList.add('hidden');

      if (pagesGrid) {
        pagesGrid.innerHTML = '';

        effectivePages.forEach((pageItem, index) => {
          const isSelected = AppState.mergeSelectedIds.has(pageItem.id);
          const displayPageNum = index + 1;

          const pageCard = document.createElement('div');
          pageCard.className = 'page-thumb-card relative group cursor-grab border-2 border-black bg-white p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform';
          pageCard.setAttribute('draggable', pageItem.isAutoOddPad ? 'false' : 'true');
          pageCard.dataset.pageIndex = index;

          if (pageItem.type === 'pdfPage') {
            const parentFile = AppState.mergeFiles.find((f) => f.id === pageItem.fileId);
            const pageRot = ((pageItem.rotation || 0) + (parentFile?.rotation || 0)) % 360;

            pageCard.innerHTML = `
              <div class="w-full flex items-center justify-between mb-1 pb-1 border-b border-black text-xs font-mono">
                <input type="checkbox" class="w-3.5 h-3.5 accent-black cursor-pointer page-select-checkbox" data-page-id="${pageItem.id}" ${isSelected ? 'checked' : ''} />
                <span class="font-bold text-[10px] bg-black text-white px-1.5 py-0.2">#${displayPageNum}</span>
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" class="term-btn text-[9px] p-0.5 btn-page-preview" title="Full page preview">👁</button>
                  <button type="button" class="term-btn text-[9px] p-0.5 btn-page-rot" title="Rotate +90°">↷</button>
                  <button type="button" class="term-btn text-[9px] p-0.5 btn-page-del" title="Delete page">✕</button>
                </div>
              </div>

              <!-- Canvas Preview (Clickable for full preview) -->
              <div class="relative bg-neutral-50 border border-neutral-300 flex items-center justify-center overflow-hidden my-1 cursor-pointer page-thumb-preview-trigger group/thumb" style="min-height: 140px; min-width: 100px;" title="Click for full page preview">
                <canvas id="page_thumb_${pageItem.id}"></canvas>
                <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
                  <span class="opacity-0 group-hover/thumb:opacity-100 bg-black text-white text-[8px] font-mono px-1.5 py-0.5 font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                    <span>👁</span><span>VIEW</span>
                  </span>
                </div>
                ${pageRot ? `<span class="absolute top-1 right-1 bg-black text-white text-[9px] px-1 font-bold">+${pageRot}°</span>` : ''}
              </div>

              <!-- Origin Meta -->
              <div class="text-[10px] text-neutral-600 truncate w-full text-center mt-1 font-mono" title="${escapeHtml(pageItem.fileName)}">
                ${escapeHtml(pageItem.fileName)} (p.${pageItem.pageNumber})
              </div>
            `;

            // Preview
            pageCard.querySelector('.btn-page-preview')?.addEventListener('click', (e) => {
              e.stopPropagation();
              openFullPagePreview(index);
            });
            pageCard.querySelector('.page-thumb-preview-trigger')?.addEventListener('click', () => {
              openFullPagePreview(index);
            });

            // Checkbox
            pageCard.querySelector('.page-select-checkbox').addEventListener('change', (e) => {
              if (e.target.checked) AppState.mergeSelectedIds.add(pageItem.id);
              else AppState.mergeSelectedIds.delete(pageItem.id);
              updateSelectionCounts();
            });

            // Rotate
            pageCard.querySelector('.btn-page-rot').addEventListener('click', () => {
              pageItem.rotation = (pageItem.rotation + 90) % 360;
              if (parentFile && parentFile.firstActivePageNumber === pageItem.pageNumber) {
                parentFile.firstActivePageRotation = pageItem.rotation;
              }
              renderMergeView();
            });

            // Delete single page (updates both pages and file preview)
            pageCard.querySelector('.btn-page-del').addEventListener('click', () => {
              const seqIdx = AppState.mergePageSequence.findIndex((p) => p.id === pageItem.id);
              if (seqIdx !== -1) {
                const deleted = AppState.mergePageSequence.splice(seqIdx, 1)[0];
                AppState.mergeSelectedIds.delete(pageItem.id);
                syncMergeStateAfterPageChange();
                renderMergeView();
                termLog(`Removed page #${displayPageNum} (${deleted.fileName} p.${deleted.pageNumber}). File preview updated.`);
              }
            });

            // Render page preview canvas
            const canvas = pageCard.querySelector(`#page_thumb_${pageItem.id}`);
            if (canvas && parentFile) {
              renderMergeThumbnail(parentFile, pageItem.pageNumber, canvas, { maxWidth: 120, maxHeight: 150, rotation: pageRot });
            }
          } else {
            // Blank Page Card - Solid white sheet matching file size, zero text on paper
            const targetW = pageItem.width || 595.28;
            const targetH = pageItem.height || 841.89;
            const aspectRatio = `${Math.round(targetW)} / ${Math.round(targetH)}`;

            pageCard.className = 'page-thumb-card border-2 border-black bg-neutral-100 p-2 relative group flex flex-col justify-between';
            pageCard.innerHTML = `
              <div class="w-full flex items-center justify-between mb-1 pb-1 border-b border-black text-xs font-mono">
                <span class="font-bold text-[10px] border border-black bg-white px-1">[BLANK]</span>
                <span class="font-bold text-[10px] bg-black text-white px-1.5 py-0.2">#${displayPageNum}</span>
                <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button type="button" class="term-btn text-[9px] p-0.5 btn-page-preview" title="Full page preview">👁</button>
                  ${!pageItem.isAutoOddPad ? `<button type="button" class="term-btn text-[9px] p-0.5 btn-page-del" title="Remove blank page">✕</button>` : `<span class="text-[8px] font-bold">[AUTO]</span>`}
                </div>
              </div>
              <div class="relative bg-white border border-neutral-300 shadow-[1px_1px_2px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center overflow-hidden my-1 cursor-pointer page-thumb-preview-trigger group/thumb w-full" style="aspect-ratio: ${aspectRatio}; min-height: 140px; background-color: #ffffff;" title="Click for full page preview">
                <!-- Pure solid white page with NO text on sheet -->
                <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
                  <span class="opacity-0 group-hover/thumb:opacity-100 bg-black text-white text-[8px] font-mono px-1.5 py-0.5 font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">👁 VIEW</span>
                </div>
              </div>
              <div class="text-[10px] text-neutral-500 truncate w-full text-center mt-1 font-mono">
                ${Math.round(targetW)} × ${Math.round(targetH)} pt
              </div>
            `;

            // Preview blank page
            pageCard.querySelector('.btn-page-preview')?.addEventListener('click', (e) => {
              e.stopPropagation();
              openFullPagePreview(index);
            });
            pageCard.querySelector('.page-thumb-preview-trigger')?.addEventListener('click', () => {
              openFullPagePreview(index);
            });

            if (!pageItem.isAutoOddPad) {
              pageCard.querySelector('.btn-page-del')?.addEventListener('click', () => {
                const seqIdx = AppState.mergePageSequence.findIndex((p) => p.id === pageItem.id);
                if (seqIdx !== -1) {
                  AppState.mergePageSequence.splice(seqIdx, 1);
                  AppState.mergeSelectedIds.delete(pageItem.id);
                  syncMergeStateAfterPageChange();
                  renderMergeView();
                  termLog(`Removed blank page #${displayPageNum}.`);
                }
              });
            }
          }

          // Bind Drag and Drop for Page Reordering
          if (!pageItem.isAutoOddPad) {
            setupPageCardDrag(pageCard, index, pageItem.id);
          }

          pagesGrid.appendChild(pageCard);
        });
      }
    }

    updateSelectionCounts();
  }

  // Drag and drop for File Cards in [Files] mode
  function setupFileCardDrag(el, index, fileId) {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(index));
      if (fileId) e.dataTransfer.setData('application/x-file-id', fileId);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-dragging');
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
      document.querySelectorAll('.stacked-paper').forEach((c) => c.classList.remove('drag-target-left', 'drag-target-right'));
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = el.getBoundingClientRect();
      const isLeft = e.clientX < rect.left + rect.width / 2;
      el.classList.toggle('drag-target-left', isLeft);
      el.classList.toggle('drag-target-right', !isLeft);
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-target-left', 'drag-target-right');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-target-left', 'drag-target-right');
      const fromId = e.dataTransfer.getData('application/x-file-id');
      if (fromId && fileId) {
        const fromIndex = AppState.mergeFiles.findIndex((f) => f.id === fromId);
        const toIndex = AppState.mergeFiles.findIndex((f) => f.id === fileId);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          const [moved] = AppState.mergeFiles.splice(fromIndex, 1);
          AppState.mergeFiles.splice(toIndex, 0, moved);
          reorderPageSequenceByFiles();
          renderMergeView();
          termLog(`Reorganized file "${moved.name}" to position #${toIndex + 1}.`);
          return;
        }
      }
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = index;
      if (!isNaN(fromIndex) && fromIndex !== toIndex && fromIndex >= 0 && fromIndex < AppState.mergeFiles.length) {
        const [moved] = AppState.mergeFiles.splice(fromIndex, 1);
        AppState.mergeFiles.splice(toIndex, 0, moved);
        reorderPageSequenceByFiles();
        renderMergeView();
        termLog(`Reorganized file "${moved.name}" to position #${toIndex + 1}.`);
      }
    });
  }

  // Drag and drop for Page Cards in [Pages] mode
  function setupPageCardDrag(el, index, pageId) {
    el.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(index));
      if (pageId) e.dataTransfer.setData('application/x-page-id', pageId);
      e.dataTransfer.effectAllowed = 'move';
      el.classList.add('is-dragging');
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('is-dragging');
      document.querySelectorAll('.page-thumb-card').forEach((c) => c.classList.remove('drag-target-left', 'drag-target-right'));
    });

    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = el.getBoundingClientRect();
      const isLeft = e.clientX < rect.left + rect.width / 2;
      el.classList.toggle('drag-target-left', isLeft);
      el.classList.toggle('drag-target-right', !isLeft);
    });

    el.addEventListener('dragleave', () => {
      el.classList.remove('drag-target-left', 'drag-target-right');
    });

    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drag-target-left', 'drag-target-right');
      const fromId = e.dataTransfer.getData('application/x-page-id');
      if (fromId && pageId) {
        const fromIndex = AppState.mergePageSequence.findIndex((p) => p.id === fromId);
        const toIndex = AppState.mergePageSequence.findIndex((p) => p.id === pageId);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          const [moved] = AppState.mergePageSequence.splice(fromIndex, 1);
          AppState.mergePageSequence.splice(toIndex, 0, moved);
          syncMergeStateAfterPageChange();
          renderMergeView();
          termLog(`Reorganized page to position #${toIndex + 1}.`);
          return;
        }
      }
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = index;
      if (!isNaN(fromIndex) && fromIndex !== toIndex && fromIndex >= 0 && fromIndex < AppState.mergePageSequence.length) {
        const [moved] = AppState.mergePageSequence.splice(fromIndex, 1);
        AppState.mergePageSequence.splice(toIndex, 0, moved);
        syncMergeStateAfterPageChange();
        renderMergeView();
        termLog(`Reorganized page to position #${toIndex + 1}.`);
      }
    });
  }

  // Drag and drop for List Rows in List View
  function setupListRowDrag(row, index, isFilesMode, itemId) {
    row.setAttribute('draggable', 'true');
    row.classList.add('cursor-grab');

    row.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(index));
      if (itemId) e.dataTransfer.setData('application/x-item-id', String(itemId));
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('is-dragging');
    });

    row.addEventListener('dragend', () => {
      row.classList.remove('is-dragging');
      document.querySelectorAll('.merge-list-row').forEach((r) => {
        r.classList.remove('drag-target-top', 'drag-target-bottom');
      });
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = row.getBoundingClientRect();
      const isTop = e.clientY < rect.top + rect.height / 2;
      row.classList.toggle('drag-target-top', isTop);
      row.classList.toggle('drag-target-bottom', !isTop);
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-target-top', 'drag-target-bottom');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drag-target-top', 'drag-target-bottom');
      const fromId = e.dataTransfer.getData('application/x-item-id') || e.dataTransfer.getData('text/plain');
      const toId = itemId;

      if (isFilesMode) {
        const fromIndex = AppState.mergeFiles.findIndex((f) => f.id === fromId);
        const toIndex = AppState.mergeFiles.findIndex((f) => f.id === toId);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          const [moved] = AppState.mergeFiles.splice(fromIndex, 1);
          AppState.mergeFiles.splice(toIndex, 0, moved);
          reorderPageSequenceByFiles();
          renderMergeView();
          termLog(`Reorganized file "${moved.name}" to position #${toIndex + 1}.`);
        }
      } else {
        const fromIndex = AppState.mergePageSequence.findIndex((p) => p.id === fromId);
        const toIndex = AppState.mergePageSequence.findIndex((p) => p.id === toId);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          const [moved] = AppState.mergePageSequence.splice(fromIndex, 1);
          AppState.mergePageSequence.splice(toIndex, 0, moved);
          syncMergeStateAfterPageChange();
          renderMergeView();
          termLog(`Reorganized page to position #${toIndex + 1}.`);
        }
      }
    });
  }

  // ----------------------------------------------------
  // LIST VIEW RENDERER (Supports both Files and Pages modes)
  // ----------------------------------------------------
  function renderMergeListView(isFilesMode, effectivePages) {
    const listTable = document.getElementById('mergeFileListTable');
    if (!listTable) return;
    listTable.innerHTML = '';

    if (isFilesMode) {
      // 1. Table Header for Files Mode
      const header = document.createElement('div');
      header.className = 'grid grid-cols-12 gap-2 p-2.5 bg-neutral-100 font-bold text-[11px] text-neutral-700 font-mono items-center select-none border-b border-black';
      header.innerHTML = `
        <div class="col-span-1 flex items-center justify-center text-center">#</div>
        <div class="col-span-1 flex items-center justify-center">SEL</div>
        <div class="col-span-1 flex items-center justify-center">PREVIEW</div>
        <div class="col-span-4 sm:col-span-5">DOCUMENT NAME / INFO</div>
        <div class="col-span-2 hidden sm:block text-center">PAGES</div>
        <div class="col-span-2 hidden md:block text-center">SIZE</div>
        <div class="col-span-5 sm:col-span-4 md:col-span-2 flex items-center justify-end pr-2">ACTIONS</div>
      `;
      listTable.appendChild(header);

      // 2. File Rows
      AppState.mergeFiles.forEach((fileItem, index) => {
        const isSelected = AppState.mergeSelectedIds.has(fileItem.id);
        const firstPageNum = fileItem.firstActivePageNumber || 1;
        const displayRotation = ((fileItem.rotation || 0) + (fileItem.firstActivePageRotation || 0)) % 360;

        if (fileItem.type === 'blankPage') {
          const row = document.createElement('div');
          row.className = 'merge-list-row grid grid-cols-12 gap-2 p-2.5 items-center bg-white hover:bg-neutral-50 text-xs font-mono transition-none border-b border-neutral-200 select-none group';
          row.dataset.fileId = fileItem.id;
          row.dataset.index = index;

          row.innerHTML = `
            <!-- Order & Drag Handle -->
            <div class="col-span-1 flex items-center justify-center text-neutral-400 group-hover:text-black font-bold cursor-grab" title="Drag to reorder">
              <span class="text-sm mr-1">⠿</span>
              <span class="text-[10px] text-black">#${index + 1}</span>
            </div>

            <!-- Selection Checkbox -->
            <div class="col-span-1 flex items-center justify-center">
              <input type="checkbox" class="w-4 h-4 accent-black cursor-pointer file-select-checkbox" data-file-id="${fileItem.id}" ${isSelected ? 'checked' : ''} />
            </div>

            <!-- Micro Thumbnail Preview (Solid White Sheet) -->
            <div class="col-span-1 flex items-center justify-center">
              <div class="relative w-8 h-11 border border-neutral-300 bg-white flex items-center justify-center cursor-pointer file-list-thumb-trigger group/thumb shadow-[1px_1px_2px_rgba(0,0,0,0.15)]" style="aspect-ratio: ${(fileItem.pageWidth || 595)} / ${(fileItem.pageHeight || 842)}; background-color: #ffffff;" title="Click for full page preview">
                <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/15 flex items-center justify-center pointer-events-none">
                  <span class="opacity-0 group-hover/thumb:opacity-100 text-[8px] bg-black text-white px-0.5 font-bold">👁</span>
                </div>
              </div>
            </div>

            <!-- File Name & Info -->
            <div class="col-span-4 sm:col-span-5 min-w-0 pr-2">
              <div class="font-bold text-neutral-900 truncate flex items-center gap-1.5" title="[Blank Page]">
                <span class="border border-black bg-neutral-200 text-[9px] px-1 py-0.2 shrink-0">[BLANK]</span>
                <span class="truncate">[Blank Page]</span>
              </div>
              <div class="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5 font-mono">
                <span>1 page</span>
                <span>• ${Math.round(fileItem.pageWidth || 595)} × ${Math.round(fileItem.pageHeight || 842)} pt</span>
              </div>
            </div>

            <!-- Page Count Badge (Desktop) -->
            <div class="col-span-2 hidden sm:flex items-center justify-center">
              <span class="border border-black bg-white px-2 py-0.5 text-[10px] font-bold">
                1 PAGE
              </span>
            </div>

            <!-- File Size (Desktop) -->
            <div class="col-span-2 hidden md:flex items-center justify-center text-neutral-400 text-[11px]">
              -
            </div>

            <!-- Action Buttons -->
            <div class="col-span-5 sm:col-span-4 md:col-span-2 flex items-center justify-end gap-1.5 pr-2">
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-file-preview" title="Full Preview">
                <span>👁</span><span class="hidden lg:inline ml-1">VIEW</span>
              </button>
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-file-del hover:bg-black hover:text-white" title="Remove Blank Page">
                <span>✕</span>
              </button>
            </div>
          `;

          row.querySelector('.file-select-checkbox')?.addEventListener('change', (e) => {
            if (e.target.checked) AppState.mergeSelectedIds.add(fileItem.id);
            else AppState.mergeSelectedIds.delete(fileItem.id);
            updateSelectionCounts();
          });

          row.querySelector('.btn-file-preview')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const pageSeqIdx = AppState.mergePageSequence.findIndex((p) => p.fileId === fileItem.id || p.id === fileItem.id);
            openFullPagePreview(pageSeqIdx >= 0 ? pageSeqIdx : 0);
          });
          row.querySelector('.file-list-thumb-trigger')?.addEventListener('click', () => {
            const pageSeqIdx = AppState.mergePageSequence.findIndex((p) => p.fileId === fileItem.id || p.id === fileItem.id);
            openFullPagePreview(pageSeqIdx >= 0 ? pageSeqIdx : 0);
          });

          row.querySelector('.btn-file-del')?.addEventListener('click', () => {
            const fileId = fileItem.id;
            AppState.mergeFiles.splice(index, 1);
            AppState.mergeSelectedIds.delete(fileId);
            AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => p.fileId !== fileId && p.id !== fileId);
            syncMergeStateAfterPageChange();
            renderMergeView();
            termLog('Removed blank page from queue.');
          });

          setupListRowDrag(row, index, true, fileItem.id);
          listTable.appendChild(row);
        } else {
          // Standard PDF File Row
          const row = document.createElement('div');
          row.className = 'merge-list-row grid grid-cols-12 gap-2 p-2.5 items-center bg-white hover:bg-neutral-50 text-xs font-mono transition-none border-b border-neutral-200 select-none group';
          row.dataset.fileId = fileItem.id;
          row.dataset.index = index;

          row.innerHTML = `
            <!-- Order & Drag Handle -->
            <div class="col-span-1 flex items-center justify-center text-neutral-400 group-hover:text-black font-bold cursor-grab" title="Drag to reorder">
              <span class="text-sm mr-1">⠿</span>
              <span class="text-[10px] text-black">#${index + 1}</span>
            </div>

            <!-- Selection Checkbox -->
            <div class="col-span-1 flex items-center justify-center">
              <input type="checkbox" class="w-4 h-4 accent-black cursor-pointer file-select-checkbox" data-file-id="${fileItem.id}" ${isSelected ? 'checked' : ''} />
            </div>

            <!-- Micro Thumbnail Preview (Clickable for full preview) -->
            <div class="col-span-1 flex items-center justify-center">
              <div class="relative w-9 h-11 border border-black bg-neutral-100 flex items-center justify-center cursor-pointer file-list-thumb-trigger group/thumb overflow-hidden shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" title="Click for full page preview">
                <canvas id="file_list_thumb_${fileItem.id}"></canvas>
                <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/15 flex items-center justify-center pointer-events-none">
                  <span class="opacity-0 group-hover/thumb:opacity-100 text-[8px] bg-black text-white px-0.5 font-bold">👁</span>
                </div>
              </div>
            </div>

            <!-- File Name & Info -->
            <div class="col-span-4 sm:col-span-5 min-w-0 pr-2">
              <div class="font-bold text-neutral-900 truncate flex items-center gap-1.5" title="${fileItem.name}">
                <span class="border border-black bg-neutral-100 text-[9px] px-1 py-0.2 shrink-0">PDF</span>
                <span class="truncate">${fileItem.name}</span>
              </div>
              <div class="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                <span>${fileItem.pageCount} page${fileItem.pageCount === 1 ? '' : 's'}</span>
                ${displayRotation ? `<span class="bg-black text-white px-1 font-bold">+${displayRotation}°</span>` : ''}
                <span class="sm:hidden font-mono">• ${Converters.formatBytes(fileItem.size)}</span>
              </div>
            </div>

            <!-- Page Count Badge (Desktop) -->
            <div class="col-span-2 hidden sm:flex items-center justify-center">
              <span class="border border-black bg-white px-2 py-0.5 text-[10px] font-bold">
                ${fileItem.pageCount} ${fileItem.pageCount === 1 ? 'PAGE' : 'PAGES'}
              </span>
            </div>

            <!-- File Size (Desktop) -->
            <div class="col-span-2 hidden md:flex items-center justify-center text-neutral-600 text-[11px]">
              ${Converters.formatBytes(fileItem.size)}
            </div>

            <!-- Action Buttons -->
            <div class="col-span-5 sm:col-span-4 md:col-span-2 flex items-center justify-end gap-1.5 pr-2">
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-file-preview" title="Full Preview">
                <span>👁</span><span class="hidden lg:inline ml-1">VIEW</span>
              </button>
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-file-rot" title="Rotate Document +90°">
                <span>↷</span>
              </button>
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-file-del hover:bg-black hover:text-white" title="Remove File">
                <span>✕</span>
              </button>
            </div>
          `;

          // Checkbox event
          row.querySelector('.file-select-checkbox')?.addEventListener('change', (e) => {
            if (e.target.checked) AppState.mergeSelectedIds.add(fileItem.id);
            else AppState.mergeSelectedIds.delete(fileItem.id);
            updateSelectionCounts();
          });

          // Rotate event
          row.querySelector('.btn-file-rot')?.addEventListener('click', () => {
            fileItem.rotation = (fileItem.rotation + 90) % 360;
            renderMergeView();
            termLog(`Rotated "${fileItem.name}" to ${fileItem.rotation}°.`);
          });

          // Delete event
          row.querySelector('.btn-file-del')?.addEventListener('click', () => {
            const fileId = fileItem.id;
            AppState.mergeFiles.splice(index, 1);
            AppState.mergeSelectedIds.delete(fileId);
            AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => p.fileId !== fileId);
            syncMergeStateAfterPageChange();
            renderMergeView();
            termLog(`Removed "${fileItem.name}" from queue.`);
          });

          // Full Preview triggers
          row.querySelector('.btn-file-preview')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openFullFilePreview(fileItem, firstPageNum);
          });
          row.querySelector('.file-list-thumb-trigger')?.addEventListener('click', () => {
            openFullFilePreview(fileItem, firstPageNum);
          });

          // Drag to reorder
          setupListRowDrag(row, index, true, fileItem.id);
          listTable.appendChild(row);

          // Render micro thumbnail
          const canvas = row.querySelector(`#file_list_thumb_${fileItem.id}`);
          if (canvas) {
            renderMergeThumbnail(fileItem, firstPageNum, canvas, { maxWidth: 36, maxHeight: 48, rotation: displayRotation });
          }
        }
      });

      // Quick-add row at bottom
      const addRow = document.createElement('div');
      addRow.className = 'p-3 bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center gap-2 cursor-pointer font-bold text-xs select-none transition-none';
      addRow.innerHTML = `
        <span class="w-5 h-5 rounded-full border border-black flex items-center justify-center bg-white text-xs">+</span>
        <span>ADD MORE PDF OR IMAGE FILES</span>
      `;
      addRow.addEventListener('click', () => {
        document.getElementById('mergeFileInput')?.click();
      });
      listTable.appendChild(addRow);

    } else {
      // ----------------------------------------------------
      // Pages Mode List View
      // ----------------------------------------------------
      const header = document.createElement('div');
      header.className = 'grid grid-cols-12 gap-2 p-2.5 bg-neutral-100 font-bold text-[11px] text-neutral-700 font-mono items-center select-none border-b border-black';
      header.innerHTML = `
        <div class="col-span-1 flex items-center justify-center text-center">#</div>
        <div class="col-span-1 flex items-center justify-center">SEL</div>
        <div class="col-span-1 flex items-center justify-center">PAGE</div>
        <div class="col-span-4 sm:col-span-5">SOURCE FILE / NOTE</div>
        <div class="col-span-2 hidden sm:block text-center">POSITION</div>
        <div class="col-span-2 hidden md:block text-center">ROTATION</div>
        <div class="col-span-5 sm:col-span-4 md:col-span-2 flex items-center justify-end pr-2">ACTIONS</div>
      `;
      listTable.appendChild(header);

      effectivePages.forEach((pageItem, index) => {
        const isPdfPage = pageItem.type === 'pdfPage';
        const displayPageNum = index + 1;
        const parentFile = isPdfPage ? AppState.mergeFiles.find((f) => f.id === pageItem.fileId) : null;
        const pageRot = isPdfPage ? ((parentFile?.rotation || 0) + (pageItem.rotation || 0)) % 360 : 0;
        const isSelected = AppState.mergeSelectedIds.has(pageItem.id);

        const row = document.createElement('div');
        row.className = `merge-list-row grid grid-cols-12 gap-2 p-2.5 items-center ${pageItem.isAutoOddPad ? 'bg-neutral-100/70' : 'bg-white hover:bg-neutral-50'} text-xs font-mono transition-none border-b border-neutral-200 select-none group`;
        row.dataset.pageId = pageItem.id;
        row.dataset.index = index;

        if (isPdfPage) {
          row.innerHTML = `
            <!-- Order & Drag Handle -->
            <div class="col-span-1 flex items-center justify-center text-neutral-400 group-hover:text-black font-bold cursor-grab" title="Drag to reorder">
              <span class="text-sm mr-1">⠿</span>
              <span class="text-[10px] text-black">#${displayPageNum}</span>
            </div>

            <!-- Checkbox -->
            <div class="col-span-1 flex items-center justify-center">
              <input type="checkbox" class="w-4 h-4 accent-black cursor-pointer page-select-checkbox" data-page-id="${pageItem.id}" ${isSelected ? 'checked' : ''} />
            </div>

            <!-- Micro Thumbnail -->
            <div class="col-span-1 flex items-center justify-center">
              <div class="relative w-9 h-11 border border-black bg-neutral-100 flex items-center justify-center cursor-pointer page-list-thumb-trigger group/thumb overflow-hidden shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]" title="Click for full page preview">
                <canvas id="page_list_thumb_${pageItem.id}"></canvas>
                <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/15 flex items-center justify-center pointer-events-none">
                  <span class="opacity-0 group-hover/thumb:opacity-100 text-[8px] bg-black text-white px-0.5 font-bold">👁</span>
                </div>
              </div>
            </div>

            <!-- Source Document & Page -->
            <div class="col-span-4 sm:col-span-5 min-w-0 pr-2">
              <div class="font-bold text-neutral-900 truncate" title="${pageItem.fileName}">
                ${pageItem.fileName}
              </div>
              <div class="text-[10px] text-neutral-500 flex items-center gap-2 mt-0.5">
                <span>Original Page ${pageItem.pageNumber}</span>
                ${pageRot ? `<span class="bg-black text-white px-1 font-bold">+${pageRot}°</span>` : ''}
              </div>
            </div>

            <!-- Position Badge (Desktop) -->
            <div class="col-span-2 hidden sm:flex items-center justify-center">
              <span class="border border-black bg-black text-white px-2 py-0.5 text-[10px] font-bold">
                PAGE #${displayPageNum}
              </span>
            </div>

            <!-- Rotation Info (Desktop) -->
            <div class="col-span-2 hidden md:flex items-center justify-center text-neutral-600 text-[11px]">
              ${pageRot}°
            </div>

            <!-- Action Buttons -->
            <div class="col-span-5 sm:col-span-4 md:col-span-2 flex items-center justify-end gap-1.5 pr-2">
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-page-preview" title="Full Preview">
                <span>👁</span><span class="hidden lg:inline ml-1">VIEW</span>
              </button>
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-page-rot" title="Rotate Page +90°">
                <span>↷</span>
              </button>
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-page-del hover:bg-black hover:text-white" title="Remove Page">
                <span>✕</span>
              </button>
            </div>
          `;

          // Checkbox event
          row.querySelector('.page-select-checkbox').addEventListener('change', (e) => {
            if (e.target.checked) AppState.mergeSelectedIds.add(pageItem.id);
            else AppState.mergeSelectedIds.delete(pageItem.id);
            updateSelectionCounts();
          });

          // Rotate event
          row.querySelector('.btn-page-rot').addEventListener('click', () => {
            pageItem.rotation = ((pageItem.rotation || 0) + 90) % 360;
            syncMergeStateAfterPageChange();
            renderMergeView();
            termLog(`Rotated page #${displayPageNum} to ${pageItem.rotation}°.`);
          });

          // Delete event
          row.querySelector('.btn-page-del').addEventListener('click', () => {
            const seqIdx = AppState.mergePageSequence.findIndex((p) => p.id === pageItem.id);
            if (seqIdx !== -1) {
              const [deleted] = AppState.mergePageSequence.splice(seqIdx, 1);
              AppState.mergeSelectedIds.delete(pageItem.id);
              syncMergeStateAfterPageChange();
              renderMergeView();
              termLog(`Removed page #${displayPageNum} (${deleted.fileName} p.${deleted.pageNumber}). File preview updated.`);
            }
          });

          // Full preview triggers
          row.querySelector('.btn-page-preview').addEventListener('click', (e) => {
            e.stopPropagation();
            openFullPagePreview(index);
          });
          row.querySelector('.page-list-thumb-trigger').addEventListener('click', () => {
            openFullPagePreview(index);
          });

          // Drag to reorder
          setupListRowDrag(row, index, false, pageItem.id);

          listTable.appendChild(row);

          // Render thumbnail
          const canvas = row.querySelector(`#page_list_thumb_${pageItem.id}`);
          if (canvas && parentFile) {
            renderMergeThumbnail(parentFile, pageItem.pageNumber, canvas, { maxWidth: 36, maxHeight: 48, rotation: pageRot });
          }

        } else {
          // Blank Page row
          row.innerHTML = `
            <!-- Order & Drag Handle -->
            <div class="col-span-1 flex items-center justify-center text-neutral-400 group-hover:text-black font-bold ${pageItem.isAutoOddPad ? '' : 'cursor-grab'}" title="${pageItem.isAutoOddPad ? 'Auto-rule inserted' : 'Drag to reorder'}">
              <span class="text-sm mr-1">${pageItem.isAutoOddPad ? '•' : '⠿'}</span>
              <span class="text-[10px] text-black">#${displayPageNum}</span>
            </div>

            <!-- Checkbox -->
            <div class="col-span-1 flex items-center justify-center">
              ${!pageItem.isAutoOddPad ? `<input type="checkbox" class="w-4 h-4 accent-black cursor-pointer page-select-checkbox" data-page-id="${pageItem.id}" ${isSelected ? 'checked' : ''} />` : `<span class="text-[9px] text-neutral-400">-</span>`}
            </div>

            <!-- Blank Box Thumbnail (Solid White, No Text) -->
            <div class="col-span-1 flex items-center justify-center">
              <div class="relative w-8 h-11 border border-neutral-300 bg-white flex flex-col items-center justify-center cursor-pointer page-list-thumb-trigger group/thumb shadow-[1px_1px_2px_rgba(0,0,0,0.15)]" style="aspect-ratio: ${(pageItem.width || 595)} / ${(pageItem.height || 842)}; background-color: #ffffff;" title="Click for full page preview">
                <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 flex items-center justify-center pointer-events-none">
                  <span class="opacity-0 group-hover/thumb:opacity-100 text-[8px] bg-black text-white px-0.5 font-bold">👁</span>
                </div>
              </div>
            </div>

            <!-- Info -->
            <div class="col-span-4 sm:col-span-5 min-w-0 pr-2">
              <div class="font-bold text-neutral-900 flex items-center gap-1.5">
                <span class="border border-black bg-neutral-200 text-[9px] px-1 py-0.2">[BLANK PAGE]</span>
                <span class="text-xs font-mono text-neutral-600">${Math.round(pageItem.width || 595)} × ${Math.round(pageItem.height || 842)} pt</span>
              </div>
              <div class="text-[10px] text-neutral-500 mt-0.5 font-mono">
                ${pageItem.isAutoOddPad ? 'Rule: Odd Page Blank (Auto-inserted)' : 'Manual Blank Page (All White)'}
              </div>
            </div>

            <!-- Position Badge -->
            <div class="col-span-2 hidden sm:flex items-center justify-center">
              <span class="border border-dashed border-black bg-white px-2 py-0.5 text-[10px] font-bold">
                PAGE #${displayPageNum}
              </span>
            </div>

            <!-- Rotation -->
            <div class="col-span-2 hidden md:flex items-center justify-center text-neutral-400 text-[11px]">
              -
            </div>

            <!-- Action Buttons -->
            <div class="col-span-5 sm:col-span-4 md:col-span-2 flex items-center justify-end gap-1.5 pr-2">
              <button type="button" class="term-btn text-[10px] p-1 px-2 btn-page-preview" title="Full Preview">
                <span>👁</span><span class="hidden lg:inline ml-1">VIEW</span>
              </button>
              ${!pageItem.isAutoOddPad ? `
                <button type="button" class="term-btn text-[10px] p-1 px-2 btn-page-del hover:bg-black hover:text-white" title="Remove Blank Page">
                  <span>✕</span>
                </button>
              ` : `
                <span class="border border-neutral-300 text-[9px] font-bold px-1.5 py-0.5 text-neutral-500 bg-neutral-100">[AUTO]</span>
              `}
            </div>
          `;

          // Preview triggers
          row.querySelector('.btn-page-preview')?.addEventListener('click', (e) => {
            e.stopPropagation();
            openFullPagePreview(index);
          });
          row.querySelector('.page-list-thumb-trigger')?.addEventListener('click', () => {
            openFullPagePreview(index);
          });

          // Checkbox & delete event
          if (!pageItem.isAutoOddPad) {
            row.querySelector('.page-select-checkbox')?.addEventListener('change', (e) => {
              if (e.target.checked) AppState.mergeSelectedIds.add(pageItem.id);
              else AppState.mergeSelectedIds.delete(pageItem.id);
              updateSelectionCounts();
            });

            row.querySelector('.btn-page-del')?.addEventListener('click', () => {
              const seqIdx = AppState.mergePageSequence.findIndex((p) => p.id === pageItem.id);
              if (seqIdx !== -1) {
                AppState.mergePageSequence.splice(seqIdx, 1);
                AppState.mergeSelectedIds.delete(pageItem.id);
                syncMergeStateAfterPageChange();
                renderMergeView();
                termLog(`Removed blank page #${displayPageNum}.`);
              }
            });

            setupListRowDrag(row, index, false, pageItem.id);
          }

          listTable.appendChild(row);
        }
      });

      // Quick add blank page button at bottom
      const addBlankRow = document.createElement('div');
      addBlankRow.className = 'p-3 bg-neutral-50 hover:bg-neutral-100 flex items-center justify-center gap-2 cursor-pointer font-bold text-xs select-none transition-none';
      addBlankRow.innerHTML = `
        <span class="w-5 h-5 rounded-full border border-black flex items-center justify-center bg-white text-xs">+</span>
        <span>INSERT BLANK PAGE</span>
      `;
      addBlankRow.addEventListener('click', () => {
        addMergeBlankPage();
      });
      listTable.appendChild(addBlankRow);
    }
  }

  // Update selection count badge and master checkbox
  function updateSelectionCounts() {
    const selectedCount = document.getElementById('mergeSelectedCount');
    const selectAllCheckbox = document.getElementById('mergeSelectAll');
    const count = AppState.mergeSelectedIds.size;
    if (selectedCount) {
      selectedCount.textContent = `(${count} selected)`;
    }

    if (selectAllCheckbox) {
      const isFiles = AppState.mergeViewMode === 'files';
      const totalItems = isFiles ? AppState.mergeFiles.length : AppState.mergePageSequence.length;
      selectAllCheckbox.checked = totalItems > 0 && count === totalItems;
    }
  }

  // Rotate selected files or pages
  function rotateMergeSelection(delta) {
    if (AppState.mergeSelectedIds.size === 0) {
      termLog('No items selected to rotate.', 'warn');
      return;
    }

    if (AppState.mergeViewMode === 'files') {
      AppState.mergeFiles.forEach((file) => {
        if (AppState.mergeSelectedIds.has(file.id)) {
          file.rotation = (file.rotation + delta + 360) % 360;
        }
      });
      termLog(`Rotated ${AppState.mergeSelectedIds.size} selected file(s) by ${delta > 0 ? '+' : ''}${delta}°.`);
    } else {
      AppState.mergePageSequence.forEach((page) => {
        if (AppState.mergeSelectedIds.has(page.id)) {
          page.rotation = (page.rotation + delta + 360) % 360;
          const parentFile = AppState.mergeFiles.find((f) => f.id === page.fileId);
          if (parentFile && parentFile.firstActivePageNumber === page.pageNumber) {
            parentFile.firstActivePageRotation = page.rotation;
          }
        }
      });
      termLog(`Rotated ${AppState.mergeSelectedIds.size} selected page(s) by ${delta > 0 ? '+' : ''}${delta}°.`);
    }

    renderMergeView();
  }

  // Delete selected files or pages (keeps Files and Pages views in complete sync)
  function deleteMergeSelection() {
    if (AppState.mergeSelectedIds.size === 0) {
      termLog('No items selected to delete.', 'warn');
      return;
    }

    const count = AppState.mergeSelectedIds.size;

    if (AppState.mergeViewMode === 'files') {
      const deletedFileIds = new Set(AppState.mergeSelectedIds);
      AppState.mergeFiles = AppState.mergeFiles.filter((f) => !deletedFileIds.has(f.id));
      AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => !deletedFileIds.has(p.fileId));
      termLog(`Deleted ${count} file(s) and their pages from merge queue.`);
    } else {
      const deletedPageIds = new Set(AppState.mergeSelectedIds);
      AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => !deletedPageIds.has(p.id));
      syncMergeStateAfterPageChange();
      termLog(`Deleted ${count} page(s) from document sequence. File preview updated.`);
    }

    AppState.mergeSelectedIds.clear();
    renderMergeView();
  }

  // Show inline popover to insert file or blank page at specific index
  function showInlineInsertMenu(anchorEl, insertIndex) {
    const existing = document.getElementById('inlineInsertPopover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.id = 'inlineInsertPopover';
    popover.className = 'absolute bg-white border border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] p-1 z-50 flex flex-col gap-1 w-44 font-mono text-xs';
    popover.style.top = '30px';
    popover.style.left = '50%';
    popover.style.transform = 'translateX(-50%)';

    popover.innerHTML = `
      <button type="button" class="term-btn text-[11px] py-1 text-left w-full justify-start btn-pop-file">+ Insert PDF File</button>
      <button type="button" class="term-btn text-[11px] py-1 text-left w-full justify-start btn-pop-blank">+ Insert Blank Page</button>
    `;

    popover.querySelector('.btn-pop-file').addEventListener('click', () => {
      popover.remove();
      AppState._insertFileAtIndex = insertIndex;
      const input = document.getElementById('mergeFileInput');
      if (input) input.click();
    });

    popover.querySelector('.btn-pop-blank').addEventListener('click', () => {
      popover.remove();
      addMergeBlankPage(insertIndex, true);
    });

    anchorEl.parentElement.appendChild(popover);

    const onDocClick = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorEl) {
        popover.remove();
        document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 50);
  }

  // Execute Merge Operation
  async function processMerge() {
    if (AppState.mergeFiles.length === 0) {
      termLog('At least 1 file is required to merge.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessMerge');
    if (btn) btn.disabled = true;

    const effectivePages = getEffectivePageList();
    termLog(`Compiling PDF document with ${effectivePages.length} total page(s)...`);

    try {
      let mergedBytes;

      // Use custom page sequence merger
      const pageItems = effectivePages.map((item) => {
        if (item.type === 'blankPage') {
          let w = item.width;
          let h = item.height;
          if (!w || !h) {
            const f = AppState.mergeFiles[0];
            if (f && f.pageWidth && f.pageHeight) {
              w = f.pageWidth;
              h = f.pageHeight;
            } else {
              w = 595.28;
              h = 841.89;
            }
          }
          return { type: 'blankPage', width: w, height: h };
        }
        const file = AppState.mergeFiles.find((f) => f.id === item.fileId);
        return {
          type: 'pdfPage',
          buffer: file ? file.buffer.slice(0) : item.buffer.slice(0),
          pageIndex: item.pageIndex,
          rotation: (file?.rotation || 0) + (item.rotation || 0)
        };
      });

      mergedBytes = await PdfTools.mergeCustomPages(pageItems, {}, (curr, total, msg) => {
        termLog(msg);
      });

      const isOrganize = document.body.dataset.page === 'organize';
      const defaultName = isOrganize ? `anixss_organized_${Date.now()}.pdf` : `anixss_merged_${Date.now()}.pdf`;
      const filename = getCustomFilename('mergeOutputFilename', defaultName);
      const blob = new Blob([mergedBytes], { type: 'application/pdf' });

      showResultModal(
        blob,
        filename,
        'pdf',
        `${AppState.mergeFiles.length} file(s) // ${effectivePages.length} page(s) // ${Converters.formatBytes(blob.size)}`
      );
      termLog(
        isOrganize
          ? `Pages organized! Saved as ${filename} (${effectivePages.length} pages, ${Converters.formatBytes(blob.size)})`
          : `Merge complete! Saved as ${filename} (${effectivePages.length} pages, ${Converters.formatBytes(blob.size)})`,
        'success'
      );
    } catch (e) {
      termLog(`Merge failed: ${e.message}`, 'error');
      alert(`Merge Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // FULL PAGE PREVIEW MODAL CONTROLLER
  // ==========================================

  const PagePreviewModal = {
    isOpen: false,
    mode: 'page', // 'page', 'file', or 'doc'
    activeFile: null,
    activeDoc: null,
    docTitle: 'Document Preview',
    activePageIndex: 0, // 0-indexed in effectivePages or doc
    totalPages: 1,
    zoomScale: 0.75,
    rotationDelta: 0
  };

  async function openDocumentPreview(source, title = 'Document Preview', startPage = 1) {
    if (!source) {
      termLog('No document source provided to preview.', 'warn');
      return;
    }

    ensurePreviewModalInDOM();

    let pdfDoc = null;
    const spinner = document.getElementById('previewLoadingSpinner');
    if (spinner) spinner.classList.remove('hidden');

    try {
      if (source && typeof source.getPage === 'function') {
        pdfDoc = source;
      } else if (source instanceof Blob) {
        const buf = await source.arrayBuffer();
        pdfDoc = await PdfPreview.loadDocument(buf);
      } else if (source instanceof Uint8Array || source instanceof ArrayBuffer) {
        pdfDoc = await PdfPreview.loadDocument(source.slice(0));
      } else {
        termLog('Unsupported document preview source.', 'error');
        if (spinner) spinner.classList.add('hidden');
        return;
      }
    } catch (err) {
      termLog(`Failed to load document for preview: ${err.message}`, 'error');
      alert(`Preview Error: ${err.message}`);
      if (spinner) spinner.classList.add('hidden');
      return;
    }

    if (!pdfDoc || !pdfDoc.numPages) {
      termLog('Document has no pages to preview.', 'warn');
      if (spinner) spinner.classList.add('hidden');
      return;
    }

    PagePreviewModal.isOpen = true;
    PagePreviewModal.mode = 'doc';
    PagePreviewModal.activeFile = null;
    PagePreviewModal.activeDoc = pdfDoc;
    PagePreviewModal.docTitle = title || 'Document Preview';
    PagePreviewModal.activePageIndex = Math.max(0, Math.min(startPage - 1, pdfDoc.numPages - 1));
    PagePreviewModal.totalPages = pdfDoc.numPages;
    PagePreviewModal.zoomScale = 0.75;
    PagePreviewModal.rotationDelta = 0;

    const modal = document.getElementById('pagePreviewModal');
    if (modal) {
      modal.style.zIndex = '100';
      modal.classList.remove('hidden');
    }
    await renderFullPreviewContent();
    termLog(`Opened preview for "${title}" (${pdfDoc.numPages} page(s)).`, 'success');
  }

  function openFullFilePreview(fileItem, startPageNum = 1) {
    if (!fileItem) return;

    if (fileItem.type === 'blankPage') {
      const pageSeqIdx = AppState.mergePageSequence.findIndex((p) => p.fileId === fileItem.id || p.id === fileItem.id);
      openFullPagePreview(pageSeqIdx >= 0 ? pageSeqIdx : 0);
      return;
    }

    // Filter active pages belonging to this file from AppState.mergePageSequence
    const filePages = AppState.mergePageSequence.filter((p) => p.type === 'pdfPage' && p.fileId === fileItem.id);
    if (filePages.length === 0) {
      termLog(`No active pages remaining in "${fileItem.name}".`, 'warn');
      return;
    }

    let startIdx = filePages.findIndex((p) => p.pageNumber === startPageNum);
    if (startIdx === -1) startIdx = 0;

    ensurePreviewModalInDOM();
    PagePreviewModal.isOpen = true;
    PagePreviewModal.mode = 'file';
    PagePreviewModal.activeFile = fileItem;
    PagePreviewModal.activeDoc = null;
    PagePreviewModal.docTitle = fileItem.name;
    PagePreviewModal.activePageIndex = startIdx; // 0-indexed in active filePages
    PagePreviewModal.totalPages = filePages.length;
    PagePreviewModal.zoomScale = 0.75;
    PagePreviewModal.rotationDelta = 0;

    const modal = document.getElementById('pagePreviewModal');
    if (modal) {
      modal.style.zIndex = '100';
      modal.classList.remove('hidden');
    }
    renderFullPreviewContent();
    termLog(`Opened preview for file "${fileItem.name}" (${filePages.length} active page(s)).`);
  }

  function openFullPagePreview(effectiveIndex = 0) {
    const effectivePages = getEffectivePageList();
    if (!effectivePages || effectivePages.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(effectiveIndex, effectivePages.length - 1));

    ensurePreviewModalInDOM();
    PagePreviewModal.isOpen = true;
    PagePreviewModal.mode = 'page';
    PagePreviewModal.activeFile = null;
    PagePreviewModal.activeDoc = null;
    PagePreviewModal.activePageIndex = clampedIndex;
    PagePreviewModal.totalPages = effectivePages.length;
    PagePreviewModal.zoomScale = 0.75;
    PagePreviewModal.rotationDelta = 0;

    const modal = document.getElementById('pagePreviewModal');
    if (modal) {
      modal.style.zIndex = '100';
      modal.classList.remove('hidden');
    }
    renderFullPreviewContent();
    termLog(`Opened full preview for page #${clampedIndex + 1} of ${effectivePages.length}.`);
  }

  function closeFullPreview() {
    PagePreviewModal.isOpen = false;
    const modal = document.getElementById('pagePreviewModal');
    if (modal) modal.classList.add('hidden');
    const canvas = document.getElementById('previewFullCanvas');
    if (canvas && canvas._renderTask) {
      try { canvas._renderTask.cancel(); } catch (e) {}
      canvas._renderTask = null;
    }
  }

  async function renderFullPreviewContent() {
    if (!PagePreviewModal.isOpen) return;

    const modalTitle = document.getElementById('previewModalTitle');
    const modalBadge = document.getElementById('previewModalBadge');
    const pageIndicator = document.getElementById('previewPageIndicator');
    const zoomLevelEl = document.getElementById('previewZoomLevel');
    const btnPrev = document.getElementById('btnPreviewPrevPage');
    const btnNext = document.getElementById('btnPreviewNextPage');
    const spinner = document.getElementById('previewLoadingSpinner');
    const canvas = document.getElementById('previewFullCanvas');

    if (zoomLevelEl) {
      zoomLevelEl.textContent = `${Math.round(PagePreviewModal.zoomScale * 100)}%`;
    }

    if (PagePreviewModal.mode === 'doc') {
      const doc = PagePreviewModal.activeDoc;
      if (!doc) {
        closeFullPreview();
        return;
      }

      const total = PagePreviewModal.totalPages || doc.numPages;
      const activeIdx = Math.max(0, Math.min(PagePreviewModal.activePageIndex, total - 1));
      PagePreviewModal.activePageIndex = activeIdx;
      PagePreviewModal.totalPages = total;

      if (modalTitle) modalTitle.textContent = PagePreviewModal.docTitle || 'Document Preview';
      if (modalBadge) modalBadge.textContent = `PAGE ${activeIdx + 1} / ${total}`;
      if (pageIndicator) {
        pageIndicator.textContent = `PAGE ${activeIdx + 1} OF ${total}`;
      }

      if (btnPrev) btnPrev.disabled = activeIdx <= 0;
      if (btnNext) btnNext.disabled = activeIdx >= total - 1;

      await renderModalDocCanvas(doc, activeIdx + 1, canvas, PagePreviewModal.rotationDelta, spinner);
    } else if (PagePreviewModal.mode === 'file') {
      const file = PagePreviewModal.activeFile;
      const filePages = AppState.mergePageSequence.filter((p) => p.type === 'pdfPage' && p.fileId === file.id);
      const total = filePages.length;
      if (total === 0) {
        closeFullPreview();
        return;
      }

      const activeIdx = Math.max(0, Math.min(PagePreviewModal.activePageIndex, total - 1));
      PagePreviewModal.activePageIndex = activeIdx;
      PagePreviewModal.totalPages = total;
      const currentPageItem = filePages[activeIdx];

      if (modalTitle) modalTitle.textContent = file.name;
      if (modalBadge) modalBadge.textContent = `PAGE ${activeIdx + 1} / ${total}`;
      if (pageIndicator) {
        pageIndicator.textContent = `PAGE ${activeIdx + 1} OF ${total} (Source p.${currentPageItem.pageNumber})`;
      }

      if (btnPrev) btnPrev.disabled = activeIdx <= 0;
      if (btnNext) btnNext.disabled = activeIdx >= total - 1;

      const totalRot = ((file.rotation || 0) + (currentPageItem.rotation || 0) + PagePreviewModal.rotationDelta + 360) % 360;
      await renderModalCanvas(file, currentPageItem.pageNumber, canvas, totalRot, spinner);
    } else if (PagePreviewModal.mode === 'addPage') {
      const idx = PagePreviewModal.activePageIndex; // 0-indexed
      const pageItem = AppState.addPages[idx];
      const total = AppState.addPages.length;

      if (!pageItem) return;

      if (modalTitle) {
        modalTitle.textContent = pageItem.type === 'blankPage'
          ? `Blank Page (${Math.round(pageItem.width || 595)} × ${Math.round(pageItem.height || 842)} pt)`
          : (pageItem.fileName || 'Page Preview');
      }
      if (modalBadge) modalBadge.textContent = `PAGE ${idx + 1} / ${total}`;
      if (pageIndicator) {
        pageIndicator.textContent = `PAGE ${idx + 1} OF ${total}${pageItem.type === 'blankPage' ? ' (Blank Page - Solid White)' : (pageItem.pageNumber ? ` (${pageItem.fileName} p.${pageItem.pageNumber})` : '')}`;
      }

      if (btnPrev) btnPrev.disabled = idx <= 0;
      if (btnNext) btnNext.disabled = idx >= total - 1;

      if (pageItem.type === 'blankPage') {
        drawModalBlankCanvas(canvas, idx + 1, pageItem);
        if (spinner) spinner.classList.add('hidden');
      } else {
        const rot = ((pageItem.rotation || 0) + PagePreviewModal.rotationDelta + 360) % 360;
        await renderModalDocCanvas(pageItem.pdfDoc, pageItem.pageNumber, canvas, rot, spinner);
      }
    } else {
      const effectivePages = getEffectivePageList();
      const idx = PagePreviewModal.activePageIndex; // 0-indexed
      const pageItem = effectivePages[idx];
      const total = effectivePages.length;

      if (!pageItem) return;

      if (modalTitle) {
        modalTitle.textContent = pageItem.type === 'blankPage'
          ? `Blank Page (${Math.round(pageItem.width || 595)} × ${Math.round(pageItem.height || 842)} pt)`
          : (pageItem.fileName || 'Page Preview');
      }
      if (modalBadge) modalBadge.textContent = `PAGE ${idx + 1} / ${total}`;
      if (pageIndicator) {
        pageIndicator.textContent = `PAGE ${idx + 1} OF ${total}${pageItem.type === 'blankPage' ? ' (Blank Page - Solid White)' : (pageItem.pageNumber ? ` (${pageItem.fileName || ''} p.${pageItem.pageNumber})` : '')}`;
      }

      if (btnPrev) btnPrev.disabled = idx <= 0;
      if (btnNext) btnNext.disabled = idx >= total - 1;

      if (pageItem.type === 'blankPage') {
        drawModalBlankCanvas(canvas, idx + 1, pageItem);
        if (spinner) spinner.classList.add('hidden');
      } else {
        const parentFile = AppState.mergeFiles.find((f) => f.id === pageItem.fileId);
        const rot = ((pageItem.rotation || 0) + (parentFile?.rotation || 0) + PagePreviewModal.rotationDelta) % 360;
        await renderModalCanvas(parentFile, pageItem.pageNumber, canvas, rot, spinner);
      }
    }
  }

  async function renderModalDocCanvas(doc, pageNum, canvas, rotation, spinner) {
    if (!canvas || !doc) return;
    if (spinner) spinner.classList.remove('hidden');

    const container = document.getElementById('previewCanvasContainer');
    const containerW = container ? Math.max(200, container.clientWidth - 24) : 800;
    const containerH = container ? Math.max(200, container.clientHeight - 24) : 800;

    const baseScale = Math.min(containerW / 612, containerH / 792) * 1.4;
    const finalScale = Math.max(0.35, baseScale * PagePreviewModal.zoomScale);

    try {
      await PdfPreview.renderPageToCanvas(doc, pageNum, canvas, {
        scale: finalScale,
        rotation: (rotation + 360) % 360
      });
    } catch (err) {
      PdfPreview.drawFallbackPage(canvas, pageNum, PagePreviewModal.docTitle || 'Document', rotation, {
        maxWidth: containerW * 0.75,
        maxHeight: containerH * 0.75
      });
    }

    if (spinner) spinner.classList.add('hidden');
  }

  async function renderModalCanvas(fileItem, pageNum, canvas, rotation, spinner) {
    if (!canvas) return;
    if (spinner) spinner.classList.remove('hidden');

    const container = document.getElementById('previewCanvasContainer');
    const containerW = container ? Math.max(200, container.clientWidth - 24) : 800;
    const containerH = container ? Math.max(200, container.clientHeight - 24) : 800;

    const baseScale = Math.min(containerW / 612, containerH / 792) * 1.4;
    const finalScale = Math.max(0.35, baseScale * PagePreviewModal.zoomScale);

    if (fileItem && fileItem.pdfDoc) {
      try {
        await PdfPreview.renderPageToCanvas(fileItem.pdfDoc, pageNum, canvas, {
          scale: finalScale,
          rotation: (rotation + 360) % 360
        });
      } catch (err) {
        PdfPreview.drawFallbackPage(canvas, pageNum, fileItem.name, rotation, {
          maxWidth: containerW * 0.75,
          maxHeight: containerH * 0.75
        });
      }
    } else {
      PdfPreview.drawFallbackPage(canvas, pageNum, fileItem ? fileItem.name : 'Document', rotation, {
        maxWidth: containerW * 0.75,
        maxHeight: containerH * 0.75
      });
    }

    if (spinner) spinner.classList.add('hidden');
  }

  function drawModalBlankCanvas(canvas, pageNum, pageItem) {
    const container = document.getElementById('previewCanvasContainer');
    const containerW = container ? Math.max(200, container.clientWidth - 24) : 800;
    const containerH = container ? Math.max(200, container.clientHeight - 24) : 800;

    const pageW = (pageItem && pageItem.width) ? pageItem.width : 595.28;
    const pageH = (pageItem && pageItem.height) ? pageItem.height : 841.89;

    const baseScale = Math.min(containerW / pageW, containerH / pageH) * 1.4;
    const finalScale = Math.max(0.35, baseScale * PagePreviewModal.zoomScale);

    const w = Math.floor(pageW * finalScale);
    const h = Math.floor(pageH * finalScale);

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    // Pure solid white background with NO text and NO dashed watermark
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Subtle 1px crisp outline so white paper boundary is clearly distinct
    ctx.strokeStyle = '#d4d4d8';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);

    ctx.restore();
  }

  let _previewModalEventsBound = false;
  function bindPreviewModalEvents() {
    if (_previewModalEventsBound) return;
    _previewModalEventsBound = true;

    document.getElementById('btnClosePagePreview')?.addEventListener('click', closeFullPreview);
    document.getElementById('pagePreviewModal')?.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        closeFullPreview();
      }
    });

    document.getElementById('btnPreviewPrevPage')?.addEventListener('click', () => {
      if (PagePreviewModal.activePageIndex > 0) {
        PagePreviewModal.activePageIndex--;
        renderFullPreviewContent();
      }
    });

    document.getElementById('btnPreviewNextPage')?.addEventListener('click', () => {
      if (PagePreviewModal.activePageIndex < PagePreviewModal.totalPages - 1) {
        PagePreviewModal.activePageIndex++;
        renderFullPreviewContent();
      }
    });

    document.getElementById('btnPreviewZoomIn')?.addEventListener('click', () => {
      PagePreviewModal.zoomScale = Math.min(3.0, PagePreviewModal.zoomScale + 0.25);
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewZoomOut')?.addEventListener('click', () => {
      PagePreviewModal.zoomScale = Math.max(0.4, PagePreviewModal.zoomScale - 0.25);
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewZoomFit')?.addEventListener('click', () => {
      PagePreviewModal.zoomScale = 0.75;
      PagePreviewModal.rotationDelta = 0;
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewRotateCw')?.addEventListener('click', () => {
      PagePreviewModal.rotationDelta = (PagePreviewModal.rotationDelta + 90) % 360;
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewRotateCcw')?.addEventListener('click', () => {
      PagePreviewModal.rotationDelta = (PagePreviewModal.rotationDelta - 90 + 360) % 360;
      renderFullPreviewContent();
    });

    // Keyboard navigation when preview modal is active
    document.addEventListener('keydown', (e) => {
      if (!PagePreviewModal.isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeFullPreview();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById('btnPreviewPrevPage')?.click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        document.getElementById('btnPreviewNextPage')?.click();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        document.getElementById('btnPreviewZoomIn')?.click();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        document.getElementById('btnPreviewZoomOut')?.click();
      }
    });
  }

  function ensurePreviewModalInDOM() {
    let modal = document.getElementById('pagePreviewModal');
    if (modal) {
      bindPreviewModalEvents();
      return modal;
    }

    const modalHtml = `
  <div id="pagePreviewModal" class="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-2 sm:p-4 hidden backdrop-blur-[1px]" style="z-index: 100;">
    <div class="bg-white border-2 border-black max-w-5xl w-full h-[94vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
      
      <!-- Modal Header -->
      <div class="bg-black text-white px-3 sm:px-4 py-2.5 flex items-center justify-between gap-3 text-xs font-mono font-bold select-none border-b border-black">
        <div class="flex items-center gap-2 truncate">
          <span class="text-neutral-400">// PREVIEW:</span>
          <span id="previewModalTitle" class="truncate text-white max-w-xs sm:max-w-md">document.pdf</span>
          <span id="previewModalBadge" class="bg-white text-black px-1.5 py-0.2 text-[10px]">PAGE 1 / 1</span>
        </div>
        
        <!-- Controls: Zoom, Rotate, Close -->
        <div class="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <button type="button" id="btnPreviewZoomOut" class="term-btn text-xs py-0.5 px-2 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black" title="Zoom Out (-)">-</button>
          <span id="previewZoomLevel" class="text-[11px] text-neutral-300 w-11 text-center font-mono">75%</span>
          <button type="button" id="btnPreviewZoomIn" class="term-btn text-xs py-0.5 px-2 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black" title="Zoom In (+)">+</button>
          <button type="button" id="btnPreviewZoomFit" class="term-btn text-xs py-0.5 px-2 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black hidden sm:inline-block" title="Fit to Screen">FIT</button>
          
          <div class="h-4 w-[1px] bg-neutral-700 mx-1"></div>
          
          <button type="button" id="btnPreviewRotateCcw" class="term-btn text-xs py-0.5 px-2 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black" title="Rotate CCW (↶)">↶</button>
          <button type="button" id="btnPreviewRotateCw" class="term-btn text-xs py-0.5 px-2 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black" title="Rotate CW (↷)">↷</button>
          
          <div class="h-4 w-[1px] bg-neutral-700 mx-1"></div>
          
          <button type="button" id="btnClosePagePreview" class="term-btn text-xs py-0.5 px-2.5 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black" title="Close (ESC)">[✕ CLOSE]</button>
        </div>
      </div>

      <!-- Canvas Viewport with Scroll / Zoom -->
      <div id="previewCanvasContainer" class="flex-1 overflow-auto bg-neutral-200 p-4 flex items-center justify-center relative select-none">
        <canvas id="previewFullCanvas" class="bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] border border-black max-w-none transition-transform"></canvas>
        <div id="previewLoadingSpinner" class="hidden absolute inset-0 bg-white/80 flex items-center justify-center font-mono text-xs font-bold gap-2">
          <span class="status-pulse"></span>
          <span>LOADING HIGH-RES PREVIEW...</span>
        </div>
      </div>

      <!-- Modal Footer Toolbar: Prev / Next Navigation -->
      <div class="bg-neutral-50 border-t border-black px-4 py-2 flex items-center justify-between text-xs font-mono">
        <button type="button" id="btnPreviewPrevPage" class="term-btn py-1 px-3 flex items-center gap-1.5" title="Previous Page (Left Arrow)">
          <span>←</span>
          <span>PREVIOUS</span>
        </button>

        <div class="flex items-center gap-2">
          <span id="previewPageIndicator" class="font-bold">PAGE 1 OF 1</span>
          <span class="text-neutral-400 hidden sm:inline">|</span>
          <span class="text-neutral-500 hidden sm:inline text-[11px]">[USE ← / → KEYS TO NAVIGATE]</span>
        </div>

        <button type="button" id="btnPreviewNextPage" class="term-btn py-1 px-3 flex items-center gap-1.5" title="Next Page (Right Arrow)">
          <span>NEXT</span>
          <span>→</span>
        </button>
      </div>

    </div>
  </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    bindPreviewModalEvents();
    return document.getElementById('pagePreviewModal');
  }

  // ==========================================
  // TOOL 02: REMOVE PAGES
  // ==========================================
  async function loadRemovePdf(file) {
    try {
      termLog(`Loading PDF for page removal: ${file.name}...`);
      AppState.removeFilename = file.name;
      AppState.removeBuffer = await file.arrayBuffer();
      AppState.removeDoc = await PdfPreview.loadDocument(AppState.removeBuffer.slice(0));
      AppState.removeSelectedPages.clear();
      setToolOutputFilename('removeOutputFilename', file.name, '_extracted');

      document.getElementById('removeConfigSection').classList.remove('hidden');
      document.getElementById('removeDropzone')?.classList.add('hidden');
      document.getElementById('removeRangeInput').value = '';
      updateRemoveCounters();
      await renderRemoveThumbnails();

      termLog(`Loaded ${file.name}: ${AppState.removeDoc.numPages} page(s). Click thumbnails or enter range to remove.`, 'success');
    } catch (e) {
      termLog(`Failed to load PDF: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  function updateRemoveCounters() {
    const total = AppState.removeDoc ? AppState.removeDoc.numPages : 0;
    const toRemove = AppState.removeSelectedPages.size;
    const remaining = total - toRemove;

    const el = document.getElementById('removeSummary');
    if (el) {
      el.textContent = `TOTAL: ${total} | MARKED TO REMOVE: ${toRemove} | REMAINING: ${remaining}`;
    }

    const btnProcess = document.getElementById('btnProcessRemove');
    if (btnProcess) {
      btnProcess.disabled = toRemove === 0 || remaining === 0;
    }

    const btnPreview = document.getElementById('btnPreviewRemoveDoc');
    if (btnPreview) {
      btnPreview.disabled = !AppState.removeDoc || remaining === 0;
    }
  }

  async function renderRemoveThumbnails() {
    const grid = document.getElementById('removeThumbnailGrid');
    if (!grid || !AppState.removeDoc) return;
    grid.innerHTML = '';

    const total = AppState.removeDoc.numPages;
    for (let i = 1; i <= total; i++) {
      const pageNum = i;
      const card = document.createElement('div');
      card.className = `page-thumb-card cursor-pointer ${AppState.removeSelectedPages.has(pageNum) ? 'marked-for-removal' : ''}`;
      card.dataset.pageNum = pageNum;

      card.innerHTML = `
        <div class="w-full flex items-center justify-between mb-1 pb-1 border-b border-black text-xs font-mono">
          <span class="font-bold">PAGE ${pageNum}</span>
          <span class="remove-status-tag font-bold">${AppState.removeSelectedPages.has(pageNum) ? '[✕ REMOVE]' : '[✓ KEEP]'}</span>
        </div>
        <div class="relative bg-white border border-black flex items-center justify-center overflow-hidden my-1" style="min-height: 140px; min-width: 100px;">
          <canvas id="thumb_remove_${pageNum}"></canvas>
        </div>
        <button type="button" class="term-btn text-xs w-full py-0.5 mt-1 btn-toggle-page">
          ${AppState.removeSelectedPages.has(pageNum) ? 'RESTORE PAGE' : 'DELETE PAGE'}
        </button>
      `;

      // Toggle click
      const toggle = () => {
        if (AppState.removeSelectedPages.has(pageNum)) {
          AppState.removeSelectedPages.delete(pageNum);
        } else {
          AppState.removeSelectedPages.add(pageNum);
        }
        syncRemoveInputFromSet();
        updateRemoveCardState(card, pageNum);
        updateRemoveCounters();
      };

      card.addEventListener('click', (e) => {
        toggle();
      });

      grid.appendChild(card);

      // Async render thumbnail
      const canvas = card.querySelector(`#thumb_remove_${pageNum}`);
      PdfPreview.renderPageToCanvas(AppState.removeDoc, pageNum, canvas, { maxWidth: 120, maxHeight: 160 }).catch((e) => {
        console.error('Thumbnail render error:', e);
      });
    }
  }

  function updateRemoveCardState(card, pageNum) {
    const isRemoved = AppState.removeSelectedPages.has(pageNum);
    if (isRemoved) {
      card.classList.add('marked-for-removal');
    } else {
      card.classList.remove('marked-for-removal');
    }
    const tag = card.querySelector('.remove-status-tag');
    if (tag) tag.textContent = isRemoved ? '[✕ REMOVE]' : '[✓ KEEP]';
    const btn = card.querySelector('.btn-toggle-page');
    if (btn) btn.textContent = isRemoved ? 'RESTORE PAGE' : 'DELETE PAGE';
  }

  function syncRemoveInputFromSet() {
    const input = document.getElementById('removeRangeInput');
    if (!input) return;
    const sorted = Array.from(AppState.removeSelectedPages).sort((a, b) => a - b);
    if (sorted.length === 0) {
      input.value = '';
      return;
    }

    // Collapse ranges e.g. 1, 2, 3 -> 1-3
    const ranges = [];
    let start = sorted[0];
    let prev = sorted[0];

    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] === prev + 1) {
        prev = sorted[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = sorted[i];
        prev = sorted[i];
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    input.value = ranges.join(', ');
  }

  function syncSetFromRemoveInput(rangeStr) {
    if (!AppState.removeDoc) return;
    const set = Converters.parsePageRanges(rangeStr, AppState.removeDoc.numPages);
    AppState.removeSelectedPages = set;

    const cards = document.querySelectorAll('#removeThumbnailGrid .page-thumb-card');
    cards.forEach((card) => {
      const pageNum = parseInt(card.dataset.pageNum, 10);
      updateRemoveCardState(card, pageNum);
    });

    updateRemoveCounters();
  }

  async function previewRemoveDoc() {
    if (!AppState.removeBuffer || !AppState.removeDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const remaining = AppState.removeDoc.numPages - AppState.removeSelectedPages.size;
    if (remaining <= 0) {
      termLog('Cannot preview document: all pages marked for removal.', 'warn');
      alert('All pages are marked for removal. Please keep at least one page to preview.');
      return;
    }

    const btn = document.getElementById('btnPreviewRemoveDoc');
    if (btn) btn.disabled = true;
    termLog(`Preparing preview with ${AppState.removeSelectedPages.size} removed page(s)...`);

    try {
      if (AppState.removeSelectedPages.size === 0) {
        await openDocumentPreview(AppState.removeBuffer.slice(0), `${AppState.removeFilename} (0 pages removed)`);
      } else {
        const resultBytes = await PdfTools.removePages(
          AppState.removeBuffer.slice(0),
          AppState.removeSelectedPages,
          (curr, total, msg) => termLog(msg)
        );
        const baseName = AppState.removeFilename.replace(/\.pdf$/i, '');
        await openDocumentPreview(resultBytes, `${baseName}_preview.pdf`);
      }
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function processRemovePages() {
    if (!AppState.removeBuffer || AppState.removeSelectedPages.size === 0) {
      termLog('No pages selected for removal.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessRemove');
    if (btn) btn.disabled = true;
    termLog(`Removing ${AppState.removeSelectedPages.size} page(s)...`);

    try {
      const resultBytes = await PdfTools.removePages(
        AppState.removeBuffer.slice(0),
        AppState.removeSelectedPages,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.removeFilename.replace(/\.pdf$/i, '');
      const filename = getCustomFilename('removeOutputFilename', `${baseName}_extracted.pdf`);
      const blob = new Blob([resultBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `Extracted PDF // ${AppState.removeDoc.numPages - AppState.removeSelectedPages.size} pages remaining`);
      termLog(`Created modified PDF without deleted pages.`, 'success');
    } catch (e) {
      termLog(`Remove error: ${e.message}`, 'error');
      alert(`Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 03: VISUAL ADD PAGES WORKSPACE
  // ==========================================

  async function loadAddPrimaryPdf(file) {
    try {
      termLog(`Loading primary PDF for page insertion: ${file.name}...`);
      AppState.addFilename = file.name;
      AppState.addBuffer = await file.arrayBuffer();
      AppState.addDoc = await PdfPreview.loadDocument(AppState.addBuffer.slice(0));
      setToolOutputFilename('addOutputFilename', file.name, '_extended');

      document.getElementById('addConfigSection')?.classList.remove('hidden');
      document.getElementById('addPrimaryDropzone')?.classList.add('hidden');
      document.getElementById('addDropzone')?.classList.add('hidden');

      const meta = document.getElementById('addPrimaryMeta');
      if (meta) meta.textContent = `${file.name} (${AppState.addDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;

      AppState.addPages = [];
      AppState.addSelectedIds.clear();
      const fileId = 'add_base_' + Math.random().toString(36).substr(2, 7);

      for (let p = 1; p <= AppState.addDoc.numPages; p++) {
        AppState.addPages.push({
          id: 'add_p_' + Math.random().toString(36).substr(2, 9),
          type: 'pdfPage',
          fileId: fileId,
          fileName: file.name,
          buffer: AppState.addBuffer,
          fileBuffer: AppState.addBuffer,
          pageNumber: p,
          pageIndex: p - 1,
          rotation: 0,
          pdfDoc: AppState.addDoc,
          width: 595.28,
          height: 841.89
        });
      }

      renderAddPagesView();
      termLog(`Base PDF ready with ${AppState.addDoc.numPages} pages. Click (+) between pages to insert a blank page or another PDF.`, 'success');
    } catch (e) {
      termLog(`Failed to load primary PDF: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  function renderAddPagesView() {
    const pagesGrid = document.getElementById('addPagesGrid');
    const badge = document.getElementById('addPagesSummaryBadge');
    const btnFinish = document.getElementById('btnProcessAdd');
    const btnPreview = document.getElementById('btnPreviewAddDoc');

    const totalPages = AppState.addPages.length;
    if (badge) badge.textContent = `${totalPages} PAGE${totalPages === 1 ? '' : 'S'}`;
    if (btnFinish) btnFinish.disabled = totalPages === 0;
    if (btnPreview) btnPreview.disabled = totalPages === 0;

    updateAddSelectionCounts();

    if (!pagesGrid) return;
    pagesGrid.innerHTML = '';

    if (totalPages === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'col-span-full border-2 border-dashed border-black bg-neutral-50 p-8 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-neutral-100 transition-none select-none my-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
      emptyCard.innerHTML = `
        <div class="w-8 h-8 rounded-full border border-black flex items-center justify-center text-lg font-bold bg-white">+</div>
        <div class="text-xs font-bold font-mono">Insert Blank or PDF</div>
        <div class="text-[10px] text-neutral-500 font-mono">Click to insert page</div>
      `;
      emptyCard.addEventListener('click', (e) => {
        showAddInlineInsertMenu(e.currentTarget, 0);
      });
      pagesGrid.appendChild(emptyCard);
      return;
    }

    // Render each page card as a direct grid item with in-between (+) divider buttons
    AppState.addPages.forEach((pageItem, index) => {
      const isSelected = AppState.addSelectedIds.has(pageItem.id);
      const displayPageNum = index + 1;
      const pageRot = (pageItem.rotation || 0) % 360;

      const pageCard = document.createElement('div');
      pageCard.className = 'page-thumb-card relative group cursor-grab border-2 border-black bg-white p-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-transform select-none flex flex-col justify-between';
      pageCard.setAttribute('draggable', 'true');
      pageCard.dataset.pageIndex = index;
      pageCard.dataset.pageId = pageItem.id;

      if (pageItem.type === 'blankPage') {
        pageCard.classList.remove('bg-white');
        pageCard.classList.add('bg-neutral-100');
        pageCard.innerHTML = `
          <div class="w-full flex items-center justify-between mb-1 pb-1 border-b border-black text-xs font-mono">
            <label class="flex items-center cursor-pointer">
              <input type="checkbox" class="w-3.5 h-3.5 accent-black cursor-pointer add-page-checkbox" data-page-id="${pageItem.id}" ${isSelected ? 'checked' : ''} />
            </label>
            <span class="font-bold text-[10px] bg-black text-white px-1.5 py-0.2">#${displayPageNum}</span>
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" class="term-btn text-[9px] p-0.5 btn-add-page-preview" title="Full page preview">👁</button>
              <button type="button" class="term-btn text-[9px] p-0.5 btn-add-page-del" title="Remove blank page">✕</button>
            </div>
          </div>

          <!-- Blank Page Sheet -->
          <div class="relative bg-white border border-neutral-300 shadow-[1px_1px_2px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center overflow-hidden my-1 cursor-pointer add-page-thumb-trigger group/thumb w-full" style="min-height: 140px; min-width: 100px; background-color: #ffffff;" title="Click for full page preview">
            <span class="border border-black bg-white px-1 py-0.5 text-[9px] font-bold font-mono">[BLANK PAGE]</span>
            <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
              <span class="opacity-0 group-hover/thumb:opacity-100 bg-black text-white text-[8px] font-mono px-1.5 py-0.5 font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">👁 VIEW</span>
            </div>
          </div>

          <div class="text-[10px] text-neutral-600 truncate w-full text-center mt-1 font-mono">
            [Blank Page]
          </div>

          <!-- In-Between (+) Button mounted on the right edge -->
          <button type="button" class="card-plus-btn btn-add-insert-divider" style="position: absolute; left: calc(100% + 4px); top: calc(50% - 12px); z-index: 20;" data-insert-index="${index + 1}" title="Insert blank page or PDF after page ${displayPageNum}">
            +
          </button>

          ${index === 0 ? `
            <!-- Leading (+) Button mounted on the left edge for page 1 -->
            <button type="button" class="card-plus-btn btn-add-insert-divider" style="position: absolute; left: -28px; top: calc(50% - 12px); z-index: 20;" data-insert-index="0" title="Insert blank page or PDF at start">
              +
            </button>
          ` : ''}
        `;
      } else {
        // PDF Page Card
        pageCard.innerHTML = `
          <div class="w-full flex items-center justify-between mb-1 pb-1 border-b border-black text-xs font-mono">
            <label class="flex items-center cursor-pointer">
              <input type="checkbox" class="w-3.5 h-3.5 accent-black cursor-pointer add-page-checkbox" data-page-id="${pageItem.id}" ${isSelected ? 'checked' : ''} />
            </label>
            <span class="font-bold text-[10px] bg-black text-white px-1.5 py-0.2">#${displayPageNum}</span>
            <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button type="button" class="term-btn text-[9px] p-0.5 btn-add-page-preview" title="Full page preview">👁</button>
              <button type="button" class="term-btn text-[9px] p-0.5 btn-add-page-rot" title="Rotate +90°">↷</button>
              <button type="button" class="term-btn text-[9px] p-0.5 btn-add-page-del" title="Remove page">✕</button>
            </div>
          </div>

          <!-- Canvas Preview -->
          <div class="relative bg-neutral-50 border border-neutral-300 flex items-center justify-center overflow-hidden my-1 cursor-pointer add-page-thumb-trigger group/thumb w-full" style="min-height: 140px; min-width: 100px;" title="Click for full page preview">
            <canvas id="add_thumb_${pageItem.id}"></canvas>
            <div class="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center pointer-events-none">
              <span class="opacity-0 group-hover/thumb:opacity-100 bg-black text-white text-[8px] font-mono px-1.5 py-0.5 font-bold shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                <span>👁</span><span>VIEW</span>
              </span>
            </div>
            ${pageRot ? `<span class="absolute top-1 right-1 bg-black text-white text-[9px] px-1 font-bold">+${pageRot}°</span>` : ''}
          </div>

          <div class="text-[10px] text-neutral-600 truncate w-full text-center mt-1 font-mono" title="${escapeHtml(pageItem.fileName)} (p.${pageItem.pageNumber})">
            ${escapeHtml(pageItem.fileName)} (p.${pageItem.pageNumber})
          </div>

          <!-- In-Between (+) Button mounted on the right edge -->
          <button type="button" class="card-plus-btn btn-add-insert-divider" style="position: absolute; left: calc(100% + 4px); top: calc(50% - 12px); z-index: 20;" data-insert-index="${index + 1}" title="Insert blank page or PDF after page ${displayPageNum}">
            +
          </button>

          ${index === 0 ? `
            <!-- Leading (+) Button mounted on the left edge for page 1 -->
            <button type="button" class="card-plus-btn btn-add-insert-divider" style="position: absolute; left: -28px; top: calc(50% - 12px); z-index: 20;" data-insert-index="0" title="Insert blank page or PDF at start">
              +
            </button>
          ` : ''}
        `;
      }

      // Checkbox binding
      pageCard.querySelector('.add-page-checkbox')?.addEventListener('change', (e) => {
        if (e.target.checked) AppState.addSelectedIds.add(pageItem.id);
        else AppState.addSelectedIds.delete(pageItem.id);
        updateAddSelectionCounts();
      });

      // Preview bindings
      pageCard.querySelector('.btn-add-page-preview')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openAddPagePreview(index);
      });
      pageCard.querySelector('.add-page-thumb-trigger')?.addEventListener('click', () => {
        openAddPagePreview(index);
      });

      // Rotate single page
      pageCard.querySelector('.btn-add-page-rot')?.addEventListener('click', (e) => {
        e.stopPropagation();
        pageItem.rotation = ((pageItem.rotation || 0) + 90) % 360;
        renderAddPagesView();
      });

      // Delete single page
      pageCard.querySelector('.btn-add-page-del')?.addEventListener('click', (e) => {
        e.stopPropagation();
        AppState.addPages.splice(index, 1);
        AppState.addSelectedIds.delete(pageItem.id);
        renderAddPagesView();
        termLog(`Removed page #${displayPageNum}.`);
      });

      // In-between (+) divider buttons click
      pageCard.querySelectorAll('.btn-add-insert-divider').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const insIdx = parseInt(e.currentTarget.dataset.insertIndex, 10);
          showAddInlineInsertMenu(e.currentTarget, isNaN(insIdx) ? index + 1 : insIdx);
        });
      });

      // Drag and drop reordering
      setupAddPageCardDrag(pageCard, index, pageItem.id);

      pagesGrid.appendChild(pageCard);

      // Render thumbnail asynchronously for PDF page
      if (pageItem.type === 'pdfPage') {
        const canvas = pageCard.querySelector(`#add_thumb_${pageItem.id}`);
        if (canvas) {
          renderAddThumbnail(pageItem, canvas);
        }
      }
    });

    // End Add Card in the next grid cell
    const endAddCard = document.createElement('div');
    endAddCard.id = 'btnAddPagesEndCard';
    endAddCard.className = 'page-thumb-card border-2 border-dashed border-black bg-neutral-50 p-2 sm:p-3 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-neutral-100 transition-none select-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]';
    endAddCard.style.minHeight = '190px';
    endAddCard.title = 'Click to insert blank page or PDF at end';
    endAddCard.innerHTML = `
      <div class="w-8 h-8 rounded-full border border-black flex items-center justify-center text-lg font-bold bg-white">+</div>
      <div class="text-xs font-bold font-mono">Insert Blank or PDF</div>
      <div class="text-[10px] text-neutral-500 font-mono">at the end</div>
    `;
    endAddCard.addEventListener('click', (e) => {
      showAddInlineInsertMenu(e.currentTarget, AppState.addPages.length);
    });
    setupDropzone(endAddCard, (files) => {
      insertAddPdfFiles(files, AppState.addPages.length);
    });
    pagesGrid.appendChild(endAddCard);
  }

  function showAddInlineInsertMenu(anchorEl, insertIndex) {
    const existing = document.getElementById('addInlineInsertPopover');
    if (existing) existing.remove();

    const popover = document.createElement('div');
    popover.id = 'addInlineInsertPopover';
    popover.className = 'fixed bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-1.5 z-50 flex flex-col gap-1 w-48 font-mono text-xs';

    const rect = anchorEl.getBoundingClientRect();
    let top = rect.bottom + 6;
    let left = rect.left + rect.width / 2;

    if (top + 90 > window.innerHeight) {
      top = Math.max(10, rect.top - 80);
    }
    if (left + 105 > window.innerWidth) {
      left = window.innerWidth - 110;
    } else if (left - 105 < 0) {
      left = 110;
    }

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.transform = 'translateX(-50%)';

    popover.innerHTML = `
      <button type="button" class="term-btn text-[11px] py-1 px-2 text-left w-full justify-start btn-pop-blank hover:bg-black hover:text-white font-bold">
        + Insert Blank Page
      </button>
      <button type="button" class="term-btn text-[11px] py-1 px-2 text-left w-full justify-start btn-pop-pdf hover:bg-black hover:text-white font-bold">
        + Insert PDF File
      </button>
    `;

    popover.querySelector('.btn-pop-blank').addEventListener('click', () => {
      popover.remove();
      insertAddBlankPage(insertIndex);
    });

    popover.querySelector('.btn-pop-pdf').addEventListener('click', () => {
      popover.remove();
      AppState._insertAddAtIndex = insertIndex;
      const input = document.getElementById('addSecFileInput');
      if (input) input.click();
    });

    document.body.appendChild(popover);

    const onDocClick = (e) => {
      if (!popover.contains(e.target) && e.target !== anchorEl) {
        popover.remove();
        document.removeEventListener('click', onDocClick);
      }
    };
    setTimeout(() => document.addEventListener('click', onDocClick), 50);
  }

  function insertAddBlankPage(insertIndex = -1) {
    let targetW = 595.28;
    let targetH = 841.89;

    if (AppState.addPages.length > 0) {
      const refIdx = insertIndex > 0 ? insertIndex - 1 : 0;
      const refPage = AppState.addPages[refIdx];
      if (refPage && refPage.width && refPage.height) {
        targetW = refPage.width;
        targetH = refPage.height;
      }
    }

    const blankItem = {
      id: 'blank_' + Math.random().toString(36).substr(2, 9),
      type: 'blankPage',
      fileId: null,
      fileName: '[Blank Page]',
      pageNumber: 1,
      rotation: 0,
      width: targetW,
      height: targetH
    };

    const finalIdx = (insertIndex >= 0 && insertIndex <= AppState.addPages.length)
      ? insertIndex
      : AppState.addPages.length;

    AppState.addPages.splice(finalIdx, 0, blankItem);
    renderAddPagesView();
    termLog(`Inserted blank page at position #${finalIdx + 1}.`, 'success');
  }

  async function insertAddPdfFiles(files, targetIndex = -1) {
    if (!files || files.length === 0) return;
    const pdfFiles = Array.from(files).filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      termLog('Please select valid PDF file(s).', 'error');
      return;
    }

    let insertAt = (targetIndex >= 0 && targetIndex <= AppState.addPages.length)
      ? targetIndex
      : (AppState._insertAddAtIndex >= 0 ? AppState._insertAddAtIndex : AppState.addPages.length);

    AppState._insertAddAtIndex = -1;

    for (const file of pdfFiles) {
      try {
        termLog(`Loading PDF to insert: ${file.name}...`);
        const buffer = await file.arrayBuffer();
        const pdfDoc = await PdfPreview.loadDocument(buffer.slice(0));
        const fileId = 'add_sec_' + Math.random().toString(36).substr(2, 7);

        const newPages = [];
        for (let p = 1; p <= pdfDoc.numPages; p++) {
          newPages.push({
            id: 'add_p_' + Math.random().toString(36).substr(2, 9),
            type: 'pdfPage',
            fileId: fileId,
            fileName: file.name,
            buffer: buffer,
            fileBuffer: buffer,
            pageNumber: p,
            pageIndex: p - 1,
            rotation: 0,
            pdfDoc: pdfDoc,
            width: 595.28,
            height: 841.89
          });
        }

        AppState.addPages.splice(insertAt, 0, ...newPages);
        insertAt += newPages.length;
        termLog(`Inserted ${newPages.length} page(s) from "${file.name}".`, 'success');
      } catch (err) {
        termLog(`Failed to load secondary PDF "${file.name}": ${err.message}`, 'error');
        alert(`Error inserting PDF "${file.name}": ${err.message}`);
      }
    }

    renderAddPagesView();
  }

  function setupAddPageCardDrag(card, index, pageId) {
    card.setAttribute('draggable', 'true');

    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', String(index));
      e.dataTransfer.setData('application/x-page-id', pageId);
      e.dataTransfer.effectAllowed = 'move';
      card.classList.add('is-dragging');
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('is-dragging');
      document.querySelectorAll('#addPagesGrid .page-thumb-card').forEach((c) => {
        c.classList.remove('drag-target-left', 'drag-target-right');
      });
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const rect = card.getBoundingClientRect();
      const isLeft = e.clientX < rect.left + rect.width / 2;
      card.classList.toggle('drag-target-left', isLeft);
      card.classList.toggle('drag-target-right', !isLeft);
    });

    card.addEventListener('dragleave', () => {
      card.classList.remove('drag-target-left', 'drag-target-right');
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      card.classList.remove('drag-target-left', 'drag-target-right');
      const fromId = e.dataTransfer.getData('application/x-page-id');
      if (fromId && pageId) {
        const fromIndex = AppState.addPages.findIndex((p) => p.id === fromId);
        const toIndex = AppState.addPages.findIndex((p) => p.id === pageId);
        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
          const [moved] = AppState.addPages.splice(fromIndex, 1);
          AppState.addPages.splice(toIndex, 0, moved);
          renderAddPagesView();
          termLog(`Reorganized page to position #${toIndex + 1}.`);
          return;
        }
      }
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
      const toIndex = index;
      if (!isNaN(fromIndex) && fromIndex !== toIndex && fromIndex >= 0 && fromIndex < AppState.addPages.length) {
        const [moved] = AppState.addPages.splice(fromIndex, 1);
        AppState.addPages.splice(toIndex, 0, moved);
        renderAddPagesView();
        termLog(`Reorganized page to position #${toIndex + 1}.`);
      }
    });
  }

  function updateAddSelectionCounts() {
    const totalSelected = AppState.addSelectedIds.size;
    const selectedEl = document.getElementById('addSelectedCount');
    const selectAllEl = document.getElementById('addSelectAll');

    if (selectedEl) {
      selectedEl.textContent = `(${totalSelected} selected)`;
    }

    if (selectAllEl) {
      const totalPages = AppState.addPages.length;
      selectAllEl.checked = totalPages > 0 && totalSelected === totalPages;
      selectAllEl.indeterminate = totalSelected > 0 && totalSelected < totalPages;
    }
  }

  async function renderAddThumbnail(pageItem, canvas) {
    if (!canvas) return;
    const maxWidth = 160;
    const maxHeight = 160;
    const rotation = pageItem.rotation || 0;
    const cacheKey = `add_${pageItem.id}_p${pageItem.pageNumber}_r${rotation}`;

    if (AppState.thumbnailCache && AppState.thumbnailCache.has(cacheKey)) {
      const cached = AppState.thumbnailCache.get(cacheKey);
      canvas.width = cached.width;
      canvas.height = cached.height;
      canvas.style.width = cached.style.width;
      canvas.style.height = cached.style.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(cached, 0, 0);
      return;
    }

    PdfPreview.drawFallbackPage(canvas, pageItem.pageNumber, pageItem.fileName, rotation, { maxWidth, maxHeight });

    if (pageItem.pdfDoc) {
      try {
        await PdfPreview.renderPageToCanvas(pageItem.pdfDoc, pageItem.pageNumber, canvas, {
          maxWidth,
          maxHeight,
          rotation
        });

        if (!AppState.thumbnailCache) AppState.thumbnailCache = new Map();
        const offscreen = document.createElement('canvas');
        offscreen.width = canvas.width;
        offscreen.height = canvas.height;
        offscreen.style.width = canvas.style.width;
        offscreen.style.height = canvas.style.height;
        const offCtx = offscreen.getContext('2d');
        offCtx.drawImage(canvas, 0, 0);
        AppState.thumbnailCache.set(cacheKey, offscreen);
      } catch (err) {
        console.warn('Failed to render add page thumbnail:', err);
      }
    }
  }

  function openAddPagePreview(pageIndex = 0) {
    if (!AppState.addPages || AppState.addPages.length === 0) return;
    const clampedIndex = Math.max(0, Math.min(pageIndex, AppState.addPages.length - 1));

    ensurePreviewModalInDOM();
    PagePreviewModal.isOpen = true;
    PagePreviewModal.mode = 'addPage';
    PagePreviewModal.activeFile = null;
    PagePreviewModal.activeDoc = null;
    PagePreviewModal.activePageIndex = clampedIndex;
    PagePreviewModal.totalPages = AppState.addPages.length;
    PagePreviewModal.zoomScale = 0.75;
    PagePreviewModal.rotationDelta = 0;

    const modal = document.getElementById('pagePreviewModal');
    if (modal) modal.classList.remove('hidden');
    renderFullPreviewContent();
    termLog(`Opened full preview for page #${clampedIndex + 1} of ${AppState.addPages.length}.`);
  }

  async function previewAddDoc() {
    if (!AppState.addPages || AppState.addPages.length === 0) {
      termLog('Please select a primary PDF first.', 'error');
      return;
    }

    const btn = document.getElementById('btnPreviewAddDoc');
    if (btn) btn.disabled = true;
    termLog('Generating full document preview...');

    try {
      const pageItems = AppState.addPages.map((item) => {
        if (item.type === 'blankPage') {
          return {
            type: 'blankPage',
            width: item.width || 595.28,
            height: item.height || 841.89
          };
        }
        return {
          type: 'pdfPage',
          buffer: item.buffer.slice(0),
          pageIndex: item.pageNumber - 1,
          rotation: item.rotation || 0
        };
      });

      const resultBytes = await PdfTools.mergeCustomPages(pageItems, {}, (curr, total, msg) => {
        termLog(msg);
      });

      const baseName = (AppState.addFilename || 'document').replace(/\.pdf$/i, '');
      await openDocumentPreview(resultBytes, `${baseName}_extended_preview.pdf`);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function processAddPages() {
    if (!AppState.addPages || AppState.addPages.length === 0) {
      termLog('Please select a primary PDF first.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessAdd');
    if (btn) btn.disabled = true;

    try {
      termLog(`Compiling document with ${AppState.addPages.length} total page(s)...`);

      const pageItems = AppState.addPages.map((item) => {
        if (item.type === 'blankPage') {
          return {
            type: 'blankPage',
            width: item.width || 595.28,
            height: item.height || 841.89
          };
        }
        return {
          type: 'pdfPage',
          buffer: item.buffer.slice(0),
          pageIndex: item.pageNumber - 1,
          rotation: item.rotation || 0
        };
      });

      const resultBytes = await PdfTools.mergeCustomPages(pageItems, {}, (curr, total, msg) => {
        termLog(msg);
      });

      const baseName = (AppState.addFilename || 'document').replace(/\.pdf$/i, '');
      const filename = getCustomFilename('addOutputFilename', `${baseName}_extended.pdf`);
      const blob = new Blob([resultBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `${AppState.addPages.length} pages // ${Converters.formatBytes(blob.size)} // Ready for download`);
      termLog(`Document saved as ${filename} (${AppState.addPages.length} pages).`, 'success');
    } catch (e) {
      termLog(`Add pages error: ${e.message}`, 'error');
      alert(`Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 04: RESIZE PDF
  // ==========================================
  async function loadResizePdf(file) {
    try {
      termLog(`Loading PDF for resizing: ${file.name}...`);
      AppState.resizeFilename = file.name;
      AppState.resizeBuffer = await file.arrayBuffer();
      AppState.resizeDoc = await PdfPreview.loadDocument(AppState.resizeBuffer.slice(0));
      setToolOutputFilename('resizeOutputFilename', file.name, '_resized');

      document.getElementById('resizeConfigSection').classList.remove('hidden');
      document.getElementById('resizeDropzone')?.classList.add('hidden');
      document.getElementById('resizeFileMeta').textContent = `${file.name} (${AppState.resizeDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;
      const btnPrev = document.getElementById('btnPreviewResizeDoc');
      if (btnPrev) btnPrev.disabled = false;

      termLog(`PDF loaded for resizing. Choose target dimensions and scaling.`, 'success');
    } catch (e) {
      termLog(`Failed to load PDF for resizing: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  async function previewResizeDoc() {
    if (!AppState.resizeBuffer || !AppState.resizeDoc) {
      termLog('Please select a PDF file first.', 'error');
      return;
    }

    const sizePreset = document.getElementById('resizePresetSelect')?.value || 'A4';
    let targetSize = PdfTools.PAGE_SIZES[sizePreset];

    if (sizePreset === 'CUSTOM') {
      const customW = parseFloat(document.getElementById('resizeCustomWidth')?.value || '595.28');
      const customH = parseFloat(document.getElementById('resizeCustomHeight')?.value || '841.89');
      targetSize = [customW, customH];
    }

    const orientation = document.getElementById('resizeOrientationSelect')?.value || 'auto';
    const scalingMode = document.getElementById('resizeScalingModeSelect')?.value || 'proportional';

    const btn = document.getElementById('btnPreviewResizeDoc');
    if (btn) btn.disabled = true;
    termLog(`Generating resized preview (${sizePreset})...`);

    try {
      const resizedBytes = await PdfTools.resizePdf(
        AppState.resizeBuffer.slice(0),
        {
          targetSize,
          orientation,
          scalingMode
        },
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.resizeFilename.replace(/\.pdf$/i, '');
      await openDocumentPreview(resizedBytes, `${baseName}_resized_preview.pdf`);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function processResize() {
    if (!AppState.resizeBuffer) {
      termLog('Please select a PDF file to resize.', 'error');
      return;
    }

    const sizePreset = document.getElementById('resizePresetSelect')?.value || 'A4';
    let targetSize = PdfTools.PAGE_SIZES[sizePreset];

    if (sizePreset === 'CUSTOM') {
      const customW = parseFloat(document.getElementById('resizeCustomWidth')?.value || '595.28');
      const customH = parseFloat(document.getElementById('resizeCustomHeight')?.value || '841.89');
      targetSize = [customW, customH];
    }

    const orientation = document.getElementById('resizeOrientationSelect')?.value || 'auto';
    const scalingMode = document.getElementById('resizeScalingModeSelect')?.value || 'proportional';

    const btn = document.getElementById('btnProcessResize');
    if (btn) btn.disabled = true;
    termLog(`Resizing ${AppState.resizeFilename} to ${sizePreset} (${orientation}, ${scalingMode})...`);

    try {
      const resizedBytes = await PdfTools.resizePdf(
        AppState.resizeBuffer.slice(0),
        {
          targetSize,
          orientation,
          scalingMode
        },
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.resizeFilename.replace(/\.pdf$/i, '');
      const filename = getCustomFilename('resizeOutputFilename', `${baseName}_resized_${sizePreset.toLowerCase()}.pdf`);
      const blob = new Blob([resizedBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `Resized to ${sizePreset} (${scalingMode}) // ${Converters.formatBytes(blob.size)}`);
      termLog(`Resize complete. Saved as ${filename}`, 'success');
    } catch (e) {
      termLog(`Resize error: ${e.message}`, 'error');
      alert(`Resize Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 05: ROTATE PDF
  // ==========================================
  async function loadRotatePdf(file) {
    try {
      termLog(`Loading PDF for rotation: ${file.name}...`);
      AppState.rotateFilename = file.name;
      AppState.rotateBuffer = await file.arrayBuffer();
      AppState.rotateDoc = await PdfPreview.loadDocument(AppState.rotateBuffer.slice(0));
      AppState.rotateAngles = {};
      setToolOutputFilename('rotateOutputFilename', file.name, '_rotated');

      document.getElementById('rotateConfigSection').classList.remove('hidden');
      document.getElementById('rotateDropzone')?.classList.add('hidden');
      document.getElementById('rotateFileMeta').textContent = `${file.name} (${AppState.rotateDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;
      const btnPrev = document.getElementById('btnPreviewRotateDoc');
      if (btnPrev) btnPrev.disabled = false;

      await renderRotateThumbnails();
      termLog(`PDF loaded. Click rotate buttons on thumbnails or use bulk controls.`, 'success');
    } catch (e) {
      termLog(`Failed to load PDF for rotation: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  async function renderRotateThumbnails() {
    const grid = document.getElementById('rotateThumbnailGrid');
    if (!grid || !AppState.rotateDoc) return;
    grid.innerHTML = '';

    const total = AppState.rotateDoc.numPages;
    for (let i = 1; i <= total; i++) {
      const pageNum = i;
      const angle = AppState.rotateAngles[pageNum] || 0;

      const card = document.createElement('div');
      card.className = 'page-thumb-card';
      card.dataset.pageNum = pageNum;

      card.innerHTML = `
        <div class="w-full flex items-center justify-between mb-1 pb-1 border-b border-black text-xs font-mono">
          <span class="font-bold">PAGE ${pageNum}</span>
          <span class="rotate-angle-badge font-bold">[${angle}°]</span>
        </div>
        <div class="relative bg-white border border-black flex items-center justify-center overflow-hidden my-1" style="min-height: 140px; min-width: 100px;">
          <canvas id="thumb_rotate_${pageNum}"></canvas>
        </div>
        <div class="flex items-center gap-1 w-full mt-1">
          <button type="button" class="term-btn text-xs py-0.5 px-1 flex-1 btn-rotate-cw" title="Rotate Clockwise 90°">
            ↻ +90°
          </button>
          <button type="button" class="term-btn text-xs py-0.5 px-1 flex-1 btn-rotate-ccw" title="Rotate Counter-Clockwise 90°">
            ↺ -90°
          </button>
        </div>
      `;

      card.querySelector('.btn-rotate-cw').addEventListener('click', () => {
        applySinglePageRotation(pageNum, 90, card);
      });

      card.querySelector('.btn-rotate-ccw').addEventListener('click', () => {
        applySinglePageRotation(pageNum, -90, card);
      });

      grid.appendChild(card);

      // Render thumbnail with rotation
      renderRotatePageCanvas(pageNum, card, angle);
    }
  }

  function applySinglePageRotation(pageNum, delta, card) {
    const current = AppState.rotateAngles[pageNum] || 0;
    let next = (current + delta) % 360;
    if (next < 0) next += 360;
    AppState.rotateAngles[pageNum] = next;

    const badge = card.querySelector('.rotate-angle-badge');
    if (badge) badge.textContent = `[${next}°]`;

    renderRotatePageCanvas(pageNum, card, next);
    termLog(`Rotated Page ${pageNum} to ${next}°.`);
  }

  function renderRotatePageCanvas(pageNum, card, angle) {
    const canvas = card.querySelector(`#thumb_rotate_${pageNum}`);
    if (!canvas || !AppState.rotateDoc) return;
    PdfPreview.renderPageToCanvas(AppState.rotateDoc, pageNum, canvas, {
      maxWidth: 120,
      maxHeight: 160,
      rotation: angle
    }).catch((e) => console.error(e));
  }

  function applyBulkRotation(deltaAngle) {
    if (!AppState.rotateDoc) return;
    const scope = document.getElementById('rotateScopeSelect')?.value || 'all';
    const total = AppState.rotateDoc.numPages;

    let targetPages = [];
    if (scope === 'all') {
      for (let i = 1; i <= total; i++) targetPages.push(i);
    } else if (scope === 'odd') {
      for (let i = 1; i <= total; i += 2) targetPages.push(i);
    } else if (scope === 'even') {
      for (let i = 2; i <= total; i += 2) targetPages.push(i);
    } else if (scope === 'range') {
      const rangeStr = document.getElementById('rotateRangeInput')?.value || '';
      targetPages = Array.from(Converters.parsePageRanges(rangeStr, total));
    }

    if (targetPages.length === 0) {
      termLog('No pages matched for bulk rotation.', 'warn');
      return;
    }

    targetPages.forEach((p) => {
      const cur = AppState.rotateAngles[p] || 0;
      let next = (cur + deltaAngle) % 360;
      if (next < 0) next += 360;
      AppState.rotateAngles[p] = next;

      const card = document.querySelector(`#rotateThumbnailGrid .page-thumb-card[data-page-num="${p}"]`);
      if (card) {
        const badge = card.querySelector('.rotate-angle-badge');
        if (badge) badge.textContent = `[${next}°]`;
        renderRotatePageCanvas(p, card, next);
      }
    });

    termLog(`Applied ${deltaAngle > 0 ? '+' : ''}${deltaAngle}° rotation to ${targetPages.length} page(s).`, 'success');
  }

  function resetAllRotations() {
    if (!AppState.rotateDoc) return;
    AppState.rotateAngles = {};
    renderRotateThumbnails();
    termLog('All page rotations have been reset to 0°');
  }

  async function processRotate() {
    if (!AppState.rotateBuffer) {
      termLog('Please select a PDF to rotate.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessRotate');
    if (btn) btn.disabled = true;
    termLog('Generating rotated PDF document...');

    try {
      const rotatedBytes = await PdfTools.rotatePdf(
        AppState.rotateBuffer.slice(0),
        {
          rotations: AppState.rotateAngles
        },
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.rotateFilename.replace(/\.pdf$/i, '');
      const filename = getCustomFilename('rotateOutputFilename', `${baseName}_rotated.pdf`);
      const blob = new Blob([rotatedBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `Rotated Document // ${AppState.rotateDoc.numPages} pages`);
      termLog(`PDF rotation complete. Saved as ${filename}`, 'success');
    } catch (e) {
      termLog(`Rotation error: ${e.message}`, 'error');
      alert(`Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function previewRotateDoc() {
    if (!AppState.rotateBuffer || !AppState.rotateDoc) {
      termLog('Please select a PDF to rotate.', 'error');
      return;
    }

    const btn = document.getElementById('btnPreviewRotateDoc');
    if (btn) btn.disabled = true;
    termLog('Generating rotated preview...');

    try {
      const rotatedBytes = await PdfTools.rotatePdf(
        AppState.rotateBuffer.slice(0),
        {
          rotations: AppState.rotateAngles
        },
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.rotateFilename.replace(/\.pdf$/i, '');
      await openDocumentPreview(rotatedBytes, `${baseName}_rotated_preview.pdf`);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 06: IMAGE TO PDF
  // ==========================================
  async function addImg2PdfFile(file) {
    try {
      termLog(`Loading image: ${file.name}...`);
      const url = URL.createObjectURL(file);
      
      const img = new Image();
      img.onload = () => {
        const item = {
          id: 'img_' + Math.random().toString(36).substr(2, 9),
          file: file,
          name: file.name,
          size: file.size,
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height,
          url: url
        };
        AppState.img2pdfFiles.push(item);
        if (AppState.img2pdfFiles.length === 1) {
          setToolOutputFilename('img2pdfOutputFilename', file.name, '_document');
        }
        renderImg2PdfList();
        termLog(`Added ${file.name} (${item.width}x${item.height}px). Total: ${AppState.img2pdfFiles.length}`, 'success');
      };
      img.onerror = () => {
        termLog(`Failed to parse image: ${file.name}`, 'error');
      };
      img.src = url;
    } catch (e) {
      termLog(`Image error: ${e.message}`, 'error');
    }
  }

  function renderImg2PdfList() {
    const container = document.getElementById('img2pdfFileList');
    const emptyState = document.getElementById('img2pdfDropzone') || document.getElementById('img2pdfEmptyState');
    const btnProcess = document.getElementById('btnProcessImg2Pdf');
    const btnPreview = document.getElementById('btnPreviewImg2PdfDoc');
    const countBadge = document.getElementById('img2pdfCountBadge');

    if (!container) return;
    container.innerHTML = '';

    if (AppState.img2pdfFiles.length === 0) {
      if (emptyState) emptyState.classList.remove('hidden');
      if (btnProcess) btnProcess.disabled = true;
      if (btnPreview) btnPreview.disabled = true;
      if (countBadge) countBadge.textContent = '0 IMAGES';
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');
    if (btnProcess) btnProcess.disabled = false;
    if (btnPreview) btnPreview.disabled = false;
    if (countBadge) countBadge.textContent = `${AppState.img2pdfFiles.length} IMAGES`;

    AppState.img2pdfFiles.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'border border-black p-2 flex flex-wrap items-center justify-between gap-3 bg-white';
      row.innerHTML = `
        <div class="flex items-center gap-3">
          <span class="font-bold text-xs bg-black text-white px-2 py-1">[#${index + 1}]</span>
          <img src="${item.url}" class="w-12 h-12 object-contain border border-black bg-neutral-100" />
          <div>
            <div class="font-bold text-sm truncate max-w-xs md:max-w-md">${escapeHtml(item.name)}</div>
            <div class="text-xs text-neutral-600">${item.width}×${item.height}px // ${Converters.formatBytes(item.size)}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="term-btn text-xs py-1 px-2 btn-img-up" ${index === 0 ? 'disabled' : ''}>[↑ UP]</button>
          <button class="term-btn text-xs py-1 px-2 btn-img-down" ${index === AppState.img2pdfFiles.length - 1 ? 'disabled' : ''}>[↓ DOWN]</button>
          <button class="term-btn term-btn-danger text-xs py-1 px-2 btn-img-remove">[✕ REMOVE]</button>
        </div>
      `;

      row.querySelector('.btn-img-up').addEventListener('click', () => {
        if (index > 0) {
          const temp = AppState.img2pdfFiles[index - 1];
          AppState.img2pdfFiles[index - 1] = AppState.img2pdfFiles[index];
          AppState.img2pdfFiles[index] = temp;
          renderImg2PdfList();
        }
      });

      row.querySelector('.btn-img-down').addEventListener('click', () => {
        if (index < AppState.img2pdfFiles.length - 1) {
          const temp = AppState.img2pdfFiles[index + 1];
          AppState.img2pdfFiles[index + 1] = AppState.img2pdfFiles[index];
          AppState.img2pdfFiles[index] = temp;
          renderImg2PdfList();
        }
      });

      row.querySelector('.btn-img-remove').addEventListener('click', () => {
        URL.revokeObjectURL(item.url);
        AppState.img2pdfFiles = AppState.img2pdfFiles.filter((f) => f.id !== item.id);
        renderImg2PdfList();
        termLog(`Removed ${item.name}`);
      });

      container.appendChild(row);
    });
  }

  async function processImageToPdf() {
    if (AppState.img2pdfFiles.length === 0) {
      termLog('Please select at least one image.', 'error');
      return;
    }

    const pageSize = document.getElementById('img2pdfPageSizeSelect')?.value || 'A4';
    const orientation = document.getElementById('img2pdfOrientationSelect')?.value || 'auto';
    const margin = parseInt(document.getElementById('img2pdfMarginSelect')?.value || '0', 10);
    const fitMode = document.getElementById('img2pdfFitSelect')?.value || 'contain';

    const btn = document.getElementById('btnProcessImg2Pdf');
    if (btn) btn.disabled = true;
    termLog(`Converting ${AppState.img2pdfFiles.length} image(s) to PDF...`);

    try {
      const pdfBytes = await Converters.imagesToPdf(
        AppState.img2pdfFiles.map((item) => item.file),
        {
          pageSize,
          orientation,
          margin,
          fitMode
        },
        (curr, total, msg) => termLog(msg)
      );

      const defaultName = AppState.img2pdfFiles.length > 0
        ? `${AppState.img2pdfFiles[0].name.replace(/\.[^/.]+$/, '')}_document.pdf`
        : `images_converted_${Date.now()}.pdf`;
      const filename = getCustomFilename('img2pdfOutputFilename', defaultName);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `${AppState.img2pdfFiles.length} image(s) converted // ${Converters.formatBytes(blob.size)}`);
      termLog(`Conversion complete. Created ${filename}`, 'success');
    } catch (e) {
      termLog(`Image to PDF error: ${e.message}`, 'error');
      alert(`Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function previewImg2PdfDoc() {
    if (AppState.img2pdfFiles.length === 0) {
      termLog('Please select at least one image.', 'error');
      return;
    }

    const pageSize = document.getElementById('img2pdfPageSizeSelect')?.value || 'A4';
    const orientation = document.getElementById('img2pdfOrientationSelect')?.value || 'auto';
    const margin = parseInt(document.getElementById('img2pdfMarginSelect')?.value || '0', 10);
    const fitMode = document.getElementById('img2pdfFitSelect')?.value || 'contain';

    const btn = document.getElementById('btnPreviewImg2PdfDoc');
    if (btn) btn.disabled = true;
    termLog(`Compiling ${AppState.img2pdfFiles.length} image(s) for preview...`);

    try {
      const pdfBytes = await Converters.imagesToPdf(
        AppState.img2pdfFiles.map((item) => item.file),
        {
          pageSize,
          orientation,
          margin,
          fitMode
        },
        (curr, total, msg) => termLog(msg)
      );

      await openDocumentPreview(pdfBytes, 'Images_Compiled_Preview.pdf');
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 07: PDF TO IMAGE
  // ==========================================
  async function loadPdf2ImgPdf(file) {
    try {
      termLog(`Loading PDF for image conversion: ${file.name}...`);
      AppState.pdf2imgFilename = file.name;
      AppState.pdf2imgBuffer = await file.arrayBuffer();
      AppState.pdf2imgDoc = await PdfPreview.loadDocument(AppState.pdf2imgBuffer.slice(0));
      AppState.pdf2imgResults = [];
      setToolOutputFilename('pdf2imgOutputFilename', file.name, '_images', '.zip');

      document.getElementById('pdf2imgConfigSection').classList.remove('hidden');
      document.getElementById('pdf2imgDropzone')?.classList.add('hidden');
      document.getElementById('pdf2imgResultsSection').classList.add('hidden');
      document.getElementById('pdf2imgFileMeta').textContent = `${file.name} (${AppState.pdf2imgDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;
      const btnPrev = document.getElementById('btnPreviewPdf2ImgDoc');
      if (btnPrev) btnPrev.disabled = false;

      termLog(`PDF loaded. Choose resolution, format, and pages to convert.`, 'success');
    } catch (e) {
      termLog(`Failed to load PDF for image export: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  async function previewPdf2ImgDoc() {
    if (!AppState.pdf2imgBuffer || !AppState.pdf2imgDoc) {
      termLog('Please select a PDF file first.', 'error');
      return;
    }
    await openDocumentPreview(AppState.pdf2imgBuffer.slice(0), AppState.pdf2imgFilename || 'Source PDF');
  }

  async function processPdfToImage() {
    if (!AppState.pdf2imgBuffer || !AppState.pdf2imgDoc) {
      termLog('Please select a PDF file first.', 'error');
      return;
    }

    const format = document.getElementById('pdf2imgFormatSelect')?.value || 'image/png';
    const scale = parseFloat(document.getElementById('pdf2imgResolutionSelect')?.value || '2.0');
    const scope = document.getElementById('pdf2imgScopeSelect')?.value || 'all';

    let pagesToConvert = 'all';
    if (scope === 'range') {
      const rangeStr = document.getElementById('pdf2imgRangeInput')?.value || '';
      const set = Converters.parsePageRanges(rangeStr, AppState.pdf2imgDoc.numPages);
      pagesToConvert = Array.from(set);
      if (pagesToConvert.length === 0) {
        termLog('Invalid page range entered.', 'error');
        alert('Invalid page range.');
        return;
      }
    }

    const btn = document.getElementById('btnProcessPdf2Img');
    if (btn) btn.disabled = true;
    termLog(`Converting PDF pages to ${format === 'image/jpeg' ? 'JPEG' : 'PNG'} (Scale: ${scale}x)...`);

    try {
      // Clear previous results
      AppState.pdf2imgResults.forEach((r) => URL.revokeObjectURL(r.dataUrl));
      AppState.pdf2imgResults = [];

      const results = await Converters.pdfToImages(
        AppState.pdf2imgBuffer.slice(0),
        {
          format,
          scale,
          pages: pagesToConvert
        },
        (curr, total, msg) => termLog(msg)
      );

      AppState.pdf2imgResults = results;
      renderPdf2ImgResults();
      termLog(`Successfully generated ${results.length} image(s)!`, 'success');
    } catch (e) {
      termLog(`Conversion error: ${e.message}`, 'error');
      alert(`Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderPdf2ImgResults() {
    const resultsSection = document.getElementById('pdf2imgResultsSection');
    const grid = document.getElementById('pdf2imgGrid');
    if (!resultsSection || !grid) return;

    grid.innerHTML = '';
    resultsSection.classList.remove('hidden');

    AppState.pdf2imgResults.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'border border-black p-2 flex flex-col items-center bg-white';
      card.innerHTML = `
        <div class="w-full flex items-center justify-between text-xs font-mono border-b border-black pb-1 mb-2">
          <span class="font-bold">PAGE ${item.pageNum}</span>
          <span class="text-neutral-500">${Converters.formatBytes(item.blob.size)}</span>
        </div>
        <div class="border border-black bg-neutral-50 p-1 flex items-center justify-center overflow-hidden mb-2 max-h-48 w-full">
          <img src="${item.dataUrl}" class="max-h-44 object-contain" alt="Page ${item.pageNum}" />
        </div>
        <button class="term-btn text-xs w-full py-1 btn-download-single">
          [DOWNLOAD ${item.filename.toUpperCase()}]
        </button>
      `;

      card.querySelector('.btn-download-single').addEventListener('click', () => {
        Converters.downloadBlob(item.blob, item.filename);
        termLog(`Downloaded ${item.filename}`);
      });

      grid.appendChild(card);
    });

    // Setup ZIP download button
    const btnZip = document.getElementById('btnDownloadAllZip');
    if (btnZip) {
      btnZip.onclick = async () => {
        try {
          termLog('Creating ZIP archive of images...');
          btnZip.disabled = true;
          const zipBlob = await Converters.createZip(
            AppState.pdf2imgResults.map((r) => ({ filename: r.filename, blob: r.blob })),
            (curr, total, msg) => termLog(msg)
          );
          const defaultZip = `${AppState.pdf2imgFilename.replace(/\.pdf$/i, '')}_images.zip`;
          const zipName = getCustomFilename('pdf2imgOutputFilename', defaultZip, '.zip');
          Converters.downloadBlob(zipBlob, zipName);
          termLog(`Downloaded ZIP archive: ${zipName}`, 'success');
          showResultModal(zipBlob, zipName, 'zip', `${AppState.pdf2imgResults.length} image(s) bundled // ${Converters.formatBytes(zipBlob.size)}`);
        } catch (e) {
          termLog(`ZIP creation failed: ${e.message}`, 'error');
        } finally {
          btnZip.disabled = false;
        }
      };
    }
  }

  // ==========================================
  // TOOL 08: WATERMARK PDF
  // ==========================================
  async function loadWatermarkPdf(file) {
    try {
      termLog(`Loading PDF for watermarking: ${file.name}...`);
      AppState.watermarkFilename = file.name;
      AppState.watermarkBuffer = await file.arrayBuffer();
      AppState.watermarkDoc = await PdfPreview.loadDocument(AppState.watermarkBuffer.slice(0));
      AppState.watermarkCurrentPage = 1;
      setToolOutputFilename('watermarkOutputFilename', file.name, '_watermarked');

      const configSec = document.getElementById('watermarkConfigSection');
      if (configSec) configSec.classList.remove('hidden');
      document.getElementById('watermarkDropzone')?.classList.add('hidden');

      const meta = document.getElementById('watermarkFileMeta');
      if (meta) {
        meta.textContent = `${file.name} (${AppState.watermarkDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;
        meta.title = meta.textContent;
      }
      const btnPrev = document.getElementById('btnPreviewWatermarkDoc');
      if (btnPrev) btnPrev.disabled = false;

      await renderWatermarkPreview();
      termLog('PDF loaded for watermarking. Configure watermark settings on the left.', 'success');
    } catch (e) {
      termLog(`Failed to load PDF for watermarking: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  async function renderWatermarkPreview() {
    const canvas = document.getElementById('watermarkPreviewCanvas');
    if (!canvas || !AppState.watermarkDoc) return;

    const total = AppState.watermarkDoc.numPages;
    const pageNum = Math.max(1, Math.min(total, AppState.watermarkCurrentPage));
    AppState.watermarkCurrentPage = pageNum;

    const indicator = document.getElementById('watermarkPageIndicator');
    if (indicator) indicator.textContent = `PAGE ${pageNum} OF ${total}`;

    // Render underlying PDF page
    await PdfPreview.renderPageToCanvas(AppState.watermarkDoc, pageNum, canvas, { scale: 1.0, maxWidth: 650, maxHeight: 850 });

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const page = await AppState.watermarkDoc.getPage(pageNum);
    const unscaledVp = page.getViewport({ scale: 1.0 });
    const scaleFactor = W / unscaledVp.width;

    const mode = AppState.watermarkMode || 'text';

    if (mode === 'text') {
      const text = (document.getElementById('watermarkText')?.value || 'CONFIDENTIAL').trim();
      const fontSizePt = parseInt(document.getElementById('watermarkFontSize')?.value, 10) || 48;
      const fontPixelSize = Math.max(12, Math.round(fontSizePt * scaleFactor));
      const fontFamily = document.getElementById('watermarkFont')?.value || 'Helvetica';
      const color = document.getElementById('watermarkColor')?.value || '#000000';
      const opacity = (parseInt(document.getElementById('watermarkOpacity')?.value, 10) || 25) / 100;
      const angleDeg = parseInt(document.getElementById('watermarkRotation')?.value, 10) || 0;
      const rad = (angleDeg * Math.PI) / 180;
      const position = document.getElementById('watermarkPosition')?.value || 'center';

      ctx.save();
      ctx.font = `bold ${fontPixelSize}px "${fontFamily}", monospace, sans-serif`;
      ctx.fillStyle = color;
      ctx.globalAlpha = opacity;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textWidth = ctx.measureText(text).width;
      const marginPx = 40 * scaleFactor;

      if (position === 'tile') {
        const stepX = Math.max(160 * scaleFactor, textWidth + 80 * scaleFactor);
        const stepY = Math.max(120 * scaleFactor, 100 * scaleFactor);
        for (let gx = -stepX; gx <= W + stepX; gx += stepX) {
          for (let gy = -stepY; gy <= H + stepY; gy += stepY) {
            ctx.save();
            ctx.translate(gx, gy);
            ctx.rotate(rad);
            ctx.fillText(text, 0, 0);
            ctx.restore();
          }
        }
      } else {
        let cx = W / 2;
        let cy = H / 2;
        if (position === 'top-left') {
          cx = marginPx + textWidth / 2;
          cy = marginPx + fontPixelSize / 2;
        } else if (position === 'top-right') {
          cx = W - marginPx - textWidth / 2;
          cy = marginPx + fontPixelSize / 2;
        } else if (position === 'bottom-left') {
          cx = marginPx + textWidth / 2;
          cy = H - marginPx - fontPixelSize / 2;
        } else if (position === 'bottom-right') {
          cx = W - marginPx - textWidth / 2;
          cy = H - marginPx - fontPixelSize / 2;
        }

        ctx.translate(cx, cy);
        ctx.rotate(rad);
        ctx.fillText(text, 0, 0);
      }

      ctx.restore();
    } else if (mode === 'image' && AppState.watermarkImageUrl) {
      const img = new Image();
      img.src = AppState.watermarkImageUrl;
      await new Promise((res) => { img.onload = res; img.onerror = res; });

      if (img.width && img.height) {
        const scalePct = (parseInt(document.getElementById('watermarkImgScale')?.value, 10) || 40) / 100;
        const opacity = (parseInt(document.getElementById('watermarkImgOpacity')?.value, 10) || 30) / 100;
        const position = document.getElementById('watermarkImgPosition')?.value || 'center';

        const targetW = W * scalePct;
        const targetH = targetW * (img.height / img.width);

        let x = (W - targetW) / 2;
        let y = (H - targetH) / 2;
        const marginPx = 40 * scaleFactor;

        if (position === 'top-left') { x = marginPx; y = marginPx; }
        else if (position === 'top-right') { x = W - marginPx - targetW; y = marginPx; }
        else if (position === 'bottom-left') { x = marginPx; y = H - marginPx - targetH; }
        else if (position === 'bottom-right') { x = W - marginPx - targetW; y = H - marginPx - targetH; }

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.drawImage(img, x, y, targetW, targetH);
        ctx.restore();
      }
    }
  }

  async function processWatermark() {
    if (!AppState.watermarkBuffer || !AppState.watermarkDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessWatermark');
    if (btn) btn.disabled = true;
    termLog('Applying watermark...');

    try {
      const mode = AppState.watermarkMode || 'text';
      const scopeRadio = document.querySelector('input[name="watermarkScope"]:checked')?.value || 'all';

      let pages = 'all';
      if (scopeRadio === 'odd') pages = 'odd';
      else if (scopeRadio === 'even') pages = 'even';
      else if (scopeRadio === 'range') {
        const rangeStr = document.getElementById('watermarkRangeInput')?.value || '';
        pages = Array.from(Converters.parsePageRanges(rangeStr, AppState.watermarkDoc.numPages));
      }

      const options = {
        type: mode,
        pages
      };

      if (mode === 'text') {
        options.text = document.getElementById('watermarkText')?.value || 'CONFIDENTIAL';
        options.fontFamily = document.getElementById('watermarkFont')?.value || 'Helvetica';
        options.fontSize = parseInt(document.getElementById('watermarkFontSize')?.value, 10) || 48;
        options.color = document.getElementById('watermarkColor')?.value || '#000000';
        options.opacity = (parseInt(document.getElementById('watermarkOpacity')?.value, 10) || 25) / 100;
        options.rotation = parseInt(document.getElementById('watermarkRotation')?.value, 10) || 0;
        options.position = document.getElementById('watermarkPosition')?.value || 'center';
      } else {
        if (!AppState.watermarkImageBuffer) {
          throw new Error('Please select an image file for the watermark.');
        }
        options.imageBuffer = AppState.watermarkImageBuffer;
        options.imageType = AppState.watermarkImageType || 'png';
        options.imageScale = (parseInt(document.getElementById('watermarkImgScale')?.value, 10) || 40) / 100;
        options.opacity = (parseInt(document.getElementById('watermarkImgOpacity')?.value, 10) || 30) / 100;
        options.position = document.getElementById('watermarkImgPosition')?.value || 'center';
      }

      const watermarkedBytes = await PdfTools.addWatermark(
        AppState.watermarkBuffer.slice(0),
        options,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.watermarkFilename.replace(/\.pdf$/i, '');
      const filename = getCustomFilename('watermarkOutputFilename', `${baseName}_watermarked.pdf`);
      const blob = new Blob([watermarkedBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `Watermarked PDF // ${Converters.formatBytes(blob.size)}`);
      termLog(`Watermarking complete. Saved as ${filename}`, 'success');
    } catch (e) {
      termLog(`Watermarking error: ${e.message}`, 'error');
      alert(`Watermark Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function previewWatermarkDoc() {
    if (!AppState.watermarkBuffer || !AppState.watermarkDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnPreviewWatermarkDoc');
    if (btn) btn.disabled = true;
    termLog('Generating preview with watermark...');

    try {
      const mode = AppState.watermarkMode || 'text';
      const scopeRadio = document.querySelector('input[name="watermarkScope"]:checked')?.value || 'all';

      let pages = 'all';
      if (scopeRadio === 'odd') pages = 'odd';
      else if (scopeRadio === 'even') pages = 'even';
      else if (scopeRadio === 'range') {
        const rangeStr = document.getElementById('watermarkRangeInput')?.value || '';
        pages = Array.from(Converters.parsePageRanges(rangeStr, AppState.watermarkDoc.numPages));
      }

      const options = {
        type: mode,
        pages
      };

      if (mode === 'text') {
        options.text = document.getElementById('watermarkText')?.value || 'CONFIDENTIAL';
        options.fontFamily = document.getElementById('watermarkFont')?.value || 'Helvetica';
        options.fontSize = parseInt(document.getElementById('watermarkFontSize')?.value, 10) || 48;
        options.color = document.getElementById('watermarkColor')?.value || '#000000';
        options.opacity = (parseInt(document.getElementById('watermarkOpacity')?.value, 10) || 25) / 100;
        options.rotation = parseInt(document.getElementById('watermarkRotation')?.value, 10) || 0;
        options.position = document.getElementById('watermarkPosition')?.value || 'center';
      } else {
        if (!AppState.watermarkImageBuffer) {
          throw new Error('Please select an image file for the watermark.');
        }
        options.imageBuffer = AppState.watermarkImageBuffer;
        options.imageType = AppState.watermarkImageType || 'png';
        options.imageScale = (parseInt(document.getElementById('watermarkImgScale')?.value, 10) || 40) / 100;
        options.opacity = (parseInt(document.getElementById('watermarkImgOpacity')?.value, 10) || 30) / 100;
        options.position = document.getElementById('watermarkImgPosition')?.value || 'center';
      }

      const watermarkedBytes = await PdfTools.addWatermark(
        AppState.watermarkBuffer.slice(0),
        options,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.watermarkFilename.replace(/\.pdf$/i, '');
      await openDocumentPreview(watermarkedBytes, `${baseName}_watermark_preview.pdf`, AppState.watermarkCurrentPage || 1);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Watermark Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 09: HIDE CONTENT (REDACT) PDF
  // ==========================================
  async function loadRedactPdf(file) {
    try {
      termLog(`Loading PDF for content hiding/redaction: ${file.name}...`);
      AppState.redactFilename = file.name;
      AppState.redactBuffer = await file.arrayBuffer();
      AppState.redactDoc = await PdfPreview.loadDocument(AppState.redactBuffer.slice(0));
      AppState.redactCurrentPage = 1;
      AppState.redactBoxes = {};
      setToolOutputFilename('redactOutputFilename', file.name, '_redacted');

      const configSec = document.getElementById('redactConfigSection');
      if (configSec) configSec.classList.remove('hidden');
      document.getElementById('redactDropzone')?.classList.add('hidden');

      const meta = document.getElementById('redactFileMeta');
      if (meta) meta.textContent = `${file.name} (${AppState.redactDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;
      const btnPrev = document.getElementById('btnPreviewRedactDoc');
      if (btnPrev) btnPrev.disabled = false;

      await renderRedactPage();
      termLog('PDF loaded. Click and drag across the page to draw blackout or whiteout hiding boxes.', 'success');
    } catch (e) {
      termLog(`Failed to load PDF for redaction: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  async function renderRedactPage() {
    const baseCanvas = document.getElementById('redactBaseCanvas');
    const overlayCanvas = document.getElementById('redactOverlayCanvas');
    if (!baseCanvas || !overlayCanvas || !AppState.redactDoc) return;

    const total = AppState.redactDoc.numPages;
    const pageNum = Math.max(1, Math.min(total, AppState.redactCurrentPage));
    AppState.redactCurrentPage = pageNum;

    const indicator = document.getElementById('redactPageIndicator');
    if (indicator) indicator.textContent = `PAGE ${pageNum} OF ${total}`;

    // Render underlying base page matching standard preview scale and limits
    await PdfPreview.renderPageToCanvas(AppState.redactDoc, pageNum, baseCanvas, { scale: 1.0, maxWidth: 650, maxHeight: 850 });

    // Explicitly lock wrapper to exact base canvas dimensions and aspect ratio
    const wrapper = document.getElementById('redactCanvasWrapper');
    if (wrapper) {
      wrapper.style.width = baseCanvas.style.width;
      wrapper.style.height = baseCanvas.style.height;
      wrapper.style.maxWidth = '100%';
      wrapper.style.aspectRatio = baseCanvas.style.aspectRatio;
    }

    // Match overlay canvas size, DPR, and display dimensions exactly to baseCanvas
    overlayCanvas.width = baseCanvas.width;
    overlayCanvas.height = baseCanvas.height;
    overlayCanvas.style.width = baseCanvas.style.width;
    overlayCanvas.style.height = baseCanvas.style.height;
    overlayCanvas.style.maxWidth = '100%';
    overlayCanvas.style.aspectRatio = baseCanvas.style.aspectRatio;

    drawRedactOverlay();
    updateRedactBoxList();
  }

  function drawRedactOverlay(dragRect = null) {
    const overlayCanvas = document.getElementById('redactOverlayCanvas');
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    const pageBoxes = AppState.redactBoxes[AppState.redactCurrentPage] || [];
    pageBoxes.forEach((box, idx) => {
      const bx = box.normX * overlayCanvas.width;
      const by = box.normY * overlayCanvas.height;
      const bw = box.normW * overlayCanvas.width;
      const bh = box.normH * overlayCanvas.height;

      if (box.type === 'whiteout') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);
      } else {
        // Blackout
        ctx.fillStyle = '#000000';
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeStyle = '#444444';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx, by, bw, bh);
      }

      // Draw box index label tag
      ctx.fillStyle = box.type === 'whiteout' ? '#000000' : '#ffffff';
      ctx.font = '10px monospace';
      ctx.fillText(`[#${idx + 1}]`, bx + 3, by + 12);
    });

    if (dragRect) {
      const isWhiteout = AppState.redactActiveStyle === 'whiteout';
      ctx.fillStyle = isWhiteout ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)';
      ctx.fillRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);

      ctx.strokeStyle = isWhiteout ? '#2563eb' : '#dc2626';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(dragRect.x, dragRect.y, dragRect.w, dragRect.h);
      ctx.setLineDash([]);
    }
  }

  function updateRedactBoxList() {
    const listEl = document.getElementById('redactBoxList');
    const badge = document.getElementById('pageBoxBadge');
    const pageCountEl = document.getElementById('redactPageBoxesCount');
    const totalBadge = document.getElementById('redactTotalBoxesBadge');

    const pageNum = AppState.redactCurrentPage;
    const pageBoxes = AppState.redactBoxes[pageNum] || [];

    if (badge) badge.textContent = `[${pageBoxes.length}]`;
    if (pageCountEl) pageCountEl.textContent = `${pageBoxes.length} box(es) on Page ${pageNum}`;

    let totalAllBoxes = 0;
    Object.values(AppState.redactBoxes).forEach((arr) => { totalAllBoxes += (arr ? arr.length : 0); });
    if (totalBadge) totalBadge.textContent = `${totalAllBoxes} BOXES APPLIED`;

    if (!listEl) return;
    listEl.innerHTML = '';

    if (pageBoxes.length === 0) {
      listEl.innerHTML = `
        <div class="text-neutral-500 text-xs italic p-2 border border-dashed border-neutral-300">
          No boxes on Page ${pageNum} yet.<br>Click and drag on the page to hide content.
        </div>
      `;
      return;
    }

    pageBoxes.forEach((box, idx) => {
      const item = document.createElement('div');
      item.className = 'flex items-center justify-between border border-black p-1.5 bg-neutral-50 hover:bg-neutral-100 text-xs';
      item.innerHTML = `
        <div class="flex items-center gap-1.5 overflow-hidden">
          <span class="w-2.5 h-2.5 border border-black inline-block" style="background-color: ${box.type === 'whiteout' ? '#ffffff' : '#000000'};"></span>
          <span class="font-bold">#${idx + 1}</span>
          <span class="uppercase text-[10px] text-neutral-600">${box.type}</span>
        </div>
        <button type="button" class="term-btn text-[10px] py-0.5 px-1.5 hover:bg-black hover:text-white" title="Delete box">
          ✕
        </button>
      `;
      item.querySelector('button').addEventListener('click', () => {
        deleteRedactBox(pageNum, box.id);
      });
      listEl.appendChild(item);
    });
  }

  function deleteRedactBox(pageNum, boxId) {
    if (!AppState.redactBoxes[pageNum]) return;
    AppState.redactBoxes[pageNum] = AppState.redactBoxes[pageNum].filter((b) => b.id !== boxId);
    drawRedactOverlay();
    updateRedactBoxList();
    termLog(`Deleted box on Page ${pageNum}.`);
  }

  async function processRedact() {
    if (!AppState.redactBuffer || !AppState.redactDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const allBoxes = [];
    Object.keys(AppState.redactBoxes).forEach((pageStr) => {
      const pNum = parseInt(pageStr, 10);
      const boxes = AppState.redactBoxes[pNum] || [];
      boxes.forEach((b) => allBoxes.push({ ...b, page: pNum }));
    });

    if (allBoxes.length === 0) {
      alert('Please draw at least one hiding/redaction box on the document first.');
      return;
    }

    const btn = document.getElementById('btnProcessRedact');
    if (btn) btn.disabled = true;
    termLog(`Permanently applying ${allBoxes.length} redaction box(es)...`);

    try {
      const redactedBytes = await PdfTools.redactPdf(
        AppState.redactBuffer.slice(0),
        allBoxes,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.redactFilename.replace(/\.pdf$/i, '');
      const filename = getCustomFilename('redactOutputFilename', `${baseName}_redacted.pdf`);
      const blob = new Blob([redactedBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `Sanitized PDF (${allBoxes.length} boxes) // ${Converters.formatBytes(blob.size)}`);
      termLog(`Redaction complete. Saved as ${filename}`, 'success');
    } catch (e) {
      termLog(`Redaction error: ${e.message}`, 'error');
      alert(`Redaction Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function previewRedactDoc() {
    if (!AppState.redactBuffer || !AppState.redactDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const allBoxes = [];
    Object.keys(AppState.redactBoxes).forEach((pageStr) => {
      const pNum = parseInt(pageStr, 10);
      const boxes = AppState.redactBoxes[pNum] || [];
      boxes.forEach((b) => allBoxes.push({ ...b, page: pNum }));
    });

    if (allBoxes.length === 0) {
      await openDocumentPreview(AppState.redactBuffer.slice(0), `${AppState.redactFilename} (No Redactions Drawn)`);
      return;
    }

    const btn = document.getElementById('btnPreviewRedactDoc');
    if (btn) btn.disabled = true;
    termLog(`Generating preview with ${allBoxes.length} redaction box(es)...`);

    try {
      const redactedBytes = await PdfTools.redactPdf(
        AppState.redactBuffer.slice(0),
        allBoxes,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.redactFilename.replace(/\.pdf$/i, '');
      await openDocumentPreview(redactedBytes, `${baseName}_redacted_preview.pdf`, AppState.redactCurrentPage || 1);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Redaction Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 10: ADD PAGE NUMBERS
  // ==========================================
  async function loadPageNumbersPdf(file) {
    try {
      termLog(`Loading PDF for page numbering: ${file.name}...`);
      AppState.pageNumbersFilename = file.name;
      AppState.pageNumbersBuffer = await file.arrayBuffer();
      AppState.pageNumbersDoc = await PdfPreview.loadDocument(AppState.pageNumbersBuffer.slice(0));
      AppState.pageNumbersCurrentPage = 1;
      setToolOutputFilename('pageNumbersOutputFilename', file.name, '_numbered');

      const configSec = document.getElementById('pageNumbersConfigSection');
      if (configSec) configSec.classList.remove('hidden');
      document.getElementById('pageNumbersDropzone')?.classList.add('hidden');

      const meta = document.getElementById('pageNumbersFileMeta');
      if (meta) meta.textContent = `${file.name} (${AppState.pageNumbersDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;
      const btnPrev = document.getElementById('btnPreviewPageNumbersDoc');
      if (btnPrev) btnPrev.disabled = false;

      await renderPageNumbersPreview();
      termLog('PDF loaded. Configure page number position and style.', 'success');
    } catch (e) {
      termLog(`Failed to load PDF for page numbers: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  async function renderPageNumbersPreview() {
    const canvas = document.getElementById('pageNumbersPreviewCanvas');
    if (!canvas || !AppState.pageNumbersDoc) return;

    const total = AppState.pageNumbersDoc.numPages;
    const pageNum = Math.max(1, Math.min(total, AppState.pageNumbersCurrentPage));
    AppState.pageNumbersCurrentPage = pageNum;

    const indicator = document.getElementById('numPageIndicator');
    if (indicator) indicator.textContent = `PAGE ${pageNum} OF ${total}`;

    // Render underlying page
    await PdfPreview.renderPageToCanvas(AppState.pageNumbersDoc, pageNum, canvas, { scale: 1.0, maxWidth: 650, maxHeight: 850 });

    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;

    const page = await AppState.pageNumbersDoc.getPage(pageNum);
    const unscaledVp = page.getViewport({ scale: 1.0 });
    const scaleFactor = W / unscaledVp.width;

    const skipCover = !!document.getElementById('chkSkipCover')?.checked;
    if (skipCover && pageNum === 1) {
      // Cover page: show subtle indicator that cover page is unnumbered
      ctx.save();
      ctx.fillStyle = '#666666';
      ctx.font = 'italic 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('[Cover page - numbering skipped]', W / 2, H - 20 * scaleFactor);
      ctx.restore();
      return;
    }

    // Format template
    let format = document.getElementById('numFormatPreset')?.value || 'Page {n} of {total}';
    if (format === 'CUSTOM') {
      format = document.getElementById('customFormatInput')?.value || 'Page {n} of {total}';
    }

    const startNum = parseInt(document.getElementById('numStart')?.value, 10) || 1;
    const currentDisplayNum = skipCover ? (pageNum - 1 + (startNum - 1)) : (pageNum - 1 + startNum);
    const totalDisplayNum = skipCover ? Math.max(1, total - 1) : total;

    const text = format.replace(/\{n\}/g, String(currentDisplayNum)).replace(/\{total\}/g, String(totalDisplayNum));

    const fontSizePt = parseInt(document.getElementById('numFontSize')?.value, 10) || 10;
    const fontPixelSize = Math.max(9, Math.round(fontSizePt * scaleFactor));
    const fontFamily = document.getElementById('numFont')?.value || 'Helvetica';
    const color = document.getElementById('numColor')?.value || '#000000';
    const marginPx = (parseInt(document.getElementById('numMargin')?.value, 10) || 36) * scaleFactor;
    const alternating = !!document.getElementById('chkAlternatingMargins')?.checked;

    let position = document.getElementById('numPosition')?.value || 'bottom-center';
    if (alternating) {
      const isOdd = pageNum % 2 === 1;
      const isTop = position.startsWith('top');
      position = isTop ? (isOdd ? 'top-right' : 'top-left') : (isOdd ? 'bottom-right' : 'bottom-left');
    }

    ctx.save();
    ctx.font = `${fontPixelSize}px "${fontFamily}", monospace, sans-serif`;
    ctx.fillStyle = color;

    let x = W / 2;
    let y = H - marginPx;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';

    if (position === 'bottom-center') {
      x = W / 2; y = H - marginPx; ctx.textAlign = 'center';
    } else if (position === 'bottom-left') {
      x = marginPx; y = H - marginPx; ctx.textAlign = 'left';
    } else if (position === 'bottom-right') {
      x = W - marginPx; y = H - marginPx; ctx.textAlign = 'right';
    } else if (position === 'top-center') {
      x = W / 2; y = marginPx + fontPixelSize; ctx.textAlign = 'center';
    } else if (position === 'top-left') {
      x = marginPx; y = marginPx + fontPixelSize; ctx.textAlign = 'left';
    } else if (position === 'top-right') {
      x = W - marginPx; y = marginPx + fontPixelSize; ctx.textAlign = 'right';
    }

    ctx.fillText(text, x, y);
    ctx.restore();
  }

  async function processPageNumbers() {
    if (!AppState.pageNumbersBuffer || !AppState.pageNumbersDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessPageNumbers');
    if (btn) btn.disabled = true;
    termLog('Adding page numbers to PDF...');

    try {
      let format = document.getElementById('numFormatPreset')?.value || 'Page {n} of {total}';
      if (format === 'CUSTOM') {
        format = document.getElementById('customFormatInput')?.value || 'Page {n} of {total}';
      }

      const scopeRadio = document.querySelector('input[name="numScope"]:checked')?.value || 'all';
      let pages = 'all';
      if (scopeRadio === 'range') {
        const rangeStr = document.getElementById('numRangeInput')?.value || '';
        pages = Array.from(Converters.parsePageRanges(rangeStr, AppState.pageNumbersDoc.numPages));
      }

      const options = {
        format,
        position: document.getElementById('numPosition')?.value || 'bottom-center',
        startNumber: parseInt(document.getElementById('numStart')?.value, 10) || 1,
        skipCover: !!document.getElementById('chkSkipCover')?.checked,
        margin: parseInt(document.getElementById('numMargin')?.value, 10) || 36,
        fontSize: parseInt(document.getElementById('numFontSize')?.value, 10) || 10,
        fontFamily: document.getElementById('numFont')?.value || 'Helvetica',
        color: document.getElementById('numColor')?.value || '#000000',
        alternatingMargins: !!document.getElementById('chkAlternatingMargins')?.checked,
        pages
      };

      const numberedBytes = await PdfTools.addPageNumbers(
        AppState.pageNumbersBuffer.slice(0),
        options,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.pageNumbersFilename.replace(/\.pdf$/i, '');
      const filename = getCustomFilename('pageNumbersOutputFilename', `${baseName}_numbered.pdf`);
      const blob = new Blob([numberedBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `Numbered PDF // ${Converters.formatBytes(blob.size)}`);
      termLog(`Page numbering complete. Saved as ${filename}`, 'success');
    } catch (e) {
      termLog(`Page numbering error: ${e.message}`, 'error');
      alert(`Page Numbering Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function previewPageNumbersDoc() {
    if (!AppState.pageNumbersBuffer || !AppState.pageNumbersDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnPreviewPageNumbersDoc');
    if (btn) btn.disabled = true;
    termLog('Generating preview with page numbers...');

    try {
      let format = document.getElementById('numFormatPreset')?.value || 'Page {n} of {total}';
      if (format === 'CUSTOM') {
        format = document.getElementById('customFormatInput')?.value || 'Page {n} of {total}';
      }

      const scopeRadio = document.querySelector('input[name="numScope"]:checked')?.value || 'all';
      let pages = 'all';
      if (scopeRadio === 'range') {
        const rangeStr = document.getElementById('numRangeInput')?.value || '';
        pages = Array.from(Converters.parsePageRanges(rangeStr, AppState.pageNumbersDoc.numPages));
      }

      const options = {
        format,
        position: document.getElementById('numPosition')?.value || 'bottom-center',
        startNumber: parseInt(document.getElementById('numStart')?.value, 10) || 1,
        skipCover: !!document.getElementById('chkSkipCover')?.checked,
        margin: parseInt(document.getElementById('numMargin')?.value, 10) || 36,
        fontSize: parseInt(document.getElementById('numFontSize')?.value, 10) || 10,
        fontFamily: document.getElementById('numFont')?.value || 'Helvetica',
        color: document.getElementById('numColor')?.value || '#000000',
        alternatingMargins: !!document.getElementById('chkAlternatingMargins')?.checked,
        pages
      };

      const numberedBytes = await PdfTools.addPageNumbers(
        AppState.pageNumbersBuffer.slice(0),
        options,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.pageNumbersFilename.replace(/\.pdf$/i, '');
      await openDocumentPreview(numberedBytes, `${baseName}_numbered_preview.pdf`, AppState.pageNumbersCurrentPage || 1);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Page Numbering Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 11: MULTIPLE PAGES PER SHEET (N-UP)
  // ==========================================
  async function loadNUpPdf(file) {
    try {
      termLog(`Loading PDF for N-Up multi-page layout: ${file.name}...`);
      AppState.nUpFilename = file.name;
      AppState.nUpBuffer = await file.arrayBuffer();
      AppState.nUpDoc = await PdfPreview.loadDocument(AppState.nUpBuffer.slice(0));
      AppState.nUpCurrentSheet = 1;
      setToolOutputFilename('nupOutputFilename', file.name, `_${document.getElementById('nupChoice')?.value || '4'}up`);

      const configSec = document.getElementById('nupConfigSection');
      if (configSec) configSec.classList.remove('hidden');
      document.getElementById('nupDropzone')?.classList.add('hidden');
      document.getElementById('nUpDropzone')?.classList.add('hidden');

      const meta = document.getElementById('nupFileMeta');
      if (meta) meta.textContent = `${file.name} (${AppState.nUpDoc.numPages} pages, ${Converters.formatBytes(file.size)})`;
      const btnPrev = document.getElementById('btnPreviewNUpDoc');
      if (btnPrev) btnPrev.disabled = false;

      updateNUpSummary();
      await renderNUpPreview();
      termLog('PDF loaded. Select pages per sheet (2, 4, 6, 9, 16) and orientation.', 'success');
    } catch (e) {
      termLog(`Failed to load PDF for N-Up: ${e.message}`, 'error');
      alert(`Failed to load PDF: ${e.message}`);
    }
  }

  function updateNUpSummary() {
    if (!AppState.nUpDoc) return;
    const totalPages = AppState.nUpDoc.numPages;
    const nUp = parseInt(document.getElementById('nupChoice')?.value, 10) || 4;
    const totalSheets = Math.ceil(totalPages / nUp);

    const summary = document.getElementById('nupSummaryText');
    if (summary) {
      summary.textContent = `Input: ${totalPages} pages → Output: ${totalSheets} sheet(s) (${nUp}-in-1)`;
    }

    const indicator = document.getElementById('nupSheetIndicator');
    if (indicator) {
      indicator.textContent = `SHEET ${AppState.nUpCurrentSheet} OF ${totalSheets}`;
    }
  }

  async function renderNUpPreview() {
    const canvas = document.getElementById('nupPreviewCanvas');
    if (!canvas || !AppState.nUpDoc) return;

    const totalPages = AppState.nUpDoc.numPages;
    const nUp = parseInt(document.getElementById('nupChoice')?.value, 10) || 4;
    const totalSheets = Math.ceil(totalPages / nUp);
    const sheetIdx = Math.max(1, Math.min(totalSheets, AppState.nUpCurrentSheet));
    AppState.nUpCurrentSheet = sheetIdx;

    updateNUpSummary();

    // Determine grid cols & rows
    let cols = 2, rows = 1;
    let defLandscape = true;
    if (nUp === 2) { cols = 2; rows = 1; defLandscape = true; }
    else if (nUp === 4) { cols = 2; rows = 2; defLandscape = false; }
    else if (nUp === 6) { cols = 3; rows = 2; defLandscape = true; }
    else if (nUp === 9) { cols = 3; rows = 3; defLandscape = false; }
    else if (nUp === 16) { cols = 4; rows = 4; defLandscape = false; }

    const orientSetting = document.getElementById('nupOrientation')?.value || 'auto';
    const isLandscape = orientSetting === 'auto' ? defLandscape : orientSetting === 'landscape';

    // Canvas dimensions for sheet
    const sheetW = isLandscape ? 700 : 500;
    const sheetH = isLandscape ? 500 : 700;

    canvas.width = sheetW;
    canvas.height = sheetH;
    let nupCont = canvas.parentElement;
    if (nupCont && nupCont.id && nupCont.id.includes('Wrapper') && nupCont.parentElement) {
      nupCont = nupCont.parentElement;
    }
    const availNupW = nupCont && nupCont.clientWidth ? Math.max(160, nupCont.clientWidth - 24) : (typeof window !== 'undefined' ? window.innerWidth - 32 : sheetW);
    const targetNupW = Math.min(availNupW, sheetW);
    const targetNupH = Math.round(targetNupW * (sheetH / sheetW));

    canvas.style.width = `${targetNupW}px`;
    canvas.style.height = `${targetNupH}px`;
    canvas.style.maxWidth = '100%';
    canvas.style.aspectRatio = `${sheetW} / ${sheetH}`;

    const nupWrapper = document.getElementById('nupCanvasWrapper');
    if (nupWrapper) {
      nupWrapper.style.width = `${targetNupW}px`;
      nupWrapper.style.height = `${targetNupH}px`;
      nupWrapper.style.maxWidth = '100%';
      nupWrapper.style.aspectRatio = `${sheetW} / ${sheetH}`;
    }

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, sheetW, sheetH);

    // Grid margins & cells
    const outerMargin = (parseInt(document.getElementById('nupMargin')?.value, 10) || 24) * 0.7;
    const spacing = (parseInt(document.getElementById('nupSpacing')?.value, 10) || 12) * 0.7;
    const drawBorder = !!document.getElementById('chkNUpBorder')?.checked;
    const pageOrder = document.getElementById('nupPageOrder')?.value || 'horizontal';

    const usableW = sheetW - 2 * outerMargin - (cols - 1) * spacing;
    const usableH = sheetH - 2 * outerMargin - (rows - 1) * spacing;
    const cellW = usableW / cols;
    const cellH = usableH / rows;

    const startPage = (sheetIdx - 1) * nUp + 1;

    for (let k = 0; k < nUp; k++) {
      const pageNum = startPage + k;
      if (pageNum > totalPages) break;

      let c = 0, r = 0;
      if (pageOrder === 'vertical') {
        r = k % rows; c = Math.floor(k / rows);
      } else {
        c = k % cols; r = Math.floor(k / cols);
      }

      const cellLeft = outerMargin + c * (cellW + spacing);
      const cellTop = outerMargin + r * (cellH + spacing);

      // Render mini-page using an offscreen canvas
      const offCanvas = document.createElement('canvas');
      await PdfPreview.renderPageToCanvas(AppState.nUpDoc, pageNum, offCanvas, {
        scale: 0.5,
        maxWidth: cellW,
        maxHeight: cellH
      });

      const miniW = offCanvas.width / (window.devicePixelRatio || 1);
      const miniH = offCanvas.height / (window.devicePixelRatio || 1);

      const miniX = cellLeft + (cellW - miniW) / 2;
      const miniY = cellTop + (cellH - miniH) / 2;

      ctx.drawImage(offCanvas, miniX, miniY, miniW, miniH);

      if (drawBorder) {
        ctx.strokeStyle = '#aaaaaa';
        ctx.lineWidth = 1;
        ctx.strokeRect(miniX, miniY, miniW, miniH);
      }

      // Draw subtle page number tag in corner of cell
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(miniX, miniY, 24, 14);
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`P.${pageNum}`, miniX + 12, miniY + 10);
    }
  }

  async function processNUp() {
    if (!AppState.nUpBuffer || !AppState.nUpDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessNUp');
    if (btn) btn.disabled = true;
    termLog('Generating N-Up combined document...');

    try {
      const nUp = parseInt(document.getElementById('nupChoice')?.value, 10) || 4;
      const sheetSizeKey = document.getElementById('nupSheetSize')?.value || 'A4';
      const sheetSize = PdfTools.PAGE_SIZES[sheetSizeKey] || PdfTools.PAGE_SIZES.A4;
      const orientation = document.getElementById('nupOrientation')?.value || 'auto';
      const pageOrder = document.getElementById('nupPageOrder')?.value || 'horizontal';
      const outerMargin = parseInt(document.getElementById('nupMargin')?.value, 10) || 24;
      const spacing = parseInt(document.getElementById('nupSpacing')?.value, 10) || 12;
      const drawBorder = !!document.getElementById('chkNUpBorder')?.checked;

      const scopeRadio = document.querySelector('input[name="nupScope"]:checked')?.value || 'all';
      let pages = 'all';
      if (scopeRadio === 'range') {
        const rangeStr = document.getElementById('nupRangeInput')?.value || '';
        pages = Array.from(Converters.parsePageRanges(rangeStr, AppState.nUpDoc.numPages));
      }

      const options = {
        nUp,
        sheetSize,
        orientation,
        pageOrder,
        outerMargin,
        spacing,
        drawBorder,
        pages
      };

      const nUpBytes = await PdfTools.createNUp(
        AppState.nUpBuffer.slice(0),
        options,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.nUpFilename.replace(/\.pdf$/i, '');
      const filename = getCustomFilename('nupOutputFilename', `${baseName}_${nUp}up.pdf`);
      const blob = new Blob([nUpBytes], { type: 'application/pdf' });

      showResultModal(blob, filename, 'pdf', `N-Up PDF (${nUp} pages/sheet) // ${Converters.formatBytes(blob.size)}`);
      termLog(`N-Up creation complete. Saved as ${filename}`, 'success');
    } catch (e) {
      termLog(`N-Up generation error: ${e.message}`, 'error');
      alert(`N-Up Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function previewNUpDoc() {
    if (!AppState.nUpBuffer || !AppState.nUpDoc) {
      termLog('No PDF document loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnPreviewNUpDoc');
    if (btn) btn.disabled = true;
    termLog('Generating N-Up preview...');

    try {
      const nUp = parseInt(document.getElementById('nupChoice')?.value, 10) || 4;
      const sheetSizeKey = document.getElementById('nupSheetSize')?.value || 'A4';
      const sheetSize = PdfTools.PAGE_SIZES[sheetSizeKey] || PdfTools.PAGE_SIZES.A4;
      const orientation = document.getElementById('nupOrientation')?.value || 'auto';
      const pageOrder = document.getElementById('nupPageOrder')?.value || 'horizontal';
      const outerMargin = parseInt(document.getElementById('nupMargin')?.value, 10) || 24;
      const spacing = parseInt(document.getElementById('nupSpacing')?.value, 10) || 12;
      const drawBorder = !!document.getElementById('chkNUpBorder')?.checked;

      const scopeRadio = document.querySelector('input[name="nupScope"]:checked')?.value || 'all';
      let pages = 'all';
      if (scopeRadio === 'range') {
        const rangeStr = document.getElementById('nupRangeInput')?.value || '';
        pages = Array.from(Converters.parsePageRanges(rangeStr, AppState.nUpDoc.numPages));
      }

      const options = {
        nUp,
        sheetSize,
        orientation,
        pageOrder,
        outerMargin,
        spacing,
        drawBorder,
        pages
      };

      const nUpBytes = await PdfTools.createNUp(
        AppState.nUpBuffer.slice(0),
        options,
        (curr, total, msg) => termLog(msg)
      );

      const baseName = AppState.nUpFilename.replace(/\.pdf$/i, '');
      await openDocumentPreview(nUpBytes, `${baseName}_${nUp}up_preview.pdf`);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`N-Up Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // TOOL 12: VISUAL SCISSOR SPLIT PDF
  // ==========================================

  async function loadSplitPdf(file) {
    try {
      termLog(`Loading PDF for visual splitting: ${file.name}...`);
      AppState.splitFilename = file.name;
      AppState.splitBuffer = await file.arrayBuffer();
      AppState.splitDoc = await PdfPreview.loadDocument(AppState.splitBuffer.slice(0));

      const totalPages = AppState.splitDoc.numPages;
      termLog(`PDF loaded: ${file.name} (${totalPages} pages).`, 'success');

      const meta = document.getElementById('splitFileMeta');
      if (meta) meta.textContent = `${file.name} (${totalPages} pages • ${Converters.formatBytes(file.size)})`;

      setToolOutputFilename('splitOutputFilename', file.name, '_split');

      const pageCountDisp = document.getElementById('splitPageCountDisplay');
      if (pageCountDisp) pageCountDisp.textContent = totalPages;

      // Populate AppState.splitPages
      AppState.splitPages = [];
      const fileId = 'file_' + Math.random().toString(36).substr(2, 7);
      for (let p = 1; p <= totalPages; p++) {
        AppState.splitPages.push({
          id: 'split_p_' + Math.random().toString(36).substr(2, 9),
          fileId: fileId,
          fileName: file.name,
          buffer: AppState.splitBuffer,
          fileBuffer: AppState.splitBuffer,
          pageNumber: p,       // 1-indexed in source
          pageIndex: p - 1,    // 0-indexed in source
          rotation: 0,
          pdfDoc: AppState.splitDoc
        });
      }

      // Initialize cuts: default to no cuts (1 combined PDF)
      AppState.splitCuts.clear();

      // Show config, hide dropzone
      document.getElementById('splitDropzone')?.classList.add('hidden');
      document.getElementById('splitConfigSection')?.classList.remove('hidden');

      const btnPreview = document.getElementById('btnPreviewSplitDoc');
      const btnProcess = document.getElementById('btnProcessSplit');
      if (btnPreview) btnPreview.disabled = false;
      if (btnProcess) btnProcess.disabled = false;

      renderSplitWorkspace();
      syncSplitRangesFromCuts();
      updateSplitSummary();
    } catch (err) {
      termLog(`Error loading PDF for splitting: ${err.message}`, 'error');
      alert(`Could not load PDF: ${err.message}`);
    }
  }

  async function addMoreSplitFiles(files) {
    if (!files || files.length === 0) return;
    termLog(`Adding ${files.length} additional file(s) to split sequence...`);

    for (const file of files) {
      try {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        let buffer;
        let pdfDoc;

        if (isPdf) {
          buffer = await file.arrayBuffer();
          pdfDoc = await PdfPreview.loadDocument(buffer.slice(0));
          const numPages = pdfDoc.numPages;
          const fileId = 'file_' + Math.random().toString(36).substr(2, 7);

          // Place an automatic cut right before the new file's pages if pages already exist
          if (AppState.splitPages.length > 0) {
            AppState.splitCuts.add(AppState.splitPages.length);
          }

          for (let p = 1; p <= numPages; p++) {
            AppState.splitPages.push({
              id: 'split_p_' + Math.random().toString(36).substr(2, 9),
              fileId: fileId,
              fileName: file.name,
              buffer: buffer,
              fileBuffer: buffer,
              pageNumber: p,
              pageIndex: p - 1,
              rotation: 0,
              pdfDoc: pdfDoc
            });
          }
          termLog(`Appended ${file.name} (${numPages} pages).`, 'success');
        } else if (file.type.startsWith('image/') || /\.(jpe?g|png|webp|bmp|gif)$/i.test(file.name)) {
          termLog(`Compiling image "${file.name}" to PDF page...`);
          const imgPdfBytes = await Converters.imagesToPdf([file], { pageSize: 'A4', fit: 'contain' });
          buffer = imgPdfBytes.buffer || imgPdfBytes;
          pdfDoc = await PdfPreview.loadDocument(buffer.slice ? buffer.slice(0) : buffer);
          const fileId = 'file_' + Math.random().toString(36).substr(2, 7);

          if (AppState.splitPages.length > 0) {
            AppState.splitCuts.add(AppState.splitPages.length);
          }

          AppState.splitPages.push({
            id: 'split_p_' + Math.random().toString(36).substr(2, 9),
            fileId: fileId,
            fileName: file.name,
            buffer: buffer,
            fileBuffer: buffer,
            pageNumber: 1,
            pageIndex: 0,
            rotation: 0,
            pdfDoc: pdfDoc
          });
          termLog(`Appended image ${file.name} as page.`, 'success');
        }
      } catch (err) {
        termLog(`Error adding file "${file.name}": ${err.message}`, 'error');
      }
    }

    const pageCountDisp = document.getElementById('splitPageCountDisplay');
    if (pageCountDisp) pageCountDisp.textContent = AppState.splitPages.length;

    renderSplitWorkspace();
    syncSplitRangesFromCuts();
    updateSplitSummary();
  }

  function toggleSplitCut(cutIndex) {
    if (cutIndex <= 0 || cutIndex >= AppState.splitPages.length) return;

    if (AppState.splitCuts.has(cutIndex)) {
      AppState.splitCuts.delete(cutIndex);
      termLog(`Removed split line after page ${cutIndex}.`);
    } else {
      AppState.splitCuts.add(cutIndex);
      termLog(`Added split line after page ${cutIndex}.`, 'success');
    }

    renderSplitWorkspace();
    syncSplitRangesFromCuts();
    updateSplitSummary();
  }

  function splitAllPages() {
    if (AppState.splitPages.length <= 1) return;
    AppState.splitCuts.clear();
    for (let i = 1; i < AppState.splitPages.length; i++) {
      AppState.splitCuts.add(i);
    }
    termLog(`Split all pages: placed cut after every page (${AppState.splitCuts.size} cuts).`, 'success');
    renderSplitWorkspace();
    syncSplitRangesFromCuts();
    updateSplitSummary();
  }

  function splitEveryNPagess(n = 2) {
    if (AppState.splitPages.length <= 1) return;
    const interval = Math.max(1, parseInt(n, 10) || 2);
    AppState.splitCuts.clear();
    for (let i = interval; i < AppState.splitPages.length; i += interval) {
      AppState.splitCuts.add(i);
    }
    termLog(`Placed cuts every ${interval} pages (${AppState.splitCuts.size} cuts).`, 'success');
    renderSplitWorkspace();
    syncSplitRangesFromCuts();
    updateSplitSummary();
  }

  function clearSplitCuts() {
    AppState.splitCuts.clear();
    termLog('Cleared all split cuts (all pages merged into 1 document).');
    renderSplitWorkspace();
    syncSplitRangesFromCuts();
    updateSplitSummary();
  }

  function deleteSplitPage(pageId) {
    const idx = AppState.splitPages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;

    const removedPage = AppState.splitPages[idx];
    AppState.splitPages.splice(idx, 1);

    // Re-adjust split cuts
    const newCuts = new Set();
    AppState.splitCuts.forEach((c) => {
      if (c < idx + 1) {
        newCuts.add(c);
      } else if (c > idx + 1) {
        newCuts.add(c - 1);
      }
    });
    newCuts.delete(AppState.splitPages.length);
    AppState.splitCuts = newCuts;

    termLog(`Removed page ${idx + 1} (${removedPage.fileName}). Remaining: ${AppState.splitPages.length} pages.`);

    const pageCountDisp = document.getElementById('splitPageCountDisplay');
    if (pageCountDisp) pageCountDisp.textContent = AppState.splitPages.length;

    renderSplitWorkspace();
    syncSplitRangesFromCuts();
    updateSplitSummary();
  }

  async function rotateSplitPage(pageId, delta = 90) {
    const page = AppState.splitPages.find((p) => p.id === pageId);
    if (!page) return;

    page.rotation = (page.rotation + delta + 360) % 360;
    termLog(`Rotated page ${page.pageNumber} (${page.fileName}) by ${delta}° (now ${page.rotation}°).`);

    const card = document.querySelector(`.split-page-card[data-page-id="${pageId}"]`);
    if (card) {
      const canvas = card.querySelector('canvas');
      if (canvas && page.pdfDoc) {
        try {
          await PdfPreview.renderPageToCanvas(page.pdfDoc, page.pageNumber, canvas, { scale: 0.25, rotation: page.rotation });
        } catch (e) {}
      }
    }
  }

  function previewSplitSinglePage(pageId) {
    const idx = AppState.splitPages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    const page = AppState.splitPages[idx];
    const buf = page.buffer || page.fileBuffer || AppState.splitBuffer;
    openDocumentPreview(buf, `${page.fileName} (Page ${page.pageNumber})`, page.pageNumber);
  }

  function syncSplitRangesFromCuts() {
    const input = document.getElementById('splitRangeInput');
    if (!input) return;

    const groups = getSplitCustomGroups();
    const parts = groups.map((g) => {
      const startP = g.pages[0].displayIndex;
      const endP = g.pages[g.pages.length - 1].displayIndex;
      return startP === endP ? `${startP}` : `${startP}-${endP}`;
    });

    input.value = parts.join(', ');
  }

  function syncSplitCutsFromRanges(rangeStr) {
    if (!rangeStr || !rangeStr.trim() || AppState.splitPages.length === 0) return;
    const maxP = AppState.splitPages.length;
    const groups = PdfTools.parseSplitRanges(rangeStr, maxP);
    if (groups.length === 0) return;

    AppState.splitCuts.clear();
    groups.forEach((g) => {
      const lastPageNum = g.pages[g.pages.length - 1];
      if (lastPageNum < maxP) {
        AppState.splitCuts.add(lastPageNum);
      }
    });

    renderSplitWorkspace();
    updateSplitSummary();
  }

  function getSplitCustomGroups() {
    if (!AppState.splitPages || AppState.splitPages.length === 0) return [];

    const total = AppState.splitPages.length;
    const cutsSorted = Array.from(AppState.splitCuts).sort((a, b) => a - b);
    const groups = [];

    let currentStart = 0; // 0-indexed in splitPages
    for (const cutPos of cutsSorted) {
      if (cutPos > currentStart && cutPos < total) {
        const pagesInGroup = [];
        for (let j = currentStart; j < cutPos; j++) {
          const p = AppState.splitPages[j];
          pagesInGroup.push({
            ...p,
            buffer: p.buffer || p.fileBuffer || AppState.splitBuffer,
            fileBuffer: p.fileBuffer || p.buffer || AppState.splitBuffer,
            displayIndex: j + 1
          });
        }
        if (pagesInGroup.length > 0) {
          const startNum = currentStart + 1;
          const endNum = cutPos;
          const label = startNum === endNum ? `page_${startNum}` : `pages_${startNum}-${endNum}`;
          groups.push({
            label,
            partIndex: groups.length + 1,
            pages: pagesInGroup
          });
        }
        currentStart = cutPos;
      }
    }

    if (currentStart < total) {
      const pagesInGroup = [];
      for (let j = currentStart; j < total; j++) {
        const p = AppState.splitPages[j];
        pagesInGroup.push({
          ...p,
          buffer: p.buffer || p.fileBuffer || AppState.splitBuffer,
          fileBuffer: p.fileBuffer || p.buffer || AppState.splitBuffer,
          displayIndex: j + 1
        });
      }
      if (pagesInGroup.length > 0) {
        const startNum = currentStart + 1;
        const endNum = total;
        const label = startNum === endNum ? `page_${startNum}` : `pages_${startNum}-${endNum}`;
        groups.push({
          label,
          partIndex: groups.length + 1,
          pages: pagesInGroup
        });
      }
    }

    return groups;
  }

  function updateSplitSummary() {
    const summaryEl = document.getElementById('splitSummaryText');
    const badgeEl = document.getElementById('splitOutputBadge');
    const activeCutsEl = document.getElementById('splitActiveCutsCount');
    if (!summaryEl) return;

    if (activeCutsEl) activeCutsEl.textContent = AppState.splitCuts.size;

    const totalPages = AppState.splitPages.length;
    if (totalPages === 0) {
      summaryEl.textContent = 'No pages loaded.';
      return;
    }

    const groups = getSplitCustomGroups();
    const count = groups.length;

    if (count <= 1) {
      summaryEl.textContent = `Input: ${totalPages} pages → Output: 1 single PDF file (No cuts placed)`;
      if (badgeEl) {
        badgeEl.textContent = 'DIRECT PDF';
        badgeEl.className = 'border border-black bg-white text-black text-[10px] px-2 py-0.5 font-bold uppercase';
      }
      const splitInput = document.getElementById('splitOutputFilename');
      if (splitInput && splitInput.value.endsWith('.zip')) {
        splitInput.value = splitInput.value.replace(/\.zip$/i, '.pdf');
      }
    } else {
      const partsSummary = groups.map((g) => `Part ${g.partIndex}: p.${g.pages[0].displayIndex}${g.pages.length > 1 ? `-${g.pages[g.pages.length - 1].displayIndex}` : ''} (${g.pages.length}p)`).join(' • ');
      summaryEl.textContent = `Input: ${totalPages} pages → Output: ${count} PDF files [${partsSummary}]`;
      if (badgeEl) {
        badgeEl.textContent = 'ZIP ARCHIVE';
        badgeEl.className = 'bg-blue-600 text-white text-[10px] px-2 py-0.5 font-bold uppercase';
      }
      const splitInput = document.getElementById('splitOutputFilename');
      if (splitInput && splitInput.value.endsWith('.pdf')) {
        splitInput.value = splitInput.value.replace(/\.pdf$/i, '.zip');
      }
    }
  }

  async function renderSplitWorkspace() {
    const container = document.getElementById('splitWorkspaceContainer');
    if (!container) return;

    container.innerHTML = '';
    const totalPages = AppState.splitPages.length;

    if (totalPages === 0) {
      container.innerHTML = '<div class="text-xs text-neutral-500 font-mono p-4">No pages in sequence.</div>';
      return;
    }

    const groups = getSplitCustomGroups();
    const pageToPartMap = new Map();
    groups.forEach((g) => {
      g.pages.forEach((p) => pageToPartMap.set(p.id, g.partIndex));
    });

    for (let i = 0; i < totalPages; i++) {
      const page = AppState.splitPages[i];
      const pageNumDisplay = `Page ${i + 1}`;
      const partNum = pageToPartMap.get(page.id) || 1;
      const isFirstOfPart = i === 0 || AppState.splitCuts.has(i);
      const cutIndex = i + 1;
      const isCut = AppState.splitCuts.has(cutIndex);

      // 1. Page Card (Grid Cell)
      const card = document.createElement('div');
      card.className = `split-page-card bg-white border-2 ${isFirstOfPart && i > 0 ? 'border-blue-600 shadow-[3px_3px_0px_0px_rgba(37,99,235,1)] ring-2 ring-blue-200' : (AppState.splitSelectedPageId === page.id ? 'border-blue-500 shadow-[3px_3px_0px_0px_rgba(59,130,246,1)] ring-2 ring-blue-200' : 'border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]')} flex flex-col justify-between w-full select-none group relative transition-all`;
      card.dataset.pageId = page.id;
      card.dataset.pageIndex = i;

      card.innerHTML = `
        ${isFirstOfPart && i > 0 ? `
          <div class="bg-blue-600 text-white px-2 py-0.5 text-[10px] font-mono font-bold flex items-center justify-between border-b border-blue-700">
            <span class="flex items-center gap-1"><span>✂</span> <span>PART ${partNum}</span></span>
            <span class="text-[9px] opacity-90 uppercase">NEW FILE STARTS</span>
          </div>
        ` : ''}

        <div class="flex items-center justify-between p-1.5 bg-neutral-50 border-b border-neutral-200 text-xs">
          <span class="text-[9px] font-mono font-bold px-1.5 py-0.2 ${isFirstOfPart ? 'bg-blue-600 text-white' : 'bg-neutral-200 text-neutral-700'} rounded-xs">
            PART ${partNum}
          </span>
          <div class="flex items-center gap-1">
            <button type="button" class="btn-card-preview p-1 text-neutral-500 hover:text-black hover:bg-neutral-200 rounded" title="Preview High-Res (🔍)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"/></svg>
            </button>
            <button type="button" class="btn-card-rotate p-1 text-neutral-500 hover:text-black hover:bg-neutral-200 rounded" title="Rotate 90° Clockwise (⟳)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            </button>
            <button type="button" class="btn-card-delete p-1 text-neutral-500 hover:text-red-600 hover:bg-red-50 rounded" title="Delete page (🗑)">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        </div>

        <div class="p-2 sm:p-3 bg-neutral-100 flex items-center justify-center cursor-pointer canvas-click-area">
          <div class="bg-white shadow-[2px_2px_4px_rgba(0,0,0,0.12)] border border-neutral-300 w-full aspect-[3/4] flex items-center justify-center overflow-hidden relative">
            <canvas class="max-w-full max-h-full object-contain"></canvas>
          </div>
        </div>

        <div class="p-1.5 sm:p-2 border-t border-neutral-200 flex flex-col items-center gap-1 bg-white">
          <span class="bg-rose-100 text-rose-800 border border-rose-300 font-mono text-[10px] px-2 py-0.5 rounded-sm font-semibold truncate max-w-full block" title="${page.fileName}">
            ${page.fileName}
          </span>
          <span class="font-bold text-xs text-neutral-800 font-mono">
            ${pageNumDisplay}
          </span>
        </div>

        ${i < totalPages - 1 ? `
          <button type="button" class="btn-card-cut w-full py-1.5 px-2 font-mono text-[11px] font-bold flex items-center justify-center gap-1.5 border-t transition-all ${isCut ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-700 shadow-sm' : 'bg-neutral-50 hover:bg-blue-50 text-neutral-600 hover:text-blue-700 border-neutral-200 hover:border-blue-300'}" title="${isCut ? 'Active Cut: Click to remove split after this page' : 'Click to split after this page'}">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
              <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/>
            </svg>
            <span>${isCut ? '✂ CUT HERE (SPLIT)' : 'SPLIT AFTER'}</span>
          </button>

          <!-- Floating circular scissor button on card boundary -->
          <div class="absolute -right-3 top-1/2 -translate-y-1/2 z-20 hidden sm:flex items-center justify-center pointer-events-auto">
            <button type="button" class="scissor-btn-edge w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${isCut ? 'bg-blue-600 text-white border-blue-600 shadow-md scale-110' : 'bg-white text-blue-600 border-blue-400 hover:bg-blue-600 hover:text-white hover:border-blue-600 hover:scale-110 opacity-0 group-hover:opacity-100'}" title="${isCut ? 'Remove split cut' : 'Split here'}">
              <svg class="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm0 12c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3h-3z"/>
              </svg>
            </button>
          </div>
        ` : `
          <div class="w-full py-1.5 px-2 bg-neutral-100 text-neutral-400 font-mono text-[10px] text-center border-t border-neutral-200 select-none">
            [END OF DOCUMENT]
          </div>
        `}
      `;

      card.querySelector('.btn-card-preview')?.addEventListener('click', (e) => {
        e.stopPropagation();
        previewSplitSinglePage(page.id);
      });
      card.querySelector('.btn-card-rotate')?.addEventListener('click', (e) => {
        e.stopPropagation();
        rotateSplitPage(page.id, 90);
      });
      card.querySelector('.btn-card-delete')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSplitPage(page.id);
      });
      card.querySelector('.btn-card-cut')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSplitCut(cutIndex);
      });
      card.querySelector('.scissor-btn-edge')?.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSplitCut(cutIndex);
      });
      card.querySelector('.canvas-click-area')?.addEventListener('click', () => {
        AppState.splitSelectedPageId = page.id;
        document.querySelectorAll('.split-page-card').forEach((c) => {
          const isSelected = c.dataset.pageId === page.id;
          c.classList.toggle('border-blue-500', isSelected);
          c.classList.toggle('shadow-md', isSelected);
          c.classList.toggle('ring-2', isSelected);
          c.classList.toggle('ring-blue-200', isSelected);
        });
      });

      container.appendChild(card);
    }

    // 2. Dashed "Add PDF, image files" Card (Grid Cell)
    const addCard = document.createElement('div');
    addCard.id = 'btnAddSplitFileCard';
    addCard.className = 'w-full aspect-[3/4] min-h-[220px] border-2 border-dashed border-blue-400 hover:border-blue-600 bg-white hover:bg-blue-50/50 p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all select-none text-center rounded-sm group';
    addCard.title = 'Add more PDF or image files to append to sequence';

    addCard.innerHTML = `
      <div class="w-10 h-10 rounded-full border-2 border-blue-500 text-blue-500 group-hover:bg-blue-500 group-hover:text-white flex items-center justify-center font-bold text-xl transition-all">
        +
      </div>
      <div class="text-xs font-bold text-blue-600 leading-tight">
        Add PDF, image<br/>files
      </div>
      <div class="text-[10px] text-neutral-500 mt-1">
        Append to sequence
      </div>
    `;

    addCard.addEventListener('click', () => {
      document.getElementById('splitAddMoreFileInput')?.click();
    });

    container.appendChild(addCard);

    // Asynchronously render all page canvases
    for (let i = 0; i < totalPages; i++) {
      const page = AppState.splitPages[i];
      const card = container.children[i];
      if (card) {
        const canvas = card.querySelector('canvas');
        if (canvas && page.pdfDoc) {
          try {
            await PdfPreview.renderPageToCanvas(page.pdfDoc, page.pageNumber, canvas, { scale: 0.25, rotation: page.rotation });
          } catch (err) {
            PdfPreview.drawFallbackPage(canvas, page.pageNumber, page.fileName, page.rotation, { maxWidth: 100, maxHeight: 130 });
          }
        }
      }
    }
  }

  async function previewSplitDoc() {
    if (!AppState.splitPages || AppState.splitPages.length === 0) {
      termLog('No pages loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnPreviewSplitDoc');
    if (btn) btn.disabled = true;
    termLog('Generating preview of first split document...');

    try {
      const groups = getSplitCustomGroups();
      if (groups.length === 0) {
        throw new Error('No split groups available.');
      }

      const part1Group = groups[0];
      const baseName = (AppState.splitFilename || 'document').replace(/\.pdf$/i, '');
      const part1Filename = `${baseName}_part_1_${part1Group.label}.pdf`;

      const results = await PdfTools.splitCustomPages(
        [{ ...part1Group, filename: part1Filename }],
        (curr, total, msg) => termLog(msg)
      );

      if (!results || results.length === 0) {
        throw new Error('Failed to generate preview document.');
      }

      const previewBytes = results[0].bytes;
      termLog(`Opening preview for Part 1 (${results[0].pageCount} pages, total ${groups.length} part(s))...`, 'success');
      await openDocumentPreview(previewBytes, `${part1Filename} [Part 1 of ${groups.length}]`);
    } catch (e) {
      termLog(`Preview error: ${e.message}`, 'error');
      alert(`Split Preview Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function processSplitPdf() {
    if (!AppState.splitPages || AppState.splitPages.length === 0) {
      termLog('No pages loaded.', 'error');
      return;
    }

    const btn = document.getElementById('btnProcessSplit');
    if (btn) btn.disabled = true;
    termLog('Splitting PDF document at active scissor cuts...');

    try {
      const groups = getSplitCustomGroups();
      if (groups.length === 0) {
        throw new Error('No pages to split.');
      }

      const baseName = (AppState.splitFilename || 'document').replace(/\.pdf$/i, '');
      const namedGroups = groups.map((g) => ({
        ...g,
        filename: `${baseName}_part_${g.partIndex}_${g.label}.pdf`
      }));

      const results = await PdfTools.splitCustomPages(namedGroups, (curr, total, msg) => termLog(msg));

      if (!results || results.length === 0) {
        throw new Error('No split files generated.');
      }

      if (results.length === 1) {
        const item = results[0];
        const blob = new Blob([item.bytes], { type: 'application/pdf' });
        const finalName = getCustomFilename('splitOutputFilename', item.filename, '.pdf');
        termLog(`Split complete: 1 PDF generated (${Converters.formatBytes(blob.size)}).`, 'success');
        showResultModal(blob, finalName, 'pdf', `${item.pageCount} pages • ${Converters.formatBytes(blob.size)}`);
      } else {
        termLog(`Bundling ${results.length} split PDF files into a ZIP archive...`);
        const zipItems = results.map((r) => ({
          filename: r.filename,
          blob: new Blob([r.bytes], { type: 'application/pdf' })
        }));

        const zipBlob = await Converters.createZip(zipItems, (curr, total, msg) => termLog(msg));
        const defaultZip = `${baseName}_split_files.zip`;
        const zipFilename = getCustomFilename('splitOutputFilename', defaultZip, '.zip');
        termLog(`Split complete: ${results.length} PDF files bundled into ${zipFilename} (${Converters.formatBytes(zipBlob.size)}).`, 'success');
        showResultModal(zipBlob, zipFilename, 'zip', `${results.length} PDF files bundled • ${Converters.formatBytes(zipBlob.size)}`);
      }
    } catch (e) {
      termLog(`Split error: ${e.message}`, 'error');
      alert(`Split Error: ${e.message}`);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==========================================
  // RESULT MODAL CONTROLLER
  // ==========================================
  async function previewResultDoc() {
    if (!AppState.lastResultBlob) {
      termLog('No document available to preview.', 'warn');
      return;
    }
    if (AppState.lastResultType === 'pdf') {
      await openDocumentPreview(AppState.lastResultBlob, AppState.lastResultFilename || 'Generated Document');
    } else {
      termLog('Document preview only available for PDF files.', 'info');
    }
  }

  function ensureDoMoreUI() {
    const modal = UI.resultModal || document.getElementById('resultModal');
    if (!modal) return;

    // Ensure inline rename block exists in the modal
    if (!modal.querySelector('#resultFilenameInput')) {
      const titleEl = modal.querySelector('#resultTitle');
      if (titleEl) {
        const renameBox = document.createElement('div');
        renameBox.className = 'space-y-2 border border-black p-3.5 bg-neutral-50 font-mono';
        renameBox.innerHTML = `
          <div class="flex items-center justify-between text-[10px] font-bold uppercase text-neutral-600">
            <label for="resultFilenameInput" class="flex items-center gap-1.5 text-black">
              <span class="w-4 h-4 rounded-xs bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] flex-shrink-0">✏️</span>
              <span>FILE NAME:</span>
            </label>
            
          </div>
          <div class="flex items-stretch border border-black bg-white focus-within:bg-yellow-50/50">
            <input type="text" id="resultFilenameInput" class="w-full text-xs sm:text-sm font-bold p-2 bg-transparent border-none outline-none font-mono focus:outline-none" placeholder="Enter file name..." />
            <span id="resultFileExtSuffix" class="text-xs sm:text-sm font-mono font-bold text-neutral-500 bg-neutral-100 px-3 py-2 border-l border-black select-none flex-shrink-0 flex items-center justify-center">.pdf</span>
          </div>
        `;
        titleEl.parentElement.insertBefore(renameBox, titleEl);
        titleEl.classList.add('hidden');
      }
    }

    // Check if #resultPrimaryActions already exists in the modal
    if (!modal.querySelector('#resultPrimaryActions')) {
      const modalBox = modal.querySelector('.bg-white');
      if (modalBox) {
        modalBox.classList.remove('max-w-lg');
        modalBox.classList.add('max-w-xl', 'max-h-[92vh]', 'overflow-y-auto');

        const oldActionRow = modal.querySelector('#btnDownloadResult')?.parentElement;
        if (oldActionRow) {
          oldActionRow.outerHTML = `
            <!-- DUAL ACTION CARDS: OPTION 1 (DOWNLOAD) & OPTION 2 (DO MORE) -->
            <div id="resultPrimaryActions" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 w-full">
              
              <!-- OPTION 1: DOWNLOAD -->
              <div id="resultDownloadCard" class="border border-black p-3.5 bg-neutral-50 flex flex-col justify-between gap-3">
                <div>
                  <div class="text-[10px] font-mono text-neutral-500 font-bold uppercase">SAVE TO DISK</div>
                  <div class="text-xs text-neutral-800 font-semibold mt-0.5">Save finished file directly</div>
                </div>
                <button type="button" id="btnDownloadResult" class="term-btn term-btn-primary w-full py-2.5 px-3 text-xs font-bold uppercase font-mono tracking-wider flex items-center justify-center gap-2">
                  <span class="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs flex-shrink-0">💾</span>
                  <span>DOWNLOAD FILE</span>
                </button>
              </div>

              <!-- OPTION 2: DO MORE -->
              <div id="resultDoMoreCard" class="border border-blue-600 bg-blue-50/60 p-3.5 flex flex-col justify-between gap-3">
                <div>
                  <div class="text-[10px] font-mono text-blue-700 font-bold uppercase flex items-center justify-between">
                    <span>NEXT STEP</span>
                  </div>
                  <div class="text-xs text-blue-950 font-semibold mt-0.5">Continue editing in another tool</div>
                </div>
                <button type="button" id="btnDoMoreToggle" onclick="event.stopPropagation(); window.toggleDoMorePanel ? window.toggleDoMorePanel() : (function(p){if(!p)return; const isH=p.classList.contains('hidden')||p.style.display==='none'; p.classList.toggle('hidden',!isH); p.style.display=isH?'block':'none';})(document.getElementById('doMorePanel'))" class="term-btn w-full py-2.5 px-3 text-xs font-bold uppercase font-mono tracking-wider bg-black hover:bg-neutral-800 text-white flex items-center justify-center gap-2">
                  <span class="w-5 h-5 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-xs flex-shrink-0">⚡</span>
                  <span>DO MORE →</span>
                </button>
              </div>

            </div>

            <!-- EXPANDABLE "DO MORE" TOOL SELECTOR PANEL -->
            <div id="doMorePanel" class="border border-black p-3.5 bg-white space-y-3 w-full hidden">
              <div class="flex items-center justify-between border-b border-black/20 pb-2 text-xs font-mono font-bold">
                <span class="text-blue-700 flex items-center gap-1.5">
                  <span>⚡</span>
                  <span>DO MORE: CHOOSE NEXT TOOL (NO RE-UPLOAD)</span>
                </span>
                <button type="button" id="btnCloseDoMorePanel" onclick="event.stopPropagation(); window.toggleDoMorePanel ? window.toggleDoMorePanel(false) : (function(p){if(!p)return; p.classList.add('hidden'); p.style.display='none';})(document.getElementById('doMorePanel'))" class="text-neutral-500 hover:text-black text-[11px] font-bold">
                  CLOSE
                </button>
              </div>

              <!-- Tool Grid -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="page-numbers" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('page-numbers') : (window.PdfApp ? window.PdfApp.doMoreWithResult('page-numbers') : null)">
                  <span class="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm border border-indigo-200 flex-shrink-0">🔢</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Page Numbers</div>
                    <div class="text-[10px] text-neutral-500 truncate">Headers & footers</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="watermark" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('watermark') : (window.PdfApp ? window.PdfApp.doMoreWithResult('watermark') : null)">
                  <span class="w-7 h-7 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-sm border border-teal-200 flex-shrink-0">💧</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Watermark</div>
                    <div class="text-[10px] text-neutral-500 truncate">Text or logo stamp</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="redact" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('redact') : (window.PdfApp ? window.PdfApp.doMoreWithResult('redact') : null)">
                  <span class="w-7 h-7 rounded bg-pink-100 text-pink-700 flex items-center justify-center text-sm border border-pink-200 flex-shrink-0">⬛</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Hide Content</div>
                    <div class="text-[10px] text-neutral-500 truncate">Blackout / redact</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="split" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('split') : (window.PdfApp ? window.PdfApp.doMoreWithResult('split') : null)">
                  <span class="text-lg">✂</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Split PDF</div>
                    <div class="text-[10px] text-neutral-500 truncate">Visual scissor cuts</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="resize" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('resize') : (window.PdfApp ? window.PdfApp.doMoreWithResult('resize') : null)">
                  <span class="w-7 h-7 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-sm border border-amber-200 flex-shrink-0">📐</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Resize PDF</div>
                    <div class="text-[10px] text-neutral-500 truncate">A4, Letter, scale</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="rotate" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('rotate') : (window.PdfApp ? window.PdfApp.doMoreWithResult('rotate') : null)">
                  <span class="text-lg">⟳</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Rotate PDF</div>
                    <div class="text-[10px] text-neutral-500 truncate">90°, 180°, 270°</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="add" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('add') : (window.PdfApp ? window.PdfApp.doMoreWithResult('add') : null)">
                  <span class="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm border border-emerald-200 flex-shrink-0">➕</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Add Pages</div>
                    <div class="text-[10px] text-neutral-500 truncate">Blank or insert PDF</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="remove" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('remove') : (window.PdfApp ? window.PdfApp.doMoreWithResult('remove') : null)">
                  <span class="text-lg">🗑</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Remove Pages</div>
                    <div class="text-[10px] text-neutral-500 truncate">Delete pages visually</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="n-up" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('n-up') : (window.PdfApp ? window.PdfApp.doMoreWithResult('n-up') : null)">
                  <span class="w-7 h-7 rounded bg-lime-100 text-lime-800 flex items-center justify-center text-sm border border-lime-200 flex-shrink-0">📑</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">N-Up Layout</div>
                    <div class="text-[10px] text-neutral-500 truncate">Multi-page per sheet</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="pdf2img" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('pdf2img') : (window.PdfApp ? window.PdfApp.doMoreWithResult('pdf2img') : null)">
                  <span class="text-lg">🖼</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">PDF to Image</div>
                    <div class="text-[10px] text-neutral-500 truncate">Export JPG / PNG</div>
                  </div>
                </button>

                <button type="button" class="btn-do-more-action p-2 border border-neutral-300 hover:border-black hover:bg-neutral-50 flex items-center gap-2 text-left transition-all group" data-tool="merge" onclick="event.stopPropagation(); window.doMoreWithResult ? window.doMoreWithResult('merge') : (window.PdfApp ? window.PdfApp.doMoreWithResult('merge') : null)">
                  <span class="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-sm border border-blue-200 flex-shrink-0">🔀</span>
                  <div class="overflow-hidden">
                    <div class="font-bold text-neutral-900 group-hover:text-black">Merge PDF</div>
                    <div class="text-[10px] text-neutral-500 truncate">Combine with more</div>
                  </div>
                </button>
              </div>
            </div>

            <!-- Secondary Actions -->
            <div class="flex flex-wrap items-center justify-between gap-2 border-t border-black/20 pt-2 font-mono text-xs w-full">
              <div class="flex items-center gap-2">
                <button type="button" id="btnPreviewResult" class="term-btn py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 hover:bg-black hover:text-white uppercase font-mono tracking-wider" title="Preview Document Before Downloading">
                  <span>👁</span>
                  <span>PREVIEW</span>
                </button>
                <button type="button" id="btnPrintResult" class="term-btn py-1.5 px-3 text-xs font-bold uppercase font-mono tracking-wider">
                  <span>🖨</span>
                  <span>PRINT PDF</span>
                </button>
              </div>
              <button type="button" id="btnStartNew" class="term-btn text-xs py-1.5 px-3 uppercase font-mono tracking-wider text-neutral-600 hover:text-black">
                [ NEW TASK ]
              </button>
            </div>
          `;

          // Re-bind buttons inside the modal
          UI.btnDownloadResult = document.getElementById('btnDownloadResult');
          UI.btnDownloadResult?.addEventListener('click', () => {
            const filenameInput = document.getElementById('resultFilenameInput');
            if (filenameInput && filenameInput.value.trim()) {
              const expectedExt = AppState.lastResultType === 'zip' ? '.zip' : '.pdf';
              let val = filenameInput.value.trim().replace(/[\\/:*?"<>|]/g, '_');
              if (expectedExt && !new RegExp(`\\${expectedExt}$`, 'i').test(val)) {
                val = `${val.replace(/\.[a-zA-Z0-9]+$/, '')}${expectedExt}`;
              }
              AppState.lastResultFilename = val;
              window._lastGeneratedFilename = val;
            }
            if (AppState.lastResultBlob && AppState.lastResultFilename) {
              Converters.downloadBlob(AppState.lastResultBlob, AppState.lastResultFilename);
              termLog(`Downloaded: ${AppState.lastResultFilename}`, 'success');
            }
          });

          document.getElementById('btnPreviewResult')?.addEventListener('click', previewResultDoc);

          UI.btnPrintResult = document.getElementById('btnPrintResult');
          UI.btnPrintResult?.addEventListener('click', () => {
            if (AppState.lastResultBlob && AppState.lastResultType === 'pdf') {
              Converters.printPdfBlob(AppState.lastResultBlob);
            }
          });

          UI.btnStartNew = document.getElementById('btnStartNew');
          UI.btnStartNew?.addEventListener('click', () => {
            hideResultModal();
            if (document.body.dataset.page && document.body.dataset.page !== 'home') {
              window.location.reload();
            } else {
              switchView('home');
            }
          });
        }
      }
    }

  }

  let _lastDoMoreToggleTime = 0;
  function toggleDoMorePanel(forceState) {
    const now = Date.now();
    if (now - _lastDoMoreToggleTime < 250 && forceState === undefined) {
      return;
    }
    _lastDoMoreToggleTime = now;

    const panel = document.getElementById('doMorePanel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden') || panel.style.display === 'none';
    const shouldShow = typeof forceState === 'boolean' ? forceState : isHidden;
    if (shouldShow) {
      panel.classList.remove('hidden');
      panel.style.display = 'block';
      try {
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (e) {}
    } else {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }
  }

  async function doMoreWithResult(toolKey) {
    const blob = AppState.lastResultBlob || window._lastGeneratedBlob;
    if (!blob) {
      termLog('No document available to continue editing.', 'error');
      alert('No generated PDF document found to transfer.');
      return;
    }

    if (AppState.lastResultType && AppState.lastResultType !== 'pdf') {
      termLog('DO MORE feature is only available for PDF documents.', 'warn');
      alert('DO MORE is only available for PDF documents. Please download your archive file.');
      return;
    }

    const filenameInput = document.getElementById('resultFilenameInput');
    if (filenameInput && filenameInput.value.trim()) {
      let val = filenameInput.value.trim().replace(/[\\/:*?"<>|]/g, '_');
      if (!val.toLowerCase().endsWith('.pdf')) {
        val = `${val.replace(/\.[a-zA-Z0-9]+$/, '')}.pdf`;
      }
      AppState.lastResultFilename = val;
      window._lastGeneratedFilename = val;
    }
    const filename = AppState.lastResultFilename || window._lastGeneratedFilename || 'document.pdf';
    termLog(`[DO MORE] Transferring "${filename}" to tool "${toolKey.toUpperCase()}"...`, 'success');

    // Visual loading state on the clicked button
    const clickedBtn = document.querySelector(`.btn-do-more-action[data-tool="${toolKey}"]`);
    const origHtml = clickedBtn ? clickedBtn.innerHTML : '';
    if (clickedBtn) {
      clickedBtn.disabled = true;
      clickedBtn.classList.add('opacity-70');
      const labelEl = clickedBtn.querySelector('.font-bold');
      if (labelEl) labelEl.textContent = 'Transferring...';
    }

    try {
      const file = new File([blob], filename, {
        type: 'application/pdf',
        lastModified: Date.now()
      });

      const targetUrl = TOOL_PAGE_MAP[toolKey];
      const currentPage = document.body.dataset.page;

      hideResultModal();

      if (targetUrl && (currentPage === 'home' || currentPage !== toolKey)) {
        if (window.FileTransfer) {
          window.FileTransfer.showLoading(`Moving to ${toolKey.toUpperCase()}...`, filename);
          await window.FileTransfer.setPendingFiles(toolKey, [file]);
        }
        window.location.href = targetUrl;
      } else {
        // Same tool page: reload directly into current workspace
        termLog(`Re-loading ${filename} into current workspace...`);
        if (window.FileTransfer) {
          window.FileTransfer.showLoading(`Loading ${filename} into workspace...`, filename);
        }
        hideCurrentToolDropzone(toolKey);
        try {
          await handleFilesForTool(toolKey, [file]);
        } finally {
          if (window.FileTransfer) {
            setTimeout(() => {
              window.FileTransfer.hideLoading();
            }, 300);
          }
        }
      }
    } catch (err) {
      console.error('[DO MORE ERROR]', err);
      termLog(`DO MORE transfer failed: ${err.message}`, 'error');
      alert(`DO MORE Error: ${err.message}`);
      if (clickedBtn) {
        clickedBtn.disabled = false;
        clickedBtn.classList.remove('opacity-70');
        clickedBtn.innerHTML = origHtml;
      }
    }
  }

  function showResultModal(blob, filename, type, metaText = '') {
    AppState.lastResultBlob = blob;
    AppState.lastResultFilename = filename;
    AppState.lastResultType = type;
    window._lastGeneratedBlob = blob;
    window._lastGeneratedFilename = filename;

    ensureDoMoreUI();

    // Support editable pre-export filename in result modal
    const filenameInput = document.getElementById('resultFilenameInput');
    const suffixEl = document.getElementById('resultFileExtSuffix');
    if (filenameInput) {
      const expectedExt = type === 'zip' ? '.zip' : (type === 'image' ? '' : '.pdf');
      if (suffixEl) suffixEl.textContent = expectedExt || '.pdf';
      const cleanBase = expectedExt
        ? filename.replace(new RegExp(`\\${expectedExt}$`, 'i'), '')
        : filename;
      filenameInput.value = cleanBase;

      const syncFilename = () => {
        let rawVal = filenameInput.value.trim().replace(/[\\/:*?"<>|]/g, '_');
        if (expectedExt) {
          rawVal = rawVal.replace(new RegExp(`\\${expectedExt}$`, 'i'), '');
        }
        if (!rawVal) rawVal = cleanBase;
        const val = expectedExt ? `${rawVal}${expectedExt}` : rawVal;
        AppState.lastResultFilename = val;
        window._lastGeneratedFilename = val;
        if (UI.resultTitle) UI.resultTitle.textContent = val;
      };
      filenameInput.oninput = () => {
        if (expectedExt && filenameInput.value.toLowerCase().endsWith(expectedExt)) {
          filenameInput.value = filenameInput.value.slice(0, -expectedExt.length);
        }
        syncFilename();
      };
      filenameInput.onblur = () => {
        if (expectedExt && filenameInput.value.toLowerCase().endsWith(expectedExt)) {
          filenameInput.value = filenameInput.value.slice(0, -expectedExt.length);
        }
        syncFilename();
        filenameInput.value = AppState.lastResultFilename.replace(new RegExp(`\\${expectedExt}$`, 'i'), '');
      };
    }

    if (UI.resultTitle) UI.resultTitle.textContent = filename;
    if (UI.resultMeta) UI.resultMeta.textContent = metaText || `${Converters.formatBytes(blob.size)} // Ready for download`;

    const btnPrevResult = document.getElementById('btnPreviewResult');
    if (btnPrevResult) {
      btnPrevResult.style.display = type === 'pdf' ? 'inline-flex' : 'none';
    }

    const btnPrintResult = document.getElementById('btnPrintResult');
    if (btnPrintResult) {
      btnPrintResult.style.display = type === 'pdf' ? 'inline-flex' : 'none';
    }

    const doMoreCard = document.getElementById('resultDoMoreCard');
    const doMorePanel = document.getElementById('doMorePanel');
    const downloadCard = document.getElementById('resultDownloadCard');

    if (doMoreCard) {
      doMoreCard.style.display = type === 'pdf' ? 'flex' : 'none';
    }
    if (doMorePanel) {
      doMorePanel.classList.add('hidden');
      doMorePanel.style.display = 'none';
    }
    if (downloadCard) {
      if (type !== 'pdf') {
        downloadCard.classList.remove('sm:col-span-1');
        downloadCard.classList.add('sm:col-span-2');
      } else {
        downloadCard.classList.remove('sm:col-span-2');
      }
    }

    if (UI.resultModal) {
      UI.resultModal.classList.remove('hidden');
    }
  }

  function hideResultModal() {
    if (UI.resultModal) {
      UI.resultModal.classList.add('hidden');
    }
  }

  // ==========================================
  // INITIALIZATION AND EVENT BINDINGS
  // ==========================================
  function init() {
    termLog('System initialized. Anixss-PDFer v2.0.0 is ready.');
    termLog('All file processing is performed client-side inside this browser window.');

    // Responsive dynamic resize for live previews on orientation change or window resize
    let previewResizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(previewResizeTimer);
      previewResizeTimer = setTimeout(() => {
        if (AppState.redactDoc && document.getElementById('redactBaseCanvas')) {
          renderRedactPage();
        }
        if (AppState.watermarkDoc && document.getElementById('watermarkPreviewCanvas')) {
          renderWatermarkPreview();
        }
        if (AppState.pageNumbersDoc && document.getElementById('pageNumbersPreviewCanvas')) {
          renderPageNumbersPreview();
        }
        if (AppState.nUpDoc && document.getElementById('nupPreviewCanvas')) {
          renderNUpPreview();
        }
      }, 150);
    });

    // Top Navigation
    UI.navHome?.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
    });

    UI.navTools?.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('home');
      UI.toolGrid?.scrollIntoView({ behavior: 'smooth' });
    });

    UI.navAbout?.addEventListener('click', (e) => {
      e.preventDefault();
      switchView('about');
    });

    UI.btnBackToHome?.addEventListener('click', () => {
      if (document.body.dataset.page && document.body.dataset.page !== 'home') {
        window.location.href = 'index.html';
      } else {
        switchView('home');
      }
    });

    UI.btnClearTool?.addEventListener('click', () => {
      if (confirm('Clear workspace and start over?')) {
        if (document.body.dataset.page && document.body.dataset.page !== 'home') {
          window.location.reload();
        } else if (AppState.activeTool) {
          activateTool(AppState.activeTool);
        }
      }
    });

    // Check if on a dedicated tool page
    const currentPage = document.body.dataset.page;
    if (currentPage && currentPage !== 'home') {
      AppState.activeTool = currentPage;
      if (currentPage === 'organize') {
        AppState.mergeViewMode = 'pages';
      }
      activateTool(currentPage);

      // Check if any files were queued from homepage
      if (window.FileTransfer) {
        window.FileTransfer.getPendingFiles(currentPage).then(async (files) => {
          if (files && files.length > 0) {
            termLog(`Auto-loaded ${files.length} file(s) transferred from homepage.`);
            window.FileTransfer.showLoading(`Loading ${files[0].name}...`, 'Preparing workspace');
            hideCurrentToolDropzone(currentPage);
            try {
              await handleFilesForTool(currentPage, files);
            } finally {
              setTimeout(() => {
                window.FileTransfer.hideLoading();
              }, 250);
            }
          } else {
            showCurrentToolDropzone(currentPage);
          }
        });
      }
    }

    // Global Dropzone
    setupDropzone(UI.globalDropzone, (files) => {
      handleGlobalDroppedFiles(files);
    });

    UI.btnGlobalSelect?.addEventListener('click', () => {
      UI.globalFileInput?.click();
    });

    UI.globalFileInput?.addEventListener('change', (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        handleGlobalDroppedFiles(files);
      }
      e.target.value = '';
    });

    // Tool Grid Cards
    document.querySelectorAll('.tool-grid-card').forEach((card) => {
      card.addEventListener('click', (e) => {
        const toolKey = card.dataset.tool;
        if (card.tagName.toLowerCase() !== 'a' && toolKey) {
          e.preventDefault();
          const targetUrl = TOOL_PAGE_MAP[toolKey];
          if (targetUrl) {
            window.location.href = targetUrl;
          } else {
            activateTool(toolKey);
          }
        }
      });
    });

    // Quick Action Modal choices
    document.querySelectorAll('.btn-quick-action').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const toolKey = btn.dataset.tool;
        const pendingFile = window._pendingSinglePdf;
        UI.quickToolModal?.classList.add('hidden');
        if (toolKey && pendingFile) {
          const targetUrl = TOOL_PAGE_MAP[toolKey];
          if (targetUrl) {
            if (window.FileTransfer) {
              await window.FileTransfer.setPendingFiles(toolKey, [pendingFile]);
            }
            window.location.href = targetUrl;
          } else {
            activateTool(toolKey, [pendingFile]);
          }
        }
        window._pendingSinglePdf = null;
      });
    });

    document.getElementById('btnCloseQuickModal')?.addEventListener('click', () => {
      UI.quickToolModal?.classList.add('hidden');
      window._pendingSinglePdf = null;
    });

    // Result Modal Buttons
    UI.btnDownloadResult?.addEventListener('click', () => {
      const filenameInput = document.getElementById('resultFilenameInput');
      if (filenameInput && filenameInput.value.trim()) {
        const expectedExt = AppState.lastResultType === 'zip' ? '.zip' : '.pdf';
        let val = filenameInput.value.trim().replace(/[\\/:*?"<>|]/g, '_');
        if (expectedExt && !new RegExp(`\\${expectedExt}$`, 'i').test(val)) {
          val = `${val.replace(/\.[a-zA-Z0-9]+$/, '')}${expectedExt}`;
        }
        AppState.lastResultFilename = val;
        window._lastGeneratedFilename = val;
      }
      if (AppState.lastResultBlob && AppState.lastResultFilename) {
        Converters.downloadBlob(AppState.lastResultBlob, AppState.lastResultFilename);
        termLog(`Downloaded: ${AppState.lastResultFilename}`, 'success');
      }
    });

    document.getElementById('btnPreviewResult')?.addEventListener('click', previewResultDoc);

    UI.btnPrintResult?.addEventListener('click', () => {
      if (AppState.lastResultBlob) {
        termLog('Opening native print dialog...');
        Converters.printPdfBlob(AppState.lastResultBlob);
      }
    });

    UI.btnCloseResult?.addEventListener('click', hideResultModal);
    UI.btnStartNew?.addEventListener('click', () => {
      hideResultModal();
      if (document.body.dataset.page && document.body.dataset.page !== 'home') {
        window.location.reload();
      } else {
        switchView('home');
      }
    });

    // Delegated event listener for DO MORE panel toggle, close, and tool selection
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('#btnDoMoreToggle');
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleDoMorePanel();
        return;
      }

      const closePanelBtn = e.target.closest('#btnCloseDoMorePanel');
      if (closePanelBtn) {
        e.preventDefault();
        e.stopPropagation();
        toggleDoMorePanel(false);
        return;
      }

      const toolBtn = e.target.closest('.btn-do-more-action');
      if (toolBtn) {
        e.preventDefault();
        e.stopPropagation();
        const toolKey = toolBtn.dataset.tool;
        if (toolKey) {
          doMoreWithResult(toolKey);
        }
        return;
      }
    });

    // Tool 01: Merge Bindings (Enhanced Reference Format)
    document.getElementById('btnMergeTabFiles')?.addEventListener('click', () => {
      AppState.mergeViewMode = 'files';
      AppState.mergeSelectedIds.clear();
      syncMergeStateAfterPageChange();
      renderMergeView();
    });
    document.getElementById('btnMergeTabPages')?.addEventListener('click', () => {
      AppState.mergeViewMode = 'pages';
      AppState.mergeSelectedIds.clear();
      syncMergeStateAfterPageChange();
      renderMergeView();
    });

    // Empty state dropzone & file picker
    setupDropzone(document.getElementById('mergeEmptyState'), (files) => {
      files.forEach((f) => addMergeFile(f));
    });
    document.getElementById('btnMergeSelectInitial')?.addEventListener('click', () => {
      document.getElementById('mergeFileInput')?.click();
    });
    document.getElementById('mergeFileInput')?.addEventListener('change', (e) => {
      Array.from(e.target.files || []).forEach((f) => addMergeFile(f));
      e.target.value = '';
    });
    document.getElementById('mergeImgInput')?.addEventListener('change', (e) => {
      Array.from(e.target.files || []).forEach((f) => addMergeFile(f));
      e.target.value = '';
    });

    // Add Dropdown Menu
    const addToggle = document.getElementById('btnMergeAddToggle');
    const addMenu = document.getElementById('mergeAddMenu');
    addToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      addMenu?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById('mergeAddDropdownWrapper')?.contains(e.target)) {
        addMenu?.classList.add('hidden');
      }
    });
    document.getElementById('btnMenuAddPdfs')?.addEventListener('click', () => {
      addMenu?.classList.add('hidden');
      document.getElementById('mergeFileInput')?.click();
    });
    document.getElementById('btnMenuAddImages')?.addEventListener('click', () => {
      addMenu?.classList.add('hidden');
      document.getElementById('mergeImgInput')?.click();
    });
    document.getElementById('btnMenuAddBlank')?.addEventListener('click', () => {
      addMenu?.classList.add('hidden');
      addMergeBlankPage();
    });

    // Action Icons
    document.getElementById('btnMergeRotateCw')?.addEventListener('click', () => rotateMergeSelection(90));
    document.getElementById('btnMergeRotateCcw')?.addEventListener('click', () => rotateMergeSelection(-90));
    document.getElementById('btnMergeDeleteSelected')?.addEventListener('click', deleteMergeSelection);

    // Sub-toolbar
    document.getElementById('mergeSelectAll')?.addEventListener('change', (e) => {
      const isChecked = e.target.checked;
      AppState.mergeSelectedIds.clear();
      if (isChecked) {
        if (AppState.mergeViewMode === 'files') {
          AppState.mergeFiles.forEach((f) => AppState.mergeSelectedIds.add(f.id));
        } else {
          AppState.mergePageSequence.forEach((p) => AppState.mergeSelectedIds.add(p.id));
        }
      }
      renderMergeView();
    });


    document.getElementById('btnMergeSortToggle')?.addEventListener('click', () => {
      AppState.mergeSortAsc = !AppState.mergeSortAsc;
      const label = document.getElementById('mergeSortLabel');
      if (label) label.textContent = AppState.mergeSortAsc ? '⇅ A-Z' : '⇅ Z-A';
      AppState.mergeFiles.sort((a, b) => {
        const cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
        return AppState.mergeSortAsc ? cmp : -cmp;
      });
      reorderPageSequenceByFiles();
      renderMergeView();
      termLog(`Sorted files ${AppState.mergeSortAsc ? 'A-Z' : 'Z-A'}.`);
    });

    // Grid and List Layout Switchers
    document.getElementById('btnMergeLayoutGrid')?.addEventListener('click', () => {
      if (AppState.mergeLayout !== 'grid') {
        AppState.mergeLayout = 'grid';
        renderMergeView();
        termLog('Switched to Grid view layout.');
      }
    });

    document.getElementById('btnMergeLayoutList')?.addEventListener('click', () => {
      if (AppState.mergeLayout !== 'list') {
        AppState.mergeLayout = 'list';
        renderMergeView();
        termLog('Switched to List view layout.');
      }
    });

    document.getElementById('btnMergeClearAll')?.addEventListener('click', () => {
      if (confirm('Clear all files and pages from Merge queue?')) {
        AppState.mergeFiles = [];
        AppState.mergePageSequence = [];
        AppState.mergeSelectedIds.clear();
        if (AppState.thumbnailCache) AppState.thumbnailCache.clear();
        renderMergeView();
        termLog('Cleared merge queue.');
      }
    });

    document.getElementById('btnProcessMerge')?.addEventListener('click', processMerge);
    document.getElementById('btnPreviewMergedDoc')?.addEventListener('click', () => {
      openFullPagePreview(0);
    });

    // Full Page Preview Modal Event Listeners
    document.getElementById('btnClosePagePreview')?.addEventListener('click', closeFullPreview);

    document.getElementById('btnPreviewPrevPage')?.addEventListener('click', () => {
      if (PagePreviewModal.activePageIndex > 0) {
        PagePreviewModal.activePageIndex--;
        renderFullPreviewContent();
      }
    });

    document.getElementById('btnPreviewNextPage')?.addEventListener('click', () => {
      if (PagePreviewModal.activePageIndex < PagePreviewModal.totalPages - 1) {
        PagePreviewModal.activePageIndex++;
        renderFullPreviewContent();
      }
    });

    document.getElementById('btnPreviewZoomIn')?.addEventListener('click', () => {
      PagePreviewModal.zoomScale = Math.min(3.0, PagePreviewModal.zoomScale + 0.25);
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewZoomOut')?.addEventListener('click', () => {
      PagePreviewModal.zoomScale = Math.max(0.4, PagePreviewModal.zoomScale - 0.25);
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewZoomFit')?.addEventListener('click', () => {
      PagePreviewModal.zoomScale = 1.0;
      PagePreviewModal.rotationDelta = 0;
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewRotateCw')?.addEventListener('click', () => {
      PagePreviewModal.rotationDelta = (PagePreviewModal.rotationDelta + 90) % 360;
      renderFullPreviewContent();
    });

    document.getElementById('btnPreviewRotateCcw')?.addEventListener('click', () => {
      PagePreviewModal.rotationDelta = (PagePreviewModal.rotationDelta - 90 + 360) % 360;
      renderFullPreviewContent();
    });

    // Keyboard navigation when preview modal is active
    document.addEventListener('keydown', (e) => {
      if (!PagePreviewModal.isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        closeFullPreview();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        document.getElementById('btnPreviewPrevPage')?.click();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        document.getElementById('btnPreviewNextPage')?.click();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        document.getElementById('btnPreviewZoomIn')?.click();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        document.getElementById('btnPreviewZoomOut')?.click();
      }
    });

    // Tool 02: Remove Pages Bindings
    setupDropzone(document.getElementById('removeDropzone'), (files) => {
      handleFilesForTool('remove', files);
    });
    document.getElementById('btnRemoveSelect')?.addEventListener('click', () => {
      document.getElementById('removeFileInput')?.click();
    });
    document.getElementById('removeFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('remove', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('removeRangeInput')?.addEventListener('input', (e) => {
      syncSetFromRemoveInput(e.target.value);
    });
    document.getElementById('btnRemoveSelectAll')?.addEventListener('click', () => {
      if (!AppState.removeDoc) return;
      for (let i = 1; i <= AppState.removeDoc.numPages; i++) {
        AppState.removeSelectedPages.add(i);
      }
      syncRemoveInputFromSet();
      document.querySelectorAll('#removeThumbnailGrid .page-thumb-card').forEach((c) => {
        updateRemoveCardState(c, parseInt(c.dataset.pageNum, 10));
      });
      updateRemoveCounters();
    });
    document.getElementById('btnRemoveDeselectAll')?.addEventListener('click', () => {
      AppState.removeSelectedPages.clear();
      syncRemoveInputFromSet();
      document.querySelectorAll('#removeThumbnailGrid .page-thumb-card').forEach((c) => {
        updateRemoveCardState(c, parseInt(c.dataset.pageNum, 10));
      });
      updateRemoveCounters();
    });
    document.getElementById('btnRemoveInvertSelection')?.addEventListener('click', () => {
      if (!AppState.removeDoc) return;
      for (let i = 1; i <= AppState.removeDoc.numPages; i++) {
        if (AppState.removeSelectedPages.has(i)) {
          AppState.removeSelectedPages.delete(i);
        } else {
          AppState.removeSelectedPages.add(i);
        }
      }
      syncRemoveInputFromSet();
      document.querySelectorAll('#removeThumbnailGrid .page-thumb-card').forEach((c) => {
        updateRemoveCardState(c, parseInt(c.dataset.pageNum, 10));
      });
      updateRemoveCounters();
    });
    document.getElementById('btnPreviewRemoveDoc')?.addEventListener('click', previewRemoveDoc);
    document.getElementById('btnProcessRemove')?.addEventListener('click', processRemovePages);

    // Tool 03: Add Pages Bindings
    setupDropzone(document.getElementById('addPrimaryDropzone'), (files) => {
      handleFilesForTool('add', files);
    });
    document.getElementById('btnAddPrimarySelect')?.addEventListener('click', () => {
      document.getElementById('addPrimaryFileInput')?.click();
    });
    document.getElementById('addPrimaryFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('add', Array.from(e.target.files || []));
      e.target.value = '';
    });

    // Add Dropdown Menu in top toolbar
    const addPagesToggle = document.getElementById('btnAddPagesAddToggle');
    const addPagesMenu = document.getElementById('addPagesAddMenu');
    addPagesToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      addPagesMenu?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!document.getElementById('addPagesDropdownWrapper')?.contains(e.target)) {
        addPagesMenu?.classList.add('hidden');
      }
    });

    document.getElementById('btnAddMenuAddBlank')?.addEventListener('click', () => {
      addPagesMenu?.classList.add('hidden');
      insertAddBlankPage(AppState.addPages.length);
    });

    document.getElementById('btnAddMenuAddPdf')?.addEventListener('click', () => {
      addPagesMenu?.classList.add('hidden');
      AppState._insertAddAtIndex = AppState.addPages.length;
      document.getElementById('addSecFileInput')?.click();
    });

    // Secondary file input (for adding PDF files at dividers or end)
    document.getElementById('addSecFileInput')?.addEventListener('change', (e) => {
      insertAddPdfFiles(e.target.files);
      e.target.value = '';
    });

    // Batch Rotate & Delete
    document.getElementById('btnAddRotateCcw')?.addEventListener('click', () => {
      if (AppState.addSelectedIds.size === 0) {
        termLog('No pages selected to rotate.', 'warn');
        return;
      }
      AppState.addPages.forEach((p) => {
        if (AppState.addSelectedIds.has(p.id)) {
          p.rotation = ((p.rotation || 0) - 90 + 360) % 360;
        }
      });
      renderAddPagesView();
      termLog(`Rotated ${AppState.addSelectedIds.size} selected page(s) CCW.`);
    });

    document.getElementById('btnAddRotateCw')?.addEventListener('click', () => {
      if (AppState.addSelectedIds.size === 0) {
        termLog('No pages selected to rotate.', 'warn');
        return;
      }
      AppState.addPages.forEach((p) => {
        if (AppState.addSelectedIds.has(p.id)) {
          p.rotation = ((p.rotation || 0) + 90) % 360;
        }
      });
      renderAddPagesView();
      termLog(`Rotated ${AppState.addSelectedIds.size} selected page(s) CW.`);
    });

    document.getElementById('btnAddDeleteSelected')?.addEventListener('click', () => {
      const count = AppState.addSelectedIds.size;
      if (count === 0) {
        termLog('No pages selected to delete.', 'warn');
        return;
      }
      AppState.addPages = AppState.addPages.filter((p) => !AppState.addSelectedIds.has(p.id));
      AppState.addSelectedIds.clear();
      renderAddPagesView();
      termLog(`Deleted ${count} page(s) from document.`);
    });

    // Select All
    document.getElementById('addSelectAll')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        AppState.addPages.forEach((p) => AppState.addSelectedIds.add(p.id));
      } else {
        AppState.addSelectedIds.clear();
      }
      document.querySelectorAll('#addPagesGrid .add-page-checkbox').forEach((cb) => {
        cb.checked = e.target.checked;
      });
      updateAddSelectionCounts();
    });

    document.getElementById('btnPreviewAddDoc')?.addEventListener('click', previewAddDoc);
    document.getElementById('btnProcessAdd')?.addEventListener('click', processAddPages);

    // Tool 04: Resize PDF Bindings
    setupDropzone(document.getElementById('resizeDropzone'), (files) => {
      handleFilesForTool('resize', files);
    });
    document.getElementById('btnResizeSelect')?.addEventListener('click', () => {
      document.getElementById('resizeFileInput')?.click();
    });
    document.getElementById('resizeFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('resize', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('resizePresetSelect')?.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'CUSTOM';
      document.getElementById('resizeCustomDimensions').classList.toggle('hidden', !isCustom);
    });
    document.getElementById('btnPreviewResizeDoc')?.addEventListener('click', previewResizeDoc);
    document.getElementById('btnProcessResize')?.addEventListener('click', processResize);

    // Tool 05: Rotate PDF Bindings
    setupDropzone(document.getElementById('rotateDropzone'), (files) => {
      handleFilesForTool('rotate', files);
    });
    document.getElementById('btnRotateSelect')?.addEventListener('click', () => {
      document.getElementById('rotateFileInput')?.click();
    });
    document.getElementById('rotateFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('rotate', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('rotateScopeSelect')?.addEventListener('change', (e) => {
      const isRange = e.target.value === 'range';
      document.getElementById('rotateRangeWrapper').classList.toggle('hidden', !isRange);
    });
    document.getElementById('btnRotateCwBulk')?.addEventListener('click', () => applyBulkRotation(90));
    document.getElementById('btnRotateCcwBulk')?.addEventListener('click', () => applyBulkRotation(-90));
    document.getElementById('btnRotate180Bulk')?.addEventListener('click', () => applyBulkRotation(180));
    document.getElementById('btnResetAllRotations')?.addEventListener('click', resetAllRotations);
    document.getElementById('btnPreviewRotateDoc')?.addEventListener('click', previewRotateDoc);
    document.getElementById('btnProcessRotate')?.addEventListener('click', processRotate);

    // Tool 06: Image to PDF Bindings
    setupDropzone(document.getElementById('img2pdfDropzone'), (files) => {
      handleFilesForTool('img2pdf', files);
    });
    document.getElementById('btnImg2PdfSelect')?.addEventListener('click', () => {
      document.getElementById('img2pdfFileInput')?.click();
    });
    document.getElementById('img2pdfFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('img2pdf', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('btnPreviewImg2PdfDoc')?.addEventListener('click', previewImg2PdfDoc);
    document.getElementById('btnProcessImg2Pdf')?.addEventListener('click', processImageToPdf);

    // Tool 07: PDF to Image Bindings
    setupDropzone(document.getElementById('pdf2imgDropzone'), (files) => {
      handleFilesForTool('pdf2img', files);
    });
    document.getElementById('btnPdf2ImgSelect')?.addEventListener('click', () => {
      document.getElementById('pdf2imgFileInput')?.click();
    });
    document.getElementById('pdf2imgFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('pdf2img', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('pdf2imgScopeSelect')?.addEventListener('change', (e) => {
      const isRange = e.target.value === 'range';
      document.getElementById('pdf2imgRangeWrapper').classList.toggle('hidden', !isRange);
    });
    document.getElementById('btnPreviewPdf2ImgDoc')?.addEventListener('click', previewPdf2ImgDoc);
    document.getElementById('btnProcessPdf2Img')?.addEventListener('click', processPdfToImage);

    // ==========================================
    // Tool 08: Watermark PDF Bindings
    // ==========================================
    setupDropzone(document.getElementById('watermarkDropzone'), (files) => {
      handleFilesForTool('watermark', files);
    });
    document.getElementById('btnWatermarkSelect')?.addEventListener('click', () => {
      document.getElementById('watermarkFileInput')?.click();
    });
    document.getElementById('watermarkFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('watermark', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('btnChangeWatermarkFile')?.addEventListener('click', () => {
      document.getElementById('watermarkFileInput')?.click();
    });

    // Watermark Mode Toggles (Text vs Image)
    document.getElementById('btnModeText')?.addEventListener('click', () => {
      AppState.watermarkMode = 'text';
      document.getElementById('btnModeText').classList.add('term-btn-primary');
      document.getElementById('btnModeImage').classList.remove('term-btn-primary');
      document.getElementById('watermarkTextGroup').classList.remove('hidden');
      document.getElementById('watermarkImageGroup').classList.add('hidden');
      renderWatermarkPreview();
    });
    document.getElementById('btnModeImage')?.addEventListener('click', () => {
      AppState.watermarkMode = 'image';
      document.getElementById('btnModeImage').classList.add('term-btn-primary');
      document.getElementById('btnModeText').classList.remove('term-btn-primary');
      document.getElementById('watermarkImageGroup').classList.remove('hidden');
      document.getElementById('watermarkTextGroup').classList.add('hidden');
      renderWatermarkPreview();
    });

    // Text Watermark Quick Presets
    document.querySelectorAll('.btn-text-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const textInput = document.getElementById('watermarkText');
        if (textInput) textInput.value = btn.dataset.text || '';
        renderWatermarkPreview();
      });
    });

    // Live update watermark preview on text / font / size / color / opacity / rotation / position changes
    document.getElementById('watermarkText')?.addEventListener('input', renderWatermarkPreview);
    document.getElementById('watermarkFont')?.addEventListener('change', renderWatermarkPreview);
    document.getElementById('watermarkFontSize')?.addEventListener('input', (e) => {
      const display = document.getElementById('fontSizeDisplay');
      if (display) display.textContent = `${e.target.value} pt`;
      renderWatermarkPreview();
    });
    document.getElementById('watermarkColor')?.addEventListener('input', (e) => {
      renderWatermarkPreview();
    });
    document.getElementById('watermarkColorPreset')?.addEventListener('change', (e) => {
      const picker = document.getElementById('watermarkColor');
      if (picker) picker.value = e.target.value;
      renderWatermarkPreview();
    });
    document.getElementById('watermarkOpacity')?.addEventListener('input', (e) => {
      const display = document.getElementById('opacityDisplay');
      if (display) display.textContent = `${e.target.value}%`;
      renderWatermarkPreview();
    });
    document.getElementById('watermarkRotation')?.addEventListener('input', (e) => {
      const display = document.getElementById('rotationDisplay');
      if (display) display.textContent = `${e.target.value}°`;
      renderWatermarkPreview();
    });
    document.querySelectorAll('.btn-angle-preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const rotInput = document.getElementById('watermarkRotation');
        const display = document.getElementById('rotationDisplay');
        if (rotInput) rotInput.value = btn.dataset.angle || '0';
        if (display) display.textContent = `${btn.dataset.angle}°`;
        renderWatermarkPreview();
      });
    });
    document.getElementById('watermarkPosition')?.addEventListener('change', renderWatermarkPreview);

    // Image Watermark upload
    setupDropzone(document.getElementById('watermarkImgDropzone'), (files) => {
      const img = files.find((f) => f.type.startsWith('image/'));
      if (img) handleWatermarkImageFile(img);
    });
    document.getElementById('watermarkImgDropzone')?.addEventListener('click', () => {
      document.getElementById('watermarkImgInput')?.click();
    });
    document.getElementById('watermarkImgInput')?.addEventListener('change', (e) => {
      const file = (e.target.files || [])[0];
      if (file) handleWatermarkImageFile(file);
      e.target.value = '';
    });

    async function handleWatermarkImageFile(file) {
      AppState.watermarkImageBuffer = await file.arrayBuffer();
      AppState.watermarkImageType = file.type.includes('jpeg') || file.name.toLowerCase().endsWith('.jpg') ? 'jpg' : 'png';
      AppState.watermarkImageUrl = URL.createObjectURL(file);
      const txt = document.getElementById('imgPreviewText');
      if (txt) txt.textContent = `[✓] ${file.name} (${Converters.formatBytes(file.size)})`;
      renderWatermarkPreview();
    }

    document.getElementById('watermarkImgScale')?.addEventListener('input', (e) => {
      const display = document.getElementById('imgScaleDisplay');
      if (display) display.textContent = `${e.target.value}% of page`;
      renderWatermarkPreview();
    });
    document.getElementById('watermarkImgOpacity')?.addEventListener('input', (e) => {
      const display = document.getElementById('imgOpacityDisplay');
      if (display) display.textContent = `${e.target.value}%`;
      renderWatermarkPreview();
    });
    document.getElementById('watermarkImgPosition')?.addEventListener('change', renderWatermarkPreview);

    // Watermark Scope toggles
    document.querySelectorAll('input[name="watermarkScope"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const isRange = e.target.value === 'range';
        document.getElementById('watermarkRangeWrapper')?.classList.toggle('hidden', !isRange);
      });
    });

    // Watermark Page Navigation
    document.getElementById('btnWatermarkPrevPage')?.addEventListener('click', () => {
      if (AppState.watermarkDoc && AppState.watermarkCurrentPage > 1) {
        AppState.watermarkCurrentPage--;
        renderWatermarkPreview();
      }
    });
    document.getElementById('btnWatermarkNextPage')?.addEventListener('click', () => {
      if (AppState.watermarkDoc && AppState.watermarkCurrentPage < AppState.watermarkDoc.numPages) {
        AppState.watermarkCurrentPage++;
        renderWatermarkPreview();
      }
    });

    document.getElementById('btnPreviewWatermarkDoc')?.addEventListener('click', previewWatermarkDoc);
    document.getElementById('btnProcessWatermark')?.addEventListener('click', processWatermark);

    // ==========================================
    // Tool 09: Hide Content (Redact) Bindings
    // ==========================================
    setupDropzone(document.getElementById('redactDropzone'), (files) => {
      handleFilesForTool('redact', files);
    });
    document.getElementById('btnRedactSelect')?.addEventListener('click', () => {
      document.getElementById('redactFileInput')?.click();
    });
    document.getElementById('redactFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('redact', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('btnChangeRedactFile')?.addEventListener('click', () => {
      document.getElementById('redactFileInput')?.click();
    });

    // Redaction Box Style buttons
    document.getElementById('btnStyleBlackout')?.addEventListener('click', () => {
      AppState.redactActiveStyle = 'blackout';
      document.getElementById('btnStyleBlackout').classList.add('term-btn-primary');
      document.getElementById('btnStyleWhiteout').classList.remove('term-btn-primary');
    });
    document.getElementById('btnStyleWhiteout')?.addEventListener('click', () => {
      AppState.redactActiveStyle = 'whiteout';
      document.getElementById('btnStyleWhiteout').classList.add('term-btn-primary');
      document.getElementById('btnStyleBlackout').classList.remove('term-btn-primary');
    });

    document.getElementById('btnClearPageBoxes')?.addEventListener('click', () => {
      if (AppState.redactBoxes[AppState.redactCurrentPage]) {
        AppState.redactBoxes[AppState.redactCurrentPage] = [];
        drawRedactOverlay();
        updateRedactBoxList();
        termLog(`Cleared all boxes on Page ${AppState.redactCurrentPage}.`);
      }
    });

    document.getElementById('btnClearAllRedactBoxes')?.addEventListener('click', () => {
      if (confirm('Clear all redaction boxes across all pages?')) {
        AppState.redactBoxes = {};
        drawRedactOverlay();
        updateRedactBoxList();
        termLog('Cleared all redaction boxes.');
      }
    });

    // Redact Page Navigation
    document.getElementById('btnRedactPrevPage')?.addEventListener('click', () => {
      if (AppState.redactDoc && AppState.redactCurrentPage > 1) {
        AppState.redactCurrentPage--;
        renderRedactPage();
      }
    });
    document.getElementById('btnRedactNextPage')?.addEventListener('click', () => {
      if (AppState.redactDoc && AppState.redactCurrentPage < AppState.redactDoc.numPages) {
        AppState.redactCurrentPage++;
        renderRedactPage();
      }
    });

    // Interactive Box Drawing on Overlay Canvas
    const overlayCanvas = document.getElementById('redactOverlayCanvas');
    if (overlayCanvas) {
      // Touch Support for Mobile / Touchscreen Devices
      overlayCanvas.style.touchAction = 'none';

      overlayCanvas.addEventListener('touchstart', (e) => {
        if (!AppState.redactDoc || e.touches.length === 0) return;
        e.preventDefault();
        AppState.isDrawingRedact = true;
        const touch = e.touches[0];
        const rect = overlayCanvas.getBoundingClientRect();
        AppState.redactStartX = (touch.clientX - rect.left) * (overlayCanvas.width / rect.width);
        AppState.redactStartY = (touch.clientY - rect.top) * (overlayCanvas.height / rect.height);
      }, { passive: false });

      overlayCanvas.addEventListener('touchmove', (e) => {
        if (!AppState.isDrawingRedact || e.touches.length === 0) return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = overlayCanvas.getBoundingClientRect();
        const curX = (touch.clientX - rect.left) * (overlayCanvas.width / rect.width);
        const curY = (touch.clientY - rect.top) * (overlayCanvas.height / rect.height);

        const dragRect = {
          x: Math.min(AppState.redactStartX, curX),
          y: Math.min(AppState.redactStartY, curY),
          w: Math.abs(curX - AppState.redactStartX),
          h: Math.abs(curY - AppState.redactStartY)
        };
        drawRedactOverlay(dragRect);
      }, { passive: false });

      overlayCanvas.addEventListener('touchend', (e) => {
        if (!AppState.isDrawingRedact) return;
        e.preventDefault();
        const touch = e.changedTouches[0] || e.touches[0];
        if (!touch) return;
        const rect = overlayCanvas.getBoundingClientRect();
        const curX = (touch.clientX - rect.left) * (overlayCanvas.width / rect.width);
        const curY = (touch.clientY - rect.top) * (overlayCanvas.height / rect.height);

        const w = Math.abs(curX - AppState.redactStartX);
        const h = Math.abs(curY - AppState.redactStartY);

        if (w >= 5 && h >= 5) {
          const normX = Math.min(AppState.redactStartX, curX) / overlayCanvas.width;
          const normY = Math.min(AppState.redactStartY, curY) / overlayCanvas.height;
          const normW = w / overlayCanvas.width;
          const normH = h / overlayCanvas.height;

          const pNum = AppState.redactCurrentPage;
          if (!AppState.redactBoxes[pNum]) {
            AppState.redactBoxes[pNum] = [];
          }

          AppState.redactBoxes[pNum].push({
            id: 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            normX,
            normY,
            normW,
            normH,
            style: AppState.redactActiveStyle,
            color: AppState.redactActiveStyle === 'blackout' ? '#000000' : '#ffffff'
          });

          renderRedactOverlay();
          updateRedactUI();
        } else {
          renderRedactOverlay();
        }
        AppState.isDrawingRedact = false;
      }, { passive: false });

      overlayCanvas.addEventListener('mousedown', (e) => {
        if (!AppState.redactDoc) return;
        AppState.isDrawingRedact = true;
        const rect = overlayCanvas.getBoundingClientRect();
        AppState.redactStartX = (e.clientX - rect.left) * (overlayCanvas.width / rect.width);
        AppState.redactStartY = (e.clientY - rect.top) * (overlayCanvas.height / rect.height);
      });

      overlayCanvas.addEventListener('mousemove', (e) => {
        if (!AppState.isDrawingRedact) return;
        const rect = overlayCanvas.getBoundingClientRect();
        const curX = (e.clientX - rect.left) * (overlayCanvas.width / rect.width);
        const curY = (e.clientY - rect.top) * (overlayCanvas.height / rect.height);

        const dragRect = {
          x: Math.min(AppState.redactStartX, curX),
          y: Math.min(AppState.redactStartY, curY),
          w: Math.abs(curX - AppState.redactStartX),
          h: Math.abs(curY - AppState.redactStartY)
        };
        drawRedactOverlay(dragRect);
      });

      const finishDrawing = (e) => {
        if (!AppState.isDrawingRedact) return;
        AppState.isDrawingRedact = false;
        const rect = overlayCanvas.getBoundingClientRect();
        const curX = (e.clientX - rect.left) * (overlayCanvas.width / rect.width);
        const curY = (e.clientY - rect.top) * (overlayCanvas.height / rect.height);

        const w = Math.abs(curX - AppState.redactStartX);
        const h = Math.abs(curY - AppState.redactStartY);

        // Only register box if dragged at least 5px wide and high
        if (w >= 5 && h >= 5) {
          const normX = Math.min(AppState.redactStartX, curX) / overlayCanvas.width;
          const normY = Math.min(AppState.redactStartY, curY) / overlayCanvas.height;
          const normW = w / overlayCanvas.width;
          const normH = h / overlayCanvas.height;

          const pNum = AppState.redactCurrentPage;
          if (!AppState.redactBoxes[pNum]) {
            AppState.redactBoxes[pNum] = [];
          }

          const newBox = {
            id: 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            normX,
            normY,
            normW,
            normH,
            type: AppState.redactActiveStyle || 'blackout'
          };

          AppState.redactBoxes[pNum].push(newBox);
          termLog(`Added ${newBox.type} box #${AppState.redactBoxes[pNum].length} on Page ${pNum}.`);
        }

        drawRedactOverlay();
        updateRedactBoxList();
      };

      overlayCanvas.addEventListener('mouseup', finishDrawing);
      overlayCanvas.addEventListener('mouseleave', finishDrawing);
    }

    document.getElementById('btnPreviewRedactDoc')?.addEventListener('click', previewRedactDoc);
    document.getElementById('btnProcessRedact')?.addEventListener('click', processRedact);

    // ==========================================
    // Tool 10: Add Page Numbers Bindings
    // ==========================================
    setupDropzone(document.getElementById('pageNumbersDropzone'), (files) => {
      handleFilesForTool('page-numbers', files);
    });
    document.getElementById('btnPageNumbersSelect')?.addEventListener('click', () => {
      document.getElementById('pageNumbersFileInput')?.click();
    });
    document.getElementById('pageNumbersFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('page-numbers', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('btnChangePageNumbersFile')?.addEventListener('click', () => {
      document.getElementById('pageNumbersFileInput')?.click();
    });

    document.getElementById('numFormatPreset')?.addEventListener('change', (e) => {
      const isCustom = e.target.value === 'CUSTOM';
      document.getElementById('customFormatWrapper')?.classList.toggle('hidden', !isCustom);
      renderPageNumbersPreview();
    });
    document.getElementById('customFormatInput')?.addEventListener('input', renderPageNumbersPreview);

    document.querySelectorAll('.btn-pos').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-pos').forEach((b) => b.classList.remove('term-btn-primary'));
        btn.classList.add('term-btn-primary');
        const posInput = document.getElementById('numPosition');
        if (posInput) posInput.value = btn.dataset.pos || 'bottom-center';
        renderPageNumbersPreview();
      });
    });

    document.getElementById('numMargin')?.addEventListener('input', (e) => {
      const display = document.getElementById('numMarginDisplay');
      if (display) display.textContent = `${e.target.value} pt`;
      renderPageNumbersPreview();
    });
    document.getElementById('numStart')?.addEventListener('input', renderPageNumbersPreview);
    document.getElementById('numFont')?.addEventListener('change', renderPageNumbersPreview);
    document.getElementById('numFontSize')?.addEventListener('input', (e) => {
      const display = document.getElementById('numFontSizeDisplay');
      if (display) display.textContent = `${e.target.value} pt`;
      renderPageNumbersPreview();
    });
    document.getElementById('numColor')?.addEventListener('input', renderPageNumbersPreview);
    document.getElementById('numColorPreset')?.addEventListener('change', (e) => {
      const picker = document.getElementById('numColor');
      if (picker) picker.value = e.target.value;
      renderPageNumbersPreview();
    });
    document.getElementById('chkSkipCover')?.addEventListener('change', renderPageNumbersPreview);
    document.getElementById('chkAlternatingMargins')?.addEventListener('change', renderPageNumbersPreview);

    document.querySelectorAll('input[name="numScope"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const isRange = e.target.value === 'range';
        document.getElementById('numRangeWrapper')?.classList.toggle('hidden', !isRange);
      });
    });

    document.getElementById('btnNumPrevPage')?.addEventListener('click', () => {
      if (AppState.pageNumbersDoc && AppState.pageNumbersCurrentPage > 1) {
        AppState.pageNumbersCurrentPage--;
        renderPageNumbersPreview();
      }
    });
    document.getElementById('btnNumNextPage')?.addEventListener('click', () => {
      if (AppState.pageNumbersDoc && AppState.pageNumbersCurrentPage < AppState.pageNumbersDoc.numPages) {
        AppState.pageNumbersCurrentPage++;
        renderPageNumbersPreview();
      }
    });

    document.getElementById('btnPreviewPageNumbersDoc')?.addEventListener('click', previewPageNumbersDoc);
    document.getElementById('btnProcessPageNumbers')?.addEventListener('click', processPageNumbers);

    // ==========================================
    // Tool 11: Multiple Pages per Sheet (N-Up) Bindings
    // ==========================================
    setupDropzone(document.getElementById('nupDropzone'), (files) => {
      handleFilesForTool('n-up', files);
    });
    document.getElementById('btnNUpSelect')?.addEventListener('click', () => {
      document.getElementById('nupFileInput')?.click();
    });
    document.getElementById('nupFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('n-up', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('btnChangeNUpFile')?.addEventListener('click', () => {
      document.getElementById('nupFileInput')?.click();
    });

    document.querySelectorAll('.btn-nup-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.btn-nup-choice').forEach((b) => b.classList.remove('term-btn-primary'));
        btn.classList.add('term-btn-primary');
        const choiceInput = document.getElementById('nupChoice');
        if (choiceInput) choiceInput.value = btn.dataset.nup || '4';
        updateNUpSummary();
        renderNUpPreview();
      });
    });

    document.getElementById('nupSheetSize')?.addEventListener('change', renderNUpPreview);
    document.getElementById('nupOrientation')?.addEventListener('change', renderNUpPreview);
    document.getElementById('nupPageOrder')?.addEventListener('change', renderNUpPreview);
    document.getElementById('nupSpacing')?.addEventListener('change', renderNUpPreview);
    document.getElementById('chkNUpBorder')?.addEventListener('change', renderNUpPreview);
    document.getElementById('nupMargin')?.addEventListener('input', (e) => {
      const display = document.getElementById('nupMarginDisplay');
      if (display) display.textContent = `${e.target.value} pt`;
      renderNUpPreview();
    });

    document.querySelectorAll('input[name="nupScope"]').forEach((radio) => {
      radio.addEventListener('change', (e) => {
        const isRange = e.target.value === 'range';
        document.getElementById('nupRangeWrapper')?.classList.toggle('hidden', !isRange);
      });
    });

    document.getElementById('btnNUpPrevSheet')?.addEventListener('click', () => {
      if (AppState.nUpDoc && AppState.nUpCurrentSheet > 1) {
        AppState.nUpCurrentSheet--;
        renderNUpPreview();
      }
    });
    document.getElementById('btnNUpNextSheet')?.addEventListener('click', () => {
      if (AppState.nUpDoc) {
        const nUp = parseInt(document.getElementById('nupChoice')?.value, 10) || 4;
        const totalSheets = Math.ceil(AppState.nUpDoc.numPages / nUp);
        if (AppState.nUpCurrentSheet < totalSheets) {
          AppState.nUpCurrentSheet++;
          renderNUpPreview();
        }
      }
    });

    document.getElementById('btnPreviewNUpDoc')?.addEventListener('click', previewNUpDoc);
    document.getElementById('btnProcessNUp')?.addEventListener('click', processNUp);

    // ==========================================
    // Tool 12: Split PDF Bindings (Visual Scissor Suite)
    // ==========================================
    setupDropzone(document.getElementById('splitDropzone'), (files) => {
      handleFilesForTool('split', files);
    });
    document.getElementById('btnSplitSelect')?.addEventListener('click', () => {
      document.getElementById('splitFileInput')?.click();
    });
    document.getElementById('splitFileInput')?.addEventListener('change', (e) => {
      handleFilesForTool('split', Array.from(e.target.files || []));
      e.target.value = '';
    });
    document.getElementById('btnChangeSplitFile')?.addEventListener('click', () => {
      document.getElementById('splitFileInput')?.click();
    });

    // Add more files card & input
    document.getElementById('splitAddMoreFileInput')?.addEventListener('change', (e) => {
      addMoreSplitFiles(Array.from(e.target.files || []));
      e.target.value = '';
    });

    // Preset Cut Actions
    document.getElementById('btnSplitAllCuts')?.addEventListener('click', splitAllPages);
    document.getElementById('btnSplitEvery2Cuts')?.addEventListener('click', () => splitEveryNPagess(2));
    document.getElementById('btnSplitClearCuts')?.addEventListener('click', clearSplitCuts);
    document.getElementById('btnApplyIntervalCut')?.addEventListener('click', () => {
      const val = document.getElementById('splitCustomIntervalInput')?.value || 2;
      splitEveryNPagess(val);
    });

    // Sort order toggle
    document.getElementById('btnSplitSortToggle')?.addEventListener('click', () => {
      AppState.splitSortAsc = !AppState.splitSortAsc;
      const btn = document.getElementById('btnSplitSortToggle');
      if (btn) btn.textContent = AppState.splitSortAsc ? '⇅ A-Z' : '⇅ Z-A';
      AppState.splitPages.sort((a, b) => {
        const cmp = a.fileName.localeCompare(b.fileName, undefined, { numeric: true }) || (a.pageNumber - b.pageNumber);
        return AppState.splitSortAsc ? cmp : -cmp;
      });
      AppState.splitCuts.clear();
      renderSplitWorkspace();
      syncSplitRangesFromCuts();
      updateSplitSummary();
      termLog(`Sorted pages ${AppState.splitSortAsc ? 'A-Z' : 'Z-A'}.`);
    });

    // Bi-directional Range Input Listener
    document.getElementById('splitRangeInput')?.addEventListener('input', (e) => {
      syncSplitCutsFromRanges(e.target.value);
    });

    document.getElementById('btnPreviewSplitDoc')?.addEventListener('click', previewSplitDoc);
    document.getElementById('btnProcessSplit')?.addEventListener('click', processSplitPdf);

    // Disallow editing extension in all toolbar and modal rename inputs
    initRenameInputsProtection();
  }

  function initRenameInputsProtection() {
    const TOOLBAR_INPUTS = [
      { id: 'mergeOutputFilename', ext: '.pdf' },
      { id: 'removeOutputFilename', ext: '.pdf' },
      { id: 'addOutputFilename', ext: '.pdf' },
      { id: 'resizeOutputFilename', ext: '.pdf' },
      { id: 'rotateOutputFilename', ext: '.pdf' },
      { id: 'img2pdfOutputFilename', ext: '.pdf' },
      { id: 'pdf2imgOutputFilename', ext: '.zip' },
      { id: 'watermarkOutputFilename', ext: '.pdf' },
      { id: 'redactOutputFilename', ext: '.pdf' },
      { id: 'pageNumbersOutputFilename', ext: '.pdf' },
      { id: 'nupOutputFilename', ext: '.pdf' },
      { id: 'splitOutputFilename', ext: '.pdf' }
    ];

    TOOLBAR_INPUTS.forEach(({ id, ext }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const stripExt = () => {
        if (el.value.toLowerCase().endsWith(ext)) {
          el.value = el.value.slice(0, -ext.length);
        } else if (el.value.toLowerCase().endsWith('.pdf')) {
          el.value = el.value.slice(0, -4);
        } else if (el.value.toLowerCase().endsWith('.zip')) {
          el.value = el.value.slice(0, -4);
        }
      };
      stripExt();
      el.addEventListener('input', stripExt);
      el.addEventListener('blur', stripExt);
      el.addEventListener('paste', () => setTimeout(stripExt, 0));
    });

    const modalInput = document.getElementById('resultFilenameInput');
    if (modalInput) {
      const cleanModalInput = () => {
        if (modalInput.value.toLowerCase().endsWith('.pdf')) {
          modalInput.value = modalInput.value.slice(0, -4);
        } else if (modalInput.value.toLowerCase().endsWith('.zip')) {
          modalInput.value = modalInput.value.slice(0, -4);
        }
      };
      modalInput.addEventListener('input', cleanModalInput);
      modalInput.addEventListener('blur', cleanModalInput);
      modalInput.addEventListener('paste', () => setTimeout(cleanModalInput, 0));
    }
  }

  // Handle files dropped into Homepage hero dropzone
  async function handleGlobalDroppedFiles(files) {
    if (!files || files.length === 0) return;

    const pdfs = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const images = files.filter((f) => f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(f.name));

    if (pdfs.length > 1) {
      termLog(`Auto-detected ${pdfs.length} PDF files. Preparing Merge tool...`);
      if (window.FileTransfer) {
        await window.FileTransfer.setPendingFiles('merge', pdfs);
      }
      window.location.href = 'merge.html';
    } else if (images.length > 0 && pdfs.length === 0) {
      termLog(`Auto-detected ${images.length} images. Preparing Image to PDF tool...`);
      if (window.FileTransfer) {
        await window.FileTransfer.setPendingFiles('img2pdf', images);
      }
      window.location.href = 'image-to-pdf.html';
    } else if (pdfs.length === 1 && images.length === 0) {
      // Single PDF -> Prompt user which tool they want
      window._pendingSinglePdf = pdfs[0];
      if (UI.quickFilename) {
        UI.quickFilename.textContent = `${pdfs[0].name} (${Converters.formatBytes(pdfs[0].size)})`;
      }
      if (UI.quickToolModal) {
        UI.quickToolModal.classList.remove('hidden');
      }
    } else {
      if (pdfs.length > 0) {
        if (window.FileTransfer) {
          await window.FileTransfer.setPendingFiles('merge', pdfs);
        }
        window.location.href = 'merge.html';
      } else {
        termLog('Unsupported file type dropped.', 'warn');
      }
    }
  }

  // Expose on window for programmatic access and tests
  window.PdfApp = {
    AppState,
    PagePreviewModal,
    openDocumentPreview,
    openFullFilePreview,
    openFullPagePreview,
    closeFullPreview,
    previewRemoveDoc,
    previewAddDoc,
    previewResizeDoc,
    previewRotateDoc,
    previewImg2PdfDoc,
    previewPdf2ImgDoc,
    previewWatermarkDoc,
    previewRedactDoc,
    previewPageNumbersDoc,
    previewNUpDoc,
    previewSplitDoc,
    processSplitPdf,
    loadSplitPdf,
    previewResultDoc,
    doMoreWithResult,
    ensureDoMoreUI,
    toggleDoMorePanel
  };

  window.toggleDoMorePanel = toggleDoMorePanel;
  window.doMoreWithResult = doMoreWithResult;

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
