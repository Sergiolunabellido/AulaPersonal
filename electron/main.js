const {app, BrowserWindow, ipcMain, safeStorage, protocol, net, dialog} = require('electron');
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

function obtenerJavaEjecutable() {
  if (app.isPackaged) {
    const rutaJre = path.join(process.resourcesPath, 'jre', 'bin');
    return path.join(rutaJre, esWindows ? 'java.exe' : 'java');
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

async function iniciarBackend() {
  const javaExe = obtenerJavaEjecutable();
  const rutaJar = obtenerRutaJar();
  const rutaDatosUsuario = app.getPath('userData');

  procesoBackend = spawn(javaExe, ['-jar', rutaJar], {
    env: {
      ...process.env,
      APP_DATA_DIR: rutaDatosUsuario,
    },
    stdio: 'ignore',
  });

  procesoBackend.on('error', (err) => {
    console.error('Backend start error:', err.message);
  });

  await esperarBackend();
}

function esperarBackend() {
  return new Promise((resolve) => {
    const http = require('http');
    let intentos = 0;

    function comprobar() {
      intentos++;
      const req = http.get('http://localhost:8080/api/notas', () => {
        resolve();
      });
      req.on('error', () => {
        if (intentos >= 30) {
          resolve();
        } else {
          setTimeout(comprobar, 1000);
        }
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
    },
  });

  ventanaPrincipal.loadFile('electron/renderer/index.html');

  if (esLinux) {
    ventanaPrincipal.setIcon(path.join(__dirname, 'renderer', 'assets', 'imagenes', 'mobile_profile.svg'));
  }
}

async function obtenerIcono(ruta) {
  try {
    const icono = await app.getFileIcon(ruta, { size: 'small' });
    return icono.toDataURL();
  } catch (_) {
    return '';
  }
}

ipcMain.handle('obtener-icono', async (_event, ruta) => {
  return await obtenerIcono(ruta);
});

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

ipcMain.handle('escoger-carpeta', async () => {
  const result = await dialog.showOpenDialog(ventanaPrincipal, {
    properties: ['openDirectory']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('escanear-carpeta', async (_event, ruta) => {
  const archivosMusica = [];
  const extensiones = new Set(['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac']);

  function escanear(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const rutaCompleta = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          escanear(rutaCompleta);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensiones.has(ext)) {
            archivosMusica.push({
              ruta: rutaCompleta,
              nombre: entry.name,
              titulo: path.basename(entry.name, ext),
              artista: '',
              album: '',
            });
          }
        }
      }
    } catch (_) {}
  }

  escanear(ruta);
  return archivosMusica;
});

app.whenReady().then(async () => {
  await iniciarOllama();
  await iniciarBackend();
  crearVentana();
  ejecutarSetupInicial().catch((err) => {
    console.error('Ollama setup error:', err.message);
  });
});

app.on('ready', () => {
  protocol.handle('local-audio', (request) => {
    const filePath = decodeURIComponent(request.url.slice('local-audio://'.length));
    return net.fetch('file:///' + filePath);
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
