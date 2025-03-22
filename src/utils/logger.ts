import * as vscode from 'vscode';

/**
 * Log levels for the extension
 */
export enum LogLevel {
    ERROR = 'ERROR',
    WARN = 'WARN',
    INFO = 'INFO',
    DEBUG = 'DEBUG',
}

/**
 * Logger configuration
 */
interface LoggerConfig {
    level: LogLevel;
    outputToConsole: boolean;
    redactSensitiveData: boolean;
}

/**
 * Logger service for the extension
 */
export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private outputChannel: vscode.OutputChannel;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CodingRules.ai');
        this.config = {
            level: LogLevel.INFO,
            outputToConsole: false,
            redactSensitiveData: true,
        };
    }

    /**
     * Get singleton instance of Logger
     */
    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Configure the logger
     */
    public configure(config: Partial<LoggerConfig>): void {
        this.config = { ...this.config, ...config };
    }

    /**
     * Log an error message
     */
    public error(message: string, error?: any, context?: string): void {
        if (this.shouldLog(LogLevel.ERROR)) {
            const formattedMessage = this.formatMessage(LogLevel.ERROR, message, context);
            this.outputChannel.appendLine(formattedMessage);

            if (error) {
                const errorMessage = this.formatErrorObject(error);
                this.outputChannel.appendLine(errorMessage);
            }

            if (this.config.outputToConsole) {
                // Only log to console if explicitly enabled, which should be only in development
                console.error(formattedMessage, error ? error : '');
            }
        }
    }

    /**
     * Log a warning message
     */
    public warn(message: string, context?: string): void {
        if (this.shouldLog(LogLevel.WARN)) {
            const formattedMessage = this.formatMessage(LogLevel.WARN, message, context);
            this.outputChannel.appendLine(formattedMessage);

            if (this.config.outputToConsole) {
                console.warn(formattedMessage);
            }
        }
    }

    /**
     * Log an info message
     */
    public info(message: string, context?: string): void {
        if (this.shouldLog(LogLevel.INFO)) {
            const formattedMessage = this.formatMessage(LogLevel.INFO, message, context);
            this.outputChannel.appendLine(formattedMessage);

            if (this.config.outputToConsole) {
                console.log(formattedMessage);
            }
        }
    }

    /**
     * Log a debug message
     */
    public debug(message: string, context?: string): void {
        if (this.shouldLog(LogLevel.DEBUG)) {
            const formattedMessage = this.formatMessage(LogLevel.DEBUG, message, context);
            this.outputChannel.appendLine(formattedMessage);

            if (this.config.outputToConsole) {
                console.log(formattedMessage);
            }
        }
    }

    /**
     * Show the output channel
     */
    public show(): void {
        this.outputChannel.show();
    }

    /**
     * Format a message for logging
     */
    private formatMessage(level: LogLevel, message: string, context?: string): string {
        const timestamp = new Date().toISOString();
        const contextStr = context ? `[${context}] ` : '';
        let formattedMessage = `${timestamp} ${level} ${contextStr}${message}`;

        if (this.config.redactSensitiveData) {
            formattedMessage = this.redactSensitiveData(formattedMessage);
        }

        return formattedMessage;
    }

    /**
     * Format an error object for logging
     */
    private formatErrorObject(error: any): string {
        try {
            if (error instanceof Error) {
                let result = `Error: ${error.message}`;
                if (error.stack) {
                    result += `\nStack: ${error.stack}`;
                }
                return this.config.redactSensitiveData ? this.redactSensitiveData(result) : result;
            }

            return `Error details: ${JSON.stringify(error, null, 2)}`;
        } catch (formatError) {
            return 'Error formatting error object';
        }
    }

    /**
     * Check if a log level should be logged
     */
    private shouldLog(level: LogLevel): boolean {
        const levels = [LogLevel.ERROR, LogLevel.WARN, LogLevel.INFO, LogLevel.DEBUG];
        const configLevelIndex = levels.indexOf(this.config.level);
        const messageLevelIndex = levels.indexOf(level);

        return messageLevelIndex <= configLevelIndex;
    }

    /**
     * Redact sensitive data from log messages
     */
    private redactSensitiveData(message: string): string {
        // Redact UUIDs (common format for user IDs)
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
        message = message.replace(uuidRegex, '[REDACTED_ID]');

        // Redact email addresses
        const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        message = message.replace(emailRegex, '[REDACTED_EMAIL]');

        // Redact JWT tokens
        const jwtRegex = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
        message = message.replace(jwtRegex, '[REDACTED_TOKEN]');

        return message;
    }
}
