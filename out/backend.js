"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Backend = void 0;
const vscode = __importStar(require("vscode"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
// import fetch from 'node-fetch'; // Ensure node-fetch is installed
class Backend {
    constructor(context) {
        this.conversationHistory = '';
        this.pendingAction = null; // for confirmation flows
        /**
         * Get the Python interpreter command to use.
         * Tries the Python extension's selected interpreter first, then falls back to 'python3', 'python'.
         * Caches the result for the session.
         */
        this.pythonCommandCache = '';
        this.context = context;
        const config = vscode.workspace.getConfiguration('vibecoding');
        this.backendUrl = config.get('backendUrl', 'https://vibe-vscodeextension-18.onrender.com');
    }
    /**
     * Get the workspace root path from the currently open workspace.
     * Returns undefined if no workspace is open.
     */
    getWorkspaceRoot() {
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
    validateWorkspace() {
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
    async createFileInWorkspace(relativePath, content) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            return false;
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
                await vscode.window.showTextDocument(vscode.Uri.file(fullPath), { viewColumn: vscode.ViewColumn.One, preserveFocus: false });
                opened = true;
            }
            catch (openError) {
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
        }
        catch (error) {
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
    async createFilesInWorkspace(files) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            return false;
        let allSuccess = true;
        for (const file of files) {
            const success = await this.createFileInWorkspace(file.path, file.content);
            if (!success)
                allSuccess = false;
        }
        return allSuccess;
    }
    /**
     * Create a folder in the workspace.
     */
    async createFolderInWorkspace(folderPath) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            return false;
        try {
            const fullPath = path.join(workspaceRoot, folderPath);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log('Created folder:', fullPath);
            }
            else {
                console.log('Folder already exists:', fullPath);
            }
            if (this.view) {
                this.view.webview.postMessage({
                    type: 'status',
                    text: `Created folder: ${folderPath}`
                });
            }
            return true;
        }
        catch (error) {
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
    async runFileAndCaptureOutput(filePath, timeoutMs = 15000) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            throw new Error('No workspace open');
        const ext = path.extname(filePath);
        let command;
        let args = [];
        if (ext === '.py') {
            command = await this.getPythonCommand();
            args = [filePath];
        }
        else if (ext === '.js') {
            command = 'node';
            args = [filePath];
        }
        else {
            command = filePath;
            args = [];
        }
        // Dynamically import child_process
        const childProcess = await Promise.resolve().then(() => __importStar(require('child_process')));
        const spawn = childProcess.spawn;
        return new Promise((resolve, reject) => {
            const child = spawn(command, args, { cwd: workspaceRoot });
            let stdout = '';
            let stderr = '';
            const timer = setTimeout(() => {
                child.kill();
                // Assume long-running server, treat as success
                resolve({ stdout: '', stderr: '', exitCode: 0 });
            }, timeoutMs);
            child.stdout.on('data', (data) => { stdout += data.toString(); });
            child.stderr.on('data', (data) => { stderr += data.toString(); });
            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ stdout, stderr, exitCode: code ?? 0 });
            });
            child.on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }
    async autoDebug(specificFile) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            return;
        // Determine entry point
        let entryPoint;
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
            }
            else {
                console.log(`[Debug] Found entry point: ${entryPoint}`);
            }
        }
        else {
            entryPoint = this.findEntryPoint(workspaceRoot);
            if (!entryPoint) {
                this.view?.webview.postMessage({ type: 'error', text: 'Could not determine entry point file to run.' });
                return;
            }
        }
        this.view?.webview.postMessage({ type: 'status', text: `Debugging with entry point: ${path.basename(entryPoint)}` });
        let iteration = 0;
        const MAX_ITER = 5;
        const fixedFiles = new Set(); // track files already fixed
        while (iteration < MAX_ITER) {
            iteration++;
            console.log(`[Debug] Iteration ${iteration}`);
            this.view?.webview.postMessage({ type: 'status', text: `Debugging iteration ${iteration}...` });
            // Run entry point with timeout
            let runResult;
            try {
                runResult = await this.runFileAndCaptureOutput(entryPoint, 15000);
            }
            catch (err) {
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
                if (fixedFiles.has(filePath))
                    continue; // already fixed
                const relativePath = vscode.workspace.asRelativePath(filePath);
                console.log(`[Debug] Fixing file: ${relativePath}`);
                this.view?.webview.postMessage({ type: 'status', text: `Fixing ${relativePath}...` });
                const success = await this.fixFile(filePath, errorOutput);
                if (success) {
                    fixedFiles.add(filePath);
                }
                else {
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
    async runFileInWorkspace(filePath, environment) {
        const workspaceRoot = this.validateWorkspace();
        if (!workspaceRoot)
            return;
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
            fullPath = foundPath; // Now guaranteed to be defined
        }
        // Determine interpreter based on file extension
        let command;
        if (fullPath.endsWith('.py')) {
            command = `python "${fullPath}"`;
        }
        else if (fullPath.endsWith('.js')) {
            command = `node "${fullPath}"`;
        }
        else {
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
     * Debug a file: syntax check and AI-powered auto-fix via backend.
     * The actual fixing logic is performed on the backend, which returns an updated file.
     */
    /**
     * Recursively search for a file by name.
     */
    findFileRecursive(filename, searchPath) {
        const files = fs.readdirSync(searchPath, { withFileTypes: true });
        for (const entry of files) {
            const fullPath = path.join(searchPath, entry.name);
            if (entry.isFile() && entry.name === filename) {
                return fullPath;
            }
            if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
                const found = this.findFileRecursive(filename, fullPath);
                if (found)
                    return found;
            }
        }
        return undefined;
    }
    /**
     * Find the main entry point of the project by scanning common filenames and framework patterns.
     */
    findEntryPoint(workspaceRoot) {
        // Common entry point filenames
        const nameCandidates = ['app.py', 'main.py', 'index.js', 'server.js', 'manage.py', 'run.py', 'application.py', 'quary.SQL'];
        for (const name of nameCandidates) {
            const found = this.findFileRecursive(name, workspaceRoot);
            if (found)
                return found;
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
    getAllPythonFiles(dir) {
        let results = [];
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && entry.name.endsWith('.py')) {
                results.push(fullPath);
            }
            else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== '__pycache__') {
                results = results.concat(this.getAllPythonFiles(fullPath));
            }
        }
        return results;
    }
    /**
     * Resolve a user-provided file path to an absolute path within the workspace.
     */
    resolveFilePath(userPath, workspaceRoot) {
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
    parseTracebackFiles(errorOutput, workspaceRoot) {
        const filePaths = [];
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
    async getPythonCommand() {
        if (this.pythonCommandCache)
            return this.pythonCommandCache;
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
        }
        catch (e) {
            console.warn('Could not get Python interpreter from extension:', e);
        }
        // Fallback: check common commands using 'which' (Unix) or 'where' (Windows)
        const { exec } = await Promise.resolve().then(() => __importStar(require('child_process')));
        const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
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
            }
            catch (e) {
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
    async fixFile(filePath, errorMsg) {
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
            const result = await response.json();
            if (!result.fixed_content) {
                this.view?.webview.postMessage({ type: 'error', text: `Backend returned no fix for ${relativePath}` });
                return false;
            }
            fs.writeFileSync(filePath, result.fixed_content, 'utf8');
            this.view?.webview.postMessage({ type: 'status', text: `Fixed ${relativePath}` });
            return true;
        }
        catch (error) {
            console.error(`[Debug] Failed to fix ${relativePath}:`, error);
            this.view?.webview.postMessage({ type: 'error', text: `Failed to fix ${relativePath}: ${error}` });
            return false;
        }
    }
    resolveWebviewView(webviewView, context, token) {
        this.view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(this.context.extensionPath, 'media'))]
        };
        webviewView.webview.html = this.getWebviewContent();
        webviewView.webview.onDidReceiveMessage(async (message) => {
            switch (message.command) {
                case 'sendMessage':
                    await this.handleMessage(message.text, message.files);
                    return;
                case 'openPreview':
                    if (message.url)
                        vscode.env.openExternal(vscode.Uri.parse(message.url));
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
        }, undefined, this.context.subscriptions);
    }
    getWebviewContent() {
        const htmlPath = path.join(this.context.extensionPath, 'media', 'chat.html');
        try {
            return fs.readFileSync(htmlPath, 'utf8');
        }
        catch (error) {
            return this.getDefaultHtml();
        }
    }
    getDefaultHtml() {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Code Assistant</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            margin: 0;
            padding: 20px;
        }
        #chat-container {
            height: 80vh;
            overflow-y: auto;
            border: 1px solid var(--vscode-panel-border);
            padding: 10px;
            margin-bottom: 10px;
        }
        #input-container {
            display: flex;
            gap: 10px;
        }
        #user-input {
            flex: 1;
            padding: 10px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
        }
        button {
            padding: 10px 20px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .message {
            margin: 10px 0;
            padding: 10px;
            border-radius: 5px;
        }
        .user-message {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
        }
        .assistant-message {
            background-color: var(--vscode-editor-selectionBackground);
        }
        .error-message {
            background-color: var(--vscode-editorError-foreground);
            color: white;
        }
        .status-message {
            background-color: var(--vscode-editorInfo-foreground);
            color: var(--vscode-editor-background);
            font-style: italic;
            font-size: 0.9em;
        }
        .website-complete-message {
            background-color: var(--vscode-terminal-ansiGreen);
            color: var(--vscode-editor-background);
            border: 2px solid var(--vscode-terminal-ansiGreen);
        }
        .preview-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            padding: 8px 16px;
            margin: 5px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            display: inline-block;
        }
        .preview-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        .typing {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
        .progress-bar {
            width: 100%;
            height: 4px;
            background-color: var(--vscode-progressBar-background);
            margin-top: 5px;
        }
        .progress-fill {
            height: 100%;
            background-color: var(--vscode-progressBar-foreground);
            transition: width 0.3s ease;
        }
    </style>
</head>
<body>
    <div id="chat-container"></div>
    <div id="input-container">
        <input type="text" id="user-input" placeholder="Type your message..." />
        <button onclick="sendMessage()">Send</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        const chatContainer = document.getElementById('chat-container');
        const userInput = document.getElementById('user-input');
        let isTyping = false;

        function sendMessage() {
            const text = userInput.value.trim();
            if (text && !isTyping) {
                addMessage(text, 'user');
                vscode.postMessage({
                    command: 'sendMessage',
                    text: text
                });
                userInput.value = '';
                isTyping = true;
                addMessage('...', 'assistant', true);
            }
        }

        function addMessage(text, sender, isTyping = false, extraData = {}) {
            const div = document.createElement('div');
            div.className = 'message ' + sender + '-message';
            if (isTyping) {
                div.classList.add('typing');
                div.id = 'typing-indicator';
            }
            
            // Handle special message types
            if (extraData.type === 'website_complete') {
                div.className = 'message website-complete-message';
                div.innerHTML = formatWebsiteCompleteMessage(extraData);
            } else {
                div.textContent = (sender === 'user' ? 'You: ' : 'AI: ') + text;
            }
            
            chatContainer.appendChild(div);
            chatContainer.scrollTop = chatContainer.scrollHeight;

        }

        function formatWebsiteCompleteMessage(data) {
            let html = '<div style="font-weight: bold; margin-bottom: 10px;">🎉 Website Generated Successfully!</div>';
            html += '<div style="margin-bottom: 10px;">' + data.text.replace(/\\n/g, '<br>') + '</div>';
            
            if (data.preview_url) {
                html += '<button class="preview-button" onclick="openPreview(\\\\'' + data.preview_url + '\\\\')">🌐 Open Preview</button>';
            }
            
            return html;
        }

        function openPreview(url) {
            vscode.postMessage({
                command: 'openPreview',
                url: url
            });
        }

        function updateTypingIndicator(text, extraData = {}) {
            const typing = document.getElementById('typing-indicator');
            if (typing) {
                if (extraData.type === 'website_complete') {
                    typing.remove();
                    isTyping = false;
                    addMessage('', 'assistant', false, extraData);
                } else {
                    typing.textContent = 'AI: ' + text;
                    typing.classList.remove('typing');
                }
            }
        }

        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'response':
                    const typing = document.getElementById('typing-indicator');
                    if (typing) {
                        typing.remove();
                    }
                    isTyping = false;
                    addMessage(message.text, 'assistant');
                    break;
                    
                case 'error':
                    const errorTyping = document.getElementById('typing-indicator');
                    if (errorTyping) {
                        errorTyping.remove();
                    }
                    isTyping = false;
                    addMessage(message.text, 'assistant');
                    break;
                    
                case 'ready':
                    addMessage(message.text, 'assistant');
                    break;
                    
                case 'status':
                    // Update typing indicator with status
                    updateTypingIndicator(message.text);
                    break;
                    
                case 'website_complete':
                    updateTypingIndicator('', message);
                    break;
                    
                case 'confirmation':
                    const confirmTyping = document.getElementById('typing-indicator');
                    if (confirmTyping) {
                        confirmTyping.remove();
                    }
                    isTyping = false;
                    addMessage(message.text, 'assistant');
                    break;
                    
                default:
                    console.log('Unknown message type:', message.type);
            }
        });

        userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    </script>
