
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    title: "Litio Dashboard • Gestión Logística",
    icon: path.join(__dirname, 'icon.png'), // Asegúrate de tener un icono si lo deseas
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  // En desarrollo, cargamos el servidor local
  // En producción, cargaríamos el index.html compilado
  win.loadFile('index.html');
  
  // Opcional: Quitar menú por defecto para apariencia más "app"
  win.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
