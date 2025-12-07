const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    moveMouse: (x, y) => ipcRenderer.invoke('mouse-move', { x, y }),
    clickMouse: (type) => ipcRenderer.invoke('mouse-click', { type }),
    scrollMouse: (dy) => ipcRenderer.invoke('mouse-scroll', { dy }),
    tapKey: (key) => ipcRenderer.invoke('key-tap', { key })
});
