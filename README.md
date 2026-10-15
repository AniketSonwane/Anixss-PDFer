# Anixss-PDFer — Free Browser-Based PDF Toolkit

```text
================================================================================
  [Anixss-PDFer] // PDF TOOLS. ZERO UPLOADS.
  Client-side, privacy-first, monochrome terminal-style PDF toolkit.
  Processed 100% locally in your browser with WebAssembly & Canvas.
================================================================================
```

Anixss-PDFer is a fast, lightweight, and completely frontend-only PDF utility website. It provides essential PDF editing, merging, resizing, rotating, and conversion tools inspired by the utility of Smallpdf, but built with a minimal, high-contrast, developer-inspired monochrome aesthetic.

---

## Key Highlights & Guarantees

- **Zero Backend**: Runs entirely in the browser using HTML5, Tailwind CSS, and Vanilla JavaScript.
- **Absolute Privacy**: Document bytes never leave your machine. No server-side processing, no cloud storage, no telemetry, and no third-party APIs.
- **Offline Capable**: Bundled with local vendor scripts (`pdf-lib`, `PDF.js`, `JSZip`) in `assets/vendor/`.
- **Fast & Precise**: Proportional scaling, exact page insertion, and high-DPI image rasterization up to 216 DPI.

---

## Features Matrix

| Module | Identifier | Description | Core Engine |
| :--- | :--- | :--- | :--- |
| **Merge PDF** | `TOOL // 01` | Combine multiple PDF files with visual page previews (like Remove Pages), custom order controls, and blank page separator insertion. | `pdf-lib` + `PDF.js` |
| **Remove Pages** | `TOOL // 02` | Visual page thumbnail grid with single-click delete and page range syntax (e.g. `2-4, 7`). | `pdf-lib` + `PDF.js` |
| **Add Pages** | `TOOL // 03` | Insert blank pages (custom/A4/Letter) or extract and inject pages from another PDF at any location. | `pdf-lib` |
| **Resize PDF** | `TOOL // 04` | Change page dimensions to A4, A3, A5, Letter, Legal, or Custom pt with proportional fit & center. | `pdf-lib` |
| **Rotate PDF** | `TOOL // 05` | Rotate all pages or specific pages by 90°, 180°, or 270° with visual previews and bulk filters. | `pdf-lib` + `PDF.js` |
| **Image to PDF** | `TOOL // 06` | Compile multiple JPG, PNG, and WebP images into a standardized PDF with margin and fit options. | `pdf-lib` + Canvas |
| **PDF to Image** | `TOOL // 07` | Render PDF pages into crisp PNG or JPEG images (up to 3x 216 DPI) with single and ZIP downloads. | `PDF.js` + `JSZip` |
| **Watermark PDF** | `TOOL // 08` | Add customizable text or image watermarks with live preview, rotation angle, opacity, corner positions, and repeat tiling. | `pdf-lib` + `PDF.js` |
| **Hide Content (Redact)** | `TOOL // 09` | Draw interactive blackout or whiteout hiding boxes directly on PDF page canvases to permanently redact confidential data. | `pdf-lib` + `PDF.js` |
| **Add Page Numbers** | `TOOL // 10` | Insert formatted page numbers ("Page {n} of {total}"), position matrix, margins, duplex alternating margins, and cover skip. | `pdf-lib` + `PDF.js` |
| **Multi-Page per Sheet (N-Up)** | `TOOL // 11` | Combine 2, 4, 6, 9, or 16 pages onto 1 single page sheet with auto orientation, custom paper sizes, and hairline borders. | `pdf-lib` + `PDF.js` |
| **Download & Print** | System | Instant local file saving and native browser print dialog integration. | Native Web APIs |

---

## Project Structure

