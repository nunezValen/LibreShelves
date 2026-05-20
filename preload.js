const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  fileExists: (filePath) => ipcRenderer.invoke("file-exists", filePath),
  getPathForFile: (file) => webUtils.getPathForFile(file),

  minimize: () => ipcRenderer.send("window-minimize"),
  maximize: () => ipcRenderer.send("window-maximize"),
  close: () => ipcRenderer.send("window-close")
});