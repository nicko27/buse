export default class ActionsPlugin {
    constructor(config = {}) {
        this.name = 'actions';
        this.version = '1.1.0';
        this.type = 'action';
        this.table = null;
        this.dependencies = [];
        this.config = { ...this.getDefaultConfig(), ...config };
        this.debug = this.config.debug === true ?
            (...args) => console.log('[ActionsPlugin]', ...args) :
            () => { };

        // Lier les méthodes pour préserver le contexte
        this.handleCellChange = this.handleCellChange.bind(this);
        this.handleRowSaved = this.handleRowSaved.bind(this);
        this.handleRowAdded = this.handleRowAdded.bind(this);
    }

    getDefaultConfig() {
        return {
            actionAttribute: 'th-actions',
            sqlExcludeAttribute: 'th-sql-exclude',
            cellClass: 'td-actions',
            useIcons: true,
            debug: false,
            showOnChange: [],
            modifiedClass: 'modified',
            actions: {},
            icons: {},
            confirmMessages: {},
            autoSave: false
        };
    }

    init(tableHandler) {
        this.table = tableHandler;
        this.debug('Initialisation du plugin avec la configuration:', this.config);

        if (!this.table?.table) {
            this.debug('ERREUR: Table non trouvée');
            return;
        }

        this.setupEventListeners();

        const hasActions = this.hasActionColumns();
        this.debug('Colonnes d\'actions détectées:', hasActions);

        if (hasActions) {
            this.setupActionColumns();
        }
    }

    hasActionColumns() {
        if (!this.table?.table) return false;
        const actionColumns = this.table.table.querySelectorAll(`thead th[${this.config.actionAttribute}]`);
        const count = actionColumns.length;
        this.debug(`${count} colonne(s) d'actions trouvée(s)`);
        return count > 0;
    }

    setupEventListeners() {
        if (!this.table?.table) {
            this.debug('ERREUR: Impossible d\'attacher les événements - table non trouvée');
            return;
        }

        this.debug('Configuration des écouteurs d\'événements');
        this.table.table.addEventListener('cell:change', this.handleCellChange);
        this.table.table.addEventListener('row:saved', this.handleRowSaved);
        this.table.table.addEventListener('row:added', this.handleRowAdded);
    }

    handleRowSaved(event) {
        const row = event.detail.row;
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans handleRowSaved');
            return;
        }

        this.debug('Gestion de row:saved pour la ligne:', row.id);
        row.classList.remove(this.config.modifiedClass);

        if (this.hasActionColumns()) {
            this.updateActionButtons(row, { showOnModified: false });
        }
    }

    handleRowAdded(event) {
        const row = event.detail.row;
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans handleRowAdded');
            return;
        }

        this.debug('Gestion de row:added pour la ligne:', row.id);

        if (this.hasActionColumns()) {
            this.setupActionColumns();
            this.updateActionButtons(row, { showOnModified: false });
        }

        if (typeof this.table.refreshPlugins === 'function') {
            this.table.refreshPlugins();
        }
    }

    setupActionColumns() {
        const headerCells = this.table.table.querySelectorAll(`thead th[${this.config.actionAttribute}]`);
        this.debug(`Configuration de ${headerCells.length} colonne(s) d'actions`);

        headerCells.forEach((cell, index) => {
            if (!cell) {
                this.debug(`ERREUR: Cellule d'en-tête ${index} non trouvée`);
                return;
            }

            const columnIndex = cell.cellIndex;
            if (columnIndex === -1) {
                this.debug(`ERREUR: Index de colonne invalide pour l'en-tête ${index}`);
                return;
            }

            const actionsStr = cell.getAttribute(this.config.actionAttribute);
            if (!actionsStr) {
                this.debug(`ERREUR: Attribut ${this.config.actionAttribute} manquant sur l'en-tête ${index}`);
                return;
            }

            const actions = actionsStr.split(',').map(a => a.trim()).filter(Boolean);
            if (actions.length === 0) {
                this.debug(`ATTENTION: Aucune action définie pour la colonne ${index}`);
                return;
            }

            this.debug(`Colonne ${index + 1}: actions configurées:`, actions);

            // Utiliser tbody du tableau courant et nth-child
            const tbody = this.table.table.querySelector('tbody');
            if (!tbody) {
                this.debug('ERREUR: tbody non trouvé');
                return;
            }

            const cells = Array.from(tbody.rows).map(row => row.cells[columnIndex]).filter(Boolean);
            if (cells.length === 0) {
                this.debug(`ATTENTION: Aucune cellule trouvée pour la colonne ${index + 1}`);
                return;
            }

            this.debug(`${cells.length} cellule(s) trouvée(s) pour la colonne ${index + 1}`);

            cells.forEach((cell, cellIndex) => {
                if (!cell) {
                    this.debug(`ERREUR: Cellule ${cellIndex} manquante dans la colonne ${index + 1}`);
                    return;
                }
                this.setupActionCell(cell, actions);
            });
        });
    }

    setupActionCell(cell, actions) {
        if (!cell) {
            this.debug('ERREUR: Cellule non trouvée dans setupActionCell');
            return;
        }

        cell.classList.add(this.config.cellClass);
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        wrapper.innerHTML = '';

        this.debug('Configuration des actions pour la cellule:', {
            cellId: cell.id,
            actions: actions
        });

        actions.forEach(actionName => {
            const actionConfig = this.config.actions[actionName];
            if (!actionConfig) {
                this.debug(`ERREUR: Action "${actionName}" non trouvée dans la configuration`);
                return;
            }

            const icon = this.config.icons[actionName] || actionConfig.icon;
            if (!icon) {
                this.debug(`ERREUR: Pas d'icône définie pour l'action "${actionName}"`);
                return;
            }

            wrapper.insertAdjacentHTML('beforeend', icon);
            const actionElement = wrapper.lastElementChild;

            if (!actionElement) {
                this.debug(`ERREUR: Échec de l'insertion de l'icône pour l'action "${actionName}"`);
                return;
            }

            actionElement.setAttribute('data-action', actionName);
            const computedStyle = window.getComputedStyle(actionElement);
            const originalDisplay = computedStyle.display || 'inline-block';
            actionElement.setAttribute('data-original-display', originalDisplay);

            this.debug(`Action "${actionName}" configurée:`, {
                showOnChange: this.shouldShowOnChange(actionName),
                autoSave: this.shouldAutoSave(actionName),
                originalDisplay: originalDisplay
            });

            if (this.shouldShowOnChange(actionName)) {
                actionElement.style.display = 'none';
            }

            actionElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.executeAction(actionName, e.target.closest('td'));
            });
        });
    }

    shouldShowOnChange(actionName) {
        const actionConfig = this.config.actions[actionName] || {};
        const showOnChange = actionConfig.showOnChange === true ||
            (actionConfig.showOnChange !== false &&
                (this.config.showOnChange === true ||
                    (Array.isArray(this.config.showOnChange) &&
                        this.config.showOnChange.includes(actionName))));

        this.debug(`Calcul de showOnChange pour "${actionName}":`, {
            actionShowOnChange: actionConfig.showOnChange,
            globalShowOnChange: this.config.showOnChange,
            result: showOnChange
        });

        return showOnChange;
    }

    shouldAutoSave(actionName) {
        const actionConfig = this.config.actions[actionName] || {};
        const autoSave = actionConfig.autoSave === true ||
            (actionConfig.autoSave !== false && this.config.autoSave === true);

        this.debug(`Calcul de autoSave pour "${actionName}":`, {
            actionAutoSave: actionConfig.autoSave,
            globalAutoSave: this.config.autoSave,
            result: autoSave
        });

        return autoSave;
    }

    executeAction(actionName, cell, options = {}) {
        const row = cell?.closest('tr');
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans executeAction');
            return;
        }

        const actionConfig = this.config.actions[actionName];
        if (!actionConfig) {
            this.debug(`ERREUR: Configuration non trouvée pour l'action "${actionName}"`);
            return;
        }

        this.debug(`Exécution de l'action "${actionName}":`, {
            rowId: row.id,
            cellId: cell?.id,
            options: options
        });

        if (this.config.confirmMessages[actionName] && !options.skipConfirm) {
            const message = this.config.confirmMessages[actionName];
            this.debug(`Demande de confirmation pour "${actionName}":`, message);
            if (!confirm(message)) {
                this.debug('Action annulée par l\'utilisateur');
                return;
            }
        }

        const data = this.getRowData(row);
        this.debug('Données collectées:', data);

        const context = {
            row,
            cell,
            tableHandler: this.table,
            data,
            source: options.source || 'manual'
        };

        try {
            if (typeof actionConfig.handler === 'function') {
                this.debug(`Appel du handler pour "${actionName}" (source: ${context.source})`);
                actionConfig.handler(context);
            } else {
                this.debug(`ERREUR: Pas de handler défini pour l'action "${actionName}"`);
            }
        } catch (error) {
            this.debug(`ERREUR lors de l'exécution de l'action "${actionName}":`, error);
            console.error(`Erreur lors de l'exécution de l'action "${actionName}":`, error);
        }
    }

    getRowData(row) {
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans getRowData');
            return {};
        }

        const data = {};
        const excludedColumns = new Set();
        const thead = this.table.table.querySelector('thead');
        if (!thead) {
            this.debug('ERREUR: thead non trouvé');
            return data;
        }

        // Collecte des colonnes exclues
        Array.from(thead.querySelectorAll('th')).forEach(header => {
            if (header.hasAttribute(this.config.sqlExcludeAttribute)) {
                excludedColumns.add(header.id);
                this.debug(`Colonne exclue: ${header.id}`);
            }
        });

        if (row.id) {
            data.id = row.id;
        }

        this.debug('Collecte des données de la ligne:', row.id);

        Array.from(row.cells).forEach((cell, i) => {
            const header = thead.querySelector(`tr:first-child th:nth-child(${i + 1})`);
            if (!header?.id || cell.classList.contains(this.config.cellClass)) {
                return;
            }

            if (excludedColumns.has(header.id)) {
                this.debug(`Colonne ignorée (exclue): ${header.id}`);
                return;
            }

            let value = cell.getAttribute('data-value');
            if (value === null) {
                const wrapper = cell.querySelector('.cell-wrapper');
                value = wrapper ? wrapper.textContent.trim() : cell.textContent.trim();
            }

            // Conversion des types
            let convertedValue = value;
            if (!isNaN(value) && value !== '') {
                convertedValue = Number(value);
            } else if (value === 'true' || value === 'false') {
                convertedValue = value === 'true';
            }

            data[header.id] = convertedValue;

            this.debug(`Valeur collectée pour ${header.id}:`, {
                raw: value,
                converted: convertedValue,
                type: typeof convertedValue
            });
        });

        return data;
    }

    handleCellChange(event) {
        // Vérifier que l'événement vient de notre table
        if (event.detail && event.detail.tableId && event.detail.tableId !== this.table.table.id) {
            this.debug('Événement ignoré car il vient d\'une autre table:', event.detail.tableId);
            return;
        }

        // Vérifier si cet événement a déjà été traité (via l'ID unique)
        if (event.detail && event.detail.eventId) {
            // Utiliser une variable statique pour stocker les événements traités
            if (!this.constructor._processedEvents) {
                this.constructor._processedEvents = new Set();
            }

            const eventId = event.detail.eventId;

            // Si l'événement a déjà été traité, l'ignorer
            if (this.constructor._processedEvents.has(eventId)) {
                this.debug('Événement ignoré car déjà traité:', eventId);
                return;
            }

            // Marquer l'événement comme traité
            this.constructor._processedEvents.add(eventId);

            // Nettoyer la liste des événements traités (garder seulement les 100 derniers)
            if (this.constructor._processedEvents.size > 100) {
                const toRemove = Array.from(this.constructor._processedEvents).slice(0,
                    this.constructor._processedEvents.size - 100);
                toRemove.forEach(id => this.constructor._processedEvents.delete(id));
            }
        }

        const row = event.detail.rowId ?
            this.table.table.querySelector(`tr[id="${event.detail.rowId}"]`) :
            event.target?.closest('tr');

        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans handleCellChange');
            return;
        }

        const cell = event.detail.cell || event.target?.closest('td');
        this.debug('Gestion du changement de cellule:', {
            rowId: row.id,
            cellId: cell?.id,
            eventType: event.type,
            eventSource: event.detail ? 'custom' : 'dom',
            tableId: this.table.table.id
        });

        // Vérification de la modification
        const modifiedCells = Array.from(row.cells)
            .filter(cell => {
                if (!cell.hasAttribute('data-initial-value')) {
                    this.debug(`Cellule sans valeur initiale:`, {
                        cellId: cell.id,
                        content: cell.textContent.trim()
                    });
                    return false;
                }

                const currentValue = cell.getAttribute('data-value');
                const initialValue = cell.getAttribute('data-initial-value');
                const isModified = currentValue !== initialValue;

                if (isModified) {
                    this.debug('Cellule modifiée:', {
                        cellId: cell.id,
                        initialValue,
                        currentValue,
                        element: cell
                    });
                }

                return isModified;
            });

        const isModified = modifiedCells.length > 0;
        this.debug('État de modification de la ligne:', {
            rowId: row.id,
            isModified,
            modifiedCellCount: modifiedCells.length,
            modifiedCellIds: modifiedCells.map(cell => cell.id)
        });

        if (isModified) {
            row.classList.add(this.config.modifiedClass);

            if (this.hasActionColumns()) {
                this.debug('Mise à jour des boutons d\'action pour la ligne modifiée');
                this.updateActionButtons(row, { showOnModified: true });
            }

            // Gestion de l'autoSave
            if (this.config.autoSave) {
                const saveAction = Object.entries(this.config.actions).find(([name]) => name === 'save');
                if (saveAction) {
                    this.debug('Déclenchement de l\'autoSave');
                    this.executeAction('save', cell, {
                        skipConfirm: true,
                        source: 'autoSave'
                    });
                }
            }
        } else {
            row.classList.remove(this.config.modifiedClass);
            if (this.hasActionColumns()) {
                this.debug('Mise à jour des boutons d\'action pour la ligne non modifiée');
                this.updateActionButtons(row, { showOnModified: false });
            }
        }
    }

    updateActionButtons(row, options = {}) {
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans updateActionButtons');
            return;
        }

        const {
            showOnModified = false,
            hideSpecificAction = null
        } = options;

        this.debug('Mise à jour des boutons d\'action:', {
            rowId: row.id,
            showOnModified,
            hideSpecificAction
        });

        // Trouver les cellules d'action uniquement dans cette ligne
        const actionCells = Array.from(row.cells).filter(cell =>
            cell.classList.contains(this.config.cellClass)
        );

        actionCells.forEach(cell => {
            const buttons = cell.querySelectorAll('[data-action]');
            buttons.forEach(button => {
                const actionName = button.getAttribute('data-action');
                const originalDisplay = button.getAttribute('data-original-display') || 'inline-block';

                let shouldShow = true;

                if (hideSpecificAction && actionName === hideSpecificAction) {
                    shouldShow = false;
                    this.debug(`Action "${actionName}" masquée spécifiquement`);
                }
                else if (this.shouldShowOnChange(actionName)) {
                    shouldShow = showOnModified;
                    this.debug(`Visibilité de l'action "${actionName}" basée sur l'état de modification:`, showOnModified);
                }

                button.style.display = shouldShow ? originalDisplay : 'none';
            });
        });
    }

    markRowAsSaved(row, options = {}) {
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans markRowAsSaved');
            return;
        }

        this.debug('Marquage de la ligne comme sauvegardée:', {
            rowId: row.id,
            options
        });

        const pluginOptions = Object.entries(options).find(
            ([key]) => key.toLowerCase() === 'actions'
        )?.[1] || {};

        // Mise à jour des valeurs initiales
        const updatedCells = [];
        Array.from(row.cells).forEach(cell => {
            if (cell.classList.contains(this.config.cellClass)) return;

            const currentValue = cell.getAttribute('data-value');
            if (currentValue !== null) {
                const oldInitialValue = cell.getAttribute('data-initial-value');
                cell.setAttribute('data-initial-value', currentValue);

                updatedCells.push({
                    cellId: cell.id,
                    oldInitialValue,
                    newInitialValue: currentValue
                });

                this.debug('Mise à jour de la valeur initiale:', {
                    cellId: cell.id,
                    oldInitialValue,
                    newInitialValue: currentValue
                });

                const cellSavedEvent = new CustomEvent('cell:saved', {
                    detail: {
                        cellId: cell.id,
                        columnId: cell.id.split('_')[0],
                        rowId: row.id,
                        value: currentValue,
                        cell: cell,
                        pluginOptions,
                        tableId: this.table.table.id
                    },
                    bubbles: false
                });

                this.table.table.dispatchEvent(cellSavedEvent);
            }
        });

        row.classList.remove(this.config.modifiedClass);
        if (this.hasActionColumns()) {
            this.updateActionButtons(row, {
                showOnModified: false,
                hideSpecificAction: pluginOptions.hideAction
            });
        }

        const rowSavedEvent = new CustomEvent('row:saved', {
            detail: {
                row,
                rowId: row.id,
                cells: Array.from(row.cells)
                    .filter(cell => !cell.classList.contains(this.config.cellClass))
                    .map(cell => ({
                        id: cell.id,
                        value: cell.getAttribute('data-value'),
                        initialValue: cell.getAttribute('data-initial-value')
                    })),
                pluginOptions,
                updatedCells,
                tableId: this.table.table.id
            },
            bubbles: false
        });

        this.debug('Déclenchement de l\'événement row:saved:', rowSavedEvent.detail);
        this.table.table.dispatchEvent(rowSavedEvent);
    }

    refresh() {
        this.debug('Rafraîchissement du plugin');
        if (this.hasActionColumns()) {
            this.setupActionColumns();
        }
    }

    destroy() {
        this.debug('Destruction du plugin');
        if (this.table?.table) {
            this.table.table.removeEventListener('cell:change', this.handleCellChange);
            this.table.table.removeEventListener('row:saved', this.handleRowSaved);
            this.table.table.removeEventListener('row:added', this.handleRowAdded);
        }
    }
}
