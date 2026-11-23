const { app, BrowserWindow } = require("electron");

let mainWindow;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 900,
		height: 600,
		title: "Ієрархія #include",
		webPreferences: {
			nodeIntegration: true,
			contextIsolation: false,
		},
	});
	mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit);
