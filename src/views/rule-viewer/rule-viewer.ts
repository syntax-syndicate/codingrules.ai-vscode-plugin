import * as vscode from 'vscode';
import { Rule, AIToolFormat } from '../../models/rule.model';
import { RuleDownloaderService } from '../../services/rule-downloader.service';
import { RuleService } from '../../services/rule.service';
import { Logger } from '../../utils/logger';
import { RuleViewerUI } from './rule-viewer-ui';

/**
 * Manages webview panels to display rule details and download options
 */
export class RuleViewer {
    public static readonly viewType = 'codingrules.ruleViewer';
    private static panels = new Map<string, RuleViewer>();

    private readonly panel: vscode.WebviewPanel;
    private readonly rule: Rule;
    private disposables: vscode.Disposable[] = [];
    private authorUsername: string = 'Unknown';
    private ruleService: RuleService;
    private ruleDownloaderService: RuleDownloaderService;
    private logger: Logger;

    /**
     * Show a rule viewer panel for the given rule
     */
    public static show(rule: Rule): RuleViewer {
        const column = vscode.window.activeTextEditor?.viewColumn || vscode.ViewColumn.One;

        // Check if we already have a panel for this rule
        if (RuleViewer.panels.has(rule.id)) {
            const existingPanel = RuleViewer.panels.get(rule.id)!;
            existingPanel.panel.reveal(column);
            return existingPanel;
        }

        // Create a new panel
        const panel = vscode.window.createWebviewPanel(RuleViewer.viewType, rule.title, column, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });

        const viewer = new RuleViewer(panel, rule);
        RuleViewer.panels.set(rule.id, viewer);
        return viewer;
    }

    private constructor(panel: vscode.WebviewPanel, rule: Rule) {
        this.panel = panel;
        this.rule = rule;
        this.ruleService = RuleService.getInstance();
        this.ruleDownloaderService = new RuleDownloaderService();
        this.logger = Logger.getInstance();

        // Set panel icon - use context.asAbsolutePath to get real icon path
        // For now, we'll skip setting an icon since we don't have an actual icon file
        // this.panel.iconPath = {...};

        // Load author details
        this.loadAuthorDetails();

        // Set the HTML content
        this.updateContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                await this.handleWebviewMessage(message);
            },
            null,
            this.disposables,
        );

        // Clean up resources when the panel is closed
        this.panel.onDidDispose(
            () => {
                RuleViewer.panels.delete(rule.id);
                this.dispose();
            },
            null,
            this.disposables,
        );
    }

    /**
     * Handle messages from the webview
     */
    private async handleWebviewMessage(message: any): Promise<void> {
        try {
            switch (message.command) {
                case 'downloadRule':
                    await this.downloadRule(message.format);
                    break;
                case 'copyToClipboard':
                    if (message.text) {
                        await vscode.env.clipboard.writeText(message.text);
                        vscode.window.showInformationMessage('Rule copied to clipboard');
                    }
                    break;
                case 'openExternalLink':
                    if (message.url) {
                        await vscode.env.openExternal(vscode.Uri.parse(message.url));
                        vscode.window.showInformationMessage(`Opening profile for ${this.authorUsername}`);
                    }
                    break;
                case 'close':
                    this.panel.dispose();
                    break;
            }
        } catch (error) {
            this.logger.error('Error handling webview message', error, 'RuleViewer');
            vscode.window.showErrorMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Load author details for the rule
     */
    private async loadAuthorDetails(): Promise<void> {
        if (this.rule.author_id) {
            const authorProfile = await this.ruleService.getUserProfile(this.rule.author_id);
            if (authorProfile && authorProfile.username) {
                this.authorUsername = authorProfile.username;
                // Update the content to reflect the author name
                this.updateContent();
            }
        }
    }

    /**
     * Download the rule in the specified format
     */
    private async downloadRule(format: AIToolFormat): Promise<void> {
        try {
            // Validate rule has required properties
            if (!this.rule.title) {
                vscode.window.showErrorMessage(
                    `Cannot download rule: Missing title information. Please try another rule.`,
                );
                return;
            }

            // Validate rule content before attempting to download
            if (!this.rule.content) {
                vscode.window.showErrorMessage(
                    `Cannot download rule "${this.rule.title}": Rule content is empty or missing. Please try another rule.`,
                );
                return;
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
                const filePath = await this.ruleDownloaderService.downloadRule(this.rule, {
                    directory: folderUri[0].fsPath,
                    format: format,
                    includeMetadata: true,
                });

                // Open the file
                if (filePath) {
                    const openDocument = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(openDocument);
                    vscode.window.showInformationMessage(`Rule "${this.rule.title}" has been downloaded.`);
                }
            } else {
                // Download rule to workspace - RuleDownloaderService will handle file existence checks
                const downloadedPath = await this.ruleDownloaderService.downloadRule(this.rule, {
                    directory: workspaceFolder,
                    format: format,
                    includeMetadata: true,
                });

                // Open the file if it was downloaded (not cancelled)
                if (downloadedPath) {
                    const openDocument = await vscode.workspace.openTextDocument(downloadedPath);
                    await vscode.window.showTextDocument(openDocument);
                }
            }
        } catch (error) {
            this.logger.error('Error downloading rule', error, 'RuleViewer');
            vscode.window.showErrorMessage(
                `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Update the HTML content of the webview
     */
    private updateContent(): void {
        this.panel.webview.html = RuleViewerUI.getHtmlContent(this.rule, this.authorUsername);
    }

    /**
     * Clean up resources
     */
    private dispose() {
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}
