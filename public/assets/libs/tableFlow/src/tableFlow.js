import { Logger } from './utils/logger.js';
import { EventBus } from './utils/eventBus.js';
import { ConfigManager } from './config/configManager.js';
import { CacheManager } from './cache/cacheManager.js';
import { ValidationManager } from './validation/validationManager.js';
import { MetricsManager } from './metrics/metricsManager.js';
import { TableDom } from './dom/tableDom.js';
import { TableState } from './state/tableState.js';
import { NotificationManager } from './utils/notificationManager.js';
import { DataManager } from './utils/dataManager.js';

class ErrorHandler {
    constructor(tableFlow) {
        this.tableFlow = tableFlow;
        this.errorTypes = {
            CONFIG: 'config',
            INIT: 'init',
            RUNTIME: 'runtime',
            VALIDATION: 'validation',
            CACHE: 'cache',
            PLUGIN: 'plugin'
        };
    }

    handle(error, type = this.errorTypes.RUNTIME, context = {}) {
        const errorData = {
            type,
            message: error.message,
            stack: error.stack,
            context,
            timestamp: Date.now()
        };

        // Log l'erreur
        this.tableFlow.logger.error(`[${type}] ${error.message}`, error);

        // Émettre l'événement d'erreur
        this.tableFlow.eventBus.emit('error', errorData);

        // Afficher la notification
        this.tableFlow.notifications.show(error.message, 'error', {
            duration: 0 // Notification persistante pour les erreurs
        });

        // Enregistrer la métrique
        this.tableFlow.metrics.increment('errors', 1, { type });

        return errorData;
    }

    createError(message, type = this.errorTypes.RUNTIME, context = {}) {
        const error = new Error(message);
        error.type = type;
        error.context = context;
        return error;
    }
}

export default class TableFlow {
    constructor(options = {}) {
        // Initialisation des gestionnaires
        this.logger = new Logger('TableFlow', options);
        this.eventBus = new EventBus();
        this.config = new ConfigManager(options);
        this.state = new TableState();
        this.dom = null;
        this.cache = new CacheManager(options.cache);
        this.validation = new ValidationManager(options.validation);
        this.metrics = new MetricsManager(options.metrics);
        this.notifications = new NotificationManager(options.notifications);
        this.dataManager = new DataManager(options.data);
        this.errorHandler = new ErrorHandler(this);
        this.hooks = new Map();
        this.debug = {
            enabled: options.debug || false,
            performance: {
                enabled: false,
                threshold: 100, // ms
                history: []
            },
            memory: {
                enabled: false,
                history: []
            }
        };

        // État partagé pour les plugins
        this.sharedState = {
            filteredData: [],
            currentPage: 1,
            pageSize: 10,
            totalItems: 0,
            lastUpdate: Date.now(),
            updateQueue: [],
            isUpdating: false,
            isReady: false
        };

        // Gestionnaire de plugins coopératifs
        this.cooperativePlugins = {
            filter: null,
            pagination: null,
            hooks: {
                beforeFilter: [],
                afterFilter: [],
                beforePageChange: [],
                afterPageChange: [],
                beforeSizeChange: [],
                afterSizeChange: []
            }
        };

        // Ajouter le gestionnaire de promesses
        this.readyPromise = new Promise(resolve => {
            this.resolveReady = resolve;
        });

        // Configuration du schéma de configuration
        this.setupConfigSchema();

        // Initialisation
        this.initialize(options).catch(error => {
            this.errorHandler.handle(error, this.errorHandler.errorTypes.INIT);
            throw error;
        });
    }

    setupConfigSchema() {
        this.config.setSchema({
            tableId: {
                type: 'string',
                required: true
            },
            plugins: {
                type: 'object',
                default: {}
            },
            pluginsPath: {
                type: 'string',
                default: '../plugins'
            },
            cellWrapperClass: {
                type: 'string',
                default: 'cell-wrapper'
            },
            headerWrapperClass: {
                type: 'string',
                default: 'head-wrapper'
            },
            modifiedCellClass: {
                type: 'string',
                default: 'cell-modified'
            },
            wrapCellsEnabled: {
                type: 'boolean',
                default: true
            },
            wrapHeadersEnabled: {
                type: 'boolean',
                default: true
            },
            debug: {
                type: 'boolean',
                default: false
            },
            verbosity: {
                type: 'number',
                default: 0,
                validate: value => value >= 0 && value <= 3
            },
            cache: {
                type: 'object',
                default: {}
            },
            validation: {
                type: 'object',
                default: {}
            },
            metrics: {
                type: 'object',
                default: {}
            }
        });
    }

