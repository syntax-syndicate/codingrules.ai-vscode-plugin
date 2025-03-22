import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import * as vscode from 'vscode';
import { SupabaseConfig } from '../config';
import { Database } from '../types/database.types';

/**
 * Service for handling authentication with Supabase
 */
export class AuthService {
    private static instance: AuthService;
    private client: SupabaseClient<Database>;
    private context: vscode.ExtensionContext;
    private _currentUser: User | null = null;
    private readonly SESSION_KEY = 'codingrules-ai.session';

    private constructor(config: SupabaseConfig, context: vscode.ExtensionContext) {
        this.client = createClient<Database>(config.url, config.anonKey);
        this.context = context;

        // Set up auth state change listener to ensure state is always up to date
        this.client.auth.onAuthStateChange((event, session) => {
            this._currentUser = session?.user || null;

            // Save session when it becomes available
            if (event === 'SIGNED_IN' && session) {
                this.saveSession().catch((error) => {
                    console.error('Error saving session after auth state change:', error);
                });
            } else if (event === 'SIGNED_OUT') {
                this.clearSession().catch((error) => {
                    console.error('Error clearing session after sign out:', error);
                });
            }
        });
    }

    /**
     * Get singleton instance of AuthService
     */
    public static getInstance(config?: SupabaseConfig, context?: vscode.ExtensionContext): AuthService {
        if (!AuthService.instance && config && context) {
            AuthService.instance = new AuthService(config, context);
        }

        if (!AuthService.instance) {
            throw new Error('AuthService not initialized');
        }

        return AuthService.instance;
    }

    /**
     * Initialize the Auth service with configuration
     */
    public static async initialize(config: SupabaseConfig, context: vscode.ExtensionContext): Promise<AuthService> {
        AuthService.instance = new AuthService(config, context);

        // Initialize by loading any existing session
        await AuthService.instance.initializeSession();

        return AuthService.instance;
    }

    /**
     * Initialize session from storage and refresh current user
     * This ensures authentication state is properly loaded before UI components use it
     */
    public async initializeSession(): Promise<void> {
        try {
            // First load any stored session
            await this.loadSession();

            // Then refresh the current user to ensure state is up-to-date
            await this.refreshCurrentUser();
        } catch (error) {
            console.error('Error initializing session:', error);
            // Clear any potentially corrupt session
            await this.clearSession();
        }
    }

    /**
     * Get the current authenticated user, if any
     */
    public get currentUser(): User | null {
        return this._currentUser;
    }

    /**
     * Force refresh the current user state
     */
    public async refreshCurrentUser(): Promise<User | null> {
        try {
            const { data } = await this.client.auth.getUser();
            if (data.user) {
                this._currentUser = data.user;
            }
            return this._currentUser;
        } catch (error) {
            console.error('Error refreshing user:', error);
            return this._currentUser;
        }
    }

    /**
     * Check if a user is currently authenticated
     */
    public get isAuthenticated(): boolean {
        return this._currentUser !== null;
    }

    /**
     * Get the current session token, if any
     */
    public async getAccessToken(): Promise<string | null> {
        const session = await this.client.auth.getSession();
        return session.data.session?.access_token || null;
    }

    /**
     * Log out the current user
     */
    public async logout(): Promise<void> {
        try {
            const { error } = await this.client.auth.signOut();

            if (error) {
                throw error;
            }

            this._currentUser = null;
            await this.clearSession();

            vscode.window.showInformationMessage('Successfully logged out');
        } catch (error) {
            console.error('Logout error:', error);
            vscode.window.showErrorMessage(`Logout failed: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    /**
     * Set the session from external tokens (used for web app redirect auth)
     */
    public async setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void> {
        try {
            // Set the session in the Supabase client
            const { data, error } = await this.client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (error) {
                throw error;
            }

            if (data?.user) {
                this._currentUser = data.user;
                await this.saveSession();
            } else {
                throw new Error('No user data returned from session');
            }
        } catch (error) {
            console.error('Error setting session from tokens:', error);
            throw error;
        }
    }

    /**
     * Load saved session from storage
     * Returns a Promise to ensure the session is fully loaded before continuing
     */
    private async loadSession(): Promise<boolean> {
        try {
            // Attempt to restore session from storage
            const savedAccessToken = await this.context.secrets.get(this.SESSION_KEY + '.access');
            const savedRefreshToken = await this.context.secrets.get(this.SESSION_KEY + '.refresh');

            if (savedAccessToken && savedRefreshToken) {
                // Set the session in the Supabase client
                const { data, error } = await this.client.auth.setSession({
                    access_token: savedAccessToken,
                    refresh_token: savedRefreshToken,
                });

                if (error) {
                    console.error('Error restoring session:', error);
                    await this.clearSession();
                    return false;
                }

                // Get the user from the session
                if (data?.user) {
                    this._currentUser = data.user;
                    return true;
                }
            }
            return false;
        } catch (error) {
            console.error('Error loading session:', error);
            // Clear any potentially corrupt session
            await this.clearSession();
            return false;
        }
    }

    /**
     * Save current session to storage
     */
    private async saveSession(): Promise<void> {
        if (!this._currentUser) {
            return;
        }

        try {
            const { data } = await this.client.auth.getSession();
            if (data.session) {
                // Store both tokens separately
                await this.context.secrets.store(this.SESSION_KEY + '.access', data.session.access_token);
                await this.context.secrets.store(this.SESSION_KEY + '.refresh', data.session.refresh_token);
            }
        } catch (error) {
            console.error('Error saving session:', error);
        }
    }

    /**
     * Clear saved session from storage
     */
    private async clearSession(): Promise<void> {
        try {
            await this.context.secrets.delete(this.SESSION_KEY + '.access');
            await this.context.secrets.delete(this.SESSION_KEY + '.refresh');
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    }
}
