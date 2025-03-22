import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { AuthService } from '../../../services/auth.service';
import { createMockExtensionContext } from '../../utils/mocks';
import { SupabaseConfig } from '../../../config';
import { Logger } from '../../../utils/logger';
import * as supabaseJs from '@supabase/supabase-js';

suite('AuthService Tests', () => {
    let sandbox: sinon.SinonSandbox;
    let mockContext: vscode.ExtensionContext;
    let authService: AuthService;
    let createClientStub: sinon.SinonStub;

    setup(() => {
        sandbox = sinon.createSandbox();
        mockContext = createMockExtensionContext(sandbox);

        // Mock logger to avoid console output
        sandbox.stub(Logger.getInstance(), 'info');
        sandbox.stub(Logger.getInstance(), 'debug');
        sandbox.stub(Logger.getInstance(), 'error');
        sandbox.stub(Logger.getInstance(), 'warn');

        // Mock the context.secrets.get to return null (no stored session)
        (mockContext.secrets.get as sinon.SinonStub).resolves(null);

        // Mock globalState get and update for session storage
        (mockContext.globalState.get as sinon.SinonStub).returns(null);

        // Create createClient stub for all tests
        createClientStub = sandbox.stub(supabaseJs, 'createClient');
    });

    teardown(() => {
        sandbox.restore();
    });

    test('isAuthenticated should return false when no session exists', async () => {
        // Create the Supabase client mock
        const mockClient = {
            auth: {
                getSession: sandbox.stub().resolves({ data: { session: null }, error: null }),
                onAuthStateChange: sandbox.stub(),
            },
        };

        // Stub createClient to return our mock client
        createClientStub.returns(mockClient as any);

        // Initialize the auth service with proper config
        const supabaseConfig: SupabaseConfig = {
            url: 'https://test.supabase.co',
            anonKey: 'test-anon-key',
        };

        authService = await AuthService.initialize(supabaseConfig, mockContext);

        // Check if authenticated - should be false since we mocked no session
        assert.strictEqual(authService.isAuthenticated, false);
    });

    test('signOut should clear the session', async () => {
        // Create the Supabase client mock
        const mockClient = {
            auth: {
                getSession: sandbox.stub().resolves({ data: { session: null }, error: null }),
                onAuthStateChange: sandbox.stub(),
                signOut: sandbox.stub().resolves({ error: null }),
            },
        };

        // Stub createClient to return our mock client
        createClientStub.returns(mockClient as any);

        // Initialize the auth service with proper config
        const supabaseConfig: SupabaseConfig = {
            url: 'https://test.supabase.co',
            anonKey: 'test-anon-key',
        };

        authService = await AuthService.initialize(supabaseConfig, mockContext);

        // Need to explicitly set _currentUser value to test clearing it
        (authService as any)._currentUser = { id: 'test-id' };

        // Call signOut
        await authService.signOut();

        // Verify that signOut was called
        assert.strictEqual(mockClient.auth.signOut.calledOnce, true);

        // Verify user is null after sign out
        assert.strictEqual(authService.currentUser, null);

        // Verify that globalState.update was called to clear the session
        assert.ok((mockContext.globalState.update as sinon.SinonStub).calledWith('codingrules.authSession', undefined));
    });

    test('getAccessToken should return null when no session exists', async () => {
        // Create the Supabase client mock
        const mockClient = {
            auth: {
                getSession: sandbox.stub().resolves({ data: { session: null }, error: null }),
                onAuthStateChange: sandbox.stub(),
            },
        };

        // Stub createClient to return our mock client
        createClientStub.returns(mockClient as any);

        // Initialize the auth service with proper config
        const supabaseConfig: SupabaseConfig = {
            url: 'https://test.supabase.co',
            anonKey: 'test-anon-key',
        };

        authService = await AuthService.initialize(supabaseConfig, mockContext);

        // Call getAccessToken - should return null since there's no session
        const token = await authService.getAccessToken();

        // Verify that token is null
        assert.strictEqual(token, null);
    });
});
