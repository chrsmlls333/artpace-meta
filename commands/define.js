/* eslint-disable no-nested-ternary */
/* eslint-disable no-use-before-define */

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const junk = require('junk');

const sh = require('shelljs');

const ExifReader = require('exifreader');

const FuzzySet = require('fuzzyset');
const crypto = require('crypto');

const converter = require('json-2-csv');
const json2csvOptions = require('../configuration/json2csvConfig.json');

const loadArtists = require('../utils/loadArtists');

const { 
  allEqual, 
  breakCamelCase, 
  longCommand,
} = require('../utils/utils');
String.prototype.breakCamelCase = breakCamelCase;

// const isadEntryTemplate = require('../configuration/Example_information_objects_isad-2.6.js');

const options = require('../configuration/options.json');
const { 
  noRecurse, 
  exifReadSizeBytes,
  includeExtISADTitle, 
  fuzzyArtistMatchMinThreshold,
} = options.commands.define;
const { logsDirectory } = options;


// ==================================================

module.exports = {
  command: 'define [source]',

  desc: 'Initial pass to create metadata for folder contents. Sniff as many details from current directory into an \'apmeta\' resource file. This file follows ISAD templating for use with Access to Memory.',

  builder: {
    source: {
      describe: 'Folder to create into a Artpace Archival Packet',
      type: 'string',
      default: '.',
    },
  },

  handler: define,
};

async function define(argv) {

  const source = path.resolve(argv.source);
  console.log(`Looking at: ${source}`);
  
  // Check for directory
  const isDirectory = await fsp.stat(source)
    .then((stat) => stat.isDirectory());
  if (!isDirectory) throw new Error('You need to give me a directory/folder!');

  // Get Directory
  let files = await fsp.readdir(source)
    .then(list => list.filter(junk.not))
    .then((list) => list.map(v => path.join(source, v)))
    .catch((err) => {
      throw new Error(`Unable to scan directory: ${err}`);
    });
  if (noRecurse) files = files.filter((v) => !fs.statSync(v).isDirectory());
  
  // Convert to Objects
  files = files.map(v => ({ path: v }));

  // Run Siegfried file identification report
  files = await Promise.all(files.map(siegfriedScan));

  // Run MediaInfo Report
  files = await Promise.all(files.map(mediaInfoScan));
  
  // EXIF Tags
  files = await Promise.all(files.map(exifTagScan));

  // Dates
  files = files.map(detectDates);

  // Find Credit Mentions
  files = files.map(detectCreditsInPathAndTags);
  
  // Find Artist Mentions
  const artistsFuzzySet = FuzzySet();
  const artistList = await loadArtists();
  artistList.forEach(a => { artistsFuzzySet.add(a.authorizedFormOfName); });
  files = files.map(f => findArtistMentions(f, artistList, artistsFuzzySet));

  // Folder Path Tokens
  files = files.map(f => tagPathTokens(f, source));
      
  // Debug out
  const debugFiles = files.map(f => ({ ...f, tags: Array.from(f.tags) }));
  fs.writeFileSync(path.resolve(__dirname, '..', logsDirectory, './last-output-debug.json'), JSON.stringify(debugFiles, null, 2), { encoding: 'utf8' });
  
  // Build ISAD Items
  let isad = files
    .sort((a, b) => ('' + path.parse(a.path).name) // eslint-disable-line prefer-template
      .localeCompare(path.parse(b.path).name, 'en', { numeric: true })) // Natural Sort
    .map(isadFileFormatter);

  // Put in a File Folder
  isad = isadContainerAddTransform(isad, source);
  
  // Write CSV!!
  const csvPromise = converter.json2csvAsync(isad, json2csvOptions);
  // csvPromise.then((result) => fsp.writeFile(path.resolve(source, `apmeta-${''}.csv`), result))
  //   .catch((err) => console.error(err.message));
  csvPromise.then((result) => fsp.writeFile(path.resolve(__dirname, '..', logsDirectory, './last-output-ISAD.csv'), result))
    .catch((err) => console.error(err.message));

  // Open
  // sh.exec(`open '${source}'`);
}

// STEPS ==========================================================

