import * as vscode from 'vscode';
import { Rule, Tag, Tool } from '../../models/rule.model';
import { RuleService } from '../../services/rule.service';
import { AuthService } from '../../services/auth.service';
import { Logger } from '../../utils/logger';
import { RuleExplorerItem, RuleExplorerItemType } from './explorer-item';

/**
 * TreeDataProvider for the Rules Explorer
 */
export class RulesExplorerProvider implements vscode.TreeDataProvider<RuleExplorerItem>, vscode.Disposable {
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

    // Filter-related state
    private activeFilters: { tags: string[]; tools: string[] } = { tags: [], tools: [] };
    private isFilterActive = false;
    private filteredRules: Rule[] = [];

    // Favorites-related state
    private favoriteRules: { [collection: string]: Rule[] } = {};
    private favoriteCollections: string[] = [];

    // Expanded state tracking
    private expandedTags: Set<string> = new Set();
    private expandedTools: Set<string> = new Set();

    // Cache for tag and tool rule previews
    private tagRulePreviews: Map<string, Rule[]> = new Map();
    private toolRulePreviews: Map<string, Rule[]> = new Map();

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
        // Clear caches
        this.ruleService.clearCaches();
        this.tagRulePreviews.clear();
        this.toolRulePreviews.clear();
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

