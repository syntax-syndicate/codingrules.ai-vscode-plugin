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
                if (data) {
                    const rule = data as Rule;

                    // Set appropriate icon based on private status
                    if (rule.is_private) {
                        this.iconPath = new vscode.ThemeIcon('lock');
                        this.tooltip = `${rule.title} (Private)`;
                        // Add extra indication of private in the description
                        this.description = `${rule.upvote_count?.toString() || '0'} 👍 (Private)`;
                    } else {
                        // Use book icon consistently for all rules
                        this.iconPath = new vscode.ThemeIcon('book');
                        this.tooltip = rule.title || '';
                        this.description = `${rule.upvote_count?.toString() || '0'} 👍`;
                    }
                } else {
                    // For message-only items (like "No private rules found")
                    this.iconPath = new vscode.ThemeIcon('info');
                    this.tooltip = this.label;
                    // No description for message-only items
                }
                break;
            case RuleExplorerItemType.TAG:
                if (data) {
                    const tag = data as Tag;
                    if (tag.is_private) {
                        this.iconPath = new vscode.ThemeIcon('lock');
                        this.tooltip = `${tag.description || tag.name} (Private)`;
                        this.description = '(Private)';
                    } else {
                        this.iconPath = new vscode.ThemeIcon('tag');
                        this.tooltip = tag.description || '';
                    }
                } else {
                    // For message-only items (like "No tags found")
                    this.iconPath = new vscode.ThemeIcon('info');
                    this.tooltip = this.label;
                }
                break;
            case RuleExplorerItemType.TOOL:
                if (data) {
                    const tool = data as Tool;
                    if (tool.is_private) {
                        this.iconPath = new vscode.ThemeIcon('lock');
                        this.tooltip = `${tool.description || tool.name} (Private)`;
                        this.description = '(Private)';
                    } else {
                        this.iconPath = new vscode.ThemeIcon('tools');
                        this.tooltip = tool.description || '';
                    }
                } else {
                    // For message-only items (like "No tools found")
                    this.iconPath = new vscode.ThemeIcon('info');
                    this.tooltip = this.label;
                }
                break;
            case RuleExplorerItemType.LOADING:
                this.iconPath = new vscode.ThemeIcon('loading~spin');
                break;
        }

        // Set context value for menus
        if (
            !data &&
            (type === RuleExplorerItemType.RULE ||
                type === RuleExplorerItemType.TAG ||
                type === RuleExplorerItemType.TOOL)
        ) {
            // Use a special context value for placeholder items to prevent actions from showing
            this.contextValue = 'message';
        } else {
            // Regular context value for normal items
            this.contextValue = type;
        }
    }
}

/**
 * TreeDataProvider for the Rules Explorer
 */
export class RulesExplorerProvider implements vscode.TreeDataProvider<RuleExplorerItem>, vscode.Disposable {
    private _onDidChangeTreeData: vscode.EventEmitter<RuleExplorerItem | undefined | null | void> =
        new vscode.EventEmitter<RuleExplorerItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<RuleExplorerItem | undefined | null | void> =
        this._onDidChangeTreeData.event;

    private supabaseService!: SupabaseService;
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
    private favoriteRules: { [collection: string]: Rule[] } = {};
    private favoriteCollections: string[] = [];

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

    // Auto-refresh timer
    private refreshTimer: NodeJS.Timeout | null = null;
    private readonly AUTO_REFRESH_INTERVAL = 5 * 60 * 1000; // 5 minutes

