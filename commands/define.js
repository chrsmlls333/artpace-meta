/**
 * @module commands/define
 * @description Yargs command module to build APMETA package/notation
 */

/* eslint-disable no-nested-ternary, no-use-before-define */

// ==================================================

const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const junk = require('junk');

const sh = require('shelljs');

const ExifReader = require('exifreader');

const FuzzySet = require('fuzzyset');

const csv = require('fast-csv');

const utils = require('../utils/utils');
utils.loadArtists = require('../utils/loadArtists');
String.prototype.breakCamelCase = utils.breakCamelCase;

const ISADEntryTemplate = require('../resources/ISADEntryTemplate-2.6');

const options = require('../configuration/options.json');
const defineOptions = options.commands.define;

// ==================================================

module.exports = {
  command: 'define [source]',

  desc: `Initial pass to create metadata for folder contents. Sniff as many details from current directory into an '${options.apmetaFormat.path.ext}' resource file. This file follows ISAD templating for use with Access to Memory.`,

  builder: {
    source: {
      describe: 'Folder to create into a Artpace Archival Packet.',
      alias: ['directory'],
      type: 'string',
      default: '.',
    },
    dry: {
      describe: 'Whether to abstain from writing apmeta.csv to source folder.',
      alias: ['d', 'test'],
      type: 'boolean',
      default: false,
    },
    recurse: {
      describe: 'Recurse through source directory.',
      alias: ['r'],
      type: 'boolean',
      default: false,
      hidden: true,
      choices: [false], // Force false, not implemented
    },
  },

  handler: define,
};

// ==================================================

/**
 * Yargs Command Handler
 * 
 * @param {Object}  argv         Yargs Arguments Variable
 * @param {String}  argv.source  Working Directory
 * @param {Boolean} argv.dry     Don't write apmeta.csv
 */
async function define(argv) {
  const source = path.resolve(argv.source);
  const { dry, recurse } = argv;
  console.log(`${dry ? 'Taking a look at' : 'Creating Artpace Metadata Package at'}: ${source}`);
  
  // Check if exists
  if (!fs.existsSync(source)) throw new Error('The file/directory doesn\'t exist!');

  // Check for directory
  const isDirectory = await fsp.stat(source)
    .then((stat) => stat.isDirectory());
  if (!isDirectory) throw new Error('You need to give me a directory/folder!');

  // Get Directory
  let files = await fsp.readdir(source)
    .then(list => list.filter(junk.not))
    .then(list => list.filter(f => !f.startsWith('.')))
    .then(list => list.filter(f => !f.endsWith(options.apmetaFormat.path.extBackup)))
    .then(list => list.map(v => path.join(source, v)))
    .catch(err => {
      throw new Error(`Unable to scan directory: ${err}`);
    });
  if (!recurse) files = files.filter((v) => !fs.statSync(v).isDirectory());

  // Find previous APMETA or create new ID
  let folderID = utils.generateFolderID();
  const prevMeta = files.find(f => f.endsWith(options.apmetaFormat.path.ext));
  if (prevMeta) {
    // Remove from Directory listing
    files = files.filter(f => f !== prevMeta);
    // If ID is valid, move forward as an overwriting behaviour
    const prevMetaBase = path.basename(prevMeta);
    const name = prevMetaBase.replace(options.apmetaFormat.path.ext, '');
    if (defineOptions.overwritePreviousMetafile && utils.verifyFolderID(name)) {
      console.log(`Overwriting previous metafile: ${prevMetaBase}`);
      folderID = name;
    } else {
      console.log(`Found previous metafile: ${prevMetaBase}`);
    }
    // TODO create backup before overwrite, fs fatal error
  }
  
  // Convert to Objects
  files = files.map(v => ({ path: v }));

  // Get Checksums
  files = await Promise.all(files.map(generateChecksum));

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
  const artistList = await utils.loadArtists();
  artistList.forEach(a => { artistsFuzzySet.add(a.authorizedFormOfName); });
  files = files.map(f => findArtistMentions(f, artistList, artistsFuzzySet));

  // Folder Path Tokens
  files = files.map(f => tagPathTokens(f, source));
      
  // Debug out
  if (defineOptions.writeLocalOutputCopy) {
    const debugFiles = files.map(f => ({ ...f, tags: Array.from(f.tags) }));
    fs.writeFileSync(path.resolve(__dirname, '..', options.logsDirectory, './last-output-debug.json'), JSON.stringify(debugFiles, null, 2), { encoding: 'utf8' });
  }
  
  // Build ISAD Items
  let isad = files
    .sort((a, b) => ('' + path.parse(a.path).name) // eslint-disable-line prefer-template
      .localeCompare(path.parse(b.path).name, 'en', { numeric: true })) // Natural Sort
    .map(isadFileFormatter);

  // Put in a File Folder
  isad = isadContainerAddTransform(isad, source, folderID);
  
  // Build CSV
  const csvData = await csv.writeToString(isad, options.apmetaFormat.fastcsv.writeOptions);

  // Write Debug CSV
  if (defineOptions.writeLocalOutputCopy) {
    await fsp.writeFile(path.resolve(__dirname, '..', options.logsDirectory, `./last-output-ISAD${options.apmetaFormat.path.ext}`), csvData)
      .catch(err => console.error(err.message));
  }

  // Write Source CSV
  if (!dry) {
    await fsp.writeFile(path.resolve(source, `${folderID}${options.apmetaFormat.path.ext}`), csvData)
      .catch(err => console.error(err.message));
  }

  // Open
  // sh.exec(`open '${source}'`);
}

