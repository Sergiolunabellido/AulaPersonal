const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const { execFile, spawn } = require('child_process');

const isWin = process.platform === 'win32';
const isLinux = process.platform === 'linux';

let intervaloBloqueo = null;
let backendProcess = null;

function getJavaExe() {
  if (app.isPackaged) {
    const jreBin = path.join(process.resourcesPath, 'jre', 'bin');
    return path.join(jreBin, isWin ? 'java.exe' : 'java');
  }
  return 'java';
}

function getJarPath() {
  const jarName = 'AulaPersonal-0.0.1-SNAPSHOT.jar';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'backend', jarName);
  }
  return path.join(__dirname, '..', 'build', 'libs', jarName);
}

function killProcess(nombre) {
  if (isWin) {
    execFile('taskkill', ['/F', '/IM', `${nombre}.exe`, '/T'], { windowsHide: true }, () => {});
  } else {
    execFile('pkill', ['-f', nombre], () => {});
  }
}

async function startBackend() {
  const javaExe = getJavaExe();
  const jarPath = getJarPath();
  const userDataPath = app.getPath('userData');

  backendProcess = spawn(javaExe, ['-jar', jarPath], {
    env: {
      ...process.env,
      APP_DATA_DIR: userDataPath,
    },
    stdio: 'ignore',
  });

  backendProcess.on('error', (err) => {
    console.error('Backend start error:', err.message);
  });

  await waitForBackend();
}

function waitForBackend() {
  return new Promise((resolve) => {
    const http = require('http');
    let attempts = 0;

    function check() {
      attempts++;
      const req = http.get('http://localhost:8080/api/notas', () => {
        resolve();
      });
      req.on('error', () => {
        if (attempts >= 30) {
          resolve();
        } else {
          setTimeout(check, 1000);
        }
      });
      req.end();
    }

    check();
  });
}

function crearVentana() {
  const ventana = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  ventana.loadFile('electron/renderer/index.html');

  if (isLinux) {
    ventana.setIcon(path.join(__dirname, 'renderer', 'assets', 'imagenes', 'mobile_profile.svg'));
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
      killProcess(nombre);
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
  await startBackend();
  crearVentana();
});

app.on('will-quit', () => {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
