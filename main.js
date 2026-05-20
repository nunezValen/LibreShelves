const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

function createWindow() {
  // choose an icon: prefer build/icons/app.ico (created when packaging), fallback to root logo.png
  const defaultIcon = path.join(__dirname, 'logo.png');
  const packagedIcon = path.join(__dirname, 'build', 'icons', 'app.ico');
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
  // set window icon if available (Windows uses .ico)
  try {
    const iconPath = fs.existsSync(packagedIcon) ? packagedIcon : (fs.existsSync(defaultIcon) ? defaultIcon : null);
    if (iconPath) win.setIcon(iconPath);
  } catch (e) {
    // ignore
  }

  win.loadFile(path.join(__dirname, "src", "index.html"));
}

app.whenReady().then(createWindow);

ipcMain.handle("file-exists", async (_, filePath) => {
  if (!filePath || typeof filePath !== "string") {
    return false;
  }
  return fs.existsSync(filePath);
});

ipcMain.handle("find-cue", async (_, audioPath) => {
  if (!audioPath || typeof audioPath !== 'string') return null;
  try {
    const dir = path.dirname(audioPath);
    const base = path.basename(audioPath).replace(/\.[^.]+$/, '');
    const exact = path.join(dir, base + '.cue');
    if (fs.existsSync(exact)) return exact;
    const files = fs.readdirSync(dir);
    const cue = files.find(f => f.toLowerCase().endsWith('.cue'));
    if (cue) return path.join(dir, cue);
    return null;
  } catch (e) {
    return null;
  }
});

ipcMain.handle("read-file", async (_, filePath) => {
  if (!filePath || typeof filePath !== 'string') return null;
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (e) {
    return null;
  }
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