import * as crypto from 'crypto';
import * as vscode from 'vscode';

/**
 * Utility functions for security-related operations
 */
export class SecurityUtils {
    /**
     * Generate a secure random state parameter for OAuth flows
     */
    public static generateRandomState(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    /**
     * Store authentication state in global storage
     */
    public static async storeAuthState(context: vscode.ExtensionContext, state: string): Promise<void> {
        await context.globalState.update('codingrules.authState', state);
    }

    /**
     * Retrieve and validate the authentication state
     * @returns true if the state is valid, false otherwise
     */
    public static validateAuthState(context: vscode.ExtensionContext, state: string | null): boolean {
        const storedState = context.globalState.get('codingrules.authState');

        if (!state || state !== storedState) {
            return false;
        }

        return true;
    }

    /**
     * Clear the stored authentication state
     */
    public static async clearAuthState(context: vscode.ExtensionContext): Promise<void> {
        await context.globalState.update('codingrules.authState', undefined);
    }

    /**
     * Get the appropriate protocol scheme for the current editor
     */
    public static getEditorProtocol(): string {
        return vscode.env.uriScheme ? `${vscode.env.uriScheme}://` : 'vscode://';
    }
}