async function siegfriedScan(fileObject) {
  // Check for dependencies first
  if (!sh.which('sf')) throw new Error('Siegfried dependency is not installed!');

  // Go wild
  const basename = path.basename(fileObject.path);
  const sfJSON = await longCommand(`sf -nr -json '${fileObject.path}'`, `Siegfried ${basename}`).then(JSON.parse);

  if (!sfJSON.files.length) throw new Error('Siegfried no files...');
  const report = sfJSON.files[0];
  if (report.errors) throw new Error(report.errors);
  if (!report.matches.length) throw new Error('Siegfried could not identify the file');

  const match = report.matches[0];

  return { 
    ...fileObject,
    sf: match,
  };  
}

async function mediaInfoScan(fileObject) {
  // Check for dependencies first
  if (!sh.which('mediainfo')) throw new Error('MediaInfo dependency is not installed!');

  // Go wild
  const basename = path.basename(fileObject.path);
  const mediainforeport = await longCommand(`mediainfo '${fileObject.path}'`, `MediaInfo (1) ${basename}`);
  const mediainfoJSON = await longCommand(`mediainfo --Output=JSON '${fileObject.path}'`, `MediaInfo (2) ${basename}`).then(JSON.parse);

  return {
    ...fileObject,
    modified: new Date(mediainfoJSON.media.track.find(h => h['@type'] === 'General').File_Modified_Date),
    image: !!mediainfoJSON.media.track.find(h => h['@type'] === 'Image'),
    video: !!mediainfoJSON.media.track.find(h => h['@type'] === 'Video'),
    // format: mediainfoJSON.media.track.find(h => h['@type'] === 'General').Format || '',
    mediainforeport: mediainforeport
      .replace(/[ \t]+: /g, ': ')
      .replace(/Complete [Nn]ame[^\n]*\n/g, `Original name: ${basename}\n`)
      .trim(),
  };
}

async function exifTagScan(fileObject) {
  if (!fileObject.image) return fileObject;
  return fsp.open(fileObject.path, 'r')
    .then(filehandle => {
      const b = Buffer.alloc(exifReadSizeBytes);
      return filehandle.read(b, 0, exifReadSizeBytes, 0)
        .then(() => {
          filehandle.close();
          return b;
        });
    })
    .then(buffer => {
      const tags = fileObject.tags || new Map();
      const exif = ExifReader.load(buffer);
      [
        'title',
        'rights',
        'description',
        'Object Name',
        'Copyright Notice',
        'ImageDescription', 
        'Caption/Abstract', 
      ].forEach(t => {
        const value = exif[t] && exif[t].description;
        if (value) tags.set(t, value);
      });
      return { ...fileObject, tags };
    })
    .catch((err) => {
      console.error(`Exif parsing failed for ${path.basename(fileObject.path)}`);
      // console.error(err);
      return fileObject;
    });
}

function detectDates(fileObject) {
  const dates = fileObject.dates || [];
  const dateTemplate = {
    eventDates: '',
    eventTypes: '',
    eventStartDates: '',
    eventEndDates: '',
    eventActors: '',
    // eventActorHistories: '',
  };

  // Get basic modified date
  const d = fileObject.modified;
  const modifiedDateStr = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  dates.push({
    ...dateTemplate,
    eventDates: modifiedDateStr,
    eventTypes: 'Creation',
  });

  // add other listed dates in filename
  const n = path.parse(fileObject.path).name;
  const mdy4Results = n.match(/(?<month>\d{1,2})[-.](?<day>\d{1,2})[-.](?<year>\d{4})/);
  const mdy2Results = n.match(/(?<month>\d{1,2})[-.](?<day>\d{1,2})[-.](?<year>\d{2})[^\d]/);
  const y4dmResults = n.match(/(?<year>\d{4})[-.](?<month>\d{1,2})[-.](?<day>\d{1,2})/);
  const r = { 
    ...mdy4Results && mdy4Results.groups, 
    ...mdy2Results && mdy2Results.groups, 
    ...y4dmResults && y4dmResults.groups,
  };
  if (r.year && r.year.length === 2) r.year = (Number(r.year) >= 90 ? '19' : '20') + r.year;
  const filenameDateStr = r.year ? 
    r.month ? 
      r.day ? 
        `${r.year}-${r.month.padStart(2, '0')}-${r.day.padStart(2, '0')}` : 
        `${r.year}-${r.month.padStart(2, '0')}` : 
      r.year : 
    false;
  if (filenameDateStr && filenameDateStr !== modifiedDateStr) {
    dates.push({
      eventDates: filenameDateStr,
      eventTypes: 'Creation',
    });
  }

  return { ...fileObject, dates };
}

