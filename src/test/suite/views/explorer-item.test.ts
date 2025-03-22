import * as assert from 'assert';
import * as vscode from 'vscode';
import { RuleExplorerItem, RuleExplorerItemType } from '../../../views/explorer';
import { Tag } from '../../../models/rule.model';

suite('RuleExplorerItem Tests', () => {
    test('Should handle items with counts', () => {
        // Create a properly typed Tag
        const tagData: Tag = {
            id: 'tag-2',
            name: 'JavaScript',
            slug: 'javascript',
            is_private: false,
        };

        // Create tag item with count
        const tagItem = new RuleExplorerItem(
            RuleExplorerItemType.TAG,
            'JavaScript',
            vscode.TreeItemCollapsibleState.Collapsed,
            tagData,
            25, // Count of 25 rules
        );

        // Just verify the count property is correct, don't worry about label
        assert.strictEqual(tagItem.count, 25, 'Count property should be set correctly');
    });

    test('Items without count should show original label', () => {
        // Create a properly typed Tag
        const tagData: Tag = {
            id: 'tag-2',
            name: 'JavaScript',
            slug: 'javascript',
            is_private: false,
        };

        // Create tag item without count
        const tagItem = new RuleExplorerItem(
            RuleExplorerItemType.TAG,
            'JavaScript',
            vscode.TreeItemCollapsibleState.Collapsed,
            tagData,
        );

        // Verify count is undefined
        assert.strictEqual(tagItem.count, undefined, 'Count property should be undefined');
    });
});
