/**
 * Plugin de sélection pour TableFlow
 * Permet la sélection de cellules, lignes et colonnes avec différentes options
 * et méthodes pour manipuler les sélections
 */
export default class SelectionPlugin {
    constructor(config = {}) {
        this.name = 'select';
        this.version = '1.0.0';
        this.type = 'action';
        this.table = null;
        this.dependencies = [];
        
        // Configuration par défaut
        this.config = {
            // Options de sélection
            mode: 'cell', // 'cell', 'row', 'column', 'multiple'
            selectionClass: 'selected',
            rowClass: 'row-selected',
            columnClass: 'col-selected',
            multipleClass: 'multiple-selected',
            enableKeyboard: true,
            enableMouseDrag: true,
            shiftSelect: true,
            ctrlSelect: true,
            
            // Mise en forme
            showSelectionBorder: true,
            highlightRow: true,
            highlightColumn: true,
            animateSelection: true,
            
            // Événements
            onSelect: null,
            onDeselect: null,
            onSelectionChange: null,
            
            // Options contextuelles
            showContextMenu: true,
            menuItems: [
                { label: 'Copier', action: 'copy', icon: '<i class="fas fa-copy"></i>' },
                { label: 'Couper', action: 'cut', icon: '<i class="fas fa-cut"></i>' },
                { label: 'Coller', action: 'paste', icon: '<i class="fas fa-paste"></i>' },
                { label: 'Supprimer', action: 'delete', icon: '<i class="fas fa-trash"></i>' }
            ],
            
            // Actions rapides
            enableCopyPaste: true,
            enableDelete: true,
            
            debug: false,
            ...config
        };
        
        // État de la sélection
        this.selection = {
            active: false,
            cells: new Set(),
            rows: new Set(),
            columns: new Set(),
            startCell: null,
            lastCell: null,
            clipboard: null
        };
        
        // Génération de la fonction de debug
        this.debug = this.config.debug ? 
            (...args) => console.log('[SelectionPlugin]', ...args) : 
            () => {};
            
        // Binding des méthodes pour conserver le contexte
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
    }

    init(tableHandler) {
        this.table = tableHandler;
        this.debug('Initialisation du plugin avec la configuration:', this.config);
        
        if (!this.table?.table) {
            this.debug('ERREUR: Table non trouvée');
            return;
        }
        
        // Ajouter les styles CSS
        this.addStyles();
        
        // Mettre en place les écouteurs d'événements
        this.setupEventListeners();
        
        this.debug('Plugin initialisé avec succès');
    }
    
    addStyles() {
        if (!document.getElementById('selection-plugin-styles')) {
            const style = document.createElement('style');
            style.id = 'selection-plugin-styles';
            style.textContent = `
                .${this.config.selectionClass} {
                    background-color: rgba(66, 133, 244, 0.1) !important;
                    ${this.config.showSelectionBorder ? 'outline: 2px solid rgba(66, 133, 244, 0.5) !important;' : ''}
                    position: relative;
                    z-index: 1;
                }
                
                .${this.config.rowClass} td {
                    background-color: rgba(66, 133, 244, 0.05) !important;
                }
                
                .${this.config.columnClass} {
                    background-color: rgba(66, 133, 244, 0.05) !important;
                }
                
                .${this.config.multipleClass} {
                    background-color: rgba(66, 133, 244, 0.2) !important;
                }
                
                ${this.config.animateSelection ? `
                .${this.config.selectionClass} {
                    transition: background-color 0.15s ease-in-out, outline 0.15s ease-in-out;
                }
                ` : ''}
                
                /* Menu contextuel */
                .selection-context-menu {
                    position: absolute;
                    background-color: white;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
                    padding: 5px 0;
                    z-index: 1000;
                }
                
                .selection-context-menu ul {
                    list-style-type: none;
                    margin: 0;
                    padding: 0;
                }
                
                .selection-context-menu li {
                    padding: 8px 15px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .selection-context-menu li:hover {
                    background-color: #f5f5f5;
                }
                
                /* Style pour la table lorsque le drag est actif */
                .table-drag-selecting {
                    user-select: none;
                }
            `;
            document.head.appendChild(style);
            this.debug('Styles ajoutés au document');
        }
    }
    
    setupEventListeners() {
        this.debug('Configuration des écouteurs d\'événements');
        
        const table = this.table.table;
        
        // Événements de la souris
        table.addEventListener('mousedown', this.handleMouseDown);
        table.addEventListener('mouseover', this.handleMouseOver);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Événement de clic en dehors du tableau pour désélectionner
        document.addEventListener('click', this.handleClickOutside);
        
        // Événements clavier pour la navigation et les raccourcis
        if (this.config.enableKeyboard) {
            document.addEventListener('keydown', this.handleKeyDown);
        }
        
        // Menu contextuel
        if (this.config.showContextMenu) {
            table.addEventListener('contextmenu', this.handleContextMenu);
        }
        
        // Écouteurs pour les mises à jour du tableau
        table.addEventListener('row:added', () => this.clearSelection());
        table.addEventListener('row:removed', () => this.clearSelection());
        
        this.debug('Écouteurs d\'événements configurés');
    }

