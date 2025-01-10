(function() {
    if (typeof window.actionsPlugin === 'undefined') {
        window.actionsPlugin = class actionsplugin {
            constructor(config = {}) {
                this.name = 'actions';
                this.version = '1.1.0';
                this.type = 'action';
                this.table = null;
                this.dependencies = [];
                this.config = { ...this.getDefaultConfig(), ...config };
                this.debug = this.config.debug === true ? 
                    (...args) => console.log('[ActionsPlugin]', ...args) : 
                    () => {};
            }

            getDefaultConfig() {
                return {
                    actionAttribute: 'th-actions',
                    sqlExcludeAttribute: 'th-sql-exclude',
                    cellClass: 'td-actions',
                    useIcons: true,
                    debug: false,
                    showOnChange: [],
                    readOnlyClass: 'readonly',
                    readOnlyActions: {},
                    actions: {},
                    icons: {},
                    confirmMessages: {},
                    modifiedClass: 'modified'
                };
            }

            init(tableHandler) {
                if (!tableHandler) {
                    throw new Error('TableHandler instance is required');
                }
                this.table = tableHandler;
                this.setupEventListeners();
                this.initialize();
            }

            setupEventListeners() {
                if (!this.table || !this.table.table) {
                    this.debug('Table not initialized');
                    return;
                }

                this.debug('Setting up event listeners');

                // Listen for cell:change event
                this.table.table.addEventListener('cell:change', (event) => {
                    this.debug('cell:change event received');
                    this.handleCellChange(event);
                });

                // Listen for row:unmodified event
                this.table.table.addEventListener('row:unmodified', (event) => {
                    this.debug('row:unmodified event received');
                    const row = event.detail.row;
                    if (!row) return;

                    const actionsCell = row.querySelector(`.${this.config.cellClass}`);
                    if (actionsCell) {
                        actionsCell.querySelectorAll('[data-action]').forEach(element => {
                            const action = element.getAttribute('data-action');
                            if (this.config.showOnChange?.includes(action)) {
                                element.style.display = 'none';
                            }
                        });
                    }
                });
            }

            initialize() {
                if (!this.table || !this.table.table) return;
                
                const headerCell = this.table.table.querySelector(`th[${this.config.actionAttribute}]`);
                if (!headerCell) return;
                
                const headerActions = headerCell.getAttribute(this.config.actionAttribute).split(',');
                
                const actionCells = this.table.table.querySelectorAll('td[id^="actions_"]');
                actionCells.forEach(cell => {
                    cell.innerHTML = '';
                    cell.classList.add(this.config.cellClass);
                    
                    headerActions.forEach(actionName => {
                        actionName = actionName.trim();
                        if (!actionName || !this.config.icons[actionName]) return;
                        
                        cell.insertAdjacentHTML('beforeend', this.config.icons[actionName]);
                        const actionElement = cell.lastElementChild;
                        actionElement.setAttribute('data-action', actionName);
                        
                        // Stocker le display original
                        const computedStyle = window.getComputedStyle(actionElement);
                        const originalDisplay = computedStyle.display !== 'none' ? computedStyle.display : 'inline-block';
                        actionElement.setAttribute('data-original-display', originalDisplay);
                        
                        this.debug('Initialized action button:', {
                            action: actionName,
                            isInShowOnChange: this.config.showOnChange?.includes(actionName),
                            originalDisplay: originalDisplay
                        });
                        
                        // Masquer initialement si dans showOnChange
                        if (this.config.showOnChange?.includes(actionName)) {
                            actionElement.style.display = 'none';
                            this.debug('Initially hiding action:', actionName);
                        }

                        actionElement.addEventListener('click', async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            
                            const row = cell.closest('tr');
                            if (!row) return;
                            
                            const confirmMessage = this.config.confirmMessages?.[actionName];
                            if (confirmMessage && !confirm(confirmMessage)) {
                                return;
                            }

                            const handler = this.config.actions[actionName];
                            if (handler) {
                                try {
                                    await Promise.resolve(handler({
                                        row,
                                        cell,
                                        data: this.getRowData(row),
                                        tableHandler: this.table
                                    }));
                                } catch (error) {
                                    console.error('Action failed:', error);
                                }
                            }
                        });
                    });
                });
            }

            getRowData(row) {
                const data = {};
                const excludedColumns = new Set();
                
                // Récupérer les colonnes à exclure
                Array.from(this.table.table.querySelectorAll('th')).forEach(header => {
                    if (header.hasAttribute(this.config.sqlExcludeAttribute)) {
                        excludedColumns.add(header.id);
                        console.log('Found excluded column:', header.id, 'with attribute:', this.config.sqlExcludeAttribute);
                    } else {
                        console.log('Header does not have exclude attribute:', header.id, 'looking for:', this.config.sqlExcludeAttribute);
                    }
                });
                
                console.log('Excluded columns:', Array.from(excludedColumns));
                
                // Ajouter l'ID de la ligne s'il existe
                if (row.id) {
                    data.id = row.id;
                }
                
                Array.from(row.cells).forEach((cell, i) => {
                    console.log('Processing cell:', cell.id);
                    
                    const header = this.table.table.querySelector(`th:nth-child(${i + 1})`);
                    if (!header) {
                        console.log('No header found for cell:', cell.id);
                        return;
                    }
                    
                    if (!header.id) {
                        console.log('Header has no id:', header);
                        return;
                    }
                    
                    if (cell.classList.contains(this.config.cellClass)) {
                        console.log('Cell is action cell:', cell.id);
                        return;
                    }
                    
                    console.log('Cell header id:', header.id);
                    
                    // Vérifier si la colonne est exclue
                    if (excludedColumns.has(header.id)) {
                        console.log('Skipping excluded column:', header.id);
                        return;
                    }
                    
                    // Récupérer la valeur de la cellule
                    let value = cell.getAttribute('data-value');
                    if (value === null) {
                        value = cell.textContent.trim();
                    }
                    
                    // Utiliser l'ID de la colonne comme clé
                    data[header.id] = value;
                    console.log('Added value for:', header.id, value);
                });
                
                console.log('Final data:', data);
                return data;
            }

            // Fonction utilitaire pour gérer l'affichage des boutons d'action
            updateActionButtons(row, options = {}) {
                const {
                    showOnModified = false,    // Afficher les boutons showOnChange si modifié
                    hideSpecificAction = null,  // Masquer une action spécifique
                } = options;

                this.debug('Updating action buttons:', {
                    rowId: row.id,
                    showOnModified,
                    hideSpecificAction,
                    showOnChangeActions: this.config.showOnChange
                });

                const actionsCell = row.querySelector(`.${this.config.cellClass}`);
                if (!actionsCell) {
                    this.debug('No actions cell found');
                    return;
                }

                const buttons = actionsCell.querySelectorAll('[data-action]');
                this.debug('Found buttons:', Array.from(buttons).map(b => ({
                    action: b.getAttribute('data-action'),
                    currentDisplay: b.style.display,
                    originalDisplay: b.getAttribute('data-original-display')
                })));

                buttons.forEach(element => {
                    const action = element.getAttribute('data-action');
                    const originalDisplay = element.getAttribute('data-original-display') || 'inline-block';
                    
                    let shouldShow = true; // Par défaut, on montre le bouton
                    
                    // Cas 1: Action spécifique à masquer
                    if (hideSpecificAction && action === hideSpecificAction) {
                        shouldShow = false;
                        this.debug('Hiding specific action:', action);
                    }
                    // Cas 2: Action dans showOnChange
                    else if (this.config.showOnChange?.includes(action)) {
                        shouldShow = showOnModified;
                        this.debug(`${showOnModified ? 'Showing' : 'Hiding'} showOnChange action:`, action);
                    }

                    const newDisplay = shouldShow ? originalDisplay : 'none';
                    if (element.style.display !== newDisplay) {
                        this.debug(`Changing display for ${action} from ${element.style.display} to ${newDisplay}`);
                        element.style.display = newDisplay;
                    }
                });
            }

            handleCellChange(event) {
                const row = event.detail.rowId ? document.getElementById(event.detail.rowId) : event.target.closest('tr');
                if (!row) return;

                const isModified = Array.from(row.cells).some(cell => {
                    if (!cell.hasAttribute('data-initial-value')) return false;
                    const currentValue = cell.getAttribute('data-value');
                    const initialValue = cell.getAttribute('data-initial-value');
                    return currentValue !== initialValue;
                });

                this.debug('Row modified state:', { rowId: row.id, isModified });

                // Mettre à jour la classe et les boutons
                if (isModified) {
                    row.classList.add(this.config.modifiedClass);
                    this.updateActionButtons(row, { showOnModified: true });
                    
                    // Vérifier les actions autoSave
                    Object.entries(this.config.actions).forEach(([actionName, actionConfig]) => {
                        if (actionConfig.autoSave === true && typeof actionConfig.handler === 'function') {
                            this.debug('Triggering autoSave for action:', actionName);
                            actionConfig.handler({
                                row,
                                cell: event.detail.cell,
                                data: this.getRowData(row),
                                tableHandler: this.table
                            });
                        }
                    });
                } else {
                    row.classList.remove(this.config.modifiedClass);
                    this.updateActionButtons(row, { showOnModified: false });
                }
            }

            markRowAsSaved(row, options = {}) {
                if (!row) {
                    this.debug('No row provided to markRowAsSaved');
                    return;
                }
                
                // Rechercher les options pour ce plugin (insensible à la casse)
                const pluginOptions = Object.entries(options).find(
                    ([key]) => key.toLowerCase() === 'actions'
                )?.[1] || {};
                
                this.debug('Marking row as saved:', {
                    rowId: row.id,
                    pluginOptions
                });
                
                // Émettre un événement cell:saved pour chaque cellule
                Array.from(row.cells).forEach(cell => {
                    // Ignorer les cellules d'action
                    if (cell.classList.contains(this.config.cellClass)) {
                        return;
                    }
                    
                    const currentValue = cell.getAttribute('data-value');
                    // Mettre à jour data-initial-value pour refléter la nouvelle valeur sauvegardée
                    if (currentValue !== null) {
                        cell.setAttribute('data-initial-value', currentValue);
                        
                        // Émettre l'événement cell:saved
                        const cellSavedEvent = new CustomEvent('cell:saved', {
                            detail: {
                                cellId: cell.id,
                                columnId: cell.id.split('_')[0],
                                rowId: row.id,
                                value: currentValue,
                                cell: cell,
                                pluginOptions
                            },
                            bubbles: true
                        });
                        cell.dispatchEvent(cellSavedEvent);
                        
                        this.debug('Cell saved:', {
                            cellId: cell.id,
                            value: currentValue
                        });
                    }
                });

                // Retirer la classe modified et mettre à jour les boutons
                row.classList.remove(this.config.modifiedClass);
                this.updateActionButtons(row, { 
                    showOnModified: false,
                    hideSpecificAction: pluginOptions.hideAction
                });

                // Déclencher un événement pour notifier que la ligne a été sauvegardée
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
                        pluginOptions
                    },
                    bubbles: true
                });
                row.dispatchEvent(rowSavedEvent);
                
                this.debug('Row successfully marked as saved');
            }
        };
    }
})();
