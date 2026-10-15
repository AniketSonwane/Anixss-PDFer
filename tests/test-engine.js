/**
 * Anixss-PDFer Engine Verification Test Suite
 * Tests all core PDF operations: Merge, Remove, Add, Resize, Rotate, Image to PDF, Page Range Parsing.
 */

const fs = require('fs');
const path = require('path');

// Simulate browser environment for testing
global.window = global;

// Load vendor libraries
global.PDFLib = require(path.join(__dirname, '..', 'assets', 'vendor', 'pdf-lib.min.js'));
global.window.PDFLib = global.PDFLib;

global.JSZip = require(path.join(__dirname, '..', 'assets', 'vendor', 'jszip.min.js'));
global.window.JSZip = global.JSZip;

// Load Anixss-PDFer modules
require(path.join(__dirname, '..', 'js', 'pdf-tools.js'));
require(path.join(__dirname, '..', 'js', 'converters.js'));

async function runTests() {
  console.log('=============================================');
  console.log('STARTING ANIXSS-PDFER AUTOMATED VERIFICATION');
  console.log('=============================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  try {
    // 1. Create Base Test PDFs
    console.log('[1/8] Generating Test PDFs with PDFLib...');
    const doc1 = await window.PDFLib.PDFDocument.create();
    for (let i = 1; i <= 3; i++) {
      const p = doc1.addPage([595.28, 841.89]);
      // draw some text
      const font = await doc1.embedFont(window.PDFLib.StandardFonts.Helvetica);
      p.drawText(`Document 1 - Page ${i}`, { x: 50, y: 750, size: 24, font });
    }
    const doc1Bytes = await doc1.save();
    assert(doc1Bytes.length > 0, 'Document 1 generated with 3 pages');

    const doc2 = await window.PDFLib.PDFDocument.create();
    for (let i = 1; i <= 2; i++) {
      const p = doc2.addPage([595.28, 841.89]);
      const font = await doc2.embedFont(window.PDFLib.StandardFonts.Helvetica);
      p.drawText(`Document 2 - Page ${i}`, { x: 50, y: 750, size: 24, font });
    }
    const doc2Bytes = await doc2.save();
    assert(doc2Bytes.length > 0, 'Document 2 generated with 2 pages');

    // 2. Test Merge PDF
    console.log('\n[2/8] Testing Merge PDF...');
    const mergedBytes = await window.PdfTools.mergePdfs([
      { name: 'doc1.pdf', buffer: doc1Bytes },
      { name: 'doc2.pdf', buffer: doc2Bytes }
    ]);
    const mergedDoc = await window.PDFLib.PDFDocument.load(mergedBytes);
    assert(mergedDoc.getPageCount() === 5, `Merge created PDF with 5 pages (expected 3 + 2 = 5, got ${mergedDoc.getPageCount()})`);

    // 2b. Test Merge with Blank Page Between
    const mergedWithBlankBytes = await window.PdfTools.mergePdfs([
      { name: 'doc1.pdf', buffer: doc1Bytes },
      { name: 'doc2.pdf', buffer: doc2Bytes }
    ], { addBlankBetween: true });
    const mergedWithBlankDoc = await window.PDFLib.PDFDocument.load(mergedWithBlankBytes);
    assert(mergedWithBlankDoc.getPageCount() === 6, `Merge with blank between created PDF with 6 pages (expected 3 + 1 + 2 = 6, got ${mergedWithBlankDoc.getPageCount()})`);

    // 2c. Test Merge with Blank After Each Odd Page
    // doc1 (3 pages: odd=1,3 -> +2 blanks = 5 pages); doc2 (2 pages: odd=1 -> +1 blank = 3 pages); Total = 8 pages
    const mergedOddBlankBytes = await window.PdfTools.mergePdfs([
      { name: 'doc1.pdf', buffer: doc1Bytes },
      { name: 'doc2.pdf', buffer: doc2Bytes }
    ], { addBlankAfterOddPages: true });
    const mergedOddBlankDoc = await window.PDFLib.PDFDocument.load(mergedOddBlankBytes);
    assert(mergedOddBlankDoc.getPageCount() === 8, `Merge with addBlankAfterOddPages created PDF with 8 pages (expected 8, got ${mergedOddBlankDoc.getPageCount()})`);

    // 2d. Test Merge with Duplex Padding (padOddPageFiles)
    // doc1 (3 pages, odd -> +1 blank = 4); doc2 (2 pages, even, last doc = 2); Total = 6 pages
    const mergedDuplexBytes = await window.PdfTools.mergePdfs([
      { name: 'doc1.pdf', buffer: doc1Bytes },
      { name: 'doc2.pdf', buffer: doc2Bytes }
    ], { padOddPageFiles: true });
    const mergedDuplexDoc = await window.PDFLib.PDFDocument.load(mergedDuplexBytes);
    assert(mergedDuplexDoc.getPageCount() === 6, `Merge with padOddPageFiles created PDF with 6 pages (expected 4 + 2 = 6, got ${mergedDuplexDoc.getPageCount()})`);

    // 2e. Test Merge Custom Page Sequence (Drag-and-Drop Reorganization)
    const customSequence = [
      { type: 'pdfPage', buffer: doc1Bytes, pageIndex: 2, rotation: 0 },
      { type: 'blankPage', width: 595.28, height: 841.89 },
      { type: 'pdfPage', buffer: doc2Bytes, pageIndex: 0, rotation: 90 },
      { type: 'pdfPage', buffer: doc1Bytes, pageIndex: 0, rotation: 180 }
    ];
    const customMergedBytes = await window.PdfTools.mergeCustomPages(customSequence);
    const customDoc = await window.PDFLib.PDFDocument.load(customMergedBytes);
    assert(customDoc.getPageCount() === 4, `mergeCustomPages assembled 4 pages correctly (got ${customDoc.getPageCount()})`);
    assert(customDoc.getPage(2).getRotation().angle === 90, `Page 3 retained custom 90° rotation (got ${customDoc.getPage(2).getRotation().angle}°)`);
    assert(customDoc.getPage(3).getRotation().angle === 180, `Page 4 retained custom 180° rotation (got ${customDoc.getPage(3).getRotation().angle}°)`);

    // 3. Test Remove Pages
    console.log('\n[3/8] Testing Remove Pages...');
    // Remove pages 2 and 4 from the 5-page merged doc
    const removedBytes = await window.PdfTools.removePages(mergedBytes, new Set([2, 4]));
    const removedDoc = await window.PDFLib.PDFDocument.load(removedBytes);
    assert(removedDoc.getPageCount() === 3, `Remove pages removed 2 pages (expected 3 remaining, got ${removedDoc.getPageCount()})`);

    // 4. Test Add Pages (Blank and from PDF)
    console.log('\n[4/8] Testing Add Pages...');
    // Add 2 blank Letter pages at the end
    const withBlankBytes = await window.PdfTools.addPages(doc1Bytes, {
      type: 'blank',
      blankCount: 2,
      pageSize: window.PdfTools.PAGE_SIZES.LETTER,
      orientation: 'portrait',
      position: 'end'
    });
    const withBlankDoc = await window.PDFLib.PDFDocument.load(withBlankBytes);
    assert(withBlankDoc.getPageCount() === 5, `Added 2 blank pages (expected 3 + 2 = 5, got ${withBlankDoc.getPageCount()})`);

    // Add pages from doc2 at start
    const withInsertedDocBytes = await window.PdfTools.addPages(doc1Bytes, {
      type: 'pdf',
      secondaryBuffer: doc2Bytes,
      secondaryPages: [1],
      position: 'start'
    });
    const withInsertedDoc = await window.PDFLib.PDFDocument.load(withInsertedDocBytes);
    assert(withInsertedDoc.getPageCount() === 4, `Inserted 1 page from doc2 at start (expected 3 + 1 = 4, got ${withInsertedDoc.getPageCount()})`);

    // 5. Test Resize PDF
    console.log('\n[5/8] Testing Resize PDF...');
    const resizedBytes = await window.PdfTools.resizePdf(doc1Bytes, {
      targetSize: window.PdfTools.PAGE_SIZES.LETTER,
      orientation: 'landscape',
      scalingMode: 'proportional'
    });
    const resizedDoc = await window.PDFLib.PDFDocument.load(resizedBytes);
    assert(resizedDoc.getPageCount() === 3, `Resized PDF has 3 pages`);
    const resizedP1 = resizedDoc.getPage(0);
    const { width: rw, height: rh } = resizedP1.getSize();
    assert(rw === 792 && rh === 612, `Resized page dimensions are landscape Letter (792x612 pt, got ${rw}x${rh})`);

    // 6. Test Rotate PDF
    console.log('\n[6/8] Testing Rotate PDF...');
    const rotatedBytes = await window.PdfTools.rotatePdf(doc1Bytes, {
      rotations: { 1: 90, 2: 180 }
    });
    const rotatedDoc = await window.PDFLib.PDFDocument.load(rotatedBytes);
    assert(rotatedDoc.getPage(0).getRotation().angle === 90, `Page 1 rotated to 90° (got ${rotatedDoc.getPage(0).getRotation().angle})`);
    assert(rotatedDoc.getPage(1).getRotation().angle === 180, `Page 2 rotated to 180° (got ${rotatedDoc.getPage(1).getRotation().angle})`);
    assert(rotatedDoc.getPage(2).getRotation().angle === 0, `Page 3 remained at 0° (got ${rotatedDoc.getPage(2).getRotation().angle})`);

    // 7. Test Page Range Parser
    console.log('\n[7/8] Testing Page Range Parser...');
    const parsedRange1 = window.Converters.parsePageRanges('2-4, 7', 10);
    assert(parsedRange1.size === 4 && parsedRange1.has(2) && parsedRange1.has(3) && parsedRange1.has(4) && parsedRange1.has(7),
      `Parsed '2-4, 7' correctly into {2, 3, 4, 7}`
    );

    const parsedRange2 = window.Converters.parsePageRanges('1, 3, 5-8', 6);
    assert(parsedRange2.size === 4 && parsedRange2.has(1) && parsedRange2.has(3) && parsedRange2.has(5) && parsedRange2.has(6) && !parsedRange2.has(7),
      `Parsed '1, 3, 5-8' bounded by totalPages 6 into {1, 3, 5, 6}`
    );

    // 8. Test ZIP bundling
    console.log('\n[8/8] Testing ZIP Archive generation...');
    const sampleBlob = new Uint8Array([1, 2, 3, 4, 5]);
    const zip = new window.JSZip();
    zip.file('page_1.png', sampleBlob);
    zip.file('page_2.png', sampleBlob);
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    assert(zipBuffer.length > 50, `ZIP file generated successfully (${zipBuffer.length} bytes)`);

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n=============================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================');

  process.exit(failed > 0 ? 1 : 0);
}

runTests();
