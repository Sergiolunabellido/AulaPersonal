const {app, BrowserWindow, ipcMain, safeStorage, dialog} = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { iniciarOllama, detenerOllama, obtenerEstadoOllama } = require('./ollamaManager');
const { ejecutarSetupInicial, obtenerEstadoSetup } = require('./ollamaSetup');

const esWindows = process.platform === 'win32';
const esLinux = process.platform === 'linux';

let intervaloBloqueo = null;
let procesoBackend = null;
let ventanaPrincipal = null;
let estadoBackend = {
  online: false,
  error: null,
  javaExe: null,
  jar: null,
  logFile: null,
};

function obtenerDirLogs() {
  const dir = path.join(app.getPath('userData'), 'logs');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function crearEscritorLog(nombre) {
  const logFile = path.join(obtenerDirLogs(), nombre);
  const stream = fs.createWriteStream(logFile, { flags: 'a' });
  const stamp = () => new Date().toISOString();
  stream.write(`\n===== ${stamp()} =====\n`);
  return { logFile, stream, stamp };
}

function obtenerJavaEjecutable() {
  if (app.isPackaged) {
    const rutaJre = path.join(process.resourcesPath, 'jre', 'bin');
    return path.join(rutaJre, esWindows ? 'java.exe' : 'java');
  }
  const jreLocal = path.join(__dirname, '..', 'build', 'jre', 'bin', esWindows ? 'java.exe' : 'java');
  if (fs.existsSync(jreLocal)) {
    return jreLocal;
  }
  return 'java';
}

function obtenerRutaJar() {
  const nombreJar = 'AulaPersonal-0.0.1-SNAPSHOT.jar';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', nombreJar);
  }
  return path.join(__dirname, '..', 'build', 'libs', nombreJar);
}

function matarProceso(nombre) {
  if (esWindows) {
    execFile('taskkill', ['/F', '/IM', `${nombre}.exe`, '/T'], { windowsHide: true }, () => {});
  } else {
    execFile('pkill', ['-f', nombre], () => {});
  }
}

function mostrarErrorArranque(titulo, detalle) {
  const logHint = estadoBackend.logFile
    ? `\n\nRegistro: ${estadoBackend.logFile}`
    : '';
  dialog.showErrorBox(titulo, `${detalle}${logHint}`);
}

