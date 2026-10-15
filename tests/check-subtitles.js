const fs = require('fs');
const path = require('path');

const files = [
  'merge.html', 'remove-pages.html', 'add-pages.html', 'resize.html',
  'rotate.html', 'image-to-pdf.html', 'pdf-to-image.html', 'watermark.html',
  'redact.html', 'page-numbers.html', 'n-up.html', 'split.html'
];

files.forEach(f => {
  const p = path.join(__dirname, '..', f);
  const content = fs.readFileSync(p, 'utf8');
  const match = content.match(/<h1[^>]*>[\s\S]*?<\/h1>\s*(<div class="text-xs text-neutral-600[^"]*">[\s\S]*?<\/div>)/);
  if (match) {
    console.log(`[FOUND in ${f}]:\n${match[1].trim()}\n`);
  } else {
    console.log(`[NOT FOUND in ${f}]`);
  }
});
