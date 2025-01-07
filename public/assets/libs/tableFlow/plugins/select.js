/**
 * Plugin Select pour TableFlow
 * Permet de sélectionner des valeurs dans une grande liste avec recherche par saisie
 */
(function() {
    if (typeof window.selectPlugin === 'undefined') {
        window.selectPlugin = class selectplugin {
            constructor(options = {}) {
                this.name = 'select';
                this.version = '1.1.0';
                this.type = 'edit';
                this.table = null;
                this.dependencies = [];
                this.config = { ...this.getDefaultConfig(), ...options };
                this.activeDropdown = null;
                this.debug = this.config.debug === true ? 
                    (...args) => console.log('[SelectPlugin]', ...args) : 
                    () => {};
                
                // Add CSS styles for the dropdown
                this.addStyles();
            }

            getDefaultConfig() {
                return {
                    selectAttribute: 'th-select',
                    cellClass: 'select-cell',
                    dropdownClass: 'select-dropdown',
                    optionClass: 'select-option',
                    searchClass: 'select-search',
                    readOnlyClass: 'readonly',
                    minWidth: '200px',
                    placeholder: 'Rechercher...',
                    noResultsText: 'Aucun résultat',
                    debug: false,
                    options: {},
                    readOnlyValues: {}
                };
            }

            addStyles() {
                if (!document.getElementById('select-plugin-styles')) {
                    const style = document.createElement('style');
                    style.id = 'select-plugin-styles';
                    style.textContent = `
                        .${this.config.cellClass} { cursor: pointer; position: relative; }
                        .${this.config.dropdownClass} {
                            position: absolute;
                            top: 100%;
                            left: 0;
                            z-index: 1000;
                            display: none;
                            min-width: ${this.config.minWidth};
                            background: white;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                            overflow: auto;
                            max-height: 200px;
                        }
                        .${this.config.dropdownClass}.active { display: block; }
                        .${this.config.searchClass} {
                            width: 100%;
                            padding: 8px;
                            border: none;
                            border-bottom: 1px solid #ddd;
                            outline: none;
                            box-sizing: border-box;
                        }
                        .${this.config.optionClass} {
                            padding: 8px;
                            cursor: pointer;
                        }
                        .${this.config.optionClass}:hover { background-color: #f5f5f5; }
                        .no-results {
                            padding: 8px;
                            color: #999;
                            font-style: italic;
                            text-align: center;
                        }
                    `;
                    document.head.appendChild(style);
                }
            }

            init(tableHandler) {
                if (!tableHandler) {
                    throw new Error('TableHandler instance is required');
                }
                this.table = tableHandler;
                this.setupSelectCells();
                this.setupEventListeners();
            }

            setupSelectCells() {
                if (!this.table || !this.table.table) return;

                const headerCells = this.table.table.querySelectorAll('th');
                const selectColumns = Array.from(headerCells)
                    .filter(header => header.hasAttribute(this.config.selectAttribute))
                    .map(header => ({
                        id: header.id,
                        index: Array.from(headerCells).indexOf(header)
                    }));

                if (!selectColumns.length) return;

                const rows = this.table.table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    selectColumns.forEach(({id: columnId, index}) => {
                        const cell = row.cells[index];
                        if (!cell) return;

                        // Ne pas réinitialiser si la cellule est déjà gérée par un autre plugin
                        if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'select') {
                            return;
                        }

                        cell.classList.add(this.config.cellClass);
                        cell.setAttribute('data-plugin', 'select');

                        // Ajouter le gestionnaire de clic s'il n'existe pas déjà
                        if (!cell.hasAttribute('data-select-initialized')) {
                            cell.addEventListener('click', (e) => this.handleClick(e));
                            cell.setAttribute('data-select-initialized', 'true');
                        }

                        // Récupérer la valeur actuelle
                        let currentValue = cell.getAttribute('data-value');
                        if (currentValue === null) {
                            currentValue = cell.textContent.trim();
                            cell.setAttribute('data-value', currentValue);
                        }

                        // Si pas de valeur initiale, la définir
                        if (cell.getAttribute('data-initial-value') === null) {
                            cell.setAttribute('data-initial-value', currentValue);
                        }

                        // Mettre à jour le label
                        const options = this.config.options[columnId];
                        if (options) {
                            const option = options.find(o => 
                                (typeof o === 'object' ? o.value : o) === currentValue
                            );
                            if (option) {
                                const label = typeof option === 'object' ? option.label : option;
                                const wrapper = cell.querySelector('.cell-wrapper');
                                if (wrapper) {
                                    wrapper.innerHTML = label;
                                } else {
                                    cell.innerHTML = label;
                                    if (this.table.initializeWrappers) {
                                        this.table.initializeWrappers();
                                    }
                                }
                            }
                        }
                    });
                });
            }

            setupEventListeners() {
                if (!this.table || !this.table.table) {
                    this.debug('Table not initialized');
                    return;
                }

                this.debug('Setting up event listeners');

                // Écouter l'événement cell:saved
                this.table.table.addEventListener('cell:saved', (event) => {
                    this.debug('cell:saved event received', event.detail);
                    const cell = event.detail.cell;
                    if (!cell || !cell.classList.contains(this.config.cellClass)) {
                        this.debug('Cell not managed by select plugin');
                        return;
                    }

                    const currentValue = event.detail.value;
                    cell.setAttribute('data-initial-value', currentValue);
                    cell.setAttribute('data-value', currentValue);
                    
                    // Mettre à jour le label si nécessaire
                    const columnId = event.detail.columnId;
                    const options = this.config.options[columnId];
                    if (options) {
                        const option = options.find(o => 
                            (typeof o === 'object' ? o.value : o) === currentValue
                        );
                        if (option) {
                            const label = typeof option === 'object' ? option.label : option;
                            const wrapper = cell.querySelector('.cell-wrapper');
                            if (wrapper) {
                                wrapper.innerHTML = label;
                            } else {
                                cell.innerHTML = label;
                                if (this.table.initializeWrappers) {
                                    this.table.initializeWrappers();
                                }
                            }
                        }
                    }
                });

                // Écouter l'événement row:saved
                this.table.table.addEventListener('row:saved', (event) => {
                    this.debug('row:saved event received');
                    const row = event.detail.row;
                    if (!row) return;

                    // Vérifier et mettre à jour toutes les cellules select de la ligne
                    Array.from(row.cells).forEach((cell, index) => {
                        if (!cell.classList.contains(this.config.cellClass)) return;

                        const header = this.table.table.querySelectorAll('th')[index];
                        const columnId = header.id;
                        const currentValue = cell.getAttribute('data-value');
                        
                        // Mettre à jour la valeur initiale
                        cell.setAttribute('data-initial-value', currentValue);

                        const options = this.config.options[columnId];
                        if (options) {
                            const option = options.find(o => 
                                (typeof o === 'object' ? o.value : o) === currentValue
                            );
                            if (option) {
                                const label = typeof option === 'object' ? option.label : option;
                                const wrapper = cell.querySelector('.cell-wrapper');
                                if (wrapper) {
                                    wrapper.innerHTML = label;
                                } else {
                                    cell.innerHTML = label;
                                    if (this.table.initializeWrappers) {
                                        this.table.initializeWrappers();
                                    }
                                }
                            }
                        }
                    });
                });

                // Écouter l'ajout de nouvelles lignes
                this.table.table.addEventListener('row:added', () => {
                    this.debug('row:added event received');
                    this.setupSelectCells();
                });

                // Fermer le dropdown quand on clique ailleurs
                document.addEventListener('click', (event) => {
                    if (!event.target.closest(`.${this.config.cellClass}`)) {
                        this.closeAllDropdowns();
                    }
                });
            }

            handleClick(event) {
                const cell = event.target.closest('td');
                if (!cell || !cell.classList.contains(this.config.cellClass)) {
                    return;
                }

                // Vérifier si la cellule est bien gérée par ce plugin
                if (cell.getAttribute('data-plugin') !== 'select') {
                    return;
                }

                // Vérifier si la cellule est en lecture seule
                if (cell.classList.contains(this.config.readOnlyClass)) {
                    return;
                }

                const columnIndex = Array.from(cell.parentElement.children).indexOf(cell);
                const header = this.table.table.querySelectorAll('th')[columnIndex];
                const columnId = header.id;
                if (!columnId || !this.config.options[columnId]) {
                    return;
                }

                // Fermer les autres dropdowns
                this.closeAllDropdowns();

                // Créer et afficher le dropdown
                const dropdown = document.createElement('div');
                dropdown.className = this.config.dropdownClass;

                // Ajouter la barre de recherche
                const search = document.createElement('input');
                search.type = 'text';
                search.className = this.config.searchClass;
                search.placeholder = this.config.placeholder;
                dropdown.appendChild(search);

                // Conteneur pour les options
                const optionsContainer = document.createElement('div');
                dropdown.appendChild(optionsContainer);

                // Fonction pour mettre à jour les options
                const updateOptions = (filter = '') => {
                    const options = this.config.options[columnId];
                    const filteredOptions = options.filter(option => {
                        const label = typeof option === 'object' ? option.label : option;
                        return label.toLowerCase().includes(filter.toLowerCase());
                    });

                    optionsContainer.innerHTML = '';
                    if (filteredOptions.length === 0) {
                        const noResults = document.createElement('div');
                        noResults.className = 'no-results';
                        noResults.textContent = this.config.noResultsText;
                        optionsContainer.appendChild(noResults);
                    } else {
                        filteredOptions.forEach(option => {
                            const optionElement = document.createElement('div');
                            optionElement.className = this.config.optionClass;
                            const label = typeof option === 'object' ? option.label : option;
                            const value = typeof option === 'object' ? option.value : option;
                            optionElement.textContent = label;
                            optionElement.addEventListener('click', () => {
                                const oldValue = cell.getAttribute('data-value');
                                cell.setAttribute('data-value', value);

                                const wrapper = cell.querySelector('.cell-wrapper');
                                if (wrapper) {
                                    wrapper.innerHTML = label;
                                } else {
                                    cell.innerHTML = label;
                                    if (this.table.initializeWrappers) {
                                        this.table.initializeWrappers();
                                    }
                                }

                                // Marquer la ligne comme modifiée
                                const row = cell.closest('tr');
                                if (row) {
                                    row.classList.add('modified');
                                }

                                // Déclencher l'événement de changement
                                const changeEvent = new CustomEvent('cell:change', {
                                    detail: {
                                        cellId: cell.id,
                                        columnId,
                                        rowId: row.id,
                                        value: value,
                                        cell: cell
                                    },
                                    bubbles: true
                                });
                                cell.dispatchEvent(changeEvent);

                                this.closeAllDropdowns();
                            });
                            optionsContainer.appendChild(optionElement);
                        });
                    }
                };

                // Gérer la recherche
                search.addEventListener('input', () => updateOptions(search.value));

                // Afficher les options initiales
                updateOptions();

                // Positionner et afficher le dropdown
                cell.appendChild(dropdown);
                dropdown.classList.add('active');
                this.activeDropdown = dropdown;

                // Focus sur la recherche
                search.focus();
            }

            closeAllDropdowns() {
                if (this.activeDropdown) {
                    this.activeDropdown.remove();
                    this.activeDropdown = null;
                }
            }
        }
    }
})();

