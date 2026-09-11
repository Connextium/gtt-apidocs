#!/usr/bin/env node

/**
 * Static Build Generator for GTT Business Client API Docs
 * Generates a standalone static distribution in dist/ ready for check-in and deployment.
 */

const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { fetchSpec, SPEC_URL, OUTPUT_FILE: LOCAL_SPEC_FILE, OUTPUT_YAML_FILE: LOCAL_YAML_FILE, API_BASE_URL } = require('./fetch-spec');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

async function build() {
  console.log('\x1b[36m[Build]\x1b[0m Starting static bundle generation...');

  // 1. Ensure OpenAPI spec is up to date or read local
  let spec;
  try {
    console.log(`\x1b[36m[Build]\x1b[0m Checking/fetching latest spec from ${SPEC_URL}...`);
    spec = await fetchSpec(SPEC_URL);
  } catch (err) {
    console.warn(`\x1b[33m[Warning]\x1b[0m Could not fetch live spec (${err.message}). Using local cached spec...`);
    if (fs.existsSync(LOCAL_SPEC_FILE)) {
      spec = JSON.parse(fs.readFileSync(LOCAL_SPEC_FILE, 'utf8'));
    } else {
      console.error('\x1b[31m[Error]\x1b[0m No cached spec found at openapi/business-client.json. Cannot build.');
      process.exit(1);
    }
  }

  // 2. Prepare dist directory
  if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(DIST_DIR, { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'openapi'), { recursive: true });
  fs.mkdirSync(path.join(DIST_DIR, 'src'), { recursive: true });

  // 3. Copy spec JSON and YAML to dist/openapi/
  fs.writeFileSync(
    path.join(DIST_DIR, 'openapi', 'business-client.json'),
    JSON.stringify(spec, null, 2),
    'utf8'
  );

  const yamlString = YAML.stringify(spec);
  fs.writeFileSync(
    path.join(DIST_DIR, 'openapi', 'business-client.yaml'),
    yamlString,
    'utf8'
  );

  // 4. Read source files
  const htmlContent = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8');
  const cssContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'styles.css'), 'utf8');
  const jsContent = fs.readFileSync(path.join(ROOT_DIR, 'src', 'app.js'), 'utf8');

  // Copy CSS and JS to dist/src for modular assets (inject configured API_BASE_URL if customized)
  const processedJs = API_BASE_URL !== 'https://gtt-api.connextium.xyz'
    ? jsContent.replace('https://gtt-api.connextium.xyz', API_BASE_URL)
    : jsContent;
  fs.writeFileSync(path.join(DIST_DIR, 'src', 'styles.css'), cssContent, 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'src', 'app.js'), processedJs, 'utf8');

  // 5. Create Standalone Inlined HTML (Option 2 deployable static file)
  // Embed the spec directly into window.__GTT_BUNDLED_SPEC__ for instant zero-fetch loading
  const embeddedScript = `<script>window.__GTT_BUNDLED_SPEC__ = ${JSON.stringify(spec)};</script>`;
  
  let standaloneHtml = htmlContent.replace(
    '</head>',
    `  ${embeddedScript}\n</head>`
  );

  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), standaloneHtml, 'utf8');

  // 6. Generate summary stats
  const distHtmlSize = (fs.statSync(path.join(DIST_DIR, 'index.html')).size / 1024).toFixed(2);
  const specJsonSize = (fs.statSync(path.join(DIST_DIR, 'openapi', 'business-client.json')).size / 1024).toFixed(2);
  const specYamlSize = (fs.statSync(path.join(DIST_DIR, 'openapi', 'business-client.yaml')).size / 1024).toFixed(2);

  console.log('\x1b[32m✔ Static build completed successfully!\x1b[0m');
  console.log(`  - Output directory: \x1b[34mdist/\x1b[0m`);
  console.log(`  - Standalone HTML:  \x1b[34mdist/index.html\x1b[0m (${distHtmlSize} KB, pre-bundled spec)`);
  console.log(`  - Static JSON Spec: \x1b[34mdist/openapi/business-client.json\x1b[0m (${specJsonSize} KB)`);
  console.log(`  - Static YAML Spec: \x1b[34mdist/openapi/business-client.yaml\x1b[0m (${specYamlSize} KB)`);
  console.log(`  - API Title:        \x1b[1m${spec.info?.title}\x1b[0m`);
  console.log(`  - Version:          ${spec.info?.version}`);
  console.log(`  - Paths count:      ${Object.keys(spec.paths || {}).length}`);
  console.log('\nYou can now commit `dist/` or deploy `dist/` directly to GitHub Pages, Vercel, Netlify, or S3.');
}

if (require.main === module) {
  build();
}

module.exports = { build };
