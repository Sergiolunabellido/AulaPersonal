const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';
const args = ['bootJar', 'createMinimalJre'];

const result = spawnSync(path.resolve(gradlew), args, {
  stdio: 'inherit',
  shell: true,
  cwd: root,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const jar = path.join(root, 'build', 'libs', 'AulaPersonal-0.0.1-SNAPSHOT.jar');
const javaExe = path.join(
  root,
  'build',
  'jre',
  'bin',
  process.platform === 'win32' ? 'java.exe' : 'java'
);

if (!fs.existsSync(jar)) {
  console.error('build-backend: no se generó el JAR en', jar);
  process.exit(1);
}
if (!fs.existsSync(javaExe)) {
  console.error('build-backend: no se generó el JRE en', javaExe);
  process.exit(1);
}

console.log('Backend listo: JAR + JRE OK');
process.exit(0);
