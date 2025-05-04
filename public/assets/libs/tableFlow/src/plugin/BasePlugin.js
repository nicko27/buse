/**
 * Classe de base pour tous les plugins TableFlow
 * @class BasePlugin
 */
export class BasePlugin {
    /**
     * @param {Object} tableFlow - Instance de TableFlow
     * @param {Object} options - Options de configuration du plugin
     */
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.options = options;
        this.config = options;
        this.initialized = false;
    }

    /**
     * Initialise le plugin
     * @async
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;
        this.initialized = true;
    }

    /**
     * Détruit le plugin et nettoie les ressources
     */
    destroy() {
        this.initialized = false;
    }

    /**
     * Log un message
     * @param {string} message - Message à logger
     * @param {string} [level='info'] - Niveau de log
     */
    log(message, level = 'info') {
        if (this.tableFlow.logger) {
            this.tableFlow.logger[level](`[${this.constructor.name}] ${message}`);
        }
    }

    /**
     * Gère une erreur
     * @param {Error} error - Erreur à gérer
     */
    handleError(error) {
        if (this.tableFlow.errorHandler) {
            this.tableFlow.errorHandler.handle(error, this.tableFlow.errorHandler.errorTypes.PLUGIN);
        }
    }
} 