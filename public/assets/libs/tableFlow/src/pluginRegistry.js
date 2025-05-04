import { PLUGIN_TYPES } from './types.js';

export default class PluginRegistry {
    constructor(config = {}) {
        this.plugins = new Map();
        this.config = {
            debug: false,
            pluginsPath: '../plugins',
            ...config
        };

        this.debug = this.config.debug ? 
            (...args) => console.log('[PluginRegistry]', ...args) : 
            () => {};

        // Handlers liés
        this._boundPluginLoadHandler = this.handlePluginLoad.bind(this);
        this._boundPluginErrorHandler = this.handlePluginError.bind(this);
    }

    init() {
        // Ajouter les écouteurs d'événements
        if (typeof window !== "undefined") {
            window.addEventListener('plugin:load', this._boundPluginLoadHandler);
            window.addEventListener('plugin:error', this._boundPluginErrorHandler);
        }
    }

    handlePluginLoad(e) {
        const { pluginId, plugin } = e.detail;
        this.register(pluginId, plugin);
    }

    handlePluginError(e) {
        const { pluginId, error } = e.detail;
        this.debug(`Erreur de chargement du plugin ${pluginId}:`, error);
    }

    async register(pluginId, pluginClass) {
        if (!pluginId || !pluginClass) {
            throw new Error('ID et classe du plugin requis');
        }

        if (this.plugins.has(pluginId)) {
            throw new Error(`Plugin ${pluginId} déjà enregistré`);
        }

        try {
            // Vérifier que la classe a les méthodes requises
            const requiredMethods = ['init', 'destroy'];
            for (const method of requiredMethods) {
                if (typeof pluginClass.prototype[method] !== 'function') {
                    throw new Error(`Le plugin ${pluginId} doit implémenter la méthode ${method}`);
                }
            }

            this.plugins.set(pluginId, pluginClass);
            this.debug(`Plugin enregistré: ${pluginId}`);
            return true;
        } catch (error) {
            this.debug(`Erreur lors de l'enregistrement du plugin ${pluginId}:`, error);
            return false;
        }
    }

    unregister(pluginId) {
        if (this.plugins.has(pluginId)) {
            this.plugins.delete(pluginId);
            this.debug(`Plugin désenregistré: ${pluginId}`);
            return true;
        }
        return false;
    }

    async load(pluginId) {
        if (this.plugins.has(pluginId)) {
            return this.plugins.get(pluginId);
        }

        try {
            const pluginPath = `${this.config.pluginsPath}/${pluginId}.js`;
            const module = await import(pluginPath);
            
            if (!module.default) {
                throw new Error(`Le plugin ${pluginId} n'exporte pas de classe par défaut`);
            }

            await this.register(pluginId, module.default);
            return module.default;
        } catch (error) {
            this.debug(`Erreur lors du chargement du plugin ${pluginId}:`, error);
            throw error;
        }
    }

    get(pluginId) {
        return this.plugins.get(pluginId);
    }

    has(pluginId) {
        return this.plugins.has(pluginId);
    }

    getAll() {
        return Array.from(this.plugins.entries()).map(([id, Plugin]) => ({
            id,
            Plugin
        }));
    }

    destroy() {
        // Supprimer les écouteurs d'événements
        if (typeof window !== "undefined") {
            window.removeEventListener('plugin:load', this._boundPluginLoadHandler);
            window.removeEventListener('plugin:error', this._boundPluginErrorHandler);
        }
        // Vider le registre
        this.plugins.clear();
    }
}

// Export pour ES modules
export const pluginRegistry = new PluginRegistry();
