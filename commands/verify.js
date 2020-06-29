/* eslint-disable no-use-before-define */
/**
 * @module commands/verify
 * @description Yargs command module to verify checksums in APMETA package/notation
 */

// ===========================================

const path = require('path');
const fs = require('fs');
// const fsp = fs.promises;

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
  console.log(`Verify: ${filepath}`);

  // Alignment of logging
  const logTab = [
    'Error parsing CSV: ',
    'File does not exist: ',
    'Not precalculated: ',
    'Hashes did not match: ',
  ].reduce((prev, curr) => Math.max(prev.length || 0, curr.length));
  
  // Load CSV and Filter
  const parseFile = () => new Promise((resolve, reject) => {
    const data = [];
    csv.parseFile(filepath, options.apmetaFormat.fastcsv.readOptions)
      .on('error', reject)
      .on('data', row => data.push(row))
      .on('end', () => resolve(data));
  });
  let entries = await parseFile()
    .then(a => a.filter(entry => !!entry.digitalObjectPath))
    .catch(err => { throw new Error(`Error parsing CSV: ${err.message}`); });
  const totalDigitalObjects = entries.length;
  if (!entries || !entries.length) throw new Error('No archival descriptions with digital objects found in list!');

  // Check for existence
  entries = entries.filter(({ digitalObjectPath: p }) => {
    const exists = fs.existsSync(p);
    if (!exists) console.error(`File does not exist: `.padEnd(logTab, ' ') + path.basename(p));
    return exists;
  });

  // Verify Checksums
  entries = entries.filter(({ digitalObjectPath: p, digitalObjectChecksum: c }) => {
    const exists = !!c;
    if (!exists) console.error(`Not precalculated: `.padEnd(logTab, ' ') + path.basename(p));
    return exists;
  });
  const checks = entries.map(
    ({ digitalObjectPath: p, digitalObjectChecksum: c }) => utils.verifyChecksum(p, c),
  );
  await Promise.allSettled(checks).then(results => {
    results.filter(r => r.status === 'rejected').forEach(r => {
      const m = r.reason.message.split(':').map(s => s.trim());
      console.error(`${m[0]}: `.padEnd(logTab, ' ') + m[1]);
    });
    const passes = results.filter(r => r.status === 'fulfilled').length;
    console.log(`${passes}/${totalDigitalObjects} passed checksum validation.`);
  });

}