async function iniciarBackend() {
  const javaExe = obtenerJavaEjecutable();
  const rutaJar = obtenerRutaJar();
  const rutaDatosUsuario = app.getPath('userData');
  const { logFile, stream, stamp } = crearEscritorLog('backend.log');

  estadoBackend = {
    online: false,
    error: null,
    javaExe,
    jar: rutaJar,
    logFile,
  };

  if (!fs.existsSync(rutaJar)) {
    estadoBackend.error = `No se encontró el backend JAR:\n${rutaJar}`;
    stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
    stream.end();
    mostrarErrorArranque('Backend no disponible', estadoBackend.error);
    return false;
  }

  if (javaExe !== 'java' && !fs.existsSync(javaExe)) {
    estadoBackend.error = `No se encontró el JRE embebido:\n${javaExe}`;
    stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
    stream.end();
    mostrarErrorArranque('Backend no disponible', estadoBackend.error);
    return false;
  }

  stream.write(`[${stamp()}] Iniciando: ${javaExe} -jar ${rutaJar}\n`);

  procesoBackend = spawn(javaExe, ['-jar', rutaJar], {
    env: {
      ...process.env,
      APP_DATA_DIR: rutaDatosUsuario,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  procesoBackend.stdout.on('data', (chunk) => stream.write(chunk));
  procesoBackend.stderr.on('data', (chunk) => stream.write(chunk));
  procesoBackend.on('error', (err) => {
    estadoBackend.error = `Error al arrancar el backend: ${err.message}`;
    stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
    console.error('Backend start error:', err.message);
  });
  procesoBackend.on('exit', (code, signal) => {
    stream.write(`[${stamp()}] Backend salió code=${code} signal=${signal}\n`);
    if (!estadoBackend.online) {
      estadoBackend.error = estadoBackend.error
        || `El backend terminó antes de estar listo (code=${code}).`;
    }
  });

  const listo = await esperarBackend();
  if (listo) {
    estadoBackend.online = true;
    stream.write(`[${stamp()}] Backend listo en http://localhost:8080\n`);
    return true;
  }

  estadoBackend.error = estadoBackend.error
    || 'El backend no respondió en http://localhost:8080 tras 30 s.';
  stream.write(`[${stamp()}] ${estadoBackend.error}\n`);
  mostrarErrorArranque(
    'Backend no disponible',
    'Chat AI, Música y Notas necesitan el servidor local.\n\n' + estadoBackend.error
  );
  return false;
}

function esperarBackend() {
  return new Promise((resolve) => {
    const http = require('http');
    let intentos = 0;

    function comprobar() {
      if (procesoBackend && procesoBackend.exitCode !== null) {
        resolve(false);
        return;
      }

      intentos++;
      const req = http.get('http://localhost:8080/api/notas', (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      });
      req.on('error', () => {
        if (intentos >= 30) {
          resolve(false);
        } else {
          setTimeout(comprobar, 1000);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
      });
      req.end();
    }

    comprobar();
  });
}

function crearVentana() {
  ventanaPrincipal = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      // El Pomodoro (y el widget de la sidebar) deben seguir ticando al minimizar
      backgroundThrottling: false,
    },
  });

  ventanaPrincipal.loadFile('electron/renderer/index.html');
  // Por si la preferencia no aplica en alguna versión: forzar en webContents
  ventanaPrincipal.webContents.setBackgroundThrottling(false);

  if (esLinux) {
    ventanaPrincipal.setIcon(path.join(__dirname, 'renderer', 'assets', 'imagenes', 'mobile_profile.svg'));
  }
}

ipcMain.handle('obtener-icono', async (_event, ruta) => {
  try {
    const icono = await app.getFileIcon(ruta, { size: 'small' });
    return icono.toDataURL();
  } catch (_) {
    return '';
  }
});

ipcMain.handle('backend-status', () => ({ ...estadoBackend }));

ipcMain.handle('ollama-status', async () => {
  return obtenerEstadoOllama();
});

ipcMain.handle('ollama-setup-status', () => {
  return obtenerEstadoSetup();
});

ipcMain.handle('guardar-api-key', (_event, provider, key) => {
  if (!safeStorage.isEncryptionAvailable()) {
    return { ok: false, error: 'encryption_unavailable' };
  }
  try {
    const encrypted = safeStorage.encryptString(key);
    return { ok: true, data: encrypted.toString('base64') };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('obtener-api-key', (_event, encryptedBase64) => {
  if (!safeStorage.isEncryptionAvailable() || !encryptedBase64) {
    return { ok: false, value: '' };
  }
  try {
    const buffer = Buffer.from(encryptedBase64, 'base64');
    return { ok: true, value: safeStorage.decryptString(buffer) };
  } catch (err) {
    return { ok: false, error: err.message, value: '' };
  }
});

ipcMain.handle('bloquear-apps', (_event, nombresApps, minutos) => {
  if (intervaloBloqueo) clearInterval(intervaloBloqueo);

  const duracionMs = minutos * 60 * 1000;
  const inicio = Date.now();

  intervaloBloqueo = setInterval(() => {
    if (Date.now() - inicio >= duracionMs) {
      clearInterval(intervaloBloqueo);
      intervaloBloqueo = null;
      return;
    }
    for (const nombre of nombresApps) {
      matarProceso(nombre);
    }
  }, 2000);

  return true;
});

ipcMain.handle('desbloquear-todo', () => {
  if (intervaloBloqueo) {
    clearInterval(intervaloBloqueo);
    intervaloBloqueo = null;
  }
  return true;
});

app.whenReady().then(async () => {
  const ollama = await iniciarOllama({
    logDir: obtenerDirLogs(),
  });
  if (!ollama.online) {
    console.error('Ollama no está disponible al arrancar:', ollama.error || 'offline');
  }

  await iniciarBackend();
  crearVentana();
  ejecutarSetupInicial().catch((err) => {
    console.error('Ollama setup error:', err.message);
  });
});

app.on('will-quit', () => {
  detenerOllama();
  if (procesoBackend) {
    procesoBackend.kill();
    procesoBackend = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
