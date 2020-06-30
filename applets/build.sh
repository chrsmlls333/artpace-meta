#!/bin/bash
set -e

SIZES="
16,16x16
32,16x16@2x
32,32x32
64,32x32@2x
128,128x128
256,128x128@2x
256,256x256
512,256x256@2x
512,512x512
1024,512x512@2x
"

[ "$(uname)" == "Darwin" ] || { echo "This only builds on macOS!" ; exit 1; }

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd $DIR

for i in *-applet.js; do
  [ -f "$i" ] || break
  BASE=$(basename "$i" | sed 's/\.[^\.]*$//')

  # Build App
  JS=$i
  APP="$(echo "$BASE" | sed s/"-applet"/""/g).app"
  APP="$(tr '[:lower:]' '[:upper:]' <<< ${APP:0:1})${APP:1}"
  APP="Artpace-Meta $APP"
  echo "Compiling: $APP"
  rm -rf "$APP"
  osacompile -l JavaScript -o "$APP" "$JS"

  # Build Icons
  [ -x "$(command -v svg2png)" ] || { echo "svg2png dependency missing!"; break; }
  
  SVG="$BASE.svg"
  [ -f "$SVG" ] || { echo "No SVG found."; break; }

  ICONSET="$BASE.iconset"
  mkdir -p "$ICONSET"
  for PARAMS in $SIZES; do
    SIZE=$(echo $PARAMS | cut -d, -f1)
    LABEL=$(echo $PARAMS | cut -d, -f2)
    svg2png -w $SIZE -h $SIZE "$SVG" "$ICONSET"/icon_$LABEL.png
  done
  iconutil -c icns "$ICONSET"
  ICNS="$BASE.icns"
  ORIG_ICNS=$(ls "$APP/Contents/Resources" | grep -m 1 .icns)
  cp "$ICNS" "$APP/Contents/Resources/$ORIG_ICNS"
  touch "$APP" # Resets icon cache

  # Cleanup
  rm -rf "$ICONSET"
  rm -f "$ICNS"
done

