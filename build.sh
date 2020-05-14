#!/usr/bin/env bash
set -e

echo "🔥  Cleaning build directory"
rm -fr build

echo
echo "📚  Compiling source files"
yarn tsc

echo
echo "🆗  Build finished"