// STEPS ==========================================================

/**
 * A container for the metrics detected by Artpace Metadata Creator about each filepath
 * @typedef  {Object}   FileObject
 * @property {String}   path            File path
 * @property {Date}     modified    
 * @property {Boolean}  image           Check for isImage?
 * @property {Boolean}  video           Check for isVideo?
 * @property {Object}   sf              Results of Siegfried match
 * @property {String}   mediainforeport Results of MediaInfo CLI 
 * @property {Map<String,String>} tags  Unsorted extra information
 * @property {Object[]} dates           Significant dates arranged in AtoM ISAD names
 * @property {String[]} credits         Unformatted credit mentions
 * @property {String[]} names           Standardized Authority Record (nameAccessPoints)
 * @property {String[]} subjects        Standardized Subject Entries (subjectAccessPoints)
 * @property {String}   checksum        SHA256 Hash generated from path
 */

/**
 * Run SHA256 Checksum on file
 * Uses same algorithm as AtoM
 * @param   {FileObject} fileObject 
 * @returns {FileObject}
 */
async function generateChecksum(fileObject) {
  const checksum = await utils.getChecksumLong(fileObject.path, `SHA256 ${path.basename(fileObject.path)}`)
    .catch(() => { throw new Error('Checksum couldn\'t be created!'); });
  return { ...fileObject, checksum };
}

/**
 * Run Siegfried Scan on file
 * Compares file to PRONOM signatures to find type and mime data
 * @requires  shelljs
 * @param     {FileObject} fileObject 
 * @returns   {FileObject} 
 */
async function siegfriedScan(fileObject) {
  // Check for dependencies first
  if (!sh.which('sf')) throw new Error('Siegfried dependency is not installed!');

  // Go wild
  const sfJSON = await utils.exec(`sf -nr -json '${fileObject.path}'`).then(JSON.parse);

  if (!sfJSON.files.length) throw new Error('Siegfried no files...');
  const report = sfJSON.files[0];
  if (report.errors) throw new Error(report.errors);
  if (!report.matches.length) throw new Error('Siegfried could not identify the file');

  const match = report.matches[0];

  return { ...fileObject, sf: match };  
}

/**
 * Run MediaInfo Scan on file
 * A detailed metadata scan on video/audio/images
 * @requires  shelljs
 * @param     {FileObject} fileObject 
 * @returns   {FileObject} 
 */
async function mediaInfoScan(fileObject) {
  // Check for dependencies first
  if (!sh.which('mediainfo')) throw new Error('MediaInfo dependency is not installed!');

  // Go wild
  const basename = path.basename(fileObject.path);
  const mediainforeport = await utils.exec(`mediainfo '${fileObject.path}'`);
  const mediainfoJSON = await utils.exec(`mediainfo --Output=JSON '${fileObject.path}'`).then(JSON.parse);

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

/**
 * Pull EXIF/IPTC data from image files
 * @requires exifreader
 * @param    {FileObject} fileObject 
 * @returns  {FileObject} 
 */
async function exifTagScan(fileObject) {
  if (!fileObject.image) return fileObject;
  return fsp.open(fileObject.path, 'r')
    .then(filehandle => {
      const b = Buffer.alloc(defineOptions.exifReadSizeBytes);
      return filehandle.read(b, 0, defineOptions.exifReadSizeBytes, 0)
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

/**
 * Build AtoM ISAD date objects 
 *   from FileObject.modified Date
 *   from path mentions
 * @param    {FileObject} fileObject 
 * @returns  {FileObject} 
 */
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
      ...dateTemplate,
      eventDates: filenameDateStr,
      eventTypes: 'Creation',
    });
  }

  return { ...fileObject, dates };
}

