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
                        const openDocument = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(openDocument);

                        vscode.window.showInformationMessage(`Rule "${rule.title}" has been downloaded.`);
                    } else {
                        // Download directly to workspace folder
                        const filePath = await ruleDownloaderService.downloadRule(rule, {
                            directory: workspaceFolder,
                            format: selectedFormat,
                            includeMetadata: true,
                        });

                        // Open the file
                        const openDocument = await vscode.workspace.openTextDocument(filePath);
                        await vscode.window.showTextDocument(openDocument);

                        vscode.window.showInformationMessage(`Rule "${rule.title}" has been downloaded to workspace.`);
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
                    // Reset explorer to show search results
                    // Implementation will need to be added to support search in RulesExplorerProvider
                    rulesExplorerProvider.refresh();

                    // Search the API
                    const { rules } = await supabaseService.searchRules({ query: searchQuery });

                    if (rules.length === 0) {
                        vscode.window.showInformationMessage('No rules found matching your search.');
                    } else {
                        vscode.window.showInformationMessage(`Found ${rules.length} rules matching your search.`);
                    }
                }
            }),
        );

        // Register command to clear search
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.clearSearch', async () => {
                rulesExplorerProvider.refresh();
            }),
        );

        // Browse rules on website command
        context.subscriptions.push(
            vscode.commands.registerCommand('codingrules-ai.browseWebsite', async () => {
                await vscode.env.openExternal(vscode.Uri.parse('https://codingrules.ai/rules'));
            }),
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