```text
Anixss-PDFer/
├── index.html                  # Master application entrypoint & tool directory
├── merge.html                  # Dedicated Tool: Merge PDF (with visual previews & separators)
├── remove-pages.html           # Dedicated Tool: Remove Pages (with interactive thumbnail grid)
├── add-pages.html              # Dedicated Tool: Add Pages (blank pages or external PDF injection)
├── resize.html                 # Dedicated Tool: Resize PDF (standard & custom paper sizing)
├── rotate.html                 # Dedicated Tool: Rotate PDF (90°/180°/270° with visual cards)
├── image-to-pdf.html           # Dedicated Tool: Image to PDF (JPG, PNG, WebP compiler)
├── pdf-to-image.html           # Dedicated Tool: PDF to Image (high-DPI renderer & ZIP bundler)
├── watermark.html              # Dedicated Tool: Watermark PDF (text/image, rotation, tiling)
├── redact.html                 # Dedicated Tool: Hide Content / Redact (interactive box drawing)
├── page-numbers.html           # Dedicated Tool: Add Page Numbers (custom formats, position matrix)
├── n-up.html                   # Dedicated Tool: Multiple Pages per Sheet (2/4/6/9/16-in-1 N-Up)
├── about.html                  # Technical specifications, privacy guarantees, & architecture
├── src/
│   ├── input.css               # Tailwind CSS source rules & terminal styling
│   └── output.css              # Monochromatic design system & utility classes
├── js/
│   ├── app.js                  # Main UI controller, event listeners, & terminal console
│   ├── file-transfer.js        # Client-side IndexedDB file queue for cross-page transfers
│   ├── pdf-preview.js          # PDF.js worker setup, high-res canvas rendering, & thumbnails
│   ├── pdf-tools.js            # pdf-lib operations (merge, remove, add, resize, rotate, watermark, redact, page numbers, N-up)
│   └── converters.js           # Image to PDF, PDF to Image rasterizer, ZIP export, & helpers
├── assets/
│   ├── vendor/                 # Pre-bundled offline vendor libraries
│   │   ├── pdf-lib.min.js      # pdf-lib v1.17.1
│   │   ├── pdf.min.js          # PDF.js v3.11.174
│   │   ├── pdf.worker.min.js   # PDF.js web worker
│   │   └── jszip.min.js        # JSZip v3.10.1
│   └── samples/                # Sample test documents and images
│       ├── sample-multipage.pdf# 3-page test PDF
│       ├── sample-appendix.pdf # 2-page test PDF
│       └── sample-image.png    # Test PNG image
├── tests/
│   ├── test-engine.js          # Automated Node.js test suite for core operations
│   ├── test-new-tools.js       # Unit tests for watermark, redact, page numbers, & N-up
│   ├── test-pages-dom.js       # Integration test for HTML element IDs and app.js
│   ├── test-merge-sync.js      # Unit tests for merge file/page sync & blank pages
│   └── test-merge-layout.js    # Unit tests for layout toggles and reordering
└── README.md                   # Documentation, setup guide, & technical reference
```

---

## How to Run Locally on Windows

Anixss-PDFer requires no build step or package installations to run. You can run it with any static web server:

### Method 1: Using Python (Recommended)

Python is pre-installed on most developer workstations.

1. Open PowerShell or Command Prompt in the project folder:
   ```powershell
   cd "a:\My Data\VS Code\Personal Projects\Anixss-PDFer\V1"
   ```
2. Start Python's built-in HTTP server:
   ```powershell
   python -m http.server 8000
   ```
3. Open your browser and navigate to:
   ```text
   http://localhost:8000
   ```

### Method 2: Using VS Code Live Server Extension

