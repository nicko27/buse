import { Logger } from '../utils/logger.js';

export class PluginRegistry {
    constructor() {
        this.plugins = new Map();
        this.logger = new Logger('PluginRegistry');
        this._boundPluginLoadHandler = this.handlePluginLoad.bind(this);
        this._boundPluginErrorHandler = this.handlePluginError.bind(this);
    }

    init() {
        if (typeof window !== 'undefined') {
            window.addEventListener('plugin:load', this._boundPluginLoadHandler);
            window.addEventListener('plugin:error', this._boundPluginErrorHandler);
        }
    }

    register(name, plugin) {
        if (this.plugins.has(name)) {
            this.logger.warn(`Plugin ${name} déjà enregistré`);
            return false;
        }
        this.plugins.set(name, plugin);
        this.logger.info(`Plugin ${name} enregistré`);
        return true;
    }

    unregister(name) {
        if (!this.plugins.has(name)) {
            this.logger.warn(`Plugin ${name} non trouvé`);
            return false;
        }
        this.plugins.delete(name);
        this.logger.info(`Plugin ${name} désenregistré`);
        return true;
    }

    get(name) {
        return this.plugins.get(name);
    }

    has(name) {
        return this.plugins.has(name);
    }

    handlePluginLoad(event) {
        const { name, plugin } = event.detail;
        this.register(name, plugin);
    }

    handlePluginError(event) {
        const { name, error } = event.detail;
        this.logger.error(`Erreur du plugin ${name}:`, error);
    }

    destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('plugin:load', this._boundPluginLoadHandler);
            window.removeEventListener('plugin:error', this._boundPluginErrorHandler);
        }
        this.plugins.clear();
        this.logger.info('PluginRegistry détruit');
    }
} 