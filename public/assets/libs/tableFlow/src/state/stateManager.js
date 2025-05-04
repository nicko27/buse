import { Logger } from './logger.js';
import { EventBus } from './eventBus.js';

export class GlobalStateManager {
    constructor(options = {}) {
        this.logger = new Logger('GlobalStateManager');
        this.eventBus = new EventBus();
        this.options = {
            persist: false,
            storageKey: 'tableflow_global_state',
            ...options
        };

        this.state = new Map();
        this.subscribers = new Map();

        if (this.options.persist) {
            this.loadPersistedState();
        }

        this.logger.info('GlobalStateManager initialisé');
    }

    // ... existing code ...
} 