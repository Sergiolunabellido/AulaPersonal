const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    obtenerIcono: (ruta) => ipcRenderer.invoke('obtener-icono', ruta),
    bloquearApps: (apps, minutos) => ipcRenderer.invoke('bloquear-apps', apps, minutos),
    desbloquearTodo: () => ipcRenderer.invoke('desbloquear-todo'),
});
