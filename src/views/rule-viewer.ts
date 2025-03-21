import * as vscode from 'vscode';
import { Rule, AIToolFormat } from '../models/rule.model';
import { RuleDownloaderService, RuleSaveOptions } from '../services/rule-downloader.service';

/**
 * Manages webview panels to display rule details and download options
 */
export class RuleViewer {
    public static readonly viewType = 'codingrules.ruleViewer';
    private static panels = new Map<string, RuleViewer>();

    private readonly panel: vscode.WebviewPanel;
    private readonly rule: Rule;
    private disposables: vscode.Disposable[] = [];

    /**
     * Show a rule viewer panel for the given rule
     */
    public static show(rule: Rule, context: vscode.ExtensionContext): RuleViewer {
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

        const viewer = new RuleViewer(panel, rule, context);
        RuleViewer.panels.set(rule.id, viewer);
        return viewer;
    }

    private constructor(panel: vscode.WebviewPanel, rule: Rule, context: vscode.ExtensionContext) {
        this.panel = panel;
        this.rule = rule;

        // Set panel icon - use context.asAbsolutePath to get real icon path
        // For now, we'll skip setting an icon since we don't have an actual icon file
        // this.panel.iconPath = {...};

        // Set the HTML content
        this.updateContent();

        // Handle messages from the webview
        this.panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'downloadRule':
                        await this.downloadRule(message.format);
                        break;
                    case 'close':
                        this.panel.dispose();
                        break;
                }
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
     * Download the rule in the specified format
     */
    private async downloadRule(format: AIToolFormat): Promise<void> {
        try {
            const workspaceFolder = RuleDownloaderService.getWorkspaceFolder();

            if (!workspaceFolder) {
                throw new Error('No workspace folder open');
            }

            // Ask user if they want to replace existing file if it exists
            const downloader = new RuleDownloaderService();
            const saveOptions: RuleSaveOptions = {
                directory: workspaceFolder,
                format: format as AIToolFormat,
            };

            // Show quick pick for replace or merge
            if (format) {
                const fileName = this.rule.slug || new RuleDownloaderService().sanitizeFileName(this.rule.title);
                const filePath = `${workspaceFolder}/${fileName}${format}`;

                try {
                    const fs = require('fs');
                    if (fs.existsSync(filePath)) {
                        const choice = await vscode.window.showQuickPick(
                            ['Replace existing file', 'Merge with existing content'],
                            { placeHolder: 'File already exists. How would you like to proceed?' },
                        );

                        if (!choice) {
                            return; // User cancelled
                        }

                        saveOptions.replaceExisting = choice === 'Replace existing file';
                    }
                } catch (error) {
                    // Ignore file check errors
                }
            }

            // Download the rule
            const filePath = await downloader.downloadRule(this.rule, saveOptions);

            vscode.window.showInformationMessage(`Rule downloaded to: ${filePath}`);

            // Open the file
            const document = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Update the HTML content of the webview
     */
    private updateContent(): void {
        this.panel.webview.html = this.getHtmlContent();
    }

    /**
     * Get the HTML content for the webview
     */
    private getHtmlContent(): string {
        const rule = this.rule;
        const tagsList = rule.tags?.map((tag) => `<span class="tag">${tag.name}</span>`).join('') || '';

        // Format date
        const formatDate = (dateStr: string) => {
            try {
                const date = new Date(dateStr);
                return date.toLocaleDateString();
            } catch (e) {
                return dateStr;
            }
        };

        return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${rule.title}</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 1rem;
            line-height: 1.5;
          }
          h1 {
            color: var(--vscode-editor-foreground);
            font-size: 1.5rem;
            margin-bottom: 0.5rem;
          }
          .metadata {
            font-size: 0.8rem;
            color: var(--vscode-descriptionForeground);
            margin-bottom: 1rem;
          }
          .tags {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            margin: 1rem 0;
          }
          .tag {
            background-color: var(--vscode-badge-background);
            color: var(--vscode-badge-foreground);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-size: 0.8rem;
          }
          .content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
            white-space: pre-wrap;
          }
          .download-section {
            margin-top: 2rem;
          }
          button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            margin-right: 0.5rem;
            margin-bottom: 0.5rem;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          .upvotes {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            color: var(--vscode-charts-blue);
          }
          .upvotes::before {
            content: '↑';
          }
        </style>
      </head>
      <body>
        <h1>${rule.title}</h1>
        <div class="metadata">
          <div>Created: ${formatDate(rule.created_at)}</div>
          <div>Updated: ${formatDate(rule.updated_at)}</div>
          <div class="upvotes">${rule.upvote_count}</div>
        </div>
        
        <div class="tags">
          ${tagsList}
        </div>
        
        <div class="content">${rule.content}</div>
        
        <div class="download-section">
          <h3>Download as:</h3>
          <button id="download-cline">Cline Rule (.clinerules)</button>
          <button id="download-cursor">Cursor Rule (.cursorrules)</button>
          <button id="download-windsurf">Windsurf Rule (.windsurfrules)</button>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          
          document.getElementById('download-cline').addEventListener('click', () => {
            vscode.postMessage({ command: 'downloadRule', format: '.clinerules' });
          });
          
          document.getElementById('download-cursor').addEventListener('click', () => {
            vscode.postMessage({ command: 'downloadRule', format: '.cursorrules' });
          });
          
          document.getElementById('download-windsurf').addEventListener('click', () => {
            vscode.postMessage({ command: 'downloadRule', format: '.windsurfrules' });
          });
        </script>
      </body>
      </html>
    `;
    }

    /**
     * Clean up resources
     */
    private dispose() {
        this.disposables.forEach((d) => d.dispose());
        this.disposables = [];
    }
}
