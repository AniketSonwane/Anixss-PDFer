/**
 * Anixss-PDFer - Converters Module (converters.js)
 * Implements Image to PDF, PDF to Image, ZIP packaging, and download/print helpers.
 */

(function () {
  'use strict';

  const Converters = {
    /**
     * Converts an array of image files (JPG, PNG, WebP) into a single PDF.
     * @param {Array<File|Blob>} imageFiles
     * @param {Object} options
     *   - pageSize: 'fit' | 'A4' | 'LETTER' | 'A3' | 'LEGAL'
     *   - orientation: 'auto' | 'portrait' | 'landscape'
     *   - margin: number (points, default 0)
     *   - fitMode: 'contain' | 'fill'
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async imagesToPdf(imageFiles, options = {}, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');
      if (!imageFiles || imageFiles.length === 0) {
        throw new Error('Please select at least one image file.');
      }

      const pdfDoc = await window.PDFLib.PDFDocument.create();
      const total = imageFiles.length;
      const margin = options.margin !== undefined ? options.margin : 0;
      const pageSizePreset = options.pageSize || 'A4';
      const orientation = options.orientation || 'auto';
      const fitMode = options.fitMode || 'contain';

      for (let i = 0; i < total; i++) {
        const file = imageFiles[i];
        if (onProgress) {
          onProgress(i + 1, total, `Processing image ${i + 1} of ${total}: ${file.name || 'image'}`);
        }

        // Convert image file to appropriate format for pdf-lib embedding
        const normalized = await this.normalizeImage(file);
        
        let embeddedImage;
        if (normalized.isJpg) {
          embeddedImage = await pdfDoc.embedJpg(normalized.bytes);
        } else {
          embeddedImage = await pdfDoc.embedPng(normalized.bytes);
        }

        const imgWidth = embeddedImage.width;
        const imgHeight = embeddedImage.height;

        let pageWidth;
        let pageHeight;

        if (pageSizePreset === 'fit') {
          // Page matches image dimensions + margin
          pageWidth = imgWidth + margin * 2;
          pageHeight = imgHeight + margin * 2;
        } else {
          const standardSizes = {
            A4: [595.28, 841.89],
            A3: [841.89, 1190.55],
            A5: [419.53, 595.28],
            LETTER: [612.0, 792.0],
            LEGAL: [612.0, 1008.0]
          };

          let [presetW, presetH] = standardSizes[pageSizePreset] || standardSizes.A4;

          if (orientation === 'portrait') {
            pageWidth = Math.min(presetW, presetH);
            pageHeight = Math.max(presetW, presetH);
          } else if (orientation === 'landscape') {
            pageWidth = Math.max(presetW, presetH);
            pageHeight = Math.min(presetW, presetH);
          } else {
            // 'auto': match image orientation
            if (imgWidth > imgHeight) {
              pageWidth = Math.max(presetW, presetH);
              pageHeight = Math.min(presetW, presetH);
            } else {
              pageWidth = Math.min(presetW, presetH);
              pageHeight = Math.max(presetW, presetH);
            }
          }
        }

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Calculate available area considering margins
        const availWidth = Math.max(1, pageWidth - margin * 2);
        const availHeight = Math.max(1, pageHeight - margin * 2);

        let drawWidth;
        let drawHeight;

        if (pageSizePreset === 'fit') {
          drawWidth = imgWidth;
          drawHeight = imgHeight;
        } else if (fitMode === 'contain') {
          const scale = Math.min(availWidth / imgWidth, availHeight / imgHeight);
          drawWidth = imgWidth * scale;
          drawHeight = imgHeight * scale;
        } else {
          // 'fill'
          drawWidth = availWidth;
          drawHeight = availHeight;
        }

        // Center within available margin area
        const drawX = margin + (availWidth - drawWidth) / 2;
        const drawY = margin + (availHeight - drawHeight) / 2;

        page.drawImage(embeddedImage, {
          x: drawX,
          y: drawY,
          width: drawWidth,
          height: drawHeight
        });
      }

      if (onProgress) onProgress(total, total, 'Compiling PDF document...');
      return await pdfDoc.save();
    },

    /**
     * Normalizes any supported image (JPG, PNG, WebP, BMP, GIF) into bytes ready for pdf-lib.
     * WebP and other formats are re-rendered to PNG via an offscreen HTML Canvas.
     * @param {File|Blob} file
     * @returns {Promise<{ isJpg: boolean, bytes: Uint8Array }>}
     */
    async normalizeImage(file) {
      const type = file.type ? file.type.toLowerCase() : '';
      const name = file.name ? file.name.toLowerCase() : '';

      const isJpeg = type === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
      const isPng = type === 'image/png' || name.endsWith('.png');

      if (isJpeg) {
        try {
          const buffer = await file.arrayBuffer();
          return { isJpg: true, bytes: new Uint8Array(buffer) };
        } catch (e) {
          // Fall back to canvas re-encoding if direct load fails
        }
      }

      if (isPng) {
        try {
          const buffer = await file.arrayBuffer();
          return { isJpg: false, bytes: new Uint8Array(buffer) };
        } catch (e) {
          // Fall back to canvas
        }
      }

      // Universal Canvas path for WebP, BMP, GIF, corrupted metadata PNGs
      return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = async () => {
          URL.revokeObjectURL(objectUrl);
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          canvas.toBlob(async (blob) => {
            if (!blob) {
              reject(new Error('Failed to process image through canvas.'));
              return;
            }
            const buffer = await blob.arrayBuffer();
            resolve({ isJpg: false, bytes: new Uint8Array(buffer) });
          }, 'image/png');
        };

        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error(`Failed to load image: ${file.name || 'unknown'}`));
        };

        img.src = objectUrl;
      });
    },

    /**
     * Converts PDF pages into images (PNG or JPEG).
     * @param {ArrayBuffer|Uint8Array} pdfBuffer
     * @param {Object} options
     *   - format: 'image/png' | 'image/jpeg'
     *   - scale: number (1.0 = 72 DPI, 1.5, 2.0 = 144 DPI, 3.0 = 216 DPI)
     *   - quality: number (0.8 - 1.0)
     *   - pages: Array<number> (1-indexed) or 'all'
     * @param {Function} onProgress
     * @returns {Promise<Array<{ pageNum: number, blob: Blob, dataUrl: string, filename: string }>>}
     */
    async pdfToImages(pdfBuffer, options = {}, onProgress = null) {
      if (!window.PdfPreview) throw new Error('PdfPreview module is not available.');

      const pdfDoc = await window.PdfPreview.loadDocument(pdfBuffer);
      const totalPages = pdfDoc.numPages;

      let targetPages = [];
      if (!options.pages || options.pages === 'all') {
        for (let i = 1; i <= totalPages; i++) targetPages.push(i);
      } else {
        targetPages = options.pages.filter((p) => p >= 1 && p <= totalPages);
      }

      if (targetPages.length === 0) {
        throw new Error('No pages selected for conversion.');
      }

      const format = options.format || 'image/png';
      const ext = format === 'image/jpeg' ? 'jpg' : 'png';
      const scale = options.scale || 2.0; // Crisp 144 DPI default
      const quality = options.quality !== undefined ? options.quality : 0.92;

      const results = [];
      const totalToConvert = targetPages.length;

      for (let i = 0; i < totalToConvert; i++) {
        const pageNum = targetPages[i];
        if (onProgress) {
          onProgress(i + 1, totalToConvert, `Rendering page ${pageNum} (${i + 1} of ${totalToConvert})...`);
        }

        const blob = await window.PdfPreview.renderPageToBlob(pdfDoc, pageNum, {
          scale,
          format,
          quality
        });

        const paddedNum = String(pageNum).padStart(String(totalPages).length, '0');
        const filename = `page_${paddedNum}.${ext}`;
        const dataUrl = URL.createObjectURL(blob);

        results.push({
          pageNum,
          blob,
          dataUrl,
          filename
        });
      }

      if (onProgress) onProgress(totalToConvert, totalToConvert, 'Image conversion complete.');
      return results;
    },

    /**
     * Bundles multiple blobs into a ZIP file using JSZip.
     * @param {Array<{ filename: string, blob: Blob }>} items
     * @param {Function} onProgress
     * @returns {Promise<Blob>}
     */
    async createZip(items, onProgress = null) {
      if (!window.JSZip) {
        throw new Error('JSZip library is not loaded.');
      }
      if (!items || items.length === 0) {
        throw new Error('No files provided to zip.');
      }

      const zip = new window.JSZip();
      items.forEach((item) => {
        zip.file(item.filename, item.blob);
      });

      return await zip.generateAsync({ type: 'blob' }, (metadata) => {
        if (onProgress) {
          onProgress(Math.floor(metadata.percent), 100, `Compressing ZIP archive (${Math.floor(metadata.percent)}%)...`);
        }
      });
    },

    /**
     * Parses page range strings such as "1, 3-5, 8" into a Set of 1-indexed numbers.
     * @param {string} inputStr
     * @param {number} totalPages
     * @returns {Set<number>}
     */
    parsePageRanges(inputStr, totalPages) {
      const result = new Set();
      if (!inputStr || typeof inputStr !== 'string') return result;

      const parts = inputStr.split(',');
      for (const rawPart of parts) {
        const part = rawPart.trim();
        if (!part) continue;

        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-');
          const start = parseInt(startStr.trim(), 10);
          const end = parseInt(endStr.trim(), 10);

          if (!isNaN(start) && !isNaN(end)) {
            const min = Math.max(1, Math.min(start, end));
            const max = Math.min(totalPages, Math.max(start, end));
            for (let p = min; p <= max; p++) {
              result.add(p);
            }
          }
        } else {
          const pageNum = parseInt(part, 10);
          if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
            result.add(pageNum);
          }
        }
      }

      return result;
    },

    /**
     * Formats bytes into human-readable string.
     * @param {number} bytes
     * @param {number} decimals
     * @returns {string}
     */
    formatBytes(bytes, decimals = 1) {
      if (bytes === 0 || !bytes) return '0 B';
      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },

    /**
     * Triggers a browser file download.
     * @param {Blob|Uint8Array} data
     * @param {string} filename
     */
    downloadBlob(data, filename) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'document.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    },

    /**
     * Opens native browser print dialog for a PDF blob reliably using an invisible iframe.
     * @param {Blob|Uint8Array} data
     */
    printPdfBlob(data) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      // Create an invisible iframe to host the PDF document
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = blobUrl;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        setTimeout(() => {
          try {
            iframe.focus();
            iframe.contentWindow.print();
          } catch (e) {
            // Fallback for browsers that restrict iframe.print()
            const printWindow = window.open(blobUrl, '_blank');
            if (printWindow) {
              printWindow.onload = () => printWindow.print();
            }
          } finally {
            setTimeout(() => {
              if (document.body.contains(iframe)) {
                document.body.removeChild(iframe);
              }
              URL.revokeObjectURL(blobUrl);
            }, 120000);
          }
        }, 500);
      };
    }
  };

  window.Converters = Converters;
})();
