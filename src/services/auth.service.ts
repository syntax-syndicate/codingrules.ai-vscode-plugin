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
    private refreshTimer: NodeJS.Timeout | null = null;
    private readonly REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes in milliseconds

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

            // Start background refresh if authenticated
            if (AuthService.instance.isAuthenticated) {
                AuthService.instance.startBackgroundRefresh();
            }
        } catch (error) {
            AuthService.instance.logger.error('Error initializing session', error, 'AuthService');
        }

        return AuthService.instance;
    }

    /**
     * Start background token refresh
     * This ensures tokens are refreshed before they expire during long sessions
     */
    public startBackgroundRefresh(): void {
        // Clear any existing timer first
        this.stopBackgroundRefresh();

        this.logger.info('Starting background token refresh timer', 'AuthService');

        // Set up a timer to refresh the token periodically
        this.refreshTimer = setInterval(async () => {
            try {
                this.logger.debug('Background token refresh triggered', 'AuthService');
                await this.refreshToken();
            } catch (error) {
                this.logger.error('Background token refresh failed', error, 'AuthService');
            }
        }, this.REFRESH_INTERVAL);
    }

    /**
     * Stop background token refresh
     */
    public stopBackgroundRefresh(): void {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            this.logger.info('Stopped background token refresh timer', 'AuthService');
        }
    }

    /**
     * Refresh the current user's data and session
     */
    public async refreshCurrentUser(): Promise<void> {
        try {
            // Get the full session to ensure we have the JWT token
            const { data: sessionData, error: sessionError } = await this.client.auth.getSession();

            if (sessionError) {
                throw sessionError;
            }

            const session = sessionData?.session;
            if (session && session.user) {
                this._currentUser = session.user;

                // Save the session to ensure we have the latest token
                await this.saveSession(session);

                this.logger.info(`Current user refreshed - ID: ${session.user.id}`, 'AuthService');
                this.logger.info(`Session refreshed - Token exists: ${!!session.access_token}`, 'AuthService');
            } else {
                // Fallback to getUser if session is null
                const { data, error } = await this.client.auth.getUser();

                if (error) {
                    throw error;
                }

                if (data && data.user) {
                    this._currentUser = data.user;
                    this.logger.info(`Current user refreshed (no session) - ID: ${data.user.id}`, 'AuthService');
                } else {
                    this._currentUser = null;
                    this.logger.info('No user session found during refresh', 'AuthService');
                }
            }
        } catch (error) {
            this.logger.error('Error refreshing user', error, 'AuthService');
            // On refresh error, clear the current user
            this._currentUser = null;
        }
    }

    /**
     * Get the current session
     */
    public async getCurrentSession(): Promise<Session | null> {
        try {
            // First try to load from storage for performance
            const storedSession = await this.loadSession();
            if (storedSession) {
                return storedSession;
            }

            // Otherwise fetch from API
            const { data, error } = await this.client.auth.getSession();

            if (error) {
                throw error;
            }

            return data.session;
        } catch (error) {
            this.logger.error('Error getting current session', error, 'AuthService');
            return null;
        }
    }

    /**
     * Get the current access token
     */
    public async getAccessToken(): Promise<string | null> {
        const session = await this.getCurrentSession();
        return session?.access_token || null;
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
            // Add timestamp to help with token expiration checks
            const enhancedSession = {
                ...session,
                stored_at: new Date().getTime(),
            };

            const sessionData = JSON.stringify(enhancedSession);

            // Log token debug info (partial token for security)
            const tokenPreview = session.access_token ? `${session.access_token.substring(0, 10)}...` : 'null';
            this.logger.info(`Saving session token: ${tokenPreview}`, 'AuthService');

            // Save to global state
            await this.context.globalState.update('codingrules.authSession', sessionData);

            // Verify it was saved correctly
            const verifySession = await this.loadSession();
            if (!verifySession || !verifySession.access_token) {
                this.logger.warn('Session verification failed - token may not be saved correctly', 'AuthService');
            }
        } catch (error) {
            this.logger.error('Error saving session', error, 'AuthService');
            throw error;
        }
    }

    /**
     * Force token refresh to handle expired tokens
     */
    public async refreshToken(): Promise<Session | null> {
        try {
            // Get current session
            const session = await this.loadSession();

            if (!session || !session.refresh_token) {
                this.logger.warn('No refresh token available to refresh session', 'AuthService');
                return null;
            }

            // Check if we need to refresh (refresh if token is older than 50 minutes)
            const storedAt = (session as any).stored_at || 0;
            const ageInMs = Date.now() - storedAt;
            const needsRefresh = ageInMs > 50 * 60 * 1000; // 50 minutes

            if (needsRefresh) {
                this.logger.info('Token is stale, attempting refresh', 'AuthService');

                // Attempt to refresh the session
                const { data, error } = await this.client.auth.refreshSession({
                    refresh_token: session.refresh_token,
                });

                if (error) {
                    this.logger.error('Failed to refresh token', error, 'AuthService');
                    return null;
                }

                if (data.session) {
                    // Update the user and save the refreshed session
                    this._currentUser = data.session.user;
                    await this.saveSession(data.session);
                    this.logger.info('Token successfully refreshed', 'AuthService');
                    return data.session;
                }
            } else {
                // Use existing session
                return session;
            }

            return null;
        } catch (error) {
            this.logger.error('Error refreshing token', error, 'AuthService');
            return null;
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
