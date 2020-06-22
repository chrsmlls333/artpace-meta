/**
 * @module utils/loadArtists
 * @description Pulls in the AtoM Authority Record CSV to create an Artist List for tagging
 */

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const converter = require('json-2-csv');
const csv2jsonOptions = require('../configuration/json2csvConfig.json');

const { artistsAtomTemplateCSV } = require('../configuration/options.json').resources;

const artistList = () => fsp.readFile(path.resolve(__dirname, '..', artistsAtomTemplateCSV), { encoding: 'utf-8' })
  .then(data => new Promise((resolve, reject) => {
    converter.csv2json(data, (err, json) => {
      if (err) reject(err);
      resolve(json);
    }, {
      ...csv2jsonOptions,
      keys: [ 
        'authorizedFormOfName',
        'subjectAccessPoints',
      ],
    });
  }))
  .then(json => json.map(e => ({
    ...e,
    subjectAccessPoints: (e.subjectAccessPoints && e.subjectAccessPoints.split('|')) || [],
  })))
  .catch(console.error);

module.exports = artistList;