    handleMouseDown(event) {
        // Ignorer l'événement si ce n'est pas un clic gauche
        if (event.button !== 0) return;
        
        const cell = event.target.closest('td');
        if (!cell) return;
        
        this.debug('Début de sélection:', cell.id);
        
        // Démarrer une nouvelle sélection ou étendre la sélection existante
        const isShiftKey = event.shiftKey && this.config.shiftSelect;
        const isCtrlKey = (event.ctrlKey || event.metaKey) && this.config.ctrlSelect;
        
        if (!isShiftKey && !isCtrlKey) {
            this.clearSelection();
        }
        
        // Marquer le début de la sélection
        if (this.config.mode === 'cell' || this.config.mode === 'multiple') {
            if (!isShiftKey || !this.selection.startCell) {
                this.selection.startCell = cell;
            }
            
            this.selectCell(cell, isCtrlKey);
            this.selection.active = true;
            this.selection.lastCell = cell;
            
            // Ajouter la classe pour indiquer qu'une sélection par glissement est en cours
            if (this.config.enableMouseDrag) {
                this.table.table.classList.add('table-drag-selecting');
            }
        } else if (this.config.mode === 'row') {
            const row = cell.closest('tr');
            this.selectRow(row, isCtrlKey);
        } else if (this.config.mode === 'column') {
            const columnIndex = cell.cellIndex;
            this.selectColumn(columnIndex, isCtrlKey);
        }
        
        // Empêcher la sélection de texte pendant le glissement
        if (this.config.enableMouseDrag) {
            event.preventDefault();
        }
    }
    
    handleMouseOver(event) {
        // Ne traiter que si une sélection est active et que le glissement est activé
        if (!this.selection.active || !this.config.enableMouseDrag) return;
        
        const cell = event.target.closest('td');
        if (!cell || cell === this.selection.lastCell) return;
        
        this.debug('Déplacement de la sélection vers:', cell.id);
        
        // Étendre la sélection
        if (this.config.mode === 'cell' || this.config.mode === 'multiple') {
            this.extendSelectionToCell(cell);
            this.selection.lastCell = cell;
        }
    }
    
    handleMouseUp(event) {
        if (!this.selection.active) return;
        
        this.debug('Fin de sélection');
        
        // Terminer la sélection par glissement
        this.selection.active = false;
        this.table.table.classList.remove('table-drag-selecting');
        
        // Déclencher l'événement de changement de sélection
        this.triggerSelectionChange();
    }
    
