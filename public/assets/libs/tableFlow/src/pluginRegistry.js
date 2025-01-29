import { PLUGIN_TYPES } from './types.js';

class PluginRegistry {
    constructor() {
        /** @type {Map<string, Plugin>} */
        this.plugins = new Map();
        
        /** @type {Map<string, Promise<Plugin>>} */
        this.loadingPlugins = new Map();
    }

    /**
     * Enregistre un plugin
     * @param {string} name - Nom du plugin
     * @param {Plugin} plugin - Plugin à enregistrer
     */
    register(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Le plugin ${name} est déjà enregistré`);
        }

        // Validation du type de plugin
        if (!Object.values(PLUGIN_TYPES).includes(plugin.type)) {
            throw new Error(`Type de plugin invalide: ${plugin.type}`);
        }

        // Validation de l'interface du plugin
        if (typeof plugin.init !== 'function' || typeof plugin.destroy !== 'function') {
            throw new Error(`Le plugin ${name} ne respecte pas l'interface requise`);
        }

        this.plugins.set(name, plugin);
    }

    /**
     * Charge un plugin de manière asynchrone
     * @param {string} name - Nom du plugin
     * @param {string} url - URL du plugin
     * @returns {Promise<Plugin>}
     */
    async load(name, url) {
        // Si le plugin est déjà chargé, on le retourne
        if (this.plugins.has(name)) {
            return this.plugins.get(name);
        }

        // Si le plugin est en cours de chargement, on retourne la promesse existante
        if (this.loadingPlugins.has(name)) {
            return this.loadingPlugins.get(name);
        }

        // Création d'une nouvelle promesse de chargement
        const loadPromise = (async () => {
            try {
                const module = await import(url);
                const plugin = module.default;

                // Validation du plugin
                if (!plugin || typeof plugin !== 'object') {
                    throw new Error(`Le plugin ${name} n'exporte pas d'objet valide`);
                }

                this.register(name, plugin);
                return plugin;
            } catch (error) {
                throw new Error(`Erreur lors du chargement du plugin ${name}: ${error.message}`);
            } finally {
                this.loadingPlugins.delete(name);
            }
        })();

        this.loadingPlugins.set(name, loadPromise);
        return loadPromise;
    }

    /**
     * Récupère un plugin
     * @param {string} name - Nom du plugin
     * @returns {Plugin}
     */
    get(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin ${name} non trouvé`);
        }
        return plugin;
    }

    /**
     * Vérifie si un plugin existe
     * @param {string} name - Nom du plugin
     * @returns {boolean}
     */
    has(name) {
        return this.plugins.has(name);
    }

    /**
     * Supprime un plugin
     * @param {string} name - Nom du plugin
     */
    unregister(name) {
        this.plugins.delete(name);
    }

    /**
     * Récupère tous les plugins d'un type donné
     * @param {PluginType} type - Type de plugin
     * @returns {Plugin[]}
     */
    getByType(type) {
        return Array.from(this.plugins.values())
            .filter(plugin => plugin.type === type);
    }

    /**
     * Nettoie le registre
     */
    clear() {
        this.plugins.clear();
        this.loadingPlugins.clear();
    }
}

// Export pour ES modules
export const pluginRegistry = new PluginRegistry();
