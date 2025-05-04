import { PLUGIN_TYPES } from '../types.js';
import { Logger } from './utils/logger.js';

export default class InstancePluginManager {
    constructor(config = {}) {
        this.plugins = new Map();
        this.config = {
            debug: false,
            ...config
        };
        this.logger = new Logger('InstancePluginManager');

        this.debug = this.config.debug ? 
            (...args) => this.logger.debug(...args) : 
            () => {};

        // Handlers liés
        this._boundPluginChangeHandler = this.handlePluginChange.bind(this);
        
        // Référence au registre de plugins
        this.pluginRegistry = null;
    }

    /**
     * Initialise le gestionnaire de plugins
     * @param {PluginRegistry} pluginRegistry - Le registre de plugins
     */
    init(pluginRegistry) {
        if (!pluginRegistry) {
            throw new Error('PluginRegistry requis pour initialiser le gestionnaire de plugins');
        }
        this.pluginRegistry = pluginRegistry;
        
        // Ajouter les écouteurs d'événements
        document.addEventListener('plugin:change', this._boundPluginChangeHandler);
    }

    /**
     * Gère les changements de plugins
     * @param {Event} e - L'événement de changement de plugin
     */
    handlePluginChange(e) {
        const { pluginId, action } = e.detail;
        if (action === 'enable') {
            this.enablePlugin(pluginId);
        } else if (action === 'disable') {
            this.disablePlugin(pluginId);
        }
    }

    /**
     * Enregistre un plugin
     * @param {Object} plugin - Le plugin à enregistrer
     */
    registerPlugin(plugin) {
        if (!plugin.id || !plugin.instance) {
            throw new Error('Plugin invalide: id et instance requis');
        }

        if (this.plugins.has(plugin.id)) {
            throw new Error(`Plugin ${plugin.id} déjà enregistré`);
        }

        this.plugins.set(plugin.id, {
            instance: plugin.instance,
            enabled: true,
            config: plugin.config || {}
        });

        this.debug(`Plugin enregistré: ${plugin.id}`);
    }

