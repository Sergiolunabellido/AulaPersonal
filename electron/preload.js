const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    obtenerIcono: (ruta) => ipcRenderer.invoke('obtener-icono', ruta),
    bloquearApps: (apps, minutos) => ipcRenderer.invoke('bloquear-apps', apps, minutos),
    desbloquearTodo: () => ipcRenderer.invoke('desbloquear-todo'),
    getBackendStatus: () => ipcRenderer.invoke('backend-status'),
    getOllamaStatus: () => ipcRenderer.invoke('ollama-status'),
    getOllamaSetupStatus: () => ipcRenderer.invoke('ollama-setup-status'),
    onOllamaSetupProgress: (callback) => {
        const listener = (_event, payload) => callback(payload);
        ipcRenderer.on('ollama-setup-progress', listener);
        return () => ipcRenderer.removeListener('ollama-setup-progress', listener);
    },
    guardarApiKey: (provider, key) => ipcRenderer.invoke('guardar-api-key', provider, key),
    obtenerApiKey: (encryptedBase64) => ipcRenderer.invoke('obtener-api-key', encryptedBase64),
});
