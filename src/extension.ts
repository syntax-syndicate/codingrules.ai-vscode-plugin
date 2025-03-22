import * as vscode from 'vscode';
import { Config } from './config';
import { SupabaseService } from './services/supabase.service';
import { AuthService } from './services/auth.service';
import { Rule, AIToolFormat, GenericFormat } from './models/rule.model';
import { RuleDownloaderService, RuleSaveOptions } from './services/rule-downloader.service';
import { RulesExplorerProvider, RuleExplorerItem, RuleExplorerItemType } from './views/rules-explorer';
import { RuleViewer } from './views/rule-viewer';
import * as crypto from 'crypto';

/**
 * Detects which editor/IDE the extension is running in and returns the appropriate URI protocol.
 * This allows the authentication callback to work properly across different VS Code-based editors.
 */
function getEditorProtocol(): string {
    const appName = (vscode.env.appName || '').toLowerCase();

    if (appName.includes('insiders') && (appName.includes('code') || appName.includes('vscode'))) {
        return 'code-insiders://';
    }

    if (appName.includes('visual studio code') || appName === 'code' || appName.includes('vscode')) {
        return 'vscode://';
    }

    if (appName.includes('cursor')) {
        return 'cursor://';
    }

    if (appName.includes('windsurf')) {
        return 'windsurf://';
    }

    if (appName.includes('codium')) {
        return 'codium://';
    }

    const firstWord = appName.split(' ')[0].trim();
    if (firstWord && !firstWord.includes('/') && !firstWord.includes('\\')) {
        return `${firstWord}://`;
    }

    return 'vscode://';
}

