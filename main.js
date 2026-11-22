import { app, BrowserWindow } from "electron";

let mainWindow;

function createWindow() {
	mainWindow = new BrowserWindow({
		width: 900,
		height: 600,
		title: "Ієрархія #include",
	});
	mainWindow.loadFile("index.html");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit);
