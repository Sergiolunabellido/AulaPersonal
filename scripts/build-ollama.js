const { spawnSync } = require('child_process');
const path = require('path');

const result = spawnSync(process.execPath, [path.join(__dirname, 'download-ollama.js')], {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
});

process.exit(result.status ?? 0);
