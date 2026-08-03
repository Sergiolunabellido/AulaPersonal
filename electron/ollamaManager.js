const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const esWindows = process.platform === 'win32';
const OLLAMA_HOST = '127.0.0.1:11434';
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';

let procesoOllama = null;
let ultimoErrorOllama = null;
let logStream = null;

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

function escribirLog(mensaje) {
  if (!logStream) return;
  logStream.write(`[${new Date().toISOString()}] ${mensaje}\n`);
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

async function iniciarOllama(opciones = {}) {
  ultimoErrorOllama = null;

  if (opciones.logDir) {
    fs.mkdirSync(opciones.logDir, { recursive: true });
    logStream = fs.createWriteStream(path.join(opciones.logDir, 'ollama.log'), { flags: 'a' });
    escribirLog('===== inicio Ollama =====');
  }

  if (await comprobarOllamaOnline()) {
    escribirLog('Ollama ya estaba online');
    return { started: false, online: true };
  }

  const ollamaExe = obtenerRutaOllama();
  const modelsDir = obtenerDirectorioModelos();

  if (ollamaExe.includes(path.sep) && !fs.existsSync(ollamaExe)) {
    ultimoErrorOllama = `No se encontró el binario de Ollama: ${ollamaExe}`;
    escribirLog(ultimoErrorOllama);
    return { started: false, online: false, error: ultimoErrorOllama };
  }

  escribirLog(`Arrancando: ${ollamaExe} serve (models=${modelsDir})`);

  procesoOllama = spawn(ollamaExe, ['serve'], {
    env: {
      ...process.env,
      OLLAMA_HOST,
      OLLAMA_MODELS: modelsDir,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  procesoOllama.stdout.on('data', (chunk) => {
    if (logStream) logStream.write(chunk);
  });
  procesoOllama.stderr.on('data', (chunk) => {
    if (logStream) logStream.write(chunk);
  });
  procesoOllama.on('error', (err) => {
    ultimoErrorOllama = err.message;
    escribirLog('Ollama start error: ' + err.message);
    console.error('Ollama start error:', err.message);
  });
  procesoOllama.on('exit', (code, signal) => {
    escribirLog(`Ollama salió code=${code} signal=${signal}`);
  });

  const online = await esperarOllama();
  if (!online) {
    ultimoErrorOllama = ultimoErrorOllama
      || 'Ollama no respondió en http://127.0.0.1:11434 tras 30 s.';
    escribirLog(ultimoErrorOllama);
  } else {
    escribirLog('Ollama online');
  }

  return { started: true, online, error: online ? null : ultimoErrorOllama };
}

function detenerOllama() {
  if (procesoOllama) {
    procesoOllama.kill();
    procesoOllama = null;
  }
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

async function obtenerEstadoOllama() {
  const online = await comprobarOllamaOnline();
  return {
    online,
    host: OLLAMA_HOST,
    baseUrl: OLLAMA_BASE_URL,
    modelsDir: obtenerDirectorioModelos(),
    error: online ? null : ultimoErrorOllama,
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
