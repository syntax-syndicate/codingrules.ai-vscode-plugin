import * as vscode from 'vscode';
import { Config } from './config';
import { SupabaseService } from './services/supabase.service';
import { AuthService } from './services/auth.service';
import { Rule, AIToolFormat, GenericFormat } from './models/rule.model';
import { RuleDownloaderService } from './services/rule-downloader.service';
import { RulesExplorerProvider, RuleExplorerItem, RuleExplorerItemType } from './views/rules-explorer';
import { RuleViewer } from './views/rule-viewer';
import { Logger, LogLevel } from './utils/logger';
import { AuthHandler } from './handlers/auth-handler';

/**
 * Entry point for the extension
 */
export async function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize logger
        const logger = Logger.getInstance();
        logger.configure({
            level: LogLevel.INFO,
            outputToConsole: false,
            redactSensitiveData: true,
        });

        logger.info('Activating CodingRules.ai extension', 'Extension');

        // Initialize configuration
        const config = Config.getInstance(context);

        // Get Supabase configuration
        const supabaseConfig = config.getSupabaseConfig();

        // Initialize services - make sure to await the auth service initialization
        const supabaseService = SupabaseService.initialize(supabaseConfig);
        const authService = await AuthService.initialize(supabaseConfig, context);

        // Link services (circular dependency resolution)
        supabaseService.setAuthService(authService);

        // Initialize authentication handler
        const authHandler = new AuthHandler(context, authService);
        authHandler.register();

        // Initialize rule downloader service
        const ruleDownloaderService = new RuleDownloaderService();

        // Initialize the explorer provider
        const rulesExplorerProvider = new RulesExplorerProvider(context);

        // Register the explorer view
        const rulesExplorerView = vscode.window.createTreeView('codingrulesExplorer', {
            treeDataProvider: rulesExplorerProvider,
            showCollapseAll: true,
        });

        // Add the tree view to context subscriptions
        context.subscriptions.push(rulesExplorerView);

        // Register command to refresh explorer
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.refreshExplorer', () => {
                rulesExplorerProvider.refreshData();
            }),
        );

        // Register command to view rule details
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.viewRule', async (node: RuleExplorerItem) => {
                if (node.type === RuleExplorerItemType.RULE && node.dataId) {
                    // Get full rule data
                    const rule = await supabaseService.getRule(node.dataId);

                    // Show rule panel
                    if (rule) {
                        RuleViewer.show(rule, context);
                    } else {
                        vscode.window.showErrorMessage('Could not load rule details.');
                    }
                }
            }),
        );

        // Register command to download rule from explorer
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.downloadRule', async (node: RuleExplorerItem | Rule) => {
                try {
                    let rule: Rule | null = null;
                    let selectedFormat: string | undefined;

                    // Handle different input types
                    if (node instanceof RuleExplorerItem) {
                        // Case 1: Input is a TreeItem from the explorer
                        if (node.type !== RuleExplorerItemType.RULE || !node.dataId) {
                            vscode.window.showErrorMessage('Could not download: Item is not a rule.');
                            return;
                        }
                        rule = await supabaseService.getRule(node.dataId);
                    } else if (typeof node === 'object' && node !== null) {
                        // Case 2: Input is a Rule object
                        rule = node as Rule;
                        // Check if the rule has a selectedFormat property (from rule-viewer)
                        if ((rule as any).selectedFormat) {
                            selectedFormat = (rule as any).selectedFormat;
                        }
                    } else {
                        vscode.window.showErrorMessage('Invalid input for download command.');
                        return;
                    }

                    if (!rule) {
                        vscode.window.showErrorMessage('Could not load rule details for download.');
                        return;
                    }

                    // If no format already selected (from rule-viewer), show format selection menu
                    if (!selectedFormat) {
                        // Create format options including copy to clipboard
                        const formatOptions = [
                            { label: 'Copy to clipboard', action: 'copy' },
                            { label: `Cline Rule (${AIToolFormat.CLINE})`, format: AIToolFormat.CLINE },
                            { label: `Cursor Rule (${AIToolFormat.CURSOR})`, format: AIToolFormat.CURSOR },
                            { label: `Windsurf Rule (${AIToolFormat.WINDSURF})`, format: AIToolFormat.WINDSURF },
                            { label: `Markdown (${GenericFormat.MD})`, format: GenericFormat.MD },
                            { label: `Text file (${GenericFormat.TXT})`, format: GenericFormat.TXT },
                        ];

                        // Show quick pick menu
                        const selectedOption = await vscode.window.showQuickPick(
                            formatOptions.map((option) => option.label),
                            {
                                placeHolder: 'Select download format or action',
                            },
                        );

                        if (!selectedOption) {
                            // User cancelled
                            return;
                        }

                        // Find the selected format or action
                        const option = formatOptions.find((opt) => opt.label === selectedOption);

                        if (option?.action === 'copy') {
                            // Handle copy to clipboard action
                            await vscode.env.clipboard.writeText(rule.content);
                            vscode.window.showInformationMessage('Rule copied to clipboard');
                            return;
                        } else if (option?.format) {
                            selectedFormat = option.format;
                        } else {
                            // User cancelled or something went wrong
                            return;
                        }
                    }

                    // Get current workspace folder
                    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

                    if (!workspaceFolder) {
                        // No workspace is open, show a file picker as fallback
                        vscode.window.showWarningMessage(
                            'No workspace folder is open. Please select a folder to save the rule.',
                        );

                        const folderUri = await vscode.window.showOpenDialog({
                            canSelectFiles: false,
                            canSelectFolders: true,
                            canSelectMany: false,
                            openLabel: 'Select Folder to Save Rule',
                        });

                        if (!folderUri || folderUri.length === 0) {
                            // User cancelled
                            return;
                        }

                        // Download the rule to selected folder
                        const filePath = await ruleDownloaderService.downloadRule(rule, {
                            directory: folderUri[0].fsPath,
                            format: selectedFormat,
                            includeMetadata: true,
                        });

                        // Open the file
                        if (filePath) {
                            const openDocument = await vscode.workspace.openTextDocument(filePath);
                            await vscode.window.showTextDocument(openDocument);
                            vscode.window.showInformationMessage(`Rule "${rule.title}" has been downloaded.`);
                        }
                    } else {
                        // Download directly to workspace folder
                        const filePath = await ruleDownloaderService.downloadRule(rule, {
                            directory: workspaceFolder,
                            format: selectedFormat,
                            includeMetadata: true,
                        });

                        // Open the file
                        if (filePath) {
                            const openDocument = await vscode.workspace.openTextDocument(filePath);
                            await vscode.window.showTextDocument(openDocument);
                            vscode.window.showInformationMessage(
                                `Rule "${rule.title}" has been downloaded to workspace.`,
                            );
                        }
                    }
                } catch (error) {
                    logger.error('Error downloading rule', error, 'Extension');
                    vscode.window.showErrorMessage(
                        `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }),
        );

        // Register command to copy rule content to clipboard
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.copyRuleContent', async (node: RuleExplorerItem) => {
                if (node.type === RuleExplorerItemType.RULE && node.dataId) {
                    try {
                        // Get full rule data
                        const rule = await supabaseService.getRule(node.dataId);

                        if (!rule || !rule.content) {
                            vscode.window.showErrorMessage('Could not load rule content for copying.');
                            return;
                        }

                        // Copy the content to the clipboard
                        await vscode.env.clipboard.writeText(rule.content);
                        vscode.window.showInformationMessage(`Rule content copied to clipboard.`);
                    } catch (error) {
                        logger.error('Error copying rule to clipboard', error, 'Extension');
                        vscode.window.showErrorMessage(
                            `Failed to copy rule: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                }
            }),
        );

        // Register command to search for rules
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.searchRules', async () => {
                const searchQuery = await vscode.window.showInputBox({
                    prompt: 'Search for rules by title, content, or tags',
                    placeHolder: 'E.g., "best practices", "security", etc.',
                });

                if (searchQuery) {
                    // Show loading indicator via notification
                    const searchingMessage = vscode.window.setStatusBarMessage(
                        `$(search~spin) Searching for rules matching "${searchQuery}"...`,
                    );

                    try {
                        // Search the API
                        const { rules } = await supabaseService.searchRules({ query: searchQuery });

                        // Clear status message
                        searchingMessage.dispose();

                        if (rules.length === 0) {
                            vscode.window.showInformationMessage('No rules found matching your search.');
                            return;
                        }

                        // Show results in a QuickPick dropdown
                        const quickPick = vscode.window.createQuickPick<RuleQuickPickItem>();
                        quickPick.title = `Search Results for "${searchQuery}"`;
                        quickPick.placeholder = 'Select a rule to view details, or use the buttons to copy/download';

                        // First, create QuickPick items with loading indicator for author names
                        const initialItems: RuleQuickPickItem[] = rules.map((rule) => {
                            return {
                                label: rule.title,
                                description: `${rule.upvote_count || 0} 👍${rule.is_private ? ' (Private)' : ''}`,
                                detail: 'Loading author info...',
                                rule: rule,
                                buttons: [
                                    {
                                        iconPath: new vscode.ThemeIcon('eye'),
                                        tooltip: 'View Rule Details',
                                    },
                                    {
                                        iconPath: new vscode.ThemeIcon('copy'),
                                        tooltip: 'Copy to Clipboard',
                                    },
                                    {
                                        iconPath: new vscode.ThemeIcon('cloud-download'),
                                        tooltip: 'Download Rule',
                                    },
                                ],
                            };
                        });

                        // Set initial items
                        quickPick.items = initialItems;
                        quickPick.busy = true;
                        quickPick.show();

                        // Fetch author profiles for all rules
                        const authorProfilePromises = rules
                            .filter((rule) => rule.author_id) // Only get profiles for rules with author_id
                            .map((rule) => ({
                                rule,
                                profilePromise: supabaseService.getUserProfile(rule.author_id),
                            }));

                        // Wait for all profile fetches to complete
                        const authorProfiles = await Promise.all(
                            authorProfilePromises.map(async (item) => {
                                const profile = await item.profilePromise;
                                return {
                                    rule: item.rule,
                                    profile,
                                };
                            }),
                        );

                        // Create a map of author_id to username
                        const authorMap = new Map<string, string>();
                        authorProfiles.forEach((item) => {
                            if (item.profile && item.profile.username) {
                                authorMap.set(item.rule.author_id, item.profile.username);
                            }
                        });

                        // Update items with author names
                        const updatedItems: RuleQuickPickItem[] = rules.map((rule) => {
                            // Get author name from map, or show Unknown
                            const authorName =
                                rule.author_id && authorMap.has(rule.author_id)
                                    ? authorMap.get(rule.author_id)
                                    : 'Unknown author';

                            return {
                                label: rule.title,
                                description: `${rule.upvote_count || 0} 👍${rule.is_private ? ' (Private)' : ''}`,
                                detail: `Author: ${authorName}`,
                                rule: rule,
                                buttons: [
                                    {
                                        iconPath: new vscode.ThemeIcon('eye'),
                                        tooltip: 'View Rule Details',
                                    },
                                    {
                                        iconPath: new vscode.ThemeIcon('copy'),
                                        tooltip: 'Copy to Clipboard',
                                    },
                                    {
                                        iconPath: new vscode.ThemeIcon('cloud-download'),
                                        tooltip: 'Download Rule',
                                    },
                                ],
                            };
                        });

                        // Update QuickPick with final items
                        quickPick.items = updatedItems;
                        quickPick.busy = false;

                        // Handle selection
                        quickPick.onDidAccept(() => {
                            const selectedItem = quickPick.selectedItems[0] as RuleQuickPickItem;
                            if (selectedItem && selectedItem.rule) {
                                // View rule details
                                RuleViewer.show(selectedItem.rule, context);
                                quickPick.hide();
                            }
                        });

                        // Handle button clicks
                        quickPick.onDidTriggerItemButton(async (event) => {
                            const selectedItem = event.item as RuleQuickPickItem;

                            if (!selectedItem.rule) {
                                return;
                            }

                            // Get button index (0 = view, 1 = copy, 2 = download)
                            const buttonIndex = selectedItem.buttons?.indexOf(event.button);

                            switch (buttonIndex) {
                                case 0: // View
                                    RuleViewer.show(selectedItem.rule, context);
                                    quickPick.hide();
                                    break;

                                case 1: // Copy
                                    await vscode.env.clipboard.writeText(selectedItem.rule.content || '');
                                    vscode.window.showInformationMessage(
                                        `Rule "${selectedItem.rule.title}" copied to clipboard.`,
                                    );
                                    break;

                                case 2: // Download
                                    // Pass to download command
                                    vscode.commands.executeCommand('codingrules-ai.downloadRule', selectedItem.rule);
                                    quickPick.hide();
                                    break;
                            }
                        });

                        // Show count in status bar
                        vscode.window.showInformationMessage(`Found ${rules.length} rules matching your search.`);
                    } catch (error) {
                        // Clear status message
                        searchingMessage.dispose();

                        logger.error('Error searching rules', error, 'Extension');
                        vscode.window.showErrorMessage(
                            `Failed to search rules: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                }
            }),
        );

        // Register command to clear search
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.clearSearch', async () => {
                rulesExplorerProvider.clearSearch();
            }),
        );

        // Browse rules on website command
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.browseWebsite', async () => {
                await vscode.env.openExternal(vscode.Uri.parse('https://codingrules.ai/rules'));
            }),
        );

        // Register command to copy rule to clipboard
        context.subscriptions.push(
            vscode.commands.registerCommand(
                'codingrules-ai.copyRuleToClipboard',
                async (node: RuleExplorerItem | Rule) => {
                    try {
                        let rule: Rule | null = null;

                        // Handle different input types
                        if (node instanceof RuleExplorerItem) {
                            // Case 1: Input is a TreeItem from the explorer
                            if (node.type !== RuleExplorerItemType.RULE || !node.dataId) {
                                vscode.window.showErrorMessage('Could not copy: Item is not a rule.');
                                return;
                            }
                            rule = await supabaseService.getRule(node.dataId);
                        } else if (typeof node === 'object' && node !== null) {
                            // Case 2: Input is a Rule object
                            rule = node as Rule;
                        } else {
                            vscode.window.showErrorMessage('Invalid input for copy command.');
                            return;
                        }

                        if (!rule) {
                            vscode.window.showErrorMessage('Could not load rule details for copying.');
                            return;
                        }

                        // Copy rule content to clipboard
                        await vscode.env.clipboard.writeText(rule.content);
                        vscode.window.showInformationMessage(`Rule "${rule.title}" copied to clipboard.`);
                    } catch (error) {
                        logger.error('Error copying rule to clipboard', error, 'Extension');
                        vscode.window.showErrorMessage(
                            `Failed to copy rule: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                },
            ),
        );

        logger.info('CodingRules.ai extension activated successfully', 'Extension');
    } catch (error) {
        const logger = Logger.getInstance();
        logger.error('Error activating extension', error, 'Extension');
        vscode.window.showErrorMessage(
            `Error activating CodingRules.ai extension: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
    Logger.getInstance().info('CodingRules.ai extension deactivated', 'Extension');
}

// Define a QuickPickItem interface for rules
interface RuleQuickPickItem extends vscode.QuickPickItem {
    rule?: Rule;
}
