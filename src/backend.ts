import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import fetch from 'node-fetch'; // ensure node-fetch@2 is installed

const RENDER_BACKEND_URL = 'https://vibe-vscodeextension-18.onrender.com';

export class Backend implements vscode.WebviewViewProvider {
    private context: vscode.ExtensionContext;
    private view?: vscode.WebviewView;
    private backendUrl: string;
    private conversationHistory: string = '';
    private pendingAction: any = null;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        const config = vscode.workspace.getConfiguration('vibecoding');
        this.backendUrl = config.get<string>('backendUrl', RENDER_BACKEND_URL);
    }

    /**
     * Get the workspace root path from the currently open workspace.
     * Returns undefined if no workspace is open.
     */
    private getWorkspaceRoot(): string | undefined {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return undefined;
        }
        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Check if workspace is open and show error if not.
     * Returns the workspace root path if valid.
     */
    private validateWorkspace(): string | undefined {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) {
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: 'Please open a folder before generating files.'
                });
            }
            return undefined;
        }
        return workspaceRoot;
    }

    /**
     * Create a file in the workspace with the given content.
     * Automatically creates parent directories if they don't exist.
     * Opens the file in the editor after creation.
     */
    private async createFileInWorkspace(relativePath: string, content: string): Promise<boolean> {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot) return false;

        try {
            const fullPath = path.join(workspaceRoot, relativePath);
            const fullDirPath = path.dirname(fullPath);

            // Create parent directories if needed
            if (!fs.existsSync(fullDirPath)) {
                fs.mkdirSync(fullDirPath, { recursive: true });
                console.log('Created directory:', fullDirPath);
            }

            // Write the file
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log('Created file:', fullPath);

            // Attempt to open the file in the editor, but don't fail if it doesn't open
            let opened = false;
            try {
                await vscode.window.showTextDocument(
                    vscode.Uri.file(fullPath),
                    { viewColumn: vscode.ViewColumn.One, preserveFocus: false }
                );
                opened = true;
            } catch (openError) {
                console.warn('Could not open file in editor:', openError);
            }

            // Report status (with or without open confirmation)
            if (this.view) {
                const statusText = opened
                    ? `Created: ${relativePath}`
                    : `Created: ${relativePath} (file not opened in editor)`;
                this.view.webview.postMessage({
                    type: 'status',
                    text: statusText
                });
            }

            return true; // file creation succeeded
        } catch (error) {
            console.error('Failed to create file:', error);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: `Failed to create file ${relativePath}: ${error}`
                });
            }
            return false;
        }
    }

    /**
     * Create multiple files in the workspace.
     */
    private async createFilesInWorkspace(files: Array<{ path: string; content: string }>): Promise<boolean> {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot) return false;

        let allSuccess = true;
        for (const file of files) {
            const success = await this.createFileInWorkspace(file.path, file.content);
            if (!success) allSuccess = false;
        }
        return allSuccess;
    }

    /**
     * Create a folder in the workspace.
     */
    private async createFolderInWorkspace(folderPath: string): Promise<boolean> {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot) return false;

        try {
            const fullPath = path.join(workspaceRoot, folderPath);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log('Created folder:', fullPath);
            } else {
                console.log('Folder already exists:', fullPath);
            }

            if (this.view) {
                this.view.webview.postMessage({
                    type: 'status',
                    text: `Created folder: ${folderPath}`
                });
            }

            return true;
        } catch (error) {
            console.error('Failed to create folder:', error);
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'error',
                    text: `Failed to create folder ${folderPath}: ${error}`
                });
            }
            return false;
        }
    }

    /**
     * Run a file (Python/JS/etc.) and capture stdout/stderr.
     * Returns { stdout, stderr, exitCode }.
     */
    private async runFileAndCaptureOutput(filePath: string, timeoutMs: number = 15000): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot) throw new Error('No workspace open');

        const ext = path.extname(filePath);
        let command: string;
        let args: string[] = [];

        if (ext === '.py') {
            command = await this.getPythonCommand();
            args = [filePath];
        } else if (ext === '.js') {
            command = 'node';
            args = [filePath];
        } else {
            command = filePath;
            args = [];
        }

        // Dynamically import child_process
        const childProcess = await import('child_process');
        const spawn = childProcess.spawn;

        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd: workspaceRoot });
            let stdout = '';
            let stderr = '';
            let resolved = false;
            const timer = setTimeout(() => {
                child.kill();
                if (!resolved) {
                    resolved = true;
                    // Assume long-running server, treat as success
                    resolve({ stdout: '', stderr: '', exitCode: 0 });
                }
            }, timeoutMs);

            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
                clearTimeout(timer);
                if (!resolved) {
                    resolved = true;
                    resolve({ stdout, stderr, exitCode: code ?? 0 });
                }
            });
            child.on('error', (err) => {
                clearTimeout(timer);
                if (!resolved) {
                    resolved = true;
                    reject(err);
                }
            });
        });
    }

    private async autoDebug(specificFile?: string): Promise<void> {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot) return;

        // Determine entry point
        let entryPoint: string | undefined;
        if (specificFile) {
            // If a specific file is given, we still try to find the main entry point to get runtime errors.
            entryPoint = this.findEntryPoint(workspaceRoot);
            if (!entryPoint) {
                this.view?.webview.postMessage({ type: 'warning', text: 'Could not find main entry point; will run the specified file directly.' });
                entryPoint = this.resolveFilePath(specificFile, workspaceRoot);
                if (!entryPoint) {
                    this.view?.webview.postMessage({ type: 'error', text: `File not found: ${specificFile}` });
                    return;
                }
            } else {
                console.log(`[Debug] Found entry point: ${entryPoint}`);
            }
        } else {
            entryPoint = this.findEntryPoint(workspaceRoot);
            if (!entryPoint) {
                this.view?.webview.postMessage({ type: 'error', text: 'Could not determine entry point file to run.' });
                return;
            }
        }

        this.view?.webview.postMessage({ type: 'status', text: `Debugging with entry point: ${path.basename(entryPoint)}` });

        let iteration = 0;
        const MAX_ITER = 5;
        const fixedFiles = new Set<string>(); // track files already fixed

        while (iteration < MAX_ITER) {
            iteration++;
            console.log(`[Debug] Iteration ${iteration}`);
            this.view?.webview.postMessage({ type: 'status', text: `Debugging iteration ${iteration}...` });

            // Run entry point with timeout
            let runResult;
            try {
                runResult = await this.runFileAndCaptureOutput(entryPoint, 15000);
            } catch (err: any) {
                console.error(`[Debug] Failed to run entry point:`, err);
                this.view?.webview.postMessage({ type: 'error', text: `Failed to run entry point: ${err.message}` });
                return;
            }

            const hasError = runResult.exitCode !== 0 || runResult.stderr.trim().length > 0;
            if (!hasError) {
                console.log(`[Debug] No errors after iteration ${iteration}`);
                // If a specific file was requested but not yet fixed, attempt static fix
                if (specificFile && !fixedFiles.has(specificFile)) {
                    const filePath = this.resolveFilePath(specificFile, workspaceRoot);
                    if (filePath) {
                        await this.fixFile(filePath, 'No runtime error, performing static analysis.');
                    }
                }
                this.view?.webview.postMessage({ type: 'response', text: `✅ No errors detected after ${iteration} iteration(s).` });
                return;
            }

            const errorOutput = runResult.stderr || runResult.stdout;
            console.log(`[Debug] Error output: ${errorOutput.substring(0, 200)}...`);
            this.view?.webview.postMessage({ type: 'status', text: `Error detected:\n${errorOutput.substring(0, 300)}...` });

            // Parse traceback to find affected files
            let affectedFiles = this.parseTracebackFiles(errorOutput, workspaceRoot);
            console.log(`[Debug] Affected files from traceback:`, affectedFiles);

            // If specific file is given and not in affectedFiles, add it (maybe it's related)
            if (specificFile) {
                const specificPath = this.resolveFilePath(specificFile, workspaceRoot);
                if (specificPath && !affectedFiles.includes(specificPath)) {
                    affectedFiles.push(specificPath);
                }
            }

            // If no files found, fallback to entry point
            if (affectedFiles.length === 0) {
                affectedFiles = [entryPoint];
            }

            // Fix each affected file
            let anyFixFailed = false;
            for (const filePath of affectedFiles) {
                if (fixedFiles.has(filePath)) continue; // already fixed
                const relativePath = vscode.workspace.asRelativePath(filePath);
                console.log(`[Debug] Fixing file: ${relativePath}`);
                this.view?.webview.postMessage({ type: 'status', text: `Fixing ${relativePath}...` });

                const success = await this.fixFile(filePath, errorOutput);
                if (success) {
                    fixedFiles.add(filePath);
                } else {
                    anyFixFailed = true;
                }
            }

            if (anyFixFailed) {
                this.view?.webview.postMessage({ type: 'error', text: 'Some files could not be fixed. Aborting.' });
                return;
            }

            // Loop again to re-run with fixed files
        }

        this.view?.webview.postMessage({ type: 'error', text: `Reached max iterations (${MAX_ITER}) without fixing all errors.` });
    }

    /**
     * Run a file (e.g., Python) in the terminal and capture output.
     */
    private async runFileInWorkspace(filePath: string, environment?: string): Promise<void> {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot) return;

        // Try to locate the file (could be relative or absolute)
        let fullPath = path.join(workspaceRoot, filePath);
        if (!fs.existsSync(fullPath)) {
            // Search recursively
            const foundPath = this.findFileRecursive(filePath, workspaceRoot);
            if (!foundPath) {
                this.view?.webview.postMessage({
                    type: 'error',
                    text: `File not found: ${filePath}`
                });
                return;
            }
            fullPath = foundPath;
        }

        // Determine interpreter based on file extension
        let command: string;
        if (fullPath.endsWith('.py')) {
            command = `python "${fullPath}"`;
        } else if (fullPath.endsWith('.js')) {
            command = `node "${fullPath}"`;
        } else {
            command = `"${fullPath}"`; // try direct execution
        }

        // If environment (conda env) is specified, wrap with conda run
        if (environment && environment !== 'none') {
            command = `conda run -n ${environment} ${command}`;
        }

        // Create a terminal and run
        const terminal = vscode.window.createTerminal(`Run: ${path.basename(fullPath)}`);
        terminal.show();
        terminal.sendText(command);

        this.view?.webview.postMessage({
            type: 'status',
            text: `Running ${path.basename(fullPath)} in terminal...`
        });
    }

    /**
     * Recursively search for a file by name.
     */
    private findFileRecursive(filename: string, searchPath: string): string | undefined {
        const files = fs.readdirSync(searchPath, { withFileTypes: true });
        for (const entry of files) {
            const fullPath = path.join(searchPath, entry.name);
            if (entry.isFile() && entry.name === filename) {
                return fullPath;
            }
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
                const found = this.findFileRecursive(filename, fullPath);
                if (found) return found;
            }
        }
        return undefined;
    }

    /**
     * Find the main entry point of the project by scanning common filenames and framework patterns.
     */
    private findEntryPoint(workspaceRoot: string): string | undefined {
        // Common entry point filenames
        const nameCandidates = ['app.py', 'main.py', 'index.js', 'server.js', 'manage.py', 'run.py', 'application.py'];
        for (const name of nameCandidates) {
            const found = this.findFileRecursive(name, workspaceRoot);
            if (found) return found;
        }
        // Fallback: search for files containing typical framework patterns
        const allFiles = this.getAllPythonFiles(workspaceRoot);
        for (const file of allFiles) {
            const content = fs.readFileSync(file, 'utf8');
            if (content.includes('FastAPI(') || content.includes('Flask(') || 
                content.includes('app.run(') || content.includes('uvicorn.run(')) {
                return file;
            }
        }
        return undefined;
    }

    /**
     * Recursively get all Python files in the workspace.
     */
    private getAllPythonFiles(dir: string): string[] {
        let results: string[] = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && entry.name.endsWith('.py')) {
                results.push(fullPath);
            } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
                results = results.concat(this.getAllPythonFiles(fullPath));
            }
        }
        return results;
    }

    /**
     * Resolve a user-provided file path to an absolute path within the workspace.
     */
    private resolveFilePath(userPath: string, workspaceRoot: string): string | undefined {
        if (path.isAbsolute(userPath)) {
            if (userPath.startsWith(workspaceRoot) && fs.existsSync(userPath)) {
                return userPath;
            }
            return undefined;
        }
        const fullPath = path.join(workspaceRoot, userPath);
        if (fs.existsSync(fullPath)) {
            return fullPath;
        }
        const basename = path.basename(userPath);
        const found = this.findFileRecursive(basename, workspaceRoot);
        if (found) {
            return found;
        }
        return undefined;
    }

    /**
     * Parse traceback from error output to extract file paths within the workspace.
     */
    private parseTracebackFiles(errorOutput: string, workspaceRoot: string): string[] {
        const filePaths: string[] = [];
        const lines = errorOutput.split('\n');
        const pythonRegex = /File "([^"]+)", line \d+/;
        const nodeRegex = /at .+ \(([^:]+):\d+:\d+\)/;

        for (const line of lines) {
            let match = line.match(pythonRegex);
            if (match) {
                const filePath = match[1];
                if (filePath.startsWith(workspaceRoot) && fs.existsSync(filePath)) {
                    filePaths.push(filePath);
                }
                continue;
            }
            match = line.match(nodeRegex);
            if (match) {
                const filePath = match[1];
                if (filePath.startsWith(workspaceRoot) && fs.existsSync(filePath)) {
                    filePaths.push(filePath);
                }
            }
        }
        return [...new Set(filePaths)];
    }

    /**
     * Get the Python interpreter command to use.
     * Tries the Python extension's selected interpreter first, then falls back to 'python3', 'python'.
     * Caches the result for the session.
     */
    private pythonCommandCache: string = '';

    private async getPythonCommand(): Promise<string> {
        if (this.pythonCommandCache) return this.pythonCommandCache;

        // Try to get interpreter from Python extension
        try {
            const pythonExtension = vscode.extensions.getExtension('ms-python.python');
            if (pythonExtension) {
                // Ensure the extension is activated
                if (!pythonExtension.isActive) {
                    await pythonExtension.activate();
                }
                const pythonPath = await pythonExtension.exports.settings.getExecutionDetails().execCommand;
                if (pythonPath && pythonPath.length > 0) {
                    this.pythonCommandCache = pythonPath[0]; // Usually the interpreter path
                    return this.pythonCommandCache;
                }
            }
        } catch (e) {
            console.warn('Could not get Python interpreter from extension:', e);
        }

        // Fallback: check common commands using 'which' (Unix) or 'where' (Windows)
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execPromise = promisify(exec);

        const candidates = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
        for (const cmd of candidates) {
            try {
                const checkCmd = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
                const { stdout } = await execPromise(checkCmd);
                if (stdout.trim()) {
                    this.pythonCommandCache = cmd;
                    return cmd;
                }
            } catch (e) {
                // Command not found, continue
            }
        }

        // Last resort: assume 'python' and hope it's in PATH
        this.pythonCommandCache = 'python';
        return this.pythonCommandCache;
    }

    /**
     * Fix a single file by sending its content and error to the /debug endpoint.
     */
    private async fixFile(filePath: string, errorMsg: string): Promise<boolean> {
        const content = fs.readFileSync(filePath, 'utf8');
        const relativePath = vscode.workspace.asRelativePath(filePath);
        try {
            const response = await fetch(`${this.backendUrl}/debug`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    file_path: relativePath,
                    content: content,
                    error: errorMsg
                })
            });
            if (!response.ok) {
                console.error(`[Debug] Backend error ${response.status} for ${relativePath}`);
                this.view?.webview.postMessage({ type: 'error', text: `Failed to fix ${relativePath}: Backend error ${response.status}` });
                return false;
            }
            const result = await response.json() as { fixed_content?: string };
            if (!result.fixed_content) {
                this.view?.webview.postMessage({ type: 'error', text: `Backend returned no fix for ${relativePath}` });
                return false;
            }
            fs.writeFileSync(filePath, result.fixed_content, 'utf8');
            this.view?.webview.postMessage({ type: 'status', text: `Fixed ${relativePath}` });
            return true;
        } catch (error) {
            console.error(`[Debug] Failed to fix ${relativePath}:`, error);
            this.view?.webview.postMessage({ type: 'error', text: `Failed to fix ${relativePath}: ${error}` });
            return false;
        }
    }

    // ---------- Direct debugging of a specific file ----------
    private async handleDebugFile(message: any) {
        const filePath = message.path;               // relative path
        const errorText = message.error || "";        // optional error text

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage("No workspace open.");
            return;
        }

        const fullPath = path.join(workspaceFolders[0].uri.fsPath, filePath);
        if (!fs.existsSync(fullPath)) {
            vscode.window.showErrorMessage(`File not found: ${filePath}`);
            return;
        }

        const content = fs.readFileSync(fullPath, "utf8");

        try {
            const response = await fetch(`${this.backendUrl}/debug`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    file_path: filePath,
                    content: content,
                    error: errorText
                })
            });

            const result = await response.json() as { fixed_content?: string };
            if (result.fixed_content) {
                fs.writeFileSync(fullPath, result.fixed_content, "utf8");
                const document = await vscode.workspace.openTextDocument(fullPath);
                await vscode.window.showTextDocument(document);
                vscode.window.showInformationMessage(`Fixed issues in ${filePath}`);
            } else {
                vscode.window.showErrorMessage("Failed to fix file.");
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error communicating with backend: ${error}`);
        }
    }

    // ----------------------------------------------------------------------
    // Webview handling
    // ----------------------------------------------------------------------
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        token: vscode.CancellationToken
    ): void {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
        };
        webviewView.webview.html = this.getWebviewContent();

        webviewView.webview.onDidReceiveMessage(
            async (message: any) => {
                switch (message.command) {
                    case 'sendMessage':
                        await this.handleMessage(message.text, message.files);
                        return;
                    case 'openPreview':
                        if (message.url) vscode.env.openExternal(vscode.Uri.parse(message.url));
                        return;
                    case 'searchFiles':
                        await this.handleSearchFiles(message.keyword, message.fileType);
                        return;
                    case 'searchFolders':
                        await this.handleSearchFolders(message.keyword);
                        return;
                    case 'searchInFiles':
                        await this.handleSearchInFiles(message.keyword, message.filePattern);
                        return;
                    case 'getFileInfo':
                        await this.handleGetFileInfo(message.path);
                        return;
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    private getWebviewContent(): string {
        const htmlPath = path.join(this.context.extensionPath, 'media', 'chat.html');
        try {
            return fs.readFileSync(htmlPath, 'utf8');
        } catch (error) {
            return this.getDefaultHtml();
        }
    }

    private getDefaultHtml(): string {
        // (unchanged – keep your existing default HTML here)
        return `<!DOCTYPE html>...`; // (truncated for brevity, keep your original)
    }

    private async handleMessage(text: string, files?: any[]): Promise<void> {
        if (this.view) {
            this.view.webview.postMessage({ type: 'thinking' });
        }

        // -----------------------------------------
        // DIRECT DEBUG: fix filename.py or filename.js
        // -----------------------------------------
        const debugMatch = text.match(/([a-zA-Z0-9_\-\.\/]+\.(py|js))/);
        if (/fix|debug/i.test(text) && debugMatch) {
            await this.handleDebugFile({ path: debugMatch[1] });
            return;
        }

        // -----------------------------------------
        // TERMINAL ERROR PASTED
        // -----------------------------------------
        if (text.includes("Error") || text.includes("Exception")) {
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                const absolutePath = activeEditor.document.fileName;
                const relativePath = vscode.workspace.asRelativePath(absolutePath);
                await this.handleDebugFile({
                    path: relativePath,
                    error: text   // pass the error text
                });
                return;
            }
        }

        // -----------------------------------------
        // NORMAL CHAT FLOW
        // -----------------------------------------
        const payload: any = {
            message: text,
            conversation_history: this.conversationHistory
        };

        if (files && files.length > 0) payload.files = files;
        if (this.pendingAction) {
            payload.pending_action = this.pendingAction;
            this.pendingAction = null;
        }

        try {
            const response = await fetch(`${this.backendUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`HTTP error ${response.status}`);

            const data = await response.json() as { messages: any[] };
            let aiResponseTexts: string[] = [];

            for (const msg of data.messages) {
                this.handleIncomingMessage(msg);
                if (msg.type === 'confirmation') {
                    this.pendingAction = msg.action;
                }
                if (msg.type === 'response' || msg.type === 'error' || msg.type === 'status' || msg.type === 'confirmation') {
                    if (msg.text) aiResponseTexts.push(msg.text);
                }
                if (msg.type === 'auto_debug') {
                    this.autoDebug();
                    return;
                }
                if (msg.type === "debug_file") {
                    await this.handleDebugFile(msg);
                    return;
                }
            }

            const aiText = aiResponseTexts.join('\n');
            this.conversationHistory += `User: ${text}\nAssistant: ${aiText}\n`;
        } catch (error) {
            console.error('Backend communication failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.view?.webview.postMessage({
                type: 'error',
                text: `Failed to reach AI backend: ${errorMessage}`
            });
        }
    }

    private handleIncomingMessage(message: any): void {
        if (!this.view) return;

        if (message.type === 'create_project') {
            const folder = message.folder;
            const files = message.files || [];
            this.createFolderInWorkspace(folder);
            for (const file of files) {
                const fullPath = path.join(folder, file.path);
                this.createFileInWorkspace(fullPath, file.content);
            }
            return;
        }
        if (message.type === 'create_file' || message.type === 'update_file') {
            this.createFileInWorkspace(message.file_path, message.content);
            return;
        }
        if (message.type === 'create_files') {
            this.createFilesInWorkspace(message.files || []);
            return;
        }
        if (message.type === 'create_folder') {
            this.createFolderInWorkspace(message.folder_path);
            return;
        }
        if (message.type === 'run_file') {
            this.runFileInWorkspace(message.path, message.environment);
            return;
        }
        if (message.type === 'debug_file') {
            this.autoDebug(message.path);
            return;
        }

        // All other message types are just forwarded to the webview
        this.view.webview.postMessage(message);
    }

    // ---------- Local workspace searches ----------
    private async handleSearchFiles(keyword: string, fileType?: string): Promise<void> {
        let ext = '';
        if (fileType) {
            ext = fileType.startsWith('.') ? fileType : '.' + fileType;
        }
        const pattern = ext ? `**/*${keyword}*${ext}` : `**/*${keyword}*`;
        const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        const results = await Promise.all(uris.map(async uri => {
            const stat = await vscode.workspace.fs.stat(uri);
            return {
                name: path.basename(uri.fsPath),
                path: vscode.workspace.asRelativePath(uri),
                full_path: uri.fsPath,
                size: stat.size,
                modified: new Date(stat.mtime).toLocaleString()
            };
        }));
        const formatted = this.formatSearchResults(results, 'files');
        this.view?.webview.postMessage({ type: 'response', text: formatted });
    }

    private async handleSearchFolders(keyword: string): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return;

        const results: any[] = [];
        const walkAsync = async (dir: string): Promise<void> => {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                if (type === vscode.FileType.Directory && !name.startsWith('.')) {
                    const fullPath = path.join(dir, name);
                    if (name.toLowerCase().includes(keyword.toLowerCase())) {
                        const fileCount = await this.countFilesInFolderAsync(fullPath);
                        results.push({
                            name,
                            path: vscode.workspace.asRelativePath(fullPath),
                            file_count: fileCount
                        });
                    }
                    await walkAsync(fullPath);
                }
            }
        };
        await walkAsync(workspaceRoot);
        const formatted = this.formatSearchResults(results.slice(0, 10), 'folders');
        this.view?.webview.postMessage({ type: 'response', text: formatted });
    }

    private async handleSearchInFiles(keyword: string, filePattern: string = '*'): Promise<void> {
        const uris = await vscode.workspace.findFiles(`**/${filePattern}`, '**/node_modules/**', 100);
        const matches: any[] = [];
        for (const uri of uris) {
            const content = (await vscode.workspace.fs.readFile(uri)).toString();
            const lines = content.split('\n');
            const matchingLines: { lineNumber: number; content: string }[] = [];
            lines.forEach((line, idx) => {
                if (line.toLowerCase().includes(keyword.toLowerCase())) {
                    matchingLines.push({ lineNumber: idx + 1, content: line.trim().substring(0, 100) });
                }
            });
            if (matchingLines.length > 0) {
                matches.push({
                    name: path.basename(uri.fsPath),
                    path: vscode.workspace.asRelativePath(uri),
                    matches: matchingLines.length,
                    lines: matchingLines.slice(0, 3)
                });
            }
            if (matches.length >= 10) break;
        }
        const formatted = this.formatSearchResults(matches, 'content matches');
        this.view?.webview.postMessage({ type: 'response', text: formatted });
    }

    private async handleGetFileInfo(filePath: string): Promise<void> {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot) return;
        const fullPath = path.join(workspaceRoot, filePath);
        try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(fullPath));
            const info = {
                name: path.basename(fullPath),
                path: filePath,
                is_file: stat.type === vscode.FileType.File,
                is_directory: stat.type === vscode.FileType.Directory,
                size: stat.size,
                created: new Date(stat.ctime).toLocaleString(),
                modified: new Date(stat.mtime).toLocaleString()
            };
            const formatted = Object.entries(info).map(([k, v]) => `${k}: ${v}`).join('\n');
            this.view?.webview.postMessage({ type: 'response', text: `[OK] File Information:\n${formatted}` });
        } catch {
            this.view?.webview.postMessage({ type: 'error', text: `File not found: ${filePath}` });
        }
    }

    private async countFilesInFolderAsync(folderPath: string): Promise<number> {
        let count = 0;
        const walk = async (dir: string) => {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File) count++;
                else if (type === vscode.FileType.Directory) await walk(path.join(dir, name));
            }
        };
        await walk(folderPath);
        return count;
    }

    private formatSearchResults(results: any[], type: string): string {
        if (!results.length) return `[INFO] No ${type} found.`;
        const lines = [`[OK] Found ${results.length} ${type}:`, '-'.repeat(50)];
        results.forEach((item, i) => {
            if (type === 'files') {
                lines.push(`${i+1}. ${item.name}`);
                lines.push(`   Path: ${item.path}`);
                lines.push(`   Size: ${this.formatFileSize(item.size)} | Modified: ${item.modified}`);
            } else if (type === 'folders') {
                lines.push(`${i+1}. ${item.name}/`);
                lines.push(`   Path: ${item.path}/`);
                lines.push(`   Files: ${item.file_count}`);
            } else if (type === 'content matches') {
                lines.push(`${i+1}. ${item.name}`);
                lines.push(`   Path: ${item.path}`);
                lines.push(`   Matches: ${item.matches} occurrences`);
                item.lines.forEach((l: any) => {
                    lines.push(`      Line ${l.lineNumber}: ${l.content}`);
                });
            }
            lines.push('');
        });
        return lines.join('\n');
    }

    private formatFileSize(bytes: number): string {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIdx = 0;
        while (size >= 1024 && unitIdx < units.length - 1) {
            size /= 1024;
            unitIdx++;
        }
        return `${size.toFixed(2)} ${units[unitIdx]}`;
    }

    public runAutoDebug(specificFile?: string): void {
        this.autoDebug(specificFile);
    }

    public dispose(): void {
        // Nothing to dispose
    }
}