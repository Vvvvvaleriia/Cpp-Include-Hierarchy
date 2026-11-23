const { app, BrowserWindow, Menu, dialog } = require("electron");
const path = require("path");

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

	const menu = Menu.buildFromTemplate([
		{
			label: "Файл",
			submenu: [
				{
					label: "Відкрити",
					accelerator: "CmdOrCtrl+O",
					click: openFile,
				},
				{ label: "Відкрити папку", click: openFolder },
				{ type: "separator" },
				{ label: "Вихід", role: "quit" },
			],
		},
		{
			label: "Вигляд",
			submenu: [{ role: "toggleDevTools" }],
		},
	]);
	Menu.setApplicationMenu(menu);
}

async function openFile() {
	const result = await dialog.showOpenDialog(mainWindow, {
		title: "Оберіть головний файл проекту",
		properties: ["openFile"],
		filters: [
			{ name: "C++ (*.cpp, *.h, *.rc)", extensions: ["cpp", "h", "rc"] },
		],
	});

	if (result.canceled) return;

	const file = result.filePaths[0];
	mainWindow.webContents.send("open-project", path.dirname(file), file);
}

async function openFolder() {
	const result = await dialog.showOpenDialog(mainWindow, {
		title: "Виберіть папку проекту",
		properties: ["openDirectory"],
	});
	if (result.canceled) return;

	mainWindow.webContents.send("open-project", result.filePaths[0], null);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit);
