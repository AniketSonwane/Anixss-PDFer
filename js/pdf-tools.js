/**
 * Anixss-PDFer - PDF Tools Module (pdf-tools.js)
 * Implements PDF manipulation: merge, remove pages, add pages, resize, and rotate using pdf-lib.
 */

(function () {
  'use strict';

  // Standard Page Dimensions in PostScript Points (72 pt / inch)
  const PAGE_SIZES = {
    A4: [595.28, 841.89],
    A3: [841.89, 1190.55],
    A5: [419.53, 595.28],
    LETTER: [612.0, 792.0],
    LEGAL: [612.0, 1008.0]
  };

  // Helper to ensure an ArrayBuffer is never passed as a detached or mutative reference
  function cloneBuffer(buf) {
    if (!buf) return null;
    if (buf instanceof ArrayBuffer) {
      return buf.slice(0);
    }
    if (buf instanceof Uint8Array) {
      const copy = new Uint8Array(buf.length);
      copy.set(buf);
      return copy.buffer;
    }
    return buf;
  }

  const PdfTools = {
    PAGE_SIZES,
    cloneBuffer,

    /**
     * Merge multiple PDF files in given sequence.
     * @param {Array<{ name: string, buffer: ArrayBuffer|Uint8Array, rotation?: number }>} files
     * @param {Object|Function} optionsOrProgress Optional options or progress callback
     *   - addBlankBetween: boolean (insert a blank page between merged documents)
     *   - addBlankAfterOddPages: boolean (insert a blank page after each odd page in document)
     *   - padOddPageFiles: boolean (pad odd-page files to even for duplex printing)
     *   - blankPageSize: [width, height] (optional custom size, defaults to preceding page)
     * @param {Function} onProgress Optional progress callback if options provided as 2nd arg
     * @returns {Promise<Uint8Array>}
     */
    async mergePdfs(files, optionsOrProgress = null, onProgress = null) {
      if (!window.PDFLib) {
        throw new Error('PDF-Lib is not loaded.');
      }
      if (!files || files.length < 2) {
        throw new Error('Merge requires at least 2 PDF files.');
      }

      let options = {};
      let progressCallback = null;
      if (typeof optionsOrProgress === 'function') {
        progressCallback = optionsOrProgress;
      } else if (optionsOrProgress && typeof optionsOrProgress === 'object') {
        options = optionsOrProgress;
        progressCallback = onProgress;
      }

      const mergedPdf = await window.PDFLib.PDFDocument.create();
      const total = files.length;

      for (let i = 0; i < total; i++) {
        const item = files[i];
        if (progressCallback) {
          progressCallback(i + 1, total, `Merging file ${i + 1} of ${total}: ${item.name}`);
        }

        const srcDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(item.buffer), { ignoreEncryption: true });
        const pageIndices = srcDoc.getPageIndices();

        if (options.addBlankAfterOddPages) {
          // Add blank page after each odd page in document
          for (let p = 0; p < pageIndices.length; p++) {
            const [copiedPage] = await mergedPdf.copyPages(srcDoc, [pageIndices[p]]);
            if (item.rotation) {
              const currentRot = copiedPage.getRotation().angle;
              copiedPage.setRotation(window.PDFLib.degrees((currentRot + item.rotation) % 360));
            }
            mergedPdf.addPage(copiedPage);

            // Odd page (p + 1 is odd: 1, 3, 5...)
            if ((p + 1) % 2 === 1) {
              const { width, height } = copiedPage.getSize();
              mergedPdf.addPage([width, height]);
              if (progressCallback) {
                progressCallback(i + 1, total, `Added blank page after odd page ${p + 1} of ${item.name}`);
              }
            }
          }
        } else {
          const copiedPages = await mergedPdf.copyPages(srcDoc, pageIndices);
          copiedPages.forEach((page) => {
            if (item.rotation) {
              const currentRot = page.getRotation().angle;
              page.setRotation(window.PDFLib.degrees((currentRot + item.rotation) % 360));
            }
            mergedPdf.addPage(page);
          });
        }

        // Pad odd-paged file with a blank page (duplex safe)
        if (options.padOddPageFiles && pageIndices.length % 2 === 1 && i < total - 1) {
          let blankW = 595.28, blankH = 841.89;
          const currentCount = mergedPdf.getPageCount();
          if (currentCount > 0) {
            const lastAdded = mergedPdf.getPage(currentCount - 1);
            const { width, height } = lastAdded.getSize();
            blankW = width;
            blankH = height;
          }
          mergedPdf.addPage([blankW, blankH]);
          if (progressCallback) {
            progressCallback(i + 1, total, `Padded odd file ${item.name} with blank page`);
          }
        }

        // Insert blank page between documents if requested and not the last document
        if (options.addBlankBetween && i < total - 1) {
          let blankW = 595.28;
          let blankH = 841.89; // Default A4
          if (options.blankPageSize && Array.isArray(options.blankPageSize)) {
            [blankW, blankH] = options.blankPageSize;
          } else {
            // Match the dimensions of the last added page
            const currentCount = mergedPdf.getPageCount();
            if (currentCount > 0) {
              const lastAdded = mergedPdf.getPage(currentCount - 1);
              const { width, height } = lastAdded.getSize();
              blankW = width;
              blankH = height;
            }
          }

          mergedPdf.addPage([blankW, blankH]);
          if (progressCallback) {
            progressCallback(i + 1, total, `Inserted blank separator page after file ${i + 1}`);
          }
        }
      }

      if (progressCallback) {
        progressCallback(total, total, 'Finalizing merged document...');
      }

      return await mergedPdf.save({ useObjectStreams: false });
    },

    /**
     * Merge individual pages in custom sequence (enables drag & drop reorganization).
     * @param {Array<{ type: 'pdfPage'|'blankPage', buffer?: ArrayBuffer, pageIndex?: number, rotation?: number, width?: number, height?: number }>} pageSequence
     * @param {Object|Function} optionsOrProgress
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async mergeCustomPages(pageSequence, optionsOrProgress = null, onProgress = null) {
      if (!window.PDFLib) {
        throw new Error('PDF-Lib is not loaded.');
      }
      if (!pageSequence || pageSequence.length === 0) {
        throw new Error('No pages to merge.');
      }

      let options = {};
      let progressCallback = null;
      if (typeof optionsOrProgress === 'function') {
        progressCallback = optionsOrProgress;
      } else if (optionsOrProgress && typeof optionsOrProgress === 'object') {
        options = optionsOrProgress;
        progressCallback = onProgress;
      }

      const mergedPdf = await window.PDFLib.PDFDocument.create();
      const total = pageSequence.length;
      const docCache = new Map();

      for (let i = 0; i < total; i++) {
        const item = pageSequence[i];
        if (progressCallback) {
          progressCallback(i + 1, total, `Processing page ${i + 1} of ${total}`);
        }

        if (item.type === 'blankPage') {
          let w = item.width;
          let h = item.height;
          if (!w || !h) {
            const currentCount = mergedPdf.getPageCount();
            if (currentCount > 0) {
              const lastPage = mergedPdf.getPage(currentCount - 1);
              const size = lastPage.getSize();
              w = size.width;
              h = size.height;
            } else {
              w = 595.28;
              h = 841.89;
            }
          }
          mergedPdf.addPage([w, h]);
        } else if (item.type === 'pdfPage') {
          let srcDoc = docCache.get(item.buffer);
          if (!srcDoc) {
            srcDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(item.buffer), { ignoreEncryption: true });
            docCache.set(item.buffer, srcDoc);
          }

          const [copiedPage] = await mergedPdf.copyPages(srcDoc, [item.pageIndex]);
          if (item.rotation) {
            const currentRot = copiedPage.getRotation().angle;
            copiedPage.setRotation(window.PDFLib.degrees((currentRot + item.rotation) % 360));
          }
          mergedPdf.addPage(copiedPage);
        }

        // Check if addBlankAfterOddPages is active and output page index is odd (1-indexed odd: 1, 3, 5...)
        if (options.addBlankAfterOddPages && (i + 1) % 2 === 1 && i < total - 1) {
          const currentCount = mergedPdf.getPageCount();
          let blankW = 595.28, blankH = 841.89;
          if (currentCount > 0) {
            const lastPage = mergedPdf.getPage(currentCount - 1);
            const size = lastPage.getSize();
            blankW = size.width;
            blankH = size.height;
          }
          mergedPdf.addPage([blankW, blankH]);
        }
      }

      if (progressCallback) {
        progressCallback(total, total, 'Finalizing merged document...');
      }

      return await mergedPdf.save({ useObjectStreams: false });
    },

    /**
     * Remove selected pages from a PDF.
     * @param {ArrayBuffer|Uint8Array} pdfBuffer Source PDF
     * @param {Set<number>|Array<number>} pagesToRemove 1-indexed page numbers to remove
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async removePages(pdfBuffer, pagesToRemove, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const removeSet = pagesToRemove instanceof Set ? pagesToRemove : new Set(pagesToRemove);
      const srcDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();

      const keepIndices = [];
      for (let i = 0; i < totalPages; i++) {
        const pageNum = i + 1;
        if (!removeSet.has(pageNum)) {
          keepIndices.push(i);
        }
      }

      if (keepIndices.length === 0) {
        throw new Error('Cannot remove all pages. At least one page must remain.');
      }
      if (keepIndices.length === totalPages) {
        throw new Error('No pages selected for removal.');
      }

      if (onProgress) {
        onProgress(1, 2, `Extracting ${keepIndices.length} kept pages...`);
      }

      const newPdf = await window.PDFLib.PDFDocument.create();
      const copiedPages = await newPdf.copyPages(srcDoc, keepIndices);
      copiedPages.forEach((p) => newPdf.addPage(p));

      if (onProgress) {
        onProgress(2, 2, 'Saving modified PDF...');
      }

      return await newPdf.save();
    },

    /**
     * Add pages to a PDF document (blank pages or pages from another PDF).
     * @param {ArrayBuffer|Uint8Array} primaryBuffer
     * @param {Object} options
     *   - type: 'blank' | 'pdf'
     *   - position: 'start' | 'end' | 'before' | 'after'
     *   - targetPage: number (1-indexed, for before/after)
     *   - For 'blank':
     *       - blankCount: number
     *       - pageSize: [width, height]
     *       - orientation: 'portrait' | 'landscape'
     *   - For 'pdf':
     *       - secondaryBuffer: ArrayBuffer|Uint8Array
     *       - secondaryPages: Array<number> (1-indexed) or 'all'
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async addPages(primaryBuffer, options, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const primaryDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(primaryBuffer), { ignoreEncryption: true });
      const primaryCount = primaryDoc.getPageCount();

      // Determine insert index in 0-indexed terms
      let insertIndex = primaryCount; // default 'end'
      if (options.position === 'start') {
        insertIndex = 0;
      } else if (options.position === 'before') {
        const target = Math.max(1, Math.min(primaryCount, options.targetPage || 1));
        insertIndex = target - 1;
      } else if (options.position === 'after') {
        const target = Math.max(1, Math.min(primaryCount, options.targetPage || primaryCount));
        insertIndex = target;
      }

      if (options.type === 'blank') {
        const count = Math.max(1, parseInt(options.blankCount, 10) || 1);
        let [w, h] = options.pageSize || PAGE_SIZES.A4;
        
        if (options.orientation === 'landscape' && w < h) {
          [w, h] = [h, w];
        } else if (options.orientation === 'portrait' && w > h) {
          [w, h] = [h, w];
        }

        if (onProgress) onProgress(1, 2, `Inserting ${count} blank page(s)...`);

        for (let i = 0; i < count; i++) {
          primaryDoc.insertPage(insertIndex + i, [w, h]);
        }
      } else if (options.type === 'pdf') {
        if (!options.secondaryBuffer) {
          throw new Error('Secondary PDF file is required.');
        }

        if (onProgress) onProgress(1, 3, 'Loading secondary PDF...');
        const secondaryDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(options.secondaryBuffer), { ignoreEncryption: true });
        const secTotal = secondaryDoc.getPageCount();

        let indicesToCopy = [];
        if (!options.secondaryPages || options.secondaryPages === 'all') {
          indicesToCopy = secondaryDoc.getPageIndices();
        } else {
          indicesToCopy = options.secondaryPages
            .map((num) => num - 1)
            .filter((idx) => idx >= 0 && idx < secTotal);
        }

        if (indicesToCopy.length === 0) {
          throw new Error('No valid pages to insert from secondary PDF.');
        }

        if (onProgress) onProgress(2, 3, `Copying ${indicesToCopy.length} page(s)...`);
        const copiedPages = await primaryDoc.copyPages(secondaryDoc, indicesToCopy);

        for (let i = 0; i < copiedPages.length; i++) {
          primaryDoc.insertPage(insertIndex + i, copiedPages[i]);
        }
      } else {
        throw new Error(`Unsupported add pages type: ${options.type}`);
      }

      if (onProgress) onProgress(3, 3, 'Finalizing document...');
      return await primaryDoc.save();
    },

    /**
     * Resize PDF pages to target dimensions with optional proportional scaling.
     * @param {ArrayBuffer|Uint8Array} pdfBuffer
     * @param {Object} options
     *   - targetSize: [width, height] in points
     *   - orientation: 'portrait' | 'landscape' | 'auto'
     *   - scalingMode: 'proportional' | 'stretch' | 'crop'
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async resizePdf(pdfBuffer, options, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const srcDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const newPdf = await window.PDFLib.PDFDocument.create();
      const pageCount = srcDoc.getPageCount();

      const [baseW, baseH] = options.targetSize || PAGE_SIZES.A4;
      const scalingMode = options.scalingMode || 'proportional';
      const orientation = options.orientation || 'auto';

      for (let i = 0; i < pageCount; i++) {
        if (onProgress) {
          onProgress(i + 1, pageCount, `Resizing page ${i + 1} of ${pageCount}...`);
        }

        const srcPage = srcDoc.getPage(i);
        const { width: origW, height: origH } = srcPage.getSize();

        // Determine target width & height based on orientation
        let targetW = baseW;
        let targetH = baseH;

        if (orientation === 'portrait') {
          if (targetW > targetH) [targetW, targetH] = [targetH, targetW];
        } else if (orientation === 'landscape') {
          if (targetW < targetH) [targetW, targetH] = [targetH, targetW];
        } else {
          // 'auto': preserve page aspect (if original was wider, make target landscape)
          if (origW > origH && targetW < targetH) {
            [targetW, targetH] = [targetH, targetW];
          } else if (origW < origH && targetW > targetH) {
            [targetW, targetH] = [targetH, targetW];
          }
        }

        const newPage = newPdf.addPage([targetW, targetH]);
        const hasContents = srcPage.node.Contents() !== undefined;

        if (hasContents) {
          const [embeddedPage] = await newPdf.embedPdf(srcDoc, [i]);

          if (scalingMode === 'proportional') {
            // Scale to fit target dimensions without cropping
            const scale = Math.min(targetW / origW, targetH / origH);
            const scaledW = origW * scale;
            const scaledH = origH * scale;
            const x = (targetW - scaledW) / 2;
            const y = (targetH - scaledH) / 2;

            newPage.drawPage(embeddedPage, {
              x,
              y,
              xScale: scale,
              yScale: scale
            });
          } else if (scalingMode === 'stretch') {
            newPage.drawPage(embeddedPage, {
              x: 0,
              y: 0,
              xScale: targetW / origW,
              yScale: targetH / origH
            });
          } else {
            // 'crop' / original size centered
            const x = (targetW - origW) / 2;
            const y = (targetH - origH) / 2;
            newPage.drawPage(embeddedPage, {
              x,
              y,
              xScale: 1,
              yScale: 1
            });
          }
        }
      }

      if (onProgress) onProgress(pageCount, pageCount, 'Saving resized PDF...');
      return await newPdf.save();
    },

    /**
     * Rotate PDF pages.
     * @param {ArrayBuffer|Uint8Array} pdfBuffer
     * @param {Object} options
     *   - rotations: Object mapping { [1-indexed pageNum]: deltaAngle } or { all: deltaAngle }
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async rotatePdf(pdfBuffer, options, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const pdfDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const total = pages.length;
      const rotations = options.rotations || {};

      for (let i = 0; i < total; i++) {
        const pageNum = i + 1;
        const page = pages[i];
        
        let delta = 0;
        if (rotations[pageNum] !== undefined) {
          delta = rotations[pageNum];
        } else if (rotations.all !== undefined) {
          delta = rotations.all;
        }

        if (delta !== 0) {
          const currentRotation = page.getRotation().angle || 0;
          let finalAngle = (currentRotation + delta) % 360;
          if (finalAngle < 0) finalAngle += 360;
          page.setRotation(window.PDFLib.degrees(finalAngle));
        }
      }

      if (onProgress) onProgress(total, total, 'Applying rotations...');
      return await pdfDoc.save();
    },

    /**
     * Parse color input (hex, name, or array) into a PDFLib rgb object.
     * @param {string|Array<number>} color
     * @returns {PDFLib.RGB}
     */
    parseColor(color) {
      if (!window.PDFLib) return null;
      if (!color) return window.PDFLib.rgb(0, 0, 0);
      if (Array.isArray(color)) {
        return window.PDFLib.rgb(
          Number(color[0]) || 0,
          Number(color[1]) || 0,
          Number(color[2]) || 0
        );
      }
      if (typeof color === 'string') {
        const c = color.trim().toLowerCase();
        if (c === 'black') return window.PDFLib.rgb(0, 0, 0);
        if (c === 'white') return window.PDFLib.rgb(1, 1, 1);
        if (c === 'red') return window.PDFLib.rgb(0.85, 0.15, 0.15);
        if (c === 'blue') return window.PDFLib.rgb(0.1, 0.35, 0.85);
        if (c === 'gray' || c === 'grey') return window.PDFLib.rgb(0.5, 0.5, 0.5);
        if (c.startsWith('#')) {
          let hex = c.slice(1);
          if (hex.length === 3) hex = hex.split('').map((x) => x + x).join('');
          if (hex.length === 6) {
            const r = parseInt(hex.substring(0, 2), 16) / 255;
            const g = parseInt(hex.substring(2, 4), 16) / 255;
            const b = parseInt(hex.substring(4, 6), 16) / 255;
            return window.PDFLib.rgb(r, g, b);
          }
        }
      }
      return window.PDFLib.rgb(0, 0, 0);
    },

    /**
     * Add text or image watermark to PDF pages.
     * @param {ArrayBuffer|Uint8Array} pdfBuffer
     * @param {Object} options
     *   - type: 'text' | 'image'
     *   - text: string
     *   - fontFamily: 'Helvetica' | 'TimesRoman' | 'Courier'
     *   - fontSize: number
     *   - color: string | Array<number>
     *   - opacity: number (0.0 to 1.0)
     *   - rotation: number (degrees)
     *   - position: 'center' | 'tile' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
     *   - margin: number
     *   - imageBuffer: ArrayBuffer|Uint8Array
     *   - imageType: 'png' | 'jpg' | 'jpeg'
     *   - imageScale: number (0.1 to 1.0)
     *   - pages: 'all' | 'odd' | 'even' | Array<number> | Set<number>
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async addWatermark(pdfBuffer, options = {}, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const pdfDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const total = pages.length;

      // Determine target pages (0-indexed)
      const targetIndices = new Set();
      if (options.pages === 'odd') {
        for (let i = 0; i < total; i++) {
          if ((i + 1) % 2 === 1) targetIndices.add(i);
        }
      } else if (options.pages === 'even') {
        for (let i = 0; i < total; i++) {
          if ((i + 1) % 2 === 0) targetIndices.add(i);
        }
      } else if (Array.isArray(options.pages) || options.pages instanceof Set) {
        options.pages.forEach((p) => {
          const idx = p - 1;
          if (idx >= 0 && idx < total) targetIndices.add(idx);
        });
      } else {
        for (let i = 0; i < total; i++) targetIndices.add(i);
      }

      const opacity = Math.max(0.01, Math.min(1.0, options.opacity !== undefined ? Number(options.opacity) : 0.25));
      const rotationDeg = Number(options.rotation !== undefined ? options.rotation : 45);
      const rad = (rotationDeg * Math.PI) / 180;
      const position = options.position || 'center';
      const margin = Number(options.margin) || 40;

      if (options.type === 'image' && options.imageBuffer) {
        let embeddedImg = null;
        const imgType = (options.imageType || 'png').toLowerCase();
        if (imgType === 'jpg' || imgType === 'jpeg') {
          embeddedImg = await pdfDoc.embedJpg(cloneBuffer(options.imageBuffer));
        } else {
          embeddedImg = await pdfDoc.embedPng(cloneBuffer(options.imageBuffer));
        }

        const scaleFraction = Math.max(0.05, Math.min(1.0, Number(options.imageScale) || 0.4));

        let processed = 0;
        for (const idx of targetIndices) {
          processed++;
          if (onProgress) onProgress(processed, targetIndices.size, `Applying watermark to page ${idx + 1}...`);

          const page = pages[idx];
          const { width: pW, height: pH } = page.getSize();
          const targetW = pW * scaleFraction;
          const imgAspect = embeddedImg.width / embeddedImg.height;
          const targetH = targetW / imgAspect;

          let x = (pW - targetW) / 2;
          let y = (pH - targetH) / 2;

          if (position === 'top-left') {
            x = margin;
            y = pH - margin - targetH;
          } else if (position === 'top-right') {
            x = pW - margin - targetW;
            y = pH - margin - targetH;
          } else if (position === 'bottom-left') {
            x = margin;
            y = margin;
          } else if (position === 'bottom-right') {
            x = pW - margin - targetW;
            y = margin;
          }

          page.drawImage(embeddedImg, {
            x,
            y,
            width: targetW,
            height: targetH,
            opacity
          });
        }
      } else {
        // Text watermark
        const text = (options.text || 'CONFIDENTIAL').trim();
        const fontSize = Math.max(8, Number(options.fontSize) || 48);
        const fontName = options.fontFamily || 'Helvetica';
        const fontKey = window.PDFLib.StandardFonts[fontName] || window.PDFLib.StandardFonts.Helvetica;
        const font = await pdfDoc.embedFont(fontKey);
        const color = this.parseColor(options.color || '#000000');

        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        let processed = 0;
        for (const idx of targetIndices) {
          processed++;
          if (onProgress) onProgress(processed, targetIndices.size, `Applying watermark to page ${idx + 1}...`);

          const page = pages[idx];
          const { width: pW, height: pH } = page.getSize();

          if (position === 'tile') {
            // Repeat watermark across whole page in diagonal grid
            const stepX = Math.max(160, textWidth + 80);
            const stepY = Math.max(120, textHeight + 80);

            for (let gx = -stepX; gx <= pW + stepX; gx += stepX) {
              for (let gy = -stepY; gy <= pH + stepY; gy += stepY) {
                const dx = (textWidth / 2) * Math.cos(rad) - (textHeight / 2) * Math.sin(rad);
                const dy = (textWidth / 2) * Math.sin(rad) + (textHeight / 2) * Math.cos(rad);
                page.drawText(text, {
                  x: gx - dx,
                  y: gy - dy,
                  size: fontSize,
                  font,
                  color,
                  opacity,
                  rotate: window.PDFLib.degrees(rotationDeg)
                });
              }
            }
          } else {
            let cx = pW / 2;
            let cy = pH / 2;

            if (position === 'top-left') {
              cx = margin + textWidth / 2;
              cy = pH - margin - textHeight / 2;
            } else if (position === 'top-right') {
              cx = pW - margin - textWidth / 2;
              cy = pH - margin - textHeight / 2;
            } else if (position === 'bottom-left') {
              cx = margin + textWidth / 2;
              cy = margin + textHeight / 2;
            } else if (position === 'bottom-right') {
              cx = pW - margin - textWidth / 2;
              cy = margin + textHeight / 2;
            } else if (position === 'top-center') {
              cx = pW / 2;
              cy = pH - margin - textHeight / 2;
            } else if (position === 'bottom-center') {
              cx = pW / 2;
              cy = margin + textHeight / 2;
            }

            const dx = (textWidth / 2) * Math.cos(rad) - (textHeight / 2) * Math.sin(rad);
            const dy = (textWidth / 2) * Math.sin(rad) + (textHeight / 2) * Math.cos(rad);

            page.drawText(text, {
              x: cx - dx,
              y: cy - dy,
              size: fontSize,
              font,
              color,
              opacity,
              rotate: window.PDFLib.degrees(rotationDeg)
            });
          }
        }
      }

      if (onProgress) onProgress(targetIndices.size, targetIndices.size, 'Finalizing watermarked PDF...');
      return await pdfDoc.save();
    },

    /**
     * Redact (hide/blackout/whiteout) content on PDF pages by drawing opaque solid rectangles.
     * @param {ArrayBuffer|Uint8Array} pdfBuffer
     * @param {Array<Object>|Object} redactions Array of box items or map by page
     *   Box properties: { page: number, normX, normY, normW, normH, x, y, width, height, type: 'blackout'|'whiteout', color }
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async redactPdf(pdfBuffer, redactions, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const pdfDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const total = pages.length;

      // Flatten redactions into a list
      let boxList = [];
      if (Array.isArray(redactions)) {
        boxList = redactions;
      } else if (redactions && typeof redactions === 'object') {
        Object.keys(redactions).forEach((pageKey) => {
          const pNum = parseInt(pageKey, 10);
          const list = redactions[pageKey];
          if (Array.isArray(list)) {
            list.forEach((b) => boxList.push({ ...b, page: b.page || pNum }));
          }
        });
      }

      if (boxList.length === 0) {
        throw new Error('No redaction boxes provided.');
      }

      const totalBoxes = boxList.length;
      for (let i = 0; i < totalBoxes; i++) {
        const item = boxList[i];
        const pageNum = Number(item.page) || 1;
        const pageIdx = pageNum - 1;

        if (pageIdx < 0 || pageIdx >= total) continue;

        if (onProgress) {
          onProgress(i + 1, totalBoxes, `Applying redaction box ${i + 1} of ${totalBoxes} on page ${pageNum}...`);
        }

        const page = pages[pageIdx];
        const { width: pW, height: pH } = page.getSize();

        let rectX = 0, rectY = 0, rectW = 0, rectH = 0;

        if (item.normX !== undefined && item.normY !== undefined && item.normW !== undefined && item.normH !== undefined) {
          // Normalized coordinates (0..1) from top-left origin
          rectX = item.normX * pW;
          rectW = item.normW * pW;
          rectH = item.normH * pH;
          rectY = pH - (item.normY + item.normH) * pH;
        } else {
          // Absolute PDF coordinates
          rectX = Number(item.x) || 0;
          rectY = Number(item.y) || 0;
          rectW = Number(item.width) || 0;
          rectH = Number(item.height) || 0;
        }

        let fillColor = window.PDFLib.rgb(0, 0, 0); // Default blackout
        if (item.type === 'whiteout') {
          fillColor = window.PDFLib.rgb(1, 1, 1);
        } else if (item.color) {
          fillColor = this.parseColor(item.color);
        }

        page.drawRectangle({
          x: rectX,
          y: rectY,
          width: Math.max(1, rectW),
          height: Math.max(1, rectH),
          color: fillColor,
          opacity: 1.0
        });
      }

      if (onProgress) onProgress(totalBoxes, totalBoxes, 'Finalizing redacted PDF...');
      return await pdfDoc.save();
    },

    /**
     * Add formatted page numbers to a PDF document.
     * @param {ArrayBuffer|Uint8Array} pdfBuffer
     * @param {Object} options
     *   - format: string (default 'Page {n} of {total}')
     *   - position: 'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'
     *   - startNumber: number (default 1)
     *   - skipCover: boolean (default false)
     *   - margin: number (default 36)
     *   - fontSize: number (default 10)
     *   - fontFamily: 'Helvetica' | 'TimesRoman' | 'Courier'
     *   - color: string | Array<number>
     *   - alternatingMargins: boolean (odd pages right, even pages left)
     *   - pages: 'all' | Array<number> | Set<number>
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async addPageNumbers(pdfBuffer, options = {}, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const pdfDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const total = pages.length;

      const format = options.format || 'Page {n} of {total}';
      const position = options.position || 'bottom-center';
      const startNum = Number(options.startNumber) || 1;
      const skipCover = !!options.skipCover;
      const margin = Number(options.margin) || 36;
      const fontSize = Math.max(6, Number(options.fontSize) || 10);
      const fontName = options.fontFamily || 'Helvetica';
      const fontKey = window.PDFLib.StandardFonts[fontName] || window.PDFLib.StandardFonts.Helvetica;
      const font = await pdfDoc.embedFont(fontKey);
      const color = this.parseColor(options.color || '#000000');
      const alternating = !!options.alternatingMargins;

      // Filter pages
      let targetSet = null;
      if (Array.isArray(options.pages) || options.pages instanceof Set) {
        targetSet = new Set(options.pages);
      }

      const totalNumbered = skipCover ? Math.max(1, total - 1) : total;

      for (let i = 0; i < total; i++) {
        const pageNum = i + 1;
        if (skipCover && pageNum === 1) continue;
        if (targetSet && !targetSet.has(pageNum)) continue;

        if (onProgress) {
          onProgress(pageNum, total, `Numbering page ${pageNum} of ${total}...`);
        }

        const page = pages[i];
        const { width: pW, height: pH } = page.getSize();

        // Calculate displayed number
        const currentDisplayNum = skipCover ? (pageNum - 1 + (startNum - 1)) : (pageNum - 1 + startNum);

        const text = format
          .replace(/\{n\}/g, String(currentDisplayNum))
          .replace(/\{total\}/g, String(totalNumbered));

        const textW = font.widthOfTextAtSize(text, fontSize);
        const textH = font.heightAtSize(fontSize);

        let effectivePos = position;
        if (alternating) {
          const isOdd = pageNum % 2 === 1;
          const isTop = position.startsWith('top');
          effectivePos = isTop ? (isOdd ? 'top-right' : 'top-left') : (isOdd ? 'bottom-right' : 'bottom-left');
        }

        let x = (pW - textW) / 2;
        let y = margin;

        if (effectivePos === 'bottom-center') {
          x = (pW - textW) / 2;
          y = margin;
        } else if (effectivePos === 'bottom-left') {
          x = margin;
          y = margin;
        } else if (effectivePos === 'bottom-right') {
          x = pW - margin - textW;
          y = margin;
        } else if (effectivePos === 'top-center') {
          x = (pW - textW) / 2;
          y = pH - margin - textH;
        } else if (effectivePos === 'top-left') {
          x = margin;
          y = pH - margin - textH;
        } else if (effectivePos === 'top-right') {
          x = pW - margin - textW;
          y = pH - margin - textH;
        }

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color
        });
      }

      if (onProgress) onProgress(total, total, 'Finalizing numbered PDF...');
      return await pdfDoc.save();
    },

    /**
     * Combine multiple pages of a PDF onto 1 page (N-Up PDF).
     * @param {ArrayBuffer|Uint8Array} pdfBuffer
     * @param {Object} options
     *   - nUp: number (2, 4, 6, 9, 16)
     *   - sheetSize: [width, height]
     *   - orientation: 'auto' | 'portrait' | 'landscape'
     *   - pageOrder: 'horizontal' | 'vertical'
     *   - outerMargin: number (default 24)
     *   - spacing: number (default 12)
     *   - drawBorder: boolean
     *   - borderColor: string | Array<number>
     *   - pages: 'all' | Array<number> | Set<number>
     * @param {Function} onProgress
     * @returns {Promise<Uint8Array>}
     */
    async createNUp(pdfBuffer, options = {}, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const srcDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const targetDoc = await window.PDFLib.PDFDocument.create();
      const totalSrc = srcDoc.getPageCount();

      if (totalSrc === 0) throw new Error('Source PDF has no pages.');

      const nUp = Number(options.nUp) || 2;
      const outerMargin = options.outerMargin !== undefined ? Math.max(0, Number(options.outerMargin) || 0) : 24;
      const spacing = options.spacing !== undefined ? Math.max(0, Number(options.spacing) || 0) : 12;
      const drawBorder = !!options.drawBorder;
      const borderColor = this.parseColor(options.borderColor || '#888888');
      const pageOrder = options.pageOrder || 'horizontal';

      // Determine grid dimensions (cols, rows)
      let cols = 2, rows = 1;
      let defaultLandscape = true;

      if (nUp === 2) {
        cols = 2; rows = 1; defaultLandscape = true;
      } else if (nUp === 4) {
        cols = 2; rows = 2; defaultLandscape = false;
      } else if (nUp === 6) {
        cols = 3; rows = 2; defaultLandscape = true;
      } else if (nUp === 9) {
        cols = 3; rows = 3; defaultLandscape = false;
      } else if (nUp === 16) {
        cols = 4; rows = 4; defaultLandscape = false;
      } else {
        cols = 2; rows = 1; defaultLandscape = true;
      }

      // Determine sheet dimensions
      let resolvedSize = PAGE_SIZES.A4;
      if (typeof options.sheetSize === 'string' && PAGE_SIZES[options.sheetSize.toUpperCase()]) {
        resolvedSize = PAGE_SIZES[options.sheetSize.toUpperCase()];
      } else if (Array.isArray(options.sheetSize) && options.sheetSize.length >= 2) {
        resolvedSize = options.sheetSize;
      }
      let [baseW, baseH] = resolvedSize;
      const orientation = options.orientation || (defaultLandscape ? 'landscape' : 'portrait');

      let sheetW = baseW;
      let sheetH = baseH;
      if (orientation === 'landscape') {
        if (sheetW < sheetH) [sheetW, sheetH] = [sheetH, sheetW];
      } else if (orientation === 'portrait') {
        if (sheetW > sheetH) [sheetW, sheetH] = [sheetH, sheetW];
      }

      // Filter source pages
      let indicesToEmbed = [];
      if (Array.isArray(options.pages) || options.pages instanceof Set) {
        const set = new Set(options.pages);
        for (let i = 0; i < totalSrc; i++) {
          if (set.has(i + 1)) indicesToEmbed.push(i);
        }
      } else {
        indicesToEmbed = srcDoc.getPageIndices();
      }

      if (indicesToEmbed.length === 0) {
        throw new Error('No pages selected for N-Up combination.');
      }

      // Ensure every page in indicesToEmbed has a valid Contents stream before embedding.
      // In PDF specifications, completely blank pages or pages with no drawing commands often omit /Contents.
      // PDF-Lib's embedPdf/embedPage requires /Contents to construct Form XObjects, throwing
      // "Can't embed page with missing Contents" if missing.
      for (const idx of indicesToEmbed) {
        try {
          const page = srcDoc.getPage(idx);
          const entries = page.node && typeof page.node.normalizedEntries === 'function' ? page.node.normalizedEntries() : null;
          if (!entries || !entries.Contents) {
            // Draw a zero-length invisible line to create a valid empty content stream on the page
            page.drawLine({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 0 });
          }
        } catch (_) {
          try {
            srcDoc.getPage(idx).drawLine({ start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, opacity: 0 });
          } catch (__) {}
        }
      }

      if (onProgress) onProgress(1, indicesToEmbed.length, 'Embedding source pages...');
      const embeddedPages = await targetDoc.embedPdf(srcDoc, indicesToEmbed);

      const usableW = sheetW - 2 * outerMargin - (cols - 1) * spacing;
      const usableH = sheetH - 2 * outerMargin - (rows - 1) * spacing;
      const cellW = usableW / cols;
      const cellH = usableH / rows;

      const totalSheets = Math.ceil(embeddedPages.length / nUp);

      for (let s = 0; s < totalSheets; s++) {
        if (onProgress) {
          onProgress(s + 1, totalSheets, `Assembling sheet ${s + 1} of ${totalSheets}...`);
        }

        const sheet = targetDoc.addPage([sheetW, sheetH]);
        const startIdx = s * nUp;
        const countOnSheet = Math.min(nUp, embeddedPages.length - startIdx);

        for (let k = 0; k < countOnSheet; k++) {
          const embedded = embeddedPages[startIdx + k];
          let c = 0, r = 0;

          if (pageOrder === 'vertical') {
            r = k % rows;
            c = Math.floor(k / rows);
          } else {
            // Horizontal (Z-order)
            c = k % cols;
            r = Math.floor(k / cols);
          }

          const cellLeft = outerMargin + c * (cellW + spacing);
          const cellTop = sheetH - outerMargin - r * (cellH + spacing);
          const cellBottom = cellTop - cellH;

          const origW = embedded.width;
          const origH = embedded.height;

          const scale = Math.min(cellW / origW, cellH / origH);
          const miniW = origW * scale;
          const miniH = origH * scale;

          const miniX = cellLeft + (cellW - miniW) / 2;
          const miniY = cellBottom + (cellH - miniH) / 2;

          sheet.drawPage(embedded, {
            x: miniX,
            y: miniY,
            xScale: scale,
            yScale: scale
          });

          if (drawBorder) {
            sheet.drawRectangle({
              x: miniX,
              y: miniY,
              width: miniW,
              height: miniH,
              borderColor,
              borderWidth: 0.5
            });
          }
        }
      }

      if (onProgress) onProgress(totalSheets, totalSheets, 'Saving N-Up PDF...');
      return await targetDoc.save();
    },

    /**
     * Split a PDF document into multiple documents.
     * @param {ArrayBuffer|Uint8Array} pdfBuffer Source PDF bytes
     * @param {Object} options
     *   - mode: 'all' | 'ranges' | 'fixed' | 'selected'
     *   - ranges: string or Array<string> e.g. '1-3, 4-5'
     *   - fixedCount: number (e.g. 2 for every 2 pages)
     *   - selectedPages: Array<number> | Set<number>
     *   - mergeSelected: boolean (default: false)
     *   - baseFilename: string (optional, defaults to 'document')
     * @param {Function} onProgress
     * @returns {Promise<Array<{ filename: string, bytes: Uint8Array, pageCount: number, label: string }>>}
     */
    async splitPdf(pdfBuffer, options = {}, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');

      const srcDoc = await window.PDFLib.PDFDocument.load(cloneBuffer(pdfBuffer), { ignoreEncryption: true });
      const totalPages = srcDoc.getPageCount();
      if (totalPages === 0) throw new Error('Source PDF has no pages.');

      const baseName = (options.baseFilename || 'document').replace(/\.pdf$/i, '');
      const mode = options.mode || 'all';

      // Define page groups: Array<{ label: string, pageIndices: Array<number> }> (0-based indices)
      const groups = [];

      if (mode === 'all') {
        for (let i = 0; i < totalPages; i++) {
          groups.push({
            label: `page_${i + 1}`,
            pageIndices: [i]
          });
        }
      } else if (mode === 'ranges') {
        const rangeStr = typeof options.ranges === 'string' ? options.ranges : (Array.isArray(options.ranges) ? options.ranges.join(',') : '');
        const rawGroups = this.parseSplitRanges(rangeStr, totalPages);
        if (rawGroups.length === 0) {
          throw new Error('Please enter valid page ranges (e.g. 1-3, 4-5).');
        }
        for (const rg of rawGroups) {
          groups.push({
            label: rg.label,
            pageIndices: rg.pages.map((p) => p - 1)
          });
        }
      } else if (mode === 'fixed') {
        const chunkSize = Math.max(1, parseInt(options.fixedCount, 10) || 1);
        let partNum = 1;
        for (let i = 0; i < totalPages; i += chunkSize) {
          const chunkIndices = [];
          for (let j = i; j < Math.min(i + chunkSize, totalPages); j++) {
            chunkIndices.push(j);
          }
          const startP = chunkIndices[0] + 1;
          const endP = chunkIndices[chunkIndices.length - 1] + 1;
          const label = startP === endP ? `page_${startP}` : `pages_${startP}-${endP}`;
          groups.push({
            label: `part_${partNum}_${label}`,
            pageIndices: chunkIndices
          });
          partNum++;
        }
      } else if (mode === 'selected') {
        const selectedSet = options.selectedPages instanceof Set ? options.selectedPages : new Set(options.selectedPages || []);
        const validPages = [];
        for (let i = 1; i <= totalPages; i++) {
          if (selectedSet.has(i)) validPages.push(i);
        }
        if (validPages.length === 0) {
          throw new Error('Please select at least one page to extract.');
        }

        if (options.mergeSelected) {
          groups.push({
            label: `extracted_${validPages.length}pages`,
            pageIndices: validPages.map((p) => p - 1)
          });
        } else {
          for (const p of validPages) {
            groups.push({
              label: `page_${p}`,
              pageIndices: [p - 1]
            });
          }
        }
      } else {
        throw new Error(`Unsupported split mode: ${mode}`);
      }

      if (groups.length === 0) {
        throw new Error('No valid split sections could be created.');
      }

      const results = [];
      const totalGroups = groups.length;

      for (let g = 0; g < totalGroups; g++) {
        const group = groups[g];
        if (onProgress) {
          onProgress(g + 1, totalGroups, `Generating split document ${g + 1} of ${totalGroups} (${group.label})...`);
        }

        const newDoc = await window.PDFLib.PDFDocument.create();
        const copied = await newDoc.copyPages(srcDoc, group.pageIndices);
        copied.forEach((p) => newDoc.addPage(p));
        const bytes = await newDoc.save();

        results.push({
          filename: `${baseName}_${group.label}.pdf`,
          bytes,
          pageCount: group.pageIndices.length,
          label: group.label
        });
      }

      return results;
    },

    /**
     * Parse page range string into discrete chunks e.g. "1-3, 4, 5-8"
     * @param {string} inputStr
     * @param {number} maxPages
     * @returns {Array<{ label: string, pages: Array<number> }>}
     */
    parseSplitRanges(inputStr, maxPages) {
      if (!inputStr || !inputStr.trim()) return [];
      const parts = inputStr.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
      const groups = [];
      for (const part of parts) {
        const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/);
        if (match) {
          const start = parseInt(match[1], 10);
          const end = match[2] ? parseInt(match[2], 10) : start;
          const lo = Math.max(1, Math.min(start, end));
          const hi = Math.min(maxPages, Math.max(start, end));
          const pages = [];
          for (let p = lo; p <= hi; p++) pages.push(p);
          if (pages.length > 0) {
            groups.push({
              label: lo === hi ? `page_${lo}` : `pages_${lo}-${hi}`,
              pages
            });
          }
        }
      }
      return groups;
    },

    /**
     * Splits an arbitrary sequence of pages (from single or multiple PDFs, with individual rotations) into multiple PDF documents.
     * @param {Array<{ filename?: string, label: string, pages: Array<{ buffer?: ArrayBuffer|Uint8Array, fileBuffer?: ArrayBuffer|Uint8Array, pageIndex?: number, pageNumber?: number, rotation?: number }> }>} groups
     * @param {Function} onProgress
     * @returns {Promise<Array<{ filename: string, bytes: Uint8Array, pageCount: number, label: string }>>}
     */
    async splitCustomPages(groups, onProgress = null) {
      if (!window.PDFLib) throw new Error('PDF-Lib is not loaded.');
      if (!groups || groups.length === 0) throw new Error('No split groups provided.');

      const docCache = new Map();
      async function getDoc(rawBuf) {
        if (!rawBuf) throw new Error('PDF buffer is null or undefined.');
        if (!docCache.has(rawBuf)) {
          const cloned = cloneBuffer(rawBuf);
          if (!cloned) throw new Error('Failed to copy PDF buffer.');
          const doc = await window.PDFLib.PDFDocument.load(cloned, { ignoreEncryption: true });
          docCache.set(rawBuf, doc);
        }
        return docCache.get(rawBuf);
      }

      const results = [];
      const totalGroups = groups.length;

      for (let g = 0; g < totalGroups; g++) {
        const group = groups[g];
        if (onProgress) {
          onProgress(g + 1, totalGroups, `Generating split part ${g + 1} of ${totalGroups} (${group.label})...`);
        }

        const newDoc = await window.PDFLib.PDFDocument.create();

        for (const pageItem of group.pages) {
          const buf = pageItem.buffer || pageItem.fileBuffer;
          if (!buf) {
            throw new Error(`Missing PDF buffer for page ${pageItem.pageNumber || ((pageItem.pageIndex || 0) + 1)}.`);
          }
          const srcDoc = await getDoc(buf);
          const pageIdx = typeof pageItem.pageIndex === 'number'
            ? pageItem.pageIndex
            : (pageItem.pageNumber ? pageItem.pageNumber - 1 : 0);

          if (pageIdx < 0 || pageIdx >= srcDoc.getPageCount()) {
            throw new Error(`Page index ${pageIdx} out of bounds (document has ${srcDoc.getPageCount()} pages).`);
          }

          const [copied] = await newDoc.copyPages(srcDoc, [pageIdx]);

          if (pageItem.rotation) {
            const currentAngle = copied.getRotation ? copied.getRotation().angle : 0;
            copied.setRotation(window.PDFLib.degrees((currentAngle + pageItem.rotation + 360) % 360));
          }

          newDoc.addPage(copied);
        }

        const bytes = await newDoc.save();
        results.push({
          filename: group.filename || `split_${group.label}.pdf`,
          bytes,
          pageCount: group.pages.length,
          label: group.label
        });
      }

      return results;
    }
  };

  window.PdfTools = PdfTools;
})();

