/**
 * @module utils/utils
 * @description Convenience module for common utility functions
 */

/* eslint-disable global-require */

const utils = {

  /**
   * Normalize URLs to absolute artpace.org addresses.
   * @param   {String}  str  URL to check
   * @returns {String}       Normalized absolute URL
   */
  artpaceURL: (str) => ((!str.startsWith('http')) ? `https://artpace.org${str}` : str),
  
  /**
   * Promise-based delay function, passes through resolve function in promise-chain.
   * @param   {Number}  ms  Milliseconds to wait
   * @returns {Promise} 
   */
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  /**
   * Check Array for total equality, and if true, return that value
   * @param   {Array}   arr               Array to check
   * @param   {*}       [success=arr[0]]  If not defined, return first array element on equality
   * @param   {*}       [failure='']      If not defined, return an empty string
   * @returns {*}
   */
  allEqual: (arr, success = arr[0], failure = '') => (arr.every(v => v === arr[0]) ? success : failure),

  /**
   * Normalizes camelCase text into a sentence with single spaces and trimmed ends
   * @this    String        if extending the String prototype
   * @param   {String}  [s] "camelCaseString"
   * @returns {String}      "camel Case String"
   */
  breakCamelCase(s) {
    return (s || this)
      .replace(/([A-Z](?=[a-z]+)|[A-Z]+(?![a-z]))/g, ' $1')
      .replace(/\s\s+/g, ' ')
      .trim();
  },
  
  /**
   * Promise-based ShellJS exec wrapper
   * @requires shelljs
   * @param    {String} command       Shell command to run
   * @returns  {Promise}              Returns Promise which 
   *                                    resolves to shell stdout
   *                                    rejects to shell stderr
   */
  exec(command) {
    const sh = require('shelljs');
    return new Promise((resolve, reject) => {
      const process = sh.exec(command, { async: true, silent: true });
      const output = []; 
      const outputErr = [];
      process.stdout.on('data', (data) => output.push(data));
      process.stderr.on('data', (data) => outputErr.push(data));
      process.on('close', (code) => {
        if (code === 0) resolve(output.join(''));
        else reject(outputErr.join(''));
      });
    });
  },

  /**
   * Promise-based ShellJS exec wrapper which runs a progress notification in the CLI
   * @requires shelljs
   * @requires cli-spinner
   * @param    {String} command       Shell command to run
   * @param    {String} [cliTemplate] Text to display in the console while running, 
   *                                    with %s to represent spinner
   * @returns  {Promise}              Returns Promise which 
   *                                    resolves to shell stdout
   *                                    rejects to shell stderr
   */
  execLong(command, cliTemplate = 'Running... %s') {
    const sh = require('shelljs');
    const { Spinner } = require('cli-spinner');
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line prefer-template
      const spinner = new Spinner(cliTemplate);
      spinner.setSpinnerString(0);
      spinner.start();
      const process = sh.exec(command, { async: true, silent: true });
      const output = []; 
      const outputErr = [];
      process.stdout.on('data', (data) => output.push(data));
      process.stderr.on('data', (data) => outputErr.push(data));
      process.on('close', (code) => {
        spinner.stop(true);
        if (code === 0) resolve(output.join(''));
        else reject(outputErr.join(''));
      });
    });
  },
  
  /**
   * Function to interpret byte size in human-readable text
   * @param   {Number}  bytes       Data size represented in bytes
   * @param   {Boolean} [si=false]  Metric (power-of-ten) notation or Binary (power-of-two) notation
   * @param   {Number}  [dp=1]      Decimal places?
   * @returns {String}
   */
  humanFileSize(bytes, si = false, dp = 1) {
    let b = bytes; 
    const thresh = si ? 1000 : 1024;
    if (Math.abs(b) < thresh) {
      return `${b} B`;
    }
    const units = si ? 
      ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'] : 
      ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;
    do {
      b /= thresh;
      ++u;
    } while (Math.round(Math.abs(b) * r) / r >= thresh && u < units.length - 1);
    return `${b.toFixed(dp)} ${units[u]}`;
  },

  /**
   * Check if a file is an Artpace Metafile
   * @requires path
   * @requires fs
   * @param    {String}  p   File path
   * @returns  {Boolean}     Whether the file is an apmeta.csv file
   * @todo                   Add csv validation to certify
   */
  isApmeta(p) { 
    const fs = require('fs');
    const path = require('path');
    const options = require('../configuration/options.json');

    if (!fs.existsSync(p)) return false;
    if (!fs.statSync(p).isFile()) return false;
    return path.basename(p).endsWith(options.apmetaFormat.path.ext); 
  },

  /**
   * Generate folder ID for APMETA.CSV files
   * @requires crypto
   * @returns  {String} A 9-byte, 18-char ID
   */
  generateFolderID() {
    return require('crypto').randomBytes(9).toString('hex');
  },

  /**
   * Verify folder ID format for APMETA.CSV files (9-byte, 18-char ID)
   * @param   {String}  id  Potential Identifier
   * @returns {Boolean}     Verification Status
   */
  verifyFolderID(id) {
    return !!id.match(/^[a-fA-F0-9]{18}$/);
  },

  /**
   * Get SHA256 checksum (same used in AtoM) for later verification
   * @param   {String}          filepath 
   * @returns {Promise<String>} 
   */
  getChecksum(filepath) {
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      if (!fs.existsSync(filepath)) throw new Error('Can\'t get checksum. The file/directory doesn\'t exist!');
      const hash = require('crypto').createHash('sha256');
      const input = fs.createReadStream(filepath);
      input.on('error', reject);
      input.on('data', (chunk) => hash.update(chunk));
      input.on('close', () => resolve(hash.digest('hex')));
    });
  },

  getChecksumLong(filepath, cliTemplate = 'Running... %s') {
    const { Spinner } = require('cli-spinner');
    const spinner = new Spinner(cliTemplate);
    spinner.setSpinnerString(0);
    spinner.start();
    return utils.getChecksum(filepath)
      .then(hash => {
        spinner.stop(true);
        return hash;
      });
  },

  /**
   * Compare a hexadecimal SHA256 checksum
   * @param   {String}          filepath 
   * @param   {String}          assumedHash 
   * @returns {Promise<String>} Resolve if the strings match, 
   *                            throw Error containing new hash otherwise
   */
  verifyChecksum(filepath, assumedHash) {
    const name = require('path').basename(filepath);
    if (!assumedHash) throw new Error(`I did not recieve a hash for ${name}`);
    return utils.getChecksum(filepath)
      .then((hash) => {
        if (hash === assumedHash) return true;
        throw new Error(`Hashes did not match: ${name}`);
      });
  },

};

module.exports = utils;
