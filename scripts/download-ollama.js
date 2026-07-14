/**
 * Descarga el binario de Ollama para empaquetarlo en extraResources.
 * Si la descarga falla, el modo desarrollo usará `ollama` del PATH del sistema.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const OUT_DIR = path.join(__dirname, '..', 'build', 'ollama');
const platform = process.platform;
const arch = process.arch === 'arm64' ? 'arm64' : 'amd64';

const ASSETS = {
  win32: {
    url: 'https://github.com/ollama/ollama/releases/download/v0.6.5/ollama-windows-amd64.zip',
    extract: 'zip',
  },
  linux: {
    url: `https://github.com/ollama/ollama/releases/download/v0.6.5/ollama-linux-${arch}.tgz`,
    extract: 'tgz',
  },
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        file.close();
        fs.unlinkSync(dest);
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} al descargar ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

function extract(asset, archivePath) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (asset.extract === 'zip' && platform === 'win32') {
    execSync(
      `powershell -NoProfile -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${OUT_DIR}' -Force"`,
      { stdio: 'inherit' }
    );
    const exe = path.join(OUT_DIR, 'ollama.exe');
    if (!fs.existsSync(exe)) {
      throw new Error('ollama.exe no encontrado tras extraer el zip');
    }
  } else if (asset.extract === 'tgz') {
    execSync(`tar -xzf "${archivePath}" -C "${OUT_DIR}"`, { stdio: 'inherit' });
    const bin = path.join(OUT_DIR, 'ollama');
    if (fs.existsSync(bin)) {
      fs.chmodSync(bin, 0o755);
    }
  }
}

async function main() {
  const asset = ASSETS[platform];
  if (!asset) {
    console.warn(`Plataforma ${platform} no soportada para empaquetar Ollama. Se usará PATH en runtime.`);
    process.exit(0);
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const archivePath = path.join(OUT_DIR, platform === 'win32' ? 'ollama.zip' : 'ollama.tgz');

  console.log(`Descargando Ollama desde ${asset.url}…`);
  await download(asset.url, archivePath);
  console.log('Extrayendo…');
  extract(asset, archivePath);
  fs.unlinkSync(archivePath);
  console.log(`Ollama listo en ${OUT_DIR}`);
}

main().catch((err) => {
  console.error('download-ollama:', err.message);
  console.warn('Continúa el build; en runtime se intentará usar ollama del PATH.');
  process.exit(0);
});
