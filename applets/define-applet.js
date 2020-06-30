/*

*/

// ESLINT ==============================================================

/* eslint-disable max-len, no-unused-vars, no-use-before-define, no-restricted-syntax */
/* global Automation, Application, $, Ref */

// CONFIG ==============================================================

const cmddelay = 30;

const cmdstart = [
  'clear;',
  'artpace-meta',
  'define',
];

const cmdend = [
  '--inspect;',
  `printf "\nThis window will close in ${cmddelay}s...\n";`,
  `sleep ${cmddelay};`,
  'exit',
];

// const fileTypesToProcess = [] // For example: {"PICT", "JPEG", "TIFF", "GIFf"}
// const extensionsToProcess = [] // For example: {"txt", "text", "jpg", "jpeg"}, NOT: {".txt", ".text", ".jpg", ".jpeg"}
// const typeIdentifiersToProcess = [] // For example: {"public.jpeg", "public.tiff", "public.png"}

// =============================================================================

const SystemEvents = Application('System Events');
const fileManager = $.NSFileManager.defaultManager;
const app = Application.currentApplication();
app.includeStandardAdditions = true;

function run() {
  openDocuments([app.chooseFolder({
    withPrompt: 'Choose a folder to initialize...',
  })]);
}

function openDocuments(droppedItems) {
  
  for (const item of droppedItems) {
    const isDir = Ref();
    if (fileManager.fileExistsAtPathIsDirectory(item.toString(), isDir) && isDir[0]) {
      // loopFolder(item)
      openFolder(item);
    } else {
      // processFile(item)
      app.displayAlert("I don't see a folder!", {
        message: 'Please drop a folder instead of files or links. Currently artpace-meta prefers to handle entire folders when creating apmeta packages.',
        as: 'critical',
        givingUpAfter: 10,
      });
    }
  }
}

function openFolder(folder) {
  const Terminal = Application('Terminal');
  Terminal.activate();
  
  const cmd = [].concat(cmdstart, [`"${folder.toString()}"`], cmdend).join(' ');
  
  const t = Terminal.doScript(cmd);
}

function debug(any) {
  console.log(Automation.getDisplayString(any));
}

// =============================================================

// function loopFolder(folder) {
//   // NOTE: The variable folder is an instance of the Path object
//   const folderString = folder.toString();

//   // Retrieve a list of any visible items in the folder
//   const folderItems = app.listFolder(folder, { invisibles: false });

//   // Loop through the visible folder items
//   for (const item of folderItems) {
//     const currentItem = `${folderString}/${item}`;
//     openDocuments([currentItem]);
//   }
//   // Add additional folder processing code here
// }

// function processFile(file) {
//   // NOTE: The variable file is an instance of the Path object
//   const fileString = file.toString();
//   const alias = SystemEvents.aliases.byName(fileString);
//   const extension = alias.nameExtension();
//   const fileType = alias.fileType();
//   const typeIdentifier = alias.typeIdentifier();
//   if (fileTypesToProcess.includes(fileType) || extensionsToProcess.includes(extension) || typeIdentifiersToProcess.includes(typeIdentifier)) {
//     // Add file processing code here
//   }
// }
