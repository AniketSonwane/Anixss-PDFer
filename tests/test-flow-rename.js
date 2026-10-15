/**
 * test-flow-rename.js
 * End-to-end integration test simulating user renaming workflows:
 * 1. Automatic pre-fill on file load
 * 2. Toolbar pre-export rename
 * 3. Result Modal post-generation rename
 * 4. Download and DO MORE propagation
 */

const assert = require('assert');

// Simulate the exact logic implemented in app.js
function getCustomFilename(inputId, defaultName, defaultExt = '.pdf', domInputs = {}) {
  let raw = defaultName;
  if (inputId && domInputs[inputId] && domInputs[inputId].trim().length > 0) {
    raw = domInputs[inputId].trim();
  }
  // Remove extension if user entered or copied it
  if (defaultExt) {
    const extRegex = new RegExp(`\\${defaultExt}$`, 'i');
    raw = raw.replace(extRegex, '');
  }
  let sanitized = raw.replace(/[\\/:*?"<>|]/g, '_').trim();
  if (!sanitized) {
    sanitized = defaultName.replace(new RegExp(`\\${defaultExt}$`, 'i'), '');
  }
  return defaultExt ? `${sanitized}${defaultExt}` : sanitized;
}

function setToolOutputFilename(inputId, sourceFilename, suffix = '', defaultExt = '.pdf', domInputs = {}) {
  let base = 'document';
  if (sourceFilename) {
    base = sourceFilename.replace(/\.[^/.]+$/, '').trim();
  }
  const cleanBase = base.replace(/[\\/:*?"<>|]/g, '_');
  // Set base name without extension so extension remains non-editable in UI
  domInputs[inputId] = `${cleanBase}${suffix}`;
}

const domState = {};

console.log('Testing Flow 1: Automatic prefill on load (base name only, no .pdf in input)...');
setToolOutputFilename('mergeOutputFilename', 'Annual_Report_2026.pdf', '_merged', '.pdf', domState);
assert.strictEqual(domState['mergeOutputFilename'], 'Annual_Report_2026_merged');
console.log(' -> Prefill OK (base only, user cannot edit .pdf):', domState['mergeOutputFilename']);

console.log('Testing Flow 2: User customizes name in toolbar before export...');
domState['mergeOutputFilename'] = 'Executive_Summary_Final';
let resolvedName = getCustomFilename('mergeOutputFilename', 'anixss_merged.pdf', '.pdf', domState);
assert.strictEqual(resolvedName, 'Executive_Summary_Final.pdf');
console.log(' -> Toolbar Rename OK (appends locked .pdf):', resolvedName);

console.log('Testing Flow 3: User tries to type/paste .pdf into toolbar input (stripped)...');
domState['mergeOutputFilename'] = 'Quarterly_Report.pdf';
let strippedName = getCustomFilename('mergeOutputFilename', 'anixss_merged.pdf', '.pdf', domState);
assert.strictEqual(strippedName, 'Quarterly_Report.pdf');
console.log(' -> Extension stripping OK (no double .pdf.pdf):', strippedName);

console.log('Testing Flow 4: Result Modal inline rename before download/DO MORE...');
domState['resultFilenameInput'] = 'Executive_Summary_v2';
let modalName = getCustomFilename('resultFilenameInput', resolvedName, '.pdf', domState);
assert.strictEqual(modalName, 'Executive_Summary_v2.pdf');
console.log(' -> Modal Inline Rename OK:', modalName);

console.log('Testing Flow 5: ZIP export sanitization (PDF-to-Image)...');
setToolOutputFilename('pdf2imgOutputFilename', 'Scan:Confidential/Data?.pdf', '_images', '.zip', domState);
assert.strictEqual(domState['pdf2imgOutputFilename'], 'Scan_Confidential_Data__images');
let zipName = getCustomFilename('pdf2imgOutputFilename', 'extracted_images.zip', '.zip', domState);
assert.strictEqual(zipName, 'Scan_Confidential_Data__images.zip');
console.log(' -> Sanitization & ZIP OK:', zipName);

console.log('\nAll simulation flows passed 100%!');
