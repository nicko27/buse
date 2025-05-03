export default class TableFlow {
    constructor(options = {}) {
        this.options = {
            tableId: options.tableId,
            plugins: options.plugins || [],
            pluginsPath: options.pluginsPath || '../plugins',
            onSort: options.onSort,
            onFilter: options.onFilter,
            onEdit: options.onEdit,
            onChoice: options.onChoice,
            cellWrapperClass: options.cellWrapperClass || 'cell-wrapper',
            headWrapperClass: options.headWrapperClass || 'head-wrapper',
            logLevel: options.logLevel || 'info', // 'error', 'warn', 'info', 'debug'
            debug: options.debug || false,
            notifications: options.notifications || {}
        };

        // État initial
        this.initialized = false;
        this.plugins = new Map();
        this.initialValues = new Map();
        this.eventListeners = new Map();
        
        // Configurer le logger
        this.setupLogger();
        
        // Validation des options requises
        if (!this.options.tableId) {
            throw new Error("L'option 'tableId' est requise");
        }
        
        // Configuration des notifications
        this.notifications = {
            info: (msg) => console.info(`[TableFlow] ℹ️ ${msg}`),
            warning: (msg) => console.warn(`[TableFlow] ⚠️ ${msg}`),
            success: (msg) => console.log(`[TableFlow] ✅ ${msg}`),
            error: (msg) => console.error(`[TableFlow] ❌ ${msg}`),
            ...this.options.notifications
        };
    }

    /**
     * Configure le système de logging
     */
    setupLogger() {
        const levels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3
        };

        const currentLevel = levels[this.options.logLevel] || levels.info;

        this.logger = {
            error: (...args) => {
                if (currentLevel >= levels.error) {
                    console.error('[TableFlow]', ...args);
                    this.notify('error', args[0]);
                }
            },
            warn: (...args) => {
                if (currentLevel >= levels.warn) {
                    console.warn('[TableFlow]', ...args);
                    this.notify('warning', args[0]);
                }
            },
            info: (...args) => {
                if (currentLevel >= levels.info) {
                    console.info('[TableFlow]', ...args);
                    this.notify('info', args[0]);
                }
            },
            debug: (...args) => {
                if (currentLevel >= levels.debug) {
                    console.log('[TableFlow]', ...args);
                }
            },
            success: (...args) => {
                if (currentLevel >= levels.info) {
                    console.log('[TableFlow]', ...args);
                    this.notify('success', args[0]);
                }
            }
        };
    }

    /**
     * Initialise TableFlow
     * @returns {Promise<TableFlow>}
     */
    async init() {
        if (this.initialized) {
            this.logger.warn('TableFlow déjà initialisé');
            return this;
        }

        try {
            this.logger.info('Initialisation de TableFlow...');
            
            // Récupérer et valider la table
            this.table = document.getElementById(this.options.tableId);
            if (!this.table) {
                throw new Error(`Table avec l'id "${this.options.tableId}" non trouvée`);
            }
            
            if (this.table.tagName.toLowerCase() !== 'table') {
                throw new Error(`L'élément avec l'id "${this.options.tableId}" n'est pas une table`);
            }

            // Initialiser les composants
            this.storeInitialValues();
            this.initializeWrappers();
            await this.loadPlugins();
            
            this.initialized = true;
            this.logger.success('TableFlow initialisé avec succès');
            
            return this;
        } catch (error) {
            this.logger.error('Échec de l\'initialisation:', error);
            throw error;
        }
    }

    /**
     * Stocke les valeurs initiales des cellules
     */
    storeInitialValues() {
        try {
            const rows = this.table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const rowValues = new Map();
                Array.from(row.cells).forEach(cell => {
                    const columnId = this.getColumnId(cell);
                    const value = cell.textContent.trim();
                    
                    rowValues.set(columnId, value);
                    cell.setAttribute('data-initial-value', value);
                    cell.setAttribute('data-value', value);
                });
                
                if (row.id) {
                    this.initialValues.set(row.id, rowValues);
                }
            });
            
            this.logger.debug('Valeurs initiales stockées');
        } catch (error) {
            this.logger.error('Erreur lors du stockage des valeurs initiales:', error);
            throw error;
        }
    }

    /**
     * Récupère l'ID de colonne pour une cellule
     */
    getColumnId(cell) {
        const columnIndex = cell.cellIndex;
        const headerCell = this.table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        return headerCell ? headerCell.id : `col${columnIndex}`;
    }

    /**
     * Initialise les wrappers pour les cellules
     */
    initializeWrappers() {
        try {
            // En-têtes
            const headerCells = this.table.querySelectorAll('thead th');
            headerCells.forEach(cell => {
                if (!cell.querySelector(`.${this.options.headWrapperClass}`)) {
                    const wrapper = document.createElement('div');
                    wrapper.className = this.options.headWrapperClass;
                    wrapper.innerHTML = cell.innerHTML;
                    cell.innerHTML = '';
                    cell.appendChild(wrapper);
                }
            });

            // Cellules du corps
            const bodyCells = this.table.querySelectorAll('tbody td');
            bodyCells.forEach(cell => {
                if (!cell.querySelector(`.${this.options.cellWrapperClass}`)) {
                    const wrapper = document.createElement('div');
                    wrapper.className = this.options.cellWrapperClass;
                    wrapper.innerHTML = cell.innerHTML;
                    cell.innerHTML = '';
                    cell.appendChild(wrapper);
                }
            });
            
            this.logger.debug('Wrappers initialisés');
        } catch (error) {
            this.logger.error('Erreur lors de l\'initialisation des wrappers:', error);
            throw error;
        }
    }

    /**
     * Charge les plugins
     */
    async loadPlugins() {
        if (!this.options.plugins || 
            (typeof this.options.plugins === 'object' && Object.keys(this.options.plugins).length === 0)) {
            this.logger.info('Aucun plugin à charger');
            return;
        }

        // Normaliser la configuration des plugins
        const pluginsToLoad = this.normalizePluginConfig();
        
        if (pluginsToLoad.length === 0) {
            this.logger.warn('Aucun plugin valide trouvé');
            return;
        }

        this.logger.info(`Chargement de ${pluginsToLoad.length} plugin(s)...`);
        
        const results = await Promise.allSettled(
            pluginsToLoad.map(plugin => this.loadPlugin(plugin.name, plugin.config))
        );

        // Analyser les résultats
        const succeeded = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;
        
        if (failed > 0) {
            this.logger.warn(`${succeeded}/${pluginsToLoad.length} plugins chargés avec succès`);
            results
                .filter(r => r.status === 'rejected')
                .forEach((r, i) => {
                    this.logger.error(`Échec du chargement du plugin ${pluginsToLoad[i].name}:`, r.reason);
                });
        } else {
            this.logger.success(`Tous les plugins chargés avec succès`);
        }
    }

    /**
     * Normalise la configuration des plugins
     */
    normalizePluginConfig() {
        let plugins = [];
        
        if (Array.isArray(this.options.plugins)) {
            // Format: ['plugin1', 'plugin2']
            plugins = this.options.plugins.map(name => ({
                name,
                config: {}
            }));
        } else if (this.options.plugins.names && Array.isArray(this.options.plugins.names)) {
            // Format: { names: ['plugin1', 'plugin2'], plugin1: {...} }
            plugins = this.options.plugins.names.map(name => ({
                name,
                config: this.options.plugins[name.toLowerCase()] || {}
            }));
        } else if (typeof this.options.plugins === 'object') {
            // Format: { plugin1: {...}, plugin2: {...} }
            plugins = Object.entries(this.options.plugins)
                .filter(([name, value]) => name !== 'names' && value !== false)
                .map(([name, config]) => ({
                    name,
                    config: typeof config === 'object' ? config : {}
                }));
        }
        
        return plugins;
    }

    /**
     * Charge un plugin individuel
     */
    async loadPlugin(name, config = {}) {
        try {
            const pluginPath = `${this.options.pluginsPath}/${name.toLowerCase()}.js`;
            this.logger.debug(`Chargement du plugin ${name} depuis ${pluginPath}`);
            
            const module = await import(pluginPath);
            
            if (!module.default) {
                throw new Error(`Le plugin ${name} n'exporte pas de classe par défaut`);
            }
            
            const Plugin = module.default;
            const instance = new Plugin({
                ...config,
                debug: this.options.debug
            });
            
            if (typeof instance.init !== 'function') {
                throw new Error(`Le plugin ${name} n'a pas de méthode init()`);
            }
            
            await instance.init(this);
            
            this.plugins.set(name.toLowerCase(), {
                instance,
                config,
                name
            });
            
            this.logger.debug(`Plugin ${name} chargé avec succès`);
            return instance;
        } catch (error) {
            this.logger.error(`Erreur lors du chargement du plugin ${name}:`, error);
            throw error;
        }
    }

    /**
     * Vérifie si un plugin est chargé
     */
    hasPlugin(name) {
        return this.plugins.has(name.toLowerCase());
    }

    /**
     * Récupère une instance de plugin
     */
    getPlugin(name) {
        const plugin = this.plugins.get(name.toLowerCase());
        return plugin ? plugin.instance : null;
    }

    /**
     * Ajoute un écouteur d'événement managé
     */
    on(eventName, handler, element = this.table) {
        if (!this.eventListeners.has(eventName)) {
            this.eventListeners.set(eventName, []);
        }
        
        this.eventListeners.get(eventName).push({ element, handler });
        element.addEventListener(eventName, handler);
    }

    /**
     * Déclenche un événement personnalisé
     */
    emit(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail,
            bubbles: true,
            cancelable: true
        });
        
        this.table.dispatchEvent(event);
    }

    /**
     * Rafraîchit tous les plugins
     */
    refreshPlugins() {
        const refreshed = [];
        const failed = [];
        
        for (const [name, plugin] of this.plugins) {
            try {
                if (plugin.instance && typeof plugin.instance.refresh === 'function') {
                    plugin.instance.refresh();
                    refreshed.push(name);
                }
            } catch (error) {
                this.logger.error(`Erreur lors du rafraîchissement du plugin ${name}:`, error);
                failed.push(name);
            }
        }
        
        if (failed.length > 0) {
            this.logger.warn(`${refreshed.length} plugins rafraîchis, ${failed.length} échecs`);
        } else {
            this.logger.debug(`${refreshed.length} plugins rafraîchis avec succès`);
        }
    }

    /**
     * Ajoute une nouvelle ligne
     */
    addRow(data = {}, position = 'end') {
        if (!this.initialized) {
            throw new Error('TableFlow doit être initialisé avant d\'ajouter des lignes');
        }
        
        const tbody = this.table.querySelector('tbody');
        if (!tbody) {
            throw new Error('Aucun tbody trouvé');
        }
        
        const row = document.createElement('tr');
        const rowId = `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        row.id = rowId;
        
        // Créer les cellules
        const headers = this.table.querySelectorAll('thead th');
        headers.forEach((header, index) => {
            const cell = document.createElement('td');
            const columnId = header.id || `col${index}`;
            cell.id = `${columnId}_${rowId}`;
            
            // Créer le wrapper
            const wrapper = document.createElement('div');
            wrapper.className = this.options.cellWrapperClass;
            
            // Déterminer la valeur
            let value = '';
            if (Array.isArray(data)) {
                value = data[index] || '';
            } else if (data[columnId] !== undefined) {
                value = data[columnId];
            } else {
                value = header.getAttribute('th-text-default') || '';
            }
            
            wrapper.textContent = value;
            cell.appendChild(wrapper);
            cell.setAttribute('data-value', value);
            cell.setAttribute('data-initial-value', value);
            
            row.appendChild(cell);
        });
        
        // Insérer la ligne
        if (position === 'start') {
            tbody.insertBefore(row, tbody.firstChild);
        } else {
            tbody.appendChild(row);
        }
        
        // Mettre à jour les valeurs initiales
        this.storeInitialValues();
        
        // Émettre l'événement
        this.emit('row:added', { row, data, position });
        
        // Rafraîchir les plugins
        this.refreshPlugins();
        
        return row;
    }

    /**
     * Supprime une ligne
     */
    removeRow(row) {
        if (!row || !row.parentNode) {
            throw new Error('Ligne invalide ou déjà supprimée');
        }
        
        const rowId = row.id;
        const data = this.getRowData(row);
        
        // Émettre l'événement avant suppression
        this.emit('row:removing', { row, rowId, data });
        
        // Supprimer la ligne
        row.parentNode.removeChild(row);
        
        // Nettoyer les données initiales
        if (rowId) {
            this.initialValues.delete(rowId);
        }
        
        // Émettre l'événement après suppression
        this.emit('row:removed', { rowId, data });
        
        // Rafraîchir les plugins
        this.refreshPlugins();
        
        return true;
    }

    /**
     * Récupère les données d'une ligne
     */
    getRowData(row) {
        if (!row) return null;
        
        const data = {};
        if (row.id) data.id = row.id;
        
        const headers = this.table.querySelectorAll('thead th');
        Array.from(row.cells).forEach((cell, index) => {
            const header = headers[index];
            if (!header) return;
            
            const columnId = header.id || `col${index}`;
            let value = cell.getAttribute('data-value');
            
            if (value === null) {
                const wrapper = cell.querySelector(`.${this.options.cellWrapperClass}`);
                value = wrapper ? wrapper.textContent : cell.textContent;
            }
            
            data[columnId] = value;
        });
        
        return data;
    }

    /**
     * Met à jour une cellule
     */
    updateCell(row, columnId, value) {
        const cell = row.querySelector(`td[id^="${columnId}_"]`);
        if (!cell) {
            throw new Error(`Cellule non trouvée pour la colonne ${columnId}`);
        }
        
        const oldValue = cell.getAttribute('data-value');
        cell.setAttribute('data-value', value);
        
        const wrapper = cell.querySelector(`.${this.options.cellWrapperClass}`);
        if (wrapper) {
            wrapper.textContent = value;
        } else {
            cell.textContent = value;
        }
        
        // Émettre l'événement
        this.emit('cell:changed', {
            cell,
            columnId,
            oldValue,
            newValue: value,
            row
        });
        
        return true;
    }

    /**
     * Détruit l'instance TableFlow
     */
    destroy() {
        try {
            // Détruire les plugins
            for (const [name, plugin] of this.plugins) {
                if (plugin.instance && typeof plugin.instance.destroy === 'function') {
                    try {
                        plugin.instance.destroy();
                    } catch (error) {
                        this.logger.error(`Erreur lors de la destruction du plugin ${name}:`, error);
                    }
                }
            }
            
            // Nettoyer les écouteurs d'événements
            for (const [eventName, listeners] of this.eventListeners) {
                listeners.forEach(({ element, handler }) => {
                    element.removeEventListener(eventName, handler);
                });
            }
            
            // Nettoyer les données
            this.plugins.clear();
            this.eventListeners.clear();
            this.initialValues.clear();
            
            this.initialized = false;
            this.logger.info('TableFlow détruit avec succès');
        } catch (error) {
            this.logger.error('Erreur lors de la destruction:', error);
        }
    }

    /**
     * Notifie l'utilisateur
     */
    notify(type, message) {
        if (this.notifications && typeof this.notifications[type] === 'function') {
            this.notifications[type](message);
        }
    }
}