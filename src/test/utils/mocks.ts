import * as sinon from 'sinon';
import * as vscode from 'vscode';

/**
 * Creates a mock extension context for testing
 */
export function createMockExtensionContext(sandbox: sinon.SinonSandbox): vscode.ExtensionContext {
    return {
        subscriptions: [],
        extensionPath: '',
        extensionUri: vscode.Uri.parse('file:///extension'),
        environmentVariableCollection: {} as any,
        asAbsolutePath: (path) => path,
        storageUri: undefined,
        globalStorageUri: vscode.Uri.parse('file:///global-storage'),
        logUri: vscode.Uri.parse('file:///log'),
        extensionMode: vscode.ExtensionMode.Test,
        globalState: {
            get: sandbox.stub(),
            update: sandbox.stub().resolves(),
            setKeysForSync: sandbox.stub(),
        } as any,
        workspaceState: {
            get: sandbox.stub(),
            update: sandbox.stub().resolves(),
            setKeysForSync: sandbox.stub(),
        } as any,
        secrets: {
            get: sandbox.stub(),
            store: sandbox.stub().resolves(),
            delete: sandbox.stub().resolves(),
        } as any,
        storagePath: '',
        globalStoragePath: '',
        logPath: '',
        extension: {} as any,
        // Mock additional required properties
        languageModelAccessInformation: {} as vscode.LanguageModelAccessInformation,
    } as vscode.ExtensionContext;
}
