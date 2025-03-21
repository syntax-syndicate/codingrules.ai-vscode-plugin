import * as vscode from 'vscode';
import { Rule, Tag, Tool } from '../models/rule.model';
import { SupabaseService } from '../services/supabase.service';
import { Config } from '../config';

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
                this.iconPath = new vscode.ThemeIcon('book');
                this.tooltip = (data as Rule)?.title || '';
                this.description = (data as Rule)?.upvote_count?.toString() || '0';
                break;
            case RuleExplorerItemType.TAG:
                this.iconPath = new vscode.ThemeIcon('tag');
                this.tooltip = (data as Tag)?.description || '';
                break;
            case RuleExplorerItemType.TOOL:
                this.iconPath = new vscode.ThemeIcon('tools');
                this.tooltip = (data as Tool)?.description || '';
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
    private rules: Rule[] = [];
    private tags: Tag[] = [];
    private tools: Tool[] = [];
    private isLoading = false;

    constructor(context: vscode.ExtensionContext) {
        try {
            const config = Config.getInstance(context);
            const supabaseConfig = config.getSupabaseConfig();
            this.supabaseService = SupabaseService.initialize(supabaseConfig);
            this.refreshData();

            // Register command handlers
            context.subscriptions.push(
                vscode.commands.registerCommand('codingrules-ai.downloadRule', async (item?: RuleExplorerItem | Rule) => {
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
                })
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
                console.log(`Fetching complete rule data for ${rule.id}`);
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
                    `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`
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
        try {
            this.isLoading = true;
            this.refresh();

            // Fetch data in parallel
            const [rulesResult, tags, tools] = await Promise.all([
                this.supabaseService.searchRules({ limit: 20 }),
                this.supabaseService.getTags(),
                this.supabaseService.getTools(),
            ]);

            this.rules = rulesResult.rules;
            this.tags = tags;
            this.tools = tools;

            this.isLoading = false;
            this.refresh();
        } catch (error) {
            this.isLoading = false;
            console.error('Error refreshing data:', error);

            // Better error message formatting
            let errorMessage = 'Failed to load coding rules';

            if (error instanceof Error) {
                errorMessage += `: ${error.message}`;
            } else if (error && typeof error === 'object') {
                try {
                    errorMessage += `: ${JSON.stringify(error)}`;
                } catch {
                    errorMessage += ': Unknown error format';
                }
            } else if (error) {
                errorMessage += `: ${String(error)}`;
            }

            // Show error in UI
            vscode.window.showErrorMessage(errorMessage);

            // Log detailed error for debugging
            console.log('Detailed error:', JSON.stringify(error, null, 2));

            // Update UI to show error state
            this.refresh();
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
            return [
                new RuleExplorerItem(
                    RuleExplorerItemType.CATEGORY,
                    'Recent Rules',
                    vscode.TreeItemCollapsibleState.Expanded,
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
            ];
        }

        // Handle different category items
        switch (element.label) {
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
