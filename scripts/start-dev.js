const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const raiz = path.resolve(__dirname, '..');
const jar = path.join(raiz, 'build', 'libs', 'AulaPersonal-0.0.1-SNAPSHOT.jar');
const gradlew = process.platform === 'win32' ? '.\\gradlew.bat' : './gradlew';

function mtimeMs(ruta) {
  try {
    return fs.statSync(ruta).mtimeMs;
  } catch (_) {
    return 0;
  }
}

function necesitaRebuild() {
  if (!fs.existsSync(jar)) {
    return true;
  }
  const jarMtime = mtimeMs(jar);
  const srcDir = path.join(raiz, 'src', 'main', 'java');
  let masReciente = jarMtime;

  function recorrer(dir) {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const ruta = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        recorrer(ruta);
      } else if (entrada.isFile() && entrada.name.endsWith('.java')) {
        masReciente = Math.max(masReciente, mtimeMs(ruta));
      }
    }
  }

  recorrer(srcDir);
  return masReciente > jarMtime;
}

if (necesitaRebuild()) {
  console.log('[dev] Compilando backend (código más reciente que el JAR)...');
  const build = spawnSync(gradlew, ['bootJar', '-q'], {
    cwd: raiz,
    stdio: 'inherit',
    shell: true,
  });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }
}

const electron = spawn('npx', ['electron', '.'], {
  cwd: raiz,
  stdio: 'inherit',
  shell: true,
});

electron.on('exit', (code) => process.exit(code ?? 0));
