// Mock browser environment to test loading js/app.js without errors
const fs = require('fs');
const path = require('path');

const mockElement = (id = '') => ({
  id,
  classList: {
    add: () => {},
    remove: () => {},
    contains: () => false,
    toggle: () => {}
  },
  style: {},
  addEventListener: () => {},
  appendChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getContext: () => ({ fillRect: () => {}, drawImage: () => {} }),
  scrollIntoView: () => {}
});

global.window = {
  location: { href: '', reload: () => {} },
  scrollTo: () => {},
  addEventListener: () => {},
  FileTransfer: {
    setPendingFiles: async () => {},
    getPendingFiles: async () => null
  }
};
global.document = {
  readyState: 'complete',
  body: { dataset: { page: 'merge' } },
  getElementById: (id) => mockElement(id),
  querySelector: () => mockElement(),
  querySelectorAll: () => [],
  addEventListener: () => {},
  createElement: () => mockElement()
};
global.navigator = { userAgent: 'node' };
global.AppState = {};
global.Converters = {
  formatBytes: () => '1 KB',
  downloadBlob: () => {},
  printPdfBlob: () => {}
};
global.PdfPreview = {
  loadDocument: async () => ({ numPages: 1, getPage: async () => ({}) }),
  renderPageToCanvas: async () => {}
};
global.PdfTools = {};
global.PDFLib = { PDFDocument: {} };
global.pdfjsLib = {};

try {
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  eval(code);
  console.log('[PASS] js/app.js evaluated with zero syntax/runtime errors!');
  console.log('window.toggleDoMorePanel:', typeof global.window.toggleDoMorePanel);
  console.log('window.doMoreWithResult:', typeof global.window.doMoreWithResult);
  console.log('window.PdfApp:', typeof global.window.PdfApp);
} catch (err) {
  console.error('[FAIL] Runtime error when loading js/app.js:', err);
  process.exit(1);
}
