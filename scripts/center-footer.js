/**
 * center-footer.js
 * Centers the "[logo] Anixss-PDFer • Browser-Based PDF Toolkit" branding in the footer
 * across all 14 HTML pages.
 */

const fs = require('fs');
const path = require('path');

const TOOL_FILES = [
  'merge.html', 'remove-pages.html', 'add-pages.html', 'resize.html',
  'rotate.html', 'image-to-pdf.html', 'pdf-to-image.html', 'watermark.html',
  'redact.html', 'page-numbers.html', 'n-up.html', 'split.html'
];

console.log('--- Centering Footer Branding Across All Pages ---');

// 1. Process 12 tool files
TOOL_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace footer block with centered branding
  const footerRegex = /<!-- FOOTER -->\s*<footer[\s\S]*?<\/footer>/;
  const newFooter = `<!-- FOOTER -->
  <footer class="border-t border-black bg-white mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-center gap-4 text-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 bg-black rounded flex items-center justify-center p-0.5 flex-shrink-0">
          <img src="./assets/logo.svg" alt="Anixss-PDFer" class="w-full h-full object-contain" />
        </div>
        <span class="font-bold text-black font-mono">Anixss-PDFer</span>
        <span>•</span>
        <span class="text-neutral-600 font-mono text-[11px]">Browser-Based PDF Toolkit</span>
      </div>
    </div>
  </footer>`;

  content = content.replace(footerRegex, newFooter);
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[CENTERED] ${file}`);
});

// 2. Process index.html
const indexPath = path.join(__dirname, '..', 'index.html');
let indexContent = fs.readFileSync(indexPath, 'utf8');
const indexFooterRegex = /<!-- FOOTER[\s\S]*?<footer[\s\S]*?<\/footer>/;
const newIndexFooter = `<!-- FOOTER                                                    -->
  <!-- ========================================================= -->
  <footer class="border-t border-black bg-white mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 bg-black rounded flex items-center justify-center p-0.5 flex-shrink-0">
          <img src="./assets/logo.svg" alt="Anixss-PDFer" class="w-full h-full object-contain" />
        </div>
        <span class="font-bold text-black font-mono">Anixss-PDFer</span>
        <span>•</span>
        <span class="text-neutral-600 font-mono text-[11px]">Browser-Based PDF Toolkit</span>
      </div>
      <span class="hidden sm:inline text-neutral-400">•</span>
      <div class="flex items-center gap-3 text-neutral-600">
        <a href="about.html" class="underline hover:text-black font-mono text-[11px]">PRIVACY & ARCHITECTURE</a>
      </div>
    </div>
  </footer>`;
indexContent = indexContent.replace(indexFooterRegex, newIndexFooter);
fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('[CENTERED] index.html');

// 3. Process about.html
const aboutPath = path.join(__dirname, '..', 'about.html');
let aboutContent = fs.readFileSync(aboutPath, 'utf8');
const aboutFooterRegex = /<!-- FOOTER -->\s*<footer[\s\S]*?<\/footer>/;
const newAboutFooter = `<!-- FOOTER -->
  <footer class="border-t border-black bg-white mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs">
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 bg-black rounded flex items-center justify-center p-0.5 flex-shrink-0">
          <img src="./assets/logo.svg" alt="Anixss-PDFer" class="w-full h-full object-contain" />
        </div>
        <span class="font-bold text-black font-mono">Anixss-PDFer</span>
        <span>•</span>
        <span class="text-neutral-600 font-mono text-[11px]">Browser-Based PDF Toolkit</span>
      </div>
      <span class="hidden sm:inline text-neutral-400">•</span>
      <div class="flex items-center gap-3 text-neutral-600">
        <a href="index.html" class="underline hover:text-black font-mono text-[11px]">HOME</a>
      </div>
    </div>
  </footer>`;
aboutContent = aboutContent.replace(aboutFooterRegex, newAboutFooter);
fs.writeFileSync(aboutPath, aboutContent, 'utf8');
console.log('[CENTERED] about.html');

console.log('--- Finished Centering Footer Branding ---');
