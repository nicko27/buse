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
        this.globalListeners = new Set();
        this.channels = new Map();
    }

    /**
     * Émet un événement
     * @param {string} event - Nom de l'événement
     * @param {any} data - Données de l'événement
     * @param {string} [channel] - Canal optionnel
     */
    emit(event, data, channel) {
        // Notifier les écouteurs globaux
        this.globalListeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error(`Erreur dans l'écouteur global pour ${event}:`, error);
            }
        });

        // Notifier les écouteurs spécifiques
        const eventListeners = this.listeners.get(event) || new Set();
        eventListeners.forEach(listener => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Erreur dans l'écouteur pour ${event}:`, error);
            }
        });

        // Notifier les écouteurs du canal
        if (channel) {
            const channelListeners = this.channels.get(channel) || new Set();
            channelListeners.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    console.error(`Erreur dans l'écouteur du canal ${channel} pour ${event}:`, error);
                }
            });
        }
    }

    /**
     * Ajoute un écouteur d'événement
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction de callback
     * @returns {Function} Fonction de désinscription
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
        return () => this.off(event, callback);
    }

    /**
     * Supprime un écouteur d'événement
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction de callback
     */
    off(event, callback) {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.delete(callback);
            if (eventListeners.size === 0) {
                this.listeners.delete(event);
            }
        }
    }

    /**
     * Ajoute un écouteur global
     * @param {Function} callback - Fonction de callback
     * @returns {Function} Fonction de désinscription
     */
    onGlobal(callback) {
        this.globalListeners.add(callback);
        return () => this.offGlobal(callback);
    }

    /**
     * Supprime un écouteur global
     * @param {Function} callback - Fonction de callback
     */
    offGlobal(callback) {
        this.globalListeners.delete(callback);
    }

    /**
     * S'abonne à un canal
     * @param {string} channel - Nom du canal
     * @param {Function} callback - Fonction de callback
     * @returns {Function} Fonction de désinscription
     */
    subscribe(channel, callback) {
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Set());
        }
        this.channels.get(channel).add(callback);
        return () => this.unsubscribe(channel, callback);
    }

    /**
     * Se désabonne d'un canal
     * @param {string} channel - Nom du canal
     * @param {Function} callback - Fonction de callback
     */
    unsubscribe(channel, callback) {
        const channelListeners = this.channels.get(channel);
        if (channelListeners) {
            channelListeners.delete(callback);
            if (channelListeners.size === 0) {
                this.channels.delete(channel);
            }
        }
    }

    /**
     * Nettoie tous les écouteurs
     */
    destroy() {
        this.listeners.clear();
        this.globalListeners.clear();
        this.channels.clear();
    }
} 