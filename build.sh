#!/bin/bash

echo "🔥  Cleaning build directory"
rm -fr build

echo
echo "📚  Compiling source files"
npm run babel -- --source-maps --out-dir build --ignore __tests__ src

echo
echo "💧  Creating .js.flow files"
while read filepath; do
  destination="$(echo $filepath | sed 's#^src/#build/#g').flow"
  cp $filepath $destination
done < <(find src -name '*.js' -not -path '*/__tests__/*')

echo
echo "🆗  Build finished"
