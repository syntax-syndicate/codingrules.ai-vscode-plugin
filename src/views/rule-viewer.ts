import * as vscode from 'vscode';
import { Rule, AIToolFormat } from '../models/rule.model';
import { RuleDownloaderService, RuleSaveOptions } from '../services/rule-downloader.service';
import { SupabaseService } from '../services/supabase.service';

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
    private supabaseService: SupabaseService;

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
        this.supabaseService = SupabaseService.getInstance();

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
     * Load author details for the rule
     */
    private async loadAuthorDetails(): Promise<void> {
        if (this.rule.author_id) {
            const authorProfile = await this.supabaseService.getUserProfile(this.rule.author_id);
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

            // Add format to the rule object
            const ruleWithFormat = {
                ...this.rule,
                selectedFormat: format,
            };

            // Call the main download command directly
            await vscode.commands.executeCommand('codingrules-ai.downloadRule', ruleWithFormat);
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
        const tagsList =
            rule.tags
                ?.sort((a, b) => a.name.localeCompare(b.name))
                .map((tag) => `<span class="tag">${tag.name}</span>`)
                .join('') || '';

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
          .metadata-row {
            display: flex;
            flex-wrap: wrap;
            gap: 1rem;
            margin-bottom: 0.5rem;
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
          .content-container {
            position: relative;
          }
          .content {
            background-color: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            padding: 1rem;
            border-radius: 4px;
            margin: 1rem 0;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
          }
          .action-buttons {
            position: absolute;
            top: 0.5rem;
            right: 0.5rem;
            display: flex;
            gap: 0.5rem;
          }
          .icon-button {
            background-color: transparent;
            color: var(--vscode-editor-foreground);
            border: none;
            cursor: pointer;
            font-size: 1rem;
            padding: 0.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.7;
            border-radius: 3px;
          }
          .icon-button:hover {
            opacity: 1;
            background-color: var(--vscode-button-hoverBackground);
          }
          .download-section {
            margin-top: 2rem;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.5rem;
          }
          .download-section h3 {
            margin: 0;
            margin-right: 1rem;
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
          .author {
            font-weight: bold;
          }
          .copy-tooltip {
            position: absolute;
            background-color: var(--vscode-editorHoverWidget-background);
            color: var(--vscode-editorHoverWidget-foreground);
            padding: 0.2rem 0.5rem;
            border-radius: 3px;
            font-size: 0.8rem;
            top: -2rem;
            right: 0;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
          }
          .copy-tooltip.show {
            opacity: 1;
          }
        </style>
      </head>
      <body>
        <h1>${rule.title}</h1>
        <div class="metadata">
          <div class="metadata-row">
            <div class="author">Author: ${this.authorUsername}</div>
            <div class="upvotes">${rule.upvote_count}</div>
          </div>
          <div class="metadata-row">
            <div>Created: ${formatDate(rule.created_at)}</div>
            <div>Updated: ${formatDate(rule.updated_at)}</div>
          </div>
        </div>
        
        <div class="tags">
          ${tagsList}
        </div>
        
        <div class="content-container">
          <div class="content">${rule.content}</div>
          <div class="action-buttons">
            <button id="copy-content" class="icon-button" title="Copy to clipboard">📋</button>
            <div id="copy-tooltip" class="copy-tooltip">Copied!</div>
          </div>
        </div>
        
        <div class="download-section">
          <h3>Download as:</h3>
          <button id="download-cline">Cline Rule (.clinerules)</button>
          <button id="download-cursor">Cursor Rule (.cursorrules)</button>
          <button id="download-windsurf">Windsurf Rule (.windsurfrules)</button>
          <button id="copy-to-clipboard" title="Copy to clipboard">📋 Copy to clipboard</button>
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

          // Copy to clipboard functionality
          function copyToClipboard() {
            const content = ${JSON.stringify(rule.content)};
            vscode.postMessage({ 
              command: 'copyToClipboard', 
              text: content 
            });
            
            // Show tooltip
            const tooltip = document.getElementById('copy-tooltip');
            tooltip.classList.add('show');
            
            // Hide tooltip after 2 seconds
            setTimeout(() => {
              tooltip.classList.remove('show');
            }, 2000);
          }
          
          document.getElementById('copy-content').addEventListener('click', copyToClipboard);
          document.getElementById('copy-to-clipboard').addEventListener('click', copyToClipboard);
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
