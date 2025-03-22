import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Config, SupabaseConfig } from '../config';
import { AuthService } from './auth.service';
import { Rule, RuleListResponse, RuleSearchParams } from '../models/rule.model';
import { Database } from '../types/database.types';
import { Logger } from '../utils/logger';

/**
 * Service for interacting with Supabase API to fetch rules
 */
export class SupabaseService {
    private static instance: SupabaseService;
    private client: SupabaseClient<Database>;
    private authService: AuthService | null = null;
    private logger: Logger = Logger.getInstance();

    private constructor(config: SupabaseConfig) {
        this.client = createClient<Database>(config.url, config.anonKey);

        // Attempt to get the AuthService if it's already initialized
        try {
            this.authService = AuthService.getInstance();
        } catch (e) {
            // AuthService not initialized yet, it will be set later
        }
    }

    /**
     * Get singleton instance of SupabaseService
     */
    public static getInstance(config?: SupabaseConfig): SupabaseService {
        if (!SupabaseService.instance && config) {
            SupabaseService.instance = new SupabaseService(config);
        }

        if (!SupabaseService.instance) {
            throw new Error('SupabaseService not initialized');
        }

        return SupabaseService.instance;
    }

    /**
     * Initialize the Supabase service with configuration
     */
    public static initialize(config: SupabaseConfig): SupabaseService {
        SupabaseService.instance = new SupabaseService(config);
        return SupabaseService.instance;
    }

    /**
     * Set the auth service reference
     */
    public setAuthService(authService: AuthService): void {
        this.authService = authService;
    }

    /**
     * Check if a user is currently authenticated
     */
    public get isAuthenticated(): boolean {
        return this.authService?.isAuthenticated || false;
    }

    /**
     * Get the current authenticated user, if any
     */
    public get currentUser(): User | null {
        return this.authService?.currentUser || null;
    }

    /**
     * Get a single rule by ID
     */
    public async getRule(id: string): Promise<Rule | null> {
        try {
            const { data, error } = await this.client
                .from('rules')
                .select('*, rule_tags(tag_id, tags(*))')
                .eq('id', id)
                .single();

            if (error) {
                throw error;
            }

            return data ? this.transformRuleData(data) : null;
        } catch (error) {
            this.logger.error('Error fetching rule', error, 'SupabaseService');
            return null;
        }
    }

