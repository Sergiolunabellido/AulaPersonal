const {app, BrowserWindow, ipcMain} = require('electron');
const path = require('path');
const { exec } = require('child_process');

let intervaloBloqueo = null;

function crearVentana(){
    const ventana = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences:{
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        }
    });

        ventana.loadFile('electron/renderer/index.html')
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
            exec(`taskkill /F /IM "${nombre}.exe" /T 2>nul`, () => {});
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

app.whenReady().then(crearVentana);
app.on('window-all-closed',() =>{
    if(process.platform !== 'darwin'){
        app.quit();
    }
})