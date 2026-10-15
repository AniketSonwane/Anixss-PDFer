/**
 * apply-pastel-icons.js
 * Applies pastel colors exclusively to icons across the entire app
 * while keeping the overall black and white theme intact.
 */

const fs = require('fs');
const path = require('path');

const TOOL_FILES = [
  'merge.html', 'remove-pages.html', 'add-pages.html', 'resize.html',
  'rotate.html', 'image-to-pdf.html', 'pdf-to-image.html', 'watermark.html',
  'redact.html', 'page-numbers.html', 'n-up.html', 'split.html'
];

console.log('--- Applying Pastel Colors to Icons Across Application ---');

// 1. Update Homepage (index.html)
const indexPath = path.join(__dirname, '..', 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Global Dropzone icon pastel accent
indexHtml = indexHtml.replace(
  /<div class="border border-black p-3 bg-white">\s*<svg class="w-8 h-8 stroke-current"/,
  '<div class="border border-black p-3 bg-sky-50 text-sky-600">\n          <svg class="w-8 h-8 stroke-current"'
);

// Map of 12 tool cards on index.html with distinct pastel icon badges
const TOOL_CARD_ICONS = {
  'merge': {
    title: 'MERGE PDF',
    pastel: 'bg-blue-100 text-blue-700 border-blue-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>'
  },
  'remove': {
    title: 'REMOVE PAGES',
    pastel: 'bg-rose-100 text-rose-700 border-rose-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
  },
  'add': {
    title: 'ADD PAGES',
    pastel: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>'
  },
  'resize': {
    title: 'RESIZE PDF',
    pastel: 'bg-amber-100 text-amber-800 border-amber-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/></svg>'
  },
  'rotate': {
    title: 'ROTATE PDF',
    pastel: 'bg-purple-100 text-purple-700 border-purple-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>'
  },
  'img2pdf': {
    title: 'IMAGE TO PDF',
    pastel: 'bg-sky-100 text-sky-700 border-sky-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>'
  },
  'pdf2img': {
    title: 'PDF TO IMAGE',
    pastel: 'bg-orange-100 text-orange-700 border-orange-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>'
  },
  'watermark': {
    title: 'WATERMARK PDF',
    pastel: 'bg-teal-100 text-teal-700 border-teal-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21a4 4 0 01-4-4 7 7 0 0110-6.24V11a7 7 0 0110 6.24 4 4 0 01-4 4H7z"/></svg>'
  },
  'redact': {
    title: 'HIDE CONTENT (REDACT)',
    pastel: 'bg-pink-100 text-pink-700 border-pink-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>'
  },
  'page-numbers': {
    title: 'ADD PAGE NUMBERS',
    pastel: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    svg: '<span class="font-mono text-xs font-black">#1</span>'
  },
  'n-up': {
    title: 'MULTI-PAGE PER SHEET (N-UP)',
    pastel: 'bg-lime-100 text-lime-800 border-lime-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/></svg>'
  },
  'split': {
    title: 'SPLIT PDF',
    pastel: 'bg-rose-100 text-rose-700 border-rose-300',
    svg: '<svg class="w-4 h-4 stroke-current" fill="none" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"/></svg>'
  }
};

Object.entries(TOOL_CARD_ICONS).forEach(([toolKey, item]) => {
  const targetHeading = `<h2 class="text-lg font-bold">${item.title}</h2>`;
  const replacementWithIcon = `<div class="flex items-center gap-2.5">
              <span class="w-8 h-8 rounded-sm ${item.pastel} flex items-center justify-center border flex-shrink-0">
                ${item.svg}
              </span>
              <h2 class="text-lg font-bold">${item.title}</h2>
            </div>`;
  indexHtml = indexHtml.replace(targetHeading, replacementWithIcon);
});

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log('[PASTEL] Updated index.html with pastel icon badges');

// 2. Process all 12 tool HTML files
TOOL_FILES.forEach(file => {
  const filePath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Dropzone icon with pastel sky accent
  content = content.replace(
    /<div class="border border-black p-3 bg-white">\s*<svg class="w-8 h-8 stroke-current"/g,
    '<div class="border border-black p-3 bg-sky-50 text-sky-600">\n          <svg class="w-8 h-8 stroke-current"'
  );

  // Rename label pencil icon: pastel amber
  content = content.replace(
    /<span>✏️<\/span>/g,
    '<span class="w-4 h-4 rounded-xs bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] flex-shrink-0">✏️</span>'
  );

  // Preview document eye icon: pastel sky
  content = content.replace(
    /<span>👁<\/span>/g,
    '<span class="text-sky-500">👁</span>'
  );

  // Scissor icon in split tool: pastel rose
  content = content.replace(
    /<span>✂<\/span>/g,
    '<span class="text-rose-500">✂</span>'
  );

  // Rotate icons in merge.html
  content = content.replace(/>\s*↶\s*</g, '><span class="text-indigo-500">↶</span><');
  content = content.replace(/>\s*↷\s*</g, '><span class="text-indigo-500">↷</span><');
  content = content.replace(/>\s*🗑\s*</g, '><span class="text-rose-500">🗑</span><');

  // Rotate icons in rotate.html
  content = content.replace(/\[ ↻ \+90° \]/g, '[ <span class="text-purple-600">↻</span> +90° ]');
  content = content.replace(/\[ ↺ -90° \]/g, '[ <span class="text-purple-600">↺</span> -90° ]');
  content = content.replace(/\[ 180° \]/g, '[ <span class="text-indigo-600">↷</span> 180° ]');

  // Modal download button icon: pastel emerald
  content = content.replace(
    /<span>💾<\/span>\s*<span>Download PDF<\/span>/g,
    '<span class="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs flex-shrink-0">💾</span>\n            <span>Download PDF</span>'
  );
  content = content.replace(
    /<span>💾<\/span>\s*<span>DOWNLOAD FILE<\/span>/g,
    '<span class="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs flex-shrink-0">💾</span>\n                  <span>DOWNLOAD FILE</span>'
  );

  // Modal Do More button icon: pastel amber
  content = content.replace(
    /<span>⚡<\/span>\s*<span>Do More →<\/span>/g,
    '<span class="w-5 h-5 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-xs flex-shrink-0">⚡</span>\n            <span>Do More →</span>'
  );
  content = content.replace(
    /<span>⚡<\/span>\s*<span>DO MORE →<\/span>/g,
    '<span class="w-5 h-5 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-xs flex-shrink-0">⚡</span>\n                  <span>DO MORE →</span>'
  );

  // Modal print icon: pastel purple
  content = content.replace(
    /<span>🖨<\/span>\s*<span>Print PDF<\/span>/g,
    '<span class="text-purple-500">🖨</span>\n            <span>Print PDF</span>'
  );

  // Do More tool tiles pastel accents
  const DO_MORE_TILES = [
    { from: '<span class="text-xl">🔢</span>', to: '<span class="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm border border-indigo-200 flex-shrink-0">🔢</span>' },
    { from: '<span class="text-xl">💧</span>', to: '<span class="w-7 h-7 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-sm border border-teal-200 flex-shrink-0">💧</span>' },
    { from: '<span class="text-xl">🔄</span>', to: '<span class="w-7 h-7 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-sm border border-purple-200 flex-shrink-0">🔄</span>' },
    { from: '<span class="text-xl">📐</span>', to: '<span class="w-7 h-7 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-sm border border-amber-200 flex-shrink-0">📐</span>' },
    { from: '<span class="text-xl">✂️</span>', to: '<span class="w-7 h-7 rounded bg-rose-100 text-rose-700 flex items-center justify-center text-sm border border-rose-200 flex-shrink-0">✂️</span>' },
    { from: '<span class="text-xl">⬛</span>', to: '<span class="w-7 h-7 rounded bg-pink-100 text-pink-700 flex items-center justify-center text-sm border border-pink-200 flex-shrink-0">⬛</span>' },
    { from: '<span class="text-xl">➕</span>', to: '<span class="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm border border-emerald-200 flex-shrink-0">➕</span>' },
    { from: '<span class="text-xl">🗑️</span>', to: '<span class="w-7 h-7 rounded bg-rose-100 text-rose-700 flex items-center justify-center text-sm border border-rose-200 flex-shrink-0">🗑️</span>' },
    { from: '<span class="text-xl">📑</span>', to: '<span class="w-7 h-7 rounded bg-lime-100 text-lime-800 flex items-center justify-center text-sm border border-lime-200 flex-shrink-0">📑</span>' },
    { from: '<span class="text-xl">🖼️</span>', to: '<span class="w-7 h-7 rounded bg-orange-100 text-orange-700 flex items-center justify-center text-sm border border-orange-200 flex-shrink-0">🖼️</span>' },
    { from: '<span class="text-xl">🔀</span>', to: '<span class="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-sm border border-blue-200 flex-shrink-0">🔀</span>' }
  ];

  DO_MORE_TILES.forEach(tile => {
    content = content.replace(tile.from, tile.to);
  });

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`[PASTEL] ${file}`);
});

