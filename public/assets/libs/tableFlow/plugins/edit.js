import { DOMSanitizer } from '../src/domSanitizer.js';

/**
 * EditPlugin - Gestion de l'édition en ligne pour TableFlow
 * 
 * @version 3.0.0
 */
export default class EditPlugin {
    constructor(config = {}) {
        this.name = 'edit';
        this.version = '3.0.0';
        this.type = 'edit';
        this.table = null;
        this.dependencies = [];
        
        // Système de hooks amélioré avec namespaces
        this.hooks = {
            beforeEdit: [],    // Avant de commencer l'édition
            afterEdit: [],     // Après avoir créé le champ d'édition
            beforeSave: [],    // Avant d'enregistrer les modifications
            afterSave: [],     // Après l'enregistrement
            onKeydown: [],     // Lors d'un événement clavier
            onRender: [],      // Lors du rendu du contenu
            onCancel: [],      // Lors de l'annulation de l'édition
            onValueChange: []  // Lors du changement de valeur
        };
        
        // Registre des hooks
        this.hookRegistry = new Map();
        this.namespaceRegistry = new Map();
        this.hookIdCounter = 0;
        
        // Configuration par défaut
        this.config = {
            editAttribute: 'th-edit',
            cellClass: 'td-edit',
            readOnlyClass: 'readonly',
            inputClass: 'edit-input',
            modifiedClass: 'modified',
            doubleClickDelay: 300,
            autoSelectOnEdit: true,
            allowEmptyValue: true,
            trimValues: true,
            enterKey: 'save', // 'save', 'newline', 'custom'
            escapeKey: 'cancel', // 'cancel', 'ignore', 'custom'
            tabKey: 'next', // 'next', 'previous', 'ignore', 'custom'
            customValidation: null,
            editMode: 'dblclick', // 'dblclick', 'click', 'f2', 'custom'
            inputType: 'text', // 'text', 'textarea', 'number', 'date', etc.
            preventNavigation: true, // Empêcher la navigation pendant l'édition
            autoResize: true, // Ajuster automatiquement la taille de l'input
            debug: false,
            ...config
        };
        
        // Logger
        this.debug = this.config.debug ? 
            (...args) => console.log('[EditPlugin]', ...args) : 
            () => {};
        
        // État de l'édition
        this.state = {
            currentCell: null,
            currentInput: null,
            isEditing: false,
            initialValue: null,
            preventBlur: false
        };
        
        // Gestionnaires d'événements liés
        this._boundHandlers = {
            click: this.handleClick.bind(this),
            dblclick: this.handleDoubleClick.bind(this),
            keydown: this.handleKeyDown.bind(this),
            documentKeydown: this.handleDocumentKeyDown.bind(this),
            windowBeforeUnload: this.handleBeforeUnload.bind(this)
        };
        
        // Cache pour les cellules
        this._cellCache = new WeakMap();
    }

    /**
     * Initialise le plugin
     */
    init(tableHandler) {
        if (!tableHandler) {
            throw new Error('TableHandler instance is required');
        }
        
        this.table = tableHandler;
        this.debug('Initialisation du plugin Edit');
        
        // Configuration des cellules éditables
        this.setupEditCells();
        
        // Configuration des événements
        this.setupEventListeners();
        
        // Ajouter les styles CSS
        this.injectStyles();
    }

