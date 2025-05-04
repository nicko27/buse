export class EventBus {
    constructor() {
        this.listeners = new Map();
        this.oneTimeListeners = new Map();
        this.maxListeners = 10;
    }

    on(event, callback, options = {}) {
        if (typeof callback !== 'function') {
            throw new Error('Le callback doit être une fonction');
        }

        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        const listeners = this.listeners.get(event);
        if (listeners.size >= this.maxListeners) {
            console.warn(`Nombre maximum d'écouteurs atteint pour l'événement ${event}`);
            return;
        }

        const listener = {
            callback,
            context: options.context || null,
            once: options.once || false
        };

        listeners.add(listener);

        // Retourner une fonction pour supprimer l'écouteur
        return () => this.off(event, callback);
    }

    once(event, callback, options = {}) {
        return this.on(event, callback, { ...options, once: true });
    }

    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const listeners = this.listeners.get(event);
        for (const listener of listeners) {
            if (listener.callback === callback) {
                listeners.delete(listener);
                break;
            }
        }

        if (listeners.size === 0) {
            this.listeners.delete(event);
        }
    }

    emit(event, data) {
        if (!this.listeners.has(event)) return;

        const listeners = this.listeners.get(event);
        const toRemove = new Set();

        for (const listener of listeners) {
            try {
                listener.callback.call(listener.context, data);
                if (listener.once) {
                    toRemove.add(listener);
                }
            } catch (error) {
                console.error(`Erreur dans l'écouteur de l'événement ${event}:`, error);
            }
        }

        // Supprimer les écouteurs one-time
        for (const listener of toRemove) {
            listeners.delete(listener);
        }

        if (listeners.size === 0) {
            this.listeners.delete(event);
        }
    }

    removeAllListeners(event) {
        if (event) {
            this.listeners.delete(event);
        } else {
            this.listeners.clear();
        }
    }

    listenerCount(event) {
        return this.listeners.get(event)?.size || 0;
    }

    setMaxListeners(n) {
        if (typeof n !== 'number' || n < 0) {
            throw new Error("Le nombre maximum d'écouteurs doit être un nombre positif");
        }
        this.maxListeners = n;
    }

    destroy() {
        this.removeAllListeners();
    }
} 