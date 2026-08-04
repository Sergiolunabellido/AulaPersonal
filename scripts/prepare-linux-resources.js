const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BUILD = path.join(ROOT, 'build');
const JRE_DIR = path.join(BUILD, 'jre');
const OLLAMA_DIR = path.join(BUILD, 'ollama');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
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

async function prepareJre() {
  console.log('Preparando JRE para Linux…');

  if (fs.existsSync(JRE_DIR)) {
    fs.rmSync(JRE_DIR, { recursive: true });
  }

  const url = 'https://api.adoptium.net/v3/binary/latest/17/ga/linux/x64/jdk/hotspot/normal/eclipse';
  const archive = path.join(BUILD, 'jdk-linux.tar.gz');

  console.log('Descargando JDK 17 para Linux…');
  await download(url, archive);

  console.log('Extrayendo…');
  fs.mkdirSync(JRE_DIR, { recursive: true });
  execSync(`tar -xzf "${archive}" -C "${JRE_DIR}" --strip-components=1`, { stdio: 'inherit' });
  fs.unlinkSync(archive);

  const javaBin = path.join(JRE_DIR, 'bin', 'java');
  if (fs.existsSync(javaBin)) {
    fs.chmodSync(javaBin, 0o755);
  }

  console.log('JRE Linux listo');
}

async function prepareOllama() {
  console.log('Preparando Ollama para Linux…');

  if (fs.existsSync(OLLAMA_DIR)) {
    fs.rmSync(OLLAMA_DIR, { recursive: true });
  }

  const url = 'https://github.com/ollama/ollama/releases/download/v0.6.5/ollama-linux-amd64.tgz';
  const archive = path.join(BUILD, 'ollama-linux.tgz');

  console.log('Descargando Ollama para Linux…');
  await download(url, archive);

  console.log('Extrayendo…');
  fs.mkdirSync(OLLAMA_DIR, { recursive: true });
  execSync(`tar -xzf "${archive}" -C "${OLLAMA_DIR}"`, { stdio: 'inherit' });
  fs.unlinkSync(archive);

  const ollamaNested = path.join(OLLAMA_DIR, 'bin', 'ollama');
  const ollamaBin = path.join(OLLAMA_DIR, 'ollama');
  if (fs.existsSync(ollamaNested) && !fs.existsSync(ollamaBin)) {
    fs.copyFileSync(ollamaNested, ollamaBin);
  }
  if (fs.existsSync(ollamaBin)) {
    fs.chmodSync(ollamaBin, 0o755);
  }
  if (!fs.existsSync(ollamaBin)) {
    throw new Error('binario ollama no encontrado tras extraer el tgz');
  }

  // Las libs CUDA pesan varios GB y usan symlinks que Windows no empaqueta bien.
  // Ollama CPU sigue funcionando sin ellas.
  for (const cudaDir of ['cuda_v11', 'cuda_v12']) {
    const full = path.join(OLLAMA_DIR, 'lib', 'ollama', cudaDir);
    if (fs.existsSync(full)) {
      fs.rmSync(full, { recursive: true, force: true });
      console.log(`Omitido ${cudaDir} (solo CPU)`);
    }
  }

  console.log('Ollama Linux listo');
}

async function main() {
  await prepareJre();
  await prepareOllama();
}

main().catch((err) => {
  console.error('prepare-linux-resources:', err.message);
  process.exit(1);
});