    /**
     * Search for rules based on provided parameters
     */
    public async searchRules(params: RuleSearchParams = {}): Promise<RuleListResponse> {
        try {
            // Ensure auth state is up-to-date before proceeding
            const isUserAuthenticated = this.isAuthenticated;
            const currentUserId = this.currentUser?.id;

            this.logger.debug(
                `Searching rules with auth state: ${isUserAuthenticated ? 'authenticated' : 'not authenticated'}`,
                'SupabaseService',
            );

            // Extract parameters with defaults
            const {
                query = '',
                tags = [],
                tool_id,
                page = 1,
                limit = 20,
                // Include private content if explicitly requested or if user is authenticated
                include_private = isUserAuthenticated,
            } = params;

            let queryBuilder = this.client
                .from('rules')
                .select('*, rule_tags!inner(tag_id, tags!inner(*))', { count: 'exact' });

            // Add filter conditions
            queryBuilder = queryBuilder.eq('is_archived', false).eq('is_active', true);

            // Handle private rules
            if (!include_private) {
                // Only show public rules
                queryBuilder = queryBuilder.eq('is_private', false);
            } else if (currentUserId) {
                // Show both public rules AND private rules owned by the current user
                queryBuilder = queryBuilder.or(
                    `is_private.eq.false, and(is_private.eq.true, author_id.eq.${currentUserId})`,
                );
                this.logger.debug('Including private rules for authenticated user', 'SupabaseService');
            } else {
                // Fallback: only show public rules if authenticated but no user ID (shouldn't happen)
                queryBuilder = queryBuilder.eq('is_private', false);
            }

            // Search by title/content/tags
            if (query) {
                // Use a separate query for searching in tags to avoid syntax errors with nested joins
                let tagRuleIds: string[] = [];

                try {
                    // First, get rule IDs that match the tag search
                    const { data: tagSearchData } = await this.client
                        .from('rule_tags')
                        .select('rule_id, tags!inner(*)')
                        .ilike('tags.name', `%${query}%`);

                    if (tagSearchData && tagSearchData.length > 0) {
                        tagRuleIds = tagSearchData.map((item) => item.rule_id);
                    }
                } catch (tagError) {
                    this.logger.error('Error searching tags', tagError, 'SupabaseService');
                }

                // Now build the main search query
                const searchConditions = [];

                // Add title and content search
                searchConditions.push(`title.ilike.%${query}%`);
                searchConditions.push(`content.ilike.%${query}%`);

                // Add tag search if we found matching tags
                if (tagRuleIds.length > 0) {
                    searchConditions.push(`id.in.(${tagRuleIds.join(',')})`);
                }

                // Combine all conditions with OR
                queryBuilder = queryBuilder.or(searchConditions.join(','));
            }

            // Filter by tags if provided
            if (tags.length > 0) {
                queryBuilder = queryBuilder.in('rule_tags.tag_id', tags);
            }

            // Filter by tool if provided
            if (tool_id) {
                queryBuilder = queryBuilder.eq('tool_id', tool_id);
            }

            // Paginate the results
            const from = (page - 1) * limit;
            const to = page * limit - 1;
            queryBuilder = queryBuilder.range(from, to);

            // Add order by
            queryBuilder = queryBuilder.order('created_at', { ascending: false });

            // Execute the query
            const { data, count, error } = await queryBuilder;

            if (error) {
                this.logger.error('Supabase returned error', error, 'SupabaseService');
                throw error;
            }

            return {
                rules: data ? data.map((item) => this.transformRuleData(item)) : [],
                count: count || 0,
            };
        } catch (error) {
            this.logger.error('Error searching rules', error, 'SupabaseService');
            return { rules: [], count: 0 };
        }
    }

    /**
     * Get all available tags
     */
    public async getTags() {
        try {
            // Ensure auth state is up-to-date before proceeding
            const isUserAuthenticated = this.isAuthenticated;
            const currentUserId = this.currentUser?.id;

            this.logger.debug(
                `Fetching tags with auth state: ${isUserAuthenticated ? 'authenticated' : 'not authenticated'}`,
                'SupabaseService',
            );

            let queryBuilder = this.client.from('tags').select('*');

            // Add filter conditions
            queryBuilder = queryBuilder.eq('is_archived', false);

            // Handle private tags
            if (!isUserAuthenticated) {
                // Only show public tags
                queryBuilder = queryBuilder.eq('is_private', false);
            } else if (currentUserId) {
                // Show both public tags AND private tags owned by the current user
                queryBuilder = queryBuilder.or(
                    `is_private.eq.false, and(is_private.eq.true, created_by.eq.${currentUserId})`,
                );
                this.logger.debug('Including private tags for authenticated user', 'SupabaseService');
            } else {
                // Fallback: only show public tags if authenticated but no user ID (shouldn't happen)
                queryBuilder = queryBuilder.eq('is_private', false);
            }

            // Execute the query
            const { data, error } = await queryBuilder;

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            this.logger.error('Error fetching tags', error, 'SupabaseService');
            return [];
        }
    }

    /**
     * Get all available tools (AI assistants)
     */
    public async getTools() {
        try {
            // Ensure auth state is up-to-date before proceeding
            const isUserAuthenticated = this.isAuthenticated;
            const currentUserId = this.currentUser?.id;

            this.logger.debug(
                `Fetching tools with auth state: ${isUserAuthenticated ? 'authenticated' : 'not authenticated'}`,
                'SupabaseService',
            );

            let queryBuilder = this.client.from('tools').select('*');

            // Add filter conditions
            queryBuilder = queryBuilder.eq('is_archived', false);

            // Handle private tools
            if (!isUserAuthenticated) {
                // Only show public tools
                queryBuilder = queryBuilder.eq('is_private', false);
            } else if (currentUserId) {
                // Show both public tools AND private tools owned by the current user
                queryBuilder = queryBuilder.or(
                    `is_private.eq.false, and(is_private.eq.true, created_by.eq.${currentUserId})`,
                );
                this.logger.debug('Including private tools for authenticated user', 'SupabaseService');
            } else {
                // Fallback: only show public tools if authenticated but no user ID (shouldn't happen)
                queryBuilder = queryBuilder.eq('is_private', false);
            }

            // Execute the query
            const { data, error } = await queryBuilder;

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            this.logger.error('Error fetching tools', error, 'SupabaseService');
            return [];
        }
    }