function detectCreditsInPathAndTags(fileObject) {
  let credits = fileObject.credits || [];

  // Look in saved EXIF tags
  if (fileObject.tags) {
    const exifCredits = Array.from(fileObject.tags.values()).map(x => x.trim()).filter(t => t.match(/credit/i));
    credits.push(...exifCredits);
  }

  // Look in file path
  const pathCredits = fileObject.path.split(/[/\\_-]/).map(x => x.trim()).filter(t => t.match(/credit/i));
  credits.push(...pathCredits);

  // Unique and Fix camelCase
  credits = [...new Set(credits)].map(breakCamelCase);

  // Get longest? Dubious
  if (credits.length) {
    const pick = credits.reduce((prev, curr) => (curr.split(' ').length > prev.split(' ').length ? curr : prev));
    if (pick) credits = [pick];
  }

  return { ...fileObject, credits };
}

function findArtistMentions(fileObject, artists, fuzzy) {
  const names = fileObject.names || [];
  const subjects = fileObject.subjects || [];

  // Get Artists
  fileObject.path
    .split(/[/\\()_-]/)
    .filter(t => !!t)
    .filter(t => !t.match(/credit/i))
    .map(s => s.trim())
    .forEach(s => {
      const match = fuzzy.get(s, [], fuzzyArtistMatchMinThreshold);
      names.push(...match.map(e => e[1]));
      // if (match.length) console.log(s, match);
    });
  // Get Corresponding Subjects
  names.forEach(n => {
    const match = artists.find(a => a.authorizedFormOfName === n);
    subjects.push(...match.subjectAccessPoints);
  });

  return { ...fileObject, names, subjects };
}

function tagPathTokens(fileObject, dirPath = path.dirname(fileObject.path)) {
  const tags = fileObject.tags || new Map();

  dirPath
    .split(/[/\\_-]/)
    .filter(t => !!t)
    .filter(t => t !== 'Volumes')
    .filter(t => t !== 'Archive')
    .map(s => s.trim())
    .forEach((v, i) => { 
      tags.set(`path[${i}]`, v); 
    });

  return { ...fileObject, tags };
}

// =============================================================

function isadFileFormatter(fileObject, i, fileObjectArray) {
  const f = fileObject;
  const isadEntry = {
    // ...isadEntryTemplate,
    legacyId: i + 1,
    parentId: '',
    qubitParentSlug: '',
    identifier: `#${(i + 1).toString().padStart(3, '0')}`,
    // accessionNumber: '',
    title: (includeExtISADTitle ? path.parse(f.path).base : path.parse(f.path).name)
      .replace(/[_-]/g, ' ')
      .breakCamelCase(),
    levelOfDescription: 'Item',
    extentAndMedium: (() => {
      const [type, subtype] = f.sf.mime.split('/');
      return `1 ${type && type !== 'application' ? `${type} file` : 'digital object'}${f.sf.format ? ` (${f.sf.format})` : ''}`;
    })(),
    // repository: '',
    // archivalHistory: '',
    // acquisition: '',
    // scopeAndContent: '',
    // appraisal: '',
    // accruals: '',
    // arrangement: '',
    accessConditions: '',
    reproductionConditions: f.credits.join(' & ') || '',
    language: 'en', 
    // script: '',
    // languageNote: '',
    physicalCharacteristics: '',
    // findingAids: '',
    locationOfOriginals: 'ARCHIVE_445 Server',
    locationOfCopies: '',
    // relatedUnitsOfDescription: '',
    // publicationNote: '',
    digitalObjectPath: f.path || '',
    digitalObjectURI: '',
    generalNote: f.mediainforeport || '',
    subjectAccessPoints: f.subjects.join('|') || '',
    placeAccessPoints: '',
    nameAccessPoints: f.names.join('|') || '',
    genreAccessPoints: '',
    // descriptionIdentifier: '',
    // institutionIdentifier: '',
    // rules: '',
    // descriptionStatus: '',
    // levelOfDetail: '',
    // revisionHistory: '',
    languageOfDescription: 'en',
    // scriptOfDescription: '',
    sources: '',
    archivistNote: '',
    publicationStatus: 'Draft',
    physicalObjectName: '',
    physicalObjectLocation: '',
    physicalObjectType: '',
    alternativeIdentifiers: '',
    alternativeIdentifierLabels: '',
    eventDates: f.dates.map(d => d.eventDates || 'NULL').join('|'),
    eventTypes: f.dates.map(d => d.eventTypes || 'NULL').join('|'),
    eventStartDates: f.dates.map(d => d.eventStartDates || 'NULL').join('|'),
    eventEndDates: f.dates.map(d => d.eventEndDates || 'NULL').join('|'),
    eventActors: f.dates.map(d => d.eventActors || 'NULL').join('|'),
    // eventActorHistories: v.dates.map(d => d.eventActorHistories || 'NULL').join('|'),
    culture: 'en',
  };
  return isadEntry;
}

