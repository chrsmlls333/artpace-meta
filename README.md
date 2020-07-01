# Artpace Metadata Creator

### Installation
- Install Homebrew https://brew.sh/
- `brew install node@14`
- `brew install mediainfo`
- `brew install richardlehane/digipres/siegfried `
- `npm install`
- `npm link` 
  - adds the command `artpace-meta` to the PATH

### Commands
- `artpace-meta --help`
- `artpace-meta define  [source]` 
- `artpace-meta verify  [source]`
- `artpace-meta inspect [source]`

### Build Applescript Shortcuts
Any Javascript for Automation (JXA) file in `/applets` which ends in `-applet.js` will be compiled with osacompile in macOS to build a shortcut droplet. If there is an SVG with the same name, it will be added to the new app as an icon.

Steps:
- `brew install svg2png` (optional)
- `npm run build-applets`

Current Builds:
- `Artpace-Meta Define.app`
  - This app will accept dropped folders to pass directly into `artpace-meta define --inspect` before opening the csv in LibreOffice and the folder in Finder.

  - If many Terminal windows build up, make sure:
    - Preferences > Profiles > Shell > When the shell exits: === "Close if the shell exited cleanly"

### Links 
- [Artefactual AtoM Documentation (2.5)](https://www.accesstomemory.org/en/docs/2.5/)
  - [AtoM CSV Import](https://www.accesstomemory.org/en/docs/2.5/user-manual/import-export/csv-import/#csv-import)
  - [General International Standard Archival Description (ISAD(G)) data entry and CSV template reference](https://www.accesstomemory.org/en/docs/2.5/user-manual/data-templates/isad-template/#isad-template)
- https://www.itforarchivists.com/siegfried
  - https://github.com/richardlehane/siegfried
  - http://www.nationalarchives.gov.uk/PRONOM
- Node Libraries
  - https://glench.github.io/fuzzyset.js/
  - https://zaiste.net/posts/modern-nodejs-cli-yargs/
- JXA/Applescript
  - https://github.com/JXA-Cookbook/JXA-Cookbook/wiki
  - https://github.com/addyosmani/es6-equivalents-in-es5#iterators-and-for-of
