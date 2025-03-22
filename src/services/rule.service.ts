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
}
