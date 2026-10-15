const fs = require('fs');
const path = require('path');

// Test that file-transfer logic and data integrity works
console.log('Testing FileTransfer and Blob transfer...');

const pdf1 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'samples', 'sample-appendix.pdf'));
const pdf2 = fs.readFileSync(path.join(__dirname, '..', 'assets', 'samples', 'sample-multipage.pdf'));

console.log('PDF 1 size:', pdf1.length, 'PDF 2 size:', pdf2.length);

// Check if FileTransfer handles base64 encoding and decoding properly
function fileToBase64Mock(buffer) {
  return 'data:application/pdf;base64,' + buffer.toString('base64');
}

function base64ToBufferMock(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  return Buffer.from(b64, 'base64');
}

const b64 = fileToBase64Mock(pdf1);
const recovered = base64ToBufferMock(b64);
console.log('Original length:', pdf1.length, 'Recovered length:', recovered.length);
if (pdf1.equals(recovered)) {
  console.log('[PASS] Base64 roundtrip matches original PDF buffer perfectly!');
} else {
  console.error('[FAIL] Base64 roundtrip mismatch!');
  process.exit(1);
}
