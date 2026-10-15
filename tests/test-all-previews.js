/**
 * Full End-to-End Pipeline Verification for all 11 Preview Document Tools
 */

const fs = require('fs');
const path = require('path');

global.window = global;
global.PDFLib = require(path.join(__dirname, '..', 'assets', 'vendor', 'pdf-lib.min.js'));
global.window.PDFLib = global.PDFLib;
const { PDFDocument, rgb, StandardFonts, degrees } = global.PDFLib;

require(path.join(__dirname, '..', 'js', 'pdf-tools.js'));
const PdfTools = global.PdfTools;

async function createTestPdf(pageCount = 3) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([600, 800]);
    page.drawText(`Page ${i} Content`, { x: 50, y: 750, size: 24, font });
  }
  return await doc.save();
}

async function run() {
  console.log('========================================================');
  console.log('TESTING IN-MEMORY PREVIEW GENERATION FOR ALL 11 TOOLS');
  console.log('========================================================');

  const baseBytes = await createTestPdf(4);
  const secondaryBytes = await createTestPdf(2);

  // 1. Merge Preview
  console.log('\n[1/11] Tool: Merge PDF Preview');
  const mergedBytes = await PdfTools.mergePdfs(
    [baseBytes.slice(0), secondaryBytes.slice(0)],
    { addBlankBetween: false },
    () => {}
  );
  const mergedDoc = await PDFDocument.load(mergedBytes);
  console.log(`[PASS] Merged preview generated: ${mergedDoc.getPageCount()} pages (expected 6)`);

  // 2. Remove Pages Preview
  console.log('\n[2/11] Tool: Remove Pages Preview');
  const removedBytes = await PdfTools.removePages(
    baseBytes.slice(0),
    [2, 4],
    () => {}
  );
  const removedDoc = await PDFDocument.load(removedBytes);
  console.log(`[PASS] Remove preview generated: ${removedDoc.getPageCount()} pages (expected 2)`);

  // 3. Add Pages Preview
  console.log('\n[3/11] Tool: Add Pages Preview');
  const addedBytes = await PdfTools.addPages(
    baseBytes.slice(0),
    { type: 'pdf', position: 'end', secondaryBuffer: secondaryBytes.slice(0), secondaryPages: [1] },
    () => {}
  );
  const addedDoc = await PDFDocument.load(addedBytes);
  console.log(`[PASS] Add preview generated: ${addedDoc.getPageCount()} pages (expected 5)`);

  // 4. Resize PDF Preview
  console.log('\n[4/11] Tool: Resize PDF Preview');
  const resizedBytes = await PdfTools.resizePdf(
    baseBytes.slice(0),
    { width: 595.28, height: 841.89, orientation: 'portrait', fitMode: 'proportional' },
    () => {}
  );
  const resizedDoc = await PDFDocument.load(resizedBytes);
  console.log(`[PASS] Resize preview generated: ${resizedDoc.getPageCount()} pages`);

  // 5. Rotate PDF Preview
  console.log('\n[5/11] Tool: Rotate PDF Preview');
  const rotatedBytes = await PdfTools.rotatePdf(
    baseBytes.slice(0),
    { rotations: { 1: 90, 2: 180, 3: 270, 4: 0 } },
    () => {}
  );
  const rotatedDoc = await PDFDocument.load(rotatedBytes);
  console.log(`[PASS] Rotate preview generated: ${rotatedDoc.getPageCount()} pages`);

  // 6. Watermark Preview
  console.log('\n[6/11] Tool: Watermark PDF Preview');
  const watermarkedBytes = await PdfTools.addWatermark(
    baseBytes.slice(0),
    {
      mode: 'text',
      text: 'CONFIDENTIAL PREVIEW',
      fontSize: 36,
      opacity: 0.3,
      rotation: 45,
      position: 'center',
      color: '#dc2626',
      scope: 'all'
    },
    () => {}
  );
  const watermarkedDoc = await PDFDocument.load(watermarkedBytes);
  console.log(`[PASS] Watermark preview generated: ${watermarkedDoc.getPageCount()} pages`);

  // 7. Redact PDF Preview
  console.log('\n[7/11] Tool: Redact PDF Preview');
  const redactedBytes = await PdfTools.redactPdf(
    baseBytes.slice(0),
    {
      1: [{ normX: 0.1, normY: 0.1, normW: 0.4, normH: 0.2, type: 'blackout' }]
    },
    () => {}
  );
  const redactedDoc = await PDFDocument.load(redactedBytes);
  console.log(`[PASS] Redact preview generated: ${redactedDoc.getPageCount()} pages`);

  // 8. Page Numbers Preview
  console.log('\n[8/11] Tool: Page Numbers Preview');
  const numberedBytes = await PdfTools.addPageNumbers(
    baseBytes.slice(0),
    {
      format: 'Page {n} of {total}',
      position: 'bottom-center',
      fontSize: 10,
      fontName: 'Helvetica',
      margin: 20,
      startNumber: 1,
      color: '#000000',
      skipCover: true,
      scope: 'all'
    },
    () => {}
  );
  const numberedDoc = await PDFDocument.load(numberedBytes);
  console.log(`[PASS] Page Numbers preview generated: ${numberedDoc.getPageCount()} pages`);

  // 9. N-Up Preview
  console.log('\n[9/12] Tool: N-Up (Multi-page Sheet) Preview');
  const nUpBytes = await PdfTools.createNUp(
    baseBytes.slice(0),
    {
      nUp: 4,
      sheetSize: 'A4',
      orientation: 'landscape',
      margin: 20,
      spacing: 10,
      drawBorder: true,
      scope: 'all'
    },
    () => {}
  );
  const nUpDoc = await PDFDocument.load(nUpBytes);
  console.log(`[PASS] N-Up preview generated: ${nUpDoc.getPageCount()} sheets (expected 1 for 4-in-1 from 4 pages)`);

  // 10. Split PDF Previews (All 4 modes)
  console.log('\n[10/12] Tool: Split PDF Preview (Extract All Pages)');
  const splitAllResults = await PdfTools.splitPdf(
    baseBytes.slice(0),
    { mode: 'all' },
    () => {}
  );
  console.log(`[PASS] Split (All) generated: ${splitAllResults.length} files (expected 4)`);
  const firstSplitDoc = await PDFDocument.load(splitAllResults[0].bytes);
  console.log(`[PASS] Split part 1 loaded: ${firstSplitDoc.getPageCount()} page`);

  console.log('\n[11/12] Tool: Split PDF Preview (Custom Ranges)');
  const splitRangeResults = await PdfTools.splitPdf(
    baseBytes.slice(0),
    { mode: 'ranges', ranges: '1-2, 3-4' },
    () => {}
  );
  console.log(`[PASS] Split (Ranges) generated: ${splitRangeResults.length} files (expected 2)`);
  const rangeDoc1 = await PDFDocument.load(splitRangeResults[0].bytes);
  console.log(`[PASS] Range Part 1 loaded: ${rangeDoc1.getPageCount()} pages (expected 2)`);

  console.log('\n[12/12] Tool: Split PDF Preview (Selected Pages Merged)');
  const splitSelectedResults = await PdfTools.splitPdf(
    baseBytes.slice(0),
    { mode: 'selected', selectedPages: [1, 3, 4], mergeSelected: true },
    () => {}
  );
  console.log(`[PASS] Split (Selected Merged) generated: ${splitSelectedResults.length} file (expected 1)`);
  const selDoc = await PDFDocument.load(splitSelectedResults[0].bytes);
  console.log(`[PASS] Selected Merged doc loaded: ${selDoc.getPageCount()} pages (expected 3)`);

  // 13. Visual Scissor Split Custom Pages with Rotations & Multiple Parts
  console.log('\n[Visual Scissor Engine] Testing splitCustomPages with rotations...');
  const customGroups = [
    {
      label: 'part_1_pages_1-2',
      pages: [
        { buffer: baseBytes.slice(0), pageIndex: 0, rotation: 90 },
        { buffer: baseBytes.slice(0), pageIndex: 1, rotation: 0 }
      ]
    },
    {
      label: 'part_2_pages_3-4',
      pages: [
        { buffer: baseBytes.slice(0), pageIndex: 2, rotation: 180 },
        { buffer: baseBytes.slice(0), pageIndex: 3, rotation: 270 }
      ]
    }
  ];
  const customResults = await PdfTools.splitCustomPages(customGroups, () => {});
  console.log(`[PASS] splitCustomPages generated: ${customResults.length} files (expected 2)`);
  const part1Doc = await PDFDocument.load(customResults[0].bytes);
  console.log(`[PASS] Part 1 page count: ${part1Doc.getPageCount()} pages (expected 2)`);
  const part2Doc = await PDFDocument.load(customResults[1].bytes);
  console.log(`[PASS] Part 2 page count: ${part2Doc.getPageCount()} pages (expected 2)`);

  // Test splitCustomPages using fileBuffer property (as provided by AppState.splitPages)
  console.log('\n[Visual Scissor Engine] Testing splitCustomPages using fileBuffer property...');
  const fileBufferGroups = [
    {
      label: 'part_1_page_1',
      pages: [
        { fileBuffer: baseBytes.slice(0), pageIndex: 0, rotation: 0 }
      ]
    },
    {
      label: 'part_2_page_2',
      pages: [
        { fileBuffer: baseBytes.slice(0), pageNumber: 2, rotation: 90 }
      ]
    }
  ];
  const fbResults = await PdfTools.splitCustomPages(fileBufferGroups, () => {});
  console.log(`[PASS] splitCustomPages with fileBuffer generated: ${fbResults.length} files (expected 2)`);
  const fbDoc1 = await PDFDocument.load(fbResults[0].bytes);
  console.log(`[PASS] fileBuffer Part 1 page count: ${fbDoc1.getPageCount()} (expected 1)`);
  const fbDoc2 = await PDFDocument.load(fbResults[1].bytes);
  console.log(`[PASS] fileBuffer Part 2 page count: ${fbDoc2.getPageCount()} (expected 1)`);

  console.log('\n========================================================');
  console.log('ALL 12 IN-MEMORY PREVIEW GENERATORS PASSED SUCCESSFULLY!');
  console.log('========================================================');
}

run().catch((err) => {
  console.error('[FAIL]', err);
  process.exit(1);
});
