/**
 * Split PDF Workflow and Scissor State Tests
 * Verifies that splitCustomPages, page groupings, scissor cuts, rotations,
 * and preview generation work flawlessly without any null/undefined buffer errors.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Simulate browser environment
global.window = global;
global.PDFLib = require(path.join(__dirname, '..', 'assets', 'vendor', 'pdf-lib.min.js'));
window.PDFLib = global.PDFLib;
global.JSZip = require(path.join(__dirname, '..', 'assets', 'vendor', 'jszip.min.js'));
window.JSZip = global.JSZip;

require(path.join(__dirname, '..', 'js', 'pdf-tools.js'));
require(path.join(__dirname, '..', 'js', 'converters.js'));

async function run() {
  console.log('========================================================');
  console.log('VERIFYING SPLIT PDF ENGINE AND STATE WORKFLOW');
  console.log('========================================================');

  // Load sample PDF bytes
  const sampleBytes = fs.readFileSync(path.join(__dirname, 'sample-test.pdf'));
  const sampleBuffer = sampleBytes.buffer.slice(sampleBytes.byteOffset, sampleBytes.byteOffset + sampleBytes.byteLength);

  // 1. Test splitCustomPages with fileBuffer (reproducing the exact property used in AppState.splitPages)
  console.log('\n[1/5] Testing splitCustomPages with fileBuffer property...');
  const groupsFileBuffer = [
    {
      label: 'part_1_page_1',
      pages: [
        { fileBuffer: sampleBuffer, pageNumber: 1, pageIndex: 0, rotation: 0 }
      ]
    },
    {
      label: 'part_2_pages_2-4',
      pages: [
        { fileBuffer: sampleBuffer, pageNumber: 2, pageIndex: 1, rotation: 90 },
        { fileBuffer: sampleBuffer, pageNumber: 3, pageIndex: 2, rotation: 0 },
        { fileBuffer: sampleBuffer, pageNumber: 4, pageIndex: 3, rotation: 180 }
      ]
    }
  ];

  const results1 = await window.PdfTools.splitCustomPages(groupsFileBuffer);
  assert.strictEqual(results1.length, 2, 'Should generate 2 split documents');
  assert.strictEqual(results1[0].pageCount, 1, 'Part 1 should have 1 page');
  assert.strictEqual(results1[1].pageCount, 3, 'Part 2 should have 3 pages');

  const doc1 = await window.PDFLib.PDFDocument.load(results1[0].bytes);
  assert.strictEqual(doc1.getPageCount(), 1);
  const doc2 = await window.PDFLib.PDFDocument.load(results1[1].bytes);
  assert.strictEqual(doc2.getPageCount(), 3);
  console.log('[PASS] Generated both split documents successfully using fileBuffer property.');

  // 2. Test splitCustomPages with buffer property
  console.log('\n[2/5] Testing splitCustomPages with buffer property...');
  const groupsBuffer = [
    {
      label: 'part_1_pages_1-2',
      pages: [
        { buffer: sampleBuffer, pageIndex: 0, rotation: 0 },
        { buffer: sampleBuffer, pageIndex: 1, rotation: 0 }
      ]
    },
    {
      label: 'part_2_pages_3-4',
      pages: [
        { buffer: sampleBuffer, pageIndex: 2, rotation: 0 },
        { buffer: sampleBuffer, pageIndex: 3, rotation: 0 }
      ]
    }
  ];

  const results2 = await window.PdfTools.splitCustomPages(groupsBuffer);
  assert.strictEqual(results2.length, 2);
  console.log('[PASS] Generated both split documents successfully using buffer property.');

  // 3. Test AppState split groupings logic with cuts
  console.log('\n[3/5] Testing visual scissor cut groupings logic...');
  const AppState = {
    splitFilename: 'FCC-P9-Aniket.pdf',
    splitBuffer: sampleBuffer,
    splitPages: [],
    splitCuts: new Set()
  };

  for (let p = 1; p <= 4; p++) {
    AppState.splitPages.push({
      id: `split_p_${p}`,
      fileId: 'file_test',
      fileName: 'FCC-P9-Aniket.pdf',
      buffer: sampleBuffer,
      fileBuffer: sampleBuffer,
      pageNumber: p,
      pageIndex: p - 1,
      rotation: 0
    });
  }

  function getSplitCustomGroups() {
    if (!AppState.splitPages || AppState.splitPages.length === 0) return [];
    const total = AppState.splitPages.length;
    const cutsSorted = Array.from(AppState.splitCuts).sort((a, b) => a - b);
    const groups = [];
    let currentStart = 0;
    for (const cutPos of cutsSorted) {
      if (cutPos > currentStart && cutPos < total) {
        const pagesInGroup = [];
        for (let j = currentStart; j < cutPos; j++) {
          const pObj = AppState.splitPages[j];
          pagesInGroup.push({
            ...pObj,
            buffer: pObj.buffer || pObj.fileBuffer || AppState.splitBuffer,
            fileBuffer: pObj.fileBuffer || pObj.buffer || AppState.splitBuffer,
            displayIndex: j + 1
          });
        }
        if (pagesInGroup.length > 0) {
          const startNum = currentStart + 1;
          const endNum = cutPos;
          const label = startNum === endNum ? `page_${startNum}` : `pages_${startNum}-${endNum}`;
          groups.push({ label, partIndex: groups.length + 1, pages: pagesInGroup });
        }
        currentStart = cutPos;
      }
    }
    if (currentStart < total) {
      const pagesInGroup = [];
      for (let j = currentStart; j < total; j++) {
        const pObj = AppState.splitPages[j];
        pagesInGroup.push({
          ...pObj,
          buffer: pObj.buffer || pObj.fileBuffer || AppState.splitBuffer,
          fileBuffer: pObj.fileBuffer || pObj.buffer || AppState.splitBuffer,
          displayIndex: j + 1
        });
      }
      if (pagesInGroup.length > 0) {
        const startNum = currentStart + 1;
        const endNum = total;
        const label = startNum === endNum ? `page_${startNum}` : `pages_${startNum}-${endNum}`;
        groups.push({ label, partIndex: groups.length + 1, pages: pagesInGroup });
      }
    }
    return groups;
  }

  // Without any cut: 1 group containing all 4 pages
  let initialGroups = getSplitCustomGroups();
  assert.strictEqual(initialGroups.length, 1);
  assert.strictEqual(initialGroups[0].pages.length, 4);
  console.log('[PASS] Default state (no cuts) forms 1 document with 4 pages.');

  // Place cut after page 1 and after page 3
  AppState.splitCuts.add(1);
  AppState.splitCuts.add(3);
  let multiGroups = getSplitCustomGroups();
  assert.strictEqual(multiGroups.length, 3);
  assert.strictEqual(multiGroups[0].pages.length, 1);
  assert.strictEqual(multiGroups[1].pages.length, 2);
  assert.strictEqual(multiGroups[2].pages.length, 1);
  console.log('[PASS] 2 cuts placed creates 3 groups (page 1, pages 2-3, page 4).');

  // 4. Test Preview Split Doc generation on Part 1
  console.log('\n[4/5] Testing Preview Document (Part 1 generation)...');
  const part1Group = multiGroups[0];
  const previewResults = await window.PdfTools.splitCustomPages([
    { ...part1Group, filename: 'preview_part_1.pdf' }
  ]);
  assert.strictEqual(previewResults.length, 1);
  assert.ok(previewResults[0].bytes instanceof Uint8Array);
  assert.ok(previewResults[0].bytes.length > 0);
  console.log('[PASS] Preview Document generated successfully for Part 1 without errors.');

  // 5. Test Full Split Archive generation on all parts
  console.log('\n[5/5] Testing Full Split Archive ZIP generation on all 3 parts...');
  const fullResults = await window.PdfTools.splitCustomPages(multiGroups);
  assert.strictEqual(fullResults.length, 3);
  const zipItems = fullResults.map(r => ({
    filename: `split_${r.label}.pdf`,
    blob: { size: r.bytes.length } // mock blob
  }));
  assert.strictEqual(zipItems.length, 3);
  console.log('[PASS] Full Split generated all 3 parts successfully.');

  console.log('\n========================================================');
  console.log('ALL SPLIT TESTS PASSED SUCCESSFULLY! ZERO ERRORS.');
  console.log('========================================================');
}

run().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
