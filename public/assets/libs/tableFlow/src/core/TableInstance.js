import { PLUGIN_TYPES } from '../types.js';
import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';
import { isValidPluginType, isValidPluginConfig } from '../types.js';

export class TableInstance {
    constructor(tableId, config) {
        this.id = tableId;
        this.config = config;
        this.plugins = new Map();
        this.logger = new Logger(`TableInstance:${tableId}`);
        this.eventBus = new EventBus();
        this.initialized = false;
        this.cellStates = new Map();
    }

    async init(pluginManager) {
        if (this.initialized) {
            this.logger.warn('Instance déjà initialisée');
            return;
        }

        try {
            await this.setupTable();
            await this.initPlugins(pluginManager);
            this.initialized = true;
            this.logger.info('Instance initialisée avec succès');
        } catch (error) {
            this.logger.error('Erreur lors de l\'initialisation', error);
            throw error;
        }
    }

    /**
     * Configure la table avec les paramètres de base
     * @private
     */
    async setupTable() {
        const tableElement = document.getElementById(this.id);
        if (!tableElement) {
            throw new Error(`Table avec l'ID ${this.id} non trouvée dans le DOM`);
        }

        // Configuration des classes CSS
        if (this.config.wrapCellsEnabled) {
            tableElement.classList.add(this.config.cellWrapperClass || 'cell-wrapper');
        }
        if (this.config.wrapHeadersEnabled) {
            tableElement.classList.add(this.config.headerWrapperClass || 'head-wrapper');
        }

        // Initialisation des événements de base
        this.setupEventListeners(tableElement);
    }

    /**
     * Configure les écouteurs d'événements de base
     * @private
     */
    setupEventListeners(tableElement) {
        tableElement.addEventListener('click', (e) => this.handleCellClick(e));
        tableElement.addEventListener('input', (e) => this.handleCellInput(e));
    }

    /**
     * Initialise les plugins pour cette instance
     * @param {Object} pluginManager - Gestionnaire de plugins
     * @private
     */
    async initPlugins(pluginManager) {
        if (!pluginManager) {
            throw new Error('PluginManager requis pour l\'initialisation');
        }

        const availablePlugins = await pluginManager.getAvailablePlugins();
        for (const [name, plugin] of availablePlugins) {
            if (isValidPluginType(plugin.type) && isValidPluginConfig(plugin.config)) {
                this.addPlugin(name, plugin);
                if (plugin.config.enabled !== false) {
                    await this.activate(name, plugin.config);
                }
            } else {
                this.logger.warn(`Plugin ${name} ignoré - configuration invalide`);
            }
        }
    }

    async activate(name, config = {}) {
        if (!this.plugins.has(name)) {
            throw new Error(`Plugin ${name} non trouvé`);
        }
        await this.plugins.get(name).init(config);
    }

    async deactivate(name) {
        if (this.plugins.has(name)) {
            await this.plugins.get(name).destroy();
        }
    }

    addPlugin(name, plugin) {
        if (this.plugins.has(name)) {
            throw new Error(`Plugin ${name} déjà existant`);
        }
        this.plugins.set(name, plugin);
    }

    async destroy() {
        for (const [name, plugin] of this.plugins) {
            await plugin.destroy();
        }
        this.plugins.clear();
        this.initialized = false;
    }

    /**
     * Gère le clic sur une cellule
     * @private
     */
    handleCellClick(event) {
        const cell = event.target.closest('td, th');
        if (cell) {
            this.eventBus.emit('cellClick', { cell, event });
        }
    }

    /**
     * Gère la modification d'une cellule
     * @private
     */
    handleCellInput(event) {
        const cell = event.target.closest('td');
        if (cell) {
            this.eventBus.emit('cellInput', { cell, value: event.target.value });
        }
    }

    // Méthodes de gestion d'état
    setCellState(rowId, cellId, state) {
        const cellKey = `${rowId}-${cellId}`;
        this.cellStates.set(cellKey, {
            ...this.cellStates.get(cellKey),
            ...state,
            lastModified: new Date(),
            isModified: true
        });
        this.eventBus.emit('cellStateChanged', { rowId, cellId, state });
    }

    getCellState(rowId, cellId) {
        const cellKey = `${rowId}-${cellId}`;
        return this.cellStates.get(cellKey);
    }

    hasCellState(rowId, cellId) {
        const cellKey = `${rowId}-${cellId}`;
        return this.cellStates.has(cellKey);
    }

    removeCellState(rowId, cellId) {
        const cellKey = `${rowId}-${cellId}`;
        this.cellStates.delete(cellKey);
        this.eventBus.emit('cellStateRemoved', { rowId, cellId });
    }

    async refresh() {
        if (!this.initialized) {
            throw new Error('Instance non initialisée');
        }

        const tableElement = document.getElementById(this.id);
        if (!tableElement) {
            throw new Error(`Table avec l'ID ${this.id} non trouvée`);
        }

        // Rafraîchir tous les plugins
        for (const [name, plugin] of this.plugins) {
            if (typeof plugin.refresh === 'function') {
                await plugin.refresh();
            }
        }

        // Mettre à jour les classes CSS
        this.updateCellClasses(tableElement);
    }

    /**
     * Met à jour les classes CSS des cellules
     * @private
     */
    updateCellClasses(tableElement) {
        const cells = tableElement.querySelectorAll('td');
        cells.forEach(cell => {
            const rowId = cell.closest('tr').dataset.rowId;
            const cellId = cell.dataset.cellId;
            const state = this.getCellState(rowId, cellId);

            if (state?.isModified) {
                cell.classList.add(this.config.modifiedCellClass || 'cell-modified');
            } else {
                cell.classList.remove(this.config.modifiedCellClass || 'cell-modified');
            }
        });
    }

    isValid() {
        if (!this.initialized) return false;
        if (!document.getElementById(this.id)) return false;
        
        // Vérifier la validité des plugins
        for (const [name, plugin] of this.plugins) {
            if (plugin.config.enabled !== false && typeof plugin.isValid === 'function') {
                if (!plugin.isValid()) return false;
            }
        }

        return true;
    }

    getConfig() {
        return { ...this.config };
    }

    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
    }
} 