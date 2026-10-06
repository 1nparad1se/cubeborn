#!/usr/bin/env bash
# Builds an unsigned Cubeborn.ipa from dist/ (run `npm run build` first) on macOS with Xcode.
# Sideloadly / AltStore re-sign it with the user's Apple ID during install.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=build/ios
APP=$OUT/Payload/Cubeborn.app
rm -rf "$OUT" && mkdir -p "$APP"

SDK_VER=$(xcrun --sdk iphoneos --show-sdk-version)
xcrun --sdk iphoneos swiftc -parse-as-library -O \
  -target arm64-apple-ios15.0 \
  ios/App.swift -o "$APP/Cubeborn"

cp ios/Info.plist "$APP/Info.plist"
plutil -insert DTPlatformName -string iphoneos "$APP/Info.plist"
plutil -insert DTPlatformVersion -string "$SDK_VER" "$APP/Info.plist"
plutil -insert DTSDKName -string "iphoneos$SDK_VER" "$APP/Info.plist"
plutil -lint "$APP/Info.plist"
cp ios/icons/*.png "$APP/"
cp -R dist "$APP/www"
printf 'APPL????' > "$APP/PkgInfo"

(cd "$OUT" && zip -qr -y Cubeborn.ipa Payload)
ls -la "$OUT/Cubeborn.ipa"
