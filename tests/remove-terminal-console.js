const fs = require('fs');
const path = require('path');

const files = [
  'watermark.html', 'split.html', 'rotate.html', 'resize.html',
  'remove-pages.html', 'redact.html', 'pdf-to-image.html', 'page-numbers.html',
  'n-up.html', 'merge.html', 'image-to-pdf.html', 'add-pages.html'
];

let allMatched = true;

files.forEach(f => {
  const p = path.join(__dirname, '..', f);
  const content = fs.readFileSync(p, 'utf8');
  
  // Pattern matching:
  // <!-- TERMINAL CONSOLE -->
  // <div class="mt-8 border border-black">
  // ...
  // </div>
  const regex = /\s*<!-- TERMINAL CONSOLE -->\s*<div class="mt-8 border border-black">\s*<div class="bg-black text-white px-3 py-1\.5 text-xs font-bold flex items-center justify-between">\s*<span>\/\/ TERMINAL LOGS<\/span>\s*<span class="text-\[10px\] text-neutral-400">STATUS: ACTIVE<\/span>\s*<\/div>\s*<div id="terminalConsole" class="term-console">\s*<div id="consoleLines"><\/div>\s*<\/div>\s*<\/div>/g;

  if (regex.test(content)) {
    console.log(`[MATCH] ${f}`);
  } else {
    console.log(`[NO MATCH] ${f}`);
    allMatched = false;
  }
});

if (allMatched) {
  console.log('\nAll 12 files matched regex pattern perfectly! Proceeding with removal...');
  files.forEach(f => {
    const p = path.join(__dirname, '..', f);
    let content = fs.readFileSync(p, 'utf8');
    const regex = /\s*<!-- TERMINAL CONSOLE -->\s*<div class="mt-8 border border-black">\s*<div class="bg-black text-white px-3 py-1\.5 text-xs font-bold flex items-center justify-between">\s*<span>\/\/ TERMINAL LOGS<\/span>\s*<span class="text-\[10px\] text-neutral-400">STATUS: ACTIVE<\/span>\s*<\/div>\s*<div id="terminalConsole" class="term-console">\s*<div id="consoleLines"><\/div>\s*<\/div>\s*<\/div>/g;
    content = content.replace(regex, '');
    fs.writeFileSync(p, content, 'utf8');
    console.log(`[REMOVED] ${f}`);
  });
} else {
  console.error('\nAborting: not all files matched.');
  process.exit(1);
}
