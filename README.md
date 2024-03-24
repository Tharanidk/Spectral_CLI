## API Governance CLI Tool

- A CLI tool to validate existing API(s). You can validate API definition(s) using this CLI tool. It will create a report with violations contained in each API.

## Configuration
- Before using the CLI tool, configure your user credentials and server details as needed. These settings are used to authenticate against your API management solution and to specify the server with which the tool will communicate. Here's an example of how your `config.yaml` file should look:
```
User:
  username: <username>
  password: <user_password>
  clientId: <generated_client_id>
  clientSecret: <generated_client_secret>
Server:
  hostname: <server_host>
```

## Usage

The below commands can be used to validate API(s)

01. Validate all apis at once

`./cli.js validate  --all`

02. Validate one API by giving API name and API version

`./cli.js validate --api <API ID>`


## Customizing the  Rules

The rules are categorized based on the aspects they validate:

- Type 1 Rules: Validate API(s) using the details provided in `api.yaml`file.
- Type 2 Rules: Validate API(s) using the details provided in `swagger.yaml` file.
- Type 3 Rules: Validate API(s) using the details provided in `docs.yaml`.

### Example Rule Definition

Here's how you can define a custom rule in api_rules.yaml:

```
  <rule_name>:
    description: "<describing_the_rule>"
    message: "<error_message_to_given_out>"
    severity: error
    given: "<path_inside_api.yaml_file>"
    then:
      field: "<filed_to_check>"
      function: pattern
      functionOptions:
        notMatch: "<matching_parameter>"
         min: <minimum_amount_to_check>
```
