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
        this.channels = new Map();
        this.globalListeners = new Map();
    }

    /**
     * Crée un canal d'événements
     * @param {string} channel - Nom du canal
     */
    createChannel(channel) {
        if (!this.channels.has(channel)) {
            this.channels.set(channel, new Map());
        }
    }

    /**
     * Supprime un canal d'événements
     * @param {string} channel - Nom du canal
     */
    removeChannel(channel) {
        this.channels.delete(channel);
    }

    /**
     * Écoute un événement sur un canal spécifique
     * @param {string} channel - Nom du canal
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction de callback
     * @returns {Function} - Fonction pour supprimer l'écouteur
     */
    on(channel, event, callback) {
        if (!this.channels.has(channel)) {
            this.createChannel(channel);
        }

        const channelListeners = this.channels.get(channel);
        if (!channelListeners.has(event)) {
            channelListeners.set(event, new Set());
        }

        channelListeners.get(event).add(callback);

        return () => this.off(channel, event, callback);
    }

    /**
     * Écoute un événement global
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction de callback
     * @returns {Function} - Fonction pour supprimer l'écouteur
     */
    onGlobal(event, callback) {
        if (!this.globalListeners.has(event)) {
            this.globalListeners.set(event, new Set());
        }

        this.globalListeners.get(event).add(callback);

        return () => this.offGlobal(event, callback);
    }

    /**
     * Supprime un écouteur d'événement d'un canal
     * @param {string} channel - Nom du canal
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction de callback
     */
    off(channel, event, callback) {
        if (this.channels.has(channel)) {
            const channelListeners = this.channels.get(channel);
            if (channelListeners.has(event)) {
                channelListeners.get(event).delete(callback);
            }
        }
    }

    /**
     * Supprime un écouteur d'événement global
     * @param {string} event - Nom de l'événement
     * @param {Function} callback - Fonction de callback
     */
    offGlobal(event, callback) {
        if (this.globalListeners.has(event)) {
            this.globalListeners.get(event).delete(callback);
        }
    }

    /**
     * Émet un événement sur un canal spécifique
     * @param {string} channel - Nom du canal
     * @param {string} event - Nom de l'événement
     * @param {*} data - Données de l'événement
     */
    emit(channel, event, data) {
        // Émettre sur le canal spécifique
        if (this.channels.has(channel)) {
            const channelListeners = this.channels.get(channel);
            if (channelListeners.has(event)) {
                channelListeners.get(event).forEach(callback => {
                    try {
                        callback(data);
                    } catch (error) {
                        console.error(`Erreur dans l'écouteur d'événement ${channel}.${event}:`, error);
                    }
                });
            }
        }

        // Émettre sur les écouteurs globaux
        if (this.globalListeners.has(event)) {
            this.globalListeners.get(event).forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Erreur dans l'écouteur global d'événement ${event}:`, error);
                }
            });
        }
    }

    /**
     * Détruit l'EventBus et nettoie toutes les références
     */
    destroy() {
        this.channels.clear();
        this.globalListeners.clear();
    }
} 