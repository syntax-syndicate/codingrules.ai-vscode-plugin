import * as vscode from 'vscode';
import { Config } from './config';
import { SupabaseService } from './services/supabase.service';
import { AuthService } from './services/auth.service';
import { Rule, AIToolFormat, GenericFormat } from './models/rule.model';
import { RuleDownloaderService, RuleSaveOptions } from './services/rule-downloader.service';
import { RulesExplorerProvider, RuleExplorerItem, RuleExplorerItemType } from './views/rules-explorer';
import { RuleViewer } from './views/rule-viewer';
import { LoginWebView } from './views/login-webview';

export function activate(context: vscode.ExtensionContext) {
    console.log('Extension "codingrules-ai" is now active!');

    try {
        // Initialize configuration
        const config = Config.getInstance(context);

        // Initialize services
        let supabaseService: SupabaseService;
        let authService: AuthService;

        try {
            const supabaseConfig = config.getSupabaseConfig();

            // Initialize Auth Service
            authService = AuthService.initialize(supabaseConfig, context);

            // Initialize Supabase Service
            supabaseService = SupabaseService.initialize(supabaseConfig);

            // Connect auth service to supabase service
            supabaseService.setAuthService(authService);
        } catch (error) {
            console.error('Failed to initialize services:', error);
            vscode.window.showErrorMessage(
                `Failed to initialize CodingRules.ai: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        // Register commands that the explorer view depends on
        // These need to be registered BEFORE the explorer view is created

        // Register login command
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.login', async () => {
                try {
                    // Show login web view
                    LoginWebView.show(context, authService);

                    // Once login is successful, refresh the Explorer view
                    // This is handled by the LoginWebView itself to refresh after login
                    // The authService notifies about login success
                } catch (error) {
                    vscode.window.showErrorMessage(
                        `Login failed: ${error instanceof Error ? error.message : String(error)}`,
                    );
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

        // Register config command
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.configureSupabase', async () => {
                // Open settings and focus on our extension's settings
                await vscode.commands.executeCommand('workbench.action.openSettings', 'codingrules-ai');
            }),
        );

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
