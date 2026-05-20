const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  fileExists: (filePath) => ipcRenderer.invoke("file-exists", filePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),
  findCue: (audioPath) => ipcRenderer.invoke('find-cue', audioPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),

  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close")
});