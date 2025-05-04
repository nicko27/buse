/**
 * Gestionnaire d'événements pour TableFlow
 * 
 * Événements disponibles :
 * - 'row:added' : Émis lorsqu'une ligne est ajoutée
 *   - Paramètres : { row: HTMLElement, position: 'start'|'end', data: Object }
 * 
 * - 'row:removing' : Émis avant la suppression d'une ligne
 *   - Paramètres : { row: HTMLElement, rowId: string, data: Object }
 * 
 * - 'row:removed' : Émis après la suppression d'une ligne
 *   - Paramètres : { rowId: string }
 * 
 * - 'cell:modified' : Émis lorsqu'une cellule est modifiée
 *   - Paramètres : { cell: HTMLElement, oldValue: any, newValue: any }
 * 
 * - 'validation:start' : Émis au début d'une validation
 *   - Paramètres : { fields: string[] }
 * 
 * - 'validation:complete' : Émis à la fin d'une validation
 *   - Paramètres : { errors: Map<string, Array>, isValid: boolean }
 * 
 * - 'cache:miss' : Émis lors d'un échec de cache
 *   - Paramètres : { key: string }
 * 
 * - 'cache:hit' : Émis lors d'un succès de cache
 *   - Paramètres : { key: string, value: any }
 * 
 * - 'plugin:loaded' : Émis lorsqu'un plugin est chargé
 *   - Paramètres : { name: string, config: Object }
 * 
 * - 'plugin:error' : Émis en cas d'erreur de plugin
 *   - Paramètres : { name: string, error: Error }
 */
export class EventBus {
    constructor() {
        this.listeners = new Map();
        this.onceListeners = new Map();
        this.maxListeners = 10;
        this.debug = false;
    }

    setMaxListeners(n) {
        this.maxListeners = n;
    }

    setDebug(enabled) {
        this.debug = enabled;
    }

    on(event, callback, context = null) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }

        const listeners = this.listeners.get(event);
        const boundCallback = context ? callback.bind(context) : callback;
        
        // Avertissement si trop d'écouteurs
        if (listeners.size >= this.maxListeners) {
            console.warn(`Possible fuite de mémoire détectée: plus de ${this.maxListeners} écouteurs pour l'événement "${event}"`);
        }

        listeners.add(boundCallback);

        if (this.debug) {
            console.log(`[EventBus] Ajout d'un écouteur pour "${event}". Total: ${listeners.size}`);
        }

        // Retourner une fonction de nettoyage
        return () => this.off(event, boundCallback);
    }

    once(event, callback, context = null) {
        if (!this.onceListeners.has(event)) {
            this.onceListeners.set(event, new Set());
        }

        const listeners = this.onceListeners.get(event);
        const boundCallback = context ? callback.bind(context) : callback;
        listeners.add(boundCallback);

        if (this.debug) {
            console.log(`[EventBus] Ajout d'un écouteur unique pour "${event}"`);
        }
    }

    off(event, callback) {
        // Si aucun callback n'est fourni, supprimer tous les écouteurs de l'événement
        if (!callback) {
            if (this.debug) {
                console.log(`[EventBus] Suppression de tous les écouteurs pour "${event}"`);
            }
            this.listeners.delete(event);
            this.onceListeners.delete(event);
            return;
        }

        // Supprimer l'écouteur spécifique
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
            if (this.debug) {
                console.log(`[EventBus] Suppression d'un écouteur pour "${event}"`);
            }
        }

        if (this.onceListeners.has(event)) {
            this.onceListeners.get(event).delete(callback);
        }
    }

    emit(event, data) {
        const timestamp = Date.now();
        const eventData = {
            type: event,
            data,
            timestamp,
            target: this
        };

        // Appeler les écouteurs normaux
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => {
                try {
                    callback(eventData);
                } catch (error) {
                    console.error(`[EventBus] Erreur dans l'écouteur de "${event}":`, error);
                }
            });
        }

        // Appeler et supprimer les écouteurs uniques
        if (this.onceListeners.has(event)) {
            const onceCallbacks = Array.from(this.onceListeners.get(event));
            this.onceListeners.delete(event);
            onceCallbacks.forEach(callback => {
                try {
                    callback(eventData);
                } catch (error) {
                    console.error(`[EventBus] Erreur dans l'écouteur unique de "${event}":`, error);
                }
            });
        }

        if (this.debug) {
            console.log(`[EventBus] Événement "${event}" émis avec:`, data);
        }

        // Émettre aussi un événement 'all' pour les écouteurs globaux
        if (event !== 'all' && this.listeners.has('all')) {
            this.emit('all', eventData);
        }
    }

    // Émettre un événement de manière asynchrone
    emitAsync(event, data) {
        return Promise.resolve().then(() => {
            this.emit(event, data);
        });
    }

    // Attendre qu'un événement soit émis
    waitFor(event, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.off(event, handler);
                reject(new Error(`Timeout en attendant l'événement "${event}"`));
            }, timeout);

            const handler = (data) => {
                clearTimeout(timer);
                resolve(data);
            };

            this.once(event, handler);
        });
    }

    // Obtenir le nombre d'écouteurs pour un événement
    listenerCount(event) {
        const normalCount = this.listeners.get(event)?.size || 0;
        const onceCount = this.onceListeners.get(event)?.size || 0;
        return normalCount + onceCount;
    }

    // Obtenir la liste des événements avec des écouteurs
    eventNames() {
        const events = new Set([
            ...this.listeners.keys(),
            ...this.onceListeners.keys()
        ]);
        return Array.from(events);
    }

    // Supprimer tous les écouteurs
    removeAllListeners() {
        this.listeners.clear();
        this.onceListeners.clear();
        if (this.debug) {
            console.log('[EventBus] Tous les écouteurs ont été supprimés');
        }
    }
} 