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
                        
                        if (this.config.showOnChange?.includes(actionName)) {
                            actionElement.style.display = 'none';
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
                
                Array.from(row.cells).forEach((cell, i) => {
                    const header = this.table.table.querySelector(`th:nth-child(${i + 1})`);
                    if (!header || !header.id || cell.classList.contains(this.config.cellClass)) {
                        return;
                    }
                    
                    data[header.id] = cell.getAttribute('data-value') || cell.textContent.trim();
                });
                
                return data;
            }

            markRowAsSaved(row) {
                if (!row) return;
                
                // Émettre un événement cell:saved pour chaque cellule
                Array.from(row.cells).forEach(cell => {
                    const currentValue = cell.getAttribute('data-value');
                    if (currentValue !== null) {
                        // Émettre l'événement cell:saved pour que le plugin responsable mette à jour la valeur initiale
                        const cellSavedEvent = new CustomEvent('cell:saved', {
                            detail: {
                                cellId: cell.id,
                                columnId: cell.id.split('_')[0],
                                rowId: row.id,
                                value: currentValue,
                                cell: cell
                            },
                            bubbles: true
                        });
                        cell.dispatchEvent(cellSavedEvent);
                        
                        this.debug('Cell saved event emitted:', {
                            cellId: cell.id,
                            value: currentValue
                        });
                    }
                });

                // Retirer la classe modified de la ligne
                row.classList.remove(this.config.modifiedClass);
                
                // Masquer les boutons d'action si nécessaire
                const actionsCell = row.querySelector(`.${this.config.cellClass}`);
                if (actionsCell) {
                    actionsCell.querySelectorAll('[data-action]').forEach(element => {
                        const action = element.getAttribute('data-action');
                        if (this.config.showOnChange?.includes(action)) {
                            element.style.display = 'none';
                        }
                    });
                }

                // Déclencher un événement pour notifier que la ligne a été sauvegardée
                const rowSavedEvent = new CustomEvent('row:saved', {
                    detail: { 
                        row,
                        cells: Array.from(row.cells).map(cell => ({
                            id: cell.id,
                            value: cell.getAttribute('data-value')
                        }))
                    },
                    bubbles: true
                });
                row.dispatchEvent(rowSavedEvent);
                
                this.debug('Row marked as saved:', row.id);
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

                if (isModified) {
                    row.classList.add(this.config.modifiedClass);
                    
                    // Check for autoSave actions and trigger them
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
                }

                const actionsCell = row.querySelector(`.${this.config.cellClass}`);
                if (actionsCell) {
                    actionsCell.querySelectorAll('[data-action]').forEach(element => {
                        const action = element.getAttribute('data-action');
                        if (this.config.showOnChange?.includes(action)) {
                            element.style.display = isModified ? 'inline-block' : 'none';
                        }
                    });
                }
            }
        };
    }
})();