    async initialize(options) {
        try {
            this.logger.info('Démarrage de l\'initialisation...');

            // Valider et appliquer la configuration
            this.config.setConfig(options);

            // Récupérer la table
            const table = document.getElementById(this.config.get('tableId'));
            if (!table) {
                throw new Error(`Table avec l'id "${this.config.get('tableId')}" non trouvée`);
            }
            if (table.tagName.toLowerCase() !== 'table') {
                throw new Error(`L'élément avec l'id "${this.config.get('tableId')}" n'est pas une table`);
            }

            // Initialiser le gestionnaire DOM
            this.dom = new TableDom(table, {
                cellWrapperClass: this.config.get('cellWrapperClass'),
                headWrapperClass: this.config.get('headerWrapperClass')
            });

            // Initialiser les wrappers
            this.dom.initializeWrappers();

            // Stocker les valeurs initiales
            this.storeInitialValues();

            // Charger les plugins
            await this.loadPlugins();

            // Marquer comme prêt et résoudre la promesse
            this.sharedState.isReady = true;
            this.resolveReady();

            this.logger.success('Initialisation terminée avec succès');
        } catch (error) {
            this.errorHandler.handle(error, this.errorHandler.errorTypes.INIT);
            throw error;
        }
    }

    storeInitialValues() {
        const rows = this.dom.getAllRows();
        rows.forEach(row => {
            Array.from(row.cells).forEach(cell => {
                const columnId = this.dom.getHeaderCell(cell.cellIndex).id;
                const value = this.dom.getCellValue(cell);
                this.state.setInitialValue(row.id, columnId, value);
            });
        });
    }

    async loadPlugins() {
        const plugins = this.config.get('plugins');
        if (!plugins || Object.keys(plugins).length === 0) {
            this.logger.info('Aucun plugin à charger');
            return;
        }

        const pluginsPath = this.config.get('pluginsPath');
        const loadedPlugins = new Map();

        for (const [name, config] of Object.entries(plugins)) {
            if (config === false) continue;

            try {
                const timer = this.metrics.startTimer(`plugin_load_${name}`);
                const pluginPath = `${pluginsPath}/${name.toLowerCase()}.js`;
                
                const module = await import(pluginPath);
                if (!module.default) {
                    throw new Error(`Le plugin ${name} n'exporte pas de classe par défaut`);
                }

                const pluginInstance = new module.default({
                    ...config,
                    debug: this.config.get('debug')
                });

                await pluginInstance.init(this);
                loadedPlugins.set(name, pluginInstance);

                this.metrics.stopTimer(timer);
                this.logger.success(`Plugin ${name} chargé et initialisé`);
            } catch (error) {
                this.logger.error(`Échec du chargement du plugin ${name}: ${error.message}`, error);
                this.metrics.increment('plugin_load_error');
            }
        }

        return loadedPlugins;
    }

    // API publique
    getPlugin(name) {
        return this.plugins?.get(name.toLowerCase())?.instance;
    }

    hasPlugin(name) {
        return this.plugins?.has(name.toLowerCase());
    }

    refreshPlugins() {
        this.plugins?.forEach((plugin, name) => {
            try {
                if (typeof plugin.refresh === 'function') {
                    plugin.refresh();
                }
            } catch (error) {
                this.logger.error(`Erreur lors du rafraîchissement du plugin ${name}: ${error.message}`, error);
            }
        });
    }

    // Système de hooks
    addHook(name, callback) {
        if (!this.hooks.has(name)) {
            this.hooks.set(name, new Set());
        }
        this.hooks.get(name).add(callback);
        return () => this.removeHook(name, callback);
    }

    removeHook(name, callback) {
        if (this.hooks.has(name)) {
            this.hooks.get(name).delete(callback);
        }
    }

    async runHook(name, ...args) {
        if (!this.hooks.has(name)) return;
        
        const results = [];
        for (const callback of this.hooks.get(name)) {
            try {
                const result = await callback(...args);
                results.push(result);
            } catch (error) {
                this.errorHandler.handle(error, this.errorHandler.errorTypes.RUNTIME, {
                    hook: name,
                    args
                });
            }
        }
        return results;
    }

    // Hooks disponibles
    async beforeRowAdd(data, position) {
        return this.runHook('beforeRowAdd', data, position);
    }

    async afterRowAdd(row, data, position) {
        return this.runHook('afterRowAdd', row, data, position);
    }

    async beforeRowRemove(row) {
        return this.runHook('beforeRowRemove', row);
    }

    async afterRowRemove(rowId) {
        return this.runHook('afterRowRemove', rowId);
    }

