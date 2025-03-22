import * as vscode from 'vscode';
import { Rule, Tag, Tool } from '../../models/rule.model';

/**
 * Tree item types in the Rules Explorer
 */
export enum RuleExplorerItemType {
    CATEGORY = 'category',
    RULE = 'rule',
    TAG = 'tag',
    TOOL = 'tool',
    LOADING = 'loading',
    ACTION = 'action', // For actions like "Show all rules"
    FILTER = 'filter', // For active filter items
}

/**
 * TreeItem for the Rules Explorer
 */
export class RuleExplorerItem extends vscode.TreeItem {
    /**
     * Track if children have been fetched for this item (for expandable tags/tools)
     */
    public childrenFetched: boolean = false;

    /**
     * Count of associated rules (for tags/tools)
     */
    public count?: number;

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
        count?: number,
    ) {
        // If count is provided, include it in the displayed label
        const displayLabel = count !== undefined ? `${label} (${count})` : label;
        super(displayLabel, collapsibleState);

        // Store the count for reference
        this.count = count;

        // Set different icons based on type
        switch (type) {
            case RuleExplorerItemType.ACTION:
                this.iconPath = new vscode.ThemeIcon('arrow-right');
                break;
            case RuleExplorerItemType.FILTER:
                this.iconPath = new vscode.ThemeIcon('filter');
                break;
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
