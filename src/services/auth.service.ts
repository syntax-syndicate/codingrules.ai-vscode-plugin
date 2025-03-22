import * as vscode from 'vscode';
import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { SupabaseConfig } from '../config';
import { Database } from '../types/database.types';
import { Logger } from '../utils/logger';

/**
 * Service for handling authentication with Supabase
 */
export class AuthService {
    private static instance: AuthService;
    private client: SupabaseClient<Database>;
    private context: vscode.ExtensionContext;
    private _currentUser: User | null = null;
    private logger: Logger = Logger.getInstance();

    private constructor(config: SupabaseConfig, context: vscode.ExtensionContext) {
        this.client = createClient<Database>(config.url, config.anonKey);
        this.context = context;

        // Set up auth state change listener
        this.client.auth.onAuthStateChange(async (event, session) => {
            try {
                if (event === 'SIGNED_IN' && session) {
                    this._currentUser = session.user;
                    await this.saveSession(session);
                    this.logger.info('User signed in', 'AuthService');
                } else if (event === 'SIGNED_OUT') {
                    this._currentUser = null;
                    await this.clearSession();
                    this.logger.info('User signed out', 'AuthService');
                }
            } catch (error) {
                this.logger.error('Error handling auth state change', error, 'AuthService');
            }
        });
    }

    /**
     * Get the current authenticated user, if any
     */
    public get currentUser(): User | null {
        return this._currentUser;
    }

    /**
     * Check if a user is currently authenticated
     */
    public get isAuthenticated(): boolean {
        return this._currentUser !== null;
    }

    /**
     * Get singleton instance of AuthService
     */
    public static getInstance(): AuthService {
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

        try {
            // Attempt to restore session on startup
            await AuthService.instance.restoreSession();
        } catch (error) {
            AuthService.instance.logger.error('Error initializing session', error, 'AuthService');
        }

        return AuthService.instance;
    }

    /**
     * Refresh the current user's data
     */
    public async refreshCurrentUser(): Promise<void> {
        try {
            const { data, error } = await this.client.auth.getUser();

            if (error) {
                throw error;
            }

            if (data && data.user) {
                this._currentUser = data.user;
                this.logger.debug('Current user refreshed', 'AuthService');
            } else {
                this._currentUser = null;
                this.logger.info('No user session found during refresh', 'AuthService');
            }
        } catch (error) {
            this.logger.error('Error refreshing user', error, 'AuthService');
            // On refresh error, clear the current user
            this._currentUser = null;
        }
    }

    /**
     * Sign out the current user
     */
    public async signOut(): Promise<void> {
        try {
            const { error } = await this.client.auth.signOut();

            if (error) {
                throw error;
            }

            this._currentUser = null;
            await this.clearSession();
            this.logger.info('User signed out successfully', 'AuthService');
        } catch (error) {
            this.logger.error('Logout error', error, 'AuthService');
            throw error;
        }
    }

    /**
     * Set the session from external tokens (used for extension auth flow)
     */
    public async setSessionFromTokens(accessToken: string, refreshToken: string): Promise<void> {
        try {
            const { data, error } = await this.client.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
            });

            if (error) {
                throw error;
            }

            if (data && data.user) {
                this._currentUser = data.user;

                if (data.session) {
                    await this.saveSession(data.session);
                }

                this.logger.info('Session set from tokens', 'AuthService');
            }
        } catch (error) {
            this.logger.error('Error setting session from tokens', error, 'AuthService');
            throw error;
        }
    }

    /**
     * Restore session from storage
     */
    private async restoreSession(): Promise<void> {
        try {
            const session = await this.loadSession();

            if (session) {
                this.logger.debug('Found saved session, attempting to restore', 'AuthService');
                await this.setSessionFromTokens(session.access_token, session.refresh_token);
            } else {
                this.logger.debug('No saved session found', 'AuthService');
            }
        } catch (error) {
            this.logger.error('Error restoring session', error, 'AuthService');
            throw error;
        }
    }

    /**
     * Load session from storage
     */
    private async loadSession(): Promise<Session | null> {
        try {
            const sessionData = this.context.globalState.get<string>('codingrules.authSession');

            if (!sessionData) {
                return null;
            }

            return JSON.parse(sessionData) as Session;
        } catch (error) {
            this.logger.error('Error loading session', error, 'AuthService');
            return null;
        }
    }

    /**
     * Save session to storage
     */
    private async saveSession(session: Session): Promise<void> {
        try {
            const sessionData = JSON.stringify(session);
            await this.context.globalState.update('codingrules.authSession', sessionData);
        } catch (error) {
            this.logger.error('Error saving session', error, 'AuthService');
            throw error;
        }
    }

    /**
     * Clear session from storage
     */
    private async clearSession(): Promise<void> {
        try {
            await this.context.globalState.update('codingrules.authSession', undefined);
        } catch (error) {
            this.logger.error('Error clearing session', error, 'AuthService');
            throw error;
        }
    }
}
