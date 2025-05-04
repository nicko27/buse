import { InstanceManager } from './core/InstanceManager.js';
import { PluginRegistry } from './plugin/PluginRegistry.js';
import InstancePluginManager from './core/InstancePluginManager.js';

export class TableFlowInitializer {
    constructor(config = {}, dependencies = {}) {
        this.config = {
            debug: false,
            ...config
        };
        this.dependencies = {
            instanceManager: dependencies.instanceManager || new InstanceManager(),
            pluginRegistry: dependencies.pluginRegistry || new PluginRegistry(),
            instancePluginManager: dependencies.instancePluginManager
        };
    }

    async init() {
        // Initialiser le registre de plugins
        await this.dependencies.pluginRegistry.init();

        // Créer et initialiser le gestionnaire de plugins
        const pluginManager = new this.dependencies.instancePluginManager(this.config);
        await pluginManager.init(this.dependencies.pluginRegistry);

        // Initialiser le gestionnaire d'instances
        await this.dependencies.instanceManager.init();

        return {
            instanceManager: this.dependencies.instanceManager,
            pluginRegistry: this.dependencies.pluginRegistry,
            pluginManager
        };
    }

    async createTable(tableId, config = {}) {
        // Créer une nouvelle instance de table
        const instance = this.dependencies.instanceManager.createInstance(tableId, config);

        // Initialiser l'instance avec le gestionnaire de plugins
        await instance.init(this.dependencies.instanceManager.pluginManager);

        return instance;
    }
}

// Export pour ES modules
export const tableFlowInitializer = new TableFlowInitializer(); 