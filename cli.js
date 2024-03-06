#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { Spectral } = require('@stoplight/spectral-core');
const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
const { fetch } = require('@stoplight/spectral-runtime');
const https = require('https');

program
  .version('1.0.0')
  .requiredOption('-t, --token <type>', 'Bearer token')
  .command('validate')

program.parse(process.argv); // Parse the command line arguments

const userOptions = program.opts();

async function getApiDetails(token) {
  return new Promise((resolve, reject) => {
    const listAPI = {
      hostname: '127.0.0.1',
      port: 9443,
      path: 'https://127.0.0.1:9443/api/am/publisher/v4/apis',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      rejectUnauthorized: false // -k option
    };

    let apis = {};

    const getApis = https.request(listAPI, response => {
      let data = '';
      response.on('data', chunk => {
        data += chunk;
      });
      response.on('end', () => {
        const apiList = JSON.parse(data);
        apis = apiList.list.map(api => ({
          id: api.id,
          name: api.name,
          version: api.version,
          provider: api.provider
        }));
        resolve(apis);
      });
    });
    getApis.on('error', error => {
      console.error('Error:', error);
    });

    getApis.end();
  });
}

async function exportApis(apiDetails, token) {
  return new Promise((resolve, reject) => {
    const exportAPI = {
      hostname: '127.0.0.1',
      port: 9443,
      path: `/api/am/publisher/v4/apis/export?apiId=${apiDetails[1].id}&name=${apiDetails[1].name}&version=${apiDetails[1].version}&provider=${apiDetails[1].provider}&format=YAML`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      rejectUnauthorized: false // -k option
    };

    const exportApi = https.request(exportAPI, response => {
      const exportDir = path.join(__dirname, 'exports');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir);
      }

      const filePath = path.join(exportDir, 'exportAPI.zip');
      const fileStream = fs.createWriteStream(filePath);
      response.pipe(fileStream);

      fileStream.on('finish', function () {
        fileStream.close();
      });
    });

    try {
      const file = path.join(__dirname, 'exports', 'exportAPI.zip');  

      // If the file is a zip archive, extract the api.yaml file
      if (path.extname(file) === '.zip') {
        const filePathInsideZip = './api.yaml';
        const zip = new AdmZip(file);
        const ExtractedAPIs = path.join(__dirname, 'ExtractedAPIs');
        zip.extractAllTo(ExtractedAPIs, true);
        const extractedFiles = fs.readdirSync(ExtractedAPIs);
        const apiExtractFolderName = extractedFiles.find(file => fs.statSync(path.join(ExtractedAPIs, file)).isDirectory());

        if (!apiExtractFolderName) {
          console.error('No dynamically created folder found.');
          process.exit(1);
        }
        const fileInsideZipPath = path.join(ExtractedAPIs, apiExtractFolderName, filePathInsideZip);
        validateApi(fileInsideZipPath);

      }
    } catch (err) {
      console.error('Error:', err);
    };

    exportApi.on('error', error => {
      console.error('Error:', error);
    });

    exportApi.end();

  });
}

async function validateApi(apiFile) {
  const spectral = new Spectral();
  const rulesetPath = path.join(__dirname, '.spectral.yaml');
  // Load and set the ruleset
  spectral.setRuleset(
    await bundleAndLoadRuleset(rulesetPath, { fs, fetch })
  );
  // Load and validate the API file
  const apiSpec = fs.readFileSync(path.resolve(apiFile), 'utf8');
  const results = await spectral.run(apiSpec);

  if (results.length === 0) {
    console.log('API validation successful');
  } else {
    console.error('API validation failed');
    results.forEach((result) => {
      console.error(`${result.code}: ${result.message} at ${result.path.join('.')}`);
    });
  }
}

async function main() {
  console.log("CLI tool to Validate APIs")
  const apiDetails = await getApiDetails(userOptions.token);
  // validateApi('/home/tharani/Downloads/spectral/api.yaml');
  await exportApis(apiDetails, userOptions.token);
}

main().catch(console.error);