1. Open the project folder in VS Code.
2. Install the **Live Server** extension (by Ritwick Dey) if not already installed.
3. Right-click [`index.html`](file:///a:/My%20Data/VS%20Code/Personal%20Projects/Anixss-PDFer/V1/index.html) in the Explorer sidebar.
4. Click **"Open with Live Server"**.
5. Your default browser will automatically open `http://127.0.0.1:5500/index.html`.

### Method 3: Using Node.js (npx)

If you have Node.js installed on Windows:

```powershell
npx.cmd serve .
```
or
```powershell
npx.cmd http-server -p 8080
```

> **Note on Double-Clicking (`file:///`)**:
> Modern browsers enforce security restrictions on Web Workers loading from `file:///` URLs (CORS policy on local files). While basic UI works, thumbnail rendering via PDF.js worker requires an HTTP server (such as Python `http.server` or VS Code Live Server).

---

## Testing Each Tool (Step-by-Step)

Pre-generated test files are included in [`assets/samples/`](file:///a:/My%20Data/VS%20Code/Personal%20Projects/Anixss-PDFer/V1/assets/samples/):

### 1. Automated Engine Test
Run the automated test suite directly from your terminal:
```powershell
node tests/test-engine.js
```
*Expected result:* 14 automated unit tests verify merging, removing, adding, resizing, rotating, range parsing, and ZIP generation.

### 2. Manual UI Verification Checklist

- **Merge PDF (`TOOL // 01`)**:
  1. Click **Merge PDF** card.
  2. Drop `assets/samples/sample-multipage.pdf` (3 pages) and `assets/samples/sample-appendix.pdf` (2 pages).
  3. Observe the live **Page Previews Grid** rendering every page card across both documents (just like Remove Pages!).
  4. Toggle `[+] INSERT BLANK PAGE BETWEEN EACH PDF`. Notice the visual blank separator page card appears between Doc 1 and Doc 2, updating total output to 6 pages.
  5. Reorder files using `[↑]` / `[↓]` chips in the sequence bar and watch the preview grid update instantly.
  6. Click `[ MERGE AND GENERATE PDF ]` to download the merged document.

- **Remove Pages (`TOOL // 02`)**:
  1. Click **Remove Pages** card.
  2. Select `assets/samples/sample-multipage.pdf` (3 pages).
  3. Enter `2` in the page range input or click the Page 2 thumbnail card.
  4. Notice the thumbnail shows `[DELETE]` overlay.
  5. Click `[ REMOVE SELECTED PAGES & SAVE ]`.
  6. Download result and confirm the output has 2 pages (Pages 1 & 3).

- **Add Pages (`TOOL // 03`)**:
  1. Select `assets/samples/sample-multipage.pdf`.
  2. Under Mode 1, choose **Add 1 Blank Page** `At End`. Click `[ INSERT PAGES & GENERATE PDF ]`.
  3. Verify the generated PDF has 4 pages.
  4. Under Mode 2, select `assets/samples/sample-appendix.pdf` as secondary PDF, specify `1` for secondary page range, and insert `At Beginning`.
  5. Verify the generated PDF places the appendix page at the start.

- **Resize PDF (`TOOL // 04`)**:
  1. Upload `assets/samples/sample-multipage.pdf`.
  2. Select **US Letter**, **Landscape**, and **Proportional Scale**.
  3. Click `[ RESIZE PDF & DOWNLOAD ]`.
  4. Open in any PDF viewer and inspect page properties: 792 × 612 pt.

- **Rotate PDF (`TOOL // 05`)**:
  1. Upload `assets/samples/sample-multipage.pdf`.
  2. Click `[ ↻ +90° ]` on Page 1's thumbnail. Observe the live rotated canvas preview and `[90°]` badge.
  3. Test bulk button `[ 180° FLIP ]` for All Pages.
  4. Click `[ SAVE ROTATED PDF ]` to download.

- **Image to PDF (`TOOL // 06`)**:
  1. Click **Image to PDF** card.
  2. Select `assets/samples/sample-image.png`.
  3. Choose page size preset `A4` and margin `15 pt`.
  4. Click `[ COMPILE IMAGES TO PDF ]`.
  5. Download and verify the image is cleanly centered on the page.

- **PDF to Image (`TOOL // 07`)**:
  1. Upload `assets/samples/sample-multipage.pdf`.
  2. Select **PNG**, **2.0x (144 DPI)**, and **All Pages**.
  3. Click `[ RENDER PDF PAGES TO IMAGES ]`.
  4. Observe rendered page cards appearing in real-time.
  5. Click `[ DOWNLOAD ALL AS ZIP ]` to export `sample-multipage_images.zip`.

- **Print PDF**:
  1. After generating any PDF, click `[ PRINT PDF ]` in the result modal.
  2. The browser's native print dialog will open automatically.

---

## Deploying Free to GitHub Pages

Because Anixss-PDFer is a 100% static project, it can be hosted on GitHub Pages for free in under two minutes:

1. **Initialize Git & Commit**:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit of Anixss-PDFer"
   ```
2. **Push to GitHub**:
   Create a new public repository on GitHub (e.g. `anixss-pdfer`), then link and push:
   ```powershell
   git remote add origin https://github.com/<YOUR_USERNAME>/anixss-pdfer.git
   git branch -M main
   git push -u origin main
   ```
3. **Enable GitHub Pages**:
   - Go to your repository settings on GitHub: **Settings** -> **Pages**.
   - Under **Build and deployment** -> **Source**, select `Deploy from a branch`.
   - Under **Branch**, select `main` and folder `/(root)`.
   - Click **Save**.
4. In about 30 seconds, your site will be live at:
   ```text
   https://<YOUR_USERNAME>.github.io/anixss-pdfer/
   ```

---

## Known Browser Limitations & Solutions

1. **Memory Ceiling for Very Large Files**:
   - Client-side browsers allocate a limited heap to JavaScript (typically 1.5GB to 4GB depending on 32-bit vs 64-bit browsers and OS RAM).
   - If attempting to merge 500+ MB PDFs at once, browser memory may saturate.
   - *Solution:* Anixss-PDFer cleans up temporary object URLs via `URL.revokeObjectURL()` and processes documents incrementally. For general documents (1MB - 100MB), performance is near-instant.

2. **Web Worker CORS Policy on `file:///`**:
   - If you double-click `index.html` directly from Windows Explorer, Chromium and Firefox may restrict loading `./assets/vendor/pdf.worker.min.js` due to strict local file origin isolation.
   - *Solution:* Serve using a local server (`python -m http.server` or VS Code Live Server) or deploy to GitHub Pages.

3. **Mobile Browser Print Dialogs**:
   - Certain mobile browsers (such as mobile Safari or Chrome for Android) block `iframe.contentWindow.print()` triggers.
   - *Solution:* Anixss-PDFer includes a fallback that opens the PDF in a new tab if iframe printing is blocked, allowing users to tap the native mobile share/print sheet.

---

## License

MIT License. Free for personal, commercial, and educational use.
Designed with precision for developers who value speed, privacy, and minimalism.
