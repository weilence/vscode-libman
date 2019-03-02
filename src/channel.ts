import { OutputChannel, window } from "vscode";

export class Channel {
    static output: OutputChannel;

    constructor() {
        Channel.output = window.createOutputChannel("Libman");
    }
}