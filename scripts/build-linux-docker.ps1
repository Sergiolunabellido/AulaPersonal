docker run --rm -v ${PWD}:C:\project -w C:\project `
  --entrypoint bash `
  node:20 -c "
    apt-get update -qq && apt-get install -y -qq gradle
    npm install
    npm run build:backend
    npx electron-builder --linux --config.extraMetadata.build.linux.target='[\"AppImage\"]'
  "