    async beforeCellModify(cell, oldValue, newValue) {
        return this.runHook('beforeCellModify', cell, oldValue, newValue);
    }

    async afterCellModify(cell, oldValue, newValue) {
        return this.runHook('afterCellModify', cell, oldValue, newValue);
    }

    async beforeValidation(data) {
        return this.runHook('beforeValidation', data);
    }

    async afterValidation(data, errors) {
        return this.runHook('afterValidation', data, errors);
    }

    // Modification des méthodes existantes pour utiliser les hooks
    async addRow(data = {}, position = 'end') {
        const timer = this.metrics.startTimer('add_row');
        try {
            // Hook beforeRowAdd
            const beforeResults = await this.beforeRowAdd(data, position);
            if (beforeResults.some(result => result === false)) {
                throw this.errorHandler.createError('Ajout de ligne annulé par un hook', 
                    this.errorHandler.errorTypes.RUNTIME);
            }

            const headers = Array.from(this.dom.table.querySelectorAll('thead th'));
            const row = this.dom.createRow(data, headers);

            const tbody = this.dom.table.querySelector('tbody');
            if (position === 'start') {
                tbody.insertBefore(row, tbody.firstChild);
            } else {
                tbody.appendChild(row);
            }

            // Hook afterRowAdd
            await this.afterRowAdd(row, data, position);

            this.metrics.increment('rows_added');
            return row;
        } catch (error) {
            this.errorHandler.handle(error);
            throw error;
        } finally {
            this.metrics.stopTimer(timer);
        }
    }

    async removeRow(row) {
        const timer = this.metrics.startTimer('remove_row');
        try {
            if (!row || !row.parentNode) {
                throw this.errorHandler.createError('Ligne invalide ou déjà supprimée',
                    this.errorHandler.errorTypes.RUNTIME);
            }

            // Hook beforeRowRemove
            const beforeResults = await this.beforeRowRemove(row);
            if (beforeResults.some(result => result === false)) {
                throw this.errorHandler.createError('Suppression de ligne annulée par un hook',
                    this.errorHandler.errorTypes.RUNTIME);
            }

            const rowId = row.id;
            const rowData = this.getRowData(row);

            this.eventBus.emit('row:removing', { row, rowId, data: rowData });

            if (this.dom.removeRow(row)) {
                this.state.clearRowState(rowId);
                this.eventBus.emit('row:removed', { rowId });

                // Hook afterRowRemove
                await this.afterRowRemove(rowId);

                this.metrics.increment('rows_removed');
                return true;
            }

            return false;
        } catch (error) {
            this.errorHandler.handle(error);
            throw error;
        } finally {
            this.metrics.stopTimer(timer);
        }
    }

    getRowData(row) {
        if (!row) return {};
        
        const data = { id: row.id };
        const headers = Array.from(this.dom.table.querySelectorAll('thead th'));
        
        Array.from(row.cells).forEach((cell, index) => {
            const header = headers[index];
            if (!header?.id) return;
            
            const value = this.dom.getCellValue(cell);
            
            // Conversion de type
            if (!isNaN(value) && value !== '') {
                data[header.id] = Number(value);
            } else if (value === 'true' || value === 'false') {
                data[header.id] = value === 'true';
            } else {
                data[header.id] = value;
            }
        });
        
        return data;
    }

    // Gestion des événements
    on(event, callback) {
        return this.eventBus.on(event, callback);
    }

    off(event, callback) {
        this.eventBus.off(event, callback);
    }

    // Fonctionnalités de débogage
    enableDebug(options = {}) {
        this.debug.enabled = true;
        this.debug.performance.enabled = options.performance || false;
        this.debug.memory.enabled = options.memory || false;
        
        if (this.debug.performance.enabled) {
            this.startPerformanceMonitoring();
        }
        
        if (this.debug.memory.enabled) {
            this.startMemoryMonitoring();
        }
    }

    disableDebug() {
        this.debug.enabled = false;
        this.debug.performance.enabled = false;
        this.debug.memory.enabled = false;
    }

    startPerformanceMonitoring() {
        if (!this.debug.performance.enabled) return;

        const originalMethods = {
            addRow: this.addRow,
            removeRow: this.removeRow,
            getRowData: this.getRowData
        };

        // Wrapper pour mesurer les performances
        const measurePerformance = async (method, ...args) => {
            const start = performance.now();
            try {
                return await method.apply(this, args);
            } finally {
                const duration = performance.now() - start;
                this.debug.performance.history.push({
                    method: method.name,
                    duration,
                    timestamp: Date.now(),
                    args
                });

                if (duration > this.debug.performance.threshold) {
                    this.logger.warn(`Performance warning: ${method.name} took ${duration.toFixed(2)}ms`);
                }
            }
        };

        // Appliquer les wrappers
        this.addRow = measurePerformance.bind(this, originalMethods.addRow);
        this.removeRow = measurePerformance.bind(this, originalMethods.removeRow);
        this.getRowData = measurePerformance.bind(this, originalMethods.getRowData);
    }

