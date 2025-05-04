import { instanceManager } from './instanceManager.js';
import { pluginRegistry } from './pluginRegistry.js';
import InstancePluginManager from './instancePluginManager.js';

export class TableFlowInitializer {
    constructor(config = {}) {
        this.config = {
            debug: false,
            ...config
        };
    }

    async init() {
        // Initialiser le registre de plugins
        await pluginRegistry.init();

        // Créer et initialiser le gestionnaire de plugins
        const pluginManager = new InstancePluginManager(this.config);
        await pluginManager.init(pluginRegistry);

        // Initialiser le gestionnaire d'instances
        await instanceManager.init();

        return {
            instanceManager,
            pluginRegistry,
            pluginManager
        };
    }

    async createTable(tableId, config = {}) {
        // Créer une nouvelle instance de table
        const instance = instanceManager.createInstance(tableId, config);

        // Initialiser l'instance avec le gestionnaire de plugins
        await instance.init(instanceManager.pluginManager);

        return instance;
    }
}

// Export pour ES modules
export const tableFlowInitializer = new TableFlowInitializer(); 