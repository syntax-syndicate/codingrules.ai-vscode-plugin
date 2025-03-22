import * as vscode from 'vscode';
import { AuthService } from '../services/auth.service';
import { Logger } from '../utils/logger';
import { SecurityUtils } from '../utils/security';

/**
 * Handles authentication-related functionality for the extension
 */
export class AuthHandler {
    private context: vscode.ExtensionContext;
    private authService: AuthService;
    private logger: Logger = Logger.getInstance();

    constructor(context: vscode.ExtensionContext, authService: AuthService) {
        this.context = context;
        this.authService = authService;
    }

    /**
     * Register authentication-related commands and handlers
     */
    public register(): void {
        // Register the URI handler for auth callbacks from web app
        this.context.subscriptions.push(
            vscode.window.registerUriHandler({
                handleUri: this.handleAuthCallback.bind(this),
            }),
        );

        // Register login command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.login', this.handleLoginCommand.bind(this)),
        );

        // Register logout command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.logout', this.handleLogoutCommand.bind(this)),
        );

        // Register command to check authentication status
        this.context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.checkAuthStatus', this.handleCheckAuthStatus.bind(this)),
        );

        // Register view profile command
        this.context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.viewProfile', this.handleViewProfileCommand.bind(this)),
        );
    }

    /**
     * Handle the login command
     */
    private async handleLoginCommand(): Promise<void> {
        try {
            // Check if already logged in
            if (this.authService.isAuthenticated) {
                const actions = ['View Profile', 'Logout', 'Cancel'];
                const choice = await vscode.window.showInformationMessage('You are already logged in.', ...actions);

                if (choice === 'View Profile') {
                    vscode.commands.executeCommand('codingrules-ai.viewProfile');
                } else if (choice === 'Logout') {
                    vscode.commands.executeCommand('codingrules-ai.logout');
                }
                return;
            }

            // Generate a secure random state parameter to prevent CSRF attacks
            const state = SecurityUtils.generateRandomState();

            // Store the state in extension storage for later verification
            await SecurityUtils.storeAuthState(this.context, state);

            // Determine the correct protocol based on the editor
            const editorProtocol = SecurityUtils.getEditorProtocol();

            // Redirect to web app with state parameter
            const webAppUrl = `https://codingrules.ai/auth/extension?redirect=${encodeURIComponent(
                editorProtocol + this.context.extension.id + '/auth/callback',
            )}&state=${encodeURIComponent(state)}`;

            await vscode.env.openExternal(vscode.Uri.parse(webAppUrl));
            vscode.window.showInformationMessage('Redirecting to the CodingRules.ai login page...');
        } catch (error) {
            this.logger.error('Login failed', error, 'AuthHandler');
            vscode.window.showErrorMessage(`Login failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle the logout command
     */
    private async handleLogoutCommand(): Promise<void> {
        try {
            if (!this.authService.isAuthenticated) {
                vscode.window.showInformationMessage('You are not logged in.');
                return;
            }

            await this.authService.signOut();

            // Refresh Explorer view after logout
            await vscode.commands.executeCommand('codingrules-ai.refreshExplorer');

            vscode.window.showInformationMessage('Successfully logged out from CodingRules.ai');
        } catch (error) {
            this.logger.error('Logout failed', error, 'AuthHandler');
            vscode.window.showErrorMessage(`Logout failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Handle the check auth status command
     */
    private async handleCheckAuthStatus(): Promise<void> {
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
            this.logger.error('Error checking auth status', error, 'AuthHandler');
            vscode.window.showErrorMessage(
                `Error checking authentication status: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Handle the view profile command
     */
    private async handleViewProfileCommand(): Promise<void> {
        if (this.authService.isAuthenticated) {
            await vscode.env.openExternal(vscode.Uri.parse('https://codingrules.ai/profile'));
        } else {
            vscode.window.showWarningMessage('Please login to view your profile.');
            vscode.commands.executeCommand('codingrules-ai.login');
        }
    }

    /**
     * Handle authentication callback URI from web app
     */
    private async handleAuthCallback(uri: vscode.Uri): Promise<void> {
        if (uri.path === '/auth/callback') {
            // Extract token from the query parameters
            const params = new URLSearchParams(uri.query);
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const state = params.get('state');

            // Verify the state parameter to prevent CSRF attacks
            const isValidState = SecurityUtils.validateAuthState(this.context, state);

            if (!isValidState) {
                this.logger.error('Authentication failed: Invalid state parameter', null, 'AuthHandler');
                vscode.window.showErrorMessage('Authentication failed: Invalid state parameter');
                return;
            }

            // Clear the stored state after verification
            await SecurityUtils.clearAuthState(this.context);

            if (accessToken) {
                try {
                    // Set the session with the received tokens
                    await this.authService.setSessionFromTokens(accessToken, refreshToken || '');

                    // Explicitly refresh the explorer to update UI
                    await vscode.commands.executeCommand('codingrules-ai.refreshExplorer');

                    // Show success message after refresh
                    vscode.window.showInformationMessage('Successfully logged in to CodingRules.ai');
                } catch (error) {
                    this.logger.error('Error during authentication process', error, 'AuthHandler');
                    vscode.window.showErrorMessage(
                        `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            } else {
                vscode.window.showErrorMessage('Authentication failed: No access token received');
            }
        }
    }
}
