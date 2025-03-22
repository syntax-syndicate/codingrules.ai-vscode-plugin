import * as vscode from 'vscode';
import { Rule, Tag, Tool } from '../models/rule.model';
import { SupabaseService } from '../services/supabase.service';
import { Config } from '../config';
import { AuthService } from '../services/auth.service';

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
                    this.description = `${rule.upvote_count?.toString() || '0'} ⭐ (Private)`;
                } else {
                    this.iconPath = new vscode.ThemeIcon('book');
                    this.tooltip = rule?.title || '';
                    this.description = `${rule.upvote_count?.toString() || '0'} ⭐`;
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
                console.error('Error getting AuthService:', e);
                this.showPrivateContent = false;
            }

            // Initial refresh to load data - this will update the auth state
            this.refreshData();

            // Register command handlers
            context.subscriptions.push(
                vscode.commands.registerCommand(
                    'codingrules-ai.downloadRule',
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

                            // Use the command with the validated rule
                            vscode.commands.executeCommand('codingrules-ai.downloadRuleInternal', completeRule);
                        } else {
                            // If it's already a Rule object (e.g., from the details view), pass it through
                            vscode.commands.executeCommand('codingrules-ai.downloadRuleInternal', item);
                        }
                    },
                ),
            );
        } catch (error) {
            console.error('Failed to initialize RulesExplorerProvider:', error);
            vscode.window.showErrorMessage(
                `Failed to initialize CodingRules.ai: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Ensure we have a complete rule with all required data before download
     */
    private async ensureCompleteRule(rule: Rule): Promise<Rule | null> {
        // Check if we have the necessary data to download
        if (!rule.id) {
            vscode.window.showErrorMessage('Cannot download rule: Missing rule ID.');
            return null;
        }

        // Check if title exists
        if (!rule.title) {
            vscode.window.showErrorMessage('Cannot download rule: Missing title information.');
            return null;
        }

        // Check if content exists
        if (!rule.content) {
            try {
                // Try to fetch the complete rule from the database
                const completeRule = await this.supabaseService.getRule(rule.id);

                if (!completeRule) {
                    vscode.window.showErrorMessage('Cannot download rule: Unable to fetch rule details.');
                    return null;
                }

                if (!completeRule.content) {
                    vscode.window.showErrorMessage(`Cannot download rule "${rule.title}": Rule has no content.`);
                    return null;
                }

                return completeRule;
            } catch (error) {
                console.error('Error fetching complete rule:', error);
                vscode.window.showErrorMessage(
                    `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`,
                );
                return null;
            }
        }

        return rule;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    async refreshData(): Promise<void> {
        if (!this.supabaseService) {
            console.error('SupabaseService not available');
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
                console.log(
                    'Authentication state after refresh:',
                    isAuthenticated ? 'authenticated' : 'not authenticated',
                );

                // Set the flag that controls whether to show private content
                this.showPrivateContent = isAuthenticated;
            }

            // Load rules
            const { rules } = await this.supabaseService.searchRules({
                include_private: this.showPrivateContent,
                limit: 50,
            });
            this.rules = rules || [];

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
            console.error('Error refreshing rules data:', error);
            vscode.window.showErrorMessage('Failed to load rules data. Please try again later.');
        } finally {
            this.isLoading = false;
            this._onDidChangeTreeData.fire();
        }
    }

    getTreeItem(element: RuleExplorerItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: RuleExplorerItem): Promise<RuleExplorerItem[]> {
        // Show loading indicator
        if (this.isLoading && !element) {
            return [
                new RuleExplorerItem(RuleExplorerItemType.LOADING, 'Loading...', vscode.TreeItemCollapsibleState.None),
            ];
        }

        // Root level - show categories
        if (!element) {
            const categories = [];

            // Add authentication status
            if (this.showPrivateContent) {
                // Show profile status when authenticated
                const profileItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    `Logged in as ${this.authService.currentUser?.email || 'User'}`,
                    vscode.TreeItemCollapsibleState.None,
                );
                profileItem.iconPath = new vscode.ThemeIcon('account');
                profileItem.command = {
                    command: 'codingrules-ai.viewProfile',
                    title: 'View Profile',
                    arguments: [],
                };
                categories.push(profileItem);

                // Add private content section when logged in
                const privateContentItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'My Private Content',
                    vscode.TreeItemCollapsibleState.Collapsed,
                );
                privateContentItem.iconPath = new vscode.ThemeIcon('lock');
                categories.push(privateContentItem);
            } else {
                // Show login option when not authenticated
                const loginItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Login to access private content',
                    vscode.TreeItemCollapsibleState.None,
                );
                loginItem.iconPath = new vscode.ThemeIcon('person');
                loginItem.command = {
                    command: 'codingrules-ai.login',
                    title: 'Login',
                    arguments: [],
                };
                categories.push(loginItem);
            }

            // Add standard categories
            categories.push(
                new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Recent Rules',
                    vscode.TreeItemCollapsibleState.Expanded,
                ),
                new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Most Upvoted Rules',
                    vscode.TreeItemCollapsibleState.Collapsed,
                ),
                new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Browse by Tags',
                    vscode.TreeItemCollapsibleState.Collapsed,
                ),
                new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Browse by Tools',
                    vscode.TreeItemCollapsibleState.Collapsed,
                ),
            );

            return categories;
        }

        // Handle different category items
        switch (element.label) {
            case 'My Private Content':
                // Only return private rules, tags, and tools
                const privateItems = [];

                // Add private rules section
                const privateRules = this.rules.filter((rule) => rule.is_private === true);
                if (privateRules.length > 0) {
                    const privateRulesCategory = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        'Private Rules',
                        vscode.TreeItemCollapsibleState.Collapsed,
                    );
                    privateRulesCategory.iconPath = new vscode.ThemeIcon('lock');
                    privateItems.push(privateRulesCategory);
                }

                // Add private tags section
                const privateTags = this.tags.filter((tag) => tag.is_private === true);
                if (privateTags.length > 0) {
                    const privateTagsCategory = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        'Private Tags',
                        vscode.TreeItemCollapsibleState.Collapsed,
                    );
                    privateTagsCategory.iconPath = new vscode.ThemeIcon('lock');
                    privateItems.push(privateTagsCategory);
                }

                // Add private tools section
                const privateTools = this.tools.filter((tool) => tool.is_private === true);
                if (privateTools.length > 0) {
                    const privateToolsCategory = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        'Private Tools',
                        vscode.TreeItemCollapsibleState.Collapsed,
                    );
                    privateToolsCategory.iconPath = new vscode.ThemeIcon('lock');
                    privateItems.push(privateToolsCategory);
                }

                // If no private content, show a message
                if (privateItems.length === 0) {
                    const noPrivateItem = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        'No private content found',
                        vscode.TreeItemCollapsibleState.None,
                    );
                    return [noPrivateItem];
                }

                return privateItems;

            case 'Private Rules':
                return this.rules
                    .filter((rule) => rule.is_private === true)
                    .map(
                        (rule) =>
                            new RuleExplorerItem(
                                RuleExplorerItemType.RULE,
                                rule.title,
                                vscode.TreeItemCollapsibleState.None,
                                rule,
                            ),
                    );

            case 'Private Tags':
                return this.tags
                    .filter((tag) => tag.is_private === true)
                    .map(
                        (tag) =>
                            new RuleExplorerItem(
                                RuleExplorerItemType.TAG,
                                tag.name,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                tag,
                            ),
                    );

            case 'Private Tools':
                return this.tools
                    .filter((tool) => tool.is_private === true)
                    .map(
                        (tool) =>
                            new RuleExplorerItem(
                                RuleExplorerItemType.TOOL,
                                tool.name,
                                vscode.TreeItemCollapsibleState.Collapsed,
                                tool,
                            ),
                    );

            case 'Recent Rules':
                return this.rules.map(
                    (rule) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            rule.title,
                            vscode.TreeItemCollapsibleState.None,
                            rule,
                        ),
                );

            case 'Most Upvoted Rules':
                return this.topUpvotedRules.map(
                    (rule) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            rule.title,
                            vscode.TreeItemCollapsibleState.None,
                            rule,
                        ),
                );

            case 'Browse by Tags':
                return this.tags.map(
                    (tag) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.TAG,
                            tag.name,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            tag,
                        ),
                );

            case 'Browse by Tools':
                return this.tools.map(
                    (tool) =>
                        new RuleExplorerItem(
                            RuleExplorerItemType.TOOL,
                            tool.name,
                            vscode.TreeItemCollapsibleState.Collapsed,
                            tool,
                        ),
                );
        }

        // Handle tag items - show rules with this tag
        if (element.type === RuleExplorerItemType.TAG && element.data) {
            const tag = element.data as Tag;
            const rulesWithTag = this.rules.filter((rule) => rule.tags?.some((t) => t.id === tag.id));

            return rulesWithTag.map(
                (rule) =>
                    new RuleExplorerItem(
                        RuleExplorerItemType.RULE,
                        rule.title,
                        vscode.TreeItemCollapsibleState.None,
                        rule,
                    ),
            );
        }

        // Handle tool items - show rules for this tool
        if (element.type === RuleExplorerItemType.TOOL && element.data) {
            const tool = element.data as Tool;
            const rulesForTool = this.rules.filter((rule) => rule.tool_id === tool.id);

            return rulesForTool.map(
                (rule) =>
                    new RuleExplorerItem(
                        RuleExplorerItemType.RULE,
                        rule.title,
                        vscode.TreeItemCollapsibleState.None,
                        rule,
                    ),
            );
        }

        return [];
    }
}
