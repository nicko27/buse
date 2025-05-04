import { ConfigManager } from './configManager.js';

export class PluginConfig extends ConfigManager {
    constructor(config = {}) {
        super({
            // Configuration de base
            enabled: {
                type: 'boolean',
                default: true
            },
            debug: {
                type: 'boolean',
                default: false
            },
            execOrder: {
                type: 'number',
                default: 50,
                validate: value => value >= 0 && value <= 100
            },
            dependencies: {
                type: 'array',
                default: [],
                validate: value => Array.isArray(value) && value.every(item => typeof item === 'string')
            },
            // Configuration spécifique au plugin
            ...config
        });
    }

    /**
     * Valide la configuration du plugin
     * @param {Object} config - Configuration à valider
     * @returns {Object} - Configuration validée
     */
    validate(config) {
        const validated = super.validate(config);
        
        // Vérifier les dépendances
        if (validated.dependencies && validated.dependencies.length > 0) {
            const missingDeps = validated.dependencies.filter(dep => !this.isDependencyAvailable(dep));
            if (missingDeps.length > 0) {
                throw new Error(`Dépendances manquantes: ${missingDeps.join(', ')}`);
            }
        }

        return validated;
    }

    /**
     * Vérifie si une dépendance est disponible
     * @param {string} dependency - Nom de la dépendance
     * @returns {boolean}
     */
    isDependencyAvailable(dependency) {
        // À implémenter selon le système de gestion des plugins
        return true;
    }
} 