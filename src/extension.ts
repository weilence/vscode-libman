// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Libman } from './libman';
import { Command } from './command';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "libman" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let command = new Command('dotnet', [], [{ name: '--version', value: '' }]);
	try {
		await command.exec();
	} catch (error) {
		vscode.window.showErrorMessage('dotnet not found. you should install dotnet core first.');
		return;
	}

	let libman = new Libman(context.extensionPath);

	let isExist = await libman.isExist();
	if (!isExist) {
		await libman.installTool();
	}

	let disposable = vscode.commands.registerCommand('libman.init', async () => {
		try {
			await libman.init();
		} catch (error) {
			if (error) {
				vscode.window.showErrorMessage(error);
			}
		}
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('libman.install', async () => {
		try {
			await libman.install();
		} catch (error) {
			if (error) {
				vscode.window.showErrorMessage(error);
			}
		}
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('libman.uninstall', async () => {
		try {
			await libman.uninstall();
		} catch (error) {
			if (error) {
				vscode.window.showErrorMessage(error);
			}
		}
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('libman.restore', async () => {
		try {
			await libman.restore();
		} catch (error) {
			if (error) {
				vscode.window.showErrorMessage(error);
			}
		}
	});

	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('libman.clean', async () => {
		try {
			await libman.clean();
		} catch (error) {
			if (error) {
				vscode.window.showErrorMessage(error);
			}
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() { }
