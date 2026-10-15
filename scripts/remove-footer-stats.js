/**
 * remove-footer-stats.js
 * Removes "0 bytes uploaded • 100% Private • Open Source" from all page footers
 * while keeping the Anixss-PDFer branding and clean black-and-white theme.
 */

const fs = require('fs');
const path = require('path');

const TOOL_FILES = [
  'merge.html', 'remove-pages.html', 'add-pages.html', 'resize.html',
  'rotate.html', 'image-to-pdf.html', 'pdf-to-image.html', 'watermark.html',
  'redact.html', 'page-numbers.html', 'n-up.html', 'split.html'
];

console.log('--- Removing "0 bytes uploaded • 100% Private • Open Source" from Footers ---');

// 1. Process 12 tool files
TOOL_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace footer styling with crisp black & white
  content = content.replace(
    /<footer class="border-t border-slate-200 bg-white\/70 backdrop-blur-sm mt-auto">/g,
    '<footer class="border-t border-black bg-white mt-auto">'
  );

  content = content.replace(
    /<div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">/g,
    '<div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs">'
  );

  // Remove the stats block
  const statsRegex = /<div class="flex items-center gap-3 text-slate-500">\s*<span>0 bytes uploaded<\/span>\s*<span>•<\/span>\s*<span>100% Private<\/span>\s*<span>•<\/span>\s*<span>Open Source<\/span>\s*<\/div>/g;
  content = content.replace(statsRegex, '');

  // Uppercase toolkit subtitle for monochrome consistency
  content = content.replace(
    /<span class="text-neutral-600 font-mono text-\[11px\]">Browser-Based PDF Toolkit<\/span>/g,
    '<span class="text-neutral-600 font-mono text-[11px]">BROWSER-BASED PDF TOOLKIT</span>'
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[REMOVED] ${file}`);
});

// 2. Process index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
indexContent = indexContent.replace(
  /<span>0 BYTES UPLOADED<\/span>\s*<span>•<\/span>\s*/g,
  ''
);
fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('[REMOVED] index.html');

// 3. Process about.html
const aboutPath = path.join(__dirname, '..', 'about.html');
let aboutContent = fs.readFileSync(aboutPath, 'utf8');
aboutContent = aboutContent.replace(
  /<div class="flex items-center gap-3 text-neutral-600">\s*<span>0 BYTES UPLOADED<\/span>\s*<span>•<\/span>\s*<span>OPEN SOURCE<\/span>\s*<\/div>/g,
  '<div class="flex items-center gap-3 text-neutral-600">\n        <a href="index.html" class="underline hover:text-black font-mono">HOME</a>\n      </div>'
);
fs.writeFileSync(aboutPath, aboutContent, 'utf8');
console.log('[REMOVED] about.html');

console.log('--- Finished Footer Cleanup ---');
