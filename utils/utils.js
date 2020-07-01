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
   * Break command into pieces for child_process
   * https://stackoverflow.com/questions/4031900/split-a-string-by-whitespace-keeping-quoted-segments-allowing-escaped-quotes
   * @param   {String}  s 
   * @returns {String}
   */
  tokenizeCommand(s) {
    return s
      .match(/\\?.|^$/g)
      .reduce((p, c) => {
        if (c === '"') p.quote ^= 1; // eslint-disable-line no-bitwise, no-param-reassign
        else if (!p.quote && c === ' ') p.a.push('');
        else p.a[p.a.length - 1] += c.replace(/\\(.)/, '$1'); // eslint-disable-line no-param-reassign
        return p;
      }, { a: [''] })
      .a;
  },
  
  /**
   * Promise-based ShellJS exec wrapper
   * @requires shelljs
   * @param    {String} command       Shell command to run
   * @returns  {Promise}              Resolves to shell stdout
   *                                  Rejects to shell stderr
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
   * Exec wrapper for Child_Process detached spawn
   * @requires child_process
   * @param    {String}  command 
   */
  execDetached(command) {
    const { spawn } = require('child_process');
    const [cmd, ...args] = utils.tokenizeCommand(command);
    const subprocess = spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
    });
    subprocess.unref();
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
   * Shorthand Function to report stepped progress
   * Handles spacing for step numbers into the hundreds
   * @param {String}  message Message to accompany step
   * @param {Boolean} [reset] Trigger a counter reset to 1
   * @todo                    Use Winston logging here
   */
  stepNotify(message, reset = false) {
    if (typeof utils.stepNotify.step === 'undefined' || reset) utils.stepNotify.step = 1;
    console.log((`[${utils.stepNotify.step++}] `).padEnd(6, ' ') + message);
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
   * General utility used in multiple commands to return the apmeta.csv file
   * Checks file or folder path for validity
   * @requires path
   * @requires fs
   * @param    {String}   filepath  Candidate directory/file path
   * @returns  {Promise}            Resolves to the apmeta.csv file path
   *                                Rejects Error with reason for failure
   */
  async findApmeta(filepath) {
    const fs = require('fs');
    const path = require('path');

    function scanDir(dirpath) {
      return fs.promises.readdir(dirpath)
        .then(list => list.map(f => path.join(dirpath, f)))
        .catch(err => {
          throw new Error(`Unable to scan directory: ${err.message}`);
        })
        .then(list => list.filter((v) => !fs.statSync(v).isDirectory()))
        .then(list => list.filter(utils.isApmeta))
        .then(list => {
          if (list.length === 0) throw new Error('I don\'t see a valid apmeta.csv here!');
          if (list.length > 1) {
            throw new Error(
              `I found multiple apmeta.csv files,
              ${list.map(f => `\t${path.basename(f)}`).join('\n')}
              Try again once resolved.`,
            );
          }
          return list[0];
        });
    }

    if (!fs.existsSync(filepath)) throw new Error('The file/directory doesn\'t exist!');
    if (fs.statSync(filepath).isDirectory()) return scanDir(filepath);
    if (!fs.statSync(filepath).isFile()) throw new Error('I don\'t know what you gave me but it isn\'t a file or folder!');
    if (!utils.isApmeta(filepath)) throw new Error('This is not a valid apmeta.csv file.');
    return filepath;
  },

  /**
   * Generate folder ID for APMETA.CSV files
   * @requires crypto
   * @returns  {String} A 9-byte, 18-char ID
   */
  generateFolderID: () => require('crypto').randomBytes(9).toString('hex'),

  /**
   * Verify folder ID format for APMETA.CSV files (9-byte, 18-char ID)
   * @param   {String}  id  Potential Identifier
   * @returns {Boolean}     Verification Status
   */
  verifyFolderID: (id) => !!id.match(/^[a-fA-F0-9]{18}$/),

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
