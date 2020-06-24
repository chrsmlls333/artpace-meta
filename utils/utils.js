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
  longCommand(command, cliTemplate = 'Running... %s') {
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

};

module.exports = utils;
