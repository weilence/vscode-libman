import { OutputChannel, window } from "vscode";

export class Channel {
    static output = window.createOutputChannel("Libman");
}