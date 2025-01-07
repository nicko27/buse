import { pluginRegistry } from './pluginRegistry.js';
import { PLUGIN_TYPES } from './types.js';

export class InstancePluginManager {
    /**
     * @param {TableInstance} instance 
     */
    constructor(instance) {
        this.instance = instance;
        this.tableContext = instance.tableContext;
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

        // Créer le contexte spécifique au plugin
        const pluginContext = this.createPluginContext(name);

        // Initialisation du plugin pour cette instance
        await instancePlugin.init(pluginContext);
        
        this.activePlugins.set(name, instancePlugin);
    }

    /**
     * Crée un contexte spécifique pour un plugin
     * @param {string} pluginName - Nom du plugin
     * @returns {PluginContext}
     */
    createPluginContext(pluginName) {
        return {
            ...this.tableContext,
            pluginName,
            getPlugin: (name) => this.getPlugin(name),
            attachToElement: (element) => {
                element.dataset.plugin = pluginName;
                return element;
            }
        };
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
        const pluginsPath = this.instance.config.pluginsPath || '/buse/public/assets/libs/tableFlow/plugins';
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
            const pluginContext = this.createPluginContext(name);
            await plugin.destroy(pluginContext);
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
     * Rafraîchit tous les plugins actifs
     */
    async refreshAll() {
        for (const [name, plugin] of this.activePlugins) {
            if (typeof plugin.refresh === 'function') {
                const pluginContext = this.createPluginContext(name);
                await plugin.refresh(pluginContext);
            }
        }
    }

    /**
     * Détruit tous les plugins actifs
     */
    async destroyAll() {
        for (const [name, plugin] of this.activePlugins) {
            await this.deactivate(name);
        }
        this.activePlugins.clear();
    }
}
