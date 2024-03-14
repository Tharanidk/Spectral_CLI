#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { Spectral } = require('@stoplight/spectral-core');
const { bundleAndLoadRuleset } = require('@stoplight/spectral-ruleset-bundler/with-loader');
const { fetch } = require('@stoplight/spectral-runtime');
const https = require('https');
const { timeStamp } = require('console');

program
  .version('1.0.0')
  .requiredOption('-t, --token <type>', 'Bearer token')
  .command('validate')
  .description('Validate APIs')
  .option('--api <apiNameAndVersion>', 'Validate a specific API by name and version')
  .option('--all', 'Validate all APIs', false) // default value for --all is false
  .action(async (options) => {
    if(options.api) {
      const [apiName, apiVersion] = options.api.split(':');
      if (!apiName || !apiVersion) {
        console.error('Invalid API name and version');
        process.exit(1);
      }
      options.api = { name: apiName, version: apiVersion };
    }
    await main(options).catch(console.error);
  });

// Parse the command line arguments
program.parse(process.argv);

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
      reject(error);
    });

    getApis.end();
  });
}

async function exportApis(apiDetails, token, apiOption) {
  return new Promise(async (resolve, reject) => {

    for (let i = 0; i < apiDetails.length; i++) {
      const exportAPI = {
        hostname: '127.0.0.1',
        port: 9443,
        path: `/api/am/publisher/v4/apis/export?apiId=${apiDetails[i].id}&name=${apiDetails[i].name}&version=${apiDetails[i].version}&provider=${apiDetails[0].provider}&format=YAML`,
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

        const filePath = path.join(exportDir, `exportAPI_${i}.zip`);
        const fileStream = fs.createWriteStream(filePath);
        response.pipe(fileStream);

        fileStream.on('finish', async function () {
          fileStream.close();


          try {
            const file = path.join('exports', `exportAPI_${i}.zip`);

            // If the file is a zip archive, extract the api.yaml file
            if (path.extname(file) === '.zip') {
              const filePathInsideZip1 = './api.yaml';
              const filePathInsideZip2 = './Definitions/swagger.yaml';
              const extractedAPIs = 'extractedAPIs';
              if (!fs.existsSync(extractedAPIs)) {
                fs.mkdirSync(extractedAPIs);
              }
              const zip = new AdmZip(file);
              zip.extractAllTo(extractedAPIs, true);
              const apiExtractFolderName = `${apiDetails[i].name}-${apiDetails[i].version}`;
              if (!apiExtractFolderName) {
                console.error('No dynamically created folder found.');
                process.exit(1);
              }
              const fileInsideZipPath1 = path.join(extractedAPIs, apiExtractFolderName, filePathInsideZip1);
              const fileInsideZipPath2 = path.join(extractedAPIs, apiExtractFolderName, filePathInsideZip2);
              const rulesetPath1 = path.join(__dirname, 'api_rules.yaml');
              const rulesetPath2 = path.join(__dirname, 'swagger_rules.yaml');
              let validationMessages1 = '';
              let validationMessages2 = '';

              const date = new Date(Date.now());
              const timeStamp = date.getDate() + '-' + (date.getMonth() + 1) + '-' + date.getFullYear() + '_' + date.getHours() + '-' + date.getMinutes() + '-' + date.getSeconds();

              //const timeStamp = new Date().toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '-');
              const reports = 'reports';
              if (!fs.existsSync(reports)) {
                fs.mkdirSync(reports);
              }

              if (apiOption === true) {
                validationMessages1 = await validateApi(fileInsideZipPath1, rulesetPath1);
                validationMessages2 = await validateApi(fileInsideZipPath2, rulesetPath2);
                const prefixedMessages = [`${apiDetails[i].name}-${apiDetails[i].version}`].concat(validationMessages1).concat(validationMessages2);
                await appendToLogFile((prefixedMessages.join('\n') + '\n'), `${reports}/Report_${timeStamp}.log`);

              }
              else if (apiOption.name === apiDetails[i].name && apiOption.version === apiDetails[i].version) {
                validationMessages1 = await validateApi(fileInsideZipPath1, rulesetPath1);
                validationMessages2 = await validateApi(fileInsideZipPath2, rulesetPath2);
                const prefixedMessages = [`${apiDetails[i].name}-${apiDetails[i].version}`].concat(validationMessages1).concat(validationMessages2);
                await appendToLogFile((prefixedMessages.join('\n') + '\n'), `${reports}/Report_${apiDetails[i].name}-${apiDetails[i].version}_${timeStamp}.log`);
              }
            }
          } catch (err) {
            console.error('Error:', err);
          };
        });
      });

      exportApi.on('error', error => {
        console.error('Error:', error);
      });

      exportApi.end();

    }
    resolve();
  });
}

// function to append messages to the log file
async function appendToLogFile(message, filePath) {
  try {
    await fs.promises.appendFile(filePath, message);
  } catch (err) {
    console.error(err);
  }
}

async function validateApi(apiFile, rulesetPath) {
  const spectral = new Spectral();
  // Load and set the ruleset
  spectral.setRuleset(
    await bundleAndLoadRuleset(rulesetPath, { fs, fetch })
  );
  // Load and validate the API file
  const apiSpec = fs.readFileSync(path.resolve(apiFile), 'utf8');
  const results = await spectral.run(apiSpec);

  const messages = [];
  if (results.length === 0) {
     console.log('API validation successful');
    // await appendToLogFile('API validation successful\n'); 

  } else {
    // console.error('API validation failed');
    for (const result of results) {
      messages.push(`${result.code}: ${result.message} at ${result.path.join('.')}`);
    }
  }
  return messages;
}

async function main(options) {
  const userOptions = program.opts(); // access user inputs from command line
  console.log("CLI tool to Validate APIs")

  const apiDetails = await getApiDetails(userOptions?.token);
  if (options.all) {
    await exportApis(apiDetails, userOptions?.token, options.all);
  }
  else if (options.api) {
    await exportApis(apiDetails, userOptions?.token, options.api);
  }
}

