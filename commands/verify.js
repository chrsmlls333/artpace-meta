/* eslint-disable no-use-before-define */
/**
 * @module commands/verify
 * @description Yargs command module to verify checksums in APMETA package/notation
 */

// ===========================================

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const csv = require('fast-csv');

const utils = require('../utils/utils');

const options = require('../configuration/options.json');

// ============================================

module.exports = {
  command: 'verify [source]',

  desc: 'Scan metafile for digital object listings and confirm info (ie. exists and checksums).',

  builder: {
    source: {
      describe: 'Directory or apmeta file to check for Artpace Archival Packet checksums.',
      alias: ['directory', 'file'],
      type: 'string',
      default: '.',
    },
  },

  handler: verify,
};

// ===============================================

async function verify(argv) {
  const source = path.resolve(argv.source);
  console.log(`Verify: ${source}`);

  try {
    if (!fs.existsSync(source)) throw new Error('The file/directory doesn\'t exist!');
    if (fs.statSync(source).isDirectory()) await scanDir(source);
    else {
      if (!fs.statSync(source).isFile()) throw new Error('I don\'t know what you gave me but it isn\'t a file or folder!');
      if (!utils.isApmeta(source)) throw new Error('This is not a valid apmeta.csv file.');
      await processApmeta(source);
    }
  } catch (error) { console.error(error.message); }
}

async function scanDir(dirpath) {
  const files = await fsp.readdir(dirpath)
    .then(list => list.map(f => path.join(dirpath, f)))
    .then(list => list.filter((v) => !fs.statSync(v).isDirectory()))
    .then(list => list.filter(utils.isApmeta))
    .catch(err => {
      throw new Error(`Unable to scan directory: ${err}`);
    });
  if (files.length === 0) throw new Error('I don\'t see a valid apmeta.csv here!');
  if (files.length > 1) throw new Error(`I found multiple apmeta.csv files,\n${files.map(f => `\t${path.basename(f)}`).join('\n')}\nTry again once resolved.`);
  await processApmeta(files[0]);
}

async function processApmeta(filepath) {
  
  // Load CSV and Filter
  const parseFile = () => new Promise((resolve, reject) => {
    const data = [];
    csv.parseFile(filepath, options.apmetaFormat.fastcsv.readOptions)
      .on('error', reject)
      .on('data', row => data.push(row))
      .on('end', () => resolve(data));
  });
  const entries = await parseFile()
    .then(a => a.filter(entry => !!entry.digitalObjectPath))
    .catch(err => console.error(`Error parsing CSV: ${err.message}`));

  if (!entries || !entries.length) throw new Error('No archival descriptions with digital objects found in list!');
  if (!entries.every(entry => !!entry.digitalObjectChecksum)) console.error('Some archival descriptions are missing precalculated checksums!');
  
  // Verify Checksums
  const checks = entries.map(
    ({ digitalObjectPath: p, digitalObjectChecksum: c }) => utils.verifyChecksum(p, c),
  );

  await Promise.allSettled(checks).then(results => {
    results.filter(r => r.status === 'rejected').forEach(r => console.error(r.reason.message));
    const passes = results.filter(r => r.status === 'fulfilled').length;
    console.log(`${passes}/${results.length} passed checksum validation.`);
  });
}