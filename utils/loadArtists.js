/**
 * @module utils/loadArtists
 * @description Pulls in the AtoM Authority Record CSV to create an Artist List for tagging
 */

const path = require('path');
const csv = require('fast-csv');

const { artistsAtomTemplateCSV } = require('../configuration/options.json').resources;

// ========================================================================================

module.exports = () => new Promise((resolve, reject) => {
  const file = path.resolve(__dirname, '..', artistsAtomTemplateCSV);
  const data = [];
  csv.parseFile(file, {
    headers: true,
    encoding: 'utf8',
  })
    .on('data', record => {
      const filtered = (({
        authorizedFormOfName,
        subjectAccessPoints,
      }) => ({
        authorizedFormOfName,
        subjectAccessPoints: (subjectAccessPoints && subjectAccessPoints.split('|')) || [],
      }))(record);
      data.push(filtered);
    })
    .on('data-invalid', reject)
    .on('end', () => resolve(data));
});
