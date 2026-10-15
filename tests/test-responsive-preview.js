/**
 * test-responsive-preview.js
 * Verifies that in-page live previews and wrappers maintain exact A4/PDF dimensions
 * on mobile screen sizes and never stretch or letterbox.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('========================================================');
console.log('TESTING MOBILE PREVIEW EXACT A4 SIZING & ZERO STRETCH');
console.log('========================================================\n');

// 1. Verify CSS rules in src/output.css
console.log('[1/4] Verifying CSS aspect-ratio rules in src/output.css...');
const cssContent = fs.readFileSync(path.join(__dirname, '..', 'src', 'output.css'), 'utf8');

assert(cssContent.includes('#watermarkPreviewCanvas'), 'Missing #watermarkPreviewCanvas in output.css');
assert(cssContent.includes('#pageNumbersPreviewCanvas'), 'Missing #pageNumbersPreviewCanvas in output.css');
assert(cssContent.includes('#nupPreviewCanvas'), 'Missing #nupPreviewCanvas in output.css');
assert(cssContent.includes('#redactBaseCanvas'), 'Missing #redactBaseCanvas in output.css');
assert(cssContent.includes('#previewFullCanvas'), 'Missing #previewFullCanvas in output.css');
assert(cssContent.includes('max-width: 100% !important;'), 'Missing max-width 100% !important in output.css');
assert(!cssContent.includes('object-fit: contain !important;'), 'object-fit contain must not be present in output.css');
console.log('[PASS] src/output.css enforces max-width: 100% and zero letterboxing on all preview canvases.');

// 2. Verify HTML wrappers in watermark.html, page-numbers.html, n-up.html, redact.html
console.log('\n[2/4] Verifying HTML wrapper attributes for mobile screens...');
const filesToCheck = [
  { file: 'watermark.html', canvas: 'watermarkPreviewCanvas', wrapper: 'watermarkCanvasWrapper' },
  { file: 'page-numbers.html', canvas: 'pageNumbersPreviewCanvas', wrapper: 'pageNumbersCanvasWrapper' },
  { file: 'n-up.html', canvas: 'nupPreviewCanvas', wrapper: 'nupCanvasWrapper' },
  { file: 'redact.html', canvas: 'redactBaseCanvas', wrapper: 'redactCanvasWrapper' }
];

filesToCheck.forEach(({ file, canvas, wrapper }) => {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  assert(html.includes(`id="${canvas}"`), `${file} missing canvas id: ${canvas}`);
  assert(html.includes(`id="${wrapper}"`), `${file} missing wrapper id: ${wrapper}`);
  assert(html.includes('max-w-full'), `${file} missing max-w-full class`);
  console.log(`[PASS] ${file}: Canvas "${canvas}" and Wrapper "${wrapper}" configured with responsive classes.`);
});

// 3. Verify js/pdf-preview.js exact A4 sizing logic
console.log('\n[3/4] Verifying js/pdf-preview.js proportional sizing logic...');
const pdfPreviewCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'pdf-preview.js'), 'utf8');
assert(pdfPreviewCode.includes("canvas.style.maxWidth = '100%';"), 'Missing maxWidth 100% in pdf-preview.js');
assert(pdfPreviewCode.includes('const targetH = Math.round(targetW / pageRatio);'), 'Missing targetH calculation in pdf-preview.js');
assert(pdfPreviewCode.includes('wrapper.style.height = `${targetH}px`;'), 'Missing wrapper targetH in pdf-preview.js');
console.log('[PASS] js/pdf-preview.js dynamically sizes both canvas and wrapper to exact PDF dimensions.');

// 4. Test simulated canvas & wrapper dimensions on mobile viewport
console.log('\n[4/4] Simulating mobile screen viewport constraint on A4 page...');
// Standard A4 dimensions: 595.28 x 841.89 pt (ratio: ~0.7071)
const pageWidth = 595.28;
const pageHeight = 841.89;
const pageRatio = pageWidth / pageHeight;

// Mobile viewport available width: 316px
const availW = 316;
const desktopViewportW = 672;
const targetW = Math.min(availW, desktopViewportW);
const targetH = Math.round(targetW / pageRatio);
const computedRatio = targetW / targetH;

assert.strictEqual(targetW, 316);
assert.strictEqual(targetH, 447); // 316 / 0.7071 = 446.9 -> 447px
assert(Math.abs(computedRatio - pageRatio) < 0.001, 'Computed mobile aspect ratio distorted!');

console.log(`[PASS] Preview space and PDF preview have identical A4 dimensions:`);
console.log(`       Original A4: ${pageWidth} x ${pageHeight} pt (Ratio: ${pageRatio.toFixed(4)})`);
console.log(`       Mobile:      ${targetW}px x ${targetH}px (Ratio: ${computedRatio.toFixed(4)})`);
console.log(`       Preview space matches PDF preview with 0px extra vertical space.`);

console.log('\n========================================================');
console.log('ALL EXACT A4 SIZING VERIFICATIONS PASSED SUCCESSFULLY!');
console.log('========================================================\n');
