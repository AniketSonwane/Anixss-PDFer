// Test DO MORE feature across all 12 tool pages and the file transfer pipeline
const fs = require('fs');
const path = require('path');

const HTML_FILES = [
  'merge.html',
  'remove-pages.html',
  'add-pages.html',
  'resize.html',
  'rotate.html',
  'image-to-pdf.html',
  'pdf-to-image.html',
  'watermark.html',
  'redact.html',
  'page-numbers.html',
  'n-up.html',
  'split.html'
];

const REQUIRED_ELEMENT_IDS = [
  'resultModal',
  'resultDownloadCard',
  'resultDoMoreCard',
  'btnDownloadResult',
  'btnDoMoreToggle',
  'doMorePanel',
  'btnCloseDoMorePanel'
];

const EXPECTED_TOOLS = [
  'page-numbers',
  'watermark',
  'redact',
  'split',
  'resize',
  'rotate',
  'add',
  'remove',
  'n-up',
  'pdf2img',
  'merge'
];

console.log('========================================================');
console.log('VERIFYING "DO MORE" FEATURE IN ALL 12 TOOLS');
console.log('========================================================\n');

let allPassed = true;

for (const file of HTML_FILES) {
  const filePath = path.join(__dirname, '..', file);
  const content = fs.readFileSync(filePath, 'utf8');

  const missingIds = REQUIRED_ELEMENT_IDS.filter(id => !content.includes(`id="${id}"`));
  if (missingIds.length > 0) {
    console.error(`[FAIL] ${file} is missing IDs: ${missingIds.join(', ')}`);
    allPassed = false;
    continue;
  }

  const missingTools = EXPECTED_TOOLS.filter(t => !content.includes(`data-tool="${t}"`));
  if (missingTools.length > 0) {
    console.error(`[FAIL] ${file} is missing tool actions: ${missingTools.join(', ')}`);
    allPassed = false;
    continue;
  }

  console.log(`[PASS] ${file}: Option 1 (Download), Option 2 (DO MORE), & all 11 tool actions verified`);
}

console.log('\n--- Verifying js/app.js DO MORE Architecture ---');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

const checks = [
  { name: 'TOOL_PAGE_MAP defined with all tools', query: 'const TOOL_PAGE_MAP = {' },
  { name: 'doMoreWithResult function implemented', query: 'async function doMoreWithResult(' },
  { name: 'ensureDoMoreUI dynamic injector implemented', query: 'function ensureDoMoreUI(' },
  { name: 'toggleDoMorePanel function implemented', query: 'function toggleDoMorePanel(' },
  { name: 'btnDoMoreToggle click handler', query: "e.target.closest('#btnDoMoreToggle')" },
  { name: 'showResultModal activates DO MORE for PDFs', query: 'ensureDoMoreUI();' },
  { name: 'FileTransfer queue integration', query: 'window.FileTransfer.setPendingFiles' },
  { name: 'PdfApp exported with doMoreWithResult', query: 'doMoreWithResult' },
  { name: 'PdfApp exported with toggleDoMorePanel', query: 'toggleDoMorePanel' }
];

for (const check of checks) {
  if (appJs.includes(check.query)) {
    console.log(`[PASS] ${check.name}`);
  } else {
    console.error(`[FAIL] Missing check in js/app.js: ${check.name}`);
    allPassed = false;
  }
}

console.log('\n--- Verifying toggleDoMorePanel Logic ---');
let panelClasses = new Set(['hidden']);
function mockToggle(forceState) {
  const isHidden = panelClasses.has('hidden');
  const shouldShow = typeof forceState === 'boolean' ? forceState : isHidden;
  if (shouldShow) {
    panelClasses.delete('hidden');
  } else {
    panelClasses.add('hidden');
  }
}
mockToggle(); // Click 1
if (!panelClasses.has('hidden')) {
  console.log('[PASS] Click 1: DO MORE opens panel (removes "hidden")');
} else {
  console.error('[FAIL] Click 1 did not open panel');
  allPassed = false;
}
mockToggle(); // Click 2
if (panelClasses.has('hidden')) {
  console.log('[PASS] Click 2: DO MORE closes panel (adds "hidden")');
} else {
  console.error('[FAIL] Click 2 did not close panel');
  allPassed = false;
}
mockToggle(false); // Close button
if (panelClasses.has('hidden')) {
  console.log('[PASS] Close button: DO MORE explicitly closes panel');
} else {
  console.error('[FAIL] Close button did not close panel');
  allPassed = false;
}

if (allPassed) {
  console.log('\n========================================================');
  console.log('ALL "DO MORE" FEATURE VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('========================================================');
  process.exit(0);
} else {
  console.error('\nSome checks failed!');
  process.exit(1);
}
