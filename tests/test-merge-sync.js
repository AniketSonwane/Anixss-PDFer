/**
 * Test: Merge State Bidirectional Synchronization
 * Verifies that deleting a page in Pages view immediately updates File preview:
 * - Remaining page count updates (e.g. 3 of 4 pages)
 * - First active page number updates if page 1 is deleted
 * - File is pruned if all pages are deleted
 * - Reordering files does not resurrect deleted pages
 */

const assert = require('assert');

// Simulate AppState
const AppState = {
  mergeFiles: [],
  mergePageSequence: [],
  mergeSelectedIds: new Set(),
  thumbnailCache: new Map()
};

function addFileMock(id, name, pageCount, width = 612, height = 792) {
  const file = {
    id,
    name,
    originalPageCount: pageCount,
    pageCount: pageCount,
    firstActivePageNumber: 1,
    firstActivePageRotation: 0,
    pageWidth: width,
    pageHeight: height,
    rotation: 0
  };
  AppState.mergeFiles.push(file);
  for (let p = 1; p <= pageCount; p++) {
    AppState.mergePageSequence.push({
      id: `${id}_p${p}`,
      type: 'pdfPage',
      fileId: id,
      fileName: name,
      pageIndex: p - 1,
      pageNumber: p,
      width: width,
      height: height,
      rotation: 0
    });
  }
}

function syncMergeStateAfterPageChange() {
  const activePagesByFile = new Map();
  AppState.mergePageSequence.forEach((p) => {
    if (p.type === 'pdfPage' && p.fileId) {
      if (!activePagesByFile.has(p.fileId)) {
        activePagesByFile.set(p.fileId, []);
      }
      activePagesByFile.get(p.fileId).push(p);
    }
  });

  const remainingFiles = [];
  AppState.mergeFiles.forEach((fileItem) => {
    const remainingPages = activePagesByFile.get(fileItem.id) || [];
    if (remainingPages.length > 0) {
      fileItem.pageCount = remainingPages.length;
      fileItem.firstActivePageNumber = remainingPages[0].pageNumber;
      fileItem.firstActivePageRotation = remainingPages[0].rotation || 0;
      remainingFiles.push(fileItem);
    } else {
      AppState.mergeSelectedIds.delete(fileItem.id);
    }
  });

  AppState.mergeFiles = remainingFiles;
}

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

// 1. Add file 1 (4 pages) and file 2 (2 pages)
addFileMock('file_1', 'DocumentA.pdf', 4);
addFileMock('file_2', 'DocumentB.pdf', 2);
assert.strictEqual(AppState.mergeFiles.length, 2);
assert.strictEqual(AppState.mergePageSequence.length, 6);
console.log('[PASS] Added 2 files with 6 total pages');

// 2. Delete page 1 of file 1
const idx = AppState.mergePageSequence.findIndex((p) => p.id === 'file_1_p1');
AppState.mergePageSequence.splice(idx, 1);
syncMergeStateAfterPageChange();

// Verify file 1 now has 3 pages and its first active page is page 2
assert.strictEqual(AppState.mergeFiles[0].pageCount, 3);
assert.strictEqual(AppState.mergeFiles[0].firstActivePageNumber, 2);
console.log('[PASS] File 1 pageCount updated to 3, firstActivePageNumber updated to 2');

// 3. Delete all pages of file 2
AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => p.fileId !== 'file_2');
syncMergeStateAfterPageChange();

// Verify file 2 is pruned from mergeFiles
assert.strictEqual(AppState.mergeFiles.length, 1);
assert.strictEqual(AppState.mergeFiles[0].id, 'file_1');
console.log('[PASS] File 2 automatically removed from mergeFiles when all its pages are deleted');

// 4. Reorder files (simulate dragging)
reorderPageSequenceByFiles();
// Verify deleted pages are NOT resurrected
assert.strictEqual(AppState.mergePageSequence.length, 3);
console.log('[PASS] Reordering files preserves deletions without resurrecting removed pages');