                // Load favorite rules
                try {
                    this.logger.info('Loading favorites for authenticated user', 'RulesExplorerProvider');
                    const favorites = await this.ruleService.getFavoriteRules();

                    if (favorites && typeof favorites === 'object') {
                        this.favoriteRules = favorites;
                        this.favoriteCollections = Object.keys(favorites).sort();

                        this.logger.info(
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
            }
            // Display filtered view if filters are active
            else if (this.isFilterActive) {
                // Show active filters section
                const activeFiltersItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Active Filters',
                    vscode.TreeItemCollapsibleState.Expanded,
                );

                // Add clear filters button
                const clearFiltersItem = new RuleExplorerItem(
                    RuleExplorerItemType.ACTION,
                    'Clear All Filters',
                    vscode.TreeItemCollapsibleState.None,
                );
                clearFiltersItem.command = {
                    command: 'codingrules-ai.clearFilters',
                    title: 'Clear Filters',
                };
                clearFiltersItem.iconPath = new vscode.ThemeIcon('clear-all');

                // Add filtered results category
                const filteredResultsItem = new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    `Filtered Rules (${this.filteredRules.length})`,
                    vscode.TreeItemCollapsibleState.Expanded,
                );

                rootItems.push(activeFiltersItem, clearFiltersItem, filteredResultsItem);
            } else {
                // Root categories (only show these if no search or filter is active)

                // Add Private Rules section if authenticated
                if (this.showPrivateContent) {
                    // Add Favorites section first
                    const favoritesItem = new RuleExplorerItem(
                        RuleExplorerItemType.CATEGORY,
                        'Favorites',
                        vscode.TreeItemCollapsibleState.Expanded,
                    );
                    favoritesItem.iconPath = new vscode.ThemeIcon('star-full');
                    rootItems.push(favoritesItem);

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
            case 'Favorites':
                // Add detailed logging for favorites rendering
                this.logger.info(
                    `Rendering Favorites children with ${this.favoriteCollections.length} collections`,
                    'RulesExplorerProvider',
                );

                // If no collections found, show a message
                if (this.favoriteCollections.length === 0) {
                    this.logger.warn('No collections to display in Favorites section', 'RulesExplorerProvider');

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

            case 'Active Filters':
                const filterItems: RuleExplorerItem[] = [];

                // Add tag filters if any
                if (this.activeFilters.tags.length > 0) {
                    const tagNames = await Promise.all(
                        this.activeFilters.tags.map(async (tagId) => {
                            const tag = this.tags.find((t) => t.id === tagId);
                            return tag ? tag.name : 'Unknown Tag';
                        }),
                    );

                    const tagFiltersItem = new RuleExplorerItem(
                        RuleExplorerItemType.FILTER,
                        `Tags: ${tagNames.join(', ')}`,
                        vscode.TreeItemCollapsibleState.None,
                    );
                    filterItems.push(tagFiltersItem);
                }

                // Add tool filters if any
                if (this.activeFilters.tools.length > 0) {
                    const toolNames = await Promise.all(
                        this.activeFilters.tools.map(async (toolId) => {
                            const tool = this.tools.find((t) => t.id === toolId);
                            return tool ? tool.name : 'Unknown Tool';
                        }),
                    );

                    const toolFiltersItem = new RuleExplorerItem(
                        RuleExplorerItemType.FILTER,
                        `Tools: ${toolNames.join(', ')}`,
                        vscode.TreeItemCollapsibleState.None,
                    );
                    filterItems.push(toolFiltersItem);
                }

                return filterItems;

            case 'Filtered Rules (0)':
            case element.label.startsWith('Filtered Rules (') ? element.label : '':
                if (this.filteredRules.length === 0) {
                    return [
                        new RuleExplorerItem(
                            RuleExplorerItemType.RULE,
                            'No rules match the selected filters',
                            vscode.TreeItemCollapsibleState.None,
                        ),
                    ];
                }
                return this.filteredRules.map(
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

                // Create tag items with rule counts
                const tagItems = await Promise.all(
                    this.tags.map(async (tag) => {
                        const count = await this.ruleService.getRuleCountForTag(tag.id);
                        return new RuleExplorerItem(
                            RuleExplorerItemType.TAG,
                            tag.name,
                            count > 0
                                ? vscode.TreeItemCollapsibleState.Collapsed
                                : vscode.TreeItemCollapsibleState.None,
                            tag,
                            count,
                        );
                    }),
                );

                return tagItems;

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

                // Create tool items with rule counts
                const toolItems = await Promise.all(
                    this.tools.map(async (tool) => {
                        const count = await this.ruleService.getRuleCountForTool(tool.id);
                        return new RuleExplorerItem(
                            RuleExplorerItemType.TOOL,
                            tool.name,
                            count > 0
                                ? vscode.TreeItemCollapsibleState.Collapsed
                                : vscode.TreeItemCollapsibleState.None,
                            tool,
                            count,
                        );
                    }),
                );

                return toolItems;

            default:
                // Check if this is a tag item
                if (element.type === RuleExplorerItemType.TAG && element.data) {
                    const tag = element.data as Tag;
                    // Get top rules for this tag
                    const tagId = tag.id;

                    if (!element.childrenFetched) {
                        // Fetch rules for this tag if not already fetched
                        try {
                            const rules = await this.ruleService.getTopRulesForTag(tagId);
                            this.tagRulePreviews.set(tagId, rules);
                            element.childrenFetched = true;
                        } catch (error) {
                            this.logger.error(`Error fetching rules for tag ${tagId}`, error, 'RulesExplorerProvider');
                        }
                    }

                    const previewRules = this.tagRulePreviews.get(tagId) || [];

                    if (previewRules.length === 0) {
                        return [
                            new RuleExplorerItem(
                                RuleExplorerItemType.RULE,
                                'No rules found for this tag',
                                vscode.TreeItemCollapsibleState.None,
                            ),
                        ];
                    }

                    // Create preview items
                    const previewItems = previewRules.map(
                        (rule) =>
                            new RuleExplorerItem(
                                RuleExplorerItemType.RULE,
                                rule.title,
                                vscode.TreeItemCollapsibleState.None,
                                rule,
                            ),
                    );

                    // Add "Show all" item that will apply this tag as a filter
                    const showAllItem = new RuleExplorerItem(
                        RuleExplorerItemType.ACTION,
                        'Show all rules with this tag...',
                        vscode.TreeItemCollapsibleState.None,
                    );
                    showAllItem.command = {
                        command: 'codingrules-ai.filterByTag',
                        title: 'Filter by Tag',
                        arguments: [tagId],
                    };

                    return [...previewItems, showAllItem];
                }

                // Check if this is a tool item
                if (element.type === RuleExplorerItemType.TOOL && element.data) {
                    const tool = element.data as Tool;
                    const toolId = tool.id;

                    if (!element.childrenFetched) {
                        // Fetch rules for this tool if not already fetched
                        try {
                            const rules = await this.ruleService.getTopRulesForTool(toolId);
                            this.toolRulePreviews.set(toolId, rules);
                            element.childrenFetched = true;
                        } catch (error) {
                            this.logger.error(
                                `Error fetching rules for tool ${toolId}`,
                                error,
                                'RulesExplorerProvider',
                            );
                        }
                    }

                    const previewRules = this.toolRulePreviews.get(toolId) || [];

                    if (previewRules.length === 0) {
                        return [
                            new RuleExplorerItem(
                                RuleExplorerItemType.RULE,
                                'No rules found for this tool',
                                vscode.TreeItemCollapsibleState.None,
                            ),
                        ];
                    }

                    // Create preview items
                    const previewItems = previewRules.map(
                        (rule) =>
                            new RuleExplorerItem(
                                RuleExplorerItemType.RULE,
                                rule.title,
                                vscode.TreeItemCollapsibleState.None,
                                rule,
                            ),
                    );

                    // Add "Show all" item that will apply this tool as a filter
                    const showAllItem = new RuleExplorerItem(
                        RuleExplorerItemType.ACTION,
                        'Show all rules for this tool...',
                        vscode.TreeItemCollapsibleState.None,
                    );
                    showAllItem.command = {
                        command: 'codingrules-ai.filterByTool',
                        title: 'Filter by Tool',
                        arguments: [toolId],
                    };

                    return [...previewItems, showAllItem];
                }

                // Handle favorite collections
                if (this.favoriteCollections.includes(element.label)) {
                    this.logger.info(`Rendering rules for collection '${element.label}'`, 'RulesExplorerProvider');
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
                        // Add rule icon to all favorite rules
                        ruleItem.iconPath = new vscode.ThemeIcon('book');
                        return ruleItem;
                    });
                }

                return [];
        }

        // Add an explicit return statement at the end to satisfy linter
        return [];
    }

