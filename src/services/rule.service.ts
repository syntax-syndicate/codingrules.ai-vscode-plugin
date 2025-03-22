import { SupabaseClient } from '@supabase/supabase-js';
import { Rule, RuleListResponse, RuleSearchParams, Tag, Tool } from '../models/rule.model';
import { Database } from '../types/database.types';
import { Logger } from '../utils/logger';
import { SupabaseService } from './supabase.service';

/**
 * Service for managing rules
 */
export class RuleService {
    private static instance: RuleService;
    private supabaseService: SupabaseService;
    private logger: Logger = Logger.getInstance();

    // Cache for tag and tool rule counts
    private tagRuleCountCache: Map<string, number> = new Map();
    private toolRuleCountCache: Map<string, number> = new Map();

    // Cache for tag and tool preview rules
    private tagPreviewRulesCache: Map<string, Rule[]> = new Map();
    private toolPreviewRulesCache: Map<string, Rule[]> = new Map();

    private constructor() {
        this.supabaseService = SupabaseService.getInstance();
    }

    /**
     * Get singleton instance of RuleService
     */
    public static getInstance(): RuleService {
        if (!RuleService.instance) {
            RuleService.instance = new RuleService();
        }
        return RuleService.instance;
    }

    /**
     * Initialize the Rule service
     */
    public static initialize(): RuleService {
        RuleService.instance = new RuleService();
        return RuleService.instance;
    }

    /**
     * Get a single rule by ID
     */
    public async getRule(id: string): Promise<Rule | null> {
        try {
            return await this.supabaseService.getRule(id);
        } catch (error) {
            this.logger.error('Error fetching rule', error, 'RuleService');
            return null;
        }
    }

    /**
     * Search for rules based on provided parameters
     */
    public async searchRules(params: RuleSearchParams = {}): Promise<RuleListResponse> {
        try {
            return await this.supabaseService.searchRules(params);
        } catch (error) {
            this.logger.error('Error searching rules', error, 'RuleService');
            return { rules: [], count: 0 };
        }
    }

    /**
     * Get all available tags
     */
    public async getTags(): Promise<Tag[]> {
        try {
            return await this.supabaseService.getTags();
        } catch (error) {
            this.logger.error('Error fetching tags', error, 'RuleService');
            return [];
        }
    }

    /**
     * Get all available tools (AI assistants)
     */
    public async getTools(): Promise<Tool[]> {
        try {
            return await this.supabaseService.getTools();
        } catch (error) {
            this.logger.error('Error fetching tools', error, 'RuleService');
            return [];
        }
    }

    /**
     * Get private rules for the current user
     */
    public async getPrivateRules(limit: number = 20): Promise<RuleListResponse> {
        try {
            return await this.supabaseService.getPrivateRules(limit);
        } catch (error) {
            this.logger.error('Error fetching private rules', error, 'RuleService');
            return { rules: [], count: 0 };
        }
    }

    /**
     * Get top upvoted rules
     */
    public async getTopUpvotedRules(limit: number = 20): Promise<RuleListResponse> {
        try {
            return await this.supabaseService.getTopUpvotedRules(limit);
        } catch (error) {
            this.logger.error('Error fetching top upvoted rules', error, 'RuleService');
            return { rules: [], count: 0 };
        }
    }

    /**
     * Get a user profile by ID
     */
    public async getUserProfile(userId: string): Promise<any | null> {
        try {
            return await this.supabaseService.getUserProfile(userId);
        } catch (error) {
            this.logger.error('Error fetching user profile', error, 'RuleService');
            return null;
        }
    }

    /**
     * Get the count of rules associated with a specific tag
     */
    public async getRuleCountForTag(tagId: string): Promise<number> {
        try {
            // Check cache first
            if (this.tagRuleCountCache.has(tagId)) {
                return this.tagRuleCountCache.get(tagId) || 0;
            }

            // Fetch from service
            const count = await this.supabaseService.getRuleCountForTag(tagId);

            // Cache the result
            this.tagRuleCountCache.set(tagId, count);

            return count;
        } catch (error) {
            this.logger.error('Error getting rule count for tag', error, 'RuleService');
            return 0;
        }
    }

    /**
     * Get top rules for a specific tag
     */
    public async getTopRulesForTag(tagId: string, limit: number = 5): Promise<Rule[]> {
        try {
            // Check cache first
            const cacheKey = tagId;
            if (this.tagPreviewRulesCache.has(cacheKey)) {
                return this.tagPreviewRulesCache.get(cacheKey) || [];
            }

            // Fetch from service
            const rules = await this.supabaseService.getTopRulesForTag(tagId, limit);

            // Cache the result
            this.tagPreviewRulesCache.set(cacheKey, rules);

            return rules;
        } catch (error) {
            this.logger.error('Error getting top rules for tag', error, 'RuleService');
            return [];
        }
    }

    /**
     * Get the count of rules associated with a specific tool
     */
    public async getRuleCountForTool(toolId: string): Promise<number> {
        try {
            // Check cache first
            if (this.toolRuleCountCache.has(toolId)) {
                return this.toolRuleCountCache.get(toolId) || 0;
            }

            // Fetch from service
            const count = await this.supabaseService.getRuleCountForTool(toolId);

            // Cache the result
            this.toolRuleCountCache.set(toolId, count);

            return count;
        } catch (error) {
            this.logger.error('Error getting rule count for tool', error, 'RuleService');
            return 0;
        }
    }

    /**
     * Get top rules for a specific tool
     */
    public async getTopRulesForTool(toolId: string, limit: number = 5): Promise<Rule[]> {
        try {
            // Check cache first
            const cacheKey = toolId;
            if (this.toolPreviewRulesCache.has(cacheKey)) {
                return this.toolPreviewRulesCache.get(cacheKey) || [];
            }

            // Fetch from service
            const rules = await this.supabaseService.getTopRulesForTool(toolId, limit);

            // Cache the result
            this.toolPreviewRulesCache.set(cacheKey, rules);

            return rules;
        } catch (error) {
            this.logger.error('Error getting top rules for tool', error, 'RuleService');
            return [];
        }
    }

    /**
     * Clear all caches
     */
    public clearCaches(): void {
        this.tagRuleCountCache.clear();
        this.toolRuleCountCache.clear();
        this.tagPreviewRulesCache.clear();
        this.toolPreviewRulesCache.clear();
    }
}
