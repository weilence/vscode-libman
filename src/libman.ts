import * as vscode from 'vscode';
import { stat, readFile, readFileSync, promises } from 'fs';
import { resolve, dirname } from 'path';
import * as request from 'request';
import { Config } from './config';
import { Command } from './command';

interface CdnjsModel {
    name: string;
    latest: string;
    assets: Array<{
        files: Array<string>;
        version: string;
    }>;
}

interface CdnjsResult {
    results: Array<CdnjsModel>;
    total: number;
}

interface CdnjsQuickItem extends vscode.QuickPickItem {
    packageName: string;
    packageVersion?: string;
}

export class Libman {
    private path: string;
    private config?: Config;

    constructor(extensionPath: string) {
        this.path = resolve(extensionPath, '.libman', 'libman.exe');
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
        let command = new Command('dotnet', ['tool', 'install', 'Microsoft.Web.LibraryManager.Cli'], [{ name: '--tool-path', value: dirname(this.path) }]);
        return command.exec();
    }

    public async init() {
        let currentWorkDirectory = await this.getInitDirectory();

        let command = new Command(this.path, ['init'], [], currentWorkDirectory);

        await this.setDefaultProvider(command);
        await this.setDefaultDestination(command);

        return command.exec();
    }

    public async install() {
        this.config = await Config.Create();
        let configDir = dirname(this.config.configPath);

        return new Promise((resolve, reject) => {
            let quickPick = vscode.window.createQuickPick<CdnjsQuickItem>();
            quickPick.placeholder = 'Pakcage Name';
            let cache: { [key: string]: Array<CdnjsQuickItem> } = {};

            quickPick.onDidChangeValue((input) => {
                quickPick.busy = true;
                quickPick.items = [];
                if (cache[input]) {
                    quickPick.busy = false;
                    quickPick.items = cache[input];
                    return;
                }

                if (input.indexOf('@') > -1) {
                    let [name] = input.split('@');
                    request.get(`https://api.cdnjs.com/libraries/${name}?fields=assets`, (error, response, body) => {
                        let model: CdnjsModel = JSON.parse(body);
                        let quickPickItem: Array<CdnjsQuickItem> = [];
                        model.assets.forEach((item) => {
                            quickPickItem.push({
                                label: item.version,
                                packageName: name,
                                packageVersion: item.version,
                                alwaysShow: true
                            });
                        });
                        cache[input] = quickPickItem;
                        quickPick.busy = false;
                        quickPick.items = quickPickItem;
                    });
                }
                else {
                    request.get(`https://api.cdnjs.com/libraries?search=${input}`, (error, response, body) => {
                        let model: CdnjsResult = JSON.parse(body);
                        let quickPickItem: Array<CdnjsQuickItem> = [];
                        model.results.forEach((item) => {
                            quickPickItem.push({
                                label: item.name,
                                packageName: input,
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
                let selectItem = quickPick.selectedItems[0];
                let packageFullName = selectItem.packageName;
                if(selectItem.packageVersion){
                    packageFullName += '@' + selectItem.packageVersion;
                }
                let command = new Command(this.path, ['install', packageFullName], [], configDir);
                if (!this.config.defaultDestination) {
                    let destination = await this.getDestination();
                    if (destination) {
                        command.addOption({
                            name: '--destination',
                            value: destination
                        });
                    } else {
                        reject();
                    }
                }
                await command.exec();
            });
            quickPick.show();
        });
    }

    public async uninstall() {
        let configPath = await Config.SelectPath();
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
        let command = new Command(this.path, ['uninstall', libName.label], [], configDir);
        return await command.exec();
    }

    public async restore() {
        let configPath = await Config.SelectPath();
        let configDir = dirname(configPath);
        let command = new Command(this.path, ['restore'], [], configDir);
        return await command.exec();
    }

    public async clean() {
        let configPath = await Config.SelectPath();
        let configDir = dirname(configPath);
        let command = new Command(this.path, ['clean'], [], configDir);
        return await command.exec();
    }

    private async setDefaultProvider(command: Command) {
        let defaultProvider = await this.getProvider();
        if (defaultProvider) {
            command.addOption({
                name: '--default-provider',
                value: 'cdnjs'
            });
        } else if (defaultProvider === undefined) {
            return Promise.reject();
        } else {
            return Promise.reject('Provider is required');
        }
    }

    private async setDefaultDestination(command: Command) {
        let defaultDestination = await this.getDestination();
        if (defaultDestination) {
            command.addOption({
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
        let folders = await vscode.window.showOpenDialog({ canSelectFiles: false, canSelectFolders: true, openLabel: 'Select libman.json folder' });
        if (!folders || !folders[0].fsPath) {
            return Promise.reject();
        }
        return folders[0].fsPath;
    }
}