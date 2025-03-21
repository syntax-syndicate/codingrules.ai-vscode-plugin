import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Rule, AIToolFormat } from '../models/rule.model';

/**
 * Options for saving rule files
 */
export interface RuleSaveOptions {
    /** The directory path to save the rule file to */
    directory: string;
    /** The format to use for the rule file */
    format: AIToolFormat;
    /** Whether to replace existing files or merge content */
    replaceExisting?: boolean;
}

/**
 * Service for downloading and saving rules to filesystem
 */
export class RuleDownloaderService {
    /**
     * Download a rule and save it to the specified location with the specified format
     */
    public async downloadRule(rule: Rule, options: RuleSaveOptions): Promise<string> {
        const { directory, format, replaceExisting = false } = options;

        try {
            // Format the file name (slug or sanitized title)
            const fileName = rule.slug || this.sanitizeFileName(rule.title);
            const filePath = path.join(directory, `${fileName}${format}`);

            // Check if file exists
            const fileExists = fs.existsSync(filePath);

            if (fileExists && !replaceExisting) {
                // Merge with existing content
                const existingContent = fs.readFileSync(filePath, 'utf8');
                const mergedContent = this.mergeContent(existingContent, rule.content);
                fs.writeFileSync(filePath, mergedContent);
            } else {
                // Create the directory if it doesn't exist
                if (!fs.existsSync(directory)) {
                    fs.mkdirSync(directory, { recursive: true });
                }

                // Write the file
                fs.writeFileSync(filePath, rule.content);
            }

            return filePath;
        } catch (error) {
            console.error('Error downloading rule:', error);
            throw new Error(`Failed to download rule: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Download multiple rules at once
     */
    public async downloadRules(rules: Rule[], options: RuleSaveOptions): Promise<string[]> {
        const results: string[] = [];

        for (const rule of rules) {
            const filePath = await this.downloadRule(rule, options);
            results.push(filePath);
        }

        return results;
    }

    /**
     * Sanitize a string to be used as a file name
     */
    public sanitizeFileName(name: string): string {
        // Replace spaces with hyphens and remove special characters
        return name
            .toLowerCase()
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    /**
     * Merge existing content with new content
     * For now, we'll just append the new content with a separator
     * In a future version, we could implement more sophisticated merging
     */
    private mergeContent(existingContent: string, newContent: string): string {
        // Check if the content already exists to avoid duplication
        if (existingContent.includes(newContent)) {
            return existingContent;
        }

        return `${existingContent}\n\n---\n\n${newContent}`;
    }

    /**
     * Get the workspace folder
     * If there are multiple workspaces, use the first one
     */
    public static getWorkspaceFolder(): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        return workspaceFolders[0].uri.fsPath;
    }
}
