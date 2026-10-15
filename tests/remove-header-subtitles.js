const fs = require('fs');
const path = require('path');

const files = [
  'merge.html', 'remove-pages.html', 'add-pages.html', 'resize.html',
  'rotate.html', 'image-to-pdf.html', 'pdf-to-image.html', 'watermark.html',
  'redact.html', 'page-numbers.html', 'n-up.html', 'split.html'
];

let allMatched = true;

files.forEach(f => {
  const p = path.join(__dirname, '..', f);
  const content = fs.readFileSync(p, 'utf8');
  const regex = /\s*<div class="text-xs text-neutral-600 flex items-center gap-2">[\s\S]*?<\/div>/;

  if (regex.test(content)) {
    console.log(`[MATCH] ${f}`);
  } else {
    console.log(`[NO MATCH] ${f}`);
    allMatched = false;
  }
});

if (allMatched) {
  console.log('\nAll 12 files matched! Removing header subtitles...');
  files.forEach(f => {
    const p = path.join(__dirname, '..', f);
    let content = fs.readFileSync(p, 'utf8');
    const regex = /\s*<div class="text-xs text-neutral-600 flex items-center gap-2">[\s\S]*?<\/div>/;
    content = content.replace(regex, '');
    fs.writeFileSync(p, content, 'utf8');
    console.log(`[REMOVED SUBTITLE] ${f}`);
  });
} else {
  console.error('\nAborting: not all files matched.');
  process.exit(1);
}
