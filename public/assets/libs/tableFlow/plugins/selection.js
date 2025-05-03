/**
 * Plugin de sélection pour TableFlow
 * Permet la sélection de cellules, lignes et colonnes avec différentes options
 * (clic, drag, clavier) et des actions contextuelles (copier, couper, coller, supprimer).
 * S'intègre optionnellement avec ContextMenuPlugin.
 *
 * @class SelectionPlugin
 * @version 1.0.2 - Intégration TableInstance, API Clipboard, nettoyage
 * @depends ContextMenuPlugin (Optionnel, pour le menu contextuel intégré)
 */
export default class SelectionPlugin {
    /**
     * Crée une instance de SelectionPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'select'; // Nom court pour l'API getPlugin
        this.version = '1.0.2';
        this.type = 'interaction'; // Type de plugin
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances optionnelles */
        this.dependencies = ['ContextMenu'];

        // Configuration par défaut fusionnée avec celle fournie
        this.config = { ...this.getDefaultConfig(), ...config };

        // État interne de la sélection
        this.selection = {
            active: false,          // Drag en cours?
            cells: new Set(),       // Set<HTMLTableCellElement>
            rows: new Set(),        // Set<HTMLTableRowElement>
            columns: new Set(),     // Set<number> (index de colonne)
            startCell: null,        // HTMLTableCellElement | null
            lastCell: null,         // HTMLTableCellElement | null
            clipboard: null         // string | null (presse-papiers interne)
        };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debugLog = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[Selection ${this.table?.tableId}]`, ...args) ?? console.debug('[Selection]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Binding des méthodes pour conserver le contexte 'this' dans les listeners
        this._bindMethods();
    }

    /** Retourne la configuration par défaut. */
    getDefaultConfig() {
        return {
            // Options de sélection
            mode: 'cell', // 'cell', 'row', 'column', 'multiple'
            selectionClass: 'selected',
            rowClass: 'row-selected',
            columnClass: 'col-selected',
            // multipleClass: 'multiple-selected', // Souvent identique à selectionClass
            enableKeyboard: true,
            enableMouseDrag: true,
            shiftSelect: true,
            ctrlSelect: true, // Ctrl (Win) ou Cmd (Mac)

            // Mise en forme visuelle
            showSelectionBorder: true,
            highlightRow: true,
            highlightColumn: true,

            // Callbacks (alternative aux événements DOM)
            onSelect: null,
            onDeselect: null,
            onSelectionChange: null,

            // Intégration Menu Contextuel
            showContextMenu: true,
            menuItems: [ // Items par défaut pour le menu contextuel (interne ou via ContextMenuPlugin)
                { label: 'Copier', action: 'copy', icon: '<i class="fas fa-copy"></i>' },
                { label: 'Couper', action: 'cut', icon: '<i class="fas fa-cut"></i>' },
                { label: 'Coller', action: 'paste', icon: '<i class="fas fa-paste"></i>' },
                { type: 'separator' },
                { label: 'Effacer contenu', action: 'delete', icon: '<i class="fas fa-eraser"></i>' }
            ],

            // Actions rapides via clavier
            enableCopyPaste: true,
            enableDelete: true, // Suppr/Backspace pour effacer contenu

            debug: false,
        };
    }

    /** Lie les méthodes utilisées comme gestionnaires d'événements. @private */
    _bindMethods() {
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseOver = this.handleMouseOver.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleClickOutside = this.handleClickOutside.bind(this);
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this._clearOnStructureChange = this._clearOnStructureChange.bind(this);
        // Pour l'interface ContextMenu provider
        this.getMenuItems = this.getMenuItems.bind(this);
        this.executeAction = this.executeAction.bind(this);
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('SelectionPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debugLog('Initialisation du plugin Selection avec la configuration:', this.config);

        // Injecter les styles CSS nécessaires (une seule fois par page)
        this.addStyles();

        // Mettre en place les écouteurs d'événements
        this.setupEventListeners();

        // S'enregistrer auprès de ContextMenu si activé et disponible
        if (this.config.showContextMenu) {
            try {
                const contextMenuPlugin = this.table.getPlugin('ContextMenu');
                if (contextMenuPlugin && typeof contextMenuPlugin.registerProvider === 'function') {
                    contextMenuPlugin.registerProvider(this);
                    this.debugLog("Enregistré comme fournisseur auprès de ContextMenuPlugin.");
                } else if (contextMenuPlugin) {
                     this.logger.warn("ContextMenuPlugin trouvé mais n'expose pas registerProvider(). Menu contextuel Selection désactivé.");
                     this.config.showContextMenu = false;
                } else {
                     // ContextMenuPlugin non trouvé (getPlugin a retourné null ou levé une erreur interceptée)
                     this.debugLog("ContextMenuPlugin non trouvé/actif. Utilisation du menu contextuel interne si activé.");
                     // Le listener interne sera ajouté dans setupEventListeners si nécessaire
                }
            } catch(error) {
                 this.debugLog("ContextMenuPlugin non trouvé/actif. Utilisation du menu contextuel interne si activé.");
                 // Le listener interne sera ajouté dans setupEventListeners si nécessaire
            }
        }

        this.debugLog('Plugin Selection initialisé avec succès.');
    }

    /**
     * Injecte les styles CSS nécessaires.
     * Note: Il est préférable de déplacer ces styles dans un fichier CSS dédié.
     */
    addStyles() {
        const styleId = 'tableflow-selection-styles';
        if (document.getElementById(styleId)) return;
        this.debugLog("Injection des styles CSS pour Selection (préférez un fichier CSS dédié)...");

        const style = document.createElement('style');
        style.id = styleId;
        // Styles utilisant les variables CSS globales et les classes configurées
        style.textContent = `
            /* Styles Selection - Idéalement dans tableFlow.css ou un fichier séparé */
            table[data-tableflow-id] td.${this.config.selectionClass} {
                background-color: var(--tf-selection-bg, rgba(79, 70, 229, 0.1)) !important;
                ${this.config.showSelectionBorder ? `outline: 1px solid var(--tf-selection-border, rgba(79, 70, 229, 0.4)) !important; outline-offset: -1px;` : ''}
                position: relative; z-index: 1;
            }
            table[data-tableflow-id] tr.${this.config.rowClass} td { background-color: var(--tf-selection-row-col-bg, rgba(79, 70, 229, 0.05)) !important; }
            table[data-tableflow-id] td.${this.config.columnClass} { background-color: var(--tf-selection-row-col-bg, rgba(79, 70, 229, 0.05)) !important; }
            .table-drag-selecting { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }
            /* Menu contextuel interne (si ContextMenuPlugin non utilisé) */
            .selection-context-menu {
                position: absolute; background-color: var(--tf-bg-color, white); border: 1px solid var(--tf-border-color, #ccc);
                border-radius: var(--tf-border-radius, 4px); box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15);
                padding: 5px 0; z-index: 1051; min-width: 150px; font-size: 0.9em;
            }
            .selection-context-menu ul { list-style-type: none; margin: 0; padding: 0; }
            .selection-context-menu li { padding: 8px 15px; cursor: pointer; display: flex; align-items: center; gap: 8px; white-space: nowrap; color: var(--tf-text-color); }
            .selection-context-menu li:hover { background-color: var(--tf-choice-option-hover-bg, #f5f5f5); }
            .selection-context-menu li i { color: var(--tf-primary-color, #4f46e5); opacity: 0.8; width: 16px; text-align: center; flex-shrink: 0; }
            .selection-context-menu .separator { height: 1px; background-color: var(--tf-border-color, #eee); margin: 4px 0; }
        `;
        document.head.appendChild(style);
    }

    /** Attache les écouteurs d'événements. */
    setupEventListeners() {
        this.debugLog('Configuration des écouteurs d\'événements pour Selection...');
        const tableElement = this.table?.element;
        if (!tableElement) return;

        // Nettoyer les anciens listeners avant d'ajouter
        this._removeEventListeners();

        // --- Événements Souris ---
        const tbody = tableElement.querySelector('tbody');
        if (tbody) {
            tbody.addEventListener('mousedown', this.handleMouseDown);
            tbody.addEventListener('mouseover', this.handleMouseOver);
        } else {
             this.logger.warn("tbody non trouvé, listeners mousedown/mouseover non attachés.");
        }
        document.addEventListener('mouseup', this.handleMouseUp);

        // --- Clic en dehors ---
        document.addEventListener('click', this.handleClickOutside, true); // Utiliser capture

        // --- Clavier ---
        if (this.config.enableKeyboard) {
            document.addEventListener('keydown', this.handleKeyDown);
            this.debugLog("Écouteur keydown ajouté au document.");
        }

        // --- Menu Contextuel Interne (si ContextMenuPlugin n'est pas utilisé) ---
        if (this.config.showContextMenu && !this.table.getPlugin('ContextMenu')) {
             this.debugLog("Configuration de l'écouteur contextmenu interne.");
             tableElement.addEventListener('contextmenu', this.handleContextMenu);
        }

        // --- Changements Structurels ---
        tableElement.addEventListener('row:added', this._clearOnStructureChange);
        tableElement.addEventListener('row:removed', this._clearOnStructureChange);

        this.debugLog('Écouteurs d\'événements Selection configurés.');
    }

    /** Supprime les écouteurs d'événements ajoutés par ce plugin. @private */
    _removeEventListeners() {
        const tableElement = this.table?.element;
        if (tableElement) {
            const tbody = tableElement.querySelector('tbody');
            if (tbody) {
                tbody.removeEventListener('mousedown', this.handleMouseDown);
                tbody.removeEventListener('mouseover', this.handleMouseOver);
            }
            tableElement.removeEventListener('contextmenu', this.handleContextMenu);
            tableElement.removeEventListener('row:added', this._clearOnStructureChange);
            tableElement.removeEventListener('row:removed', this._clearOnStructureChange);
        }
        document.removeEventListener('mouseup', this.handleMouseUp);
        document.removeEventListener('click', this.handleClickOutside, true);
        if (this.config.enableKeyboard) { // Ne supprimer que s'il a été ajouté
            document.removeEventListener('keydown', this.handleKeyDown);
        }
        this.debugLog("Anciens écouteurs Selection retirés.");
    }


    /** Gestionnaire pour mousedown sur le tbody. @param {MouseEvent} event */
    handleMouseDown(event) {
        if (event.button !== 0 || !this.config.enableMouseDrag) return;
        const cell = /** @type {HTMLTableCellElement} */ (event.target)?.closest('td');
        if (!cell) return;

        this.debugLog('MouseDown détecté sur cellule:', cell.id);
        const isShiftKey = event.shiftKey && this.config.shiftSelect;
        const isCtrlKey = (event.ctrlKey || event.metaKey) && this.config.ctrlSelect;

        // Gérer la sélection selon le mode
        if (this.config.mode === 'row') {
            const row = cell.closest('tr');
            if (!isCtrlKey && !isShiftKey) this.clearSelection();
            if (isShiftKey && this.selection.startCell) this.selectRowRange(this.selection.startCell, cell);
            else { this.selectRow(row, isCtrlKey); this.selection.startCell = cell; }
            this.selection.lastCell = cell; this.selection.active = true;
        } else if (this.config.mode === 'column') {
            const columnIndex = cell.cellIndex;
            if (!isCtrlKey && !isShiftKey) this.clearSelection();
            if (isShiftKey && this.selection.startCell) this.selectColumnRange(this.selection.startCell, cell);
            else { this.selectColumn(columnIndex, isCtrlKey); this.selection.startCell = cell; }
            this.selection.lastCell = cell; this.selection.active = true;
        } else { // 'cell' ou 'multiple'
            if (!isShiftKey || !this.selection.startCell) {
                if (!isCtrlKey) this.clearSelection();
                this.selection.startCell = cell;
                this.selectCell(cell, isCtrlKey);
            } else {
                this.extendSelectionToCell(cell);
            }
            this.selection.lastCell = cell;
            this.selection.active = true;
            document.body.classList.add('table-drag-selecting');
        }
        event.preventDefault();
    }

    /** Gestionnaire pour mouseover sur le tbody. @param {MouseEvent} event */
    handleMouseOver(event) {
        if (!this.selection.active || !this.config.enableMouseDrag) return;
        if (this.config.mode !== 'cell' && this.config.mode !== 'multiple') return;
        const cell = /** @type {HTMLTableCellElement} */ (event.target)?.closest('td');
        if (!cell || cell === this.selection.lastCell) return;
        this.extendSelectionToCell(cell);
        this.selection.lastCell = cell;
    }

    /** Gestionnaire pour mouseup sur le document. @param {MouseEvent} event */
    handleMouseUp(event) {
        if (this.selection.active) {
            this.debugLog('MouseUp: Fin du drag.');
            this.selection.active = false;
            document.body.classList.remove('table-drag-selecting');
            this.triggerSelectionChange(); // Déclencher ici après la fin du drag
        }
    }

    /** Gestionnaire pour keydown sur le document. @param {KeyboardEvent} event */
    handleKeyDown(event) {
        if (!this.config.enableKeyboard || this.selection.cells.size === 0) return;
        const targetElement = /** @type {HTMLElement} */ (event.target);
        // Ignorer si focus dans un input/textarea HORS de notre table
        if ((targetElement.tagName === 'INPUT' || targetElement.tagName === 'TEXTAREA' || targetElement.isContentEditable) &&
            !targetElement.closest('table')?.isSameNode(this.table?.element)) {
            return;
        }

        let preventDefault = false;
        if (event.key.startsWith('Arrow')) { this.navigateSelection(event); preventDefault = true; }
        else if ((event.ctrlKey || event.metaKey) && this.config.enableCopyPaste) {
            if (event.key === 'c') { this.copySelection(); preventDefault = true; }
            else if (event.key === 'x') { this.cutSelection(); preventDefault = true; }
            else if (event.key === 'v') { this.pasteSelection(); preventDefault = true; }
            else if (event.key === 'a') { this.selectAll(); preventDefault = true; }
        } else if ((event.key === 'Delete' || event.key === 'Backspace') && this.config.enableDelete) {
            this.deleteSelectionContent(); preventDefault = true;
        }

        if (preventDefault) { event.preventDefault(); event.stopPropagation(); }
    }

    /** Gestionnaire pour clic sur le document. @param {MouseEvent} event */
    handleClickOutside(event) {
        if (this.selection.cells.size > 0 && !this.table?.element?.contains(/** @type {Node} */ (event.target))) {
            // Vérifier si le clic n'est pas sur le menu contextuel lui-même
            const contextMenu = document.querySelector('.selection-context-menu'); // Ou utiliser la classe de config ContextMenu
            if (!contextMenu || !contextMenu.contains(/** @type {Node} */ (event.target))) {
                this.debugLog("Clic extérieur détecté, effacement sélection.");
                this.clearSelection();
            }
        }
    }

    /** Gestionnaire pour contextmenu sur la table (si interne). @param {MouseEvent} event */
    handleContextMenu(event) {
        if (!this.config.showContextMenu || this.table.getPlugin('ContextMenu')) return;
        const cell = /** @type {HTMLTableCellElement} */ (event.target)?.closest('td');
        if (!cell) return;
        if (!this.selection.cells.has(cell)) {
            this.clearSelection();
            this.selectCell(cell);
            this.selection.startCell = cell;
            this.selection.lastCell = cell;
            this.triggerSelectionChange(); // Mettre à jour état avant menu
        }
        this.showInternalContextMenu(event);
        event.preventDefault();
    }

    /** Affiche le menu contextuel interne. @param {MouseEvent} event */
    showInternalContextMenu(event) {
        this.removeInternalContextMenu();
        const menu = document.createElement('div');
        menu.className = 'selection-context-menu';
        const list = document.createElement('ul');
        this.config.menuItems.forEach(item => {
            const li = document.createElement('li');
            if (item.type === 'separator') li.className = 'separator';
            else {
                const iconHtml = item.icon || '';
                const labelText = item.label || '';
                if (this.table?.sanitizer) {
                     const escapedLabel = this.table.sanitizer.escapeHTML(labelText);
                     this.table.sanitizer.setHTML(li, iconHtml + escapedLabel, { isTrustedIcon: !!item.icon });
                } else li.innerHTML = iconHtml + labelText;
                li.addEventListener('click', () => { this.handleContextMenuAction(item.action); this.removeInternalContextMenu(); });
            }
            list.appendChild(li);
        });
        menu.appendChild(list); document.body.appendChild(menu);
        // Positionnement
        const menuRect = menu.getBoundingClientRect();
        const { clientWidth, clientHeight } = document.documentElement;
        let x = Math.max(5, Math.min(event.clientX, clientWidth - menuRect.width - 5));
        let y = Math.max(5, Math.min(event.clientY, clientHeight - menuRect.height - 5));
        menu.style.left = `${x}px`; menu.style.top = `${y}px`;
        // Listener pour fermer
        menu._closeHandler = (e) => {
            if (!menu.contains(/** @type {Node} */ (e.target))) {
                 this.removeInternalContextMenu();
                 document.removeEventListener('click', menu._closeHandler, true);
            }
        };
        setTimeout(() => document.addEventListener('click', menu._closeHandler, true), 0);
    }

    /** Supprime le menu contextuel interne. */
    removeInternalContextMenu() {
        const menu = document.querySelector('.selection-context-menu');
        if (menu) {
            if (menu._closeHandler) document.removeEventListener('click', menu._closeHandler, true);
            menu.remove();
        }
    }

    /** Gère l'exécution d'une action du menu. @param {string} action */
    handleContextMenuAction(action) {
        this.debugLog('Action menu contextuel:', action);
        switch (action) {
            case 'copy': this.copySelection(); break;
            case 'cut': this.cutSelection(); break;
            case 'paste': this.pasteSelection(); break;
            case 'delete': this.deleteSelectionContent(); break;
            default:
                this.debugLog(`Action personnalisée '${action}' non gérée par défaut.`);
                const event = new CustomEvent('selection:action', { detail: { action, selection: this.getSelectedData() }, bubbles: true });
                this.table?.element?.dispatchEvent(event);
                break;
        }
    }

    // --- Méthodes de Sélection / Désélection ---

    /** Sélectionne une cellule. @param {HTMLTableCellElement} cell @param {boolean} [toggleMode=false] */
    selectCell(cell, toggleMode = false) {
        if (!cell) return;
        if (toggleMode && this.selection.cells.has(cell)) { this.deselectCell(cell); return; }
        this.selection.cells.add(cell);
        cell.classList.add(this.config.selectionClass);
        this.updateRowColumnHighlight();
        if (typeof this.config.onSelect === 'function') {
            try { this.config.onSelect({ type: 'cell', element: cell, data: this.getCellData(cell) }); }
            catch (e) { this.logger.error(`Erreur callback onSelect: ${e.message}`, e); }
        }
        // triggerSelectionChange est appelé à la fin de l'interaction (mouseup, keyup, etc.)
    }

    /** Désélectionne une cellule. @param {HTMLTableCellElement} cell */
    deselectCell(cell) {
        if (!cell || !this.selection.cells.has(cell)) return;
        this.selection.cells.delete(cell);
        cell.classList.remove(this.config.selectionClass);
        this.updateRowColumnHighlight();
        if (typeof this.config.onDeselect === 'function') {
             try { this.config.onDeselect({ type: 'cell', element: cell }); }
             catch (e) { this.logger.error(`Erreur callback onDeselect: ${e.message}`, e); }
        }
    }

    /** Sélectionne une ligne. @param {HTMLTableRowElement} row @param {boolean} [toggleMode=false] */
    selectRow(row, toggleMode = false) {
        if (!row) return;
        if (toggleMode && this.selection.rows.has(row)) { this.deselectRow(row); return; }
        this.selection.rows.add(row);
        row.classList.add(this.config.rowClass);
        Array.from(row.cells).forEach(cell => { this.selection.cells.add(cell); cell.classList.add(this.config.selectionClass); });
        this.updateRowColumnHighlight();
        if (typeof this.config.onSelect === 'function') {
             try { this.config.onSelect({ type: 'row', element: row, data: this.getRowData(row) }); }
             catch (e) { this.logger.error(`Erreur callback onSelect(row): ${e.message}`, e); }
        }
    }

    /** Désélectionne une ligne. @param {HTMLTableRowElement} row */
    deselectRow(row) {
        if (!row || !this.selection.rows.has(row)) return;
        this.selection.rows.delete(row);
        row.classList.remove(this.config.rowClass);
        Array.from(row.cells).forEach(cell => { this.selection.cells.delete(cell); cell.classList.remove(this.config.selectionClass); });
        this.updateRowColumnHighlight();
        if (typeof this.config.onDeselect === 'function') {
             try { this.config.onDeselect({ type: 'row', element: row }); }
             catch (e) { this.logger.error(`Erreur callback onDeselect(row): ${e.message}`, e); }
        }
    }

     /** Sélectionne une plage de lignes entre deux cellules. @param {HTMLTableCellElement} startCell @param {HTMLTableCellElement} endCell */
     selectRowRange(startCell, endCell) {
         const startRow = startCell?.closest('tr');
         const endRow = endCell?.closest('tr');
         if (!startRow || !endRow) return;
         const allRows = this.table?.getAllRows() ?? [];
         const startIndex = allRows.indexOf(startRow);
         const endIndex = allRows.indexOf(endRow);
         if (startIndex === -1 || endIndex === -1) return;

         this.clearSelection();
         const min = Math.min(startIndex, endIndex);
         const max = Math.max(startIndex, endIndex);
         for (let i = min; i <= max; i++) {
             this.selectRow(allRows[i]); // Sélectionne chaque ligne dans la plage
         }
         this.selection.startCell = startCell; // Garder la référence de départ
         this.selection.lastCell = endCell;
         this.triggerSelectionChange();
     }

    /** Sélectionne une colonne. @param {number} columnIndex @param {boolean} [toggleMode=false] */
    selectColumn(columnIndex, toggleMode = false) {
        if (columnIndex < 0) return;
        if (toggleMode && this.selection.columns.has(columnIndex)) { this.deselectColumn(columnIndex); return; }
        this.selection.columns.add(columnIndex);
        const rows = this.table?.getAllRows() ?? [];
        const cellsInColumn = [];
        rows.forEach(row => {
            const cell = row.cells[columnIndex];
            if (cell) { this.selection.cells.add(cell); cell.classList.add(this.config.selectionClass, this.config.columnClass); cellsInColumn.push(cell); }
        });
        this.updateRowColumnHighlight();
        if (typeof this.config.onSelect === 'function') {
             try { this.config.onSelect({ type: 'column', index: columnIndex, elements: cellsInColumn, data: this.getColumnData(columnIndex) }); }
             catch (e) { this.logger.error(`Erreur callback onSelect(col): ${e.message}`, e); }
        }
    }

    /** Désélectionne une colonne. @param {number} columnIndex */
    deselectColumn(columnIndex) {
        if (columnIndex < 0 || !this.selection.columns.has(columnIndex)) return;
        this.selection.columns.delete(columnIndex);
        const rows = this.table?.getAllRows() ?? [];
        const cellsInColumn = [];
        rows.forEach(row => {
            const cell = row.cells[columnIndex];
            if (cell) { this.selection.cells.delete(cell); cell.classList.remove(this.config.selectionClass, this.config.columnClass); cellsInColumn.push(cell); }
        });
        this.updateRowColumnHighlight();
        if (typeof this.config.onDeselect === 'function') {
             try { this.config.onDeselect({ type: 'column', index: columnIndex, elements: cellsInColumn }); }
             catch (e) { this.logger.error(`Erreur callback onDeselect(col): ${e.message}`, e); }
        }
    }

     /** Sélectionne une plage de colonnes entre deux cellules. @param {HTMLTableCellElement} startCell @param {HTMLTableCellElement} endCell */
     selectColumnRange(startCell, endCell) {
         const startColIndex = startCell?.cellIndex;
         const endColIndex = endCell?.cellIndex;
         if (startColIndex === undefined || endColIndex === undefined || startColIndex < 0 || endColIndex < 0) return;

         this.clearSelection();
         const min = Math.min(startColIndex, endColIndex);
         const max = Math.max(startColIndex, endColIndex);
         for (let i = min; i <= max; i++) {
             this.selectColumn(i); // Sélectionne chaque colonne dans la plage
         }
         this.selection.startCell = startCell;
         this.selection.lastCell = endCell;
         this.triggerSelectionChange();
     }

    /** Sélectionne toutes les cellules. */
    selectAll() {
        this.debugLog('Sélection de toutes les cellules (selectAll)');
        const rows = this.table?.getAllRows() ?? [];
        if (rows.length === 0) return;
        this.clearSelection();
        rows.forEach(row => {
            Array.from(row.cells).forEach(cell => { this.selection.cells.add(cell); cell.classList.add(this.config.selectionClass); });
            // Gérer mode row/column si nécessaire
            if (this.config.mode === 'row') this.selection.rows.add(row);
        });
        if (this.config.mode === 'column' && rows[0]) {
             for(let i=0; i<rows[0].cells.length; i++) this.selection.columns.add(i);
        }
        this.updateRowColumnHighlight();
        this.selection.startCell = rows[0]?.cells[0] || null;
        this.selection.lastCell = rows[rows.length - 1]?.cells[rows[rows.length - 1].cells.length - 1] || null;
        this.triggerSelectionChange();
    }

    /** Efface la sélection. */
    clearSelection() {
        if (this.selection.cells.size === 0 && this.selection.rows.size === 0 && this.selection.columns.size === 0) return;
        this.debugLog('Effacement de la sélection...');
        this.selection.cells.forEach(cell => cell.classList.remove(this.config.selectionClass, this.config.columnClass));
        this.selection.rows.forEach(row => row.classList.remove(this.config.rowClass));
        this.table?.getAllRows().forEach(row => row.classList.remove(this.config.rowClass)); // Nettoyage global lignes
        this.selection.cells.clear(); this.selection.rows.clear(); this.selection.columns.clear();
        this.selection.startCell = null; this.selection.lastCell = null; this.selection.active = false;
        this.triggerSelectionChange();
        this.debugLog('Sélection effacée.');
    }

    /** Étend la sélection rectangulaire. @param {HTMLTableCellElement} targetCell */
    extendSelectionToCell(targetCell) {
        if (!this.selection.startCell || !targetCell) return;
        const startRow = this.selection.startCell.closest('tr');
        const targetRow = targetCell.closest('tr');
        if (!startRow || !targetRow) return;
        const allRows = this.table?.getAllRows() ?? [];
        const startRI = allRows.indexOf(startRow), targetRI = allRows.indexOf(targetRow);
        const startCI = this.selection.startCell.cellIndex, targetCI = targetCell.cellIndex;
        if (startRI === -1 || targetRI === -1 || startCI < 0 || targetCI < 0) return;

        const minR = Math.min(startRI, targetRI), maxR = Math.max(startRI, targetRI);
        const minC = Math.min(startCI, targetCI), maxC = Math.max(startCI, targetCI);

        // Optimisation: Ne désélectionner que ce qui sort du nouveau rectangle
        const cellsToSelect = new Set();
        for (let i = minR; i <= maxR; i++) {
            const row = allRows[i];
            if (!row) continue;
            for (let j = minC; j <= maxC; j++) {
                const cell = row.cells[j];
                if (cell) cellsToSelect.add(cell);
            }
        }
        // Désélectionner les anciennes qui ne sont pas dans les nouvelles
        this.selection.cells.forEach(oldCell => {
            if (!cellsToSelect.has(oldCell)) this.deselectCell(oldCell);
        });
        // Sélectionner les nouvelles qui n'étaient pas dans les anciennes
        cellsToSelect.forEach(newCell => {
            if (!this.selection.cells.has(newCell)) this.selectCell(newCell);
        });

        this.selection.lastCell = targetCell; // Mettre à jour lastCell
        // triggerSelectionChange est appelé à la fin de l'interaction (mouseup)
    }

    /** Met à jour le surlignage des lignes/colonnes. */
    updateRowColumnHighlight() {
        const rows = this.table?.getAllRows() ?? [];
        if (rows.length === 0) return;
        // Réinitialiser
        rows.forEach(row => { row.classList.remove(this.config.rowClass); Array.from(row.cells).forEach(cell => cell.classList.remove(this.config.columnClass)); });
        if (this.selection.cells.size === 0) return;
        // Appliquer
        const rowsToHighlight = new Set(); const colsToHighlight = new Set();
        this.selection.cells.forEach(cell => { rowsToHighlight.add(cell.closest('tr')); colsToHighlight.add(cell.cellIndex); });
        if (this.config.highlightRow) rowsToHighlight.forEach(row => row?.classList.add(this.config.rowClass));
        if (this.config.highlightColumn) colsToHighlight.forEach(colIndex => rows.forEach(row => row.cells[colIndex]?.classList.add(this.config.columnClass)));
    }

    /** Gère la navigation au clavier. @param {KeyboardEvent} event */
    navigateSelection(event) {
        if (!this.selection.lastCell) return;
        const currentCell = this.selection.lastCell;
        const currentRow = currentCell.closest('tr'); if (!currentRow) return;
        const rows = this.table?.getAllRows() ?? [];
        const currentRowIndex = rows.indexOf(currentRow);
        const currentCellIndex = currentCell.cellIndex;
        const numCols = currentRow.cells.length;
        let targetRowIndex = currentRowIndex, targetCellIndex = currentCellIndex;

        switch (event.key) {
            case 'ArrowUp': targetRowIndex = Math.max(0, currentRowIndex - 1); break;
            case 'ArrowDown': targetRowIndex = Math.min(rows.length - 1, currentRowIndex + 1); break;
            case 'ArrowLeft': targetCellIndex = Math.max(0, currentCellIndex - 1); break;
            case 'ArrowRight': targetCellIndex = Math.min(numCols - 1, currentCellIndex + 1); break;
            default: return;
        }
        const targetCell = rows[targetRowIndex]?.cells[targetCellIndex];
        if (targetCell) {
            this.debugLog(`Navigation clavier: vers ${targetCell.id}`);
            if (event.shiftKey && this.config.shiftSelect) {
                if (!this.selection.startCell) this.selection.startCell = currentCell;
                this.extendSelectionToCell(targetCell);
            } else {
                this.clearSelection(); this.selectCell(targetCell);
                this.selection.startCell = targetCell; this.selection.lastCell = targetCell;
            }
            targetCell.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
            this.triggerSelectionChange(); // Déclencher après navigation/sélection
        }
    }

    // --- Organisation et Actions sur la Sélection ---

    /** Organise la sélection en grille 2D. @returns {Array<Array<HTMLTableCellElement|null>>} */
    organizeSelection() {
        if (this.selection.cells.size === 0) return [];
        const allRows = this.table?.getAllRows() ?? []; if (allRows.length === 0) return [];
        let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
        this.selection.cells.forEach(cell => {
            const r = allRows.indexOf(cell.closest('tr')); const c = cell.cellIndex;
            if (r !== -1 && c !== -1) { minR = Math.min(minR, r); maxR = Math.max(maxR, r); minC = Math.min(minC, c); maxC = Math.max(maxC, c); }
        });
        if (minR === Infinity) return [];
        const grid = [];
        for (let i = minR; i <= maxR; i++) {
            const row = []; const curRow = allRows[i]; if (!curRow) continue;
            for (let j = minC; j <= maxC; j++) { const cell = curRow.cells[j]; row.push(cell && this.selection.cells.has(cell) ? cell : null); }
            grid.push(row);
        }
        return grid;
    }

    /** Copie la sélection (TSV). */
    copySelection() {
        if (this.selection.cells.size === 0) return;
        this.debugLog('Copie sélection...');
        const grid = this.organizeSelection(); if (grid.length === 0) return;
        const tsv = grid.map(r => r.map(c => this.getCellData(c)?.value ?? '').join('\t')).join('\n');
        this.selection.clipboard = tsv;
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(tsv)
                .then(() => this.debugLog('Copié (API Clipboard).'))
                .catch(err => { this.logger.error('Erreur copie (API):', err); this.copyToClipboardFallback(tsv); });
        } else this.copyToClipboardFallback(tsv);
    }

    /** Fallback copie. @param {string} text */
    copyToClipboardFallback(text) {
        const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.select();
        try { if (document.execCommand('copy')) this.debugLog('Copié (Fallback).'); else throw new Error(); }
        catch (err) { this.logger.error('Erreur copie (Fallback):', err); this.table?.notify('error', 'Copie échouée.'); }
        finally { document.body.removeChild(ta); }
    }

    /** Coupe la sélection. */
    cutSelection() {
        if (this.selection.cells.size === 0) return;
        this.debugLog('Coupe sélection...');
        this.copySelection();
        this.deleteSelectionContent();
    }

    /** Colle depuis le presse-papiers. */
    async pasteSelection() {
        let textToPaste = this.selection.clipboard; // Fallback
        if (navigator.clipboard?.readText) {
            try { textToPaste = await navigator.clipboard.readText(); this.debugLog("Lu depuis presse-papiers système."); }
            catch (err) { this.logger.warn(`Lecture presse-papiers système échouée (${err.message}). Utilisation clipboard interne.`); if (!textToPaste) { this.table?.notify('warning', 'Presse-papiers vide/inaccessible.'); return; } }
        } else if (!textToPaste) { this.table?.notify('warning', 'Presse-papiers vide.'); return; }

        const startCell = this.selection.lastCell || (this.selection.cells.size > 0 ? Array.from(this.selection.cells)[0] : null);
        if (!startCell) { this.table?.notify('warning', 'Sélectionnez où coller.'); return; }
        this.debugLog(`Collage depuis ${startCell.id}...`);

        const startRow = startCell.closest('tr'); if (!startRow) return;
        const allRows = this.table?.getAllRows() ?? [];
        const startRI = allRows.indexOf(startRow), startCI = startCell.cellIndex;
        if (startRI === -1 || startCI < 0) return;

        const clipboardRows = textToPaste.split('\n').filter(line => line || line === ''); // Garder lignes vides? Oui.
        const clipboardData = clipboardRows.map(line => line.split('\t'));
        this.debugLog(`Données à coller (${clipboardData.length} lignes):`, clipboardData);

        const modified = [];
        clipboardData.forEach((rowData, rOffset) => {
            const targetRI = startRI + rOffset; if (targetRI >= allRows.length) return;
            const targetRow = allRows[targetRI];
            rowData.forEach((value, cOffset) => {
                const targetCI = startCI + cOffset; if (targetCI >= targetRow.cells.length) return;
                const targetCell = targetRow.cells[targetCI];
                if (targetCell) { this.updateCellValue(targetCell, value); modified.push(targetCell); }
            });
        });

        if (modified.length > 0) {
            this.debugLog(`${modified.length} cellule(s) mise(s) à jour par collage.`);
            const event = new CustomEvent('cells:pasted', { detail: { cells: modified, startCell, data: clipboardData }, bubbles: true });
            this.table?.element?.dispatchEvent(event);
        }
    }

    /** Met à jour valeur et déclenche événement. @param {HTMLTableCellElement} cell @param {string} value @private */
    updateCellValue(cell, value) {
        const oldValue = cell.getAttribute('data-value');
        if (value === oldValue) return;
        cell.setAttribute('data-value', value);
        const wrapperClass = this.table?.config?.wrapCellClass || 'cell-wrapper';
        const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;
        if (this.table?.sanitizer) this.table.sanitizer.setHTML(wrapper, value, { isPlainText: true });
        else wrapper.textContent = value;
        // Déclencher cell:change
        const row = cell.closest('tr'); const colId = this.table?.element?.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`)?.id;
        const initVal = cell.getAttribute('data-initial-value'); const isMod = value !== initVal;
        const event = new CustomEvent('cell:change', { detail: { cell, cellId: cell.id, columnId: colId, rowId: row?.id, value, oldValue, initialValue: initVal, isModified: isMod, source: 'selection', tableId: this.table?.tableId }, bubbles: true });
        this.table?.element?.dispatchEvent(event);
    }


    /** Efface le contenu des cellules sélectionnées. */
    deleteSelectionContent() {
        if (this.selection.cells.size === 0) return;
        this.debugLog('Effacement contenu sélection...');
        const deleted = [];
        this.selection.cells.forEach(cell => { this.updateCellValue(cell, ''); deleted.push(cell); });
        if (deleted.length > 0) {
            const event = new CustomEvent('cells:contentDeleted', { detail: { cells: deleted }, bubbles: true });
            this.table?.element?.dispatchEvent(event);
        }
    }

    // --- Récupération des Données ---

    /** Récupère données sélectionnées. @returns {{cells: Array<object>, rows: Array<object>, columns: object.<string, Array<object>>}} */
    getSelectedData() {
        const cells = Array.from(this.selection.cells).map(c => this.getCellData(c)).filter(Boolean);
        const rows = Array.from(this.selection.rows).map(r => this.getRowData(r)).filter(Boolean);
        const columns = {};
        this.selection.columns.forEach(ci => {
            const colData = this.getColumnData(ci);
            if (colData.length > 0 && colData[0].columnId) columns[colData[0].columnId] = colData;
        });
        return { cells, rows, columns };
    }

    /** Récupère données cellule. @param {HTMLTableCellElement|null} cell @returns {object | null} */
    getCellData(cell) {
        if (!cell) return null; const row = cell.closest('tr'); if (!row) return null;
        const allRows = this.table?.getAllRows() ?? []; const rI = allRows.indexOf(row); const cI = cell.cellIndex;
        const head = this.table?.element?.querySelectorAll('thead th')[cI]; const colId = head?.id;
        let val = cell.hasAttribute('data-value') ? cell.getAttribute('data-value') : cell.textContent?.trim() ?? '';
        return { id: cell.id, row: rI, column: cI, columnId: colId || null, rowId: row.id || null, value: val };
    }

    /** Récupère données ligne. @param {HTMLTableRowElement|null} row @returns {object | null} */
    getRowData(row) {
        if (this.table?.getRowData) return this.table.getRowData(row); // Utiliser méthode centrale
        if (!row) return null; const headers = Array.from(this.table?.element?.querySelectorAll('thead th') ?? []);
        const data = { rowId: row.id };
        Array.from(row.cells).forEach((c, i) => { if (headers[i]?.id) data[headers[i].id] = c.hasAttribute('data-value') ? c.getAttribute('data-value') : c.textContent?.trim() ?? ''; });
        return data;
    }

    /** Récupère données colonne. @param {number} columnIndex @returns {Array<object>} */
    getColumnData(columnIndex) {
        const rows = this.table?.getAllRows() ?? []; const head = this.table?.element?.querySelectorAll('thead th')[columnIndex]; const colId = head?.id; if (!colId) return [];
        return rows.map(r => { const c = r.cells[columnIndex]; if (!c) return null; const v = c.hasAttribute('data-value') ? c.getAttribute('data-value') : c.textContent?.trim() ?? ''; return { rowId: r.id || null, cellId: c.id, columnId: colId, value: v }; }).filter(Boolean);
    }

    // --- Événements et Callbacks ---

    /** Déclenche onSelectionChange. */
    triggerSelectionChange() {
        this.debugLog(`Déclenchement onSelectionChange: ${this.selection.cells.size} cellule(s) sélectionnée(s).`);
        const details = { cells: Array.from(this.selection.cells), rows: Array.from(this.selection.rows), columns: Array.from(this.selection.columns), data: this.getSelectedData() };
        if (typeof this.config.onSelectionChange === 'function') {
            try { this.config.onSelectionChange(details); } catch (e) { this.logger.error(`Erreur callback onSelectionChange: ${e.message}`, e); }
        }
        const event = new CustomEvent('selection:change', { detail: details, bubbles: true });
        this.table?.element?.dispatchEvent(event);
    }

    // --- Interface pour ContextMenuPlugin ---

    /** Retourne items pour ContextMenu. @param {HTMLTableCellElement} cell @returns {Array<object>} */
    getMenuItems(cell) {
        if (!this.config.showContextMenu) return [];
        const isSel = this.selection.cells.has(cell);
        if (this.selection.cells.size === 0 || !isSel) {
             if (this.selection.clipboard || navigator.clipboard?.readText) return this.config.menuItems.filter(i => i.action === 'paste');
             return [];
        }
        const items = this.config.menuItems.filter(i => !(i.action === 'paste' && !this.selection.clipboard && !navigator.clipboard?.readText));
        if (items.length > 0 && items[0].type !== 'header') items.unshift({ type: 'header', label: 'Sélection' });
        return items;
    }

    /** Exécute action pour ContextMenu. @param {string} actionId @param {HTMLTableCellElement} cell */
    executeAction(actionId, cell) { this.handleContextMenuAction(actionId); }

    // --- API Publique (Exemples) ---

    /** Sélectionne cellule par ID. @param {string} cellId @param {boolean} [clearPrevious=true] */
    selectCellById(cellId, clearPrevious = true) {
        const cell = this.table?.element?.querySelector(`td#${CSS.escape(cellId)}`);
        if (!cell) { this.debugLog(`Cellule ${cellId} non trouvée.`); return false; }
        if (clearPrevious) this.clearSelection();
        this.selectCell(cell); this.selection.startCell = cell; this.selection.lastCell = cell;
        this.triggerSelectionChange(); return true;
    }
    // Ajouter selectRowById, selectColumnById...

    /** Effectue action. @param {string} action */
    doAction(action) {
        const act = action.toLowerCase();
        if (this.selection.cells.size === 0 && !['paste', 'selectall', 'clear'].includes(act)) return false;
        if (typeof this[`${act}Selection`] === 'function') { this[`${act}Selection`](); return true; }
        if (act === 'delete') { this.deleteSelectionContent(); return true; }
        if (act === 'clear') { this.clearSelection(); return true; }
        this.debugLog(`Action '${action}' non reconnue.`); return false;
    }


    // --- Cycle de vie ---

    /** Rafraîchit la sélection. */
    refresh() {
        this.debugLog('Refresh Selection...'); let changed = false;
        const currentCells = new Set();
        this.selection.cells.forEach(c => { if (c.isConnected && this.table?.element?.contains(c)) currentCells.add(c); else changed = true; });
        if (changed) {
             this.debugLog("Mise à jour sélection après refresh.");
             this.selection.cells = currentCells;
             this.selection.rows.forEach(r => { if (!r.isConnected || !this.table?.element?.contains(r)) this.selection.rows.delete(r); });
             const currentCols = new Set(); this.selection.cells.forEach(c => currentCols.add(c.cellIndex)); this.selection.columns = currentCols;
             if (this.selection.startCell && !this.selection.startCell.isConnected) this.selection.startCell = null;
             if (this.selection.lastCell && !this.selection.lastCell.isConnected) this.selection.lastCell = null;
             if (this.selection.cells.size > 0 && !this.selection.lastCell) this.selection.lastCell = Array.from(this.selection.cells).pop() || null;
             if (this.selection.cells.size > 0 && !this.selection.startCell) this.selection.startCell = this.selection.lastCell;
             this.updateRowColumnHighlight();
             this.triggerSelectionChange();
        }
         this.debugLog('Refresh Selection terminé.');
    }

     /** Efface sélection si structure change. @private */
     _clearOnStructureChange() { this.clearSelection(); }

    /** Nettoie les ressources. */
    destroy() {
        this.debugLog('Destruction Selection...');
        this._removeEventListeners(); // Supprimer les listeners
        // Désenregistrer de ContextMenu
        if (this.config.showContextMenu) {
             const contextMenuPlugin = this.table?.getPlugin('ContextMenu');
             if (contextMenuPlugin?.unregisterProvider) contextMenuPlugin.unregisterProvider(this);
        }
        this.removeInternalContextMenu(); // Nettoyer menu interne
        this.clearSelection(); this.selection.clipboard = null; this.table = null;
        this.debugLog('Plugin Selection détruit.');
    }
}
