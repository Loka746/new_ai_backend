import * as vscode from 'vscode';
import { Backend } from './backend';
vscode.commands.executeCommand('vibecoding.chatView.focus');
let backendInstance: Backend | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('VibeCoding Extension is now active!');

    const backend = new Backend(context);
    backendInstance = backend; // store for commands

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'vibecoding.chatView',
            backend,
            { webviewOptions: { retainContextWhenHidden: true } }
        )
    );

    // Register command to auto-debug current file
    context.subscriptions.push(
        vscode.commands.registerCommand('vibecoding.autoDebug', () => {
            if (backendInstance) {
                backendInstance.runAutoDebug();
            } else {
                vscode.window.showErrorMessage('Backend not initialized');
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('vibecoding.chat', () => {
            vscode.commands.executeCommand('vibecoding.chatView.focus');
        })
    );
}

export function deactivate() {}