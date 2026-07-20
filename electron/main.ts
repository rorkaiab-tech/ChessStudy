import { BrowserWindow } from 'electron';
import path from 'path';

export function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#0f1117',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
    titleBarStyle: 'hiddenInset',
    show: false,
  });
  win.loadFile('dist/renderer/index.html');
  win.once('ready-to-show', () => win.show());
  return win;
}
