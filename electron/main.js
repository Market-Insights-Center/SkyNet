const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const robot = require('robotjs');

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Load the VPS URL directly
    win.loadURL('https://marketinsightscenter.com');
    // win.webContents.openDevTools(); // Uncomment for debugging
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- NATIVE AUTOMATION HANDLERS ---

ipcMain.handle('mouse-move', (event, { x, y }) => {
    // Map normalized (0-1) coordinates to screen size
    const screenSize = robot.getScreenSize();
    const targetX = x * screenSize.width;
    const targetY = y * screenSize.height;
    robot.moveMouse(targetX, targetY);
});

ipcMain.handle('mouse-click', (event, { type }) => {
    if (type === 'left') robot.mouseClick('left');
    if (type === 'right') robot.mouseClick('right');
    if (type === 'double') robot.mouseClick('left', true);
});

ipcMain.handle('mouse-scroll', (event, { dy }) => {
    // RobotJS scroll is platform dependent, usually requires positive/negative direction
    robot.scrollMouse(0, dy * 10);
});

ipcMain.handle('key-tap', (event, { key }) => {
    try {
        robot.keyTap(key);
    } catch (e) {
        console.error("Key tap failed:", key, e);
    }
});
