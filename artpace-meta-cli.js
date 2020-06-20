#!/usr/bin/env node

/*

*/

const path = require('path');
const fs = require('fs');
const yargs = require('yargs');

// const utils = require('./configuration/utils');

// =================================================

const { logsDirectory } = require('./configuration/options.json');
fs.mkdirSync(path.resolve(logsDirectory), { recursive: true });
// const logger = require('./configuration/logConfig');

// =================================================

// eslint-disable-next-line no-unused-expressions
yargs
  .usage('Usage: $0 <command> [options]')
  .commandDir('./commands/')
  .demandCommand(1, 'artpace-meta needs a command, refer to `artpace-meta -h` for help!')
  // .example('$0 define', )
  .version()
  .alias('v', 'version')
  .help('h')
  .alias('h', 'help')
  .showHelpOnFail(false)
  .argv;
