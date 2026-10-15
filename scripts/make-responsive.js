/**
 * make-responsive.js
 * Enhances mobile responsiveness across all 12 tools, index.html, about.html, and app.js.
 */

const fs = require('fs');
const path = require('path');

const TOOL_FILES = [
  'merge.html', 'remove-pages.html', 'add-pages.html', 'resize.html',
  'rotate.html', 'image-to-pdf.html', 'pdf-to-image.html', 'watermark.html',
  'redact.html', 'page-numbers.html', 'n-up.html', 'split.html'
];

console.log('--- Applying Mobile Responsiveness Optimizations ---');

TOOL_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Toolbar flex-wrap for mobile: allow wrapping so rename + buttons never get clipped
  content = content.replace(
    /flex items-center justify-between gap-2 sm:gap-3 shadow-\[2px_2px_0px_0px_rgba\(0,0,0,1\)\] flex-nowrap min-w-0 w-full overflow-hidden/g,
    'flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 sm:gap-3 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] min-w-0 w-full'
  );

  // 2. Toolbar right action controls wrapper: full-width wrap on small screens
  content = content.replace(
    /<!-- Right: Rename, Preview, Finish -->\s*<div class="flex items-center gap-1\.5 sm:gap-2\.5 flex-shrink-0">/g,
    '<!-- Right: Rename, Preview, Finish -->\n          <div class="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end sm:justify-start">'
  );

  // For merge.html specifically:
  content = content.replace(
    /<!-- Right: Preview Combined Document & Finish Button -->\s*<div class="flex items-center gap-1\.5 sm:gap-2\.5 flex-shrink-0">/g,
    '<!-- Right: Preview Combined Document & Finish Button -->\n        <div class="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end sm:justify-start">'
  );

  // 3. Rename input width on narrow screens: w-20 xs:w-28 sm:w-32 md:w-40
  content = content.replace(
    /w-24 sm:w-32 md:w-40 placeholder-neutral-400 truncate/g,
    'w-20 xs:w-28 sm:w-32 md:w-40 placeholder-neutral-400 truncate'
  );

  // 4. Modal page preview header responsiveness:
  content = content.replace(
    /<span class="text-neutral-400">PREVIEW:<\/span>\s*<span id="previewModalTitle" class="truncate text-white max-w-xs sm:max-w-md">/g,
    '<span class="text-neutral-400 hidden sm:inline">PREVIEW:</span>\n          <span id="previewModalTitle" class="truncate text-white max-w-[120px] sm:max-w-md text-[11px] sm:text-xs">'
  );
  content = content.replace(
    /<button type="button" id="btnClosePagePreview" class="term-btn text-xs py-0\.5 px-2\.5 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black" title="Close \(ESC\)">✕ CLOSE<\/button>/g,
    '<button type="button" id="btnClosePagePreview" class="term-btn text-xs py-0.5 px-2 sm:px-2.5 bg-neutral-800 text-white border-neutral-700 hover:bg-white hover:text-black" title="Close (ESC)">✕<span class="hidden sm:inline"> CLOSE</span></button>'
  );

  // 5. Result modal padding on mobile
  content = content.replace(
    /<div class="bg-white border-2 border-black max-w-xl w-full p-5 sm:p-6 space-y-4 shadow-none max-h-\[92vh\] overflow-y-auto select-none">/g,
    '<div class="bg-white border-2 border-black max-w-xl w-full p-3.5 sm:p-6 space-y-3 sm:space-y-4 shadow-none max-h-[92vh] overflow-y-auto select-none">'
  );

  // 6. Result modal footer button wrapping
  content = content.replace(
    /<div class="flex items-center gap-2">/g,
    '<div class="flex items-center gap-2 flex-wrap">'
  );

  // 7. Clean any remaining // in page-numbers.html, watermark.html, etc.
  content = content.replace(/\/\/ NUMBERING FORMAT/g, 'NUMBERING FORMAT');
  content = content.replace(/\/\/ MARGIN/g, 'MARGIN');
  content = content.replace(/\/\/ START AT/g, 'START AT');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[RESPONSIVE] ${file}`);
});

// Update js/app.js for touch support and mobile preview rendering
const appJsPath = path.join(__dirname, '..', 'js', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

// 1. Mobile touch drawing for redactOverlayCanvas
if (!appJs.includes("overlayCanvas.addEventListener('touchstart'")) {
  const targetRedactMousedown = "overlayCanvas.addEventListener('mousedown', (e) => {";
  const replacementRedactTouch = `// Touch Support for Mobile / Touchscreen Devices
      overlayCanvas.style.touchAction = 'none';

      overlayCanvas.addEventListener('touchstart', (e) => {
        if (!AppState.redactDoc || e.touches.length === 0) return;
        e.preventDefault();
        AppState.isDrawingRedact = true;
        const touch = e.touches[0];
        const rect = overlayCanvas.getBoundingClientRect();
        AppState.redactStartX = (touch.clientX - rect.left) * (overlayCanvas.width / rect.width);
        AppState.redactStartY = (touch.clientY - rect.top) * (overlayCanvas.height / rect.height);
      }, { passive: false });

      overlayCanvas.addEventListener('touchmove', (e) => {
        if (!AppState.isDrawingRedact || e.touches.length === 0) return;
        e.preventDefault();
        const touch = e.touches[0];
        const rect = overlayCanvas.getBoundingClientRect();
        const curX = (touch.clientX - rect.left) * (overlayCanvas.width / rect.width);
        const curY = (touch.clientY - rect.top) * (overlayCanvas.height / rect.height);

        const dragRect = {
          x: Math.min(AppState.redactStartX, curX),
          y: Math.min(AppState.redactStartY, curY),
          w: Math.abs(curX - AppState.redactStartX),
          h: Math.abs(curY - AppState.redactStartY)
        };
        drawRedactOverlay(dragRect);
      }, { passive: false });

      overlayCanvas.addEventListener('touchend', (e) => {
        if (!AppState.isDrawingRedact) return;
        e.preventDefault();
        const touch = e.changedTouches[0] || e.touches[0];
        if (!touch) return;
        const rect = overlayCanvas.getBoundingClientRect();
        const curX = (touch.clientX - rect.left) * (overlayCanvas.width / rect.width);
        const curY = (touch.clientY - rect.top) * (overlayCanvas.height / rect.height);

        const w = Math.abs(curX - AppState.redactStartX);
        const h = Math.abs(curY - AppState.redactStartY);

        if (w >= 5 && h >= 5) {
          const normX = Math.min(AppState.redactStartX, curX) / overlayCanvas.width;
          const normY = Math.min(AppState.redactStartY, curY) / overlayCanvas.height;
          const normW = w / overlayCanvas.width;
          const normH = h / overlayCanvas.height;

          const pNum = AppState.redactCurrentPage;
          if (!AppState.redactBoxes[pNum]) {
            AppState.redactBoxes[pNum] = [];
          }

          AppState.redactBoxes[pNum].push({
            id: 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            normX,
            normY,
            normW,
            normH,
            style: AppState.redactActiveStyle,
            color: AppState.redactActiveStyle === 'blackout' ? '#000000' : '#ffffff'
          });

          renderRedactOverlay();
          updateRedactUI();
        } else {
          renderRedactOverlay();
        }
        AppState.isDrawingRedact = false;
      }, { passive: false });

      overlayCanvas.addEventListener('mousedown', (e) => {`;

  appJs = appJs.replace(targetRedactMousedown, replacementRedactTouch);
  console.log('[RESPONSIVE] Added mobile touch drawing support to js/app.js');
}

// 2. Adjust preview container sizing for mobile screens (iPhone / Android)
appJs = appJs.replace(
  /const containerW = container \? Math\.max\(300, container\.clientWidth - 48\) : 800;/g,
  'const containerW = container ? Math.max(200, container.clientWidth - 24) : 800;'
);
appJs = appJs.replace(
  /const containerH = container \? Math\.max\(300, container\.clientHeight - 48\) : 800;/g,
  'const containerH = container ? Math.max(200, container.clientHeight - 24) : 800;'
);

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('[RESPONSIVE] Updated js/app.js');

console.log('--- Finished Mobile Responsiveness Optimizations ---');
