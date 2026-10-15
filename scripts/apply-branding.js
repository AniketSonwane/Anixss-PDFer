/**
 * apply-branding.js
 * Applies cohesive, professional branding of Anixss-PDFer across all pages:
 * 1. Favicon link (<link rel="icon" type="image/svg+xml" href="./assets/favicon.svg">)
 * 2. Header logo mark + wordmark
 * 3. Footer brand identity with logo icon
 */

const fs = require('fs');
const path = require('path');

const ALL_HTML_FILES = [
  'index.html', 'about.html', 'merge.html', 'remove-pages.html',
  'add-pages.html', 'resize.html', 'rotate.html', 'image-to-pdf.html',
  'pdf-to-image.html', 'watermark.html', 'redact.html', 'page-numbers.html',
  'n-up.html', 'split.html'
];

console.log('--- Applying Anixss-PDFer Branding Across All Pages ---');

const BRAND_HEADER_REPLACEMENT = `      <!-- Brand Logo -->
      <div class="flex items-center gap-3">
        <a href="index.html" id="navBrand" class="flex items-center gap-2.5 group select-none text-black hover:opacity-90 transition-opacity" title="Anixss-PDFer Home">
          <div class="w-8 h-8 sm:w-9 sm:h-9 bg-black rounded flex items-center justify-center p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">
            <img src="./assets/logo.svg" alt="Anixss-PDFer" class="w-full h-full object-contain" />
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-lg sm:text-xl font-extrabold tracking-tight text-black font-mono">Anixss<span class="text-neutral-400 font-normal">-</span>PDFer</span>
            <span class="text-[10px] font-mono border border-black px-1.5 py-0.5 bg-black text-white font-bold tracking-wider">v1.0</span>
          </div>
        </a>
      </div>`;

ALL_HTML_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // 1. Add Favicon if not present
  if (!content.includes('rel="icon"')) {
    content = content.replace(
      /<title>(.*?)<\/title>/,
      '<title>$1</title>\n  <link rel="icon" type="image/svg+xml" href="./assets/favicon.svg">'
    );
  }

  // 2. Standardize Header Brand Logo
  const oldBrandRegex = /<a href="index\.html"(?: id="navBrand")? class="text-lg sm:text-xl font-bold tracking-tight text-black(?: hover:opacity-80 transition-none)? flex items-center gap-2">[\s\S]*?<\/a>/g;
  if (oldBrandRegex.test(content)) {
    content = content.replace(oldBrandRegex, `<a href="index.html" id="navBrand" class="flex items-center gap-2.5 group select-none text-black hover:opacity-90 transition-opacity" title="Anixss-PDFer Home">
          <div class="w-8 h-8 sm:w-9 sm:h-9 bg-black rounded flex items-center justify-center p-1 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] group-hover:translate-x-0.5 group-hover:translate-y-0.5 group-hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] transition-all">
            <img src="./assets/logo.svg" alt="Anixss-PDFer" class="w-full h-full object-contain" />
          </div>
          <div class="flex items-center gap-1.5">
            <span class="text-lg sm:text-xl font-extrabold tracking-tight text-black font-mono">Anixss<span class="text-neutral-400 font-normal">-</span>PDFer</span>
            <span class="text-[10px] font-mono border border-black px-1.5 py-0.5 bg-black text-white font-bold tracking-wider">v1.0</span>
          </div>
        </a>`);
  }

  // 3. Standardize Footer Branding with Logo Icon
  const footerBrandRegex = /<div class="flex items-center gap-3">\s*<span class="font-bold(?: text-slate-800)?">Anixss-PDFer<\/span>\s*<span>•<\/span>\s*<span>(.*?)<\/span>\s*<\/div>/;
  if (footerBrandRegex.test(content)) {
    content = content.replace(
      footerBrandRegex,
      `<div class="flex items-center gap-2.5">
        <div class="w-5 h-5 bg-black rounded flex items-center justify-center p-0.5 flex-shrink-0">
          <img src="./assets/logo.svg" alt="Anixss-PDFer" class="w-full h-full object-contain" />
        </div>
        <span class="font-bold text-black font-mono">Anixss-PDFer</span>
        <span>•</span>
        <span class="text-neutral-600 font-mono text-[11px]">$1</span>
      </div>`
    );
  }

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[BRANDED] ${file}`);
});

console.log('--- Completed Applying Branding ---');