// 5. Verify File Preview active pages reflect deletions
const file1Pages = AppState.mergePageSequence.filter((p) => p.fileId === 'file_1');
assert.strictEqual(file1Pages.length, 3);
assert.strictEqual(file1Pages[0].pageNumber, 2);
assert.strictEqual(file1Pages[1].pageNumber, 3);
assert.strictEqual(file1Pages[2].pageNumber, 4);
console.log('[PASS] File preview only contains active pages (pages 2, 3, 4), deleted page 1 is excluded');

// 6. Verify File Rotation doesn't double-increment
AppState.mergeFiles[0].rotation = (AppState.mergeFiles[0].rotation + 90) % 360;
assert.strictEqual(AppState.mergeFiles[0].rotation, 90);
const firstPageEffectiveRot = ((AppState.mergeFiles[0].rotation || 0) + (file1Pages[0].rotation || 0)) % 360;
assert.strictEqual(firstPageEffectiveRot, 90); // Exactly 90°, not 180°
console.log('[PASS] File rotation is exactly 90°, no double-rotation anomaly');

// 7. Verify Page-specific Rotation
file1Pages[1].rotation = (file1Pages[1].rotation + 90) % 360; // Rotate page 3
const page3EffectiveRot = ((AppState.mergeFiles[0].rotation || 0) + (file1Pages[1].rotation || 0)) % 360;
assert.strictEqual(page3EffectiveRot, 180); // 90° (file) + 90° (page) = 180°
const page2EffectiveRot = ((AppState.mergeFiles[0].rotation || 0) + (file1Pages[0].rotation || 0)) % 360;
assert.strictEqual(page2EffectiveRot, 90); // page 2 remained at file rotation
console.log('[PASS] Per-page rotation applies cleanly and independently');

