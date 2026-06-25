const { spawnSync } = require('child_process');
const path = require('path');

const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
const args = ['bootJar', 'createMinimalJre'];

const result = spawnSync(path.resolve(gradlew), args, {
  stdio: 'inherit',
  shell: true,
  cwd: path.resolve(__dirname, '..'),
});

process.exit(result.status);
