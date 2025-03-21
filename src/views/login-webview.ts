import * as vscode from 'vscode';
import { AuthService } from '../services/auth.service';

/**
 * Manages the login webview panel
 */
export class LoginWebView {
    public static readonly viewType = 'codingrules-ai.login';
    private static instance: LoginWebView | undefined;

    private readonly _panel: vscode.WebviewPanel;
    private readonly _authService: AuthService;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, authService: AuthService, extensionUri: vscode.Uri) {
        this._panel = panel;
        this._authService = authService;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'login':
                        try {
                            await this._authService.login(message.email, message.password);
                            // Send success message to webview
                            this._panel.webview.postMessage({ type: 'success', message: 'Login successful!' });

                            // Refresh the explorer to show the new authenticated state
                            vscode.commands.executeCommand('codingrules-ai.refreshExplorer');

                            // Close the panel after successful login
                            setTimeout(() => this._panel.dispose(), 1500);
                        } catch (error) {
                            this._panel.webview.postMessage({
                                type: 'error',
                                message: error instanceof Error ? error.message : String(error),
                            });
                        }
                        break;
                    case 'cancel':
                        this._panel.dispose();
                        break;
                }
            },
            null,
            this._disposables,
        );
    }

    /**
     * Shows the login panel
     */
    public static show(context: vscode.ExtensionContext, authService: AuthService): LoginWebView {
        const extensionUri = context.extensionUri;

        // If we already have a panel, show it
        if (LoginWebView.instance) {
            LoginWebView.instance._panel.reveal(vscode.ViewColumn.One);
            return LoginWebView.instance;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            LoginWebView.viewType,
            'CodingRules.ai Login',
            vscode.ViewColumn.One,
            {
                // Enable JavaScript in the webview
                enableScripts: true,
                // And restrict the webview to only loading content from our extension's directory
                localResourceRoots: [extensionUri],
            },
        );

        LoginWebView.instance = new LoginWebView(panel, authService, extensionUri);
        return LoginWebView.instance;
    }

    /**
     * Dispose this view
     */
    public dispose() {
        LoginWebView.instance = undefined;

        // Clean up resources
        this._panel.dispose();

        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }

    /**
     * Update the webview content
     */
    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    /**
     * Get the HTML for the webview
     */
    private _getHtmlForWebview() {
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Login to CodingRules.ai</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                    max-width: 500px;
                    margin: 0 auto;
                }
                .container {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                h1 {
                    font-size: 24px;
                    font-weight: 600;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }
                label {
                    font-weight: 500;
                }
                input {
                    padding: 8px 10px;
                    border-radius: 4px;
                    border: 1px solid var(--vscode-input-border);
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }
                input:focus {
                    outline: 1px solid var(--vscode-focusBorder);
                    border-color: var(--vscode-focusBorder);
                }
                .buttons {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    margin-top: 10px;
                }
                button {
                    padding: 8px 16px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    border: none;
                }
                .primary-button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                }
                .primary-button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .secondary-button {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                }
                .secondary-button:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
                .message {
                    padding: 10px;
                    border-radius: 4px;
                    display: none;
                    margin-bottom: 15px;
                }
                .error {
                    background-color: var(--vscode-inputValidation-errorBackground);
                    border: 1px solid var(--vscode-inputValidation-errorBorder);
                    color: var(--vscode-inputValidation-errorForeground);
                }
                .success {
                    background-color: var(--vscode-inputValidation-infoBackground);
                    border: 1px solid var(--vscode-inputValidation-infoBorder);
                    color: var(--vscode-inputValidation-infoForeground);
                }
                .center {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                }
                .logo {
                    width: 120px;
                    height: auto;
                    margin-bottom: 20px;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="center">
                    <img src="https://codingrules.ai/logo.png" alt="CodingRules.ai Logo" class="logo">
                </div>
                <h1>Login to CodingRules.ai</h1>
                
                <div id="message" class="message"></div>
                
                <form id="loginForm">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" required placeholder="your-email@example.com">
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" required placeholder="Your password">
                    </div>
                    
                    <div class="buttons">
                        <button type="button" class="secondary-button" id="cancelButton">Cancel</button>
                        <button type="submit" class="primary-button" id="loginButton">Login</button>
                    </div>
                </form>
                
                <p class="center">
                    Don't have an account? <a href="https://codingrules.ai/auth/signup" target="_blank">Sign up</a>
                </p>
            </div>
            
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    const messageEl = document.getElementById('message');
                    const loginForm = document.getElementById('loginForm');
                    const loginButton = document.getElementById('loginButton');
                    const cancelButton = document.getElementById('cancelButton');
                    
                    // Handle form submission
                    loginForm.addEventListener('submit', (e) => {
                        e.preventDefault();
                        const email = document.getElementById('email').value;
                        const password = document.getElementById('password').value;
                        
                        // Disable button during login
                        loginButton.disabled = true;
                        loginButton.innerText = 'Logging in...';
                        
                        // Send message to extension
                        vscode.postMessage({
                            command: 'login',
                            email,
                            password
                        });
                    });
                    
                    // Handle cancel button
                    cancelButton.addEventListener('click', () => {
                        vscode.postMessage({
                            command: 'cancel'
                        });
                    });
                    
                    // Handle messages from extension
                    window.addEventListener('message', (event) => {
                        const message = event.data;
                        
                        switch (message.type) {
                            case 'error':
                                showMessage(message.message, 'error');
                                loginButton.disabled = false;
                                loginButton.innerText = 'Login';
                                break;
                            case 'success':
                                showMessage(message.message, 'success');
                                loginButton.innerText = 'Success!';
                                break;
                        }
                    });
                    
                    function showMessage(text, type) {
                        messageEl.textContent = text;
                        messageEl.className = 'message ' + type;
                        messageEl.style.display = 'block';
                    }
                })();
            </script>
        </body>
        </html>`;
    }
}
