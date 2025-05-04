import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';

// Types d'événements
export const STATE_EVENTS = {
    CHANGE: 'state:change',
    DELETE: 'state:delete',
    CLEAR: 'state:clear',
    LOCK: 'state:lock',
    UNLOCK: 'state:unlock',
    UNDO: 'state:undo',
    REDO: 'state:redo'
};

// Types d'erreurs
export const STATE_ERRORS = {
    INVALID_KEY: 'INVALID_KEY',
    LOCKED_KEY: 'LOCKED_KEY',
    VALIDATION_FAILED: 'VALIDATION_FAILED',
    INVALID_OPTIONS: 'INVALID_OPTIONS',
    CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION'
};

export class StateManager {
    constructor(options = {}) {
        this.logger = new Logger('StateManager');
        this.eventBus = new EventBus();
        this.state = new Map();
        this.locks = new Map();
        this.validationRules = new Map();
        this.history = new Map();
        this.undoStack = new Map();
        this.redoStack = new Map();
        this.pendingOperations = new Map();
        
        // Validation des options
        if (options.maxHistorySize !== undefined) {
            if (typeof options.maxHistorySize !== 'number' || options.maxHistorySize <= 0) {
                throw new Error(`${STATE_ERRORS.INVALID_OPTIONS}: maxHistorySize doit être un nombre positif`);
            }
            this.maxHistorySize = options.maxHistorySize;
        } else {
            this.maxHistorySize = 100;
        }
    }

    async set(key, value, options = {}) {
        if (!key || typeof key !== 'string') {
            throw new Error(`${STATE_ERRORS.INVALID_KEY}: La clé doit être une chaîne de caractères`);
        }

        // Gestion de la concurrence
        if (this.pendingOperations.has(key)) {
            throw new Error(`${STATE_ERRORS.CONCURRENT_MODIFICATION}: La clé ${key} est en cours de modification`);
        }
        this.pendingOperations.set(key, true);

        try {
            // Vérifier si la clé est verrouillée
            if (this.locks.has(key)) {
                throw new Error(`${STATE_ERRORS.LOCKED_KEY}: La clé ${key} est actuellement verrouillée`);
            }

            // Valider la valeur
            if (this.validationRules.has(key)) {
                const isValid = await this.validationRules.get(key)(value);
                if (!isValid) {
                    throw new Error(`${STATE_ERRORS.VALIDATION_FAILED}: Valeur invalide pour la clé ${key}`);
                }
            }

            // Verrouiller la clé si nécessaire
            if (options.lock) {
                this.locks.set(key, true);
                this.eventBus.emit(STATE_EVENTS.LOCK, { key });
            }

            // Sauvegarder l'ancienne valeur dans l'historique
            const oldValue = this.state.get(key);
            this.addToHistory(key, oldValue);

            // Mettre à jour l'état
            this.state.set(key, value);

            // Émettre l'événement de changement
            this.eventBus.emit(STATE_EVENTS.CHANGE, {
                key,
                oldValue,
                newValue: value
            });

            return true;
        } catch (error) {
            this.logger.error(`Erreur lors de la mise à jour de l'état pour ${key}: ${error.message}`);
            throw error;
        } finally {
            this.pendingOperations.delete(key);
            if (options.lock) {
                this.locks.delete(key);
                this.eventBus.emit(STATE_EVENTS.UNLOCK, { key });
            }
        }
    }

    get(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('La clé doit être une chaîne de caractères');
        }
        return this.state.get(key);
    }

    has(key) {
        return this.state.has(key);
    }

    delete(key) {
        if (!key || typeof key !== 'string') {
            throw new Error('La clé doit être une chaîne de caractères');
        }

        if (this.locks.has(key)) {
            throw new Error(`La clé ${key} est actuellement verrouillée`);
        }

        const oldValue = this.state.get(key);
        this.state.delete(key);
        this.addToHistory(key, oldValue);

        this.eventBus.emit('state:delete', {
            key,
            oldValue
        });
    }

    addToHistory(key, value) {
        if (!this.history.has(key)) {
            this.history.set(key, new CircularBuffer(this.maxHistorySize));
        }

        const history = this.history.get(key);
        history.push({
            value,
            timestamp: Date.now()
        });
    }

    getHistory(key) {
        return this.history.get(key) || [];
    }

    setValidationRule(key, validator) {
        if (typeof validator !== 'function') {
            throw new Error('Le validateur doit être une fonction');
        }
        this.validationRules.set(key, validator);
    }

    removeValidationRule(key) {
        this.validationRules.delete(key);
    }

    lock(key) {
        if (this.locks.has(key)) {
            throw new Error(`La clé ${key} est déjà verrouillée`);
        }
        this.locks.set(key, true);
    }

    unlock(key) {
        this.locks.delete(key);
    }

    isLocked(key) {
        return this.locks.has(key);
    }

    clear() {
        this.state.clear();
        this.locks.clear();
        this.history.clear();
        this.validationRules.clear();
        this.eventBus.emit('state:clear');
    }

    destroy() {
        this.clear();
        this.eventBus.destroy();
    }

    undo(key) {
        if (!this.history.has(key)) {
            return false;
        }

        const history = this.history.get(key);
        const previousState = history.pop();
        if (!previousState) {
            return false;
        }

        const currentValue = this.state.get(key);
        this.state.set(key, previousState.value);
        this.redoStack.set(key, currentValue);

        this.eventBus.emit(STATE_EVENTS.UNDO, {
            key,
            oldValue: currentValue,
            newValue: previousState.value
        });

        return true;
    }

    redo(key) {
        if (!this.redoStack.has(key)) {
            return false;
        }

        const value = this.redoStack.get(key);
        this.redoStack.delete(key);
        this.state.set(key, value);

        this.eventBus.emit(STATE_EVENTS.REDO, {
            key,
            newValue: value
        });

        return true;
    }
}

// Implémentation d'un buffer circulaire pour une meilleure performance
class CircularBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.buffer = new Array(capacity);
        this.start = 0;
        this.end = 0;
        this.size = 0;
    }

    push(item) {
        this.buffer[this.end] = item;
        this.end = (this.end + 1) % this.capacity;
        if (this.size === this.capacity) {
            this.start = (this.start + 1) % this.capacity;
        } else {
            this.size++;
        }
    }

    pop() {
        if (this.size === 0) {
            return null;
        }
        this.end = (this.end - 1 + this.capacity) % this.capacity;
        const item = this.buffer[this.end];
        this.size--;
        return item;
    }
} 