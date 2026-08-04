/**
 * Comprueba que existen los recursos necesarios para empaquetar la app.
 * Uso: node scripts/verify-packaging-resources.js [--linux]
 * --linux: verifica binarios Linux (java / ollama) aunque el host sea Windows.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const forLinux = process.argv.includes('--linux');
const usarBinariosWindows = !forLinux && process.platform === 'win32';

const required = [
  path.join(root, 'build', 'libs', 'AulaPersonal-0.0.1-SNAPSHOT.jar'),
  path.join(root, 'build', 'jre', 'bin', usarBinariosWindows ? 'java.exe' : 'java'),
  path.join(root, 'build', 'ollama', usarBinariosWindows ? 'ollama.exe' : 'ollama'),
];

const missing = required.filter((p) => !fs.existsSync(p));

if (missing.length > 0) {
  console.error('Faltan recursos para empaquetar la aplicación:');
  for (const p of missing) {
    console.error('  - ' + p);
  }
  console.error(forLinux
    ? 'Ejecuta: npm run build:backend && node scripts/prepare-linux-resources.js'
    : 'Ejecuta: npm run build:backend && npm run build:ollama');
  process.exit(1);
}

console.log('Recursos de empaquetado OK' + (forLinux ? ' (Linux)' : '') + ':');
for (const p of required) {
  const sizeMb = (fs.statSync(p).size / (1024 * 1024)).toFixed(1);
  console.log(`  - ${path.relative(root, p)} (${sizeMb} MB)`);
}
