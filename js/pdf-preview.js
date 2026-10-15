/**
 * Anixss-PDFer - PDF Preview Module (pdf-preview.js)
 * Manages PDF rendering, thumbnail generation, and canvas operations using PDF.js.
 */

(function () {
  'use strict';

  // Initialize PDF.js Worker
  if (window.pdfjsLib) {
    // Prefer local worker if available, fallback to cdnjs
    try {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = './assets/vendor/pdf.worker.min.js';
    } catch (e) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
  }

  const PdfPreview = {
    /**
     * Loads a PDF document from an ArrayBuffer, Uint8Array, or Blob.
     * @param {ArrayBuffer|Uint8Array|Blob} source
     * @returns {Promise<PDFDocumentProxy>}
     */
    async loadDocument(source) {
      if (!window.pdfjsLib) {
        throw new Error('PDF.js library is not loaded.');
      }

      let data;
      if (source instanceof Blob) {
        data = await source.arrayBuffer();
      } else if (source instanceof Uint8Array) {
        // Clone the typed array and its underlying buffer to prevent detachment by PDF.js worker
        const clone = new Uint8Array(source.length);
        clone.set(source);
        data = clone.buffer;
      } else if (source instanceof ArrayBuffer) {
        // Clone the ArrayBuffer so PDF.js worker thread transfer does not detach the original
        data = source.slice(0);
      } else {
        throw new Error('Invalid PDF source type.');
      }

      const loadingTask = window.pdfjsLib.getDocument({
        data: new Uint8Array(data),
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      return await loadingTask.promise;
    },

    /**
     * Renders a specific page of a PDF document onto a target <canvas>.
     * @param {PDFDocumentProxy} pdfDoc
     * @param {number} pageNum 1-indexed page number
     * @param {HTMLCanvasElement} canvas Target canvas
     * @param {Object} options { scale, maxWidth, maxHeight, rotation }
     * @returns {Promise<{ width: number, height: number }>}
     */
    async renderPageToCanvas(pdfDoc, pageNum, canvas, options = {}) {
      const page = await pdfDoc.getPage(pageNum);
      
      // Determine rotation (original rotation + extra rotation)
      const baseRotation = page.rotate || 0;
      const extraRotation = options.rotation || 0;
      const finalRotation = (baseRotation + extraRotation) % 360;

      // Base unscaled viewport to calculate proportions
      const unscaledViewport = page.getViewport({ scale: 1.0, rotation: finalRotation });
      
      let scale = options.scale || 1.0;
      if (options.maxWidth || options.maxHeight) {
        const maxWidth = options.maxWidth || Infinity;
        const maxHeight = options.maxHeight || Infinity;
        const scaleX = maxWidth / unscaledViewport.width;
        const scaleY = maxHeight / unscaledViewport.height;
        scale = Math.min(scaleX, scaleY);
      }

      const viewport = page.getViewport({ scale, rotation: finalRotation });

      // Support high DPI displays crisp rendering
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);

      // Measure container to set exact proportional width and height matching PDF page ratio (e.g. A4)
      let container = canvas.parentElement;
      if (container && container.id && container.id.includes('Wrapper') && container.parentElement) {
        container = container.parentElement;
      }
      const availW = container && container.clientWidth ? Math.max(160, container.clientWidth - 24) : (typeof window !== 'undefined' ? window.innerWidth - 32 : 800);
      const targetW = Math.min(availW, Math.floor(viewport.width));
      const pageRatio = unscaledViewport.width / unscaledViewport.height;
      const targetH = Math.round(targetW / pageRatio);

      if (options.fixedHeight) {
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';
      } else {
        canvas.style.width = `${targetW}px`;
        canvas.style.height = `${targetH}px`;
        canvas.style.maxWidth = '100%';
        canvas.style.aspectRatio = `${unscaledViewport.width} / ${unscaledViewport.height}`;
      }

      // If wrapped in a canvas wrapper (e.g. redactCanvasWrapper, watermarkCanvasWrapper),
      // size the wrapper to the exact same dimensions as the PDF preview to eliminate any extra space
      const wrapper = canvas.parentElement && canvas.parentElement.id && canvas.parentElement.id.includes('Wrapper') ? canvas.parentElement : null;
      if (wrapper && !options.fixedHeight) {
        wrapper.style.width = `${targetW}px`;
        wrapper.style.height = `${targetH}px`;
        wrapper.style.maxWidth = '100%';
        wrapper.style.aspectRatio = `${unscaledViewport.width} / ${unscaledViewport.height}`;
      }

      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Cancel previous render task if present on canvas
      if (canvas._renderTask) {
        try {
          canvas._renderTask.cancel();
        } catch (e) {
          // Ignore cancellation errors
        }
      }

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
      };

      const renderTask = page.render(renderContext);
      canvas._renderTask = renderTask;

      try {
        await renderTask.promise;
      } catch (err) {
        if (err && err.name !== 'RenderingCancelledException') {
          console.error('Render error:', err);
          throw err;
        }
      } finally {
        canvas._renderTask = null;
      }

      return { width: viewport.width, height: viewport.height };
    },

    /**
     * Renders a page to an image Blob (PNG or JPEG).
     * @param {PDFDocumentProxy} pdfDoc
     * @param {number} pageNum
     * @param {Object} options { scale, format: 'image/png'|'image/jpeg', quality: 0.92 }
     * @returns {Promise<Blob>}
     */
    async renderPageToBlob(pdfDoc, pageNum, options = {}) {
      const page = await pdfDoc.getPage(pageNum);
      const scale = options.scale || 2.0; // Default 2x for sharp export
      const format = options.format || 'image/png';
      const quality = options.quality !== undefined ? options.quality : 0.92;
      const rotation = options.rotation || 0;

      const viewport = page.getViewport({ scale, rotation });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const ctx = canvas.getContext('2d');
      // Fill white background for JPEGs or transparent pages
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      return new Promise((resolve) => {
        canvas.toBlob((blob) => {
          resolve(blob);
        }, format, quality);
      });
    },

    /**
     * Draws an instant high-contrast monochrome page placeholder on canvas.
     * Ensures canvas is never blank while loading or if worker fails.
     * @param {HTMLCanvasElement} canvas
     * @param {number} pageNum
     * @param {string} label
     * @param {number} rotation
     * @param {Object} options { maxWidth, maxHeight }
     */
    drawFallbackPage(canvas, pageNum, label = 'Page', rotation = 0, options = {}) {
      if (!canvas) return;
      const w = options.maxWidth || 140;
      const h = options.maxHeight || 170;
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = Math.floor(w) + 'px';
      canvas.style.height = Math.floor(h) + 'px';

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(dpr, dpr);

      // Clean paper background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);

      // Bold border matching terminal theme
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(3, 3, w - 6, h - 6);

      // Top title bar
      ctx.fillStyle = '#f4f4f5';
      ctx.fillRect(3, 3, w - 6, 22);
      ctx.strokeRect(3, 3, w - 6, 22);

      // Page Badge
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`PAGE ${pageNum}`, w / 2, 18);

      // Simulated text lines
      ctx.fillStyle = '#e4e4e7';
      const lineYStart = 36;
      const lineSpacing = 11;
      const lineCount = Math.floor((h - 50) / lineSpacing);
      for (let i = 0; i < lineCount; i++) {
        const y = lineYStart + i * lineSpacing;
        const lineW = (i % 3 === 0) ? (w - 24) * 0.65 : (w - 24);
        ctx.fillRect(12, y, lineW, 4);
      }

      // If rotated, show rotation tag
      if (rotation) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(w - 36, h - 20, 28, 14);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px monospace';
        ctx.fillText(`+${rotation}°`, w - 22, h - 10);
      }

      ctx.restore();
    }
  };

  // Expose globally
  window.PdfPreview = PdfPreview;
})();
