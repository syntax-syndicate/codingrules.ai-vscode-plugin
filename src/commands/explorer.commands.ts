import * as vscode from 'vscode';
import { Rule } from '../models/rule.model';
import { RuleService } from '../services/rule.service';
import { RulesExplorerProvider } from '../views/explorer';
import { RuleViewer } from '../views/rule-viewer';
import { Logger } from '../utils/logger';

/**
 * Interface for quick pick items with rule data
 */
interface RuleQuickPickItem extends vscode.QuickPickItem {
    rule?: Rule;
}

/**
 * Handler for explorer-related commands
 */
export class ExplorerCommandHandler {
    private ruleService: RuleService;
    private logger: Logger;

    constructor(
        private context: vscode.ExtensionContext,
        private rulesExplorerProvider: RulesExplorerProvider,
    ) {
        this.ruleService = RuleService.getInstance();
        this.logger = Logger.getInstance();
    }

    /**
     * Register all explorer-related commands
     */
    public register(): void {
        this.registerSearchRulesCommand();
        this.registerClearSearchCommand();
        this.registerBrowseWebsiteCommand();
        this.registerRefreshExplorerCommand();
        this.registerFilterByTagCommand();
        this.registerFilterByToolCommand();
        this.registerClearFiltersCommand();
    }

    /**
     * Register command to filter rules by tag
     */
    private registerFilterByTagCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.filterByTag', async (tagId: string) => {
            await this.rulesExplorerProvider.addTagFilter(tagId);
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to filter rules by tool
     */
    private registerFilterByToolCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.filterByTool', async (toolId: string) => {
            await this.rulesExplorerProvider.addToolFilter(toolId);
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to clear all filters
     */
    private registerClearFiltersCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.clearFilters', () => {
            this.rulesExplorerProvider.clearFilters();
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to search for rules
     */
    private registerSearchRulesCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.searchRules', async () => {
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
                    const { rules } = await this.ruleService.searchRules({ query: searchQuery });

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
                            profilePromise: this.ruleService.getUserProfile(rule.author_id),
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
                            RuleViewer.show(selectedItem.rule, this.context);
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
                                RuleViewer.show(selectedItem.rule, this.context);
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

                    // Update the explorer view with search results
                    this.rulesExplorerProvider.setSearchResults(searchQuery, rules);

                    // Show count in status bar
                    vscode.window.showInformationMessage(`Found ${rules.length} rules matching your search.`);
                } catch (error) {
                    // Clear status message
                    searchingMessage.dispose();

                    this.logger.error('Error searching rules', error, 'ExplorerCommandHandler');
                    vscode.window.showErrorMessage(
                        `Failed to search rules: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            }
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to clear search
     */
    private registerClearSearchCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.clearSearch', async () => {
            this.rulesExplorerProvider.clearSearch();
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to browse codingrules.ai website
     */
    private registerBrowseWebsiteCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.browseWebsite', async () => {
            await vscode.env.openExternal(vscode.Uri.parse('https://codingrules.ai/rules'));
        });

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to refresh explorer
     */
    private registerRefreshExplorerCommand(): void {
        const disposable = vscode.commands.registerCommand('codingrules-ai.refreshExplorer', () => {
            this.rulesExplorerProvider.refreshData();
        });

        this.context.subscriptions.push(disposable);
    }
}