    /**
     * Configure les cellules éditables
     */
    setupEditCells() {
        if (!this.table?.table) {
            this.debug('Table non trouvée');
            return;
        }

        const headerCells = this.table.table.querySelectorAll('th');
        const editColumns = Array.from(headerCells)
            .filter(header => header.hasAttribute(this.config.editAttribute))
            .map(header => ({
                id: header.id,
                index: Array.from(headerCells).indexOf(header),
                config: this.parseColumnConfig(header)
            }));

        if (!editColumns.length) {
            this.debug('Aucune colonne éditable trouvée');
            return;
        }

        const rows = this.table.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            editColumns.forEach(({id: columnId, index, config}) => {
                const cell = row.cells[index];
                if (!cell) return;

                // Ne pas réinitialiser si la cellule est déjà gérée par un autre plugin
                if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'edit') {
                    return;
                }

                this.setupEditCell(cell, columnId, config);
            });
        });
    }

    /**
     * Parse la configuration d'une colonne depuis l'attribut
     */
    parseColumnConfig(header) {
        const attr = header.getAttribute(this.config.editAttribute);
        if (!attr || attr === 'true') {
            return {}; // Configuration par défaut
        }
        
        try {
            return JSON.parse(attr);
        } catch (e) {
            this.debug(`Erreur parsing config colonne ${header.id}:`, e);
            return {};
        }
    }

    /**
     * Configure une cellule éditable
     */
    setupEditCell(cell, columnId, columnConfig = {}) {
        cell.classList.add(this.config.cellClass);
        cell.setAttribute('data-plugin', 'edit');
        cell.setAttribute('data-column-id', columnId);
        
        // Stocker la config de la colonne
        this._cellCache.set(cell, {
            columnId,
            config: columnConfig
        });

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
        
        // Appliquer le rendu initial
        this.renderCell(cell, currentValue);
        
        // Marquer comme initialisée
        cell.setAttribute('data-edit-initialized', 'true');
    }

    /**
     * Configure les gestionnaires d'événements
     */
    setupEventListeners() {
        if (!this.table?.table) return;

        // Événements de base
        if (this.config.editMode === 'dblclick') {
            this.table.table.addEventListener('dblclick', this._boundHandlers.dblclick);
        } else if (this.config.editMode === 'click') {
            this.table.table.addEventListener('click', this._boundHandlers.click);
        }
        
        // Événements clavier au niveau du document
        document.addEventListener('keydown', this._boundHandlers.documentKeydown);
        
        // Prévenir la perte de données
        if (this.config.preventNavigation) {
            window.addEventListener('beforeunload', this._boundHandlers.windowBeforeUnload);
        }

        // Événements personnalisés
        this.table.table.addEventListener('cell:saved', this.handleCellSaved.bind(this));
        this.table.table.addEventListener('row:saved', this.handleRowSaved.bind(this));
        this.table.table.addEventListener('row:added', this.handleRowAdded.bind(this));
    }

    /**
     * Gestion du clic
     */
    handleClick(event) {
        if (this.config.editMode !== 'click') return;
        
        const cell = event.target.closest('td');
        if (this.isEditableCell(cell)) {
            this.startEditing(cell);
        }
    }

    /**
     * Gestion du double-clic
     */
    handleDoubleClick(event) {
        if (this.config.editMode !== 'dblclick') return;
        
        const cell = event.target.closest('td');
        if (this.isEditableCell(cell)) {
            this.startEditing(cell);
        }
    }

    /**
     * Gestion des touches clavier au niveau document
     */
    handleDocumentKeyDown(event) {
        // F2 pour éditer la cellule active
        if (event.key === 'F2' && this.config.editMode === 'f2') {
            const activeCell = document.activeElement.closest('td');
            if (this.isEditableCell(activeCell)) {
                this.startEditing(activeCell);
                event.preventDefault();
            }
        }
        
        // Échap pour annuler l'édition en cours
        if (event.key === 'Escape' && this.state.isEditing) {
            this.cancelEditing();
            event.preventDefault();
        }
    }

    /**
     * Gestion de beforeunload
     */
    handleBeforeUnload(event) {
        if (this.state.isEditing && this.config.preventNavigation) {
            const message = 'Des modifications sont en cours. Êtes-vous sûr de vouloir quitter ?';
            event.returnValue = message;
            return message;
        }
    }

    /**
     * Vérifie si une cellule est éditable
     */
    isEditableCell(cell) {
        if (!cell) return false;
        
        // Vérifications de base
        if (!cell.classList.contains(this.config.cellClass)) return false;
        if (cell.classList.contains(this.config.readOnlyClass)) return false;
        if (cell.getAttribute('data-plugin') !== 'edit') return false;
        
        // Vérifier si déjà en édition
        if (cell.querySelector('input, textarea')) return false;
        
        return true;
    }

    /**
     * Démarre l'édition d'une cellule
     */
    startEditing(cell) {
        if (!cell || this.state.isEditing) return;
        
        // Si une autre cellule est en édition, la sauvegarder d'abord
        if (this.state.currentCell && this.state.currentCell !== cell) {
            this.finishEditing();
        }
        
        const currentValue = cell.getAttribute('data-value') || cell.textContent.trim();
        
        // Hook beforeEdit
        if (this.executeHook('beforeEdit', cell, currentValue) === false) {
            this.debug('Édition annulée par un hook');
            return;
        }
        
        // Mettre à jour l'état
        this.state.isEditing = true;
        this.state.currentCell = cell;
        this.state.initialValue = currentValue;
        
        // Créer le champ d'édition
        const input = this.createEditField(cell, currentValue);
        this.state.currentInput = input;
        
        // Ajouter une classe d'édition
        cell.classList.add('editing');
        
        // Focus et sélection
        input.focus();
        if (this.config.autoSelectOnEdit) {
            input.select();
        }
        
        // Hook afterEdit
        this.executeHook('afterEdit', cell, input, currentValue);
    }

    /**
     * Crée le champ d'édition
     */
    createEditField(cell, currentValue) {
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        const cellConfig = this._cellCache.get(cell)?.config || {};
        
        // Déterminer le type d'input
        const inputType = cellConfig.inputType || this.config.inputType;
        let input;
        
        if (inputType === 'textarea' || (inputType === 'auto' && currentValue.includes('\n'))) {
            input = document.createElement('textarea');
            input.rows = Math.min(10, currentValue.split('\n').length + 1);
        } else {
            input = document.createElement('input');
            input.type = inputType === 'auto' ? 'text' : inputType;
        }
        
        input.className = this.config.inputClass;
        input.value = currentValue;
        
        // Style de base
        Object.assign(input.style, {
            width: '100%',
            boxSizing: 'border-box',
            border: '1px solid #ddd',
            padding: '4px',
            font: 'inherit'
        });
        
        // Auto-resize pour textarea
        if (input.tagName === 'TEXTAREA' && this.config.autoResize) {
            input.addEventListener('input', () => {
                input.style.height = 'auto';
                input.style.height = input.scrollHeight + 'px';
            });
            // Déclencher une fois pour la taille initiale
            input.style.height = 'auto';
            input.style.height = input.scrollHeight + 'px';
        }
        
        // Vider le wrapper et ajouter l'input
        wrapper.innerHTML = '';
        wrapper.appendChild(input);
        
        // Ajouter les gestionnaires d'événements
        input.addEventListener('blur', () => {
            if (!this.state.preventBlur) {
                this.finishEditing();
            }
        });
        
        input.addEventListener('keydown', (e) => this.handleInputKeyDown(e, cell, input));
        
        return input;
    }

    /**
     * Gestion des touches dans l'input
     */
    handleInputKeyDown(event, cell, input) {
        // Hook onKeydown
        if (this.executeHook('onKeydown', event, cell, input) === false) {
            return;
        }
        
        switch (event.key) {
            case 'Enter':
                if (this.config.enterKey === 'save') {
                    this.finishEditing();
                    event.preventDefault();
                } else if (this.config.enterKey === 'newline' && input.tagName === 'TEXTAREA') {
                    // Permettre les sauts de ligne dans textarea
                    return;
                }
                break;
                
            case 'Escape':
                if (this.config.escapeKey === 'cancel') {
                    this.cancelEditing();
                    event.preventDefault();
                }
                break;
                
            case 'Tab':
                if (this.config.tabKey === 'next' || this.config.tabKey === 'previous') {
                    this.navigateToNextCell(event, cell);
                    event.preventDefault();
                }
                break;
        }
    }

    /**
     * Termine l'édition et sauvegarde
     */
    finishEditing() {
        if (!this.state.isEditing || !this.state.currentCell || !this.state.currentInput) {
            return;
        }
        
        const cell = this.state.currentCell;
        const input = this.state.currentInput;
        let newValue = input.value;
        
        // Appliquer le trimming si configuré
        if (this.config.trimValues) {
            newValue = newValue.trim();
        }
        
        // Vérifier si la valeur vide est autorisée
        if (!this.config.allowEmptyValue && newValue === '') {
            this.cancelEditing();
            return;
        }
        
        const oldValue = cell.getAttribute('data-value');
        
        // Validation personnalisée
        if (this.config.customValidation) {
            const validationResult = this.config.customValidation(newValue, oldValue, cell);
            if (validationResult !== true) {
                if (typeof validationResult === 'string') {
                    alert(validationResult);
                }
                return;
            }
        }
        
        // Hook beforeSave
        if (this.executeHook('beforeSave', cell, newValue, oldValue) === false) {
            this.debug('Sauvegarde annulée par un hook');
            this.cancelEditing();
            return;
        }
        
        // Mise à jour de la valeur
        cell.setAttribute('data-value', newValue);
        
        // Rendu de la cellule
        this.renderCell(cell, newValue);
        
        // Marquer la ligne comme modifiée si nécessaire
        this.updateRowModifiedState(cell, newValue);
        
        // Déclencher l'événement de changement
        this.triggerChangeEvent(cell, newValue, oldValue);
        
        // Hook afterSave
        this.executeHook('afterSave', cell, newValue, oldValue);
        
        // Nettoyer l'état
        this.cleanupEditState();
    }

    /**
     * Annule l'édition
     */
    cancelEditing() {
        if (!this.state.isEditing || !this.state.currentCell) {
            return;
        }
        
        const cell = this.state.currentCell;
        const originalValue = cell.getAttribute('data-value');
        
        // Hook onCancel
        this.executeHook('onCancel', cell, originalValue);
        
        // Restaurer le contenu
        this.renderCell(cell, originalValue);
        
        // Nettoyer l'état
        this.cleanupEditState();
    }

    /**
     * Nettoie l'état d'édition
     */
    cleanupEditState() {
        if (this.state.currentCell) {
            this.state.currentCell.classList.remove('editing');
        }
        
        this.state.isEditing = false;
        this.state.currentCell = null;
        this.state.currentInput = null;
        this.state.initialValue = null;
        this.state.preventBlur = false;
    }

    /**
     * Navigation vers la cellule suivante/précédente
     */
    navigateToNextCell(event, currentCell) {
        const row = currentCell.closest('tr');
        const cells = Array.from(row.cells);
        const currentIndex = cells.indexOf(currentCell);
        
        let nextCell;
        if (event.shiftKey || this.config.tabKey === 'previous') {
            // Navigation vers l'arrière
            nextCell = cells
                .slice(0, currentIndex)
                .reverse()
                .find(cell => this.isEditableCell(cell));
        } else {
            // Navigation vers l'avant
            nextCell = cells
                .slice(currentIndex + 1)
                .find(cell => this.isEditableCell(cell));
        }
        
        if (nextCell) {
            this.state.preventBlur = true;
            this.finishEditing();
            setTimeout(() => {
                this.state.preventBlur = false;
                this.startEditing(nextCell);
            }, 0);
        }
    }

    /**
     * Rendu du contenu de la cellule
     */
    renderCell(cell, value) {
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        
        // Hook onRender
        if (this.executeHook('onRender', cell, value) === false) {
            return;
        }
        
        // Rendu par défaut
        DOMSanitizer.setHTML(wrapper, value, { isPlainText: true });
    }

    /**
     * Met à jour l'état modifié de la ligne
     */
    updateRowModifiedState(cell, newValue) {
        const row = cell.closest('tr');
        if (!row) return;
        
        const initialValue = cell.getAttribute('data-initial-value');
        const isModified = newValue !== initialValue;
        
        if (isModified) {
            row.classList.add(this.config.modifiedClass);
        } else {
            // Vérifier si d'autres cellules sont modifiées
            const hasOtherModified = Array.from(row.cells).some(c => {
                if (c === cell || !c.hasAttribute('data-initial-value')) return false;
                return c.getAttribute('data-value') !== c.getAttribute('data-initial-value');
            });
            
            if (!hasOtherModified) {
                row.classList.remove(this.config.modifiedClass);
            }
        }
    }

    /**
     * Déclenche l'événement de changement
     */
    triggerChangeEvent(cell, newValue, oldValue) {
        const row = cell.closest('tr');
        const columnId = this._cellCache.get(cell)?.columnId || cell.getAttribute('data-column-id');
        
        const changeEvent = new CustomEvent('cell:change', {
            detail: {
                cellId: cell.id,
                columnId: columnId,
                rowId: row ? row.id : null,
                value: newValue,
                oldValue: oldValue,
                cell: cell,
                source: 'edit',
                tableId: this.table.table.id,
                isModified: newValue !== cell.getAttribute('data-initial-value')
            },
            bubbles: true
        });
        
        this.table.table.dispatchEvent(changeEvent);
        
        // Hook onValueChange
        this.executeHook('onValueChange', cell, newValue, oldValue);
    }

    /**
     * Gestionnaires d'événements
     */
    handleCellSaved(event) {
        const cell = event.detail.cell;
        if (!cell || !cell.classList.contains(this.config.cellClass)) {
            return;
        }
        
        const value = event.detail.value || cell.getAttribute('data-value');
        cell.setAttribute('data-initial-value', value);
        
        this.renderCell(cell, value);
    }

    handleRowSaved(event) {
        const row = event.detail.row;
        if (!row) return;
        
        row.classList.remove(this.config.modifiedClass);
        
        Array.from(row.cells).forEach(cell => {
            if (!cell.classList.contains(this.config.cellClass)) return;
            
            const value = cell.getAttribute('data-value');
            cell.setAttribute('data-initial-value', value);
        });
    }

    handleRowAdded(event) {
        this.debug('row:added event received');
        this.setupEditCells();
    }

    /**
     * Système de hooks
     */
    
    /**
     * Ajoute un hook
     * @param {string} hookName - Nom du hook
     * @param {Function} callback - Fonction callback
     * @param {string} [namespace='default'] - Namespace
     * @returns {string} - ID du hook
     */
    addHook(hookName, callback, namespace = 'default') {
        if (!this.hooks[hookName]) {
            throw new Error(`Hook inconnu: ${hookName}`);
        }
        
        if (typeof callback !== 'function') {
            throw new Error('Le callback doit être une fonction');
        }
        
        // Générer un ID unique
        const hookId = `${namespace}_${hookName}_${++this.hookIdCounter}`;
        
        // Wrapper pour la gestion des erreurs
        const wrappedCallback = (...args) => {
            try {
                return callback.apply(null, args);
            } catch (error) {
                console.error(`Erreur dans le hook ${hookName} (namespace: ${namespace}):`, error);
                return undefined; // Ne pas bloquer l'exécution
            }
        };
        
        // Ajouter le hook
        this.hooks[hookName].push(wrappedCallback);
        
        // Enregistrer dans le registre
        this.hookRegistry.set(hookId, {
            name: hookName,
            callback: wrappedCallback,
            originalCallback: callback,
            namespace: namespace,
            index: this.hooks[hookName].length - 1
        });
        
        // Enregistrer dans le registre des namespaces
        if (!this.namespaceRegistry.has(namespace)) {
            this.namespaceRegistry.set(namespace, new Set());
        }
        this.namespaceRegistry.get(namespace).add(hookId);
        
        this.debug(`Hook ajouté: ${hookName} (namespace: ${namespace}, ID: ${hookId})`);
        
        return hookId;
    }

    /**
     * Supprime un hook par son ID
     */
    removeHook(hookId) {
        const hookInfo = this.hookRegistry.get(hookId);
        
        if (!hookInfo) {
            this.debug(`Hook non trouvé: ${hookId}`);
            return false;
        }
        
        const { name, callback, namespace } = hookInfo;
        
        // Supprimer du tableau
        const index = this.hooks[name].indexOf(callback);
        if (index !== -1) {
            this.hooks[name].splice(index, 1);
            this.hookRegistry.delete(hookId);
            
            // Mettre à jour le registre des namespaces
            const namespaceHooks = this.namespaceRegistry.get(namespace);
            if (namespaceHooks) {
                namespaceHooks.delete(hookId);
                if (namespaceHooks.size === 0) {
                    this.namespaceRegistry.delete(namespace);
                }
            }
            
            this.debug(`Hook supprimé: ${name} (namespace: ${namespace}, ID: ${hookId})`);
            return true;
        }
        
        return false;
    }

    /**
     * Supprime tous les hooks d'un namespace
     */
    removeHooksByNamespace(namespace) {
        const namespaceHooks = this.namespaceRegistry.get(namespace);
        if (!namespaceHooks) return 0;
        
        let count = 0;
        for (const hookId of namespaceHooks) {
            if (this.removeHook(hookId)) {
                count++;
            }
        }
        
        this.debug(`${count} hooks supprimés pour le namespace: ${namespace}`);
        return count;
    }

    /**
     * Supprime tous les hooks d'un type
     */
    removeAllHooks(hookName, namespace = null) {
        if (!this.hooks[hookName]) {
            throw new Error(`Hook inconnu: ${hookName}`);
        }
        
        let count = 0;
        
        if (namespace) {
            // Filtrer par namespace
            const namespaceHooks = this.namespaceRegistry.get(namespace);
            if (namespaceHooks) {
                for (const hookId of namespaceHooks) {
                    const hookInfo = this.hookRegistry.get(hookId);
                    if (hookInfo && hookInfo.name === hookName) {
                        if (this.removeHook(hookId)) {
                            count++;
                        }
                    }
                }
            }
        } else {
            // Supprimer tous les hooks de ce type
            const hooksToRemove = Array.from(this.hookRegistry.entries())
                .filter(([_, info]) => info.name === hookName)
                .map(([id, _]) => id);
                
            for (const hookId of hooksToRemove) {
                if (this.removeHook(hookId)) {
                    count++;
                }
            }
        }
        
        this.debug(`${count} hooks supprimés pour: ${hookName}${namespace ? ` (namespace: ${namespace})` : ''}`);
        return count;
    }

    /**
     * Exécute un hook
     */
    executeHook(hookName, ...args) {
        if (!this.hooks[hookName] || !this.hooks[hookName].length) {
            return true;
        }
        
        for (const callback of this.hooks[hookName]) {
            const result = callback(...args);
            // Si un hook retourne false, arrêter l'exécution
            if (result === false) return false;
        }
        
        return true;
    }

    /**
     * Obtient des informations sur les hooks
     */
    getHooksInfo() {
        const info = {
            namespaces: {},
            hooks: {}
        };
        
        // Info par namespace
        for (const [namespace, hookIds] of this.namespaceRegistry.entries()) {
            info.namespaces[namespace] = {
                count: hookIds.size,
                hooks: Array.from(hookIds).map(id => {
                    const hookInfo = this.hookRegistry.get(id);
                    return `${hookInfo.name} (${id})`;
                })
            };
        }
        
        // Info par type de hook
        Object.keys(this.hooks).forEach(hookName => {
            info.hooks[hookName] = {
                count: this.hooks[hookName].length,
                namespaces: Array.from(this.hookRegistry.values())
                    .filter(info => info.name === hookName)
                    .map(info => info.namespace)
                    .filter((v, i, a) => a.indexOf(v) === i) // unique
            };
        });
        
        return info;
    }

    /**
     * Injecte les styles CSS
     */
    injectStyles() {
        if (document.getElementById('edit-plugin-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'edit-plugin-styles';
        style.textContent = `
            .${this.config.cellClass} {
                cursor: text;
                position: relative;
            }
            
            .${this.config.cellClass}:hover {
                background-color: rgba(0, 0, 0, 0.02);
            }
            
            .${this.config.cellClass}.editing {
                padding: 0 !important;
            }
            
            .${this.config.inputClass} {
                border: 1px solid #3b82f6;
                outline: none;
                background: white;
                color: black;
                font: inherit;
                margin: 0;
                padding: 4px;
                width: 100%;
                box-sizing: border-box;
                min-height: 24px;
            }
            
            .${this.config.inputClass}:focus {
                box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
            }
            
            .${this.config.cellClass}.${this.config.readOnlyClass} {
                cursor: not-allowed;
                opacity: 0.7;
                background-color: #f3f4f6;
            }
            
            tr.${this.config.modifiedClass} {
                background-color: rgba(255, 239, 193, 0.3);
            }
            
            /* Animation pour les changements */
            .${this.config.cellClass}.value-changed {
                animation: valueChanged 0.5s ease-out;
            }
            
            @keyframes valueChanged {
                0% { background-color: rgba(59, 130, 246, 0.3); }
                100% { background-color: transparent; }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Rafraîchit le plugin
     */
    refresh() {
        this.setupEditCells();
    }

    /**
     * Détruit le plugin
     */
/**
    * Détruit le plugin
    */
destroy() {
    // Annuler toute édition en cours
    if (this.state.isEditing) {
        this.cancelEditing();
    }
    
    // Supprimer les gestionnaires d'événements
    if (this.table?.table) {
        this.table.table.removeEventListener('dblclick', this._boundHandlers.dblclick);
        this.table.table.removeEventListener('click', this._boundHandlers.click);
        this.table.table.removeEventListener('cell:saved', this.handleCellSaved);
        this.table.table.removeEventListener('row:saved', this.handleRowSaved);
        this.table.table.removeEventListener('row:added', this.handleRowAdded);
    }
    
    document.removeEventListener('keydown', this._boundHandlers.documentKeydown);
    window.removeEventListener('beforeunload', this._boundHandlers.windowBeforeUnload);
    
    // Nettoyer les cellules
    const editCells = this.table?.table?.querySelectorAll('.' + this.config.cellClass);
    if (editCells) {
        editCells.forEach(cell => {
            cell.removeAttribute('data-edit-initialized');
            cell.removeAttribute('data-plugin');
            cell.removeAttribute('data-column-id');
            cell.classList.remove(this.config.cellClass);
            cell.classList.remove('editing');
        });
    }
    
    // Vider les hooks
    Object.keys(this.hooks).forEach(hookName => {
        this.hooks[hookName] = [];
    });
    
    // Nettoyer les registres
    this.hookRegistry.clear();
    this.namespaceRegistry.clear();
    this._cellCache = new WeakMap();
    
    // Supprimer les styles
    const style = document.getElementById('edit-plugin-styles');
    if (style) {
        style.remove();
    }
    
    this.debug('Plugin Edit détruit');
}

/**
 * API Publique
 */

/**
 * Démarre l'édition programmatiquement
 * @param {HTMLElement|string} cellOrId - Cellule ou ID de cellule
 */
edit(cellOrId) {
    let cell;
    
    if (typeof cellOrId === 'string') {
        cell = this.table.table.querySelector(`#${cellOrId}`);
    } else if (cellOrId instanceof HTMLElement) {
        cell = cellOrId;
    }
    
    if (this.isEditableCell(cell)) {
        this.startEditing(cell);
        return true;
    }
    
    return false;
}

/**
 * Arrête l'édition en cours
 * @param {boolean} save - Si true, sauvegarde les modifications
 */
stopEditing(save = true) {
    if (!this.state.isEditing) return false;
    
    if (save) {
        this.finishEditing();
    } else {
        this.cancelEditing();
    }
    
    return true;
}

/**
 * Obtient la cellule en cours d'édition
 * @returns {HTMLElement|null}
 */
getCurrentEditCell() {
    return this.state.currentCell;
}

/**
 * Vérifie si une cellule est en cours d'édition
 * @param {HTMLElement} [cell] - Cellule spécifique à vérifier
 * @returns {boolean}
 */
isEditing(cell = null) {
    if (cell) {
        return this.state.isEditing && this.state.currentCell === cell;
    }
    return this.state.isEditing;
}

/**
 * Définit la valeur d'une cellule
 * @param {HTMLElement|string} cellOrId - Cellule ou ID
 * @param {string} value - Nouvelle valeur
 * @param {boolean} triggerChange - Si true, déclenche l'événement change
 */
setValue(cellOrId, value, triggerChange = true) {
    let cell;
    
    if (typeof cellOrId === 'string') {
        cell = this.table.table.querySelector(`#${cellOrId}`);
    } else if (cellOrId instanceof HTMLElement) {
        cell = cellOrId;
    }
    
    if (!cell || !cell.classList.contains(this.config.cellClass)) {
        return false;
    }
    
    const oldValue = cell.getAttribute('data-value');
    cell.setAttribute('data-value', value);
    
    this.renderCell(cell, value);
    this.updateRowModifiedState(cell, value);
    
    if (triggerChange) {
        this.triggerChangeEvent(cell, value, oldValue);
    }
    
    return true;
}

/**
 * Obtient la valeur d'une cellule
 * @param {HTMLElement|string} cellOrId - Cellule ou ID
 * @returns {string|null}
 */
getValue(cellOrId) {
    let cell;
    
    if (typeof cellOrId === 'string') {
        cell = this.table.table.querySelector(`#${cellOrId}`);
    } else if (cellOrId instanceof HTMLElement) {
        cell = cellOrId;
    }
    
    if (!cell || !cell.classList.contains(this.config.cellClass)) {
        return null;
    }
    
    return cell.getAttribute('data-value');
}

/**
 * Réinitialise une cellule à sa valeur initiale
 * @param {HTMLElement|string} cellOrId - Cellule ou ID
 */
resetValue(cellOrId) {
    let cell;
    
    if (typeof cellOrId === 'string') {
        cell = this.table.table.querySelector(`#${cellOrId}`);
    } else if (cellOrId instanceof HTMLElement) {
        cell = cellOrId;
    }
    
    if (!cell || !cell.classList.contains(this.config.cellClass)) {
        return false;
    }
    
    const initialValue = cell.getAttribute('data-initial-value');
    return this.setValue(cell, initialValue);
}

/**
 * Active/désactive l'édition pour une cellule
 * @param {HTMLElement|string} cellOrId - Cellule ou ID
 * @param {boolean} enabled - Si true, active l'édition
 */
setEditable(cellOrId, enabled) {
    let cell;
    
    if (typeof cellOrId === 'string') {
        cell = this.table.table.querySelector(`#${cellOrId}`);
    } else if (cellOrId instanceof HTMLElement) {
        cell = cellOrId;
    }
    
    if (!cell || !cell.classList.contains(this.config.cellClass)) {
        return false;
    }
    
    if (enabled) {
        cell.classList.remove(this.config.readOnlyClass);
    } else {
        cell.classList.add(this.config.readOnlyClass);
        // Si la cellule est en cours d'édition, l'annuler
        if (this.isEditing(cell)) {
            this.cancelEditing();
        }
    }
    
    return true;
}

/**
 * Définit un validateur personnalisé pour une colonne
 * @param {string} columnId - ID de la colonne
 * @param {Function} validator - Fonction de validation
 */
setColumnValidator(columnId, validator) {
    if (typeof validator !== 'function') {
        throw new Error('Le validateur doit être une fonction');
    }
    
    // Ajouter un hook beforeSave pour cette colonne
    this.addHook('beforeSave', (cell, newValue, oldValue) => {
        const cellColumnId = this._cellCache.get(cell)?.columnId;
        if (cellColumnId === columnId) {
            const result = validator(newValue, oldValue, cell);
            if (result !== true) {
                if (typeof result === 'string') {
                    alert(result);
                }
                return false;
            }
        }
        return true;
    }, `validator_${columnId}`);
}

/**
 * Obtient toutes les cellules modifiées
 * @returns {Array<{cell: HTMLElement, value: string, initialValue: string}>}
 */
getModifiedCells() {
    const modifiedCells = [];
    const cells = this.table.table.querySelectorAll('.' + this.config.cellClass);
    
    cells.forEach(cell => {
        const value = cell.getAttribute('data-value');
        const initialValue = cell.getAttribute('data-initial-value');
        
        if (value !== initialValue) {
            modifiedCells.push({
                cell,
                value,
                initialValue,
                columnId: this._cellCache.get(cell)?.columnId,
                rowId: cell.closest('tr')?.id
            });
        }
    });
    
    return modifiedCells;
}

/**
 * Réinitialise toutes les cellules modifiées
 */
resetAllModified() {
    const modifiedCells = this.getModifiedCells();
    
    modifiedCells.forEach(({cell}) => {
        this.resetValue(cell);
    });
    
    // Nettoyer les classes modified des lignes
    const modifiedRows = this.table.table.querySelectorAll(`tr.${this.config.modifiedClass}`);
    modifiedRows.forEach(row => {
        row.classList.remove(this.config.modifiedClass);
    });
}

/**
 * Exporte la configuration actuelle
 * @returns {Object}
 */
exportConfig() {
    return {
        ...this.config,
        hooks: Object.keys(this.hooks).reduce((acc, hookName) => {
            acc[hookName] = this.hooks[hookName].length;
            return acc;
        }, {})
    };
}

/**
 * Importe une configuration
 * @param {Object} config - Configuration à importer
 */
importConfig(config) {
    // Sauvegarder les hooks actuels
    const currentHooks = { ...this.hooks };
    
    // Mettre à jour la configuration
    this.config = {
        ...this.config,
        ...config
    };
    
    // Restaurer les hooks
    this.hooks = currentHooks;
    
    // Réappliquer les styles et configurations
    this.refresh();
}

/**
 * Active/désactive le mode debug
 * @param {boolean} enabled
 */
setDebug(enabled) {
    this.config.debug = enabled;
    this.debug = enabled ? 
        (...args) => console.log('[EditPlugin]', ...args) : 
        () => {};
}

/**
 * Obtient des statistiques sur l'utilisation
 * @returns {Object}
 */
getStats() {
    const stats = {
        totalEditableCells: 0,
        modifiedCells: 0,
        readOnlyCells: 0,
        currentlyEditing: this.state.isEditing,
        hooksRegistered: this.hookRegistry.size,
        namespaces: this.namespaceRegistry.size
    };
    
    const cells = this.table.table.querySelectorAll('.' + this.config.cellClass);
    stats.totalEditableCells = cells.length;
    
    cells.forEach(cell => {
        if (cell.classList.contains(this.config.readOnlyClass)) {
            stats.readOnlyCells++;
        }
        
        const value = cell.getAttribute('data-value');
        const initialValue = cell.getAttribute('data-initial-value');
        if (value !== initialValue) {
            stats.modifiedCells++;
        }
    });
    
    return stats;
}
}