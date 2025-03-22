import * as vscode from 'vscode';
import { AuthService } from '../services/auth.service';
import { SupabaseService } from '../services/supabase.service';
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

        // Register command to force refresh private rules
        this.context.subscriptions.push(
            vscode.commands.registerCommand(
                'codingrules-ai.forceRefreshPrivateRules',
                this.handleForceRefreshPrivateRules.bind(this),
            ),
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

            // Stop background token refresh before signing out
            this.authService.stopBackgroundRefresh();

            // Invalidate the private rules cache
            try {
                const supabaseService = SupabaseService.getInstance();
                supabaseService.invalidatePrivateRulesCache();
                this.logger.info('Invalidated private rules cache before logout', 'AuthHandler');
            } catch (cacheError) {
                this.logger.warn(`Failed to invalidate cache: ${cacheError}`, 'AuthHandler');
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
     * Handle force refreshing private rules when they are not visible
     */
    private async handleForceRefreshPrivateRules(): Promise<void> {
        try {
            this.logger.info('Force refreshing private rules and authentication state', 'AuthHandler');

            // Show progress notification
            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: 'Refreshing private rules...',
                    cancellable: false,
                },
                async (progress) => {
                    // Step 1: Force refresh the authentication state
                    progress.report({ message: 'Refreshing authentication state...' });
                    await this.authService.refreshCurrentUser();

                    // Log the current auth state after refresh
                    const isAuthenticated = this.authService.isAuthenticated;
                    const userId = this.authService.currentUser?.id;
                    this.logger.info(
                        `Auth state after refresh: authenticated=${isAuthenticated}, userId=${userId || 'null'}`,
                        'AuthHandler',
                    );

                    if (!isAuthenticated) {
                        // If not authenticated, try to re-authenticate
                        vscode.window
                            .showWarningMessage('Not authenticated. Please log in to see private rules.', 'Login')
                            .then((selection) => {
                                if (selection === 'Login') {
                                    vscode.commands.executeCommand('codingrules-ai.login');
                                }
                            });
                        return;
                    }

                    // Step 2: Invalidate private rules cache to force a fresh fetch
                    try {
                        const supabaseService = SupabaseService.getInstance();
                        supabaseService.invalidatePrivateRulesCache();
                        this.logger.info('Invalidated private rules cache during force refresh', 'AuthHandler');

                        // Step 2b: Explicitly load favorites to ensure they're refreshed
                        progress.report({ message: 'Loading favorite rules...' });
                        this.logger.info('Explicitly loading favorites during force refresh', 'AuthHandler');
                        await supabaseService.getFavoriteRules();
                    } catch (cacheError) {
                        this.logger.warn(`Failed to invalidate cache: ${cacheError}`, 'AuthHandler');
                    }

                    // Step 3: Refresh the explorer view to update the UI with private rules
                    progress.report({ message: 'Refreshing rules explorer...' });
                    await vscode.commands.executeCommand('codingrules-ai.refreshExplorer');

                    // Show success message
                    vscode.window.showInformationMessage(
                        `Successfully refreshed private rules and favorites for user ${userId}`,
                    );
                },
            );
        } catch (error) {
            this.logger.error('Error force refreshing private rules', error, 'AuthHandler');
            vscode.window.showErrorMessage(
                `Error refreshing private rules: ${error instanceof Error ? error.message : String(error)}`,
            );
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

                    // Start background token refresh after successful login
                    this.authService.startBackgroundRefresh();

                    // Log the user ID immediately after login
                    const userId = this.authService.currentUser?.id;
                    this.logger.info(`User authenticated with ID: ${userId || 'unknown'}`, 'AuthHandler');

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
