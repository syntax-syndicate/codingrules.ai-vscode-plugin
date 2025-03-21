export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
    public: {
        Tables: {
            failed_vectorizations: {
                Row: {
                    attempts: number | null;
                    content_length: number;
                    error_message: string;
                    last_attempt: string;
                    rule_id: string;
                };
                Insert: {
                    attempts?: number | null;
                    content_length: number;
                    error_message: string;
                    last_attempt: string;
                    rule_id: string;
                };
                Update: {
                    attempts?: number | null;
                    content_length?: number;
                    error_message?: string;
                    last_attempt?: string;
                    rule_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'failed_vectorizations_rule_id_fkey';
                        columns: ['rule_id'];
                        isOneToOne: true;
                        referencedRelation: 'rules';
                        referencedColumns: ['id'];
                    },
                ];
            };
            mcp_server_reports: {
                Row: {
                    created_at: string;
                    description: string;
                    feedback: string | null;
                    id: string;
                    reason: string;
                    reporter_id: string | null;
                    reviewed_by: string | null;
                    server_id: string | null;
                    status: string | null;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    description: string;
                    feedback?: string | null;
                    id?: string;
                    reason: string;
                    reporter_id?: string | null;
                    reviewed_by?: string | null;
                    server_id?: string | null;
                    status?: string | null;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    description?: string;
                    feedback?: string | null;
                    id?: string;
                    reason?: string;
                    reporter_id?: string | null;
                    reviewed_by?: string | null;
                    server_id?: string | null;
                    status?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'mcp_server_reports_server_id_fkey';
                        columns: ['server_id'];
                        isOneToOne: false;
                        referencedRelation: 'mcp_servers';
                        referencedColumns: ['id'];
                    },
                ];
            };
            mcp_server_suggestions: {
                Row: {
                    author_id: string;
                    created_at: string;
                    description: string;
                    feedback: string | null;
                    id: string;
                    logo_url: string | null;
                    name: string;
                    repo_url: string;
                    reviewed_by: string | null;
                    status: string | null;
                    suggested_by: string | null;
                    updated_at: string;
                };
                Insert: {
                    author_id: string;
                    created_at?: string;
                    description: string;
                    feedback?: string | null;
                    id?: string;
                    logo_url?: string | null;
                    name: string;
                    repo_url: string;
                    reviewed_by?: string | null;
                    status?: string | null;
                    suggested_by?: string | null;
                    updated_at?: string;
                };
                Update: {
                    author_id?: string;
                    created_at?: string;
                    description?: string;
                    feedback?: string | null;
                    id?: string;
                    logo_url?: string | null;
                    name?: string;
                    repo_url?: string;
                    reviewed_by?: string | null;
                    status?: string | null;
                    suggested_by?: string | null;
                    updated_at?: string;
                };
                Relationships: [];
            };
            mcp_server_update_suggestions: {
                Row: {
                    author_id: string;
                    created_at: string;
                    description: string;
                    feedback: string | null;
                    id: string;
                    logo_url: string | null;
                    name: string;
                    original_author_id: string;
                    original_description: string;
                    original_logo_url: string | null;
                    original_name: string;
                    original_repo_url: string;
                    repo_url: string;
                    reviewed_by: string | null;
                    server_id: string | null;
                    status: string | null;
                    suggested_by: string | null;
                    updated_at: string;
                };
                Insert: {
                    author_id: string;
                    created_at?: string;
                    description: string;
                    feedback?: string | null;
                    id?: string;
                    logo_url?: string | null;
                    name: string;
                    original_author_id: string;
                    original_description: string;
                    original_logo_url?: string | null;
                    original_name: string;
                    original_repo_url: string;
                    repo_url: string;
                    reviewed_by?: string | null;
                    server_id?: string | null;
                    status?: string | null;
                    suggested_by?: string | null;
                    updated_at?: string;
                };
                Update: {
                    author_id?: string;
                    created_at?: string;
                    description?: string;
                    feedback?: string | null;
                    id?: string;
                    logo_url?: string | null;
                    name?: string;
                    original_author_id?: string;
                    original_description?: string;
                    original_logo_url?: string | null;
                    original_name?: string;
                    original_repo_url?: string;
                    repo_url?: string;
                    reviewed_by?: string | null;
                    server_id?: string | null;
                    status?: string | null;
                    suggested_by?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'mcp_server_update_suggestions_server_id_fkey';
                        columns: ['server_id'];
                        isOneToOne: false;
                        referencedRelation: 'mcp_servers';
                        referencedColumns: ['id'];
                    },
                ];
            };
            mcp_server_votes: {
                Row: {
                    created_at: string;
                    id: string;
                    server_id: string | null;
                    user_id: string | null;
                    vote_type: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    server_id?: string | null;
                    user_id?: string | null;
                    vote_type: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    server_id?: string | null;
                    user_id?: string | null;
                    vote_type?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'mcp_server_votes_server_id_fkey';
                        columns: ['server_id'];
                        isOneToOne: false;
                        referencedRelation: 'mcp_servers';
                        referencedColumns: ['id'];
                    },
                ];
            };
            mcp_servers: {
                Row: {
                    author_id: string;
                    created_at: string;
                    description: string;
                    id: string;
                    is_archived: boolean;
                    is_private: boolean;
                    logo_url: string | null;
                    name: string;
                    repo_url: string;
                    slug: string;
                    updated_at: string;
                    votes: number | null;
                };
                Insert: {
                    author_id: string;
                    created_at?: string;
                    description: string;
                    id?: string;
                    is_archived?: boolean;
                    is_private?: boolean;
                    logo_url?: string | null;
                    name: string;
                    repo_url: string;
                    slug: string;
                    updated_at?: string;
                    votes?: number | null;
                };
                Update: {
                    author_id?: string;
                    created_at?: string;
                    description?: string;
                    id?: string;
                    is_archived?: boolean;
                    is_private?: boolean;
                    logo_url?: string | null;
                    name?: string;
                    repo_url?: string;
                    slug?: string;
                    updated_at?: string;
                    votes?: number | null;
                };
                Relationships: [];
            };
            notifications: {
                Row: {
                    created_at: string;
                    data: Json;
                    id: string;
                    read: boolean;
                    type: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    data: Json;
                    id?: string;
                    read?: boolean;
                    type: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    data?: Json;
                    id?: string;
                    read?: boolean;
                    type?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            private_content_limits: {
                Row: {
                    item_limit: number;
                    tier: string;
                };
                Insert: {
                    item_limit: number;
                    tier: string;
                };
                Update: {
                    item_limit?: number;
                    tier?: string;
                };
                Relationships: [];
            };
            profiles: {
                Row: {
                    avatar_url: string | null;
                    contribution_count: number | null;
                    created_at: string;
                    id: string;
                    is_active: boolean;
                    private_mcp_servers_count: number;
                    private_rules_count: number;
                    private_tags_count: number;
                    private_tools_count: number;
                    role: string;
                    updated_at: string;
                    username: string;
                };
                Insert: {
                    avatar_url?: string | null;
                    contribution_count?: number | null;
                    created_at?: string;
                    id: string;
                    is_active?: boolean;
                    private_mcp_servers_count?: number;
                    private_rules_count?: number;
                    private_tags_count?: number;
                    private_tools_count?: number;
                    role?: string;
                    updated_at?: string;
                    username: string;
                };
                Update: {
                    avatar_url?: string | null;
                    contribution_count?: number | null;
                    created_at?: string;
                    id?: string;
                    is_active?: boolean;
                    private_mcp_servers_count?: number;
                    private_rules_count?: number;
                    private_tags_count?: number;
                    private_tools_count?: number;
                    role?: string;
                    updated_at?: string;
                    username?: string;
                };
                Relationships: [];
            };
            rule_favorites: {
                Row: {
                    collection: string | null;
                    created_at: string;
                    id: string;
                    rule_id: string;
                    user_id: string;
                };
                Insert: {
                    collection?: string | null;
                    created_at?: string;
                    id?: string;
                    rule_id: string;
                    user_id: string;
                };
                Update: {
                    collection?: string | null;
                    created_at?: string;
                    id?: string;
                    rule_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_favorites_rule_id_fkey';
                        columns: ['rule_id'];
                        isOneToOne: false;
                        referencedRelation: 'rules';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_favorites_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rule_reports: {
                Row: {
                    created_at: string;
                    description: string | null;
                    feedback: string | null;
                    id: string;
                    reason: string;
                    reporter_id: string;
                    reviewed_by: string | null;
                    rule_id: string;
                    status: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    description?: string | null;
                    feedback?: string | null;
                    id?: string;
                    reason: string;
                    reporter_id: string;
                    reviewed_by?: string | null;
                    rule_id: string;
                    status?: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    description?: string | null;
                    feedback?: string | null;
                    id?: string;
                    reason?: string;
                    reporter_id?: string;
                    reviewed_by?: string | null;
                    rule_id?: string;
                    status?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_reports_reporter_id_fkey';
                        columns: ['reporter_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_reports_reviewed_by_fkey';
                        columns: ['reviewed_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_reports_rule_id_fkey';
                        columns: ['rule_id'];
                        isOneToOne: false;
                        referencedRelation: 'rules';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rule_suggestion_tags: {
                Row: {
                    created_at: string;
                    id: string;
                    rule_suggestion_id: string;
                    tag_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    rule_suggestion_id: string;
                    tag_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    rule_suggestion_id?: string;
                    tag_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_suggestion_tags_rule_suggestion_id_fkey';
                        columns: ['rule_suggestion_id'];
                        isOneToOne: false;
                        referencedRelation: 'rule_suggestions';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_suggestion_tags_tag_id_fkey';
                        columns: ['tag_id'];
                        isOneToOne: false;
                        referencedRelation: 'tags';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rule_suggestions: {
                Row: {
                    author_id: string;
                    content: string;
                    created_at: string;
                    feedback: string | null;
                    id: string;
                    moderation_id: string | null;
                    moderation_results: Json | null;
                    reviewed_by: string | null;
                    status: string;
                    title: string;
                    tool_id: string | null;
                    updated_at: string;
                };
                Insert: {
                    author_id: string;
                    content: string;
                    created_at?: string;
                    feedback?: string | null;
                    id?: string;
                    moderation_id?: string | null;
                    moderation_results?: Json | null;
                    reviewed_by?: string | null;
                    status?: string;
                    title: string;
                    tool_id?: string | null;
                    updated_at?: string;
                };
                Update: {
                    author_id?: string;
                    content?: string;
                    created_at?: string;
                    feedback?: string | null;
                    id?: string;
                    moderation_id?: string | null;
                    moderation_results?: Json | null;
                    reviewed_by?: string | null;
                    status?: string;
                    title?: string;
                    tool_id?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_suggestions_author_id_fkey';
                        columns: ['author_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_suggestions_reviewed_by_fkey';
                        columns: ['reviewed_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_suggestions_tool_id_fkey';
                        columns: ['tool_id'];
                        isOneToOne: false;
                        referencedRelation: 'tools';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rule_tags: {
                Row: {
                    created_at: string;
                    id: string;
                    rule_id: string;
                    tag_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    rule_id: string;
                    tag_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    rule_id?: string;
                    tag_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_tags_rule_id_fkey';
                        columns: ['rule_id'];
                        isOneToOne: false;
                        referencedRelation: 'rules';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_tags_tag_id_fkey';
                        columns: ['tag_id'];
                        isOneToOne: false;
                        referencedRelation: 'tags';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rule_update_suggestion_tags: {
                Row: {
                    created_at: string;
                    id: string;
                    rule_update_suggestion_id: string;
                    tag_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    rule_update_suggestion_id: string;
                    tag_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    rule_update_suggestion_id?: string;
                    tag_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_update_suggestion_tags_rule_update_suggestion_id_fkey';
                        columns: ['rule_update_suggestion_id'];
                        isOneToOne: false;
                        referencedRelation: 'rule_update_suggestions';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_update_suggestion_tags_tag_id_fkey';
                        columns: ['tag_id'];
                        isOneToOne: false;
                        referencedRelation: 'tags';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rule_update_suggestions: {
                Row: {
                    author_id: string;
                    content: string;
                    created_at: string;
                    feedback: string | null;
                    id: string;
                    is_private: boolean;
                    moderation_id: string | null;
                    moderation_results: Json | null;
                    original_content: string | null;
                    original_is_private: boolean;
                    original_title: string | null;
                    original_tool_id: string | null;
                    reviewed_by: string | null;
                    rule_id: string;
                    status: string;
                    title: string;
                    tool_id: string | null;
                    updated_at: string;
                };
                Insert: {
                    author_id: string;
                    content: string;
                    created_at?: string;
                    feedback?: string | null;
                    id?: string;
                    is_private?: boolean;
                    moderation_id?: string | null;
                    moderation_results?: Json | null;
                    original_content?: string | null;
                    original_is_private?: boolean;
                    original_title?: string | null;
                    original_tool_id?: string | null;
                    reviewed_by?: string | null;
                    rule_id: string;
                    status?: string;
                    title: string;
                    tool_id?: string | null;
                    updated_at?: string;
                };
                Update: {
                    author_id?: string;
                    content?: string;
                    created_at?: string;
                    feedback?: string | null;
                    id?: string;
                    is_private?: boolean;
                    moderation_id?: string | null;
                    moderation_results?: Json | null;
                    original_content?: string | null;
                    original_is_private?: boolean;
                    original_title?: string | null;
                    original_tool_id?: string | null;
                    reviewed_by?: string | null;
                    rule_id?: string;
                    status?: string;
                    title?: string;
                    tool_id?: string | null;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_update_suggestions_author_id_fkey';
                        columns: ['author_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_update_suggestions_reviewed_by_fkey';
                        columns: ['reviewed_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_update_suggestions_rule_id_fkey';
                        columns: ['rule_id'];
                        isOneToOne: false;
                        referencedRelation: 'rules';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_update_suggestions_tool_id_fkey';
                        columns: ['tool_id'];
                        isOneToOne: false;
                        referencedRelation: 'tools';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rule_votes: {
                Row: {
                    created_at: string;
                    id: string;
                    rule_id: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    rule_id: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    rule_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rule_votes_rule_id_fkey';
                        columns: ['rule_id'];
                        isOneToOne: false;
                        referencedRelation: 'rules';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rule_votes_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            rules: {
                Row: {
                    author_id: string;
                    content: string;
                    created_at: string;
                    embedding: string | null;
                    id: string;
                    is_active: boolean;
                    is_archived: boolean;
                    is_private: boolean;
                    slug: string;
                    title: string;
                    tool_id: string | null;
                    updated_at: string;
                    upvote_count: number;
                };
                Insert: {
                    author_id: string;
                    content: string;
                    created_at?: string;
                    embedding?: string | null;
                    id?: string;
                    is_active?: boolean;
                    is_archived?: boolean;
                    is_private?: boolean;
                    slug: string;
                    title: string;
                    tool_id?: string | null;
                    updated_at?: string;
                    upvote_count?: number;
                };
                Update: {
                    author_id?: string;
                    content?: string;
                    created_at?: string;
                    embedding?: string | null;
                    id?: string;
                    is_active?: boolean;
                    is_archived?: boolean;
                    is_private?: boolean;
                    slug?: string;
                    title?: string;
                    tool_id?: string | null;
                    updated_at?: string;
                    upvote_count?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'rules_author_id_fkey';
                        columns: ['author_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'rules_tool_id_fkey';
                        columns: ['tool_id'];
                        isOneToOne: false;
                        referencedRelation: 'tools';
                        referencedColumns: ['id'];
                    },
                ];
            };
            subscriptions: {
                Row: {
                    cancel_at: string | null;
                    created_at: string | null;
                    current_period_end: string | null;
                    id: string;
                    price_id: string | null;
                    product_id: string | null;
                    status: string;
                    stripe_customer_id: string | null;
                    stripe_subscription_id: string | null;
                    updated_at: string | null;
                    user_id: string;
                };
                Insert: {
                    cancel_at?: string | null;
                    created_at?: string | null;
                    current_period_end?: string | null;
                    id?: string;
                    price_id?: string | null;
                    product_id?: string | null;
                    status: string;
                    stripe_customer_id?: string | null;
                    stripe_subscription_id?: string | null;
                    updated_at?: string | null;
                    user_id: string;
                };
                Update: {
                    cancel_at?: string | null;
                    created_at?: string | null;
                    current_period_end?: string | null;
                    id?: string;
                    price_id?: string | null;
                    product_id?: string | null;
                    status?: string;
                    stripe_customer_id?: string | null;
                    stripe_subscription_id?: string | null;
                    updated_at?: string | null;
                    user_id?: string;
                };
                Relationships: [];
            };
            tag_suggestions: {
                Row: {
                    created_at: string;
                    description: string | null;
                    feedback: string | null;
                    id: string;
                    name: string;
                    reviewed_by: string | null;
                    status: string;
                    suggested_by: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    description?: string | null;
                    feedback?: string | null;
                    id?: string;
                    name: string;
                    reviewed_by?: string | null;
                    status?: string;
                    suggested_by: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    description?: string | null;
                    feedback?: string | null;
                    id?: string;
                    name?: string;
                    reviewed_by?: string | null;
                    status?: string;
                    suggested_by?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tag_suggestions_reviewed_by_fkey';
                        columns: ['reviewed_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'tag_suggestions_suggested_by_fkey';
                        columns: ['suggested_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tags: {
                Row: {
                    created_at: string;
                    created_by: string | null;
                    description: string | null;
                    id: string;
                    is_approved: boolean;
                    is_archived: boolean;
                    is_private: boolean;
                    name: string;
                    slug: string;
                    updated_at: string;
                };
                Insert: {
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    id?: string;
                    is_approved?: boolean;
                    is_archived?: boolean;
                    is_private?: boolean;
                    name: string;
                    slug: string;
                    updated_at?: string;
                };
                Update: {
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    id?: string;
                    is_approved?: boolean;
                    is_archived?: boolean;
                    is_private?: boolean;
                    name?: string;
                    slug?: string;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tags_created_by_fkey';
                        columns: ['created_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tool_suggestions: {
                Row: {
                    created_at: string;
                    description: string | null;
                    details: Json | null;
                    feedback: string | null;
                    id: string;
                    image_url: string | null;
                    name: string;
                    reviewed_by: string | null;
                    slug: string | null;
                    status: string;
                    suggested_by: string;
                    updated_at: string;
                    url: string | null;
                };
                Insert: {
                    created_at?: string;
                    description?: string | null;
                    details?: Json | null;
                    feedback?: string | null;
                    id?: string;
                    image_url?: string | null;
                    name: string;
                    reviewed_by?: string | null;
                    slug?: string | null;
                    status?: string;
                    suggested_by: string;
                    updated_at?: string;
                    url?: string | null;
                };
                Update: {
                    created_at?: string;
                    description?: string | null;
                    details?: Json | null;
                    feedback?: string | null;
                    id?: string;
                    image_url?: string | null;
                    name?: string;
                    reviewed_by?: string | null;
                    slug?: string | null;
                    status?: string;
                    suggested_by?: string;
                    updated_at?: string;
                    url?: string | null;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tool_suggestions_reviewed_by_fkey';
                        columns: ['reviewed_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'tool_suggestions_suggested_by_fkey';
                        columns: ['suggested_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tool_votes: {
                Row: {
                    created_at: string;
                    id: string;
                    tool_id: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    tool_id: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    tool_id?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tool_votes_tool_id_fkey';
                        columns: ['tool_id'];
                        isOneToOne: false;
                        referencedRelation: 'tools';
                        referencedColumns: ['id'];
                    },
                    {
                        foreignKeyName: 'tool_votes_user_id_fkey';
                        columns: ['user_id'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            tools: {
                Row: {
                    created_at: string;
                    created_by: string | null;
                    description: string | null;
                    details: Json | null;
                    id: string;
                    image_url: string | null;
                    is_archived: boolean;
                    is_private: boolean;
                    name: string;
                    slug: string;
                    updated_at: string;
                    url: string | null;
                    votes: number;
                };
                Insert: {
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    details?: Json | null;
                    id?: string;
                    image_url?: string | null;
                    is_archived?: boolean;
                    is_private?: boolean;
                    name: string;
                    slug: string;
                    updated_at?: string;
                    url?: string | null;
                    votes?: number;
                };
                Update: {
                    created_at?: string;
                    created_by?: string | null;
                    description?: string | null;
                    details?: Json | null;
                    id?: string;
                    image_url?: string | null;
                    is_archived?: boolean;
                    is_private?: boolean;
                    name?: string;
                    slug?: string;
                    updated_at?: string;
                    url?: string | null;
                    votes?: number;
                };
                Relationships: [
                    {
                        foreignKeyName: 'tools_created_by_fkey';
                        columns: ['created_by'];
                        isOneToOne: false;
                        referencedRelation: 'profiles';
                        referencedColumns: ['id'];
                    },
                ];
            };
            user_collections: {
                Row: {
                    created_at: string;
                    id: string;
                    name: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    id?: string;
                    name: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    id?: string;
                    name?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            user_contributions: {
                Row: {
                    contribution_id: string;
                    contribution_type: string;
                    created_at: string;
                    id: string;
                    mcp_server_reports_count: number | null;
                    mcp_server_suggestions_count: number | null;
                    mcp_server_update_suggestions_count: number | null;
                    mcp_server_votes_count: number | null;
                    status: string;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    contribution_id: string;
                    contribution_type: string;
                    created_at?: string;
                    id?: string;
                    mcp_server_reports_count?: number | null;
                    mcp_server_suggestions_count?: number | null;
                    mcp_server_update_suggestions_count?: number | null;
                    mcp_server_votes_count?: number | null;
                    status: string;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    contribution_id?: string;
                    contribution_type?: string;
                    created_at?: string;
                    id?: string;
                    mcp_server_reports_count?: number | null;
                    mcp_server_suggestions_count?: number | null;
                    mcp_server_update_suggestions_count?: number | null;
                    mcp_server_votes_count?: number | null;
                    status?: string;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
            user_notification_preferences: {
                Row: {
                    created_at: string;
                    email_notifications: boolean;
                    id: string;
                    mcp_server_approved: boolean;
                    mcp_server_rejected: boolean;
                    mcp_server_report_resolved: boolean;
                    mcp_server_update_approved: boolean;
                    mcp_server_update_rejected: boolean;
                    rule_approved: boolean;
                    rule_favorited: boolean;
                    rule_rejected: boolean;
                    rule_upvoted: boolean;
                    tag_approved: boolean;
                    tag_rejected: boolean;
                    tool_approved: boolean;
                    tool_rejected: boolean;
                    tool_upvoted: boolean | null;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    created_at?: string;
                    email_notifications?: boolean;
                    id?: string;
                    mcp_server_approved?: boolean;
                    mcp_server_rejected?: boolean;
                    mcp_server_report_resolved?: boolean;
                    mcp_server_update_approved?: boolean;
                    mcp_server_update_rejected?: boolean;
                    rule_approved?: boolean;
                    rule_favorited?: boolean;
                    rule_rejected?: boolean;
                    rule_upvoted?: boolean;
                    tag_approved?: boolean;
                    tag_rejected?: boolean;
                    tool_approved?: boolean;
                    tool_rejected?: boolean;
                    tool_upvoted?: boolean | null;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    created_at?: string;
                    email_notifications?: boolean;
                    id?: string;
                    mcp_server_approved?: boolean;
                    mcp_server_rejected?: boolean;
                    mcp_server_report_resolved?: boolean;
                    mcp_server_update_approved?: boolean;
                    mcp_server_update_rejected?: boolean;
                    rule_approved?: boolean;
                    rule_favorited?: boolean;
                    rule_rejected?: boolean;
                    rule_upvoted?: boolean;
                    tag_approved?: boolean;
                    tag_rejected?: boolean;
                    tool_approved?: boolean;
                    tool_rejected?: boolean;
                    tool_upvoted?: boolean | null;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [];
            };
        };
        Views: {
            [_ in never]: never;
        };
        Functions: {
            create_notification_preferences_for_existing_users: {
                Args: Record<PropertyKey, never>;
                Returns: undefined;
            };
            get_site_stats: {
                Args: Record<PropertyKey, never>;
                Returns: {
                    rules_count: number;
                    tags_count: number;
                    tools_count: number;
                    mcp_servers_count: number;
                }[];
            };
            get_user_contribution_stats: {
                Args: {
                    user_id: string;
                };
                Returns: Json;
            };
            get_user_subscription_tier: {
                Args: {
                    p_user_id: string;
                };
                Returns: string;
            };
            handle_subscription_ended: {
                Args: {
                    user_uuid: string;
                };
                Returns: undefined;
            };
            increment_attempts: {
                Args: {
                    rule_id: string;
                };
                Returns: number;
            };
            match_all_rules: {
                Args: {
                    query_embedding: string;
                    match_threshold?: number;
                    match_count?: number;
                };
                Returns: {
                    id: string;
                    title: string;
                    content: string;
                    similarity: number;
                    source: string;
                }[];
            };
            match_rules: {
                Args: {
                    query_embedding: string;
                    match_threshold?: number;
                    match_count?: number;
                };
                Returns: {
                    id: string;
                    title: string;
                    content: string;
                    similarity: number;
                }[];
            };
            unarchive_all_content: {
                Args: {
                    user_uuid: string;
                };
                Returns: undefined;
            };
        };
        Enums: {
            [_ in never]: never;
        };
        CompositeTypes: {
            [_ in never]: never;
        };
    };
};

type PublicSchema = Database[Extract<keyof Database, 'public'>];

export type Tables<
    PublicTableNameOrOptions extends
        | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
        | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
        ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
              Database[PublicTableNameOrOptions['schema']]['Views'])
        : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
          Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
      ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
        ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
        : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
      ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    PublicTableNameOrOptions extends keyof PublicSchema['Tables'] | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
        ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
        : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
      ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    PublicEnumNameOrOptions extends keyof PublicSchema['Enums'] | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
        ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
    : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
      ? PublicSchema['Enums'][PublicEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes'] | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database;
    }
        ? keyof Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
    ? Database[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof PublicSchema['CompositeTypes']
      ? PublicSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;
