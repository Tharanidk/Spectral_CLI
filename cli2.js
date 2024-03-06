#!/usr/bin/env node

const { program } = require('commander');
const fs = require('fs');
const path = require('path');
const https = require('https');

program
  .version('1.0.0')
  .requiredOption('-t, --token <type>', 'Bearer token');

program.parse(process.argv); // Parse the command line arguments

const userOptions = program.opts();

async function getApiDetails(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 9443,
      path: '/api/am/publisher/v4/apis',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      rejectUnauthorized: false // -k option
    };

    const req = https.request(options, response => {
      let data = '';
      response.on('data', chunk => {
        data += chunk;
      });

      response.on('end', () => {
        try {
          const apiList = JSON.parse(data);
          const apiDetails = apiList.list.map(api => ({
            id: api.id,
            name: api.name,
            version: api.version,
            provider: api.provider
          }));
          resolve(apiDetails);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', error => reject(error));
    req.end();
  });
}

async function main() {
  console.log("Starting the CLI tool...")
  const apiDetails = await getApiDetails(userOptions.token);
  console.log(apiDetails[0].id);
  console.log("CLI tool execution completed.")
}

main().catch(console.error);