    startMemoryMonitoring() {
        if (!this.debug.memory.enabled) return;

        const measureMemory = () => {
            if (performance.memory) {
                this.debug.memory.history.push({
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    timestamp: Date.now()
                });
            }
        };

        this.memoryInterval = setInterval(measureMemory, 1000);
    }

    getPerformanceStats() {
        if (!this.debug.performance.enabled) return null;

        const stats = {};
        const methods = new Set(this.debug.performance.history.map(h => h.method));

        methods.forEach(method => {
            const methodHistory = this.debug.performance.history.filter(h => h.method === method);
            const durations = methodHistory.map(h => h.duration);
            
            stats[method] = {
                count: methodHistory.length,
                average: durations.reduce((a, b) => a + b, 0) / durations.length,
                min: Math.min(...durations),
                max: Math.max(...durations),
                thresholdExceeded: methodHistory.filter(h => h.duration > this.debug.performance.threshold).length
            };
        });

        return stats;
    }

    getMemoryStats() {
        if (!this.debug.memory.enabled) return null;

        const history = this.debug.memory.history;
        if (history.length === 0) return null;

        return {
            current: history[history.length - 1],
            average: {
                usedJSHeapSize: history.reduce((a, b) => a + b.usedJSHeapSize, 0) / history.length,
                totalJSHeapSize: history.reduce((a, b) => a + b.totalJSHeapSize, 0) / history.length
            },
            max: {
                usedJSHeapSize: Math.max(...history.map(h => h.usedJSHeapSize)),
                totalJSHeapSize: Math.max(...history.map(h => h.totalJSHeapSize))
            }
        };
    }

    // Optimisation des performances
    optimize() {
        // Optimisation du DOM
        this.optimizeDOM();

        // Optimisation du cache
        this.optimizeCache();

        // Optimisation de la validation
        this.optimizeValidation();
    }

    optimizeDOM() {
        // Utiliser requestAnimationFrame pour les mises à jour du DOM
        const originalMethods = {
            addRow: this.addRow,
            removeRow: this.removeRow
        };

        this.addRow = async (...args) => {
            return new Promise(resolve => {
                requestAnimationFrame(async () => {
                    const result = await originalMethods.addRow.apply(this, args);
                    resolve(result);
                });
            });
        };

        this.removeRow = async (...args) => {
            return new Promise(resolve => {
                requestAnimationFrame(async () => {
                    const result = await originalMethods.removeRow.apply(this, args);
                    resolve(result);
                });
            });
        };
    }

    optimizeCache() {
        // Optimiser la stratégie de cache en fonction de l'utilisation
        const stats = this.cache.getStats();
        if (stats) {
            if (stats.hitRate < 0.5) {
                this.cache.setStrategy('lru');
            } else if (stats.hitRate > 0.8) {
                this.cache.setStrategy('lfu');
            }
        }
    }

    optimizeValidation() {
        // Optimiser la validation en fonction des erreurs courantes
        const validationStats = this.validation.getStats();
        if (validationStats) {
            const mostCommonErrors = validationStats.getMostCommonErrors();
            this.validation.setPriorityRules(mostCommonErrors);
        }
    }

    // Nettoyage
    destroy() {
        if (this.memoryInterval) {
            clearInterval(this.memoryInterval);
        }
        const timer = this.metrics.startTimer('destroy');
        try {
            this.logger.info('Destruction de l\'instance TableFlow...');

            // Détruire les gestionnaires
            this.eventBus.removeAllListeners();
            this.cache.destroy();
            this.validation.destroy();
            this.metrics.destroy();
            this.dom.destroy();

            // Détruire les plugins
            this.plugins?.forEach(plugin => {
                try {
                    plugin.destroy();
                } catch (error) {
                    this.logger.error(`Erreur lors de la destruction du plugin: ${error.message}`, error);
                }
            });
            this.plugins?.clear();

            this.logger.success('Instance TableFlow détruite avec succès');
        } catch (error) {
            this.logger.error(`Erreur lors de la destruction: ${error.message}`, error);
            throw error;
        } finally {
            this.metrics.stopTimer(timer);
        }
    }

