class TableFlow {
    constructor(options = {}) {
        this.options = {
            tableId: options.tableId,
            plugins: options.plugins || [],
            pluginsPath: options.pluginsPath || '/buse/public/assets/libs/tableFlow/plugins',
            onSort: options.onSort,
            onFilter: options.onFilter,
            onEdit: options.onEdit,
            onChoice: options.onChoice,
            cellWrapperClass: options.cellWrapperClass || 'cell-wrapper',
            headWrapperClass: options.headWrapperClass || 'head-wrapper',
            debug: options.debug || false,
            verbosity: 0,
            notifications: {}
        };

        this.table = document.getElementById(this.options.tableId);
        if (!this.table) {
            throw new Error(`Table with id "${this.options.tableId}" not found`);
        }

        // Stocker les valeurs initiales des cellules
        this.initialValues = new Map();
        this.storeInitialValues();

        this.plugins = new Map();
        this.notifications = options.notifications || {
            info: console.info,
            warning: console.warn,
            success: console.log,
            error: console.error
        };

        // Créer le contexte du tableau
        this.tableContext = this.createTableContext();

        this.initialize();
    }

    createTableContext() {
        return {
            table: this.table,
            container: this.table.parentElement,
            getRows: () => this.table.querySelectorAll('tbody tr'),
            getCells: () => this.table.querySelectorAll('td'),
            getHeaders: () => this.table.querySelectorAll('th'),
            getColumnById: (id) => this.table.querySelector(`th#${id}`),
            getCellsByColumn: (columnId) => {
                const index = this.getColumnIndex(columnId);
                return Array.from(this.table.querySelectorAll(`tbody tr td:nth-child(${index + 1})`));
            },
            getColumnIndex: (columnId) => {
                const headers = Array.from(this.table.querySelectorAll('th'));
                return headers.findIndex(th => th.id === columnId);
            },
            getCell: (rowId, columnId) => {
                const row = this.table.querySelector(`tr#${rowId}`);
                const columnIndex = this.getColumnIndex(columnId);
                return row ? row.cells[columnIndex] : null;
            },
            getCellValue: (rowId, columnId) => {
                const rowValues = this.initialValues.get(rowId);
                return rowValues ? rowValues.get(columnId) : null;
            },
            initialValues: this.initialValues,
            options: this.options,
            notify: (type, message) => this.notifications[type](message)
        };
    }

    getColumnIndex(columnId) {
        const headers = Array.from(this.table.querySelectorAll('th'));
        return headers.findIndex(th => th.id === columnId);
    }