function isadContainerAddTransform(isadEntries, dirname) {
  const folderId = crypto.randomBytes(9).toString('hex');
  const legacyId = isadEntries.length + 1;
  const isadParentEntry = {
    // ...isadEntryTemplate,
    legacyId,
    parentId: '',
    qubitParentSlug: '',
    identifier: folderId,
    // accessionNumber: '',
    title: path.basename(dirname),
    levelOfDescription: 'File',
    extentAndMedium: `${isadEntries.length} digital object${isadEntries.length === 1 ? '' : 's'}`,
    // repository: '',
    // archivalHistory: '',
    // acquisition: '',
    // scopeAndContent: '',
    // appraisal: '',
    // accruals: '',
    // arrangement: '',
    accessConditions: allEqual(isadEntries.map(v => v.accessConditions)),
    reproductionConditions: allEqual(isadEntries.map(v => v.reproductionConditions)),
    language: 'en', 
    // script: '',
    // languageNote: '',
    physicalCharacteristics: '',
    // findingAids: '',
    locationOfOriginals: allEqual(isadEntries.map(v => v.locationOfOriginals)),
    locationOfCopies: allEqual(isadEntries.map(v => v.locationOfCopies)),
    // relatedUnitsOfDescription: '',
    // publicationNote: '',
    digitalObjectPath: '',
    digitalObjectURI: '',
    generalNote: '',
    subjectAccessPoints: [...new Set(isadEntries.map(v => v.subjectAccessPoints))].join('|') || '',
    placeAccessPoints: [...new Set(isadEntries.map(v => v.placeAccessPoints))].join('|') || '',
    nameAccessPoints: [...new Set(isadEntries.map(v => v.nameAccessPoints))].join('|') || '',
    genreAccessPoints: [...new Set(isadEntries.map(v => v.genreAccessPoints))].join('|') || '',
    // descriptionIdentifier: '',
    // institutionIdentifier: '',
    // rules: '',
    // descriptionStatus: '',
    // levelOfDetail: '',
    // revisionHistory: '',
    languageOfDescription: 'en',
    // scriptOfDescription: '',
    sources: '',
    archivistNote: '',
    publicationStatus: 'Draft',
    physicalObjectName: '',
    physicalObjectLocation: '',
    physicalObjectType: '',
    alternativeIdentifiers: folderId,
    alternativeIdentifierLabels: 'apmeta-folderID',
    // eventDates: ,
    // eventTypes: ,
    // eventStartDates: ,
    // eventEndDates: ,
    // eventActors: ,
    // eventActorHistories: v.dates.map(d => d.eventActorHistories || 'NULL').join('|'),
    culture: 'en',
  };

  // Inherit homogenous data and delete
  Object.keys(isadEntries[0]).forEach(k => {
    const match = allEqual(isadEntries.map(v => v[k]));
    if (match && (match === isadParentEntry[k] || isadParentEntry[k] === '')) {
      isadParentEntry[k] = match;
      isadEntries.forEach(e => delete e[k]);
    }
  });

  const isadAll = isadEntries.map(e => ({ ...e, parentId: legacyId }));

  isadAll.unshift(isadParentEntry);
  return isadAll;
}
