const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const esWindows = process.platform === 'win32';
const OLLAMA_HOST = '127.0.0.1:11434';
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

let procesoOllama = null;

function obtenerDirectorioModelos() {
  const dir = path.join(app.getPath('userData'), 'ollama', 'models');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function obtenerRutaOllama() {
  if (app.isPackaged) {
    const empaquetado = path.join(
      process.resourcesPath,
      'ollama',
      esWindows ? 'ollama.exe' : 'ollama'
    );
    if (fs.existsSync(empaquetado)) return empaquetado;
  }

  const localBuild = path.join(__dirname, '..', 'build', 'ollama', esWindows ? 'ollama.exe' : 'ollama');
  if (fs.existsSync(localBuild)) return localBuild;

  return esWindows ? 'ollama.exe' : 'ollama';
}

function comprobarOllamaOnline() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_BASE_URL}/api/tags`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

function esperarOllama(maxIntentos = 30) {
  return new Promise(async (resolve) => {
    for (let i = 0; i < maxIntentos; i++) {
      if (await comprobarOllamaOnline()) {
        resolve(true);
        return;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    resolve(false);
  });
}

async function iniciarOllama() {
  if (await comprobarOllamaOnline()) {
    return { started: false, online: true };
  }

  const ollamaExe = obtenerRutaOllama();
  const modelsDir = obtenerDirectorioModelos();

  procesoOllama = spawn(ollamaExe, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST,
      OLLAMA_MODELS: modelsDir,
    },
    stdio: 'ignore',
    windowsHide: true,
  });

  procesoOllama.on('error', (err) => {
    console.error('Ollama start error:', err.message);
  });

  const online = await esperarOllama();
  return { started: true, online };
}

function detenerOllama() {
  if (procesoOllama) {
    procesoOllama.kill();
    procesoOllama = null;
  }
}

async function obtenerEstadoOllama() {
  const online = await comprobarOllamaOnline();
  return {
    online,
    host: OLLAMA_HOST,
    baseUrl: OLLAMA_BASE_URL,
    modelsDir: obtenerDirectorioModelos(),
  };
}

module.exports = {
  OLLAMA_BASE_URL,
  iniciarOllama,
  detenerOllama,
  esperarOllama,
  comprobarOllamaOnline,
  obtenerEstadoOllama,
  obtenerRutaOllama,
};
