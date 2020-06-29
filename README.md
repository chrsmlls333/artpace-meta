# Artpace Metadata Creator

### Installation
- Install Homebrew https://brew.sh/
- `brew install node`
- `brew install mediainfo`
- `brew install richardlehane/digipres/siegfried `
- `npm install`
- `npm link` 
  - registers the command `artpace-meta` to the system

### Commands
- `artpace-meta --help`
- `artpace-meta define [source]` 

### Build Automator Shortcuts
There is an applescript file in `/automator` which can be used in a Run Applescript block and exported to an app. this app will accept dropped folders to pass directly into `artpace define --inspect` before opening the csv in LibreOffice and the folder in Finder.

If many Terminal windows build up, make sure:
- Preferences > Profiles > Shell > When the shell exits:
  - "Close if the shell exited cleanly"

### Links 
- [Artefactual AtoM Documentation (2.5)](https://www.accesstomemory.org/en/docs/2.5/)
  - [AtoM CSV Import](https://www.accesstomemory.org/en/docs/2.5/user-manual/import-export/csv-import/#csv-import)
  - [General International Standard Archival Description (ISAD(G)) data entry and CSV template reference](https://www.accesstomemory.org/en/docs/2.5/user-manual/data-templates/isad-template/#isad-template)
- https://www.itforarchivists.com/siegfried
  - https://github.com/richardlehane/siegfried
  - http://www.nationalarchives.gov.uk/PRONOM
- https://glench.github.io/fuzzyset.js/
- https://zaiste.net/posts/modern-nodejs-cli-yargs/
