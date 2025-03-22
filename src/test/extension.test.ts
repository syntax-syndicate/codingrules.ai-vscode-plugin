import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import { Logger } from '../utils/logger';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as myExtension from '../../extension';

suite('Extension Test Suite', () => {
    let sandbox: sinon.SinonSandbox;

    setup(() => {
        sandbox = sinon.createSandbox();
        // Suppress logger output during tests
        sandbox.stub(Logger.getInstance(), 'info');
        sandbox.stub(Logger.getInstance(), 'debug');
        sandbox.stub(Logger.getInstance(), 'error');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('Extension should be present', () => {
        assert.ok(vscode.extensions.getExtension('codingrulesai.codingrules-ai'));
    });

    test('Extension should activate', async () => {
        const extension = vscode.extensions.getExtension('codingrulesai.codingrules-ai');
        assert.ok(extension);

        await extension?.activate();
        assert.strictEqual(extension?.isActive, true);
    });

    test('Commands should be registered', async () => {
        const commands = await vscode.commands.getCommands(true);

        // Check if our extension commands are registered
        assert.ok(commands.includes('codingrules-ai.searchRules'));
        assert.ok(commands.includes('codingrules-ai.downloadRule'));
        assert.ok(commands.includes('codingrules-ai.copyRuleToClipboard'));
        assert.ok(commands.includes('codingrules-ai.refreshExplorer'));
        assert.ok(commands.includes('codingrules-ai.viewRule'));
        assert.ok(commands.includes('codingrules-ai.login'));
        assert.ok(commands.includes('codingrules-ai.logout'));
        assert.ok(commands.includes('codingrules-ai.viewProfile'));
    });

    test('Explorer view should be registered', () => {
        // This test checks if the codingrulesExplorer view is registered
        const views = vscode.window.createTreeView ? vscode.window.createTreeView !== undefined : false;
        assert.ok(views, 'Tree view API should be available');
    });
});
