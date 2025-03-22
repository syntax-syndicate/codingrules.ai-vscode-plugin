import * as vscode from 'vscode';
import { AuthService } from '../services/auth.service';
import { Logger } from '../utils/logger';

/**
 * Handler for authentication-related commands
 */
export class AuthCommandHandler {
    private authService: AuthService;
    private logger: Logger;

    constructor(private context: vscode.ExtensionContext) {
        this.authService = AuthService.getInstance();
        this.logger = Logger.getInstance();
    }

    /**
     * Register all authentication-related commands
     * Note: All auth commands (login, logout, checkAuthStatus, viewProfile) are now handled by AuthHandler
     */
    public register(): void {
        // All auth commands moved to AuthHandler to avoid duplication
    }
}
