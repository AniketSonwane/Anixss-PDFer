/**
 * Anixss-PDFer - Unit Tests for New Tools:
 * Watermark, Redact (Hide Content), Page Numbers, and N-Up (Multiple pages into 1 page).
 */

const fs = require('fs');
const path = require('path');

global.window = global;
global.PDFLib = require(path.join(__dirname, '..', 'assets', 'vendor', 'pdf-lib.min.js'));
global.window.PDFLib = global.PDFLib;

require(path.join(__dirname, '..', 'js', 'pdf-tools.js'));
require(path.join(__dirname, '..', 'js', 'converters.js'));

async function runNewToolTests() {
  console.log('=============================================');
  console.log('TESTING 4 NEW PDF TOOLS');
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

  // 1. Generate a 4-page test PDF
  const testDoc = await window.PDFLib.PDFDocument.create();
  const font = await testDoc.embedFont(window.PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= 4; i++) {
    const page = testDoc.addPage([595.28, 841.89]);
    page.drawText(`Original Page ${i} Content`, { x: 50, y: 750, size: 20, font });
  }
  const basePdfBytes = await testDoc.save();
  assert(basePdfBytes.length > 0, 'Generated 4-page base test PDF');

  // 2. Test Watermark Tool
  console.log('\n[1/4] Testing Watermark Tool (addWatermark)...');
  const watermarkedBytes = await window.PdfTools.addWatermark(basePdfBytes, {
    type: 'text',
    text: 'CONFIDENTIAL',
    fontSize: 50,
    color: '#ff0000',
    opacity: 0.3,
    rotation: 45,
    position: 'center',
    pages: 'all'
  });
  const docWatermarked = await window.PDFLib.PDFDocument.load(watermarkedBytes);
  assert(docWatermarked.getPageCount() === 4, 'Watermarked PDF retained 4 pages');

  // Test tiled watermark
  const tiledBytes = await window.PdfTools.addWatermark(basePdfBytes, {
    type: 'text',
    text: 'SAMPLE',
    position: 'tile',
    pages: 'odd'
  });
  const docTiled = await window.PDFLib.PDFDocument.load(tiledBytes);
  assert(docTiled.getPageCount() === 4, 'Tiled watermark PDF saved cleanly');

  // 3. Test Redaction / Hide Content Tool
  console.log('\n[2/4] Testing Hide Content / Redaction Tool (redactPdf)...');
  const redactedBytes = await window.PdfTools.redactPdf(basePdfBytes, [
    { page: 1, normX: 0.1, normY: 0.1, normW: 0.8, normH: 0.1, type: 'blackout' },
    { page: 2, normX: 0.2, normY: 0.5, normW: 0.5, normH: 0.05, type: 'whiteout' }
  ]);
  const docRedacted = await window.PDFLib.PDFDocument.load(redactedBytes);
  assert(docRedacted.getPageCount() === 4, 'Redacted PDF has 4 pages');

  // 4. Test Page Numbers Tool
  console.log('\n[3/4] Testing Page Numbers Tool (addPageNumbers)...');
  const numberedBytes = await window.PdfTools.addPageNumbers(basePdfBytes, {
    format: 'Page {n} of {total}',
    position: 'bottom-center',
    startNumber: 1,
    skipCover: true,
    fontSize: 10,
    color: '#000000'
  });
  const docNumbered = await window.PDFLib.PDFDocument.load(numberedBytes);
  assert(docNumbered.getPageCount() === 4, 'Numbered PDF has 4 pages with cover skip');

  // 5. Test N-Up Tool (Multiple pages per sheet)
  console.log('\n[4/4] Testing N-Up Tool (createNUp)...');
  
  // 2-in-1: 4 pages -> 2 sheets
  const nUp2Bytes = await window.PdfTools.createNUp(basePdfBytes, {
    nUp: 2,
    orientation: 'landscape',
    drawBorder: true
  });
  const docNUp2 = await window.PDFLib.PDFDocument.load(nUp2Bytes);
  assert(docNUp2.getPageCount() === 2, `2-in-1 N-Up generated 2 sheets from 4 pages (got ${docNUp2.getPageCount()})`);

  // 4-in-1: 4 pages -> 1 sheet
  const nUp4Bytes = await window.PdfTools.createNUp(basePdfBytes, {
    nUp: 4,
    orientation: 'portrait',
    drawBorder: true
  });
  const docNUp4 = await window.PDFLib.PDFDocument.load(nUp4Bytes);
  assert(docNUp4.getPageCount() === 1, `4-in-1 N-Up generated 1 sheet from 4 pages (got ${docNUp4.getPageCount()})`);

  console.log('\n=============================================');
  console.log(`NEW TOOLS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================');

  if (failed > 0) process.exit(1);
}

runNewToolTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