</body>
</html>`;
    }
    async handleMessage(text, files) {
        // Show thinking indicator in webview
        if (this.view) {
            this.view.webview.postMessage({ type: 'thinking' });
        }
        const payload = {
            message: text,
            conversation_history: this.conversationHistory
        };
        if (files && files.length > 0)
            payload.files = files;
        if (this.pendingAction) {
            payload.pending_action = this.pendingAction;
            this.pendingAction = null; // clear after sending
        }
        try {
            const response = await fetch(`${this.backendUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok)
                throw new Error(`HTTP error ${response.status}`);
            const data = await response.json();
            // Process each message returned by the backend
            let aiResponseTexts = [];
            for (const msg of data.messages) {
                this.handleIncomingMessage(msg);
                // If it's a confirmation request, store it
                if (msg.type === 'confirmation') {
                    this.pendingAction = msg.action;
                }
                // Collect all textual messages for history
                if (msg.type === 'response' || msg.type === 'error' || msg.type === 'status' || msg.type === 'confirmation') {
                    if (msg.text)
                        aiResponseTexts.push(msg.text);
                }
                if (msg.type === 'auto_debug') {
                    this.autoDebug(); // no specific file
                    return;
                }
            }
            // Update conversation history with user message and aggregated AI text
            const aiText = aiResponseTexts.join('\n');
            this.conversationHistory += `User: ${text}\nAssistant: ${aiText}\n`;
        }
        catch (error) {
            console.error('Backend communication failed:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            this.view?.webview.postMessage({
                type: 'error',
                text: `Failed to reach AI backend: ${errorMessage}`
            });
        }
    }
    handleIncomingMessage(message) {
        if (!this.view)
            return;
        if (message.type === 'create_project') {
            const folder = message.folder;
            const files = message.files || [];
            // First create the folder
            this.createFolderInWorkspace(folder);
            // Then create each file inside that folder
            for (const file of files) {
                // Prepend folder to file path (ensure no double slashes)
                const fullPath = path.join(folder, file.path);
                this.createFileInWorkspace(fullPath, file.content);
            }
            return;
        }
        // File/folder creation/update requests are forwarded to workspace methods
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
        // if (message.type === 'debug_file') {
        //     if (message.path) {
        //         this.debugFileInWorkspace(message.path); // existing one-shot
        //     } else {
        //         this.autoDebug(); // no file specified -> auto
        //     }
        //     return;
        // }
        if (message.type === 'debug_file') {
            this.autoDebug(message.path); // always use autoDebug, which handles iteration
            return;
        }
        // All other message types are just forwarded to the webview
        this.view.webview.postMessage(message);
    }
    // ---------- Local workspace searches (implemented with VS Code API) ----------
    async handleSearchFiles(keyword, fileType) {
        // Normalize fileType: ensure it starts with a dot if provided
        let ext = '';
        if (fileType) {
            ext = fileType.startsWith('.') ? fileType : '.' + fileType;
        }
        const pattern = ext ? `**/*${keyword}*${ext}` : `**/*${keyword}*`;
        const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        const results = await Promise.all(uris.map(async (uri) => {
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
    async handleSearchFolders(keyword) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return;
        // Use asynchronous directory walking to avoid blocking
        const results = [];
        const walkAsync = async (dir) => {
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
    async handleSearchInFiles(keyword, filePattern = '*') {
        const uris = await vscode.workspace.findFiles(`**/${filePattern}`, '**/node_modules/**', 100);
        const matches = [];
        for (const uri of uris) {
            const content = (await vscode.workspace.fs.readFile(uri)).toString();
            const lines = content.split('\n');
            const matchingLines = [];
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
            if (matches.length >= 10)
                break;
        }
        const formatted = this.formatSearchResults(matches, 'content matches');
        this.view?.webview.postMessage({ type: 'response', text: formatted });
    }
    async handleGetFileInfo(filePath) {
        const workspaceRoot = this.getWorkspaceRoot();
        if (!workspaceRoot)
            return;
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
        }
        catch {
            this.view?.webview.postMessage({ type: 'error', text: `File not found: ${filePath}` });
        }
    }
    // Helper: count files in a folder recursively (async version)
    async countFilesInFolderAsync(folderPath) {
        let count = 0;
        const walk = async (dir) => {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
            for (const [name, type] of entries) {
                if (type === vscode.FileType.File)
                    count++;
                else if (type === vscode.FileType.Directory)
                    await walk(path.join(dir, name));
            }
        };
        await walk(folderPath);
        return count;
    }
    // Format search results similarly to the Python version
    formatSearchResults(results, type) {
        if (!results.length)
            return `[INFO] No ${type} found.`;
        const lines = [`[OK] Found ${results.length} ${type}:`, '-'.repeat(50)];
        results.forEach((item, i) => {
            if (type === 'files') {
                lines.push(`${i + 1}. ${item.name}`);
                lines.push(`   Path: ${item.path}`);
                lines.push(`   Size: ${this.formatFileSize(item.size)} | Modified: ${item.modified}`);
            }
            else if (type === 'folders') {
                lines.push(`${i + 1}. ${item.name}/`);
                lines.push(`   Path: ${item.path}/`);
                lines.push(`   Files: ${item.file_count}`);
            }
            else if (type === 'content matches') {
                lines.push(`${i + 1}. ${item.name}`);
                lines.push(`   Path: ${item.path}`);
                lines.push(`   Matches: ${item.matches} occurrences`);
                item.lines.forEach((l) => {
                    lines.push(`      Line ${l.lineNumber}: ${l.content}`);
                });
            }
            lines.push('');
        });
        return lines.join('\n');
    }
    formatFileSize(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIdx = 0;
        while (size >= 1024 && unitIdx < units.length - 1) {
            size /= 1024;
            unitIdx++;
        }
        return `${size.toFixed(2)} ${units[unitIdx]}`;
    }
    runAutoDebug(specificFile) {
        this.autoDebug(specificFile);
    }
    dispose() {
        // Nothing to dispose (no Python process)
    }
}
exports.Backend = Backend;
//# sourceMappingURL=backend.js.map