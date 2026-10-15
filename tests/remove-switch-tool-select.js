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
  const regex = /\s*<select onchange="if\(this\.value\) window\.location\.href=this\.value" class="term-select text-xs py-1\.5 px-2" aria-label="Switch tool">[\s\S]*?<\/select>/;

  if (regex.test(content)) {
    console.log(`[MATCH] ${f}`);
  } else {
    console.log(`[NO MATCH] ${f}`);
    allMatched = false;
  }
});

if (allMatched) {
  console.log('\nAll 12 files matched regex! Proceeding with removing the tool switch dropdown...');
  files.forEach(f => {
    const p = path.join(__dirname, '..', f);
    let content = fs.readFileSync(p, 'utf8');
    const regex = /\s*<select onchange="if\(this\.value\) window\.location\.href=this\.value" class="term-select text-xs py-1\.5 px-2" aria-label="Switch tool">[\s\S]*?<\/select>/;
    content = content.replace(regex, '');
    fs.writeFileSync(p, content, 'utf8');
    console.log(`[REMOVED SELECT] ${f}`);
  });
} else {
  console.error('\nAborting: not all files matched.');
  process.exit(1);
}
