import * as vscode from 'vscode';

/**
 * Configuration interface for Supabase
 */
export interface SupabaseConfig {
    url: string;
    anonKey: string;
}

/**
 * Extension configuration
 */
export class Config {
    private static instance: Config;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    public static getInstance(context?: vscode.ExtensionContext): Config {
        if (!Config.instance && context) {
            Config.instance = new Config(context);
        }

        if (!Config.instance) {
            throw new Error('Config not initialized');
        }

        return Config.instance;
    }

    /**
     * Get Supabase configuration
     * Uses bundled config for production or extension settings
     */
    public getSupabaseConfig(): SupabaseConfig {
        // Production configuration (values will be set during build)
        // These are the default values that will be bundled with the extension
        const BUNDLED_SUPABASE_URL = 'https://snoakzvpwgvzajcwodlx.supabase.co';
        const BUNDLED_SUPABASE_ANON_KEY =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNub2FrenZwd2d2emFqY3dvZGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMjUwMTUsImV4cCI6MjA1NjYwMTAxNX0.JefVlhljBPWKIZV_u-rNZfRTayJmXUyDc-r-0geBD4U';

        // Check for user-configured values in settings (these override bundled values)
        const config = vscode.workspace.getConfiguration('codingrules-ai');
        const url = config.get<string>('supabaseUrl') || BUNDLED_SUPABASE_URL;
        const anonKey = config.get<string>('supabaseAnonKey') || BUNDLED_SUPABASE_ANON_KEY;

        return { url, anonKey };
    }

    // No additional methods needed
}
