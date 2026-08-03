/**
 * Comprueba que existen los recursos necesarios para empaquetar la app.
 * Falla con exit 1 si falta JAR, JRE o binario de Ollama.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const esWindows = process.platform === 'win32';

const required = [
  path.join(root, 'build', 'libs', 'AulaPersonal-0.0.1-SNAPSHOT.jar'),
  path.join(root, 'build', 'jre', 'bin', esWindows ? 'java.exe' : 'java'),
  path.join(root, 'build', 'ollama', esWindows ? 'ollama.exe' : 'ollama'),
];

const missing = required.filter((p) => !fs.existsSync(p));

if (missing.length > 0) {
  console.error('Faltan recursos para empaquetar la aplicación:');
  for (const p of missing) {
    console.error('  - ' + p);
  }
  console.error('Ejecuta: npm run build:backend && npm run build:ollama');
  process.exit(1);
}

console.log('Recursos de empaquetado OK:');
for (const p of required) {
  const sizeMb = (fs.statSync(p).size / (1024 * 1024)).toFixed(1);
  console.log(`  - ${path.relative(root, p)} (${sizeMb} MB)`);
}
