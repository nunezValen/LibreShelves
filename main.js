const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 900,
    minWidth: 1100,
    minHeight: 700,

    frame: false,
    transparent: true,

    backgroundColor: "#00000000",

    titleBarStyle: "hidden",

    vibrancy: "under-window",

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(createWindow);

ipcMain.handle("file-exists", async (_, filePath) => {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }
  return fs.existsSync(filePath);
});

ipcMain.on("window-minimize", (event) => {
  BrowserWindow.fromWebContents(event.sender).minimize();
});

ipcMain.on("window-maximize", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on("window-close", (event) => {
  BrowserWindow.fromWebContents(event.sender).close();
});