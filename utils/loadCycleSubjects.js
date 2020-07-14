/**
 * @module utils/loadCycleSubjects
 * @description Pulls in the AtoM Subject Access Point SKOS RDF XML to parse exhibition cycles
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const xml2js = require('xml2js');

const { subjectsCyclesXML } = require('../configuration/options.json').resources;

module.exports = () => {
  const file = path.resolve(__dirname, '..', subjectsCyclesXML);

  const parser = new xml2js.Parser();
  return fsp.readFile(file)
    .then(data => parser.parseStringPromise(data))
    .then(result => {
      let arr = result['rdf:RDF']['skos:Concept'];
      if (!arr || !arr.length) throw new Error('No subjects data found!');
      arr = arr.map(e => {
        const obj = {};
        Object.keys(e).forEach(k => {
          if (!k.startsWith('skos:')) return;
          if (!k.endsWith('Label')) return;
          let v = e[k];
          if (!Array.isArray(v)) return;
          v = v.map(d => d._);
          const newK = k.replace('skos:', '');
          obj[newK] = v;
        });
        if (Object.keys(e).length === 0) return {};
        if (!obj.altLabel) return {};
        obj.altLabel = obj.altLabel.filter(l => l.indexOf('.') !== -1);
        if (!obj.altLabel.length) return {};
        return obj;
      });
      arr = arr.filter(v => Object.keys(v).length !== 0);
      return arr;
    })
    .catch(console.err);
};