class SelectPlugin {
    constructor(config = {}) {
        this.config = {
            selectedClass: 'selected',
            multiSelect: true,
            selectOnClick: true,
            selectableClass: 'selectable',
            onSelect: null,
            onDeselect: null,
            ...config
        };
        
        this.context = null;
        this.selectedRows = new Set();
        this.lastSelectedRow = null;
    }

    async init(context) {
        this.context = context;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const { table } = this.context;
        
        // Écouter les clics sur les lignes
        table.addEventListener('click', this.handleClick.bind(this));
        
        // Écouter les touches pour la sélection multiple
        table.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleClick(event) {
        const row = event.target.closest('tr');
        if (!row || !this.isRowSelectable(row)) return;

        event.preventDefault();
        
        if (this.config.multiSelect && event.shiftKey && this.lastSelectedRow) {
            this.selectRange(this.lastSelectedRow, row);
        } else if (this.config.multiSelect && event.ctrlKey) {
            this.toggleRowSelection(row);
        } else {
            this.selectSingleRow(row);
        }
    }

    handleKeyDown(event) {
        if (!this.config.multiSelect) return;

        switch (event.key) {
            case 'a':
                if (event.ctrlKey) {
                    event.preventDefault();
                    this.selectAll();
                }
                break;
            case 'Escape':
                this.clearSelection();
                break;
        }
    }

    isRowSelectable(row) {
        return row.classList.contains(this.config.selectableClass) || 
               row.hasAttribute('data-selectable');
    }

    selectRange(startRow, endRow) {
        const rows = Array.from(this.context.getRows());
        const startIndex = rows.indexOf(startRow);
        const endIndex = rows.indexOf(endRow);
        
        if (startIndex === -1 || endIndex === -1) return;
        
        const [start, end] = startIndex < endIndex ? 
            [startIndex, endIndex] : 
            [endIndex, startIndex];
        
        // Sélectionner toutes les lignes dans la plage
        for (let i = start; i <= end; i++) {
            const row = rows[i];
            if (this.isRowSelectable(row)) {
                this.selectRow(row, true);
            }
        }
    }

    toggleRowSelection(row) {
        if (this.selectedRows.has(row)) {
            this.deselectRow(row);
        } else {
            this.selectRow(row);
        }
    }

    selectSingleRow(row) {
        // Désélectionner toutes les lignes
        this.selectedRows.forEach(selectedRow => {
            this.deselectRow(selectedRow, true);
        });
        
        // Sélectionner la nouvelle ligne
        this.selectRow(row);
    }

    selectRow(row, silent = false) {
        if (!this.isRowSelectable(row) || this.selectedRows.has(row)) return;
        
        row.classList.add(this.config.selectedClass);
        this.selectedRows.add(row);
        this.lastSelectedRow = row;
        
        if (!silent && typeof this.config.onSelect === 'function') {
            this.config.onSelect({
                row,
                selected: Array.from(this.selectedRows)
            });
        }
    }

    deselectRow(row, silent = false) {
        if (!this.selectedRows.has(row)) return;
        
        row.classList.remove(this.config.selectedClass);
        this.selectedRows.delete(row);
        
        if (this.lastSelectedRow === row) {
            this.lastSelectedRow = null;
        }
        
        if (!silent && typeof this.config.onDeselect === 'function') {
            this.config.onDeselect({
                row,
                selected: Array.from(this.selectedRows)
            });
        }
    }

    selectAll() {
        const rows = this.context.getRows();
        rows.forEach(row => {
            if (this.isRowSelectable(row)) {
                this.selectRow(row, true);
            }
        });
        
        if (typeof this.config.onSelect === 'function') {
            this.config.onSelect({
                selected: Array.from(this.selectedRows)
            });
        }
    }

    clearSelection() {
        const selected = Array.from(this.selectedRows);
        selected.forEach(row => this.deselectRow(row, true));
        
        if (typeof this.config.onDeselect === 'function') {
            this.config.onDeselect({
                selected: []
            });
        }
    }

    getSelectedRows() {
        return Array.from(this.selectedRows);
    }

    refresh() {
        // Vérifier que toutes les lignes sélectionnées sont toujours valides
        const rows = new Set(this.context.getRows());
        const invalidRows = Array.from(this.selectedRows)
            .filter(row => !rows.has(row));
        
        // Retirer les lignes qui ne sont plus dans le tableau
        invalidRows.forEach(row => this.selectedRows.delete(row));
        
        // Mettre à jour les classes
        this.selectedRows.forEach(row => {
            row.classList.add(this.config.selectedClass);
        });
    }

    destroy() {
        const { table } = this.context;
        
        // Nettoyer les écouteurs d'événements
        table.removeEventListener('click', this.handleClick);
        table.removeEventListener('keydown', this.handleKeyDown);
        
        // Nettoyer la sélection
        this.clearSelection();
        
        this.context = null;
    }
}

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.SelectPlugin = SelectPlugin;
}
