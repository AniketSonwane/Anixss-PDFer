/**
 * Verification of DOM IDs and Elements between HTML pages and app.js
 */

const fs = require('fs');
const path = require('path');

function checkFileElements(filePath, expectedIds) {
  const content = fs.readFileSync(filePath, 'utf8');
  const missing = [];
  expectedIds.forEach((id) => {
    if (!content.includes(`id="${id}"`) && !content.includes(`data-tool="${id}"`) && !content.includes(`id='${id}'`)) {
      missing.push(id);
    }
  });
  return missing;
}

const allToolsPreviewConfig = [
  { file: 'merge.html', previewBtn: 'btnPreviewMergedDoc', finishBtn: 'btnProcessMerge' },
  { file: 'remove-pages.html', previewBtn: 'btnPreviewRemoveDoc', finishBtn: 'btnProcessRemove' },
  { file: 'add-pages.html', previewBtn: 'btnPreviewAddDoc', finishBtn: 'btnProcessAdd' },
  { file: 'resize.html', previewBtn: 'btnPreviewResizeDoc', finishBtn: 'btnProcessResize' },
  { file: 'rotate.html', previewBtn: 'btnPreviewRotateDoc', finishBtn: 'btnProcessRotate' },
  { file: 'image-to-pdf.html', previewBtn: 'btnPreviewImg2PdfDoc', finishBtn: 'btnProcessImg2Pdf' },
  { file: 'pdf-to-image.html', previewBtn: 'btnPreviewPdf2ImgDoc', finishBtn: 'btnProcessPdf2Img' },
  { file: 'watermark.html', previewBtn: 'btnPreviewWatermarkDoc', finishBtn: 'btnProcessWatermark' },
  { file: 'redact.html', previewBtn: 'btnPreviewRedactDoc', finishBtn: 'btnProcessRedact' },
  { file: 'page-numbers.html', previewBtn: 'btnPreviewPageNumbersDoc', finishBtn: 'btnProcessPageNumbers' },
  { file: 'n-up.html', previewBtn: 'btnPreviewNUpDoc', finishBtn: 'btnProcessNUp' },
  { file: 'split.html', previewBtn: 'btnPreviewSplitDoc', finishBtn: 'btnProcessSplit' }
];

console.log('--- Verifying Preview Document Buttons & Modals Across All 12 Tools ---');
let hasError = false;

for (const tool of allToolsPreviewConfig) {
  const filePath = path.join(__dirname, '..', tool.file);
  const requiredIds = [
    tool.previewBtn,
    tool.finishBtn,
    'pagePreviewModal',
    'previewFullCanvas',
    'resultModal',
    'btnPreviewResult'
  ];
  const missing = checkFileElements(filePath, requiredIds);
  if (missing.length > 0) {
    console.error(`[FAIL] ${tool.file} is missing required elements:`, missing);
    hasError = true;
  } else {
    console.log(`[PASS] ${tool.file} verified with ${tool.previewBtn}, ${tool.finishBtn}, #pagePreviewModal, and #btnPreviewResult`);
  }
}

const watermarkIds = [
  'watermarkDropzone', 'watermarkFileInput', 'btnWatermarkSelect', 'watermarkConfigSection',
  'watermarkFileMeta', 'btnChangeWatermarkFile', 'btnModeText', 'btnModeImage',
  'watermarkTextGroup', 'watermarkText', 'watermarkFont', 'watermarkFontSize',
  'fontSizeDisplay', 'watermarkColor', 'watermarkColorPreset', 'watermarkOpacity',
  'opacityDisplay', 'watermarkRotation', 'rotationDisplay', 'watermarkPosition',
  'watermarkImageGroup', 'watermarkImgDropzone', 'watermarkImgInput', 'watermarkImgScale',
  'imgScaleDisplay', 'watermarkImgOpacity', 'imgOpacityDisplay', 'watermarkImgPosition',
  'watermarkRangeWrapper', 'watermarkRangeInput', 'btnProcessWatermark',
  'btnWatermarkPrevPage', 'watermarkPageIndicator', 'btnWatermarkNextPage',
  'watermarkPreviewCanvas'
];

