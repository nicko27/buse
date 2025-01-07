import { pluginRegistry } from './pluginRegistry.js';
import { PLUGIN_TYPES } from './types.js';

export class InstancePluginManager {
    /**
     * @param {TableInstance} instance 
     */
    constructor(instance) {
        this.instance = instance;
        /** @type {Map<string, Plugin>} */
        this.activePlugins = new Map();
    }

    /**
     * Active un plugin pour cette instance
     * @param {string} name - Nom du plugin
     * @param {PluginConfig} [config] - Configuration du plugin
     */
    async activate(name, config = {}) {
        if (this.activePlugins.has(name)) {
            throw new Error(`Le plugin ${name} est déjà actif pour cette instance`);
        }

        const plugin = await this.loadPlugin(name);
        
        // Fusion de la configuration
        const mergedConfig = {
            ...plugin.config,
            ...config
        };

        const instancePlugin = {
            ...plugin,
            config: mergedConfig
        };

        // Initialisation du plugin pour cette instance
        await instancePlugin.init(this.instance);
        
        this.activePlugins.set(name, instancePlugin);
    }

    /**
     * Charge un plugin depuis le registre ou l'URL
     * @param {string} name - Nom du plugin
     * @returns {Promise<Plugin>}
     */
    async loadPlugin(name) {
        if (pluginRegistry.has(name)) {
            return pluginRegistry.get(name);
        }

        // Utilisation du chemin configuré ou du chemin par défaut
        const pluginsPath = this.instance.config.pluginsPath || '/buse/public/assets/libs/nvTblHandler/plugins';
        const url = `${pluginsPath}/${name}.js`;
        return pluginRegistry.load(name, url);
    }

    /**
     * Désactive un plugin pour cette instance
     * @param {string} name - Nom du plugin
     */
    async deactivate(name) {
        const plugin = this.activePlugins.get(name);
        if (plugin) {
            await plugin.destroy();
            this.activePlugins.delete(name);
        }
    }

    /**
     * Vérifie si un plugin est actif
     * @param {string} name - Nom du plugin
     * @returns {boolean}
     */
    isActive(name) {
        return this.activePlugins.has(name);
    }

    /**
     * Récupère un plugin actif
     * @param {string} name - Nom du plugin
     * @returns {Plugin}
     */
    getPlugin(name) {
        const plugin = this.activePlugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin ${name} non actif pour cette instance`);
        }
        return plugin;
    }

    /**
     * Récupère tous les plugins actifs d'un type donné
     * @param {PluginType} type - Type de plugin
     * @returns {Plugin[]}
     */
    getPluginsByType(type) {
        return Array.from(this.activePlugins.values())
            .filter(plugin => plugin.type === type);
    }

    /**
     * Désactive tous les plugins
     */
    async deactivateAll() {
        const deactivatePromises = Array.from(this.activePlugins.keys())
            .map(name => this.deactivate(name));
        
        await Promise.all(deactivatePromises);
    }
}
