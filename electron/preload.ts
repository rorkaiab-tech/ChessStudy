import { contextBridge } from 'electron';
contextBridge.exposeInMainWorld('electron', { env: process.env });
