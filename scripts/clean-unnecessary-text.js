/**
 * clean-unnecessary-text.js
 * Cleans unnecessary developer syntax, comments (//), brackets, and clunky placeholder text
 * across all HTML files and app.js to make Anixss-PDFer ready for public users.
 */

const fs = require('fs');
const path = require('path');

const HTML_FILES = [
  'index.html', 'about.html', 'merge.html', 'remove-pages.html',
  'add-pages.html', 'resize.html', 'rotate.html', 'image-to-pdf.html',
  'pdf-to-image.html', 'watermark.html', 'redact.html', 'page-numbers.html',
  'n-up.html', 'split.html'
];

console.log('--- Cleaning Unnecessary Text for Public Release ---');

HTML_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return;

  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Branding: [Anixss-PDFer] -> Anixss-PDFer
  content = content.replace(/<span>\[Anixss-PDFer\]<\/span>/g, '<span>Anixss-PDFer</span>');

  // 2. Navigation items: [01] HOME -> HOME, [02] ABOUT -> ABOUT
  content = content.replace(/\[01\] HOME/g, 'HOME');
  content = content.replace(/\[02\] ABOUT/g, 'ABOUT');

  // 3. Reset button: [ RESET ] -> RESET
  content = content.replace(/\[ RESET \]/g, 'RESET');

  // 4. Result modal: // RENAME FILE BEFORE EXPORT: -> FILE NAME:
  content = content.replace(/\/\/ RENAME FILE BEFORE EXPORT:/g, 'FILE NAME:');
  
  // 5. Result modal: [CLICK TO EDIT] -> remove
  content = content.replace(/<span class="text-neutral-400">\[CLICK TO EDIT\]<\/span>/g, '');
  content = content.replace(/\[CLICK TO EDIT\]/g, '');

  // 6. Result modal option labels: Option 1: Save File -> Save File, Option 2: Next Step -> Next Step
  content = content.replace(/Option 1: Save File/g, 'Save File');
  content = content.replace(/Option 2: Next Step/g, 'Next Step');
  content = content.replace(/\/\/ OPTION 1: SAVE TO DISK/g, 'SAVE TO DISK');
  content = content.replace(/\/\/ OPTION 2: NEXT STEP/g, 'NEXT STEP');

  // 7. Tool headers: TOOL // 01: MERGE PDF -> MERGE PDF, etc.
  content = content.replace(/TOOL \/\/ 01: MERGE PDF/g, 'MERGE PDF');
  content = content.replace(/TOOL \/\/ 02: REMOVE PAGES/g, 'REMOVE PAGES');
  content = content.replace(/TOOL \/\/ 03: ADD PAGES/g, 'ADD PAGES');
  content = content.replace(/TOOL \/\/ 04: RESIZE PDF/g, 'RESIZE PDF');
  content = content.replace(/TOOL \/\/ 05: ROTATE PDF/g, 'ROTATE PDF');
  content = content.replace(/TOOL \/\/ 06: IMAGE TO PDF/g, 'IMAGE TO PDF');
  content = content.replace(/TOOL \/\/ 07: PDF TO IMAGE/g, 'PDF TO IMAGE');
  content = content.replace(/TOOL \/\/ 08: WATERMARK PDF/g, 'WATERMARK PDF');
  content = content.replace(/TOOL \/\/ 09: HIDE CONTENT \(REDACT\)/g, 'HIDE CONTENT (REDACT)');
  content = content.replace(/TOOL \/\/ 10: ADD PAGE NUMBERS/g, 'PAGE NUMBERS');
  content = content.replace(/TOOL \/\/ 11: MULTIPLE PAGES PER SHEET \(N-UP\)/g, 'MULTI-PAGE (N-UP)');
  content = content.replace(/TOOL \/\/ 12: SPLIT PDF/g, 'SPLIT PDF');

  // 8. Toolbar status / badge text: // SPLIT DOCUMENT, // SOURCE:, etc.
  content = content.replace(/\/\/ SPLIT DOCUMENT/g, 'SPLIT DOCUMENT');
  content = content.replace(/\/\/ PAGE NUMBERS/g, 'PAGE NUMBERS');
  content = content.replace(/\/\/ REDACT DOCUMENT/g, 'REDACT DOCUMENT');
  content = content.replace(/\/\/ EXPORT IMAGES/g, 'EXPORT IMAGES');
  content = content.replace(/\/\/ SOURCE:/g, 'SOURCE:');
  content = content.replace(/\[ CHANGE FILE \]/g, 'CHANGE FILE');
  content = content.replace(/\[ CHANGE \]/g, 'CHANGE FILE');
  content = content.replace(/\[ACTIVE CUTS:/g, 'ACTIVE CUTS:');

  // 9. Dropzone brackets: [ DROP ... ] -> DROP ...
  content = content.replace(/\[ DROP A PDF FILE HERE TO VISUALLY SPLIT \]/g, 'DROP A PDF FILE HERE TO SPLIT');
  content = content.replace(/\[ DROP YOUR PDF FILE HERE \]/g, 'DROP YOUR PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO REMOVE PAGES \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO INSERT PAGES \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO RESIZE \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO ROTATE \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP IMAGE FILES HERE \(JPG, PNG, WEBP\) \]/g, 'DROP IMAGE FILES HERE (JPG, PNG, WEBP)');
  content = content.replace(/\[ DROP PDF FILE HERE TO CONVERT TO IMAGES \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO WATERMARK \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO HIDE SENSITIVE CONTENT \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO NUMBER PAGES \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP PDF FILE HERE TO CREATE N-UP SHEET \]/g, 'DROP PDF FILE HERE');
  content = content.replace(/\[ DROP YOUR FILES HERE \]/g, 'DROP YOUR FILES HERE');

  // 10. Preview modal: [✕ CLOSE] -> ✕ CLOSE
  content = content.replace(/\[✕ CLOSE\]/g, '✕ CLOSE');
  content = content.replace(/\/\/ PREVIEW:/g, 'PREVIEW:');

  // 11. Tool form labels (watermark, split, etc.)
  content = content.replace(/\/\/ WATERMARK TEXT/g, 'WATERMARK TEXT');
  content = content.replace(/\/\/ FONT/g, 'FONT');
  content = content.replace(/\/\/ SIZE/g, 'SIZE');
  content = content.replace(/\/\/ COLOR/g, 'COLOR');
  content = content.replace(/\/\/ OPACITY/g, 'OPACITY');
  content = content.replace(/\/\/ ROTATION/g, 'ROTATION');
  content = content.replace(/\/\/ PLACEMENT/g, 'PLACEMENT');
  content = content.replace(/\/\/ SELECT WATERMARK IMAGE/g, 'SELECT WATERMARK IMAGE');
  content = content.replace(/\/\/ IMAGE SCALE/g, 'IMAGE SCALE');
  content = content.replace(/\/\/ POSITION/g, 'POSITION');
  content = content.replace(/\/\/ APPLY TO PAGES/g, 'APPLY TO PAGES');
  content = content.replace(/\/\/ LIVE PREVIEW/g, 'LIVE PREVIEW');
  content = content.replace(/\/\/ SYNCHRONIZED PAGE RANGES \(AUTO-UPDATES WITH SCISSORS\):/g, 'PAGE RANGES:');
  content = content.replace(/\/\/ SPLIT EVERY N PAGES:/g, 'SPLIT EVERY N PAGES:');
  content = content.replace(/\/\/ OUTPUT PLAN:/g, 'OUTPUT PLAN:');

  // 12. Homepage specific cards & text
  content = content.replace(/\/\/ CLIENT-SIDE PDF ENGINE/g, 'CLIENT-SIDE PDF ENGINE');
  content = content.replace(/\[SELECT A MODULE TO BEGIN\]/g, 'Select a tool to begin');
  content = content.replace(/AVAILABLE UTILITIES \(12\)/g, 'ALL PDF TOOLS (12)');
  for (let i = 1; i <= 12; i++) {
    const num = i < 10 ? `0${i}` : `${i}`;
    content = content.replace(new RegExp(`\\[TOOL // ${num}\\]`, 'g'), `TOOL ${num}`);
  }
  content = content.replace(/\[ OPEN MERGER \]/g, 'OPEN MERGER');
  content = content.replace(/\[ EXTRACT & DELETE \]/g, 'EXTRACT & DELETE');
  content = content.replace(/\[ INSERT PAGES \]/g, 'INSERT PAGES');
  content = content.replace(/\[ CHANGE DIMENSIONS \]/g, 'CHANGE DIMENSIONS');
  content = content.replace(/\[ ROTATE PAGES \]/g, 'ROTATE PAGES');
  content = content.replace(/\[ COMPILE IMAGES \]/g, 'COMPILE IMAGES');
  content = content.replace(/\[ EXPORT AS IMAGES \]/g, 'EXPORT AS IMAGES');
  content = content.replace(/\[ ADD WATERMARK \]/g, 'ADD WATERMARK');
  content = content.replace(/\[ DRAW HIDING BOXES \]/g, 'DRAW HIDING BOXES');
  content = content.replace(/\[ NUMBER PAGES \]/g, 'NUMBER PAGES');
  content = content.replace(/\[ COMBINE PAGES \]/g, 'COMBINE PAGES');
  content = content.replace(/\[ SPLIT DOCUMENT \]/g, 'SPLIT DOCUMENT');
  content = content.replace(/\[FILE LOADED: SELECT TOOL\]/g, 'SELECT TOOL');
  content = content.replace(/\[ REMOVE PAGES \]/g, 'REMOVE PAGES');
  content = content.replace(/\[ ADD PAGES \]/g, 'ADD PAGES');
  content = content.replace(/\[ RESIZE PDF \]/g, 'RESIZE PDF');
  content = content.replace(/\[ ROTATE PDF \]/g, 'ROTATE PDF');
  content = content.replace(/\[ WATERMARK \]/g, 'WATERMARK');
  content = content.replace(/\[ HIDE CONTENT \]/g, 'HIDE CONTENT');
  content = content.replace(/\[ PAGE NUMBERS \]/g, 'PAGE NUMBERS');
  content = content.replace(/\[ MULTI-PAGE \(N-UP\) \]/g, 'MULTI-PAGE (N-UP)');
  content = content.replace(/\[ SPLIT PDF \]/g, 'SPLIT PDF');
  content = content.replace(/\[ PDF TO IMAGE \]/g, 'PDF TO IMAGE');
  content = content.replace(/\[ MERGE \(ADD MORE\) \]/g, 'MERGE (ADD MORE)');

  // 13. About page
  content = content.replace(/\/\/ ABOUT & TECHNICAL SPECIFICATIONS/g, 'ABOUT & TECHNICAL SPECIFICATIONS');
  content = content.replace(/\[100% CLIENT-SIDE PROCESSING\]/g, '100% Client-Side Processing');
  content = content.replace(/\[TECHNOLOGY STACK\]/g, 'Technology Stack');
  content = content.replace(/\[HOW TO VERIFY PRIVACY\]/g, 'How to Verify Privacy');
  content = content.replace(/\[PERFORMANCE & MEMORY\]/g, 'Performance & Memory');
  content = content.replace(/\/\/ JUMP TO ANY UTILITY:/g, 'QUICK TOOLS:');
  content = content.replace(/\[01\] MERGE PDF/g, 'MERGE PDF');
  content = content.replace(/\[02\] REMOVE PAGES/g, 'REMOVE PAGES');
  content = content.replace(/\[03\] ADD PAGES/g, 'ADD PAGES');
  content = content.replace(/\[04\] RESIZE PDF/g, 'RESIZE PDF');
  content = content.replace(/\[05\] ROTATE PDF/g, 'ROTATE PDF');
  content = content.replace(/\[06\] IMAGE TO PDF/g, 'IMAGE TO PDF');
  content = content.replace(/\[07\] PDF TO IMAGE/g, 'PDF TO IMAGE');
  content = content.replace(/\[08\] WATERMARK PDF/g, 'WATERMARK PDF');
  content = content.replace(/\[09\] HIDE CONTENT/g, 'HIDE CONTENT');
  content = content.replace(/\[10\] PAGE NUMBERS/g, 'PAGE NUMBERS');
  content = content.replace(/\[11\] N-UP MULTI-PAGE/g, 'N-UP MULTI-PAGE');
  content = content.replace(/\[12\] SPLIT PDF/g, 'SPLIT PDF');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[CLEANED] ${file}`);
});

// Clean js/app.js ensureDoMoreUI dynamic HTML template
const appJsPath = path.join(__dirname, '..', 'js', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');
appJs = appJs.replace(/\/\/ RENAME FILE BEFORE EXPORT:/g, 'FILE NAME:');
appJs = appJs.replace(/<span class="text-neutral-400">\[CLICK TO EDIT\]<\/span>/g, '');
appJs = appJs.replace(/\/\/ OPTION 1: SAVE TO DISK/g, 'SAVE TO DISK');
appJs = appJs.replace(/\/\/ OPTION 2: NEXT STEP/g, 'NEXT STEP');
appJs = appJs.replace(/\[HIDE\]/g, 'CLOSE');
fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log(`[CLEANED] js/app.js`);

console.log('--- Completed Cleaning Text across All Files ---');
