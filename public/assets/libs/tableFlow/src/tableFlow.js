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
            debug: options.debug || false,
            verbosity: options.verbosity || 0,
            notifications: {}
        };

        // Configurer le système de journalisation
        this.logger = {
            error: (message, data) => {
                console.error(`[TableFlow] ❌ ERROR: ${message}`, data || '');
                this.notify('error', message);
            },
            warn: (message, data) => {
                console.warn(`[TableFlow] ⚠️ WARNING: ${message}`, data || '');
                this.notify('warning', message);
            },
            info: (message, data) => {
                if (this.options.debug || this.options.verbosity > 0) {
                    console.info(`[TableFlow] ℹ️ INFO: ${message}`, data || '');
                }
                this.notify('info', message);
            },
            debug: (message, data) => {
                if (this.options.debug || this.options.verbosity > 1) {
                    console.log(`[TableFlow] 🔍 DEBUG: ${message}`, data || '');
                }
            },
            success: (message, data) => {
                if (this.options.debug || this.options.verbosity > 0) {
                    console.log(`[TableFlow] ✅ SUCCESS: ${message}`, data || '');
                }
                this.notify('success', message);
            }
        };

        try {
            // Vérifier que l'ID de la table est fourni
            if (!this.options.tableId) {
                throw new Error("L'option 'tableId' est requise");
            }

            // Récupérer la table
            this.table = document.getElementById(this.options.tableId);
            if (!this.table) {
                throw new Error(`Table avec l'id "${this.options.tableId}" non trouvée dans le DOM`);
            }

            // Vérifier que l'élément est bien une table
            if (this.table.tagName.toLowerCase() !== 'table') {
                throw new Error(`L'élément avec l'id "${this.options.tableId}" n'est pas une table`);
            }

            // Stocker les valeurs initiales des cellules
            this.initialValues = new Map();
            this.storeInitialValues();

            this.plugins = new Map();
            this.notifications = options.notifications || {
                info: message => this.logger.info(message),
                warning: message => this.logger.warn(message),
                success: message => this.logger.success(message),
                error: message => this.logger.error(message)
            };

            // Initialisation asynchrone
            this.initialize().catch(error => {
                this.logger.error(`Échec de l'initialisation: ${error.message}`, error);
                // Re-throw pour permettre à l'appelant de capturer l'erreur
                throw error;
            });

            this.logger.info(`TableFlow initialisé pour la table #${this.options.tableId}`);
        } catch (error) {
            this.logger.error(`Échec de la création de TableFlow: ${error.message}`, error);
            // Re-throw pour permettre à l'appelant de capturer l'erreur
            throw error;
        }
    }

    storeInitialValues() {
        try {
            const rows = this.table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const rowValues = new Map();
                Array.from(row.cells).forEach(cell => {
                    const columnId = this.table.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`).id;
                    const value = cell.textContent.trim();
                    rowValues.set(columnId, value);
                    
                    // Ajouter les attributs data-initial-value et data-value
                    cell.setAttribute('data-initial-value', value);
                    cell.setAttribute('data-value', value);
                });
                this.initialValues.set(row.id, rowValues);
            });
            this.logger.debug('Valeurs initiales stockées avec succès');
        } catch (error) {
            this.logger.error(`Échec du stockage des valeurs initiales: ${error.message}`, error);
            throw error;
        }
    }

    async initialize() {
        try {
            this.logger.info('Démarrage de l\'initialisation...');
            await this.loadPlugins();
            this.initializeWrappers();
            this.logger.success('Initialisation terminée avec succès');
        } catch (error) {
            this.logger.error(`Échec de l'initialisation: ${error.message}`, error);
            throw error;
        }
    }

    async loadPlugins() {
        if (!this.options.plugins) {
            this.logger.info('Aucun plugin à charger');
            return;
        }

        // Normaliser la configuration des plugins
        let pluginsToLoad = [];
        
        if (this.options.plugins.names && Array.isArray(this.options.plugins.names)) {
            // Nouvelle approche avec tableau de noms
            pluginsToLoad = this.options.plugins.names.map(name => {
                const lowerName = name.toLowerCase();
                const pluginConfig = this.options.plugins[lowerName] || {};
                return {
                    name,
                    config: {
                        ...pluginConfig,
                        debug: this.options.debug
                    }
                };
            });
            this.logger.debug(`${pluginsToLoad.length} plugins à charger via la configuration 'names'`, pluginsToLoad);
        } else if (typeof this.options.plugins === 'object') {
            // Ancienne approche avec objets de configuration
            pluginsToLoad = Object.entries(this.options.plugins)
                .filter(([name, value]) => name !== 'names' && value !== false)
                .map(([name, config]) => ({
                    name,
                    config: {
                        ...(typeof config === 'object' ? config : {}),
                        debug: this.options.debug
                    }
                }));
            this.logger.debug(`${pluginsToLoad.length} plugins à charger via la configuration objet`, pluginsToLoad);
        }

        if (pluginsToLoad.length === 0) {
            this.logger.warn('Aucun plugin à charger après normalisation. Vérifiez votre configuration de plugins.');
            return;
        }

        // Charger chaque plugin
        const pluginErrors = [];
        let loadedPluginsCount = 0;

        for (const plugin of pluginsToLoad) {
            try {
                const pluginPath = `${this.options.pluginsPath}/${plugin.name.toLowerCase()}.js`;
                
                this.logger.debug(`Chargement du plugin: ${plugin.name} depuis ${pluginPath}`);

                // Charger le plugin
                try {
                    const pluginModule = await import(pluginPath);
                    
                    if (!pluginModule.default) {
                        throw new Error(`Le plugin ${plugin.name} n'exporte pas de classe par défaut`);
                    }

                    // Instancier le plugin avec sa configuration
                    const pluginInstance = new pluginModule.default({
                        ...plugin.config,
                        tableHandler: this
                    });

                    // Vérifier l'interface du plugin
                    if (typeof pluginInstance.init !== 'function') {
                        throw new Error(`Le plugin ${plugin.name} ne possède pas de méthode init()`);
                    }

                    // Initialiser le plugin
                    this.logger.debug(`Initialisation du plugin ${plugin.name}...`);
                    await Promise.resolve(pluginInstance.init(this));

                    // Stocker l'instance du plugin
                    this.plugins.set(plugin.name.toLowerCase(), {
                        instance: pluginInstance,
                        config: plugin.config
                    });

                    loadedPluginsCount++;
                    this.logger.success(`Plugin ${plugin.name} chargé et initialisé avec succès`);

                } catch (importError) {
                    // Capture les erreurs spécifiques d'importation de module
                    if (importError.message.includes("Failed to fetch") || 
                        importError.message.includes("Cannot find module") ||
                        importError.message.includes("Unexpected token")) {
                        throw new Error(`Impossible de charger le plugin ${plugin.name} depuis ${pluginPath}. Vérifiez que le fichier existe et est accessible. Erreur: ${importError.message}`);
                    } else {
                        throw importError; // Re-throw pour capture par le bloc catch externe
                    }
                }

            } catch (error) {
                // Capture les erreurs d'initialisation de plugin
                const errorMessage = `Échec du chargement du plugin ${plugin.name}: ${error.message}`;
                this.logger.error(errorMessage, error);
                pluginErrors.push({ plugin: plugin.name, error: errorMessage });
                
                // Stocker l'erreur pour référence
                this.plugins.set(plugin.name.toLowerCase(), { error });
            }
        }

        // Résumé du chargement des plugins
        if (loadedPluginsCount === 0 && pluginsToLoad.length > 0) {
            const errorDetail = pluginErrors.map(e => `- ${e.plugin}: ${e.error}`).join('\n');
            const errorMessage = `Échec du chargement de tous les plugins (${pluginsToLoad.length} tentatives). Vérifiez les chemins et la configuration.\n${errorDetail}`;
            this.logger.error(errorMessage);
            throw new Error(errorMessage);
        } else if (pluginErrors.length > 0) {
            const errorDetail = pluginErrors.map(e => `- ${e.plugin}: ${e.error}`).join('\n');
            this.logger.warn(`${loadedPluginsCount}/${pluginsToLoad.length} plugins chargés avec succès. ${pluginErrors.length} erreurs:\n${errorDetail}`);
        } else {
            this.logger.success(`Tous les plugins (${loadedPluginsCount}) ont été chargés avec succès`);
        }
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                this.logger.debug(`Script ${src} déjà chargé, saut du chargement`);
                resolve();
                return;
            }

            this.logger.debug(`Chargement du script externe: ${src}`);
            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                this.logger.debug(`Script ${src} chargé avec succès`);
                resolve();
            };
            script.onerror = () => {
                const error = new Error(`Échec du chargement du script ${src}`);
                this.logger.error(`Échec du chargement du script: ${src}`, error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    initializeWrappers() {
        try {
            // Initialize header wrappers
            const headerCells = this.table.querySelectorAll('thead th');
            headerCells.forEach(cell => {
                if (!cell.querySelector('.' + this.options.headWrapperClass)) {
                    const wrapper = document.createElement('div');
                    wrapper.className = this.options.headWrapperClass;
                    while (cell.firstChild) {
                        wrapper.appendChild(cell.firstChild);
                    }
                    cell.appendChild(wrapper);
                }
            });

            // Initialize cell wrappers
            const bodyCells = this.table.querySelectorAll('tbody td');
            bodyCells.forEach(cell => {
                if (!cell.querySelector('.' + this.options.cellWrapperClass)) {
                    const wrapper = document.createElement('div');
                    wrapper.className = this.options.cellWrapperClass;
                    while (cell.firstChild) {
                        wrapper.appendChild(cell.firstChild);
                    }
                    cell.appendChild(wrapper);
                }
            });
            
            this.logger.debug('Wrappers initialisés pour les cellules de la table');
        } catch (error) {
            this.logger.error(`Échec de l'initialisation des wrappers: ${error.message}`, error);
            throw error;
        }
    }

    hasPlugin(name) {
        if (!name) {
            this.logger.warn('hasPlugin appelé sans nom de plugin');
            return false;
        }
        const hasPlugin = this.plugins.has(name.toLowerCase());
        this.logger.debug(`Vérification de la présence du plugin ${name}: ${hasPlugin}`);
        return hasPlugin;
    }

    getPlugin(name) {
        if (!name) {
            this.logger.warn('getPlugin appelé sans nom de plugin');
            return null;
        }
        
        const plugin = this.plugins.get(name.toLowerCase());
        if (!plugin) {
            this.logger.warn(`Plugin ${name} non trouvé`);
            return null;
        }
        
        if (plugin.error) {
            this.logger.warn(`Le plugin ${name} a échoué lors de son chargement: ${plugin.error.message}`);
            return null;
        }
        
        return plugin.instance;
    }

    refreshPlugins() {
        try {
            // Rafraîchit les plugins dans l'ordre de leurs dépendances
            const refreshed = new Set();
            const failedPlugins = [];
            
            const refreshPlugin = (pluginName) => {
                if (refreshed.has(pluginName)) return true;
                
                const pluginInfo = this.plugins.get(pluginName.toLowerCase());
                if (!pluginInfo?.instance) {
                    this.logger.debug(`Skip refresh for non-existent plugin: ${pluginName}`);
                    return false;
                }

                // Vérifie les dépendances d'abord
                let allDependenciesOk = true;
                if (pluginInfo.instance.dependencies) {
                    for (const dep of pluginInfo.instance.dependencies) {
                        const depRefreshed = refreshPlugin(dep);
                        if (!depRefreshed) {
                            this.logger.warn(`Dépendance ${dep} du plugin ${pluginName} non rafraîchie, saut du plugin`);
                            allDependenciesOk = false;
                        }
                    }
                }
                
                if (!allDependenciesOk) {
                    failedPlugins.push(pluginName);
                    return false;
                }

                // Rafraîchit le plugin
                if (typeof pluginInfo.instance.refresh === 'function') {
                    try {
                        pluginInfo.instance.refresh();
                        this.logger.debug(`Plugin ${pluginName} rafraîchi avec succès`);
                        refreshed.add(pluginName);
                        return true;
                    } catch (error) {
                        this.logger.error(`Erreur lors du rafraîchissement du plugin ${pluginName}: ${error.message}`, error);
                        failedPlugins.push(pluginName);
                        return false;
                    }
                } else {
                    this.logger.debug(`Plugin ${pluginName} n'a pas de méthode refresh(), considéré comme rafraîchi`);
                    refreshed.add(pluginName);
                    return true;
                }
            };

            // Rafraîchit tous les plugins
            this.plugins.forEach((_, name) => refreshPlugin(name));

            if (failedPlugins.length > 0) {
                this.logger.warn(`${refreshed.size} plugins rafraîchis, ${failedPlugins.length} échecs: ${failedPlugins.join(', ')}`);
            } else {
                this.logger.debug(`Tous les plugins (${refreshed.size}) ont été rafraîchis avec succès`);
            }
        } catch (error) {
            this.logger.error(`Erreur lors du rafraîchissement des plugins: ${error.message}`, error);
        }
    }

    getVisibleRows() {
        return Array.from(this.table.querySelectorAll('tbody tr')).filter(
            row => !row.classList.contains('filtered') && row.style.display !== 'none'
        );
    }

    getAllRows() {
        return Array.from(this.table.querySelectorAll('tbody tr'));
    }

    getHeaderCell(columnIndex) {
        this.logger.debug('Récupération de la cellule d\'en-tête pour la colonne', columnIndex);
        const headerRow = this.table.querySelector('thead tr');
        if (!headerRow) {
            this.logger.warn('Aucune ligne d\'en-tête trouvée');
            return null;
        }
        const headerCell = headerRow.children[columnIndex];
        this.logger.debug('Cellule d\'en-tête trouvée:', headerCell);
        return headerCell;
    }

    isEditable() {
        this.logger.debug('Vérification si la table est éditable');
        // Par défaut, la table est éditable sauf si explicitement marquée comme readonly
        const isReadonly = this.table.hasAttribute('th-readonly');
        this.logger.debug('Table en lecture seule?', isReadonly);
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
        if (!cell) {
            this.logger.warn(`Cellule pour la colonne ${columnId} non trouvée dans la ligne ${row.id}`);
            return;
        }

        const wrapper = cell.querySelector(`.${this.options.cellWrapperClass}`);
        if (wrapper) {
            wrapper.textContent = value;
        } else {
            cell.textContent = value;
        }

        // Mettre à jour l'attribut data-value
        cell.setAttribute('data-value', value);

        this.markRowAsModified(row);
        this.logger.debug(`Valeur de la cellule mise à jour: ${columnId} = ${value}`);
    }

    markRowAsSaved(row, options = {}) {
        if (!row) {
            this.logger.warn('markRowAsSaved appelé sans ligne');
            return;
        }
        
        try {
            // Mettre à jour la carte des valeurs initiales
            const rowValues = new Map();
            Array.from(row.cells).forEach(cell => {
                const columnId = this.table.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`).id;
                rowValues.set(columnId, cell.textContent.trim());
            });
            this.initialValues.set(row.id, rowValues);

            // Notifier tous les plugins avec l'objet d'options
            this.plugins.forEach((pluginInfo, pluginName) => {
                if (pluginInfo.instance && typeof pluginInfo.instance.markRowAsSaved === 'function') {
                    try {
                        // Chaque plugin peut vérifier si options contient des informations qui le concernent
                        pluginInfo.instance.markRowAsSaved(row, options);
                    } catch (error) {
                        this.logger.warn(`Erreur lors de l'appel à markRowAsSaved sur le plugin ${pluginName}: ${error.message}`);
                    }
                }
            });
            
            // Nettoyer la ligne
            row.removeAttribute('data-modified');
            row.classList.remove('modified');
            
            // Émettre l'événement row:saved avec toutes les options
            this.table.dispatchEvent(new CustomEvent('row:saved', {
                detail: { 
                    row,
                    options,
                    rowId: row.id,
                    cells: Array.from(row.cells)
                        .map(cell => ({
                            id: cell.id,
                            value: cell.getAttribute('data-value'),
                            initialValue: cell.getAttribute('data-initial-value')
                        }))
                },
                bubbles: true
            }));
            
            this.logger.debug(`Ligne ${row.id} marquée comme sauvegardée`);
        } catch (error) {
            this.logger.error(`Erreur lors du marquage de la ligne comme sauvegardée: ${error.message}`, error);
        }
    }

    addRow(data = {}, position = 'end') {
        try {
            const tbody = this.table.querySelector('tbody');
            if (!tbody) {
                this.logger.error('Élément tbody non trouvé, impossible d\'ajouter une ligne');
                return null;
            }

            const row = document.createElement('tr');
            const headers = this.table.querySelectorAll('thead th');
            const newId = `row-${Date.now()}`; // ID unique pour la nouvelle ligne
            row.id = newId;

            // Créer les cellules en fonction des en-têtes
            headers.forEach((header, index) => {
                const cell = document.createElement('td');
                const columnId = header.id;
                
                // Configuration de l'ID de la cellule basé sur columnId et rowId
                cell.id = `${columnId}_${newId}`;
                
                // Créer le wrapper pour le contenu
                const wrapper = document.createElement('div');
                wrapper.className = this.options.cellWrapperClass;

                // Déterminer la valeur à afficher
                let displayValue = '';
                
                // Cas 1: La donnée est un tableau indexé par position
                if (Array.isArray(data) && data[index] !== undefined) {
                    displayValue = data[index];
                }
                // Cas 2: La donnée est un objet avec des clés columnId
                else if (!Array.isArray(data) && columnId && data[columnId] !== undefined) {
                    displayValue = data[columnId];
                }
                // Cas 3: Valeur par défaut définie dans l'en-tête
                else {
                    displayValue = header.getAttribute('th-text-default') || '';
                }

                wrapper.textContent = displayValue;
                cell.appendChild(wrapper);
                
                // Définir les attributs data-value et data-initial-value
                cell.setAttribute('data-value', displayValue);
                cell.setAttribute('data-initial-value', displayValue);
                
                row.appendChild(cell);
            });

            // Ajouter la ligne à la position spécifiée
            if (position === 'start') {
                tbody.insertBefore(row, tbody.firstChild);
            } else {
                tbody.appendChild(row);
            }

            // Stocker les valeurs initiales
            this.storeInitialValues();

            // Déclencher l'événement pour les plugins
            this.table.dispatchEvent(new CustomEvent('row:added', {
                detail: { 
                    row,
                    position,
                    data: this.getRowData(row)
                },
                bubbles: true
            }));

            // Rafraîchir tous les plugins
            this.refreshPlugins();
            
            this.logger.debug(`Nouvelle ligne ajoutée avec l'ID ${newId} à la position ${position}`);
            return row;
        } catch (error) {
            this.logger.error(`Erreur lors de l'ajout d'une ligne: ${error.message}`, error);
            return null;
        }
    }

    removeRow(row) {
        if (!row || !row.parentNode) {
            this.logger.warn('removeRow appelé avec une ligne invalide ou déjà supprimée');
            return false;
        }

        try {
            const rowId = row.id;

            // Déclencher l'événement avant la suppression
            this.table.dispatchEvent(new CustomEvent('row:removing', {
                detail: { 
                    row,
                    rowId: rowId,
                    data: this.getRowData(row)
                },
                bubbles: true
            }));

            // Supprimer la ligne
            row.parentNode.removeChild(row);

            // Supprimer des initialValues si elle existe
            if (rowId && this.initialValues.has(rowId)) {
                this.initialValues.delete(rowId);
            }

            // Déclencher l'événement après la suppression
            this.table.dispatchEvent(new CustomEvent('row:removed', {
                detail: { 
                    rowId: rowId
                },
                bubbles: true
            }));

            // Rafraîchir tous les plugins
            this.refreshPlugins();

            this.logger.debug(`Ligne avec l'ID ${rowId} supprimée avec succès`);
            return true;
        } catch (error) {
            this.logger.error(`Erreur lors de la suppression de la ligne: ${error.message}`, error);
            return false;
        }
    }

    getRowData(row) {
        if (!row) return {};
        
        try {
            const data = {};
            const headers = Array.from(this.table.querySelectorAll('thead th'));
            
            // Ajouter l'ID de ligne s'il existe
            if (row.id) {
                data.id = row.id;
            }
            
            // Récupérer les données de chaque cellule
            Array.from(row.cells).forEach((cell, index) => {
                const header = headers[index];
                if (!header?.id) return;
                
                let value;
                
                // Préférer data-value s'il existe
                if (cell.hasAttribute('data-value')) {
                    value = cell.getAttribute('data-value');
                } else {
                    // Sinon utiliser le contenu de la cellule
                    const wrapper = cell.querySelector(`.${this.options.cellWrapperClass}`);
                    value = wrapper ? wrapper.textContent.trim() : cell.textContent.trim();
                }
                
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
        } catch (error) {
            this.logger.error(`Erreur lors de la récupération des données de ligne: ${error.message}`, error);
            return { error: error.message };
        }
    }

    destroy() {
        try {
            this.logger.info('Destruction de l\'instance TableFlow...');
            
            // Détruire tous les plugins
            const pluginNames = Array.from(this.plugins.keys());
            for (const name of pluginNames) {
                const plugin = this.plugins.get(name);
                if (plugin.instance && typeof plugin.instance.destroy === 'function') {
                    try {
                        plugin.instance.destroy();
                        this.logger.debug(`Plugin ${name} détruit avec succès`);
                    } catch (error) {
                        this.logger.error(`Erreur lors de la destruction du plugin ${name}: ${error.message}`, error);
                    }
                }
            }
            this.plugins.clear();

            // Supprimer les événements et références
            this.initialValues.clear();
            
            this.logger.success('Instance TableFlow détruite avec succès');
        } catch (error) {
            this.logger.error(`Erreur lors de la destruction de TableFlow: ${error.message}`, error);
        }
    }

    notify(type, message) {
        try {
            if (this.notifications && typeof this.notifications[type] === 'function') {
                this.notifications[type](message);
            }
        } catch (error) {
            console.error(`[TableFlow] Erreur lors de la notification (${type}): ${error.message}`);
        }
    }
}