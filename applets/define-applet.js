/*

*/

// CONFIG ==============================================================

var cmddelay = 30;

var cmdstart = [
  'clear;',
  'artpace-meta',
  'define'
];

var cmdend = [
  '--inspect;',
  'printf "\nThis window will close in ' + cmddelay + 's...\n";',
  'sleep ' + cmddelay + ';',
  'exit'
];

// var fileTypesToProcess = []; // For example: {"PICT", "JPEG", "TIFF", "GIFf"}
// var extensionsToProcess = []; // For example: {"txt", "text", "jpg", "jpeg"}, NOT: {".txt", ".text", ".jpg", ".jpeg"}
// var typeIdentifiersToProcess = []; // For example: {"public.jpeg", "public.tiff", "public.png"}

// =============================================================================

var SystemEvents = Application('System Events');
var fileManager = $.NSFileManager.defaultManager;
var app = Application.currentApplication();
app.includeStandardAdditions = true;
// var computerName = app.doShellScript('scutil --get LocalHostName');
// var userName = app.doShellScript('echo $USER');

function run() {
  openDocuments([app.chooseFolder({
    withPrompt: 'Choose a folder to initialize...'
  })]);
}

function openDocuments(droppedItems) {
  droppedItems.forEach(function(item) {
    var isDir = Ref();
    if (fileManager.fileExistsAtPathIsDirectory(item.toString(), isDir) && isDir[0]) {
      // loopFolder(item)
      openFolder(item);
    } else {
      // processFile(item)
      app.displayAlert("I don't see a folder!", {
        message: 'Please drop a folder instead of files or links. Currently artpace-meta prefers to handle entire folders when creating apmeta packages.',
        as: 'critical',
        givingUpAfter: 10
      });
    }
  });
}

function openFolder(folder) {
  var Terminal = Application('Terminal');
  Terminal.activate();

  var cmd = [].concat(cmdstart, ['"' + folder.toString() + '"'], cmdend).join(' ');

  var t = Terminal.doScript(cmd);
  // do {
  //   delay(1);
  // } while (t.properties().busy);
}

function debug(any) {
  // eslint-disable-next-line no-console
  console.log(Automation.getDisplayString(any));
}

// =============================================================

// function loopFolder(folder) {
//   // NOTE: The variable folder is an instance of the Path object
//   var folderString = folder.toString();

//   // Retrieve a list of any visible items in the folder
//   var folderItems = app.listFolder(folder, { invisibles: false });

//   // Loop through the visible folder items
//   folderItems.forEach(function(item) {
//     var currentItem = folderString + '/' + item;
//     openDocuments([currentItem]);
//   });
//   // Add additional folder processing code here
// }

// function processFile(file) {
//   // NOTE: The variable file is an instance of the Path object
//   var fileString = file.toString();
//   var alias = SystemEvents.aliases.byName(fileString);
//   var extension = alias.nameExtension();
//   var fileType = alias.fileType();
//   var typeIdentifier = alias.typeIdentifier();
//   if (fileTypesToProcess.includes(fileType) || extensionsToProcess.includes(extension) || typeIdentifiersToProcess.includes(typeIdentifier)) {
//     // Add file processing code here
//   }
// }

// function commandExistWindow(command) {
//   var Terminal = Application('Terminal');
//   Terminal.activate();
//   try {
//     var currentWindow = Terminal.windows.at(0);
//     var currentTab = currentWindow.selectedTab();
//     var t = Terminal.doScript(command, { in: currentTab });
//     return t;
//   } catch (err) {
//     // console.log(err) // no window
//     var g = Terminal.doScript(command);
//     return g;
//   }
// }