    storeInitialValues() {
        const rows = this.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const rowValues = new Map();
            Array.from(row.cells).forEach(cell => {
                const columnId = this.table.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`).id;
                rowValues.set(columnId, cell.textContent.trim());
            });
            this.initialValues.set(row.id, rowValues);
        });
    }

    async initialize() {
        await this.loadPlugins();
        this.initializeWrappers();
    }

    async loadPlugins() {
        if (!this.options.plugins) return;

        // Extraire la liste des plugins à charger
        let pluginsToLoad = this.extractPluginsToLoad();

        // Charger chaque plugin
        for (const plugin of pluginsToLoad) {
            try {
                await this.loadAndInitializePlugin(plugin);
            } catch (error) {
                this.notifications.error(`Error loading plugin ${plugin.name}: ${error.message}`);
            }
        }
    }

    extractPluginsToLoad() {
        if (this.options.plugins.names && Array.isArray(this.options.plugins.names)) {
            const { names, ...configs } = this.options.plugins;
            return names.map(name => ({
                name,
                config: configs[name.toLowerCase()] || {}
            }));
        } else if (Array.isArray(this.options.plugins)) {
            return this.options.plugins.map(plugin => ({
                name: typeof plugin === 'string' ? plugin : plugin.name,
                config: typeof plugin === 'string' ? {} : (plugin.config || {})
            }));
        } else if (typeof this.options.plugins === 'object') {
            return Object.entries(this.options.plugins)
                .filter(([_, value]) => value !== false)
                .map(([name, value]) => ({
                    name,
                    config: typeof value === 'object' ? value : {}
                }));
        }
        return [];
    }

    async loadAndInitializePlugin(plugin) {
        const pluginPath = plugin.path || 
            `${this.options.pluginsPath}/${plugin.name.toLowerCase()}.js`;

        // Charger le code du plugin
        const response = await fetch(pluginPath);
        if (!response.ok) {
            throw new Error(`Failed to load plugin ${plugin.name}`);
        }
        const pluginCode = await response.text();

        // Évaluer le code du plugin
        try {
            eval(pluginCode);
        } catch (evalError) {
            throw new Error(`Failed to evaluate plugin ${plugin.name}: ${evalError.message}`);
        }

        // Créer et initialiser l'instance du plugin
        const pluginClass = window[plugin.name];
        if (!pluginClass) {
            throw new Error(`Plugin class ${plugin.name} not found`);
        }

        const pluginInstance = new pluginClass(plugin.config);
        const pluginContext = this.createPluginContext(plugin.name);
        await pluginInstance.init(pluginContext);
        this.plugins.set(plugin.name, pluginInstance);
    }

    createPluginContext(pluginName) {
        return {
            ...this.tableContext,
            pluginName,
            getPlugin: (name) => this.plugins.get(name),
            attachToElement: (element) => {
                element.dataset.plugin = pluginName;
                return element;
            }
        };
    }

    initializeWrappers() {
        // Wrapper pour les en-têtes
        const headers = this.table.querySelectorAll('th');
        headers.forEach(header => {
            if (!header.querySelector(`.${this.options.headWrapperClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.options.headWrapperClass;
                wrapper.innerHTML = header.innerHTML;
                header.innerHTML = '';
                header.appendChild(wrapper);
            }
        });

        // Wrapper pour les cellules
        const cells = this.table.querySelectorAll('td');
        cells.forEach(cell => {
            if (!cell.querySelector(`.${this.options.cellWrapperClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.options.cellWrapperClass;
                wrapper.innerHTML = cell.innerHTML;
                cell.innerHTML = '';
                cell.appendChild(wrapper);
            }
        });
    }

    getPluginContext(pluginName) {
        return this.createPluginContext(pluginName);
    }

    attachPluginToElement(element, pluginName) {
        const plugin = this.plugins.get(pluginName);
        if (plugin && typeof plugin.attachTo === 'function') {
            element.dataset.plugin = pluginName;
            plugin.attachTo(element, this.getPluginContext(pluginName));
        }
    }

    destroy() {
        // Détruire tous les plugins
        for (const [name, plugin] of this.plugins) {
            if (typeof plugin.destroy === 'function') {
                plugin.destroy();
            }
        }
        this.plugins.clear();
    }

    hasPlugin(name) {
        return this.plugins.has(name);
    }

    getPlugin(name) {
        const plugin = this.plugins.get(name);
        return plugin ? plugin : null;
    }

    refreshPlugins() {
        // Rafraîchit les plugins dans l'ordre de leurs dépendances
        const refreshed = new Set();
        
        const refreshPlugin = (pluginName) => {
            if (refreshed.has(pluginName)) return;
            
            const pluginInfo = this.plugins.get(pluginName);
            if (!pluginInfo) return;

            // Puis rafraîchit le plugin lui-même
            if (typeof pluginInfo.refresh === 'function') {
                pluginInfo.refresh();
            }
            refreshed.add(pluginName);
        };

        // Rafraîchit tous les plugins
        this.plugins.forEach((_, name) => refreshPlugin(name));
    }

    getVisibleRows() {
        return Array.from(this.table.querySelectorAll('tbody tr')).filter(
            row => !row.classList.contains('filtered')
        );
    }

    getAllRows() {
        return Array.from(this.table.querySelectorAll('tbody tr'));
    }

    getHeaderCell(columnIndex) {
        console.log('Getting header cell for column', columnIndex);
        const headerRow = this.table.querySelector('thead tr');
        if (!headerRow) {
            console.warn('No header row found');
            return null;
        }
        const headerCell = headerRow.children[columnIndex];
        console.log('Header cell found:', headerCell);
        return headerCell;
    }

    isEditable() {
        console.log('Checking if table is editable');
        // Par défaut, la table est éditable sauf si explicitement marquée comme readonly
        const isReadonly = this.table.hasAttribute('th-readonly');
        console.log('Table readonly?', isReadonly);
        return !isReadonly;
    }

    isRowModified(row) {
        if (!row) return false;

        const initialValues = this.initialValues.get(row.id);
        if (!initialValues) return false;

        // Vérifier d'abord si un plugin a marqué la ligne comme modifiée
        if (row.hasAttribute('data-modified')) {
            return true;
        }

        // Vérifier si une cellule est marquée comme modifiée
        if (Array.from(row.cells).some(cell => cell.hasAttribute('data-modified'))) {
            return true;
        }

        // Sinon, vérifier les modifications de texte
        return Array.from(row.cells).some(cell => {
            const columnId = this.table.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`).id;
            const initialValue = initialValues.get(columnId);
            if (!initialValue) return false;

            return initialValue !== cell.textContent.trim();
        });
    }

    markRowAsModified(row) {
        if (!row) return;
        
        if (this.isRowModified(row)) {
            row.classList.add('modified');
        } else {
            row.classList.remove('modified');
        }
    }

    updateCellValue(row, columnId, value) {
        const cell = row.querySelector(`td[id^="${columnId}_"]`);
        if (!cell) return;

        const wrapper = cell.querySelector(`.${this.options.cellWrapperClass}`);
        if (wrapper) {
            wrapper.textContent = value;
        } else {
            cell.textContent = value;
        }

        this.markRowAsModified(row);
    }

    markRowAsSaved(row) {
        if (!row) return;
        
        // Update internal initialValues map
        const rowValues = new Map();
        Array.from(row.cells).forEach(cell => {
            const columnId = this.table.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`).id;
            rowValues.set(columnId, cell.textContent.trim());
        });
        this.initialValues.set(row.id, rowValues);
        
        // Use edit plugin to update data-initial-value attributes
        const editPlugin = this.getPlugin('edit');
        if (editPlugin && editPlugin.refresh) {
            editPlugin.refresh();
        } else {
            // Fallback if edit plugin is not available
            row.removeAttribute('data-modified');
            row.classList.remove('modified');
            this.table.dispatchEvent(new CustomEvent('row:saved', {
                detail: { row },
                bubbles: true
            }));
        }
    }

    updateRow(rowIndex, data) {
        const row = this.table.querySelector(`tbody tr:nth-child(${rowIndex + 1})`);
        if (row) {
            Object.entries(data).forEach(([columnIndex, value]) => {
                const cell = row.cells[columnIndex];
                if (cell) {
                    // Skip choice cells
                    if (!cell.classList.contains('choice-cell')) {
                        cell.textContent = value;
                    }
                }
            });
            this.refreshPlugins();
        }
    }

    addRow(data = [], position = 'end') {
        const tbody = this.table.querySelector('tbody');
        if (!tbody) return null;

        const row = document.createElement('tr');
        const headers = this.table.querySelectorAll('thead th');
        const newId = Date.now(); // Temporary ID for new row
        row.id = newId;

        // Create cells based on headers
        headers.forEach((header, index) => {
            const cell = document.createElement('td');
            const wrapper = document.createElement('div');
            wrapper.className = this.options.cellWrapperClass;

            // Get default value from header if specified
            const defaultValue = header.getAttribute('th-text-default') || '';
            wrapper.textContent = data[index] || defaultValue;

            cell.id = `${header.id}_${newId}`;
            cell.appendChild(wrapper);
            row.appendChild(cell);
        });

        // Add the row at the specified position
        if (position === 'start') {
            tbody.insertBefore(row, tbody.firstChild);
        } else {
            tbody.appendChild(row);
        }

        // Initialize row for plugins
        this.initializeWrappers();
        this.storeInitialValues();

        // Dispatch event for plugins to handle the new row
        this.table.dispatchEvent(new CustomEvent('row:added', {
            detail: { row, position },
            bubbles: true
        }));

        // Mark as modified since it's a new row
        row.classList.add('modified');

        this.refreshPlugins();
        return row;
    }

    removeRow(row) {
        if (row && row.parentNode) {
            row.parentNode.removeChild(row);
            // Remove from initialValues if it exists
            if (row.id && this.initialValues.has(row.id)) {
                this.initialValues.delete(row.id);
            }
            // Dispatch a custom event
            this.table.dispatchEvent(new CustomEvent('row:removed', {
                detail: { row },
                bubbles: true
            }));
            return true;
        }
        return false;
    }

    notify(type, message) {
        if (this.options.notifications && typeof this.options.notifications[type] === 'function') {
            this.options.notifications[type](message);
        }
    }
}

// Export pour compatibilité avec les modules ES6
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableFlow;
} else {
    window.TableFlow = TableFlow;
}
