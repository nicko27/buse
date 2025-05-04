import { PluginConfig } from '../config/pluginConfig.js';
import { Logger } from '../utils/logger.js';

export class BasePlugin {
    constructor(config = {}) {
        // Configuration
        this.config = new PluginConfig(config);
        
        // Logger
        this.logger = new Logger(this.constructor.name, {
            debug: this.config.get('debug')
        });

        // État
        this.initialized = false;
        this.destroyed = false;
    }

    /**
     * Initialise le plugin de manière asynchrone
     * @param {Object} context - Contexte d'initialisation
     * @returns {Promise<void>}
     */
    async init(context) {
        if (this.initialized) {
            this.logger.warn('Plugin déjà initialisé');
            return;
        }

        try {
            this.logger.info('Démarrage de l\'initialisation...');

            // Valider la configuration
            this.config.validate(this.config.getConfig());

            // Vérifier les dépendances
            await this.checkDependencies(context);

            // Initialisation spécifique au plugin
            await this.onInit(context);

            this.initialized = true;
            this.logger.success('Initialisation terminée avec succès');
        } catch (error) {
            this.logger.error('Erreur lors de l\'initialisation:', error);
            throw error;
        }
    }

    /**
     * Vérifie les dépendances du plugin
     * @param {Object} context - Contexte d'initialisation
     * @returns {Promise<void>}
     */
    async checkDependencies(context) {
        const dependencies = this.config.get('dependencies');
        if (dependencies.length === 0) return;

        this.logger.info('Vérification des dépendances...');
        
        for (const dep of dependencies) {
            if (!context.hasPlugin?.(dep)) {
                throw new Error(`Dépendance manquante: ${dep}`);
            }
        }
    }

    /**
     * Méthode à surcharger pour l'initialisation spécifique au plugin
     * @param {Object} context - Contexte d'initialisation
     * @returns {Promise<void>}
     */
    async onInit(context) {
        // À implémenter par les plugins enfants
    }

    /**
     * Active le plugin
     */
    enable() {
        if (!this.initialized) {
            throw new Error('Plugin non initialisé');
        }
        this.config.set('enabled', true);
        this.logger.info('Plugin activé');
    }

    /**
     * Désactive le plugin
     */
    disable() {
        if (!this.initialized) {
            throw new Error('Plugin non initialisé');
        }
        this.config.set('enabled', false);
        this.logger.info('Plugin désactivé');
    }

    /**
     * Rafraîchit le plugin
     */
    async refresh() {
        if (!this.initialized) {
            throw new Error('Plugin non initialisé');
        }
        if (!this.config.get('enabled')) {
            return;
        }
        await this.onRefresh();
    }

    /**
     * Méthode à surcharger pour le rafraîchissement spécifique au plugin
     * @returns {Promise<void>}
     */
    async onRefresh() {
        // À implémenter par les plugins enfants
    }

    /**
     * Détruit le plugin
     */
    async destroy() {
        if (this.destroyed) {
            return;
        }

        try {
            this.logger.info('Démarrage de la destruction...');
            await this.onDestroy();
            this.destroyed = true;
            this.logger.success('Destruction terminée avec succès');
        } catch (error) {
            this.logger.error('Erreur lors de la destruction:', error);
            throw error;
        }
    }

    /**
     * Méthode à surcharger pour la destruction spécifique au plugin
     * @returns {Promise<void>}
     */
    async onDestroy() {
        // À implémenter par les plugins enfants
    }
} 