import { PLUGIN_TYPES } from './types.js';
import { InstancePluginManager } from './instancePluginManager.js';

class InstanceManager {
    constructor() {
        /** @type {Map<string, TableInstance>} */
        this.instances = new Map();
    }

    /**
     * Crée une nouvelle instance de table
     * @param {string} tableId - ID du tableau HTML
     * @param {TableConfig} config - Configuration de la table
     * @returns {Promise<TableInstance>}
     */
    async createInstance(tableId, config = {}) {
        if (this.instances.has(tableId)) {
            throw new Error(`Une instance existe déjà pour la table ${tableId}`);
        }

        const instance = new TableInstance(tableId, { ...config });
        await instance.init();
        this.instances.set(tableId, instance);
        return instance;
    }

    /**
     * Récupère une instance existante
     * @param {string} tableId - ID du tableau HTML
     * @returns {TableInstance}
     */
    getInstance(tableId) {
        const instance = this.instances.get(tableId);
        if (!instance) {
            throw new Error(`Aucune instance trouvée pour la table ${tableId}`);
        }
        return instance;
    }

    /**
     * Détruit une instance
     * @param {string} tableId - ID du tableau HTML
     */
    async destroyInstance(tableId) {
        const instance = this.instances.get(tableId);
        if (instance) {
            await instance.destroy();
            this.instances.delete(tableId);
        }
    }

    /**
     * Détruit toutes les instances
     */
    async destroyAll() {
        const destroyPromises = Array.from(this.instances.values()).map(instance => instance.destroy());
        await Promise.all(destroyPromises);
        this.instances.clear();
    }
}

class TableInstance {
    /**
     * @param {string} tableId 
     * @param {TableConfig} config 
     */
    constructor(tableId, config) {
        this.tableId = tableId;
        this.config = config;
        this.element = document.getElementById(tableId);
        if (!this.element) {
            throw new Error(`Élément table #${tableId} non trouvé`);
        }

        /** @type {Map<string, Plugin>} */
        this.plugins = new Map();
        
        /** @type {Map<string, CellState>} */
        this.cellStates = new Map();

        // Initialisation du gestionnaire de plugins
        this.pluginManager = new InstancePluginManager(this);
    }

    /**
     * Initialise l'instance
     */
    async init() {
        this.setupTable();
        await this.initPlugins();
    }

    /**
     * Configure la table
     */
    setupTable() {
        if (this.config.wrapCellsEnabled) {
            this.wrapCells();
        }
        if (this.config.wrapHeadersEnabled) {
            this.wrapHeaders();
        }
    }

    /**
     * Initialise les plugins
     */
    async initPlugins() {
        const initPromises = Array.from(this.plugins.values())
            .sort((a, b) => (a.config.execOrder || 50) - (b.config.execOrder || 50))
            .map(plugin => plugin.init(this));
        
        await Promise.all(initPromises);
    }

    /**
     * Active un plugin
     * @param {string} name - Nom du plugin
     * @param {PluginConfig} [config] - Configuration du plugin
     */
    async activate(name, config = {}) {
        await this.pluginManager.activate(name, config);
    }

    /**
     * Désactive un plugin
     * @param {string} name - Nom du plugin
     */
    async deactivate(name) {
        await this.pluginManager.deactivate(name);
    }

    /**
     * Ajoute un plugin
     * @param {string} name - Nom du plugin
     * @param {Plugin} plugin - Plugin à ajouter
     */
    addPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Le plugin ${name} existe déjà`);
        }
        this.plugins.set(name, plugin);
    }

    /**
     * Détruit l'instance
     */
    async destroy() {
        // Destruction des plugins dans l'ordre inverse
        Array.from(this.plugins.values())
            .reverse()
            .forEach(plugin => plugin.destroy());
        
        this.plugins.clear();
        this.cellStates.clear();
    }

    /**
     * Enveloppe les cellules dans des divs
     */
    wrapCells() {
        const cells = this.element.getElementsByTagName('td');
        Array.from(cells).forEach(cell => {
            if (!cell.querySelector(`.${this.config.wrapCellClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.config.wrapCellClass;
                wrapper.innerHTML = cell.innerHTML;
                cell.innerHTML = '';
                cell.appendChild(wrapper);
            }
        });
    }

    /**
     * Enveloppe les en-têtes dans des divs
     */
    wrapHeaders() {
        const headers = this.element.getElementsByTagName('th');
        Array.from(headers).forEach(header => {
            if (!header.querySelector(`.${this.config.wrapHeaderClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.config.wrapHeaderClass;
                wrapper.innerHTML = header.innerHTML;
                header.innerHTML = '';
                header.appendChild(wrapper);
            }
        });
    }
}

// Export pour ES modules
export const instanceManager = new InstanceManager();
