import * as vscode from 'vscode';
import { Rule } from '../models/rule.model';
import { RuleService } from '../services/rule.service';
import { RuleDownloaderService } from '../services/rule-downloader.service';
import { RuleViewer } from '../views/rule-viewer';
import { RuleExplorerItem, RuleExplorerItemType } from '../views/explorer';
import { Logger } from '../utils/logger';

/**
 * Handler for rule-related commands
 */
export class RuleCommandHandler {
    private ruleService: RuleService;
    private ruleDownloaderService: RuleDownloaderService;
    private logger: Logger;

    constructor(private context: vscode.ExtensionContext) {
        this.ruleService = RuleService.getInstance();
        this.ruleDownloaderService = new RuleDownloaderService();
        this.logger = Logger.getInstance();
    }

    /**
     * Register all rule-related commands
     */
    public register(): void {
        this.registerViewRuleCommand();
        this.registerDownloadRuleCommand();
        this.registerCopyRuleContentCommand();
        this.registerCopyRuleToClipboardCommand();
    }

    /**
     * Register command to view rule details
     */
    private registerViewRuleCommand(): void {
        const disposable = vscode.commands.registerCommand(
            'codingrules-ai.viewRule',
            async (node: RuleExplorerItem) => {
                if (node.type === RuleExplorerItemType.RULE && node.dataId) {
                    // Get full rule data
                    const rule = await this.ruleService.getRule(node.dataId);

                    // Show rule panel
                    if (rule) {
                        RuleViewer.show(rule);
                    } else {
                        vscode.window.showErrorMessage('Could not load rule details.');
                    }
                }
            },
        );

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to download rule from explorer
     */
    private registerDownloadRuleCommand(): void {
        const disposable = vscode.commands.registerCommand(
            'codingrules-ai.downloadRule',
            async (node: RuleExplorerItem | Rule) => {
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
                        rule = await this.ruleService.getRule(node.dataId);
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
                            { label: `Cline Rule (.clinerules)`, format: '.clinerules' },
                            { label: `Cursor Rule (.cursorrules)`, format: '.cursorrules' },
                            { label: `Windsurf Rule (.windsurfrules)`, format: '.windsurfrules' },
                            { label: `Markdown (.md)`, format: '.md' },
                            { label: `Text file (.txt)`, format: '.txt' },
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
                        const filePath = await this.ruleDownloaderService.downloadRule(rule, {
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
                        const filePath = await this.ruleDownloaderService.downloadRule(rule, {
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
                    this.logger.error('Error downloading rule', error, 'RuleCommandHandler');
                    vscode.window.showErrorMessage(
                        `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            },
        );

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to copy rule content to clipboard
     */
    private registerCopyRuleContentCommand(): void {
        const disposable = vscode.commands.registerCommand(
            'codingrules-ai.copyRuleContent',
            async (node: RuleExplorerItem) => {
                if (node.type === RuleExplorerItemType.RULE && node.dataId) {
                    try {
                        // Get full rule data
                        const rule = await this.ruleService.getRule(node.dataId);

                        if (!rule || !rule.content) {
                            vscode.window.showErrorMessage('Could not load rule content for copying.');
                            return;
                        }

                        // Copy the content to the clipboard
                        await vscode.env.clipboard.writeText(rule.content);
                        vscode.window.showInformationMessage(`Rule content copied to clipboard.`);
                    } catch (error) {
                        this.logger.error('Error copying rule to clipboard', error, 'RuleCommandHandler');
                        vscode.window.showErrorMessage(
                            `Failed to copy rule: ${error instanceof Error ? error.message : String(error)}`,
                        );
                    }
                }
            },
        );

        this.context.subscriptions.push(disposable);
    }

    /**
     * Register command to copy rule to clipboard
     */
    private registerCopyRuleToClipboardCommand(): void {
        const disposable = vscode.commands.registerCommand(
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
                        rule = await this.ruleService.getRule(node.dataId);
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
                    this.logger.error('Error copying rule to clipboard', error, 'RuleCommandHandler');
                    vscode.window.showErrorMessage(
                        `Failed to copy rule: ${error instanceof Error ? error.message : String(error)}`,
                    );
                }
            },
        );

        this.context.subscriptions.push(disposable);
    }
}
