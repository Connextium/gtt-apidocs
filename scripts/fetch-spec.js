#!/usr/bin/env node

/**
 * Script to fetch the latest OpenAPI specification for GTT Business Client API
 * and save it locally to openapi/business-client.json.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const SPEC_URL = process.env.OPENAPI_SPEC_URL || 'https://gtt-api.vercel.app/openapi/business-client.json';
const OUTPUT_DIR = path.resolve(__dirname, '../openapi');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'business-client.json');

function fetchSpec(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchSpec(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch spec. HTTP Status: ${res.statusCode} ${res.statusMessage}`));
      }

      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (err) {
          reject(new Error(`Invalid JSON received from ${url}: ${err.message}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function main() {
  console.log(`\x1b[36m[Fetch Spec]\x1b[0m Fetching OpenAPI spec from: ${SPEC_URL}...`);

  try {
    const spec = await fetchSpec(SPEC_URL);

    // Validate OpenAPI schema basics
    const openapiVersion = spec.openapi || spec.swagger;
    if (!openapiVersion) {
      throw new Error('Fetched document does not appear to be a valid OpenAPI/Swagger document (missing "openapi" or "swagger" field).');
    }

    const title = spec.info?.title || 'Unknown API';
    const version = spec.info?.version || 'Unknown Version';
    const pathCount = spec.paths ? Object.keys(spec.paths).length : 0;
    const tagCount = spec.tags ? spec.tags.length : 0;
    const schemaCount = spec.components?.schemas ? Object.keys(spec.components.schemas).length : 0;

    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Write formatted JSON
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(spec, null, 2), 'utf8');

    console.log(`\x1b[32m✔ Successfully fetched and saved OpenAPI spec!\x1b[0m`);
    console.log(`  - File: \x1b[34m${path.relative(process.cwd(), OUTPUT_FILE)}\x1b[0m`);
    console.log(`  - API Title: \x1b[1m${title}\x1b[0m (v${version})`);
    console.log(`  - OpenAPI Spec Version: ${openapiVersion}`);
    console.log(`  - Endpoints (paths): ${pathCount}`);
    console.log(`  - Tags: ${tagCount}`);
    console.log(`  - Component Schemas: ${schemaCount}`);

    return spec;
  } catch (error) {
    console.error(`\x1b[31m✖ Error fetching spec:\x1b[0m ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchSpec, SPEC_URL, OUTPUT_FILE };
