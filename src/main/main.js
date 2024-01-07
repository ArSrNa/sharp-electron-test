/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import sharp from 'sharp';
import fs from 'fs';

let RESOURCES_PATH, getAssetPath;

class AppUpdater {
  constructor() {
    log.transports.file.level = "info";
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow = null;

ipcMain.on("ipc-example", async (event, arg) => {
  const msgTemplate = pingPong => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply("ipc-example", msgTemplate("pong"));
})

if (process.env.NODE_ENV === "production") {
  const sourceMapSupport = require("source-map-support");
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === "development" || process.env.DEBUG_PROD === "true";

if (isDebug) {
  require("electron-debug")();
}

const installExtensions = async () => {
  const installer = require("electron-devtools-installer");
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ["REACT_DEVELOPER_TOOLS"];

  return installer
    .default(
      extensions.map(name => installer[name]),
      forceDownload
    )
    .catch(console.log);
}

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, "assets")
    : path.join(__dirname, "../../assets")
  getAssetPath = (...paths) => {
    return path.join(RESOURCES_PATH, ...paths);
  }

  mainWindow = new BrowserWindow({
    show: false,
    width: 1200,
    height: 728,
    minWidth: 1200,
    minHeight: 600,
    icon: getAssetPath("icon.ico"),
    webPreferences: {
      webSecurity: false,
      // odeIntegration: true,
      // contextIsolation: false,
      // nodeIntegration: true,
      devTools: true,
      preload: app.isPackaged
        ? path.join(__dirname, "preload.js")
        : path.join(__dirname, "../../.erb/dll/preload.js")
    }
  })

  mainWindow.loadURL(resolveHtmlPath("index.html"));

  mainWindow.on("ready-to-show", () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  })

  mainWindow.on("closed", () => {
    mainWindow = null;
  })

  // const menuBuilder = new MenuBuilder(mainWindow)
  // menuBuilder.buildMenu()

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler(edata => {
    shell.openExternal(edata.url);
    return { action: "deny" };
  })

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
  Menu.setApplicationMenu(null);
}


app.on("window-all-closed", () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== "darwin") {
    app.quit();
  }
})

app.whenReady()
  .then(() => {
    createWindow()
    app.on("activate", () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow()
    })
  })
  .catch(console.log);


ipcMain.on('env', () => {
  mainWindow.webContents.send('env', app.isPackaged);
});


async function splitImage(buffer) {
  const img = sharp(buffer);
  const metadata = await img.metadata();
  const h = metadata.height, w = metadata.width;
  // console.log('split', { w, h });
  //↖
  const lti = img.clone().extract({
    left: 0,
    top: 0,
    width: w / 2,
    height: h / 2
  }).toBuffer();

  //↗
  const rti = img.clone().extract({
    left: w / 2,
    top: 0,
    width: w / 2,
    height: h / 2
  }).toBuffer();

  //↙
  const lbi = (img.clone().extract({
    left: 0,
    top: h / 2,
    width: w / 2,
    height: h / 2
  }).toBuffer());

  //↘
  const rbi = img.clone().extract({
    left: w / 2,
    top: h / 2,
    width: w / 2,
    height: h / 2
  }).toBuffer();
  console.log('Image split into quadrants and encoded as base64 successfully.');
  return await Promise.all([lti, rti, lbi, rbi]);
}

ipcMain.on('splitImage', (e, m) => {
  splitImage(fs.readFileSync(getAssetPath('./test.png')))
    .then(console.log)
    .catch(console.error);
})