/**
 * Search for Credit mentions in EXIF tags and Path
 * @param    {FileObject} fileObject 
 * @returns  {FileObject} 
 */
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
  credits = [...new Set(credits)].map(utils.breakCamelCase);

  // Get longest? Dubious
  if (credits.length) {
    const pick = credits.reduce((prev, curr) => (curr.split(' ').length > prev.split(' ').length ? curr : prev));
    if (pick) credits = [pick];
  }

  return { ...fileObject, credits };
}

/**
 * Match Artist mentions and corresponding Subjects Access Points
 * @requires fuzzyset
 * @requires utils/loadArtists
 * @param    {FileObject} fileObject 
 * @param    {Object[]}   artists     List of Artist Names matched with Exhibition Cycles
 * @param    {FuzzySet}   fuzzy       FuzzySet dictionary, prepopulated with names
 * @returns  {FileObject} 
 */
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
      const match = fuzzy.get(s, [], defineOptions.fuzzyArtistMatchMinThreshold);
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

/**
 * Fill Tags with each Path Token for later use
 * @param    {FileObject} fileObject 
 * @returns  {FileObject} 
 */
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

/**
 * Container Object based on AtoM ISAD(G) Archival Description CSV import template
 * @typedef  {Object}   ISADEntry
 */

/**
 * Build AtoM ISAD(G) CSV-line Objects for each FileObject
 * @param   {FileObject}   fileObject 
 * @param   {Number}       i                index in alpha-sorted fileObjectArray
 * @param   {FileObject[]} fileObjectArray 
 * @returns {ISADEntry}   
 */
function isadFileFormatter(fileObject, i, fileObjectArray) {
  const f = fileObject;
  const isadEntry = {
    // ...isadEntryTemplate,
    legacyId: i + 1,
    parentId: '',
    qubitParentSlug: '',
    identifier: `${(i + 1).toString().padStart(3, '0')}`,
    // accessionNumber: '',
    title: (defineOptions.includeExtISADTitle ? path.parse(f.path).base : path.parse(f.path).name)
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
    digitalObjectChecksum: f.checksum || '',
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

/**
 * Build AtoM ISAD(G) CSV-line Object for container
 * Consolidate repeated data from items to container entry
 * @param   {ISADEntry[]}  isadEntries
 * @param   {String}       dirname    Root source filepath for working directory
 * @param   {String}       folderId   ID to pass into container metadata, 
 *                                    should be generated with generateFolderID in utils
 * @returns {ISADEntry[]}             
 *                                    All entries plus the new container entry in [0]
 */
function isadContainerAddTransform(isadEntries, dirname, folderId) {
  const legacyId = isadEntries.length + 1;
  const isadParentEntry = {
    // ...isadEntryTemplate,
    legacyId,
    parentId: '',
    qubitParentSlug: '',
    identifier: '',
    // accessionNumber: '',
    title: (() => {
      const pathArr = dirname.split(path.sep);
      return pathArr.slice(Math.max(pathArr.length - 3, 0)).join(', ');
    })(),
    levelOfDescription: 'File',
    extentAndMedium: `${isadEntries.length} digital object${isadEntries.length === 1 ? '' : 's'}`,
    // repository: '',
    // archivalHistory: '',
    // acquisition: '',
    // scopeAndContent: '',
    // appraisal: '',
    // accruals: '',
    // arrangement: '',
    accessConditions: utils.allEqual(isadEntries.map(v => v.accessConditions)),
    reproductionConditions: utils.allEqual(isadEntries.map(v => v.reproductionConditions)),
    language: 'en', 
    // script: '',
    // languageNote: '',
    physicalCharacteristics: '',
    // findingAids: '',
    locationOfOriginals: utils.allEqual(isadEntries.map(v => v.locationOfOriginals)),
    locationOfCopies: utils.allEqual(isadEntries.map(v => v.locationOfCopies)),
    // relatedUnitsOfDescription: '',
    // publicationNote: '',
    digitalObjectPath: '',
    digitalObjectURI: '',
    digitalObjectChecksum: '',
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
    alternativeIdentifierLabels: 'apmeta ID',
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
    const match = utils.allEqual(isadEntries.map(v => v[k]));
    if (match && (match === isadParentEntry[k] || isadParentEntry[k] === '')) {
      isadParentEntry[k] = match;
      isadEntries.forEach(e => delete e[k]);
    }
  });

  // Add links to parent entry
  const isadAll = isadEntries.map(e => ({ ...e, parentId: legacyId }));

  // Add parent entry
  isadAll.unshift(isadParentEntry);
  return isadAll;
}
