/*

*/

const sh = require('shelljs');
const { Spinner } = require('cli-spinner');

const utils = {
  
  artpaceURL: (str) => ((!str.startsWith('http')) ? `https://artpace.org${str}` : str),
  
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

  allEqual: (arr, success = arr[0], failure = '') => (arr.every(v => v === arr[0]) ? success : failure),

  breakCamelCase(s) {
    return (s || this)
      .replace(/([A-Z](?=[a-z]+)|[A-Z]+(?![a-z]))/g, ' $1')
      .replace(/\s\s+/g, ' ')
      .trim();
  },
  
  longCommand: (command, spinnerTemplate = 'Running... %s') => new Promise((resolve, reject) => {
    // eslint-disable-next-line prefer-template
    const spinner = new Spinner(spinnerTemplate);
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
  }),

  humanFileSize: (bytes, si = false, dp = 1) => {
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