    /**
     * Exporte les données du tableau au format CSV
     * @returns {string} - Données au format CSV
     */
    exportToCSV() {
        const headers = Array.from(this.dom.table.querySelectorAll('thead th'));
        const data = Array.from(this.dom.table.querySelectorAll('tbody tr'))
            .map(row => this.getRowData(row));
        return this.dataManager.exportToCSV(data, headers);
    }

    /**
     * Exporte les données du tableau au format JSON
     * @returns {string} - Données au format JSON
     */
    exportToJSON() {
        const data = Array.from(this.dom.table.querySelectorAll('tbody tr'))
            .map(row => this.getRowData(row));
        return this.dataManager.exportToJSON(data);
    }

    /**
     * Importe des données depuis un fichier CSV
     * @param {string} csv - Contenu CSV
     */
    importFromCSV(csv) {
        try {
            const headers = Array.from(this.dom.table.querySelectorAll('thead th'));
            const data = this.dataManager.importFromCSV(csv, headers);
            
            // Vider le tableau
            const tbody = this.dom.table.querySelector('tbody');
            tbody.innerHTML = '';

            // Ajouter les nouvelles données
            data.forEach(rowData => {
                this.addRow(rowData);
            });

            this.notifications.show('Données importées avec succès', 'success');
        } catch (error) {
            this.logger.error(`Erreur lors de l'import CSV: ${error.message}`, error);
            this.notifications.show(`Erreur d'import: ${error.message}`, 'error');
        }
    }

    /**
     * Importe des données depuis un fichier JSON
     * @param {string} json - Contenu JSON
     */
    importFromJSON(json) {
        try {
            const data = this.dataManager.importFromJSON(json);
            
            // Vider le tableau
            const tbody = this.dom.table.querySelector('tbody');
            tbody.innerHTML = '';

            // Ajouter les nouvelles données
            data.forEach(rowData => {
                this.addRow(rowData);
            });

            this.notifications.show('Données importées avec succès', 'success');
        } catch (error) {
            this.logger.error(`Erreur lors de l'import JSON: ${error.message}`, error);
            this.notifications.show(`Erreur d'import: ${error.message}`, 'error');
        }
    }

    // Méthodes pour la gestion des plugins coopératifs
    registerCooperativePlugin(plugin) {
        if (plugin.name === 'filter') {
            this.cooperativePlugins.filter = plugin;
        } else if (plugin.name === 'pagination') {
            this.cooperativePlugins.pagination = plugin;
        }
    }

    async updateSharedState(updates) {
        if (!updates || typeof updates !== 'object') {
            this.errorHandler.handle(
                new Error('Invalid updates format'),
                this.errorHandler.errorTypes.VALIDATION
            );
            return;
        }

        if (this.sharedState.isUpdating) {
            this.sharedState.updateQueue.push(updates);
            return;
        }

        const startTime = performance.now();
        this.sharedState.isUpdating = true;

        try {
            // Valider les mises à jour
            for (const [key, value] of Object.entries(updates)) {
                if (this.sharedState[key] === undefined) {
                    throw new Error(`Invalid state key: ${key}`);
                }
                if (key === 'pageSize' && (!Number.isInteger(value) || value < 1)) {
                    throw new Error('Invalid page size');
                }
                if (key === 'currentPage' && (!Number.isInteger(value) || value < 1)) {
                    throw new Error('Invalid page number');
                }
            }

            // Appliquer les mises à jour
            Object.assign(this.sharedState, updates);
            this.sharedState.lastUpdate = Date.now();

            // Synchroniser les plugins
            await this.synchronizePlugins(updates);

            // Émettre l'événement de mise à jour
            this.eventBus.emit('state:updated', {
                updates,
                duration: performance.now() - startTime
            });

            // Traiter la file d'attente
            while (this.sharedState.updateQueue.length > 0) {
                const queuedUpdates = this.sharedState.updateQueue.shift();
                await this.updateSharedState(queuedUpdates);
            }
        } catch (error) {
            this.errorHandler.handle(error, this.errorHandler.errorTypes.RUNTIME, {
                context: 'updateSharedState',
                updates
            });
        } finally {
            this.sharedState.isUpdating = false;
        }
    }

    async synchronizePlugins(updates = null) {
        const plugins = [this.cooperativePlugins.filter, this.cooperativePlugins.pagination]
            .filter(Boolean);

        try {
            await Promise.all(plugins.map(plugin => 
                plugin?.handleSharedStateChange(updates || this.sharedState)
            ));
        } catch (error) {
            this.errorHandler.handle(error, this.errorHandler.errorTypes.PLUGIN, {
                context: 'synchronizePlugins'
            });
        }
    }

    async whenReady() {
        return this.readyPromise;
    }
}