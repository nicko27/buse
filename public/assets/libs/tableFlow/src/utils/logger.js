export class Logger {
    constructor(context, config = {}) {
        this.context = context;
        this.config = {
            level: 'info',
            colors: true,
            timestamp: true,
            prefix: true,
            console: true,
            customHandler: null,
            ...config
        };

        this.levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };

        this.colors = {
            error: '\x1b[31m', // Rouge
            warn: '\x1b[33m',  // Jaune
            info: '\x1b[36m',  // Cyan
            debug: '\x1b[32m', // Vert
            trace: '\x1b[90m', // Gris
            reset: '\x1b[0m'   // Reset
        };
    }

    setLevel(level) {
        if (this.levels[level] !== undefined) {
            this.config.level = level;
        }
    }

    setCustomHandler(handler) {
        if (typeof handler === 'function') {
            this.config.customHandler = handler;
        }
    }

    formatMessage(level, message, data) {
        const parts = [];

        // Timestamp
        if (this.config.timestamp) {
            parts.push(`[${new Date().toISOString()}]`);
        }

        // Context
        if (this.config.prefix) {
            parts.push(`[${this.context}]`);
        }

        // Level
        parts.push(`[${level.toUpperCase()}]`);

        // Message
        parts.push(message);

        // Data
        if (data !== undefined) {
            if (typeof data === 'object') {
                try {
                    parts.push(JSON.stringify(data));
                } catch (e) {
                    parts.push(String(data));
                }
            } else {
                parts.push(String(data));
            }
        }

        return parts.join(' ');
    }

    colorize(level, message) {
        if (!this.config.colors) return message;
        return `${this.colors[level]}${message}${this.colors.reset}`;
    }

    shouldLog(level) {
        return this.levels[level] <= this.levels[this.config.level];
    }

    log(level, message, ...args) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, args.length > 0 ? args : undefined);
        const colorizedMessage = this.colorize(level, formattedMessage);

        // Custom handler
        if (this.config.customHandler) {
            this.config.customHandler({
                level,
                message: formattedMessage,
                context: this.context,
                timestamp: new Date(),
                data: args
            });
        }

        // Console output
        if (this.config.console) {
            switch (level) {
                case 'error':
                    console.error(colorizedMessage);
                    break;
                case 'warn':
                    console.warn(colorizedMessage);
                    break;
                case 'info':
                    console.info(colorizedMessage);
                    break;
                case 'debug':
                    console.debug(colorizedMessage);
                    break;
                default:
                    console.log(colorizedMessage);
            }
        }
    }

    error(message, ...args) {
        this.log('error', message, ...args);
    }

    warn(message, ...args) {
        this.log('warn', message, ...args);
    }

    info(message, ...args) {
        this.log('info', message, ...args);
    }

    debug(message, ...args) {
        this.log('debug', message, ...args);
    }

    trace(message, ...args) {
        this.log('trace', message, ...args);
    }

    // Méthodes utilitaires
    group(label) {
        if (this.config.console && console.group) {
            console.group(this.colorize('info', label));
        }
    }

    groupEnd() {
        if (this.config.console && console.groupEnd) {
            console.groupEnd();
        }
    }

    // Mesure de performance
    time(label) {
        if (this.config.console && console.time) {
            console.time(label);
        }
    }

    timeEnd(label) {
        if (this.config.console && console.timeEnd) {
            console.timeEnd(label);
        }
    }

    // Capture des erreurs non gérées
    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this.error('Erreur non gérée:', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error
            });
        });

        window.addEventListener('unhandledrejection', (event) => {
            this.error('Promesse rejetée non gérée:', {
                reason: event.reason
            });
        });
    }
} 