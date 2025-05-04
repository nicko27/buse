import { InstanceManager, instanceManager as defaultInstanceManager } from './core/InstanceManager.js';
import { PluginRegistry } from './plugin/PluginRegistry.js';
import { InstancePluginManager } from './core/instancePluginManager.js';
import { Logger } from './utils/logger.js';

export class TableFlowInitializer {
    constructor(config = {}, dependencies = {}) {
        this.logger = new Logger('TableFlowInitializer');
        
        // Validation des dépendances
        if (!dependencies.instanceManager && !InstanceManager) {
            throw new Error('InstanceManager est requis');
        }
        if (!dependencies.pluginRegistry && !PluginRegistry) {
            throw new Error('PluginRegistry est requis');
        }
        if (!dependencies.instancePluginManager && !InstancePluginManager) {
            throw new Error('InstancePluginManager est requis');
        }

        this.config = {
            debug: false,
            ...config
        };
        this.dependencies = {
            instanceManager: dependencies.instanceManager || defaultInstanceManager,
            pluginRegistry: dependencies.pluginRegistry || new PluginRegistry(),
            instancePluginManager: dependencies.instancePluginManager || new InstancePluginManager()
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