import * as vscode from 'vscode';
import { AuthService } from '../services/auth.service';
import { Logger } from '../utils/logger';

/**
 * Handler for authentication-related commands
 */
export class AuthCommandHandler {
    private authService: AuthService;
    private logger: Logger;

    constructor(private context: vscode.ExtensionContext) {
        this.authService = AuthService.getInstance();
        this.logger = Logger.getInstance();
    }

    /**
     * Register all authentication-related commands
     */
    public register(): void {
        this.registerCheckAuthStatusCommand();
        this.registerViewProfileCommand();
    }

    /**
     * Register command to check auth status
     */
    private registerCheckAuthStatusCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.checkAuthStatus', async () => {
            try {
                // Force a refresh of the current user
                await this.authService.refreshCurrentUser();

                if (this.authService.isAuthenticated) {
                    const user = this.authService.currentUser;
                    vscode.window.showInformationMessage(`Authenticated as: ${user?.email || 'Unknown user'}`);

                    // Refresh the Explorer view to update based on refreshed auth state
                    await vscode.commands.executeCommand('codingrules-ai.refreshExplorer');
                } else {
                    vscode.window.showWarningMessage('Not authenticated. Please login to see private content.');
                }
            } catch (error) {
                this.logger.error('Error checking auth status', error, 'AuthCommandHandler');
                vscode.window.showErrorMessage(
                    `Error checking authentication status: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to view profile
     */
    private registerViewProfileCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.viewProfile', async () => {
            if (this.authService.isAuthenticated) {
                await vscode.env.openExternal(vscode.Uri.parse('https://codingrules.ai/profile'));
            } else {
                vscode.window.showWarningMessage('Please login to view your profile.');
                vscode.commands.executeCommand('codingrules-ai.login');
            }
        });

        this.context.subscriptions.push(disposable);
    }
}
