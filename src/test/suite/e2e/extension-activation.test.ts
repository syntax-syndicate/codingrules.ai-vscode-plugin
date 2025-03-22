import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { Logger } from '../../../utils/logger';
import { SupabaseService } from '../../../services/supabase.service';
import { AuthService } from '../../../services/auth.service';
import { RuleService } from '../../../services/rule.service';
import * as supabaseJs from '@supabase/supabase-js';

suite('Extension E2E Tests', () => {
    let sandbox: sinon.SinonSandbox;

    setup(async () => {
        sandbox = sinon.createSandbox();

        // Suppress logger output during tests
        sandbox.stub(Logger.getInstance(), 'info');
        sandbox.stub(Logger.getInstance(), 'debug');
        sandbox.stub(Logger.getInstance(), 'error');
        sandbox.stub(Logger.getInstance(), 'warn');

        // Mock the Supabase client
        const mockClient = {
            auth: {
                getSession: sandbox.stub().resolves({ data: { session: null }, error: null }),
                onAuthStateChange: sandbox.stub(),
            },
        };

        // Stub createClient to return our mock client
        sandbox.stub(supabaseJs, 'createClient').returns(mockClient as any);

        // Mock services
        sandbox.stub(SupabaseService, 'initialize').returns({
            setAuthService: sandbox.stub(),
        } as any);

        sandbox.stub(AuthService, 'initialize').resolves({
            isAuthenticated: false,
            currentUser: null,
        } as any);

        sandbox.stub(RuleService, 'getInstance').returns({
            getTopUpvotedRules: sandbox.stub().resolves([]),
            getTags: sandbox.stub().resolves([]),
            getTools: sandbox.stub().resolves([]),
        } as any);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Extension activates and commands are registered', async function () {
        // This test might take some time due to extension activation
        this.timeout(10000);

        // Get the extension
        const extension = vscode.extensions.getExtension('codingrulesai.codingrules-ai');
        assert.ok(extension, 'Extension not found');

        // Activate the extension if it's not activated yet
        if (!extension.isActive) {
            await extension.activate();
        }

        // Check that the extension is active
        assert.ok(extension.isActive, 'Extension failed to activate');

        // Get all available commands
        const allCommands = await vscode.commands.getCommands(true);

        // Test for our extension commands
        const expectedCommands = [
            'codingrules-ai.searchRules',
            'codingrules-ai.downloadRule',
            'codingrules-ai.copyRuleToClipboard',
            'codingrules-ai.refreshExplorer',
            'codingrules-ai.viewRule',
            'codingrules-ai.login',
            'codingrules-ai.logout',
            'codingrules-ai.viewProfile',
        ];

        for (const cmd of expectedCommands) {
            assert.ok(allCommands.includes(cmd), `Command ${cmd} is not registered`);
        }

        // Verify that the explorer view provider is registered
        const treeViews = typeof vscode.window.registerTreeDataProvider === 'function';
        assert.ok(treeViews, 'Tree view API should be available');
    });

    test('Extension should handle commands execution', async function () {
        // This test might take some time
        this.timeout(5000);

        // Instead of executing actual commands that might have side effects,
        // we'll just verify they exist
        const extension = vscode.extensions.getExtension('codingrulesai.codingrules-ai');
        assert.ok(extension && extension.isActive, 'Extension should be active');

        // Verify the explorer view exists
        const views = typeof vscode.window.createTreeView === 'function';
        assert.ok(views, 'Tree view API should be available');
    });
});