// 3. Update js/app.js ensureDoMoreUI dynamic modal template
const appJsPath = path.join(__dirname, '..', 'js', 'app.js');
let appJs = fs.readFileSync(appJsPath, 'utf8');

appJs = appJs.replace(
  /<span>💾<\/span>\s*<span>DOWNLOAD FILE<\/span>/g,
  '<span class="w-5 h-5 rounded bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs flex-shrink-0">💾</span>\n                  <span>DOWNLOAD FILE</span>'
);
appJs = appJs.replace(
  /<span>⚡<\/span>\s*<span>DO MORE →<\/span>/g,
  '<span class="w-5 h-5 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-xs flex-shrink-0">⚡</span>\n                  <span>DO MORE →</span>'
);
appJs = appJs.replace(
  /<span>✏️<\/span>/g,
  '<span class="w-4 h-4 rounded-xs bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] flex-shrink-0">✏️</span>'
);

const JS_TILES = [
  { from: '<span class="text-lg">🔢</span>', to: '<span class="w-7 h-7 rounded bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm border border-indigo-200 flex-shrink-0">🔢</span>' },
  { from: '<span class="text-lg">💧</span>', to: '<span class="w-7 h-7 rounded bg-teal-100 text-teal-700 flex items-center justify-center text-sm border border-teal-200 flex-shrink-0">💧</span>' },
  { from: '<span class="text-lg">🔄</span>', to: '<span class="w-7 h-7 rounded bg-purple-100 text-purple-700 flex items-center justify-center text-sm border border-purple-200 flex-shrink-0">🔄</span>' },
  { from: '<span class="text-lg">📐</span>', to: '<span class="w-7 h-7 rounded bg-amber-100 text-amber-800 flex items-center justify-center text-sm border border-amber-200 flex-shrink-0">📐</span>' },
  { from: '<span class="text-lg">✂️</span>', to: '<span class="w-7 h-7 rounded bg-rose-100 text-rose-700 flex items-center justify-center text-sm border border-rose-200 flex-shrink-0">✂️</span>' },
  { from: '<span class="text-lg">⬛</span>', to: '<span class="w-7 h-7 rounded bg-pink-100 text-pink-700 flex items-center justify-center text-sm border border-pink-200 flex-shrink-0">⬛</span>' },
  { from: '<span class="text-lg">➕</span>', to: '<span class="w-7 h-7 rounded bg-emerald-100 text-emerald-700 flex items-center justify-center text-sm border border-emerald-200 flex-shrink-0">➕</span>' },
  { from: '<span class="text-lg">🗑️</span>', to: '<span class="w-7 h-7 rounded bg-rose-100 text-rose-700 flex items-center justify-center text-sm border border-rose-200 flex-shrink-0">🗑️</span>' },
  { from: '<span class="text-lg">📑</span>', to: '<span class="w-7 h-7 rounded bg-lime-100 text-lime-800 flex items-center justify-center text-sm border border-lime-200 flex-shrink-0">📑</span>' },
  { from: '<span class="text-lg">🖼️</span>', to: '<span class="w-7 h-7 rounded bg-orange-100 text-orange-700 flex items-center justify-center text-sm border border-orange-200 flex-shrink-0">🖼️</span>' },
  { from: '<span class="text-lg">🔀</span>', to: '<span class="w-7 h-7 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-sm border border-blue-200 flex-shrink-0">🔀</span>' }
];
JS_TILES.forEach(tile => {
  appJs = appJs.replace(tile.from, tile.to);
});

fs.writeFileSync(appJsPath, appJs, 'utf8');
console.log('[PASTEL] Updated js/app.js ensureDoMoreUI with pastel icon accents');

console.log('--- Finished Applying Pastel Icon Accents ---');
