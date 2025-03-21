/**
 * Represents a rule from the codingrules.ai platform
 */
export interface Rule {
    id: string;
    title: string;
    content: string;
    author_id: string;
    slug: string;
    created_at: string;
    updated_at: string;
    is_private: boolean;
    is_archived: boolean;
    is_active: boolean;
    upvote_count: number;
    tool_id: string | null;
    tags?: Tag[];
}

/**
 * Represents a tag that can be associated with a rule
 */
export interface Tag {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    created_at?: string;
    updated_at?: string;
    is_archived?: boolean;
    is_private?: boolean;
    is_approved?: boolean;
    created_by?: string | null;
}

/**
 * Represents a tool (AI coding assistant) that rules can be associated with
 */
export interface Tool {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    image_url?: string | null;
    url?: string | null;
    details?: any;
    created_at?: string;
    updated_at?: string;
    is_archived?: boolean;
    is_private?: boolean;
    created_by?: string | null;
    votes?: number;
}

/**
 * Supported AI tool formats
 */
export enum AIToolFormat {
    CLINE = '.clinerules',
    CURSOR = '.cursorrules',
    WINDSURF = '.windsurfrules',
    GITHUB_COPILOT = 'copilot-instructions.md',
}

/**
 * Generic file formats for rules
 */
export enum GenericFormat {
    MD = '.md',
    TXT = '.txt',
}

/**
 * Response format for rule listing
 */
export interface RuleListResponse {
    rules: Rule[];
    count: number;
}

/**
 * Parameters for rule search
 */
export interface RuleSearchParams {
    query?: string;
    tags?: string[];
    tool_id?: string;
    page?: number;
    limit?: number;
    include_private?: boolean;
}
