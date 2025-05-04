import { PLUGIN_TYPES } from './types.js';

export default class InstanceManager {
    constructor(config = {}) {
        this.instances = new Map();
        this.config = {
            debug: false,
            ...config
        };

        this.debug = this.config.debug ? 
            (...args) => console.log('[InstanceManager]', ...args) : 
            () => {};

        // Handlers liés
        this._boundResizeHandler = this.handleResize.bind(this);
        this._boundKeydownHandler = this.handleKeydown.bind(this);
    }

    init() {
        // Ajouter les écouteurs d'événements globaux
        window.addEventListener('resize', this._boundResizeHandler);
        document.addEventListener('keydown', this._boundKeydownHandler);
    }

    handleResize() {
        // Propager l'événement resize à toutes les instances
        this.instances.forEach(instance => {
            if (typeof instance.handleResize === 'function') {
                instance.handleResize();
            }
        });
    }

    handleKeydown(e) {
        // Propager l'événement keydown à toutes les instances
        this.instances.forEach(instance => {
            if (typeof instance.handleKeydown === 'function') {
                instance.handleKeydown(e);
            }
        });
    }

    createInstance(id, config) {
        if (!id) {
            throw new Error('ID requis pour créer une instance');
        }

        if (this.instances.has(id)) {
            throw new Error(`Une instance avec l'ID ${id} existe déjà`);
        }

        const instance = new TableInstance(id, config);
        this.instances.set(id, instance);
        this.debug(`Instance créée: ${id}`);
        return instance;
    }

    getInstance(id) {
        return this.instances.get(id);
    }

    removeInstance(id) {
        const instance = this.instances.get(id);
        if (instance) {
            if (typeof instance.destroy === 'function') {
                instance.destroy();
            }
            this.instances.delete(id);
            this.debug(`Instance supprimée: ${id}`);
        }
    }

    refreshAll() {
        this.instances.forEach((instance, id) => {
            if (typeof instance.refresh === 'function') {
                try {
                    instance.refresh();
                    this.debug(`Instance rafraîchie: ${id}`);
                } catch (error) {
                    console.error(`Erreur lors du rafraîchissement de l'instance ${id}:`, error);
                }
            }
        });
    }

    destroy() {
        // Supprimer les écouteurs d'événements globaux
        window.removeEventListener('resize', this._boundResizeHandler);
        document.removeEventListener('keydown', this._boundKeydownHandler);

        // Détruire toutes les instances
        this.instances.forEach((instance, id) => {
            if (typeof instance.destroy === 'function') {
                try {
                    instance.destroy();
                    this.debug(`Instance détruite: ${id}`);
                } catch (error) {
                    console.error(`Erreur lors de la destruction de l'instance ${id}:`, error);
                }
            }
        });

        // Vider la Map des instances
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
        this.pluginManager = null; // Ne sera initialisé que lors de l'appel à init()
    }

    /**
     * Initialise l'instance
     */
    async init(pluginManager) {
        if (!pluginManager) {
            throw new Error('PluginManager requis pour initialiser l\'instance');
        }
        this.pluginManager = pluginManager;
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

    /**
     * Réinitialise l'état des cellules
     */
    clearRowState() {
        this.cellStates.clear();
    }

    /**
     * Met à jour l'état d'une cellule
     * @param {string} rowId - ID de la ligne
     * @param {string} cellId - ID de la cellule
     * @param {any} state - État à définir
     */
    setCellState(rowId, cellId, state) {
        const cellKey = `${rowId}:${cellId}`;
        this.cellStates.set(cellKey, state);
    }

    /**
     * Récupère l'état d'une cellule
     * @param {string} rowId - ID de la ligne
     * @param {string} cellId - ID de la cellule
     * @returns {any} État de la cellule
     */
    getCellState(rowId, cellId) {
        const cellKey = `${rowId}:${cellId}`;
        return this.cellStates.get(cellKey);
    }

    /**
     * Vérifie si une cellule a un état
     * @param {string} rowId - ID de la ligne
     * @param {string} cellId - ID de la cellule
     * @returns {boolean} True si la cellule a un état
     */
    hasCellState(rowId, cellId) {
        const cellKey = `${rowId}:${cellId}`;
        return this.cellStates.has(cellKey);
    }

    /**
     * Supprime l'état d'une cellule
     * @param {string} rowId - ID de la ligne
     * @param {string} cellId - ID de la cellule
     */
    removeCellState(rowId, cellId) {
        const cellKey = `${rowId}:${cellId}`;
        this.cellStates.delete(cellKey);
    }

    /**
     * Rafraîchit l'instance
     */
    async refresh() {
        // Rafraîchir les plugins
        await this.initPlugins();
        
        // Rafraîchir l'état
        this.cellStates.clear();
        
        // Rafraîchir le DOM
        this.setupTable();
    }

    /**
     * Vérifie si l'instance est valide
     * @returns {boolean} True si l'instance est valide
     */
    isValid() {
        return this.element && this.pluginManager;
    }

    /**
     * Récupère la configuration de l'instance
     * @returns {Object} Configuration de l'instance
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Met à jour la configuration de l'instance
     * @param {Object} newConfig - Nouvelle configuration
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        this.setupTable();
    }
}
