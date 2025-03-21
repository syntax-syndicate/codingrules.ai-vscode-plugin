# CodingRules.ai VS Code Extension

<div align="center">
  <img src="images/icon.png" alt="CodingRules.ai Logo" width="128" />
  <p><strong>Standardize your codebase and improve team collaboration with AI-powered rules management</strong></p>
</div>

This extension allows you to search, browse, and download rules from [CodingRules.ai](https://codingrules.ai) directly within VS Code.

## Features

- **Browse Rules**: Use the sidebar view to browse recently added rules, or explore by tags and tools
- **Search Rules**: Search for rules by title, content, or tags
- **Download Rules**: Download rules in formats compatible with popular AI coding assistants:
    - Cline (`.clinerules`)
    - Cursor (`.cursorrules`)
    - Windsurf (`.windsurfrules`)
- **Preview Rules**: View rule details including content, tags, and metadata before downloading

## Getting Started

1. Install the extension from the VS Code Marketplace
2. The extension comes pre-configured with Supabase credentials

    > **Note:** If you want to use your own Supabase instance, you can configure it in settings:
    >
    > - Go to Settings > Extensions > CodingRules.ai
    > - Enter your Supabase URL and Anonymous Key

3. Access the extension from the CodingRules.ai icon in the activity bar

## Using the Extension

### Browsing Rules

1. Click the CodingRules.ai icon in the activity bar to open the Rules Explorer
2. Browse through recent rules or explore by tags or tools
3. Click on a rule to view its details in a webview panel

### Searching for Rules

1. Click the search icon in the Rules Explorer title bar
2. Enter your search term and press Enter
3. Select a rule from the search results to view or download

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
- **CodingRules: Configure Supabase** - Open the extension settings

## Requirements

- Visual Studio Code version 1.98.0 or higher

## Extension Settings

This extension contributes the following settings:

- `codingrules-ai.supabaseUrl`: Supabase URL for connecting to the CodingRules.ai API
- `codingrules-ai.supabaseAnonKey`: Supabase anonymous key for connecting to the CodingRules.ai API

## Known Issues

- Authentication for accessing private rules is not yet supported

## Release Notes

### 0.0.1

Initial release of the CodingRules.ai VS Code Extension:

- Browse and search rules
- View rule details
- Download rules in multiple formats
