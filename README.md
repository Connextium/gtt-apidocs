# GTT Business Client API Documentation (Dual-Viewer)

A high-performance, responsive web application for exploring and testing the **Global Trade Treasury (GTT) Business Client API** with instant switching between **Scalar** and **Redoc**.

- **OpenAPI Source**: [https://gtt-api.connextium.xyz/openapi/business-client.json](https://gtt-api.connextium.xyz/openapi/business-client.json)
- **Supported Modes**:
  - **Option 1: Live Running Online** (fetches & parses upstream spec dynamically)
  - **Option 2: Batch Generation & Static Deployment** (pre-bundles standalone HTML for check-in and zero-dependency static hosting)

---

## ✨ Features

- 🔀 **Dual-Viewer Switcher**:
  - **Scalar**: Modern, interactive API client with request runner, multi-language code snippets (cURL, Python, JS, Go, etc.), and search.
  - **Redoc**: Clean 3-panel enterprise reference specification with detailed schemas and models.
- 🌓 **Synchronized Dark / Light Theme**: Matches system preference with manual toggle and localStorage persistence.
- 📦 **Dual Generation Architecture**:
  - **Live Mode**: Dynamic browser rendering with offline fallback.
  - **Static Mode**: Bundles the spec directly into `dist/index.html` for zero-latency, 100% reliable static hosting.
- 📥 **Quick Spec Tools**: 1-click OpenAPI JSON download, live URL copy, and endpoint counter.
- ⌨️ **Keyboard Shortcuts**:
  - `1`: Switch to **Scalar**
  - `2`: Switch to **Redoc**
  - `T`: Toggle **Dark / Light Theme**

---

## 🚀 Quick Start

### 1. Run Live Development Server (Option 1)
Start the local server to explore docs with live spec reloading:

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

### 2. Batch Build Static HTML for Check-in & Deployment (Option 2)
To generate the standalone static distribution in `dist/`:

```bash
npm run build
```

This will:
1. Fetch and validate the latest OpenAPI JSON from upstream.
2. Save a formatted copy to `openapi/business-client.json`.
3. Compile a self-contained `dist/index.html` with the embedded spec.

Preview the static distribution:
```bash
npm run preview
```

---

## 🛠 Project Structure

```text
gtt-apidocs/
├── index.html                     # Main dual-viewer web app template
├── package.json                   # Scripts and project metadata
├── README.md                      # Documentation
├── openapi/
│   └── business-client.json       # Cached / version-controlled OpenAPI 3.1.0 spec
├── src/
│   ├── app.js                     # Dual-engine controller (Scalar & Redoc)
│   └── styles.css                 # Custom theme & header layout
├── scripts/
│   ├── fetch-spec.js              # Upstream OpenAPI fetcher & validator
│   ├── build-static.js            # Standalone static distribution compiler
│   └── dev-server.js              # Zero-dependency local dev/preview server
└── .github/workflows/
    └── update-docs.yml            # Automated daily cron to sync spec & commit
```

---

## 🌐 Deployment Options

### Vercel / Netlify / Cloudflare Pages
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### GitHub Pages
Deploy the `dist/` directory or run the automated GitHub Action in `.github/workflows/update-docs.yml`.

---

## 📄 License
MIT © Connextium
