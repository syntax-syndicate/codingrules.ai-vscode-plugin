import * as vscode from 'vscode';
import { Rule, Tag, Tool } from '../models/rule.model';
import { SupabaseService } from '../services/supabase.service';
import { Config } from '../config';
import { AuthService } from '../services/auth.service';
import { Logger } from '../utils/logger';

/**
 * Tree item types in the Rules Explorer
 */
export enum RuleExplorerItemType {
    CATEGORY = 'category',
    RULE = 'rule',
    TAG = 'tag',
    TOOL = 'tool',
    LOADING = 'loading',
}

/**
 * TreeItem for the Rules Explorer
 */
export class RuleExplorerItem extends vscode.TreeItem {
    /**
     * Get the data ID, used for fetching detailed information
     */
    get dataId(): string | undefined {
        if (!this.data) {
            return undefined;
        }

        return (this.data as any).id;
    }

    constructor(
        public readonly type: RuleExplorerItemType,
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly data?: Rule | Tag | Tool,
    ) {
        super(label, collapsibleState);

        // Set different icons based on type
        switch (type) {
            case RuleExplorerItemType.CATEGORY:
                this.iconPath = new vscode.ThemeIcon('folder');
                break;
            case RuleExplorerItemType.RULE:
                const rule = data as Rule;

                // Set appropriate icon based on private status
                if (rule?.is_private) {
                    this.iconPath = new vscode.ThemeIcon('lock');
                    this.tooltip = `${rule.title} (Private)`;
                    // Add extra indication of private in the description
                    this.description = `${rule.upvote_count?.toString() || '0'} 👍 (Private)`;
                } else {
                    // Use book icon consistently for all rules
                    this.iconPath = new vscode.ThemeIcon('book');
                    this.tooltip = rule?.title || '';
                    this.description = `${rule.upvote_count?.toString() || '0'} 👍`;
                }
                break;
            case RuleExplorerItemType.TAG:
                const tag = data as Tag;
                if (tag?.is_private) {
                    this.iconPath = new vscode.ThemeIcon('lock');
                    this.tooltip = `${tag.description || tag.name} (Private)`;
                    this.description = '(Private)';
                } else {
                    this.iconPath = new vscode.ThemeIcon('tag');
                    this.tooltip = tag?.description || '';
                }
                break;
            case RuleExplorerItemType.TOOL:
                const tool = data as Tool;
                if (tool?.is_private) {
                    this.iconPath = new vscode.ThemeIcon('lock');
                    this.tooltip = `${tool.description || tool.name} (Private)`;
                    this.description = '(Private)';
                } else {
                    this.iconPath = new vscode.ThemeIcon('tools');
                    this.tooltip = tool?.description || '';
                }
                break;
            case RuleExplorerItemType.LOADING:
                this.iconPath = new vscode.ThemeIcon('loading~spin');
                break;
        }

        // Add context value for menus
        this.contextValue = type;
    }
}

/**
 * TreeDataProvider for the Rules Explorer
 */
export class RulesExplorerProvider implements vscode.TreeDataProvider<RuleExplorerItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<RuleExplorerItem | undefined | null | void> =
        new vscode.EventEmitter<RuleExplorerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RuleExplorerItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private supabaseService!: SupabaseService;
    private authService!: AuthService;
    private rules: Rule[] = [];
    private topUpvotedRules: Rule[] = [];
    private tags: Tag[] = [];
    private tools: Tool[] = [];
    private isLoading = false;
    private showPrivateContent = false;
    private logger: Logger = Logger.getInstance();

    constructor(context: vscode.ExtensionContext) {
        try {
            const config = Config.getInstance(context);
            const supabaseConfig = config.getSupabaseConfig();

            // Get services
            this.supabaseService = SupabaseService.getInstance();

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
            const completeRule = await this.supabaseService.getRule(rule.id);

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
        if (!this.supabaseService) {
            this.logger.error('SupabaseService not available', null, 'RulesExplorerProvider');
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
            const { rules: topRules } = await this.supabaseService.getTopUpvotedRules(10);
            this.topUpvotedRules = topRules || [];

            // Load tags
            const tags = await this.supabaseService.getTags();
            this.tags = (tags || []).sort((a, b) => a.name.localeCompare(b.name));

            // Load tools
            const tools = await this.supabaseService.getTools();
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

            // Root categories
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

            return rootItems;
        }

        // Render children based on parent type
        switch (element.label) {
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
}
