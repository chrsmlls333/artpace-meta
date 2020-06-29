/**
 * @module commands/open
 * @description Yargs command module to open APMETA package for inspection
 */

/* eslint-disable no-use-before-define */

// ===========================================

const path = require('path');

const sh = require('shelljs');

const utils = require('../utils/utils');

const options = require('../configuration/options.json');
const libreOptions = options.apmetaFormat.libreoffice;

// ===========================================

module.exports = {
  command: 'inspect [source]',

  aliases: ['open'],

  desc: 'Open folder and/or metadata file for inspection.',

  builder: {
    source: {
      describe: 'Directory or apmeta file to check for Artpace Archival Packet info.',
      alias: ['directory', 'file'],
      type: 'string',
      default: '.',
    },
  },

  handler: (argv) => sanitize(argv).catch(e => {
    console.error(e.message);
    process.exitCode = 1;
  }),
};

// ===============================================

async function sanitize(argv) {
  let source = '';
  // Handle use as a utility function
  if (typeof argv === 'string' || argv instanceof String) source = argv;
  // Handle as Yargs command
  else source = argv.source;
  source = path.resolve(source);

  // Route through standardized detection
  utils.findApmeta(source)
    .then(filepath => processApmeta(filepath));
}

async function processApmeta(filepath) {
  console.log(`Open: ${filepath}`);

  // Open CSV
  openLibreOffice(filepath);

  // Open Folder
  sh.exec(`open '${path.dirname(filepath)}'`);

  // Add any other commands here
}

async function openLibreOffice(filepath) {
  if (!sh.which(libreOptions.executable)) throw new Error('LibreOffice dependency is not installed, or options are not set correctly!');
  const cmd = [
    libreOptions.executable,
    ...libreOptions.args,
    `"${filepath}"`,
  ].join(' ');
  return utils.execDetached(cmd);
}