const redactIds = [
  'redactDropzone', 'redactFileInput', 'btnRedactSelect', 'redactConfigSection',
  'redactFileMeta', 'btnChangeRedactFile', 'btnStyleBlackout',
  'btnStyleWhiteout', 'btnClearPageBoxes', 'btnClearAllRedactBoxes',
  'btnRedactPrevPage', 'redactPageIndicator', 'btnRedactNextPage',
  'redactCanvasWrapper', 'redactBaseCanvas', 'redactOverlayCanvas',
  'redactPageBoxesCount', 'pageBoxBadge', 'redactBoxList', 'btnProcessRedact'
];

const pageNumbersIds = [
  'pageNumbersDropzone', 'pageNumbersFileInput', 'btnPageNumbersSelect', 'pageNumbersConfigSection',
  'pageNumbersFileMeta', 'btnChangePageNumbersFile', 'numFormatPreset', 'customFormatWrapper',
  'customFormatInput', 'numPosition', 'numMargin', 'numMarginDisplay', 'numStart',
  'numFont', 'numFontSize', 'numFontSizeDisplay', 'numColor', 'numColorPreset',
  'chkSkipCover', 'chkAlternatingMargins', 'numRangeWrapper', 'numRangeInput',
  'btnProcessPageNumbers', 'btnNumPrevPage', 'numPageIndicator', 'btnNumNextPage',
  'pageNumbersPreviewCanvas'
];

const nUpIds = [
  'nupDropzone', 'nupFileInput', 'btnNUpSelect', 'nupConfigSection', 'nupFileMeta',
  'btnChangeNUpFile', 'nupChoice', 'nupSheetSize', 'nupOrientation', 'nupPageOrder',
  'nupSpacing', 'chkNUpBorder', 'nupMargin', 'nupMarginDisplay', 'nupRangeWrapper',
  'nupRangeInput', 'nupSummaryText', 'btnProcessNUp', 'btnNUpPrevSheet',
  'nupSheetIndicator', 'btnNUpNextSheet', 'nupPreviewCanvas'
];

const splitIds = [
  'splitDropzone', 'splitFileInput', 'btnSplitSelect', 'splitConfigSection',
  'splitFileMeta', 'btnChangeSplitFile', 'btnSplitAllCuts', 'btnSplitEvery2Cuts',
  'btnSplitClearCuts', 'btnSplitSortToggle', 'splitActiveCutsCount',
  'splitPageCountDisplay', 'splitWorkspaceContainer', 'splitRangeInput',
  'splitCustomIntervalInput', 'btnApplyIntervalCut', 'splitSummaryText',
  'splitOutputBadge', 'btnPreviewSplitDoc', 'btnProcessSplit', 'splitAddMoreFileInput'
];

console.log('\n--- Verifying Tool Specific Configuration Element IDs ---');
const wmMissing = checkFileElements(path.join(__dirname, '..', 'watermark.html'), watermarkIds);
console.log('watermark.html missing IDs:', wmMissing.length === 0 ? '[OK: None]' : wmMissing);

const rdMissing = checkFileElements(path.join(__dirname, '..', 'redact.html'), redactIds);
console.log('redact.html missing IDs:', rdMissing.length === 0 ? '[OK: None]' : rdMissing);

const pnMissing = checkFileElements(path.join(__dirname, '..', 'page-numbers.html'), pageNumbersIds);
console.log('page-numbers.html missing IDs:', pnMissing.length === 0 ? '[OK: None]' : pnMissing);

const nupMissing = checkFileElements(path.join(__dirname, '..', 'n-up.html'), nUpIds);
console.log('n-up.html missing IDs:', nupMissing.length === 0 ? '[OK: None]' : nupMissing);

const splitMissing = checkFileElements(path.join(__dirname, '..', 'split.html'), splitIds);
console.log('split.html missing IDs:', splitMissing.length === 0 ? '[OK: None]' : splitMissing);

if (hasError || wmMissing.length > 0 || rdMissing.length > 0 || pnMissing.length > 0 || nupMissing.length > 0 || splitMissing.length > 0) {
  process.exit(1);
} else {
  console.log('\n[PASS] All 12 Tools have Preview Document Buttons, Lightbox Modal, and Result Preview verified!');
}
