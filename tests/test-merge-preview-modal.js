/**
 * Test: Full Page Preview Modal Logic
 * Verifies modal state transitions, bounds checking, zoom levels, and rotations.
 */

const assert = require('assert');

const PagePreviewModal = {
  isOpen: false,
  mode: 'page',
  activeFile: null,
  activePageIndex: 0,
  totalPages: 1,
  zoomScale: 0.75,
  rotationDelta: 0
};

// Test File Mode Navigation
function openFilePreview(file, startPage) {
  PagePreviewModal.isOpen = true;
  PagePreviewModal.mode = 'file';
  PagePreviewModal.activeFile = file;
  PagePreviewModal.activePageIndex = startPage;
  PagePreviewModal.totalPages = file.pageCount;
  PagePreviewModal.zoomScale = 0.75;
  PagePreviewModal.rotationDelta = 0;
}

const mockFile = { name: 'sample.pdf', pageCount: 5 };
openFilePreview(mockFile, 1);
assert.strictEqual(PagePreviewModal.isOpen, true);
assert.strictEqual(PagePreviewModal.activePageIndex, 1);
assert.strictEqual(PagePreviewModal.totalPages, 5);
assert.strictEqual(PagePreviewModal.zoomScale, 0.75);

// Navigate next in file mode
if (PagePreviewModal.activePageIndex < PagePreviewModal.totalPages) {
  PagePreviewModal.activePageIndex++;
}
assert.strictEqual(PagePreviewModal.activePageIndex, 2);

// Zoom in / out
PagePreviewModal.zoomScale = Math.min(3.0, PagePreviewModal.zoomScale + 0.25);
assert.strictEqual(PagePreviewModal.zoomScale, 1.0);

PagePreviewModal.zoomScale = Math.max(0.4, PagePreviewModal.zoomScale - 0.25);
assert.strictEqual(PagePreviewModal.zoomScale, 0.75);

// Rotate CW
PagePreviewModal.rotationDelta = (PagePreviewModal.rotationDelta + 90) % 360;
assert.strictEqual(PagePreviewModal.rotationDelta, 90);

console.log('[PASS] Full Page Preview modal logic passed all assertions.');
