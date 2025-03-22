# CodingRules.ai VS Code Extension

<div align="center">
  <img src="images/icon.png" alt="CodingRules.ai Logo" width="128" />
  <p><strong>Standardize your codebase and improve team collaboration with AI-powered rules management</strong></p>
</div>

This extension allows you to search, browse, and download rules from [CodingRules.ai](https://codingrules.ai) directly within VS Code.

## Features

- **Browse Rules**: Use the sidebar view to browse recently added rules, or explore by tags and tools
- **Search Rules**: Search for rules by title, content, or tags
- **Authentication**: Log in to access private content and your favorite rule collections
- **Private Content**: View and manage your private rules with visual indicators (lock icon)
- **Favorites**: Access your favorite rules organized by collections with star indicators
- **Download Rules**: Download rules in formats compatible with popular AI coding assistants:
    - Cline (`.clinerules`)
    - Cursor (`.cursorrules`)
    - Windsurf (`.windsurfrules`)
- **Preview Rules**: View rule details including content, tags, and metadata before downloading
- **Visual Indicators**: Easy-to-understand icons for rule status (private, public, favorites)
- **Upvote Information**: See popularity metrics with upvote counts for rules

## Getting Started

1. Install the extension from the VS Code Marketplace
2. The extension comes pre-configured with Supabase credentials

    > **Note:** If you want to use your own Supabase instance, you have two options:
    >
    > **Option 1: Using Environment Variables (Recommended)**
    >
    > - Create a `.env` file in the extension root directory (you can copy from `.env.example`)
    > - Set the following variables:
    >     ```
    >     SUPABASE_URL=your-supabase-url
    >     SUPABASE_ANON_KEY=your-supabase-anon-key
    >     ```
    > - Rebuild the extension with `npm run compile`
    >
    > **Option 2: Using Settings**
    >
    > - Go to Settings > Extensions > CodingRules.ai
    > - Enter your Supabase URL and Anonymous Key

3. Access the extension from the CodingRules.ai icon in the activity bar
4. For private content, click "Log in to see private content" in the Rules Explorer

## Using the Extension

### Authentication and Private Content

1. To access private rules and favorites, click "Log in to see private content" in the Rules Explorer
2. Follow the authentication flow to log in to your CodingRules.ai account
3. Once logged in, you'll see:
    - Private Rules section with your private rules (marked with a lock icon)
    - Favorites section with your saved rule collections
    - Private content automatically refreshes every 5 minutes

### Browsing Rules

1. Click the CodingRules.ai icon in the activity bar to open the Rules Explorer
2. Browse through:
    - Favorites (if logged in): Organized by collection with star icons
    - Private Rules (if logged in): Your private rules with lock icons
    - Top Rules: Most upvoted public rules with upvote counts
    - Tags: Browse by rule categories
    - AI Tools: Browse by AI tool compatibility
3. Click on a rule to view its details in a webview panel

### Searching for Rules

1. Click the search icon in the Rules Explorer title bar
2. Enter your search term and press Enter
3. Select a rule from the search results to view or download
4. Use the "Clear Search" button to return to normal browsing

### Working with Favorites

1. Log in to your CodingRules.ai account to see your favorites
2. Your favorite rules are organized by collection, with star icons
3. To add rules to favorites, star them on the CodingRules.ai website
4. Favorites are automatically synced when you refresh the explorer

### Downloading Rules

1. From the rule details view, click one of the download buttons to choose a format:
    - Cline Rule (`.clinerules`)
    - Cursor Rule (`.cursorrules`)
    - Windsurf Rule (`.windsurfrules`)
2. If a file with the same name already exists, you'll be prompted to:
    - Replace the existing file
    - Merge the new content with the existing file

## Commands

The following commands are available in the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

- **CodingRules: Search for Rules** - Search for rules by title, content, or tags
- **CodingRules: Download Rule** - Download the selected rule
- **CodingRules: Refresh Explorer** - Refresh the Rules Explorer view
- **CodingRules: View Rule Details** - View details of the selected rule
- **CodingRules: Login** - Log in to access private content and favorites
- **CodingRules: Clear Search** - Clear search results and return to normal browsing

## Requirements

- Visual Studio Code version 1.90.0 or higher
