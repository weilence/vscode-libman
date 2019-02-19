import * as vscode from "vscode";
import { readFileSync } from "fs";

export class Config {
    public version: string;
    public defaultProvider: string;
    public defaultDestination?: string;
    public libraries: Array<{
        library: string;
        destination?: string;
    }>;
    public configPath: string;

    private constructor(configPath: string) {
        this.configPath = configPath;
        ({
            version: this.version,
            libraries: this.libraries,
            defaultProvider: this.defaultProvider,
            defaultDestination: this.defaultDestination
        } = JSON.parse(readFileSync(configPath, { encoding: 'utf-8' })));
    }

    public static async getConfig() {
        let configPath = await this.SelectConfigPath();
        return new Config(configPath);
    }

    public static async SelectConfigPath() {
        let items: vscode.QuickPickItem[] = await vscode.workspace.findFiles('**/libman.json').then(uris => {
            return uris.map(m => ({ label: m.fsPath }));
        });
        if (items.length === 0) {
            return Promise.reject();
        }
        else if (items.length === 1) {
            return items[0].label;
        }
        else {
            let fsPath = await vscode.window.showQuickPick(items, { placeHolder: 'select libman.json' });
            if (fsPath === undefined) {
                return Promise.reject();
            }
            return fsPath.label;
        }
    }
}