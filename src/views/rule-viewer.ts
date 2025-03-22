import * as vscode from 'vscode';
import { Rule, AIToolFormat } from '../models/rule.model';
import { RuleDownloaderService } from '../services/rule-downloader.service';
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

            // Initialize rule downloader service
            const ruleDownloaderService = new RuleDownloaderService();

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
                const filePath = await ruleDownloaderService.downloadRule(this.rule, {
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
                const downloadedPath = await ruleDownloaderService.downloadRule(this.rule, {
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
            vscode.window.showErrorMessage(
                `Failed to download rule: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Sanitize a filename to be safe for all operating systems
     */
    private sanitizeFilename(filename: string): string {
        // Replace invalid characters with underscores
        return filename
            .replace(/[/\\?%*:|"<>]/g, '_') // Remove characters illegal in Windows
            .replace(/\s+/g, '_') // Replace spaces with underscores
            .replace(/_{2,}/g, '_') // Replace multiple underscores with a single one
            .toLowerCase(); // Lowercase for consistency
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
            } catch {
                return dateStr;
            }
        };

        // Store username for use in JavaScript
        const authorUsername = this.authorUsername;

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
            padding: 0.25rem 0.6rem;
            border-radius: 12px;
            font-size: 0.8rem;
            font-weight: 500;
            display: inline-flex;
            align-items: center;
            transition: all 0.1s ease;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
            border: 1px solid var(--vscode-widget-border, transparent);
          }
          .tag:hover {
            transform: translateY(-1px);
            background-color: var(--vscode-button-hoverBackground);
            color: var(--vscode-button-foreground);
          }
          .tag::before {
            content: '#';
            margin-right: 0.25rem;
            font-weight: 600;
            opacity: 0.7;
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
            flex-direction: column;
            gap: 1rem;
            border-top: 1px solid var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
            padding-top: 1.5rem;
          }
          .download-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 1rem;
          }
          .download-header h3 {
            margin: 0;
            font-size: 1.1rem;
            color: var(--vscode-editor-foreground);
          }
          .download-options {
            display: flex;
            flex-wrap: wrap;
            gap: 0.8rem;
            align-items: center;
            margin-bottom: 0.5rem;
          }
          .download-group {
            margin-bottom: 1rem;
          }
          .download-group-title {
            font-size: 0.9rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
            color: var(--vscode-descriptionForeground);
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
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
          }
          button:hover {
            background-color: var(--vscode-button-hoverBackground);
          }
          select {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
            border: 1px solid var(--vscode-dropdown-border);
            padding: 0.5rem;
            border-radius: 4px;
            font-size: 0.9rem;
            cursor: pointer;
            min-width: 250px;
            appearance: none;
            -webkit-appearance: none;
            background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"><path fill="gray" d="M4.5 5l3.5 3.5l3.5 -3.5z"/></svg>');
            background-repeat: no-repeat;
            background-position: right 0.7em top 50%;
            background-size: 0.65em auto;
            padding-right: 1.5rem;
            transition: border-color 0.2s;
          }
          select:hover {
            border-color: var(--vscode-focusBorder);
          }
          select:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
          }
          select option, select optgroup {
            background-color: var(--vscode-dropdown-background);
            color: var(--vscode-dropdown-foreground);
          }
          .format-selected {
            border-color: var(--vscode-inputValidation-infoBorder, var(--vscode-focusBorder));
            background-color: var(--vscode-inputValidation-infoBackground, var(--vscode-dropdown-background));
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
          .author-link {
            color: var(--vscode-textLink-foreground);
            text-decoration: none;
            cursor: pointer;
          }
          .author-link:hover {
            color: var(--vscode-textLink-activeForeground);
            text-decoration: underline;
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
          .download-actions {
            display: flex;
            gap: 0.5rem;
            margin-top: 0.8rem;
          }
          .download-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            transition: background-color 0.2s;
            opacity: 1;
          }
          .download-button:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .download-button:hover:not(:disabled) {
            background-color: var(--vscode-button-hoverBackground);
          }
          .download-button::before {
            content: "↓";
            font-weight: bold;
          }
          .copy-button {
            background-color: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
            color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.9rem;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            transition: background-color 0.2s;
          }
          .copy-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
          }
          .copy-button::before {
            content: "📋";
          }
        </style>
      </head>
      <body>
        <h1>${rule.title}</h1>
        <div class="metadata">
          <div class="metadata-row">
            <div class="author">Author: <a class="author-link" id="author-profile">${authorUsername}</a></div>
            <div class="upvotes">${rule.upvote_count || 0}</div>
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
          <div class="download-header">
            <h3>Download or Copy Rule</h3>
          </div>
          
          <div class="download-group">
            <div class="download-options">
              <button id="copy-to-clipboard" class="copy-button">Copy to clipboard</button>
            </div>
          </div>
          
          <div class="download-group">
            <div class="download-group-title">Download Format</div>
            <div class="download-options">
              <select id="format-selector">
                <option value="" disabled selected>Select format...</option>
                <optgroup label="AI Tool Formats">
                  <option value=".clinerules">Cline (.clinerules)</option>
                  <option value=".cursorrules">Cursor (.cursorrules)</option>
                  <option value=".windsurfrules">Windsurf (.windsurfrules)</option>
                </optgroup>
                <optgroup label="General Formats">
                  <option value=".md">Markdown (.md)</option>
                  <option value=".txt">Text (.txt)</option>
                </optgroup>
              </select>
            </div>
            <div class="download-actions">
              <button id="download-rule" disabled class="download-button">Download</button>
            </div>
          </div>
        </div>
        
        <script>
          const vscode = acquireVsCodeApi();
          const authorUsername = "${authorUsername}";
          
          // Set up author profile link
          document.getElementById('author-profile').addEventListener('click', () => {
            try {
              const profileUrl = 'https://codingrules.ai/profile/' + authorUsername;
              vscode.postMessage({ 
                command: 'openExternalLink', 
                url: profileUrl
              });
            } catch (error) {
              console.error('Failed to open profile:', error);
            }
          });
          
          // Format selector
          const formatSelector = document.getElementById('format-selector');
          const downloadButton = document.getElementById('download-rule');
          
          // Enable download button when format is selected
          formatSelector.addEventListener('change', () => {
            const hasValue = !!formatSelector.value;
            downloadButton.disabled = !hasValue;
            
            // Add visual feedback when format is selected
            if (hasValue) {
              formatSelector.classList.add('format-selected');
            } else {
              formatSelector.classList.remove('format-selected');
            }
          });
          
          // Handle download
          downloadButton.addEventListener('click', () => {
            const format = formatSelector.value;
            if (format) {
              vscode.postMessage({ command: 'downloadRule', format });
            }
          });

          // Copy to clipboard functionality
          function copyToClipboard() {
            const content = ${JSON.stringify(rule.content || '')};
            vscode.postMessage({ 
              command: 'copyToClipboard', 
              text: content 
            });
            
            // Show tooltip
            const tooltip = document.getElementById('copy-tooltip');
            if (tooltip) {
              tooltip.classList.add('show');
              
              // Hide tooltip after 2 seconds
              setTimeout(() => {
                tooltip.classList.remove('show');
              }, 2000);
            }
          }
          
          // Ensure elements exist before adding event listeners
          const copyContentBtn = document.getElementById('copy-content');
          const copyToClipboardBtn = document.getElementById('copy-to-clipboard');
          
          if (copyContentBtn) {
            copyContentBtn.addEventListener('click', copyToClipboard);
          }
          
          if (copyToClipboardBtn) {
            copyToClipboardBtn.addEventListener('click', copyToClipboard);
          }
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
