import { Logger } from '../utils/logger.js';

export class PluginRegistry {
    constructor() {
        this.logger = new Logger('PluginRegistry');
        this.plugins = new Map();
        this.sandbox = new Map();
    }

    async register(name, plugin, options = {}) {
        if (!name || typeof name !== 'string') {
            throw new Error('Le nom du plugin doit être une chaîne de caractères');
        }

        if (!plugin || typeof plugin !== 'object') {
            throw new Error('Le plugin doit être un objet');
        }

        if (this.plugins.has(name)) {
            throw new Error(`Un plugin avec le nom ${name} est déjà enregistré`);
        }

        // Validation des méthodes requises
        const requiredMethods = ['init', 'destroy'];
        for (const method of requiredMethods) {
            if (typeof plugin[method] !== 'function') {
                throw new Error(`Le plugin ${name} doit implémenter la méthode ${method}`);
            }
        }

        // Création du sandbox
        const pluginSandbox = this.createSandbox(name, options);
        this.sandbox.set(name, pluginSandbox);

        try {
            // Initialisation du plugin dans le sandbox
            await plugin.init(pluginSandbox);
            
            // Enregistrement du plugin
            this.plugins.set(name, {
                instance: plugin,
                options,
                state: {
                    initialized: true,
                    lastError: null,
                    lastUpdate: Date.now()
                }
            });

            this.logger.info(`Plugin ${name} enregistré avec succès`);
        } catch (error) {
            this.logger.error(`Erreur lors de l'enregistrement du plugin ${name}: ${error.message}`);
            throw error;
        }
    }

    createSandbox(name, options) {
        const sandbox = {
            name,
            options,
            state: {},
            events: new Map(),
            permissions: new Set(options.permissions || []),
            
            // Méthodes sécurisées
            log: (message, level = 'info') => {
                this.logger[level](`[${name}] ${message}`);
            },
            
            emit: (event, data) => {
                if (!this.sandbox.get(name).permissions.has('emit')) {
                    throw new Error('Le plugin n\'a pas la permission d\'émettre des événements');
                }
                // Émettre l'événement via le système d'événements principal
            },
            
            setState: (key, value) => {
                if (!this.sandbox.get(name).permissions.has('state')) {
                    throw new Error('Le plugin n\'a pas la permission de modifier l\'état');
                }
                this.sandbox.get(name).state[key] = value;
            },
            
            getState: (key) => {
                return this.sandbox.get(name).state[key];
            }
        };

        return sandbox;
    }

    async unregister(name) {
        if (!this.plugins.has(name)) {
            throw new Error(`Plugin ${name} non trouvé`);
        }

        const plugin = this.plugins.get(name);
        try {
            await plugin.instance.destroy();
            this.plugins.delete(name);
            this.sandbox.delete(name);
            this.logger.info(`Plugin ${name} désenregistré avec succès`);
        } catch (error) {
            this.logger.error(`Erreur lors du désenregistrement du plugin ${name}: ${error.message}`);
            throw error;
        }
    }

    getPlugin(name) {
        return this.plugins.get(name)?.instance;
    }

    hasPlugin(name) {
        return this.plugins.has(name);
    }

    getPluginState(name) {
        return this.plugins.get(name)?.state;
    }

    async refreshPlugin(name) {
        const plugin = this.plugins.get(name);
        if (!plugin) {
            throw new Error(`Plugin ${name} non trouvé`);
        }

        try {
            if (typeof plugin.instance.refresh === 'function') {
                await plugin.instance.refresh();
                plugin.state.lastUpdate = Date.now();
                this.logger.info(`Plugin ${name} rafraîchi avec succès`);
            }
        } catch (error) {
            plugin.state.lastError = error;
            this.logger.error(`Erreur lors du rafraîchissement du plugin ${name}: ${error.message}`);
            throw error;
        }
    }

    destroy() {
        const unregisterPromises = Array.from(this.plugins.keys())
            .map(name => this.unregister(name));
        return Promise.all(unregisterPromises);
    }
} 