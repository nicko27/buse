import { PLUGIN_TYPES } from './types.js';

export default class InstancePluginManager {
    constructor(config = {}) {
        this.plugins = new Map();
        this.config = {
            debug: false,
            ...config
        };

        this.debug = this.config.debug ? 
            (...args) => console.log('[InstancePluginManager]', ...args) : 
            () => {};

        // Handlers liés
        this._boundPluginChangeHandler = this.handlePluginChange.bind(this);
        
        // Référence au registre de plugins
        this.pluginRegistry = null;
    }

    init(pluginRegistry) {
        if (!pluginRegistry) {
            throw new Error('PluginRegistry requis pour initialiser le gestionnaire de plugins');
        }
        this.pluginRegistry = pluginRegistry;
        
        // Ajouter les écouteurs d'événements
        document.addEventListener('plugin:change', this._boundPluginChangeHandler);
    }

    handlePluginChange(e) {
        const { pluginId, action } = e.detail;
        if (action === 'enable') {
            this.enablePlugin(pluginId);
        } else if (action === 'disable') {
            this.disablePlugin(pluginId);
        }
    }

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
}