    /**
     * Set search results and update the view
     */
    public setSearchResults(searchQuery: string, results: Rule[]): void {
        // Clear any active filters when search is activated
        this.activeFilters = { tags: [], tools: [] };
        this.isFilterActive = false;

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
     * Add a tag to the active filters
     */
    public async addTagFilter(tagId: string): Promise<void> {
        // Clear any active search when filter is activated
        this.searchQuery = '';
        this.searchResults = [];
        this.isSearchActive = false;

        // Add tag to filter if not already present
        if (!this.activeFilters.tags.includes(tagId)) {
            this.activeFilters.tags.push(tagId);
        }

        // Update filtered rules
        await this.updateFilteredRules();

        // Update view
        this._onDidChangeTreeData.fire();
    }

    /**
     * Add a tool to the active filters
     */
    public async addToolFilter(toolId: string): Promise<void> {
        // Clear any active search when filter is activated
        this.searchQuery = '';
        this.searchResults = [];
        this.isSearchActive = false;

        // Add tool to filter if not already present
        if (!this.activeFilters.tools.includes(toolId)) {
            this.activeFilters.tools.push(toolId);
        }

        // Update filtered rules
        await this.updateFilteredRules();

        // Update view
        this._onDidChangeTreeData.fire();
    }

    /**
     * Clear all active filters
     */
    public clearFilters(): void {
        this.activeFilters = { tags: [], tools: [] };
        this.isFilterActive = false;
        this.filteredRules = [];
        this._onDidChangeTreeData.fire();
    }

    /**
     * Update the filtered rules list based on active filters
     */
    private async updateFilteredRules(): Promise<void> {
        try {
            // Start with empty filtered rules
            this.filteredRules = [];

            // If no filters are active, clear filter state
            if (this.activeFilters.tags.length === 0 && this.activeFilters.tools.length === 0) {
                this.isFilterActive = false;
                return;
            }

            // Set filter active flag
            this.isFilterActive = true;

            // Build search params
            const searchParams: any = {
                include_private: this.showPrivateContent,
                limit: 50,
            };

            // Add tag filter if present
            if (this.activeFilters.tags.length > 0) {
                searchParams.tags = this.activeFilters.tags;
            }

            // Add tool filter if present (only one tool at a time supported by API)
            if (this.activeFilters.tools.length > 0) {
                searchParams.tool_id = this.activeFilters.tools[0];
            }

            // Search for rules matching the filters
            const { rules, count } = await this.ruleService.searchRules(searchParams);
            this.filteredRules = rules || [];

            this.logger.debug(`Found ${count} rules matching filters`, 'RulesExplorerProvider');
        } catch (error) {
            this.logger.error('Error updating filtered rules', error, 'RulesExplorerProvider');
            this.filteredRules = [];
        }
    }

    /**
     * Clean up resources when provider is no longer needed
     */
    public dispose(): void {
        this.logger.debug('Disposing RulesExplorerProvider', 'RulesExplorerProvider');
        // Any cleanup needed when the extension is deactivated
    }
}
