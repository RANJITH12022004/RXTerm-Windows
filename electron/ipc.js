// electron/ipc.js
const { ipcMain, BrowserWindow, shell } = require('electron');

ipcMain.on('win:minimize', () => BrowserWindow.getFocusedWindow()?.minimize());
ipcMain.on('win:maximize', () => {
  const win = BrowserWindow.getFocusedWindow();
  win?.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win:close', () => BrowserWindow.getFocusedWindow()?.close());

ipcMain.handle('shell:openExternal', (_, url) => shell.openExternal(url));
ipcMain.handle('shell:openPath', (_, path) => shell.openPath(path));