    handleKeyDown(event) {
        // Ne traiter que si la sélection est active et que les raccourcis clavier sont activés
        if (!this.selection.cells.size || !this.config.enableKeyboard) return;
        
        // Gestion des touches de navigation (flèches)
        if (event.key.startsWith('Arrow')) {
            this.navigateSelection(event);
            event.preventDefault();
            return;
        }
        
        // Copier (Ctrl+C)
        if ((event.ctrlKey || event.metaKey) && event.key === 'c' && this.config.enableCopyPaste) {
            this.copySelection();
            event.preventDefault();
            return;
        }
        
        // Couper (Ctrl+X)
        if ((event.ctrlKey || event.metaKey) && event.key === 'x' && this.config.enableCopyPaste) {
            this.cutSelection();
            event.preventDefault();
            return;
        }
        
        // Coller (Ctrl+V)
        if ((event.ctrlKey || event.metaKey) && event.key === 'v' && this.config.enableCopyPaste) {
            this.pasteSelection();
            event.preventDefault();
            return;
        }
        
        // Supprimer (Delete ou Backspace)
        if ((event.key === 'Delete' || event.key === 'Backspace') && this.config.enableDelete) {
            this.deleteSelection();
            event.preventDefault();
            return;
        }
        
        // Tout sélectionner (Ctrl+A)
        if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
            this.selectAll();
            event.preventDefault();
            return;
        }
    }
    
    handleClickOutside(event) {
        // Désélectionner si on clique en dehors du tableau
        if (!event.target.closest('table') && this.selection.cells.size > 0) {
            this.clearSelection();
        }
    }
    
    handleContextMenu(event) {
        if (!this.config.showContextMenu) return;
        
        const cell = event.target.closest('td');
        if (!cell) return;
        
        // Si la cellule n'est pas dans la sélection, la sélectionner d'abord
        if (!this.selection.cells.has(cell)) {
            this.clearSelection();
            this.selectCell(cell, false);
        }
        
        // Afficher le menu contextuel
        this.showContextMenu(event);
        
        // Empêcher l'affichage du menu contextuel par défaut
        event.preventDefault();
    }
    
    showContextMenu(event) {
        // Supprimer tout menu contextuel existant
        this.removeContextMenu();
        
        // Créer le menu
        const menu = document.createElement('div');
        menu.className = 'selection-context-menu';
        
        // Créer la liste des options
        const list = document.createElement('ul');
        
        // Ajouter les éléments du menu
        this.config.menuItems.forEach(item => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `${item.icon || ''} ${item.label}`;
            listItem.addEventListener('click', () => {
                this.handleContextMenuAction(item.action);
                this.removeContextMenu();
            });
            list.appendChild(listItem);
        });
        
        menu.appendChild(list);
        document.body.appendChild(menu);
        
        // Positionner le menu
        const rect = this.table.table.getBoundingClientRect();
        const x = Math.min(event.clientX, rect.right - menu.offsetWidth);
        const y = Math.min(event.clientY, window.innerHeight - menu.offsetHeight);
        
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        
        // Ajouter un écouteur pour fermer le menu en cliquant ailleurs
        setTimeout(() => {
            document.addEventListener('click', function closeMenu(e) {
                if (!menu.contains(e.target)) {
                    document.removeEventListener('click', closeMenu);
                    menu.remove();
                }
            });
        }, 0);
    }
    
    removeContextMenu() {
        const menu = document.querySelector('.selection-context-menu');
        if (menu) {
            menu.remove();
        }
    }
    
    handleContextMenuAction(action) {
        this.debug('Action du menu contextuel:', action);
        
        switch (action) {
            case 'copy':
                this.copySelection();
                break;
            case 'cut':
                this.cutSelection();
                break;
            case 'paste':
                this.pasteSelection();
                break;
            case 'delete':
                this.deleteSelection();
                break;
            default:
                // Actions personnalisées
                if (typeof this.config[`on${action.charAt(0).toUpperCase() + action.slice(1)}`] === 'function') {
                    this.config[`on${action.charAt(0).toUpperCase() + action.slice(1)}`](this.getSelectedData());
                }
                break;
        }
    }
    
    selectCell(cell, toggleMode = false) {
        if (!cell) return;
        
        this.debug('Sélection de la cellule:', cell.id, 'toggleMode:', toggleMode);
        
        // Si on est en mode bascule et que la cellule est déjà sélectionnée, la désélectionner
        if (toggleMode && this.selection.cells.has(cell)) {
            this.deselectCell(cell);
            return;
        }
        
        // Ajouter aux cellules sélectionnées
        this.selection.cells.add(cell);
        cell.classList.add(this.config.selectionClass);
        
        // Mettre en évidence la ligne et/ou la colonne si nécessaire
        this.updateRowColumnHighlight();
        
        // Déclencher l'événement onSelect
        if (typeof this.config.onSelect === 'function') {
            this.config.onSelect({
                type: 'cell',
                element: cell,
                data: this.getCellData(cell)
            });
        }
    }
    
    deselectCell(cell) {
        if (!cell || !this.selection.cells.has(cell)) return;
        
        this.debug('Désélection de la cellule:', cell.id);
        
        // Retirer des cellules sélectionnées
        this.selection.cells.delete(cell);
        cell.classList.remove(this.config.selectionClass);
        cell.classList.remove(this.config.multipleClass);
        
        // Mettre à jour la mise en évidence des lignes et colonnes
        this.updateRowColumnHighlight();
        
        // Déclencher l'événement onDeselect
        if (typeof this.config.onDeselect === 'function') {
            this.config.onDeselect({
                type: 'cell',
                element: cell
            });
        }
    }
    
    selectRow(row, toggleMode = false) {
        if (!row) return;
        
        this.debug('Sélection de la ligne:', row.id, 'toggleMode:', toggleMode);
        
        // Si on est en mode bascule et que la ligne est déjà sélectionnée, la désélectionner
        if (toggleMode && this.selection.rows.has(row)) {
            this.deselectRow(row);
            return;
        }
        
        // Ajouter aux lignes sélectionnées
        this.selection.rows.add(row);
        row.classList.add(this.config.rowClass);
        
        // Sélectionner toutes les cellules de la ligne
        Array.from(row.cells).forEach(cell => {
            this.selection.cells.add(cell);
            cell.classList.add(this.config.selectionClass);
        });
        
        // Déclencher l'événement onSelect
        if (typeof this.config.onSelect === 'function') {
            this.config.onSelect({
                type: 'row',
                element: row,
                data: this.getRowData(row)
            });
        }
    }
    
    deselectRow(row) {
        if (!row || !this.selection.rows.has(row)) return;
        
        this.debug('Désélection de la ligne:', row.id);
        
        // Retirer des lignes sélectionnées
        this.selection.rows.delete(row);
        row.classList.remove(this.config.rowClass);
        
        // Désélectionner toutes les cellules de la ligne
        Array.from(row.cells).forEach(cell => {
            this.selection.cells.delete(cell);
            cell.classList.remove(this.config.selectionClass);
            cell.classList.remove(this.config.multipleClass);
        });
        
        // Déclencher l'événement onDeselect
        if (typeof this.config.onDeselect === 'function') {
            this.config.onDeselect({
                type: 'row',
                element: row
            });
        }
    }
    
    selectColumn(columnIndex, toggleMode = false) {
        if (columnIndex < 0) return;
        
        this.debug('Sélection de la colonne:', columnIndex, 'toggleMode:', toggleMode);
        
        // Si on est en mode bascule et que la colonne est déjà sélectionnée, la désélectionner
        if (toggleMode && this.selection.columns.has(columnIndex)) {
            this.deselectColumn(columnIndex);
            return;
        }
        
        // Ajouter aux colonnes sélectionnées
        this.selection.columns.add(columnIndex);
        
        // Sélectionner toutes les cellules de la colonne
        const rows = this.table.getAllRows();
        const cells = [];
        
        rows.forEach(row => {
            const cell = row.cells[columnIndex];
            if (cell) {
                this.selection.cells.add(cell);
                cell.classList.add(this.config.selectionClass);
                cell.classList.add(this.config.columnClass);
                cells.push(cell);
            }
        });
        
        // Déclencher l'événement onSelect
        if (typeof this.config.onSelect === 'function') {
            this.config.onSelect({
                type: 'column',
                index: columnIndex,
                elements: cells,
                data: this.getColumnData(columnIndex)
            });
        }
    }
    
    deselectColumn(columnIndex) {
        if (columnIndex < 0 || !this.selection.columns.has(columnIndex)) return;
        
        this.debug('Désélection de la colonne:', columnIndex);
        
        // Retirer des colonnes sélectionnées
        this.selection.columns.delete(columnIndex);
        
        // Désélectionner toutes les cellules de la colonne
        const rows = this.table.getAllRows();
        const cells = [];
        
        rows.forEach(row => {
            const cell = row.cells[columnIndex];
            if (cell) {
                this.selection.cells.delete(cell);
                cell.classList.remove(this.config.selectionClass);
                cell.classList.remove(this.config.columnClass);
                cell.classList.remove(this.config.multipleClass);
                cells.push(cell);
            }
        });
        
        // Déclencher l'événement onDeselect
        if (typeof this.config.onDeselect === 'function') {
            this.config.onDeselect({
                type: 'column',
                index: columnIndex,
                elements: cells
            });
        }
    }
    
    selectAll() {
        this.debug('Sélection de toutes les cellules');
        
        // Effacer la sélection actuelle
        this.clearSelection();
        
        // Sélectionner toutes les lignes
        const rows = this.table.getAllRows();
        rows.forEach(row => {
            Array.from(row.cells).forEach(cell => {
                this.selection.cells.add(cell);
                cell.classList.add(this.config.selectionClass);
            });
        });
        
        // Déclencher l'événement de changement de sélection
        this.triggerSelectionChange();
    }
    
    clearSelection() {
        this.debug('Effacement de la sélection');
        
        // Supprimer les classes de toutes les cellules sélectionnées
        this.selection.cells.forEach(cell => {
            cell.classList.remove(this.config.selectionClass);
            cell.classList.remove(this.config.multipleClass);
        });
        
        // Supprimer les classes des lignes sélectionnées
        this.selection.rows.forEach(row => {
            row.classList.remove(this.config.rowClass);
        });
        
        // Supprimer les classes des colonnes sélectionnées
        const rows = this.table.getAllRows();
        this.selection.columns.forEach(columnIndex => {
            rows.forEach(row => {
                const cell = row.cells[columnIndex];
                if (cell) {
                    cell.classList.remove(this.config.columnClass);
                }
            });
        });
        
        // Réinitialiser la sélection
        this.selection.cells.clear();
        this.selection.rows.clear();
        this.selection.columns.clear();
        this.selection.startCell = null;
        this.selection.lastCell = null;
        this.selection.active = false;
        
        // Déclencher l'événement de changement de sélection
        this.triggerSelectionChange();
    }
    
    extendSelectionToCell(targetCell) {
        if (!this.selection.startCell || !targetCell) return;
        
        this.debug('Extension de la sélection vers:', targetCell.id);
        
        // Calculer les indices des cellules
        const startRow = this.selection.startCell.closest('tr');
        const targetRow = targetCell.closest('tr');
        
        const startRowIndex = Array.from(this.table.table.querySelectorAll('tbody tr')).indexOf(startRow);
        const targetRowIndex = Array.from(this.table.table.querySelectorAll('tbody tr')).indexOf(targetRow);
        
        const startCellIndex = this.selection.startCell.cellIndex;
        const targetCellIndex = targetCell.cellIndex;
        
        // Déterminer la plage de sélection
        const minRowIndex = Math.min(startRowIndex, targetRowIndex);
        const maxRowIndex = Math.max(startRowIndex, targetRowIndex);
        const minCellIndex = Math.min(startCellIndex, targetCellIndex);
        const maxCellIndex = Math.max(startCellIndex, targetCellIndex);
        
        // Effacer la sélection actuelle et sélectionner la nouvelle plage
        this.clearSelection();
        
        const rows = this.table.getAllRows();
        for (let i = minRowIndex; i <= maxRowIndex; i++) {
            const row = rows[i];
            if (!row) continue;
            
            for (let j = minCellIndex; j <= maxCellIndex; j++) {
                const cell = row.cells[j];
                if (cell) {
                    this.selectCell(cell, false);
                    
                    // Ajouter la classe pour les sélections multiples
                    if (this.config.mode === 'multiple') {
                        cell.classList.add(this.config.multipleClass);
                    }
                }
            }
        }
        
        // Mise à jour de la dernière cellule sélectionnée
        this.selection.lastCell = targetCell;
    }
    
    updateRowColumnHighlight() {
        if (!this.config.highlightRow && !this.config.highlightColumn) return;
        
        // Réinitialiser toutes les mises en évidence
        const rows = this.table.getAllRows();
        rows.forEach(row => {
            row.classList.remove(this.config.rowClass);
            Array.from(row.cells).forEach(cell => {
                cell.classList.remove(this.config.columnClass);
            });
        });
        
        // Mettre en évidence les lignes contenant des cellules sélectionnées
        if (this.config.highlightRow) {
            const selectedRows = new Set();
            this.selection.cells.forEach(cell => {
                const row = cell.closest('tr');
                selectedRows.add(row);
            });
            
            selectedRows.forEach(row => {
                row.classList.add(this.config.rowClass);
            });
        }
        
        // Mettre en évidence les colonnes contenant des cellules sélectionnées
        if (this.config.highlightColumn) {
            const selectedColumns = new Set();
            this.selection.cells.forEach(cell => {
                selectedColumns.add(cell.cellIndex);
            });
            
            selectedColumns.forEach(columnIndex => {
                rows.forEach(row => {
                    const cell = row.cells[columnIndex];
                    if (cell) {
                        cell.classList.add(this.config.columnClass);
                    }
                });
            });
        }
    }
    
    navigateSelection(event) {
        if (!this.selection.lastCell) return;
        
        const currentCell = this.selection.lastCell;
        const currentRow = currentCell.closest('tr');
        const rows = this.table.getAllRows();
        const currentRowIndex = rows.indexOf(currentRow);
        const currentCellIndex = currentCell.cellIndex;
        
        let targetRow, targetCell;
        
        // Déterminer la cellule cible selon la touche appuyée
        switch (event.key) {
            case 'ArrowUp':
                if (currentRowIndex > 0) {
                    targetRow = rows[currentRowIndex - 1];
                    targetCell = targetRow.cells[currentCellIndex];
                }
                break;
                
            case 'ArrowDown':
                if (currentRowIndex < rows.length - 1) {
                    targetRow = rows[currentRowIndex + 1];
                    targetCell = targetRow.cells[currentCellIndex];
                }
                break;
                
            case 'ArrowLeft':
                if (currentCellIndex > 0) {
                    targetCell = currentRow.cells[currentCellIndex - 1];
                }
                break;
                
            case 'ArrowRight':
                if (currentCellIndex < currentRow.cells.length - 1) {
                    targetCell = currentRow.cells[currentCellIndex + 1];
                }
                break;
        }
        
        if (targetCell) {
            // Si la touche Shift est appuyée, étendre la sélection
            if (event.shiftKey && this.config.shiftSelect) {
                this.extendSelectionToCell(targetCell);
            } else {
                // Sinon, déplacer la sélection
                this.clearSelection();
                this.selectCell(targetCell);
                this.selection.startCell = targetCell;
                this.selection.lastCell = targetCell;
            }
            
            // Assurer que la cellule est visible
            targetCell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        }
    }
    
    /**
     * Organise les cellules sélectionnées en grille
     * @returns {Array<Array<HTMLElement>>} - Tableau 2D des cellules organisées par position
     */
    organizeSelection() {
        if (this.selection.cells.size === 0) return [];
        
        // Trouver les limites de la sélection
        let minRow = Infinity, maxRow = -Infinity;
        let minCol = Infinity, maxCol = -Infinity;
        
        // Calculer les limites
        this.selection.cells.forEach(cell => {
            const row = cell.closest('tr');
            const rowIndex = Array.from(this.table.table.querySelectorAll('tbody tr')).indexOf(row);
            const colIndex = cell.cellIndex;
            
            minRow = Math.min(minRow, rowIndex);
            maxRow = Math.max(maxRow, rowIndex);
            minCol = Math.min(minCol, colIndex);
            maxCol = Math.max(maxCol, colIndex);
        });
        
        // Créer une grille vide
        const grid = [];
        const rows = this.table.getAllRows();
        
        for (let i = minRow; i <= maxRow; i++) {
            const row = [];
            const tableRow = rows[i];
            
            for (let j = minCol; j <= maxCol; j++) {
                if (tableRow) {
                    const cell = tableRow.cells[j];
                    // Ajouter la cellule seulement si elle fait partie de la sélection
                    row.push(this.selection.cells.has(cell) ? cell : null);
                } else {
                    row.push(null);
                }
            }
            
            grid.push(row);
        }
        
        return grid;
    }
    
    /**
     * Copie la sélection actuelle dans le presse-papiers
     */
    copySelection() {
        if (this.selection.cells.size === 0) return;
        
        this.debug('Copie de la sélection');
        
        // Organiser les cellules sélectionnées par ligne et colonne
        const organizedSelection = this.organizeSelection();
        
        // Convertir en texte formaté pour le presse-papiers
        let clipboardText = '';
        organizedSelection.forEach(row => {
            clipboardText += row.map(cell => {
                // Si la cellule est null (non sélectionnée dans une ligne), utiliser une chaîne vide
                if (!cell) return '';
                
                // Récupérer la valeur de la cellule
                let value = cell.getAttribute('data-value');
                if (value === null) {
                    const wrapper = cell.querySelector(`.${this.table.options.cellWrapperClass}`);
                    value = wrapper ? wrapper.textContent.trim() : cell.textContent.trim();
                }
                
                return value;
            }).join('\t');
            clipboardText += '\n';
        });
        
        // Stocker dans le presse-papiers interne
        this.selection.clipboard = clipboardText;
        
        // Essayer de copier dans le presse-papiers du système
        try {
            navigator.clipboard.writeText(clipboardText)
                .then(() => {
                    this.debug('Copié dans le presse-papiers système');
                })
                .catch(err => {
                    this.debug('Erreur lors de la copie dans le presse-papiers:', err);
                    // En cas d'échec, utiliser la méthode fallback avec un élément temporaire
                    this.copyToClipboardFallback(clipboardText);
                });
        } catch (err) {
            this.debug('Erreur lors de la copie dans le presse-papiers:', err);
            this.copyToClipboardFallback(clipboardText);
        }
    }
    
    /**
     * Méthode alternative pour copier du texte dans le presse-papiers
     * @param {string} text - Texte à copier
     */
    copyToClipboardFallback(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';  // Hors de l'écran
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        
        try {
            document.execCommand('copy');
            this.debug('Copié dans le presse-papiers (méthode fallback)');
        } catch (err) {
            this.debug('Échec de la copie fallback:', err);
        } finally {
            document.body.removeChild(textarea);
        }
    }
    
    /**
     * Coupe la sélection (copie puis supprime)
     */
    cutSelection() {
        this.copySelection();
        this.deleteSelection();
    }
    
    /**
     * Colle le contenu du presse-papiers à partir de la cellule sélectionnée
     */
    pasteSelection() {
        if (!this.selection.clipboard || this.selection.cells.size === 0) {
            this.debug('Pas de données dans le presse-papiers ou pas de sélection');
            return;
        }
        
        this.debug('Collage des données du presse-papiers');
        
        // Obtenir la cellule de départ (la première cellule de la sélection)
        const startCell = this.selection.lastCell || Array.from(this.selection.cells)[0];
        if (!startCell) return;
        
        const startRow = startCell.closest('tr');
        const startRowIndex = Array.from(this.table.table.querySelectorAll('tbody tr')).indexOf(startRow);
        const startColIndex = startCell.cellIndex;
        
        // Analyser les données du presse-papiers
        const clipboardData = this.selection.clipboard.split('\n')
            .filter(line => line.trim() !== '')
            .map(line => line.split('\t'));
        
        // Mettre à jour les cellules
        const rows = this.table.getAllRows();
        let modifiedCells = [];
        
        clipboardData.forEach((rowData, rowOffset) => {
            const rowIndex = startRowIndex + rowOffset;
            if (rowIndex >= rows.length) return;
            
            const row = rows[rowIndex];
            
            rowData.forEach((value, colOffset) => {
                const colIndex = startColIndex + colOffset;
                if (colIndex >= row.cells.length) return;
                
                const cell = row.cells[colIndex];
                if (!cell) return;
                
                // Mettre à jour la valeur de la cellule
                this.updateCellValue(cell, value);
                modifiedCells.push(cell);
            });
        });
        
        if (modifiedCells.length > 0) {
            this.debug(`${modifiedCells.length} cellule(s) mise(s) à jour`);
            
            // Déclencher un événement pour indiquer que des cellules ont été modifiées
            const event = new CustomEvent('cells:pasted', {
                detail: {
                    cells: modifiedCells,
                    source: 'clipboard'
                },
                bubbles: true
            });
            this.table.table.dispatchEvent(event);
        }
    }
    
    /**
     * Met à jour la valeur d'une cellule
     * @param {HTMLElement} cell - La cellule à mettre à jour
     * @param {string} value - La nouvelle valeur
     */
    updateCellValue(cell, value) {
        const wrapper = cell.querySelector(`.${this.table.options.cellWrapperClass}`);
        
        // Mettre à jour la cellule
        if (wrapper) {
            wrapper.textContent = value;
        } else {
            cell.textContent = value;
        }
        
        // Mettre à jour l'attribut data-value
        cell.setAttribute('data-value', value);
        
        // Marquer la ligne comme modifiée si nécessaire
        const row = cell.closest('tr');
        const initialValue = cell.getAttribute('data-initial-value');
        
        if (value !== initialValue && row) {
            row.classList.add('modified');
            
            // Déclencher l'événement de changement de cellule
            const event = new CustomEvent('cell:change', {
                detail: {
                    cell,
                    cellId: cell.id,
                    columnId: cell.id.split('_')[0],
                    rowId: row.id,
                    value,
                    source: 'selection'
                },
                bubbles: true
            });
            cell.dispatchEvent(event);
        }
    }
    
    /**
     * Supprime les valeurs des cellules sélectionnées
     */
    deleteSelection() {
        if (this.selection.cells.size === 0) return;
        
        this.debug('Suppression du contenu des cellules sélectionnées');
        
        let modifiedCells = [];
        
        this.selection.cells.forEach(cell => {
            this.updateCellValue(cell, '');
            modifiedCells.push(cell);
        });
        
        if (modifiedCells.length > 0) {
            // Déclencher un événement pour indiquer que des cellules ont été supprimées
            const event = new CustomEvent('cells:deleted', {
                detail: {
                    cells: modifiedCells,
                    source: 'selection'
                },
                bubbles: true
            });
            this.table.table.dispatchEvent(event);
        }
    }
    
    /**
     * Récupère les données des cellules sélectionnées
     * @returns {Object} - Données des cellules sélectionnées
     */
    getSelectedData() {
        const result = {
            cells: [],
            rows: [],
            columns: {}
        };
        
        // Données des cellules
        this.selection.cells.forEach(cell => {
            result.cells.push(this.getCellData(cell));
        });
        
        // Données des lignes
        this.selection.rows.forEach(row => {
            result.rows.push(this.getRowData(row));
        });
        
        // Données des colonnes
        this.selection.columns.forEach(columnIndex => {
            const headers = this.table.table.querySelectorAll('thead th');
            if (columnIndex < headers.length) {
                const header = headers[columnIndex];
                result.columns[header.id] = this.getColumnData(columnIndex);
            }
        });
        
        return result;
    }
    
    /**
     * Récupère les données d'une cellule
     * @param {HTMLElement} cell - La cellule
     * @returns {Object} - Données de la cellule
     */
    getCellData(cell) {
        if (!cell) return null;
        
        const row = cell.closest('tr');
        const rowIndex = Array.from(this.table.table.querySelectorAll('tbody tr')).indexOf(row);
        const colIndex = cell.cellIndex;
        
        const headers = this.table.table.querySelectorAll('thead th');
        const header = headers[colIndex];
        
        // Récupérer la valeur de la cellule
        let value = cell.getAttribute('data-value');
        if (value === null) {
            const wrapper = cell.querySelector(`.${this.table.options.cellWrapperClass}`);
            value = wrapper ? wrapper.textContent.trim() : cell.textContent.trim();
        }
        
        return {
            id: cell.id,
            row: rowIndex,
            column: colIndex,
            columnId: header ? header.id : null,
            rowId: row ? row.id : null,
            value: value
        };
    }
    
    /**
     * Récupère les données d'une ligne
     * @param {HTMLElement} row - La ligne
     * @returns {Object} - Données de la ligne
     */
    getRowData(row) {
        if (!row) return null;
        
        const headers = Array.from(this.table.table.querySelectorAll('thead th'));
        const data = { rowId: row.id };
        
        Array.from(row.cells).forEach((cell, index) => {
            const header = headers[index];
            if (!header || !header.id) return;
            
            // Récupérer la valeur de la cellule
            let value = cell.getAttribute('data-value');
            if (value === null) {
                const wrapper = cell.querySelector(`.${this.table.options.cellWrapperClass}`);
                value = wrapper ? wrapper.textContent.trim() : cell.textContent.trim();
            }
            
            data[header.id] = value;
        });
        
        return data;
    }
    
    /**
     * Récupère les données d'une colonne
     * @param {number} columnIndex - Index de la colonne
     * @returns {Array} - Données de la colonne
     */
    getColumnData(columnIndex) {
        const rows = this.table.getAllRows();
        const headers = this.table.table.querySelectorAll('thead th');
        const header = headers[columnIndex];
        
        if (!header) return [];
        
        return rows.map(row => {
            const cell = row.cells[columnIndex];
            if (!cell) return null;
            
            // Récupérer la valeur de la cellule
            let value = cell.getAttribute('data-value');
            if (value === null) {
                const wrapper = cell.querySelector(`.${this.table.options.cellWrapperClass}`);
                value = wrapper ? wrapper.textContent.trim() : cell.textContent.trim();
            }
            
            return {
                rowId: row.id,
                cellId: cell.id,
                columnId: header.id,
                value: value
            };
        }).filter(Boolean);
    }
    
    /**
     * Déclenche un événement de changement de sélection
     */
    triggerSelectionChange() {
        if (typeof this.config.onSelectionChange === 'function') {
            this.config.onSelectionChange({
                cells: Array.from(this.selection.cells),
                rows: Array.from(this.selection.rows),
                columns: Array.from(this.selection.columns),
                data: this.getSelectedData()
            });
        }
    }
    
    /**
     * API publique - Sélectionne une cellule par son ID
     * @param {string} cellId - ID de la cellule à sélectionner
     * @param {boolean} clearPrevious - Si true, efface la sélection précédente
     * @returns {boolean} - true si la cellule a été trouvée et sélectionnée
     */
    selectCellById(cellId, clearPrevious = true) {
        const cell = this.table.table.querySelector(`td[id="${cellId}"]`);
        if (!cell) {
            this.debug(`Cellule avec ID ${cellId} non trouvée`);
            return false;
        }
        
        if (clearPrevious) {
            this.clearSelection();
        }
        
        this.selectCell(cell);
        this.selection.startCell = cell;
        this.selection.lastCell = cell;
        this.triggerSelectionChange();
        
        return true;
    }
    
    /**
     * API publique - Sélectionne une ligne par son ID
     * @param {string} rowId - ID de la ligne à sélectionner
     * @param {boolean} clearPrevious - Si true, efface la sélection précédente
     * @returns {boolean} - true si la ligne a été trouvée et sélectionnée
     */
    selectRowById(rowId, clearPrevious = true) {
        const row = this.table.table.querySelector(`tr[id="${rowId}"]`);
        if (!row) {
            this.debug(`Ligne avec ID ${rowId} non trouvée`);
            return false;
        }
        
        if (clearPrevious) {
            this.clearSelection();
        }
        
        this.selectRow(row);
        this.triggerSelectionChange();
        
        return true;
    }
    
    /**
     * API publique - Sélectionne une colonne par son ID
     * @param {string} columnId - ID de la colonne à sélectionner
     * @param {boolean} clearPrevious - Si true, efface la sélection précédente
     * @returns {boolean} - true si la colonne a été trouvée et sélectionnée
     */
    selectColumnById(columnId, clearPrevious = true) {
        const header = this.table.table.querySelector(`thead th[id="${columnId}"]`);
        if (!header) {
            this.debug(`Colonne avec ID ${columnId} non trouvée`);
            return false;
        }
        
        const columnIndex = Array.from(header.parentElement.children).indexOf(header);
        
        if (clearPrevious) {
            this.clearSelection();
        }
        
        this.selectColumn(columnIndex);
        this.triggerSelectionChange();
        
        return true;
    }
    
    /**
     * API publique - Effectue une action sur la sélection actuelle
     * @param {string} action - Nom de l'action à effectuer
     * @returns {boolean} - true si l'action a été effectuée
     */
    doAction(action) {
        if (this.selection.cells.size === 0) {
            this.debug('Pas de sélection active pour effectuer l\'action');
            return false;
        }
        
        switch (action.toLowerCase()) {
            case 'copy':
                this.copySelection();
                return true;
            case 'cut':
                this.cutSelection();
                return true;
            case 'paste':
                this.pasteSelection();
                return true;
            case 'delete':
                this.deleteSelection();
                return true;
            case 'selectall':
                this.selectAll();
                return true;
            case 'clear':
                this.clearSelection();
                return true;
            default:
                this.debug(`Action non reconnue: ${action}`);
                return false;
        }
    }
    
    /**
     * Rafraîchit le plugin (par exemple après l'ajout de nouvelles lignes)
     */
    refresh() {
        this.debug('Rafraîchissement du plugin');
        
        // Si des cellules sont sélectionnées, vérifier qu'elles existent toujours
        if (this.selection.cells.size > 0) {
            const validCells = new Set();
            this.selection.cells.forEach(cell => {
                if (cell.isConnected) {
                    validCells.add(cell);
                }
            });
            
            // Si certaines cellules ont été supprimées, mettre à jour la sélection
            if (validCells.size !== this.selection.cells.size) {
                this.selection.cells = validCells;
                this.updateRowColumnHighlight();
                this.triggerSelectionChange();
            }
        }
    }
    
    /**
     * Détruit le plugin et nettoie les ressources
     */
    destroy() {
        this.debug('Destruction du plugin');
        
        // Supprimer les écouteurs d'événements
        const table = this.table.table;
        
        table.removeEventListener('mousedown', this.handleMouseDown);
        table.removeEventListener('mouseover', this.handleMouseOver);
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('click', this.handleClickOutside);
        
        if (this.config.enableKeyboard) {
            document.removeEventListener('keydown', this.handleKeyDown);
        }
        
        if (this.config.showContextMenu) {
            table.removeEventListener('contextmenu', this.handleContextMenu);
        }
        
        // Supprimer tous les menus contextuels
        this.removeContextMenu();
        
        // Nettoyer la sélection
        this.clearSelection();
        
        // Supprimer les styles
        const styles = document.getElementById('selection-plugin-styles');
        if (styles) {
            styles.remove();
        }
    }
}