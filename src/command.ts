import { exec } from "child_process";

export class Command {
    constructor(private command: string, private args: string[], private options: Array<{ name: string; value: string; }>, private cwd?: string) {

    }

    public addOption(option: { name: string; value: string; }) {
        this.options.push(option);
    }

    public exec() {
        let commandStr = `${this.command} ${this.args.join(' ')}`;
        if (this.options) {
            this.options.forEach((item) => {
                commandStr += ` ${item.name} ${item.value}`;
            });
        }

        return new Promise((resolve, reject) => {
            exec(commandStr, { cwd: this.cwd }, (error, stdout, stderr) => {
                if (error) {
                    reject(error.message);
                } else if (stderr) {
                    resolve(stderr);
                }
                resolve();
            });
        });
    }
}