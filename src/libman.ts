import * as vscode from 'vscode';
import { stat, readFile, readFileSync, promises } from "fs";
import { exec } from "child_process";
import { resolve, dirname } from "path";
import * as request from "request";
import { Config } from './config';

interface CdnjsModel {
    results: Array<{
        name: string;
        latest: string;
    }>;
    total: number;
}

interface Command {
    command: string;
    arguments: Array<string>;
    options: Array<{
        name: string;
        value: string;
    }>;
    cwd: string;
}

export class Libman {
    private path: string;
    private exePath: string;
    private config?: Config;

    constructor(extensionPath: string) {
        this.path = resolve(extensionPath, '.libman');
        this.exePath = resolve(this.path, 'libman.exe');
    }

    private exec(command: Command) {
        let commandStr = `${this.exePath} ${command.arguments.join(' ')}`;
        if (command.options) {
            command.options.forEach((item) => {
                commandStr += ` ${item.name} ${item.value}`;
            });
        }

        return new Promise((resolve, reject) => {
            exec(commandStr, { cwd: command.cwd }, (error, stdout, stderr) => {
                if (error) {
                    reject(error.message);
                } else if (stderr) {
                    resolve(stderr);
                }
                resolve();
            });
        });
    }

    public isExist(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            stat(this.path, (err, stats) => {
                if (err) {
                    resolve(false);
                }
                resolve(true);
            });
        });
    }

    public installTool() {
        return new Promise((resolve, reject) => {
            exec(`dotnet tool install Microsoft.Web.LibraryManager.Cli --tool-path ${this.path}`, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                }
            });
        });
    }

    public async init() {
        let currentWorkDirectory = await this.getInitDirectory();

        var command: Command = {
            command: this.exePath,
            arguments: ['init'],
            options: [],
            cwd: currentWorkDirectory
        };

        await this.SetDefaultProvider(command);
        await this.SetDefaultDestination(command);

        return this.exec(command);
    }

    public async install() {
        this.config = await Config.getConfig();
        let configDir = dirname(this.config.configPath);

        return new Promise((resolve, reject) => {
            let quickPick = vscode.window.createQuickPick();
            quickPick.placeholder = 'Pakcage Name';
            let cache: { [key: string]: Array<vscode.QuickPickItem> } = {};

            quickPick.onDidChangeValue((input) => {
                quickPick.busy = true;
                quickPick.items = [];
                if (cache[input]) {
                    quickPick.busy = false;
                    quickPick.items = cache[input];
                }
                else {
                    request.get(`https://api.cdnjs.com/libraries?search=${input}`, (error, response, body) => {
                        let model: CdnjsModel = JSON.parse(body);
                        let quickPickItem: Array<vscode.QuickPickItem> = [];
                        model.results.forEach((value) => {
                            quickPickItem.push({
                                label: value.name,
                                alwaysShow: true
                            });
                        });
                        cache[input] = quickPickItem;
                        quickPick.busy = false;
                        quickPick.items = quickPickItem;
                    });
                }
            });
            quickPick.onDidAccept(async () => {
                if (!this.config) {
                    return;
                }
                let command: Command = {
                    command: this.exePath,
                    arguments: ['install', quickPick.value],
                    options: [],
                    cwd: configDir
                };
                if (!this.config.defaultDestination) {
                    let destination = await this.getDestination();
                    if (destination) {
                        command.options.push({
                            name: '--destination',
                            value: destination
                        });
                    } else {
                        reject();
                    }
                }
                await this.exec(command);
            });
            quickPick.show();
        });
    }

    public async uninstall() {
        let configPath = await Config.SelectConfigPath();
        let configDir = dirname(configPath);

        this.config = JSON.parse(readFileSync(configPath, { encoding: 'utf-8' }));
        if (!this.config) {
            return Promise.reject();
        }
        let libNameList = this.config.libraries.map((item) => {
            return <vscode.QuickPickItem>{ label: item.library };
        });

        let libName = await vscode.window.showQuickPick(libNameList, { placeHolder: 'Select uninstall package' });
        if (!libName) {
            return Promise.reject();
        }
        let command: Command = {
            command: this.exePath,
            arguments: ['uninstall', libName.label],
            options: [],
            cwd: configDir
        };
        return await this.exec(command);
    }

    public async restore() {
        let configPath = await Config.SelectConfigPath();
        let configDir = dirname(configPath);
        let command: Command = {
            command: this.exePath,
            arguments: ['restore'],
            options: [],
            cwd: configDir
        };
        return await this.exec(command);
    }

    public async clean() {
        let configPath = await Config.SelectConfigPath();
        let configDir = dirname(configPath);
        let command: Command = {
            command: this.exePath,
            arguments: ['clean'],
            options: [],
            cwd: configDir
        };
        return await this.exec(command);
    }

    private async SetDefaultProvider(command: Command) {
        let defaultProvider = await this.getProvider();
        if (defaultProvider) {
            command.options.push({
                name: '--default-provider',
                value: 'cdnjs'
            });
        } else if (defaultProvider === undefined) {
            return Promise.reject();
        } else {
            return Promise.reject('Provider is required');
        }
    }

    private async SetDefaultDestination(command: Command) {
        let defaultDestination = await this.getDestination();
        if (defaultDestination) {
            command.options.push({
                name: '--default-destination',
                value: defaultDestination
            });
        } else if (defaultDestination === undefined) {
            return Promise.reject();
        }
    }

    private async getProvider() {
        let provider = await vscode.window.showQuickPick(['cdnjs'], { placeHolder: 'Provider' });
        return provider;
    }

    private async getDestination() {
        let destination = await vscode.window.showInputBox({ placeHolder: 'Destination' });
        return destination;
    }

    private async getInitDirectory() {
        let folders = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, openLabel: "Select libman.json folder" });
        if (!folders || !folders[0].fsPath) {
            return Promise.reject();
        }
        return folders[0].fsPath;
    }
}