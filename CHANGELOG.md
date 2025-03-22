# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.5.0](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.7...v0.5.0) (2025-03-22)

### Features

- add eslint-plugin-unused-imports for managing unused imports and update related configurations ([66f95c9](https://github.com/codingrules-ai/vscode-plugin/commit/66f95c9a9d698b5595da46c117f5c6aa94c572b4))
- enhance README with authentication, private content, and favorites features ([bdb3ed7](https://github.com/codingrules-ai/vscode-plugin/commit/bdb3ed76650942cae8d1f9e93b583b7a6f8030f5))
- implement favorite rules functionality with loading and display in the rules explorer ([67cbd56](https://github.com/codingrules-ai/vscode-plugin/commit/67cbd56083d3c976c69466360c183373f1f2df50))

### [0.4.7](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.6...v0.4.7) (2025-03-22)

### Features

- add command to copy rule to clipboard with error handling ([0ba9ffe](https://github.com/codingrules-ai/vscode-plugin/commit/0ba9ffe4f85da85ca25118e6cd0b6dfcd481d72f))
- add environment variable support for Supabase configuration and update documentation ([160cebf](https://github.com/codingrules-ai/vscode-plugin/commit/160cebfdde58f0ebdb77e4a7c686e0693ebfc14a))
- add external link functionality for author profiles in rule viewer ([a413147](https://github.com/codingrules-ai/vscode-plugin/commit/a413147b061297e88956d2655cd9ebbca937893d))
- add user profile retrieval ([e279505](https://github.com/codingrules-ai/vscode-plugin/commit/e279505a35c423bb893e1937bcfae2ec2e83c30f))
- clean-up architecture ([36f0bf6](https://github.com/codingrules-ai/vscode-plugin/commit/36f0bf6d3eaca8bf515259a74d22f05f5ecec53e))
- consolidate authentication commands ([7262415](https://github.com/codingrules-ai/vscode-plugin/commit/72624154fb83050b4d25b20bceb5b83f67d0c125))
- enhance rule download options and UI in rule viewer ([803feec](https://github.com/codingrules-ai/vscode-plugin/commit/803feecf5f487c89265f191037b18e1738e566fb))
- enhance rule downloading process with improved file handling and UI updates ([1890878](https://github.com/codingrules-ai/vscode-plugin/commit/1890878a9d359304024533b039e543e1cb62a753))
- implement background token refresh and cache invalidation for private rules ([6811836](https://github.com/codingrules-ai/vscode-plugin/commit/681183639712695940337bbb40ecf2c0b0bde296))
- implement functionality to fetch and display private rules ([e0d24d0](https://github.com/codingrules-ai/vscode-plugin/commit/e0d24d0a527fca43317c399d9a6b0dd58b1dc46f))
- implement search functionality with QuickPick results and loading indicators ([0c06765](https://github.com/codingrules-ai/vscode-plugin/commit/0c0676535e5b78b70653cfc83b9ebe7af3a1abeb))
- improve file download handling and user prompts in rule downloader ([1137188](https://github.com/codingrules-ai/vscode-plugin/commit/1137188d90b6e9dc7c2a77b4c83a6aa5c65794c6))
- refactor extension architecture with command handlers for rules, explorer, and authentication ([474b1d5](https://github.com/codingrules-ai/vscode-plugin/commit/474b1d560a0a7b5ed6e40da3e848bcc90d08a4c4))

### Bug Fixes

- ensure clipboard functionality handles empty rule content and improve event listener setup ([839f128](https://github.com/codingrules-ai/vscode-plugin/commit/839f1281a5bb635ce6e193ca9a8322185cbf018f))

### Refactors

- update Supabase configuration to use hardcoded values, removing user-configurable options ([a3da447](https://github.com/codingrules-ai/vscode-plugin/commit/a3da447e93b35d32eee160cbd06bd4315bf2ea21))

### [0.4.6](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.5...v0.4.6) (2025-03-22)

### [0.4.5](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.4...v0.4.5) (2025-03-22)

### Features

- refine URI protocol detection logic for VS Code-based editors ([b97bf3c](https://github.com/codingrules-ai/vscode-plugin/commit/b97bf3c6210e6eb8408f81d0f427fd73eb7cb23f))

### Refactors

- simplify URI protocol detection by utilizing vscode.env.uriScheme ([04965a1](https://github.com/codingrules-ai/vscode-plugin/commit/04965a143e338d2491426ce48ad6f4c8c6f6263b))

### [0.4.4](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.3...v0.4.4) (2025-03-22)

### Features

- enable tree shaking in esbuild configuration ([10cba94](https://github.com/codingrules-ai/vscode-plugin/commit/10cba9430083507562da7f157707b24cf86ad12d))

### [0.4.3](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.2...v0.4.3) (2025-03-22)

### [0.4.2](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.1...v0.4.2) (2025-03-22)

### Features

- enhance Supabase service to include user authentication checks and private content handling ([b0ff271](https://github.com/codingrules-ai/vscode-plugin/commit/b0ff27133ac95e706b7938f724610e307f6bdd9d))
- improve URI protocol detection ([6915600](https://github.com/codingrules-ai/vscode-plugin/commit/6915600a13f6a2f06e9d788109d6cc92bf28bd93))
- refactor authentication service initialization and enhance session management ([053f2ca](https://github.com/codingrules-ai/vscode-plugin/commit/053f2ca095b962a7849e1e8ca130599b24b3b99f))
- sort tags and tools alphabetically in rule viewer and rules explorer ([4008fd1](https://github.com/codingrules-ai/vscode-plugin/commit/4008fd1291fae52e501aafe3dc772977713e49ed))

### [0.4.1](https://github.com/codingrules-ai/vscode-plugin/compare/v0.4.0...v0.4.1) (2025-03-21)

### Features

- enhance authentication service with session management and user state tracking ([05c8773](https://github.com/codingrules-ai/vscode-plugin/commit/05c877320757639a2a8703c4139b108d3ce2f526))
- implement dynamic URI protocol detection for various VS Code-based editors ([0eead95](https://github.com/codingrules-ai/vscode-plugin/commit/0eead955db0fc4a3f93c281d9a1fffe998d31173))
- improve authentication flow and service integration ([2604c57](https://github.com/codingrules-ai/vscode-plugin/commit/2604c577df7db8969a9f442c69c8f928453a39ee))

## [0.4.0](https://github.com/codingrules-ai/vscode-plugin/compare/v0.3.2...v0.4.0) (2025-03-21)

### Features

- add URI handler for authentication and enhance session management ([bb65e41](https://github.com/codingrules-ai/vscode-plugin/commit/bb65e41faaaa4713e10119362e3c62edb07cafe2))

### [0.3.2](https://github.com/codingrules-ai/vscode-plugin/compare/v0.3.1...v0.3.2) (2025-03-21)

### Features

- implement user authentication features with login, logout, and profile viewing capabilities ([880dcfd](https://github.com/codingrules-ai/vscode-plugin/commit/880dcfd4eac1ea1662a43a579c9ac85c0893e513))

### Refactors

- remove Supabase configuration command from extension ([4f8798a](https://github.com/codingrules-ai/vscode-plugin/commit/4f8798a74a6dd511d0e9a7515d6369011543c74c))

### [0.3.1](https://github.com/codingrules-ai/vscode-plugin/compare/v0.3.0...v0.3.1) (2025-03-21)

## [0.3.0](https://github.com/codingrules-ai/vscode-plugin/compare/v0.2.0...v0.3.0) (2025-03-21)

## [0.2.0](https://github.com/codingrules-ai/vscode-plugin/compare/v0.1.0...v0.2.0) (2025-03-21)

### Features

- enhance rule search functionality and add top upvoted rules feature ([9903ed6](https://github.com/codingrules-ai/vscode-plugin/commit/9903ed69528358b7a51280cdf0d1593b29f3c5ca))
- improve search functionality by adding tag-based filtering and enhance error reporting in UI ([1da88a1](https://github.com/codingrules-ai/vscode-plugin/commit/1da88a128f1c29adecf6cb2dec1a32f1d3ca950c))

## [0.1.0](https://github.com/codingrules-ai/vscode-plugin/releases/tag/v0.1.0) (2025-03-21)

### Features

- add CodingRules.ai VS Code extension with rule browsing, searching, and downloading capabilities ([7756243](https://github.com/codingrules-ai/vscode-plugin/commit/7756243))
- initial commit ([799fed7](https://github.com/codingrules-ai/vscode-plugin/commit/799fed7))

### Bug Fixes

- update Cline file format from .cline to .clinerules and enhance download options with generic formats ([3fe5232](https://github.com/codingrules-ai/vscode-plugin/commit/3fe5232))

### Code Refactoring

- rename download command to internal version, enhance validation for rule properties, and streamline format selection process ([4f9641f](https://github.com/codingrules-ai/vscode-plugin/commit/4f9641f))

### Chores

- add ESLint cache file to improve linting performance ([2a3e903](https://github.com/codingrules-ai/vscode-plugin/commit/2a3e903))
- remove ESLint cache file, add LICENSE.md, and update package.json with repository and license information ([823abd1](https://github.com/codingrules-ai/vscode-plugin/commit/823abd1))
- update package.json to include publisher and pricing information ([0960a86](https://github.com/codingrules-ai/vscode-plugin/commit/0960a86))
- update icon ([23ff54b](https://github.com/codingrules-ai/vscode-plugin/commit/23ff54b))
