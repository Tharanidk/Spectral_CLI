## API Governance 

- CLI tool to validate Exixting APIs

You can validate API definition(s) using this CLI tool. It will create a report with violations contains in each API.

## Usage

The below commands can be used to validate API(s)

01. Validate all apis at once

`./cli.js validate --token <token> --all`

02. Validate one API by giving API name and API version

`./cli.js validate --token <token> --api <API name>:<API version>`

## Rule Set

The `api_rules.yaml` file contains custom rules written based on the api.yaml file and `swagger_rules.yaml` file contains custom rules written based on the swagger.yaml