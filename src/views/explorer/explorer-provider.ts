import * as vscode from 'vscode';
import { Rule, Tag, Tool } from '../../models/rule.model';
import { RuleService } from '../../services/rule.service';
import { AuthService } from '../../services/auth.service';
import { Logger } from '../../utils/logger';
import { RuleExplorerItem, RuleExplorerItemType } from './explorer-item';

/**
 * TreeDataProvider for the Rules Explorer
 */
export class RulesExplorerProvider implements vscode.TreeDataProvider<RuleExplorerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RuleExplorerItem | undefined | null | void> =
        new vscode.EventEmitter<RuleExplorerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RuleExplorerItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private ruleService!: RuleService;
    private authService!: AuthService;
    private rules: Rule[] = [];
    private topUpvotedRules: Rule[] = [];
    private privateRules: Rule[] = [];
    private tags: Tag[] = [];
    private tools: Tool[] = [];
    private isLoading = false;
    private showPrivateContent = false;
    private logger: Logger = Logger.getInstance();
    private searchResults: Rule[] = [];
    private isSearchActive = false;
    private searchQuery = '';

    constructor(private context: vscode.ExtensionContext) {
        try {
            // Get services
            this.ruleService = RuleService.getInstance();

            // Try to get auth service
            try {
                this.authService = AuthService.getInstance();

                // Set initial state based on auth - this will be properly updated in refreshData
                this.showPrivateContent = this.authService.isAuthenticated;
            } catch (e) {
                this.logger.error('Error getting AuthService', e, 'RulesExplorerProvider');
                this.showPrivateContent = false;
            }

            // Initial refresh to load data - this will update the auth state
            this.refreshData();

            // Register command handlers
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'codingrules-ai.downloadRuleHandler',
                    async (item?: RuleExplorerItem | Rule) => {
                        // If this is a tree item from the explorer, validate and extract the rule data
                        if (item instanceof RuleExplorerItem) {
                            if (item.type !== RuleExplorerItemType.RULE || !item.data) {
                                vscode.window.showErrorMessage('Cannot download: Selected item is not a valid rule.');
                                return;
                            }

                            // Ensure we have a complete rule object with all required data
                            const rule = item.data as Rule;
                            const completeRule = await this.ensureCompleteRule(rule);

                            if (!completeRule) {
                                return; // Error already shown to user
                            }

                            // Call the main download command
                            vscode.commands.executeCommand('codingrules-ai.downloadRule', completeRule);
                        } else {
                            // If it's already a Rule object (e.g., from the details view), pass it through
                            vscode.commands.executeCommand('codingrules-ai.downloadRule', item);
                        }
                    },
                ),
            );
        } catch (error) {
            this.logger.error('Failed to initialize RulesExplorerProvider', error, 'RulesExplorerProvider');
            vscode.window.showErrorMessage('Failed to load rules explorer. Please try again later.');
        }
    }

    /**
     * Make sure we have a complete rule with all necessary data
     */
    private async ensureCompleteRule(rule: Rule): Promise<Rule | null> {
        // If the rule has everything we need, just return it
        if (rule.content) {
            return rule;
        }

        try {
            // Otherwise, fetch the complete rule
            const completeRule = await this.ruleService.getRule(rule.id);

            if (!completeRule) {
                vscode.window.showErrorMessage('Failed to load complete rule details for download.');
                return null;
            }

            return completeRule;
        } catch (error) {
            this.logger.error('Error fetching complete rule', error, 'RulesExplorerProvider');
            vscode.window.showErrorMessage('Failed to load rule details for download.');
            return null;
        }
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Refresh all data from the API
     */
    async refreshData(): Promise<void> {
        if (!this.ruleService) {
            this.logger.error('RuleService not available', null, 'RulesExplorerProvider');
            return;
        }

        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        try {
            // Always force authentication refresh first to ensure latest state
            if (this.authService) {
                // This ensures we have the latest auth state before proceeding
                await this.authService.refreshCurrentUser();

                // Update our private content flag based on the refreshed state
                const isAuthenticated = this.authService.isAuthenticated;
                this.logger.debug(
                    `Authentication state after refresh: ${isAuthenticated ? 'authenticated' : 'not authenticated'}`,
                    'RulesExplorerProvider',
                );

                // Set the flag that controls whether to show private content
                this.showPrivateContent = isAuthenticated;
            }

            // Load top rules
            const { rules: topRules } = await this.ruleService.getTopUpvotedRules(10);
            this.topUpvotedRules = topRules || [];

            // Load private rules if authenticated
            if (this.showPrivateContent) {
                const { rules: privateRules } = await this.ruleService.getPrivateRules(10);
                this.privateRules = privateRules || [];
            } else {
                this.privateRules = [];
            }

            // Load tags
            const tags = await this.ruleService.getTags();
            this.tags = (tags || []).sort((a, b) => a.name.localeCompare(b.name));

            // Load tools
            const tools = await this.ruleService.getTools();
            this.tools = (tools || []).sort((a, b) => a.name.localeCompare(b.name));
        } catch (error) {
            this.logger.error('Error refreshing rules data', error, 'RulesExplorerProvider');
            vscode.window.showErrorMessage('Failed to load rules data. Please try again later.');
        } finally {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }
    }

    /**
     * Get a tree item for a given element
     */
    getTreeItem(element: RuleExplorerItem): vscode.TreeItem {
        return element;
    }

    /**
     * Get children for a tree item
     */
    async getChildren(element?: RuleExplorerItem): Promise<RuleExplorerItem[]> {
        if (this.isLoading) {
            return [
                new RuleExplorerItem(RuleExplorerItemType.LOADING, 'Loading...', vscode.TreeItemCollapsibleState.None),
            ];
        }

        // Root level
        if (!element) {
            const rootItems: RuleExplorerItem[] = [];

            // Show authorization status if not authenticated
            if (!this.showPrivateContent) {
                const loginItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Log in to see private content',
                    vscode.TreeItemCollapsibleState.None,
                );
                loginItem.command = {
                    command: 'codingrules-ai.login',
                    title: 'Log in',
                };
                rootItems.push(loginItem);
            }

            // Display search results if there is an active search
            if (this.isSearchActive) {
                const searchResultsItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    `Search Results for "${this.searchQuery}"`,
                    vscode.TreeItemCollapsibleState.Expanded,
                );

                // Add a clear search button
                const clearSearchItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Clear Search',
                    vscode.TreeItemCollapsibleState.None,
                );
                clearSearchItem.command = {
                    command: 'codingrules-ai.clearSearch',
                    title: 'Clear Search',
                };
                clearSearchItem.iconPath = new vscode.ThemeIcon('clear-all');

                rootItems.push(searchResultsItem, clearSearchItem);
            } else {
                // Root categories (only show these if no search is active)

                // Add Private Rules section if authenticated
                if (this.showPrivateContent) {
                    const privateRulesItem = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        'Private Rules',
                        vscode.TreeItemCollapsibleState.Expanded,
                    );
                    rootItems.push(privateRulesItem);
                }

                const topRulesItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Top Rules',
                    vscode.TreeItemCollapsibleState.Expanded,
                );

                const tagsItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Tags',
                    vscode.TreeItemCollapsibleState.Collapsed,
                );

                const toolsItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'AI Tools',
                    vscode.TreeItemCollapsibleState.Collapsed,
                );

                rootItems.push(topRulesItem, tagsItem, toolsItem);
            }

            return rootItems;
        }

        // Render children based on parent type
        switch (element.label) {
            case 'Private Rules':
                if (this.privateRules.length === 0) {
                    return [
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            'No private rules found',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }
                return this.privateRules.map(
                    (rule) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            rule.title,
                            vscode.TreeItemCollapsibleState.None,
                            rule,
                        ),
                );

            case 'Top Rules':
                if (this.topUpvotedRules.length === 0) {
                    return [
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            'No top rules found',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }
                return this.topUpvotedRules.map(
                    (rule) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            rule.title,
                            vscode.TreeItemCollapsibleState.None,
                            rule,
                        ),
                );

            case `Search Results for "${this.searchQuery}"`:
                if (this.searchResults.length === 0) {
                    return [
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            'No results found',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }
                return this.searchResults.map(
                    (rule) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            rule.title,
                            vscode.TreeItemCollapsibleState.None,
                            rule,
                        ),
                );

            case 'Tags':
                if (this.tags.length === 0) {
                    return [
                        new RuleExplorerItem(
                            RuleExplorerItemType.TAG,
                            'No tags found',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }
                return this.tags.map(
                    (tag) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.TAG,
                            tag.name,
                            vscode.TreeItemCollapsibleState.None,
                            tag,
                        ),
                );

            case 'AI Tools':
                if (this.tools.length === 0) {
                    return [
                        new RuleExplorerItem(
                            RuleExplorerItemType.TOOL,
                            'No AI tools found',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }
                return this.tools.map(
                    (tool) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.TOOL,
                            tool.name,
                            vscode.TreeItemCollapsibleState.None,
                            tool,
                        ),
                );

            default:
                return [];
        }
    }

    /**
     * Set search results and update the view
     */
    public setSearchResults(searchQuery: string, results: Rule[]): void {
        this.searchQuery = searchQuery;
        this.searchResults = results;
        this.isSearchActive = true;
        this._onDidChangeTreeData.fire();
    }

    /**
     * Clear search results and reset the view
     */
    public clearSearch(): void {
        this.searchQuery = '';
        this.searchResults = [];
        this.isSearchActive = false;
        this._onDidChangeTreeData.fire();
    }
}