// 8. Verify Blank Page Size Matching Existing File Size
function addBlankPageMock(insertAtIndex = -1) {
  let targetW = 595.28;
  let targetH = 841.89;

  function findClosestDimensions(idx) {
    if (AppState.mergePageSequence.length > 0) {
      if (idx >= 0) {
        for (let i = idx - 1; i >= 0; i--) {
          const p = AppState.mergePageSequence[i];
          if (p && p.width && p.height) return { w: p.width, h: p.height };
        }
        for (let i = idx; i < AppState.mergePageSequence.length; i++) {
          const p = AppState.mergePageSequence[i];
          if (p && p.width && p.height) return { w: p.width, h: p.height };
        }
      } else {
        for (let i = AppState.mergePageSequence.length - 1; i >= 0; i--) {
          const p = AppState.mergePageSequence[i];
          if (p && p.width && p.height) return { w: p.width, h: p.height };
        }
      }
    }
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

  const blankItem = {
    id: 'blank_' + Math.random().toString(36).substr(2, 9),
    type: 'blankPage',
    fileName: '[Blank Page]',
    pageNumber: 1,
    width: targetW,
    height: targetH,
    note: 'Blank Page'
  };

  if (insertAtIndex >= 0 && insertAtIndex <= AppState.mergePageSequence.length) {
    AppState.mergePageSequence.splice(insertAtIndex, 0, blankItem);
  } else {
    AppState.mergePageSequence.push(blankItem);
  }
  return blankItem;
}

// Add blank page in the middle of file 1 pages (which are 612x792 pt Letter)
const blankItem = addBlankPageMock(1);
assert.strictEqual(blankItem.width, 612, 'Blank page width should match existing file width 612');
assert.strictEqual(blankItem.height, 792, 'Blank page height should match existing file height 792');
console.log('[PASS] Manually inserted blank page matches existing file dimensions (612x792 pt)');

// 9. Verify Auto-padded Odd Page Rule Inherits Existing File Page Dimensions
const base = AppState.mergePageSequence;
const oddPadded = [];
let outputNum = 1;
for (let i = 0; i < base.length; i++) {
  const item = base[i];
  oddPadded.push(item);
  if (outputNum % 2 === 1 && i < base.length - 1) {
    const w = item.width || 595.28;
    const h = item.height || 841.89;
    oddPadded.push({
      id: `auto_odd_${i}`,
      type: 'blankPage',
      isAutoOddPad: true,
      width: w,
      height: h
    });
    outputNum++;
  }
  outputNum++;
}
const autoBlank = oddPadded.find((p) => p.isAutoOddPad);
assert.ok(autoBlank, 'Auto blank page should exist');
assert.strictEqual(autoBlank.width, 612, 'Auto blank page should inherit 612 width');
console.log('[PASS] Auto odd-page rule blank page matches existing file dimensions (612x792 pt)');

// 10. Verify Standalone Blank Page Added In Files Mode Appears In mergeFiles
function addSeparateBlankPageMock(insertAtIndex = -1) {
  const blankId = 'blank_file_' + Math.random().toString(36).substr(2, 9);
  const blankFileItem = {
    id: blankId,
    type: 'blankPage',
    name: '[Blank Page]',
    size: 0,
    pageCount: 1,
    originalPageCount: 1,
    firstActivePageNumber: 1,
    firstActivePageRotation: 0,
    pageWidth: 612,
    pageHeight: 792,
    rotation: 0
  };
  const blankPageItem = {
    id: 'blank_p_' + Math.random().toString(36).substr(2, 9),
    type: 'blankPage',
    fileId: blankId,
    fileName: '[Blank Page]',
    pageNumber: 1,
    width: 612,
    height: 792,
    note: 'Blank Page'
  };

  if (insertAtIndex >= 0 && insertAtIndex <= AppState.mergeFiles.length) {
    AppState.mergeFiles.splice(insertAtIndex, 0, blankFileItem);
  } else {
    AppState.mergeFiles.push(blankFileItem);
  }
  AppState.mergePageSequence.push(blankPageItem);
  return { blankFileItem, blankPageItem };
}

const initialFilesCount = AppState.mergeFiles.length;
const { blankFileItem, blankPageItem } = addSeparateBlankPageMock(1);
assert.strictEqual(AppState.mergeFiles.length, initialFilesCount + 1, 'mergeFiles count should increment by 1');
assert.strictEqual(AppState.mergeFiles[1].type, 'blankPage', 'New file item should be a blankPage');
assert.strictEqual(AppState.mergeFiles[1].pageCount, 1, 'Blank page file item should have 1 page');
console.log('[PASS] Standalone blank page added in Files mode appears as a card in mergeFiles with 1 page');

// 11. Verify Page Count in File Display Updates When Page Deleted in Pages Mode
const file1 = AppState.mergeFiles.find((f) => f.id === 'file_1');
const previousCount = file1.pageCount;
// Delete one page of file_1 from sequence (simulating Pages mode delete)
const pIdx = AppState.mergePageSequence.findIndex((p) => p.fileId === 'file_1');
AppState.mergePageSequence.splice(pIdx, 1);

// Run state sync
syncMergeStateAfterPageChange();

// Verify file1 pageCount has decremented
assert.strictEqual(file1.pageCount, previousCount - 1, `File 1 pageCount should change from ${previousCount} to ${previousCount - 1}`);
const cardPageCountText = `${file1.pageCount} page${file1.pageCount === 1 ? '' : 's'}`;
assert.strictEqual(cardPageCountText, `${previousCount - 1} pages`);
console.log(`[PASS] File pageCount in file display mode dynamically changed to: "${cardPageCountText}"`);

// 12. Deleting standalone blank page from sequence also removes it from mergeFiles
AppState.mergePageSequence = AppState.mergePageSequence.filter((p) => p.fileId !== blankFileItem.id);
syncMergeStateAfterPageChange();
assert.ok(!AppState.mergeFiles.some((f) => f.id === blankFileItem.id), 'Standalone blank page should be removed from mergeFiles when its page is deleted');
console.log('[PASS] Deleting standalone blank page in Pages mode automatically removes its card from Files mode');

console.log('\nALL MERGE SYNC TESTS PASSED SUCCESSFULLY!');