    /**
     * Get top upvoted rules
     */
    public async getTopUpvotedRules(limit: number = 20): Promise<RuleListResponse> {
        try {
            // Ensure auth state is up-to-date before proceeding
            const isUserAuthenticated = this.isAuthenticated;
            const currentUserId = this.currentUser?.id;

            this.logger.debug(
                `Fetching top upvoted rules with auth state: ${isUserAuthenticated ? 'authenticated' : 'not authenticated'}`,
                'SupabaseService',
            );

            let queryBuilder = this.client.from('rules').select('*, rule_tags(tag_id, tags(*))', { count: 'exact' });

            // Add filter conditions
            queryBuilder = queryBuilder.eq('is_archived', false).eq('is_active', true);

            // Handle private rules
            if (!isUserAuthenticated) {
                // Only show public rules
                queryBuilder = queryBuilder.eq('is_private', false);
            } else if (currentUserId) {
                // Show both public rules AND private rules owned by the current user
                queryBuilder = queryBuilder.or(
                    `is_private.eq.false, and(is_private.eq.true, author_id.eq.${currentUserId})`,
                );
                this.logger.debug('Including private rules for authenticated user', 'SupabaseService');
            } else {
                // Fallback: only show public rules if authenticated but no user ID (shouldn't happen)
                queryBuilder = queryBuilder.eq('is_private', false);
            }

            // Order by upvotes and limit
            queryBuilder = queryBuilder.order('upvote_count', { ascending: false }).limit(limit);

            // Execute the query
            const { data, count, error } = await queryBuilder;

            if (error) {
                this.logger.error('Supabase returned error', error, 'SupabaseService');
                throw error;
            }

            return {
                rules: data ? data.map((item) => this.transformRuleData(item)) : [],
                count: count || 0,
            };
        } catch (error) {
            this.logger.error('Error fetching top upvoted rules', error, 'SupabaseService');
            return { rules: [], count: 0 };
        }
    }

    /**
     * Transform raw database data into Rule object
     */
    private transformRuleData(data: any): Rule {
        // Extract tags from rule_tags join
        const tags = data.rule_tags
            ? data.rule_tags
                  .filter((rt: any) => rt.tags)
                  .map((rt: any) => rt.tags)
                  .filter(Boolean)
            : [];

        // Extract required fields and ensure content is defined
        if (data.content === undefined) {
            this.logger.warn(`Rule ${data.id} (${data.title}) has undefined content`, 'SupabaseService');
            data.content = ''; // Provide default value
        }

        return {
            id: data.id,
            title: data.title,
            content: data.content,
            author_id: data.author_id,
            slug: data.slug,
            created_at: data.created_at,
            updated_at: data.updated_at,
            is_private: data.is_private,
            is_archived: data.is_archived,
            is_active: data.is_active,
            upvote_count: data.upvote_count,
            tool_id: data.tool_id,
            tags,
        };
    }

    /**
     * Format and throw error
     */
    private handleError(error: any): never {
        let message: string;

        try {
            if (error instanceof Error) {
                message = error.message;
            } else if (typeof error === 'object' && error !== null) {
                message = JSON.stringify(error);
            } else {
                message = String(error);
            }
        } catch (formatError) {
            this.logger.error('Error while formatting error message', formatError, 'SupabaseService');
            this.logger.error('Original error', error, 'SupabaseService');
            message = 'Unknown error occurred';
        }

        throw new Error(`Supabase API error: ${message}`);
    }

    /**
     * Get a user profile by ID
     */
    public async getUserProfile(userId: string): Promise<any | null> {
        try {
            const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).single();

            if (error) {
                throw error;
            }

            return data || null;
        } catch (error) {
            this.logger.error('Error fetching user profile', error, 'SupabaseService');
            return null;
        }
    }
}
