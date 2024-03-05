#!/usr/bin/env node

const { program } = require('commander');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { Spectral } = require('@stoplight/spectral-core');
const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
const { fetch } = require('@stoplight/spectral-runtime');

program
  .version('1.0.0')
  .description('A CLI tool to validate APIs using Spectral');

program
  .command('validate <file>')
  .description('Validate the API using Spectral')
  .action((file) => {
    try {
      // Check if the file exists
      if (!fs.existsSync(file)) {
        console.error('Error: File not found');
        return;
      }

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
    }
  });

async function validateApi(apiFile) {
  const spectral = new Spectral();
  const rulesetPath = path.join(__dirname, '.spectral.yaml');

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

program.parse(process.argv);