import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Config, SupabaseConfig } from '../config';
import { Rule, RuleListResponse, RuleSearchParams } from '../models/rule.model';
import { Database } from '../types/database.types';

/**
 * Service for interacting with Supabase API to fetch rules
 */
export class SupabaseService {
    private static instance: SupabaseService;
    private client: SupabaseClient<Database>;

    private constructor(config: SupabaseConfig) {
        this.client = createClient<Database>(config.url, config.anonKey);
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
            console.error('Error fetching rule:', error);
            return this.handleError(error);
        }
    }

    /**
     * Search for rules based on provided parameters
     */
    public async searchRules(params: RuleSearchParams = {}): Promise<RuleListResponse> {
        try {
            const { query = '', tags = [], tool_id, page = 1, limit = 20, include_private = false } = params;

            console.log('Executing searchRules with query:', query);

            let queryBuilder = this.client
                .from('rules')
                .select('*, rule_tags!inner(tag_id, tags!inner(*))', { count: 'exact' });

            // Add filter conditions
            queryBuilder = queryBuilder.eq('is_archived', false).eq('is_active', true);

            // Handle private rules
            if (!include_private) {
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
                        tagRuleIds = tagSearchData.map(item => item.rule_id);
                        console.log(`Found ${tagRuleIds.length} rules matching tag search for: ${query}`);
                    }
                } catch (tagError) {
                    console.error('Error searching tags:', tagError);
                    // Continue with main search even if tag search fails
                }
                
                // Search in main table (title, content)
                // Plus include rules that matched by tag (if any)
                if (tagRuleIds.length > 0) {
                    queryBuilder = queryBuilder.or(
                        `title.ilike.%${query}%,content.ilike.%${query}%,id.in.(${tagRuleIds.join(',')})`
                    );
                } else {
                    queryBuilder = queryBuilder.or(
                        `title.ilike.%${query}%,content.ilike.%${query}%`
                    );
                }
            }

            // Filter by tool
            if (tool_id) {
                queryBuilder = queryBuilder.eq('tool_id', tool_id);
            }

            // Filter by tags
            if (tags.length > 0) {
                queryBuilder = queryBuilder.in('rule_tags.tag_id', tags);
            }

            // Pagination
            const from = (page - 1) * limit;
            const to = from + limit - 1;
            queryBuilder = queryBuilder.range(from, to);

            const { data, error, count } = await queryBuilder;

            if (error) {
                console.error('Supabase returned error:', error);
                throw error;
            }

            console.log(`Found ${count || 0} rules matching criteria`);

            return {
                rules: data ? data.map(this.transformRuleData) : [],
                count: count || 0,
            };
        } catch (error) {
            console.error('Error searching rules:', error);
            return this.handleError(error);
        }
    }

    /**
     * Get available tags
     */
    public async getTags() {
        try {
            const { data, error } = await this.client
                .from('tags')
                .select('*')
                .eq('is_archived', false)
                .eq('is_private', false);

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching tags:', error);
            return this.handleError(error);
        }
    }

    /**
     * Get available tools
     */
    public async getTools() {
        try {
            const { data, error } = await this.client
                .from('tools')
                .select('*')
                .eq('is_archived', false)
                .eq('is_private', false);

            if (error) {
                throw error;
            }

            return data || [];
        } catch (error) {
            console.error('Error fetching tools:', error);
            return this.handleError(error);
        }
    }

    /**
     * Get top upvoted rules
     */
    public async getTopUpvotedRules(limit: number = 20): Promise<RuleListResponse> {
        try {
            console.log('Fetching top upvoted rules');

            const queryBuilder = this.client
                .from('rules')
                .select('*, rule_tags!inner(tag_id, tags!inner(*))', { count: 'exact' })
                .eq('is_archived', false)
                .eq('is_active', true)
                .eq('is_private', false)
                .order('upvote_count', { ascending: false })
                .limit(limit);

            const { data, error, count } = await queryBuilder;

            if (error) {
                console.error('Supabase returned error:', error);
                throw error;
            }

            console.log(`Found ${count || 0} top upvoted rules`);

            return {
                rules: data ? data.map(this.transformRuleData) : [],
                count: count || 0,
            };
        } catch (error) {
            console.error('Error fetching top upvoted rules:', error);
            return this.handleError(error);
        }
    }

    /**
     * Transform rule data from database to application model
     */
    private transformRuleData(data: any): Rule {
        // Extract tags from rule_tags join
        const tags = data.rule_tags?.map((rt: any) => rt.tags) || [];

        // Ensure content is never undefined
        if (data.content === undefined) {
            console.warn(`Rule ${data.id} (${data.title}) has undefined content`);
        }

        return {
            id: data.id,
            title: data.title,
            content: data.content || '', // Provide empty string as fallback
            author_id: data.author_id,
            slug: data.slug,
            created_at: data.created_at,
            updated_at: data.updated_at,
            is_private: data.is_private,
            is_archived: data.is_archived,
            is_active: data.is_active,
            upvote_count: data.upvote_count || 0,
            tool_id: data.tool_id,
            tags,
        };
    }

    /**
     * Handle errors from Supabase API and provide better error messages
     */
    private handleError(error: any): never {
        if (error instanceof Error) {
            // Standard error object
            throw error;
        } else if (error && typeof error === 'object') {
            // Try to extract specific Supabase error information
            try {
                const errorObject = error as Record<string, any>;

                // Check for Supabase PostgreSQL error format
                if (errorObject.code && errorObject.message) {
                    throw new Error(`Database error (${errorObject.code}): ${errorObject.message}`);
                }

                // Check for Supabase error object format
                if (errorObject.error && typeof errorObject.error === 'object') {
                    const supabaseError = errorObject.error as Record<string, any>;
                    const message = supabaseError.message || 'Unknown error';
                    const details = supabaseError.details || '';
                    throw new Error(`Supabase error: ${message}${details ? ` (${details})` : ''}`);
                }

                // More generic error handling
                if (errorObject.message) {
                    throw new Error(`API error: ${errorObject.message}`);
                }

                // Fallback to JSON stringifying the error
                throw new Error(`Database error: ${JSON.stringify(error)}`);
            } catch (formatError) {
                // If JSON stringify fails or any other error occurs during formatting
                console.error('Error while formatting error message:', formatError);
                console.error('Original error:', error);
                throw new Error(`Database error: ${error.message || 'Unknown error'}`);
            }
        } else {
            // Completely generic error
            throw new Error(`Unknown error occurred: ${String(error)}`);
        }
    }
}
