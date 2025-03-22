import * as vscode from 'vscode';
import { Config } from './config';
import { SupabaseService } from './services/supabase.service';
import { AuthService } from './services/auth.service';
import { Logger, LogLevel } from './utils/logger';
import { AuthHandler } from './handlers/auth-handler';
import { RuleService } from './services/rule.service';
import { RulesExplorerProvider } from './views/explorer';
import { RuleCommandHandler, ExplorerCommandHandler, AuthCommandHandler } from './commands';

/**
 * Entry point for the extension
 */
export async function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize logger
        const logger = Logger.getInstance();
        logger.configure({
            level: LogLevel.DEBUG, // Set to DEBUG level to capture all logs
            outputToConsole: true, // Output to console for development visibility
            redactSensitiveData: false, // Show full details for debugging the auth issue
        });

        // Show the log output channel to the user
        logger.show();

        logger.info('Activating CodingRules.ai extension', 'Extension');

        // Initialize configuration
        const config = Config.getInstance(context);

        // Get Supabase configuration
        const supabaseConfig = config.getSupabaseConfig();

        // Initialize core services
        const supabaseService = SupabaseService.initialize(supabaseConfig);
        const authService = await AuthService.initialize(supabaseConfig, context);

        // Link services (circular dependency resolution)
        supabaseService.setAuthService(authService);

        // Initialize rule service
        const ruleService = RuleService.initialize();

        // Initialize authentication handler
        const authHandler = new AuthHandler(context, authService);
        authHandler.register();

        // Initialize the explorer provider
        const rulesExplorerProvider = new RulesExplorerProvider(context);

        // Register the explorer view
        const rulesExplorerView = vscode.window.createTreeView('codingrulesExplorer', {
            treeDataProvider: rulesExplorerProvider,
            showCollapseAll: true,
        });

        // Add the tree view to context subscriptions
        context.subscriptions.push(rulesExplorerView);

        // Initialize and register command handlers
        const ruleCommandHandler = new RuleCommandHandler(context);
        ruleCommandHandler.register();

        const explorerCommandHandler = new ExplorerCommandHandler(context, rulesExplorerProvider);
        explorerCommandHandler.register();

        const authCommandHandler = new AuthCommandHandler(context);
        authCommandHandler.register();

        logger.info('CodingRules.ai extension activated successfully', 'Extension');
    } catch (error) {
        const logger = Logger.getInstance();
        logger.error('Error activating extension', error, 'Extension');
        vscode.window.showErrorMessage(
            `Error activating CodingRules.ai extension: ${error instanceof Error ? error.message : String(error)}`,
        );
    }
}

/**
 * Called when the extension is deactivated
 */
export function deactivate() {
    Logger.getInstance().info('CodingRules.ai extension deactivated', 'Extension');
}
