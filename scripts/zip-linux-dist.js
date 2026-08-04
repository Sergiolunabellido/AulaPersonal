/**
 * Empaqueta dist/linux-unpacked en un .tar.gz distribuible.
 * Prefiere WSL (mejor con symlinks Linux); fallback a tar de Windows.
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const unpacked = path.join(dist, 'linux-unpacked');
const outTar = path.join(dist, 'AulaPersonal-linux-x64.tar.gz');

if (!fs.existsSync(unpacked)) {
  console.error('No existe dist/linux-unpacked. Ejecuta antes electron-builder --linux dir');
  process.exit(1);
}

if (fs.existsSync(outTar)) {
  fs.unlinkSync(outTar);
}

function tieneWsl() {
  const res = spawnSync('wsl', ['--status'], { encoding: 'utf8' });
  return res.status === 0;
}

function aRutaWsl(windowsPath) {
  const abs = path.resolve(windowsPath);
  const m = abs.match(/^([A-Za-z]):\\(.*)$/);
  if (!m) return abs.replace(/\\/g, '/');
  return `/mnt/${m[1].toLowerCase()}/${m[2].replace(/\\/g, '/')}`;
}

if (tieneWsl()) {
  const distWsl = aRutaWsl(dist);
  const outWsl = aRutaWsl(outTar);
  console.log('Empaquetando con WSL tar…');
  execSync(
    `wsl -e bash -lc "cd '${distWsl}' && tar -czf '${outWsl}' linux-unpacked"`,
    { stdio: 'inherit' }
  );
} else {
  console.log('Empaquetando con tar de Windows…');
  try {
    execSync(`tar -czf "${outTar}" -C "${dist}" linux-unpacked`, { stdio: 'inherit' });
  } catch (err) {
    if (!fs.existsSync(outTar)) throw err;
    console.warn('tar avisó de archivos especiales; se usa el archivo generado igualmente.');
  }
}

if (!fs.existsSync(outTar)) {
  console.error('No se generó el archivo tar.gz');
  process.exit(1);
}

const sizeMb = (fs.statSync(outTar).size / (1024 * 1024)).toFixed(1);
console.log(`Linux pack listo: ${outTar} (${sizeMb} MB)`);