export async function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize configuration
        const config = Config.getInstance(context);

        // Get Supabase configuration
        const supabaseConfig = config.getSupabaseConfig();

        // Initialize services - make sure to await the auth service initialization
        const supabaseService = SupabaseService.initialize(supabaseConfig);
        const authService = await AuthService.initialize(supabaseConfig, context);

        // Link services (circular dependency resolution)
        supabaseService.setAuthService(authService);

        /**
         * Handle the login flow
         */
        async function loginCommand(extensionContext: vscode.ExtensionContext): Promise<void> {
            try {
                // Generate a secure random state parameter to prevent CSRF attacks
                const state = crypto.randomBytes(32).toString('hex');

                // Store the state in extension storage for later verification
                await extensionContext.globalState.update('codingrules.authState', state);

                // Determine the correct protocol based on the editor
                const editorProtocol = getEditorProtocol();

                // Redirect to web app with state parameter
                const webAppUrl = `https://codingrules.ai/auth/extension?redirect=${encodeURIComponent(editorProtocol + extensionContext.extension.id + '/auth/callback')}&state=${encodeURIComponent(state)}`;
                await vscode.env.openExternal(vscode.Uri.parse(webAppUrl));
                vscode.window.showInformationMessage('Redirecting to the CodingRules.ai login page...');
            } catch (error) {
                vscode.window.showErrorMessage(
                    `Login failed: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
        }

        // Register the URI handler for auth callbacks from web app
        context.subscriptions.push(
            vscode.window.registerUriHandler({
                async handleUri(uri: vscode.Uri): Promise<void> {
                    if (uri.path === '/auth/callback') {
                        // Extract token from the query parameters
                        const params = new URLSearchParams(uri.query);
                        const accessToken = params.get('access_token');
                        const refreshToken = params.get('refresh_token');
                        const state = params.get('state');

                        // Verify the state parameter to prevent CSRF attacks
                        const storedState = context.globalState.get('codingrules.authState');

                        if (!state || state !== storedState) {
                            vscode.window.showErrorMessage('Authentication failed: Invalid state parameter');
                            return;
                        }

                        // Clear the stored state after verification
                        context.globalState.update('codingrules.authState', undefined);

                        if (accessToken) {
                            try {
                                // Set the session with the received tokens
                                await authService.setSessionFromTokens(accessToken, refreshToken || '');

                                // Explicitly refresh the explorer to update UI
                                await vscode.commands.executeCommand('codingrules-ai.refreshExplorer');

                                // Show success message after refresh
                                vscode.window.showInformationMessage('Successfully logged in to CodingRules.ai');
                            } catch (error) {
                                console.error('Error during authentication process:', error);
                                vscode.window.showErrorMessage(
                                    `Authentication failed: ${error instanceof Error ? error.message : String(error)}`,
                                );
                            }
                        } else {
                            vscode.window.showErrorMessage('Authentication failed: No access token received');
                        }
                    }
                    return;
                },
            }),
        );

        // Register commands that the explorer view depends on
        // These need to be registered BEFORE the explorer view is created

        // Register login command
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.login', async () => {
                // Check if already logged in
                if (authService.isAuthenticated) {
                    const actions = ['View Profile', 'Logout', 'Cancel'];
                    const choice = await vscode.window.showInformationMessage('You are already logged in.', ...actions);

                    if (choice === 'View Profile') {
                        vscode.commands.executeCommand('codingrules-ai.viewProfile');
                    } else if (choice === 'Logout') {
                        vscode.commands.executeCommand('codingrules-ai.logout');
                    }
                    return;
                }

                // Open login in browser
                await loginCommand(context);
            }),
        );

        // Register command to check authentication status
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.checkAuthStatus', async () => {
                // Force a refresh of the current user
                await authService.refreshCurrentUser();

                if (authService.isAuthenticated) {
                    const user = authService.currentUser;
                    vscode.window.showInformationMessage(`Authenticated as: ${user?.email || 'Unknown user'}`);
                    // Refresh the Explorer view to update based on refreshed auth state
                    rulesExplorerProvider.refreshData();
                } else {
                    vscode.window.showWarningMessage('Not authenticated. Please login to see private content.');
                }
            }),
        );

        // Register view profile command
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.viewProfile', async () => {
                if (authService.isAuthenticated) {
                    const user = authService.currentUser;
                    vscode.window.showInformationMessage(`Logged in as ${user?.email || 'unknown user'}`);
                } else {
                    const result = await vscode.window.showInformationMessage(
                        'You are not logged in. Private rules and features are not available.',
                        'Login Now',
                    );

                    if (result === 'Login Now') {
                        vscode.commands.executeCommand('codingrules-ai.login');
                    }
                }
            }),
        );

        // Register the Rules Explorer view after the login command is registered
        const rulesExplorerProvider = new RulesExplorerProvider(context);
        const rulesExplorer = vscode.window.createTreeView('codingrulesExplorer', {
            treeDataProvider: rulesExplorerProvider,
            showCollapseAll: true,
        });
        context.subscriptions.push(rulesExplorer);

        // Register the refresh command for the explorer view
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.refreshExplorer', () => {
                rulesExplorerProvider.refreshData();
            }),
        );

        // Register command to search for rules
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.searchRules', async () => {
                try {
                    const query = await vscode.window.showInputBox({
                        placeHolder: 'Enter search term for coding rules',
                        prompt: 'Search for rules by title, content, or tags',
                    });

                    if (!query) {
                        return; // User cancelled
                    }

                    const searchResults = await supabaseService.searchRules({ query });
                    if (searchResults.rules.length === 0) {
                        vscode.window.showInformationMessage('No rules found matching your search.');
                        return;
                    }

                    // Present rules to user for selection
                    const items = searchResults.rules.map((rule) => ({
                        label: rule.title,
                        detail: `${rule.tags?.map((t) => t.name).join(', ') || 'No tags'} - Upvotes: ${rule.upvote_count}`,
                        rule,
                    }));

                    const selected = await vscode.window.showQuickPick(items, {
                        placeHolder: 'Select a rule to view or download',
                    });

                    if (selected) {
                        // Show the rule viewer
                        RuleViewer.show(selected.rule, context);
                    }
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Error searching rules: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }),
        );

        // Register command to download a rule (internal, called after validation)
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.downloadRuleInternal', async (rule?: Rule) => {
                try {
                    // If no rule provided, show search to select one
                    if (!rule) {
                        await vscode.commands.executeCommand('codingrules-ai.searchRules');
                        return;
                    }

                    const workspaceFolder = RuleDownloaderService.getWorkspaceFolder();
                    if (!workspaceFolder) {
                        throw new Error('No workspace folder open');
                    }

                    // Check if format was provided (e.g., from rule viewer)
                    let format = (rule as any).selectedFormat;

                    // If no format provided, ask user to select one
                    if (!format) {
                        const formatOptions = [
                            // AI Tool formats
                            {
                                label: 'Cursor (.cursorrules)',
                                format: AIToolFormat.CURSOR,
                                description: 'Creates .cursorrules file',
                            },
                            {
                                label: 'Windsurf (.windsurfrules)',
                                format: AIToolFormat.WINDSURF,
                                description: 'Creates .windsurfrules file',
                            },
                            {
                                label: 'Cline (.clinerules)',
                                format: AIToolFormat.CLINE,
                                description: 'Creates .clinerules file',
                            },
                            {
                                label: 'GitHub Copilot (copilot-instructions.md)',
                                format: AIToolFormat.GITHUB_COPILOT,
                                description: 'Creates copilot-instructions.md file',
                            },
                            // Generic formats
                            {
                                label: 'Markdown',
                                format: GenericFormat.MD,
                                description: 'Creates [rule-title].md file',
                            },
                            { label: 'Text', format: GenericFormat.TXT, description: 'Creates [rule-title].txt file' },
                        ];

                        const selectedFormat = await vscode.window.showQuickPick(formatOptions, {
                            placeHolder: 'Select the format to download the rule as',
                        });

                        if (!selectedFormat) {
                            return; // User cancelled
                        }

                        format = selectedFormat.format;
                    }

                    // Create downloader instance
                    const downloader = new RuleDownloaderService();

                    // Generate the file path based on format type
                    let filePath: string;
                    if (Object.values(AIToolFormat).includes(format as AIToolFormat)) {
                        // For tool-specific formats, use just the extension
                        filePath = `${workspaceFolder}/${format}`;
                    } else {
                        // For generic formats, use title + extension
                        const fileName = rule.slug || downloader.sanitizeFileName(rule.title);
                        filePath = `${workspaceFolder}/${fileName}${format}`;
                    }
                    let replaceExisting = false;

                    try {
                        const fs = require('fs');
                        if (fs.existsSync(filePath)) {
                            const choice = await vscode.window.showQuickPick(
                                ['Replace existing file', 'Merge with existing content', 'Cancel'],
                                { placeHolder: 'File already exists. How would you like to proceed?' },
                            );

                            if (!choice || choice === 'Cancel') {
                                return; // User cancelled
                            }

                            replaceExisting = choice === 'Replace existing file';
                        }
                    } catch (error) {
                        // Ignore file check errors
                    }

                    // Validate rule has required properties
                    if (!rule.title) {
                        vscode.window.showErrorMessage(
                            `Cannot download rule: Missing title information. Please try another rule.`,
                        );
                        return;
                    }

                    // Validate rule content before attempting to download
                    if (!rule.content) {
                        vscode.window.showErrorMessage(
                            `Cannot download rule "${rule.title}": Rule content is empty or missing. Please try another rule.`,
                        );
                        return;
                    }

                    // Download the rule
                    const saveOptions: RuleSaveOptions = {
                        directory: workspaceFolder,
                        format: format,
                        replaceExisting,
                    };

                    const savedPath = await downloader.downloadRule(rule, saveOptions);

                    vscode.window.showInformationMessage(`Rule downloaded to: ${savedPath}`);

                    // Open the file
                    const document = await vscode.workspace.openTextDocument(savedPath);
                    await vscode.window.showTextDocument(document);
                } catch (error) {
                    if (error instanceof Error && error.message.includes('Rule content is undefined')) {
                        vscode.window.showErrorMessage(
                            `Failed to download rule: The selected rule has no content. Please try another rule.`,
                        );
                    } else {
                        vscode.window.showErrorMessage(
                            `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                }
            }),
        );

        // Register command to view a rule
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.viewRule', (item?: RuleExplorerItem) => {
                // If no rule provided directly via treeview, show search to select one
                if (!item || item.type !== RuleExplorerItemType.RULE || !item.data) {
                    vscode.commands.executeCommand('codingrules-ai.searchRules');
                    return;
                }

                // Show the rule viewer
                RuleViewer.show(item.data as Rule, context);
            }),
        );

        // Handle clicks on items in the Rules Explorer
        rulesExplorer.onDidChangeSelection((e) => {
            if (e.selection.length > 0) {
                const item = e.selection[0];

                if (item.type === RuleExplorerItemType.RULE) {
                    vscode.commands.executeCommand('codingrules-ai.viewRule', item);
                }
            }
        });

        // Login command is already registered above

        // Register logout command
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.logout', async () => {
                try {
                    // Log out the user
                    await authService.logout();

                    // Refresh the Explorer view to update based on auth state
                    rulesExplorerProvider.refreshData();

                    vscode.window.showInformationMessage('Successfully logged out');
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Logout failed: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }),
        );

        // View profile command is already registered above
    } catch (error) {
        console.error('Error activating codingrules-ai extension:', error);
        vscode.window.showErrorMessage(
            `Failed to activate CodingRules.ai: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

export function deactivate() {
    // Clean up resources if needed
}