    /**
     * Refresh all data from the API
     */
    async refreshData(forceRefresh: boolean = false): Promise<void> {
        if (!this.supabaseService) {
            this.logger.error('SupabaseService not available', null, 'RulesExplorerProvider');
            return;
        }

        this.isLoading = true;
        this._onDidChangeTreeData.fire();

        // Start or reset the auto-refresh timer
        this.setupAutoRefresh();

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

            // Load private rules if authenticated
            if (this.showPrivateContent) {
                const { rules: privateRules } = await this.supabaseService.getPrivateRules(10);
                this.privateRules = privateRules || [];

                // Load favorite rules
                try {
                    const favorites = await this.supabaseService.getFavoriteRules();

                    // Process favorites response
                    if (favorites && typeof favorites === 'object') {
                        this.favoriteRules = favorites;
                        this.favoriteCollections = Object.keys(favorites).sort();
                        this.logger.debug(
                            `Loaded ${this.favoriteCollections.length} favorite collections`,
                            'RulesExplorerProvider',
                        );
                    } else {
                        this.logger.warn('getFavoriteRules returned invalid result', 'RulesExplorerProvider');
                        this.favoriteRules = {};
                        this.favoriteCollections = [];
                    }
                } catch (favError) {
                    this.logger.error(`Error loading favorites: ${favError}`, 'RulesExplorerProvider');
                    this.favoriteRules = {};
                    this.favoriteCollections = [];
                }
            } else {
                this.privateRules = [];
                this.favoriteRules = {};
                this.favoriteCollections = [];
            }

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

            // If we have favorites but they're not showing, force a manual refresh of the view
            if (this.showPrivateContent && this.favoriteCollections.length > 0) {
                this.logger.info('Forcing UI refresh to ensure favorites are displayed', 'RulesExplorerProvider');
                setTimeout(() => {
                    this._onDidChangeTreeData.fire();
                }, 500);
            }
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

                // Add Favorites and Private Rules sections if authenticated
                if (this.showPrivateContent) {
                    // Add Favorites section first
                    const favoritesItem = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        'Favorites',
                        vscode.TreeItemCollapsibleState.Expanded,
                    );
                    favoritesItem.iconPath = new vscode.ThemeIcon('star-full');
                    rootItems.push(favoritesItem);

                    // Then add Private Rules section
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

            case 'Favorites':
                // If no collections found, show a message
                if (this.favoriteCollections.length === 0) {
                    const noFavItem = new RuleExplorerItem(
                        RuleExplorerItemType.RULE,
                        'No favorite rules found',
                        vscode.TreeItemCollapsibleState.None,
                    );

                    // Add a helpful message or action
                    const addFavInfo = new RuleExplorerItem(
                        RuleExplorerItemType.RULE,
                        'Star rules on codingrules.ai to add favorites',
                        vscode.TreeItemCollapsibleState.None,
                    );

                    addFavInfo.command = {
                        command: 'vscode.open',
                        title: 'Open CodingRules.ai',
                        arguments: [vscode.Uri.parse('https://codingrules.ai')],
                    };

                    return [noFavItem, addFavInfo];
                }

                // Show all collections as expandable items
                return this.favoriteCollections.map((collection) => {
                    const collectionItem = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        collection,
                        vscode.TreeItemCollapsibleState.Expanded,
                    );
                    // Use a filled star icon for all collections
                    collectionItem.iconPath = new vscode.ThemeIcon('star-full');
                    return collectionItem;
                });

            default:
                // Handle collection items (these will be the label of the tree item)
                if (this.favoriteCollections.includes(element.label)) {
                    const collectionRules = this.favoriteRules[element.label] || [];

                    if (collectionRules.length === 0) {
                        return [
                            new RuleExplorerItem(
                                RuleExplorerItemType.RULE,
                                `No rules in '${element.label}' collection`,
                                vscode.TreeItemCollapsibleState.None,
                            ),
                        ];
                    }

                    return collectionRules.map((rule) => {
                        const ruleItem = new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            rule.title,
                            vscode.TreeItemCollapsibleState.None,
                            rule,
                        );
                        // Add book icon to favorite rules
                        ruleItem.iconPath = new vscode.ThemeIcon('book');
                        return ruleItem;
                    });
                }

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

    /**
     * Set up auto-refresh timer to periodically update private rules
     */
    private setupAutoRefresh(): void {
        // Clear any existing timer
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }

        // Only set up auto-refresh if user is authenticated
        if (this.showPrivateContent) {
            this.logger.debug('Setting up auto-refresh timer for private rules', 'RulesExplorerProvider');

            // Set new timer
            this.refreshTimer = setTimeout(() => {
                this.logger.info('Auto-refreshing private rules data', 'RulesExplorerProvider');

                // Force private rules cache invalidation to ensure fresh data
                try {
                    const supabaseService = this.supabaseService;
                    if (supabaseService) {
                        supabaseService.invalidatePrivateRulesCache();
                    }
                } catch (error) {
                    this.logger.warn('Failed to invalidate cache during auto-refresh', 'RulesExplorerProvider');
                }

                // Perform the actual refresh
                this.refreshData(true);
            }, this.AUTO_REFRESH_INTERVAL);
        }
    }

    /**
     * Dispose of resources when the provider is no longer needed
     */
    public dispose(): void {
        // Clean up the refresh timer to prevent memory leaks
        if (this.refreshTimer) {
            clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
            this.logger.debug('Cleared auto-refresh timer during dispose', 'RulesExplorerProvider');
        }
    }
}
