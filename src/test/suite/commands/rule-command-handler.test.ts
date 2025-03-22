import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { RuleCommandHandler } from '../../../commands';
import { createMockExtensionContext } from '../../utils/mocks';
import { RuleService } from '../../../services/rule.service';
import { SupabaseService } from '../../../services/supabase.service';
import { Logger } from '../../../utils/logger';

suite('RuleCommandHandler Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let ruleCommandHandler: RuleCommandHandler;
    let mockRuleService: any;
    let mockSupabaseService: any;

    setup(() => {
        sandbox = sinon.createSandbox();

        // Create a mock extension context using the factory
        mockContext = createMockExtensionContext(sandbox);

        // Mock logger to prevent console output
        sandbox.stub(Logger.getInstance(), 'info');
        sandbox.stub(Logger.getInstance(), 'debug');
        sandbox.stub(Logger.getInstance(), 'error');

        // Create mock services
        mockRuleService = {
            getRuleById: sandbox.stub().resolves({}),
            searchRules: sandbox.stub().resolves([]),
        };

        mockSupabaseService = {
            setAuthService: sandbox.stub(),
        };

        // Stub service singletons
        sandbox.stub(RuleService, 'getInstance').returns(mockRuleService);
        sandbox.stub(SupabaseService, 'getInstance').returns(mockSupabaseService);

        // Create an instance of RuleCommandHandler
        ruleCommandHandler = new RuleCommandHandler(mockContext);
    });

    teardown(() => {
        sandbox.restore();
    });

    test('register should add commands to context.subscriptions', () => {
        // Create a disposable object for the mock
        const disposable = { dispose: sandbox.stub() };

        // Stub the registerCommand method to return our disposable
        const _registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').returns(disposable);

        // Spy on the private register methods to ensure they're called
        const viewRuleSpy = sandbox.spy(ruleCommandHandler as any, 'registerViewRuleCommand');
        const downloadRuleSpy = sandbox.spy(ruleCommandHandler as any, 'registerDownloadRuleCommand');
        const copyRuleContentSpy = sandbox.spy(ruleCommandHandler as any, 'registerCopyRuleContentCommand');
        const copyRuleToClipboardSpy = sandbox.spy(ruleCommandHandler as any, 'registerCopyRuleToClipboardCommand');

        // Call the register method
        ruleCommandHandler.register();

        // Verify that the private register methods were called
        assert.strictEqual(viewRuleSpy.calledOnce, true, 'registerViewRuleCommand should be called');
        assert.strictEqual(downloadRuleSpy.calledOnce, true, 'registerDownloadRuleCommand should be called');
        assert.strictEqual(copyRuleContentSpy.calledOnce, true, 'registerCopyRuleContentCommand should be called');
        assert.strictEqual(
            copyRuleToClipboardSpy.calledOnce,
            true,
            'registerCopyRuleToClipboardCommand should be called',
        );

        // Verify that context.subscriptions were updated (due to the register methods called above)
        assert.strictEqual(mockContext.subscriptions.length > 0, true);
    });
});
