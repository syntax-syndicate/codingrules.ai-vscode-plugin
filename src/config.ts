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
     * Uses hardcoded values that cannot be changed by users
     */
    public getSupabaseConfig(): SupabaseConfig {
        // Hardcoded Supabase configuration values
        const SUPABASE_URL = 'https://snoakzvpwgvzajcwodlx.supabase.co';
        const SUPABASE_ANON_KEY =
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNub2FrenZwd2d2emFqY3dvZGx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDEwMjUwMTUsImV4cCI6MjA1NjYwMTAxNX0.JefVlhljBPWKIZV_u-rNZfRTayJmXUyDc-r-0geBD4U';

        return { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY };
    }
}
