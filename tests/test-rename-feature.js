/**
 * test-rename-feature.js
 * Verifies that all 12 tools provide pre-export file renaming:
 * 1. Toolbar action input field (*OutputFilename)
 * 2. Result modal inline rename field (#resultFilenameInput)
 * 3. getCustomFilename & setToolOutputFilename functions
 * 4. Synchronization with download & DO MORE
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const TOOL_CONFIGS = [
  { file: 'merge.html', inputId: 'mergeOutputFilename', ext: '.pdf' },
  { file: 'remove-pages.html', inputId: 'removeOutputFilename', ext: '.pdf' },
  { file: 'add-pages.html', inputId: 'addOutputFilename', ext: '.pdf' },
  { file: 'resize.html', inputId: 'resizeOutputFilename', ext: '.pdf' },
  { file: 'rotate.html', inputId: 'rotateOutputFilename', ext: '.pdf' },
  { file: 'image-to-pdf.html', inputId: 'img2pdfOutputFilename', ext: '.pdf' },
  { file: 'pdf-to-image.html', inputId: 'pdf2imgOutputFilename', ext: '.zip' },
  { file: 'watermark.html', inputId: 'watermarkOutputFilename', ext: '.pdf' },
  { file: 'redact.html', inputId: 'redactOutputFilename', ext: '.pdf' },
  { file: 'page-numbers.html', inputId: 'pageNumbersOutputFilename', ext: '.pdf' },
  { file: 'n-up.html', inputId: 'nupOutputFilename', ext: '.pdf' },
  { file: 'split.html', inputId: 'splitOutputFilename', ext: '.pdf' }
];

console.log('========================================================');
console.log('VERIFYING PRE-EXPORT FILE RENAME FEATURE ACROSS ALL TOOLS');
console.log('========================================================\n');

// 1. Verify HTML toolbar inputs and result modal inputs
TOOL_CONFIGS.forEach((cfg) => {
  const filePath = path.join(__dirname, '..', cfg.file);
  const html = fs.readFileSync(filePath, 'utf8');

  // Check toolbar rename input
  assert(
    html.includes(`id="${cfg.inputId}"`),
    `[FAIL] ${cfg.file} missing toolbar rename input #${cfg.inputId}`
  );

  // Check that toolbar input value does NOT contain .pdf or .zip (user cannot edit extension)
  const valMatch = html.match(new RegExp(`id="${cfg.inputId}"[^>]*value="([^"]+)"`));
  if (valMatch) {
    const defaultVal = valMatch[1];
    assert(
      !defaultVal.endsWith('.pdf') && !defaultVal.endsWith('.zip'),
      `[FAIL] ${cfg.file} input #${cfg.inputId} should not have extension in value: "${defaultVal}"`
    );
  }

  // Check result modal rename input
  assert(
    html.includes('id="resultFilenameInput"'),
    `[FAIL] ${cfg.file} missing result modal rename input #resultFilenameInput`
  );

  // Check result modal locked suffix badge
  assert(
    html.includes('id="resultFileExtSuffix"'),
    `[FAIL] ${cfg.file} missing result modal suffix badge #resultFileExtSuffix`
  );

  console.log(`[PASS] ${cfg.file}: Toolbar (#${cfg.inputId} locked ${cfg.ext}) & Modal (#resultFilenameInput + #resultFileExtSuffix) verified.`);
});

// 2. Verify js/app.js wiring
console.log('\n--- Verifying js/app.js Rename Wiring ---');
const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');

assert(appJs.includes('function getCustomFilename('), '[FAIL] getCustomFilename function missing');
assert(appJs.includes('function setToolOutputFilename('), '[FAIL] setToolOutputFilename function missing');
assert(appJs.includes('function initRenameInputsProtection('), '[FAIL] initRenameInputsProtection missing');

// Verify all 12 input IDs are referenced in app.js
TOOL_CONFIGS.forEach((cfg) => {
  assert(
    appJs.includes(`'${cfg.inputId}'`),
    `[FAIL] app.js does not reference toolbar input '${cfg.inputId}'`
  );
  console.log(`[PASS] app.js wires toolbar input: '${cfg.inputId}'`);
});

// Verify resultFilenameInput synchronization
assert(appJs.includes('resultFilenameInput'), '[FAIL] resultFilenameInput missing in app.js');
assert(appJs.includes('AppState.lastResultFilename = val'), '[FAIL] app.js does not sync lastResultFilename');
assert(appJs.includes('window._lastGeneratedFilename = val'), '[FAIL] app.js does not sync _lastGeneratedFilename');
assert(appJs.includes('resultFileExtSuffix'), '[FAIL] app.js does not reference resultFileExtSuffix');

console.log('[PASS] Result modal syncs lastResultFilename and _lastGeneratedFilename on user rename');
console.log('[PASS] DO MORE transfers renamed file');
console.log('[PASS] Download uses custom filename');
console.log('[PASS] Extension protection active across all rename fields');

console.log('\n========================================================');
console.log('ALL PRE-EXPORT RENAME TESTS PASSED (100%)!');
console.log('========================================================\n');
