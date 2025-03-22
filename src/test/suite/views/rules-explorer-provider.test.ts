import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { RulesExplorerProvider } from '../../../views/explorer';
import { createMockExtensionContext } from '../../utils/mocks';
import { RuleService } from '../../../services/rule.service';
import { AuthService } from '../../../services/auth.service';
import { Logger } from '../../../utils/logger';
import { RuleExplorerItem, RuleExplorerItemType } from '../../../views/explorer';

suite('RulesExplorerProvider Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let rulesExplorerProvider: RulesExplorerProvider;
    let mockRuleService: any;
    let mockAuthService: any;

    setup(() => {
        sandbox = sinon.createSandbox();
        mockContext = createMockExtensionContext(sandbox);

        // Mock the logger
        sandbox.stub(Logger.getInstance(), 'info');
        sandbox.stub(Logger.getInstance(), 'debug');
        sandbox.stub(Logger.getInstance(), 'error');

        // Create mock services
        mockRuleService = {
            getTopUpvotedRules: sandbox.stub().resolves({
                rules: [
                    {
                        id: 'rule-1',
                        title: 'Test Rule',
                        content: 'Test rule content',
                        author_id: 'author-1',
                        slug: 'test-rule',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_private: false,
                        is_archived: false,
                        is_active: true,
                        upvote_count: 5,
                        tool_id: null,
                    },
                ],
                count: 1,
            }),
            getTags: sandbox.stub().resolves([
                {
                    id: 'tag-1',
                    name: 'JavaScript',
                    slug: 'javascript',
                    is_private: false,
                },
            ]),
            getTools: sandbox.stub().resolves([
                {
                    id: 'tool-1',
                    name: 'VSCode',
                    slug: 'vscode',
                    is_private: false,
                },
            ]),
            getTagRules: sandbox.stub().resolves({
                rules: [
                    {
                        id: 'rule-2',
                        title: 'Tag Rule',
                        content: 'Tag rule content',
                        author_id: 'author-1',
                        slug: 'tag-rule',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_private: false,
                        is_archived: false,
                        is_active: true,
                        upvote_count: 3,
                        tool_id: null,
                    },
                ],
                count: 1,
            }),
            getToolRules: sandbox.stub().resolves({
                rules: [
                    {
                        id: 'rule-3',
                        title: 'Tool Rule',
                        content: 'Tool rule content',
                        author_id: 'author-1',
                        slug: 'tool-rule',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_private: false,
                        is_archived: false,
                        is_active: true,
                        upvote_count: 2,
                        tool_id: 'tool-1',
                    },
                ],
                count: 1,
            }),
            getPrivateRules: sandbox.stub().resolves({
                rules: [],
                count: 0,
            }),
            getFavoriteRules: sandbox.stub().resolves({}),
            getRuleCountForTag: sandbox.stub().resolves(5),
            getRuleCountForTool: sandbox.stub().resolves(3),
            clearCaches: sandbox.stub(),
            getRule: sandbox.stub().resolves({
                id: 'rule-1',
                title: 'Test Rule',
                content: 'Test rule content',
                author_id: 'author-1',
                slug: 'test-rule',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_private: false,
                is_archived: false,
                is_active: true,
                upvote_count: 5,
                tool_id: null,
            }),
        };

        mockAuthService = {
            isAuthenticated: false,
            refreshCurrentUser: sandbox.stub().resolves(),
        };

        // Stub the service singletons
        sandbox.stub(RuleService, 'getInstance').returns(mockRuleService);
        sandbox.stub(AuthService, 'getInstance').returns(mockAuthService);

        // Create the provider
        rulesExplorerProvider = new RulesExplorerProvider(mockContext);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('refresh should fire onDidChangeTreeData event', () => {
        // Create a spy on the onDidChangeTreeData event
        const eventEmitterSpy = sandbox.spy(rulesExplorerProvider['_onDidChangeTreeData'], 'fire');

        // Call refresh
        rulesExplorerProvider.refresh();

        // Verify that the event was fired
        assert.strictEqual(eventEmitterSpy.calledOnce, true);
    });

    test('getTreeItem should return a TreeItem for a rule', () => {
        // Create a rule explorer item directly
        const ruleItem = new RuleExplorerItem(
            RuleExplorerItemType.RULE,
            'Test Rule',
            vscode.TreeItemCollapsibleState.None,
            {
                id: 'rule-1',
                title: 'Test Rule',
                content: 'Test rule content',
                author_id: 'author-1',
                slug: 'test-rule',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_private: false,
                is_archived: false,
                is_active: true,
                upvote_count: 5,
                tool_id: null,
            },
        );

        // Get the tree item for the item
        const treeItem = rulesExplorerProvider.getTreeItem(ruleItem);

        // Verify the tree item has the expected properties
        assert.strictEqual(treeItem instanceof vscode.TreeItem, true);
        assert.strictEqual(treeItem.label, 'Test Rule');
        assert.strictEqual(treeItem.contextValue, 'rule');
    });

    test('Should construct root level tree items', async () => {
        // Refresh the data to ensure the mock data is loaded
        await rulesExplorerProvider['refreshData']();

        // Get children at the root level
        const rootItems = await rulesExplorerProvider.getChildren();

        // There should be at least a login item (when not authenticated)
        // and items for top rules, tags, and tools categories
        assert.ok(rootItems.length >= 4, 'Root should have at least 4 items');

        // Find the top rules category
        const topRulesCategory = rootItems.find(
            (item) => item.type === RuleExplorerItemType.CATEGORY && item.label.toString().includes('Top Rules'),
        );
        assert.ok(topRulesCategory, 'Should have a Top Rules category');

        // Find the tags category
        const tagsCategory = rootItems.find(
            (item) => item.type === RuleExplorerItemType.CATEGORY && item.label.toString().includes('Tags'),
        );
        assert.ok(tagsCategory, 'Should have a Tags category');

        // Find the tools category
        const toolsCategory = rootItems.find(
            (item) => item.type === RuleExplorerItemType.CATEGORY && item.label.toString().includes('Tools'),
        );
        assert.ok(toolsCategory, 'Should have a Tools category');
    });

    test('Should generate tree items for top rules', async () => {
        // Refresh data first
        await rulesExplorerProvider['refreshData']();

        // Find the top rules category in the root items
        const rootItems = await rulesExplorerProvider.getChildren();
        const topRulesCategory = rootItems.find(
            (item) => item.type === RuleExplorerItemType.CATEGORY && item.label.toString().includes('Top Rules'),
        );

        // Get children of the top rules category
        const topRuleItems = await rulesExplorerProvider.getChildren(topRulesCategory);

        // Verify we have at least one rule
        assert.ok(topRuleItems.length > 0, 'Should have at least one top rule');

        // Verify the first item is a rule
        const firstRuleItem = topRuleItems[0];
        assert.strictEqual(firstRuleItem.type, RuleExplorerItemType.RULE, 'First item should be a rule');
        assert.strictEqual(firstRuleItem.contextValue, 'rule', 'Context value should be "rule"');
    });

    test('Should generate tree items for tags', async () => {
        // Refresh data first
        await rulesExplorerProvider['refreshData']();

        // Find the tags category in the root items
        const rootItems = await rulesExplorerProvider.getChildren();
        const tagsCategory = rootItems.find(
            (item) => item.type === RuleExplorerItemType.CATEGORY && item.label.toString().includes('Tags'),
        );

        // Get children of the tags category
        const tagItems = await rulesExplorerProvider.getChildren(tagsCategory);

        // Verify we have at least one tag
        assert.ok(tagItems.length > 0, 'Should have at least one tag');

        // Verify the first tag is a tag
        const tagItem = tagItems[0];
        assert.strictEqual(tagItem.type, RuleExplorerItemType.TAG, 'Item should be a tag');
        assert.strictEqual(tagItem.contextValue, 'tag', 'Context value should be "tag"');
        assert.strictEqual(tagItem.label?.toString().includes('JavaScript'), true, 'Tag should be JavaScript');
    });

    test('Should generate tree items for tools', async () => {
        // Refresh data first
        await rulesExplorerProvider['refreshData']();

        // Find the tools category in the root items
        const rootItems = await rulesExplorerProvider.getChildren();
        const toolsCategory = rootItems.find(
            (item) => item.type === RuleExplorerItemType.CATEGORY && item.label.toString().includes('Tools'),
        );

        // Get children of the tools category
        const toolItems = await rulesExplorerProvider.getChildren(toolsCategory);

        // Verify we have at least one tool
        assert.ok(toolItems.length > 0, 'Should have at least one tool');

        // Verify the first tool is a tool
        const toolItem = toolItems[0];
        assert.strictEqual(toolItem.type, RuleExplorerItemType.TOOL, 'Item should be a tool');
        assert.strictEqual(toolItem.contextValue, 'tool', 'Context value should be "tool"');
        assert.strictEqual(toolItem.label?.toString().includes('VSCode'), true, 'Tool should be VSCode');
    });

    test('Should generate rules for a tag when expanded', async () => {
        // Refresh data first
        await rulesExplorerProvider['refreshData']();

        // Create a tag explorer item with proper data to ensure context value is set correctly
        const tagItem = new RuleExplorerItem(
            RuleExplorerItemType.TAG,
            'JavaScript',
            vscode.TreeItemCollapsibleState.Collapsed,
            {
                id: 'tag-1',
                name: 'JavaScript',
                slug: 'javascript',
                is_private: false,
            },
        );

        // Preload the tag rules preview
        const tagRulePreviewsMap = rulesExplorerProvider['tagRulePreviews'];
        const mockRules = [
            {
                id: 'rule-2',
                title: 'Tag Rule',
                content: 'Tag rule content',
                author_id: 'author-1',
                slug: 'tag-rule',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                is_private: false,
                is_archived: false,
                is_active: true,
                upvote_count: 3,
                tool_id: null,
            },
        ];
        tagRulePreviewsMap.set('tag-1', mockRules);

        // Get children of the tag
        const tagRules = await rulesExplorerProvider.getChildren(tagItem);

        // Verify we have rules for the tag
        assert.ok(tagRules.length > 0, 'Should have at least one rule for the tag');

        // Verify the first item is a rule with proper context value
        const ruleItem = tagRules[0];
        assert.strictEqual(ruleItem.type, RuleExplorerItemType.RULE, 'Item should be a rule');
        assert.strictEqual(ruleItem.contextValue, 'rule', 'Context value should be "rule"');
    });
});