    /**
     * Désenregistre un plugin
     * @param {string} pluginId - L'ID du plugin à désenregistrer
     */
    unregisterPlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin) {
            if (typeof plugin.instance.destroy === 'function') {
                plugin.instance.destroy();
            }
            this.plugins.delete(pluginId);
            this.debug(`Plugin désenregistré: ${pluginId}`);
        }
    }

    getPlugin(pluginId) {
        return this.plugins.get(pluginId)?.instance;
    }

    /**
     * Active un plugin
     * @param {string} pluginId - L'ID du plugin à activer
     */
    enablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin && !plugin.enabled) {
            plugin.enabled = true;
            if (typeof plugin.instance.enable === 'function') {
                plugin.instance.enable();
            }
            this.debug(`Plugin activé: ${pluginId}`);
        }
    }

    /**
     * Désactive un plugin
     * @param {string} pluginId - L'ID du plugin à désactiver
     */
    disablePlugin(pluginId) {
        const plugin = this.plugins.get(pluginId);
        if (plugin && plugin.enabled) {
            plugin.enabled = false;
            if (typeof plugin.instance.disable === 'function') {
                plugin.instance.disable();
            }
            this.debug(`Plugin désactivé: ${pluginId}`);
        }
    }

    /**
     * Rafraîchit tous les plugins
     */
    refreshPlugins() {
        this.plugins.forEach((plugin, id) => {
            if (plugin.enabled && typeof plugin.instance.refresh === 'function') {
                try {
                    plugin.instance.refresh();
                    this.debug(`Plugin rafraîchi: ${id}`);
                } catch (error) {
                    console.error(`Erreur lors du rafraîchissement du plugin ${id}:`, error);
                }
            }
        });
    }

    /**
     * Détruit le gestionnaire de plugins
     */
    destroy() {
        // Supprimer les écouteurs d'événements
        document.removeEventListener('plugin:change', this._boundPluginChangeHandler);

        // Détruire tous les plugins
        this.plugins.forEach((plugin, id) => {
            if (typeof plugin.instance.destroy === 'function') {
                try {
                    plugin.instance.destroy();
                    this.debug(`Plugin détruit: ${id}`);
                } catch (error) {
                    console.error(`Erreur lors de la destruction du plugin ${id}:`, error);
                }
            }
        });

        // Vider la Map des plugins
        this.plugins.clear();
    }

    /**
     * Active un plugin par son nom
     * @param {string} name - Le nom du plugin
     * @param {Object} config - La configuration du plugin
     */
    async activate(name, config = {}) {
        if (!this.pluginRegistry) {
            throw new Error('PluginRegistry non initialisé');
        }

        try {
            const PluginClass = await this.pluginRegistry.load(name);
            const plugin = new PluginClass(config);
            this.registerPlugin({
                id: name,
                instance: plugin,
                config
            });
            return plugin;
        } catch (error) {
            this.debug(`Erreur lors de l'activation du plugin ${name}:`, error);
            throw error;
        }
    }

    /**
     * Vérifie les dépendances d'un plugin
     * @param {string} pluginId - ID du plugin
     * @param {Array<string>} dependencies - Liste des dépendances
     * @returns {boolean} True si toutes les dépendances sont satisfaites
     */
    checkDependencies(pluginId, dependencies = []) {
        for (const dep of dependencies) {
            if (!this.plugins.has(dep)) {
                this.debug(`Dépendance manquante pour ${pluginId}: ${dep}`);
                return false;
            }
        }
        return true;
    }

    /**
     * Vérifie les conflits potentiels entre plugins
     * @param {string} pluginId - ID du plugin
     * @param {Array<string>} conflicts - Liste des plugins en conflit
     * @returns {boolean} True si aucun conflit n'est détecté
     */
    checkConflicts(pluginId, conflicts = []) {
        for (const conflict of conflicts) {
            if (this.plugins.has(conflict)) {
                this.debug(`Conflit détecté pour ${pluginId}: ${conflict}`);
                return false;
            }
        }
        return true;
    }

    /**
     * Initialise un plugin avec ses dépendances
     * @param {string} pluginId - ID du plugin
     * @param {Object} config - Configuration du plugin
     */
    async initializePlugin(pluginId, config = {}) {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) {
            throw new Error(`Plugin ${pluginId} non trouvé`);
        }

        // Vérifier les dépendances
        if (plugin.instance.dependencies && !this.checkDependencies(pluginId, plugin.instance.dependencies)) {
            throw new Error(`Dépendances manquantes pour ${pluginId}`);
        }

        // Vérifier les conflits
        if (plugin.instance.conflicts && !this.checkConflicts(pluginId, plugin.instance.conflicts)) {
            throw new Error(`Conflits détectés pour ${pluginId}`);
        }

        // Initialiser le plugin
        await plugin.instance.init(config);
        this.debug(`Plugin initialisé: ${pluginId}`);
    }

    /**
     * Désactive tous les plugins
     */
    disableAllPlugins() {
        this.plugins.forEach((plugin, id) => {
            if (plugin.enabled) {
                this.disablePlugin(id);
            }
        });
    }

    /**
     * Active tous les plugins
     */
    enableAllPlugins() {
        this.plugins.forEach((plugin, id) => {
            if (!plugin.enabled) {
                this.enablePlugin(id);
            }
        });
    }

    /**
     * Récupère la liste des plugins actifs
     * @returns {Array<string>} Liste des IDs des plugins actifs
     */
    getActivePlugins() {
        return Array.from(this.plugins.entries())
            .filter(([_, plugin]) => plugin.enabled)
            .map(([id]) => id);
    }

    /**
     * Récupère la liste des plugins inactifs
     * @returns {Array<string>} Liste des IDs des plugins inactifs
     */
    getInactivePlugins() {
        return Array.from(this.plugins.entries())
            .filter(([_, plugin]) => !plugin.enabled)
            .map(([id]) => id);
    }
}
