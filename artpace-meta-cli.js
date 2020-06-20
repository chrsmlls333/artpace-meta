#!/usr/bin/env node

/*

*/

const yargs = require('yargs');

// const logger = require('./configuration/logConfig');
// const utils = require('./configuration/utils');

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
