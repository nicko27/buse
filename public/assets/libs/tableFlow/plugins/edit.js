import { DOMSanitizer } from '../src/domSanitizer.js';

/**
 * EditPlugin - Gestion de l'édition en ligne pour TableFlow
 * 
 * @version 2.1.0
 */
export default class EditPlugin {
    constructor(config = {}) {
        this.name = 'edit';
        this.version = '2.1.0';
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
            onRender: []       // Lors du rendu du contenu
        };
        
        // Map pour stocker les hooks avec leurs IDs uniques et namespaces
        this.hookRegistry = new Map();
        this.hookIdCounter = 0;
        this.namespaceRegistry = new Map(); // Nouveau: registre des namespaces
        
        // Configuration de base
        this.config = {
            editAttribute: 'th-edit',
            cellClass: 'td-edit',
            readOnlyClass: 'readonly',
            inputClass: 'edit-input',
            modifiedClass: 'modified',
            doubleClickDelay: 300, // Délai pour le double-clic
            autoSelectOnEdit: true, // Sélectionner automatiquement le texte
            allowEmptyValue: true, // Permettre les valeurs vides
            trimValues: true, // Supprimer les espaces en début/fin
            debug: false
        };
        
        // Fusion avec la config fournie
        Object.assign(this.config, config);
        
        this.debug = this.config.debug ? 
            (...args) => console.log('[EditPlugin]', ...args) : 
            () => {};
            
        // Stockage des handlers d'événements pour le nettoyage
        this._eventHandlers = new Map();
        this._cellHandlers = new WeakMap();
    }

    init(tableHandler) {
        if (!tableHandler) {
            throw new Error('TableHandler instance is required');
        }
        this.table = tableHandler;
        
        // Configuration des cellules éditables
        this.setupEditCells();
        
        // Configuration des événements
        this.setupEventListeners();
        
        this.debug('Plugin initialized');
    }

    setupEditCells() {
        if (!this.table || !this.table.table) return;

        const headerCells = this.table.table.querySelectorAll('th');
        const editColumns = Array.from(headerCells)
            .filter(header => header.hasAttribute(this.config.editAttribute))
            .map(header => ({
                id: header.id,
                index: Array.from(headerCells).indexOf(header)
            }));

        if (!editColumns.length) {
            this.debug('No editable columns found');
            return;
        }

        const rows = this.table.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            editColumns.forEach(({id: columnId, index}) => {
                const cell = row.cells[index];
                if (!cell) return;

                // Ne pas réinitialiser si la cellule est déjà gérée par un autre plugin
                if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'edit') {
                    return;
                }

                cell.classList.add(this.config.cellClass);
                cell.setAttribute('data-plugin', 'edit');

                // Ajouter le gestionnaire de double-clic s'il n'existe pas déjà
                if (!cell.hasAttribute('data-edit-initialized')) {
                    const dblClickHandler = (e) => this.startEditing(e);
                    cell.addEventListener('dblclick', dblClickHandler);
                    cell.setAttribute('data-edit-initialized', 'true');
                    
                    // Stocker le handler pour pouvoir le supprimer plus tard
                    this._cellHandlers.set(cell, dblClickHandler);
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
                
                // Point d'extension pour le rendu
                this.executeHook('onRender', cell, currentValue);
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
        const cellSavedHandler = (event) => {
            this.debug('cell:saved event received', event.detail);
            const cell = event.detail.cell;
            if (!cell || !cell.classList.contains(this.config.cellClass)) {
                this.debug('Cell not managed by edit plugin');
                return;
            }

            const currentValue = event.detail.value;
            cell.setAttribute('data-initial-value', currentValue);
            cell.setAttribute('data-value', currentValue);
            
            const wrapper = cell.querySelector('.cell-wrapper');
            
            // Utiliser le hook onRender pour le rendu personnalisé
            const renderResult = this.executeHook('onRender', cell, currentValue);
            
            if (wrapper) {
                // Si un hook a géré le rendu, on ne fait rien
                if (renderResult !== false) {
                    DOMSanitizer.setHTML(wrapper, currentValue, { isPlainText: true });
                }
            } else {
                if (renderResult !== false) {
                    DOMSanitizer.setHTML(cell, currentValue, { isPlainText: true });
                }
                if (this.table.initializeWrappers) {
                    this.table.initializeWrappers();
                }
            }
        };
        
        this.table.table.addEventListener('cell:saved', cellSavedHandler);
        this._eventHandlers.set('cell:saved', cellSavedHandler);

        // Écouter l'événement row:saved
        const rowSavedHandler = (event) => {
            this.debug('row:saved event received');
            const row = event.detail.row;
            if (!row) return;

            // Vérifier et mettre à jour toutes les cellules edit de la ligne
            Array.from(row.cells).forEach((cell) => {
                if (!cell.classList.contains(this.config.cellClass)) return;

                const currentValue = cell.getAttribute('data-value');
                
                // Mettre à jour la valeur initiale
                cell.setAttribute('data-initial-value', currentValue);

                const wrapper = cell.querySelector('.cell-wrapper');
                
                // Utiliser le hook onRender pour le rendu personnalisé
                const renderResult = this.executeHook('onRender', cell, currentValue);
                
                if (wrapper) {
                    if (renderResult !== false) {
                        DOMSanitizer.setHTML(wrapper, currentValue, { isPlainText: true });
                    }
                } else {
                    if (renderResult !== false) {
                        DOMSanitizer.setHTML(cell, currentValue, { isPlainText: true });
                    }
                    if (this.table.initializeWrappers) {
                        this.table.initializeWrappers();
                    }
                }
            });
        };
        
        this.table.table.addEventListener('row:saved', rowSavedHandler);
        this._eventHandlers.set('row:saved', rowSavedHandler);

        // Écouter l'ajout de nouvelles lignes
        const rowAddedHandler = () => {
            this.debug('row:added event received');
            this.setupEditCells();
        };
        
        this.table.table.addEventListener('row:added', rowAddedHandler);
        this._eventHandlers.set('row:added', rowAddedHandler);
    }

    startEditing(event) {
        const cell = event.target.closest('td');
        if (!cell || cell.querySelector('input')) return;

        // Vérifier si la cellule est bien gérée par ce plugin
        if (cell.getAttribute('data-plugin') !== 'edit') {
            return;
        }

        // Vérifier si la cellule est en lecture seule
        if (cell.classList.contains(this.config.readOnlyClass)) {
            return;
        }

        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        const currentValue = cell.getAttribute('data-value') || wrapper.textContent.trim();
        
        // Point d'extension important - permettre aux plugins d'empêcher l'édition
        if (this.executeHook('beforeEdit', cell, currentValue) === false) {
            this.debug('Editing prevented by a hook');
            return;
        }
        
        // Créer le champ d'édition
        this.createEditField(cell, wrapper, currentValue);
    }

    createEditField(cell, wrapper, currentValue) {
        // Créer un input standard
        const input = document.createElement('input');
        input.type = 'text';
        input.className = this.config.inputClass;
        input.value = currentValue;
        
        // Vider le wrapper et ajouter l'input
        wrapper.innerHTML = '';
        wrapper.appendChild(input);
        
        // Focus et sélection
        input.focus();
        if (this.config.autoSelectOnEdit) {
            input.select();
        }
        
        // Ajout des événements de base
        const blurHandler = () => this.finishEditing(cell, input);
        const keydownHandler = (e) => this.handleKeydown(e, cell, input);
        
        input.addEventListener('blur', blurHandler);
        input.addEventListener('keydown', keydownHandler);
        
        // Stocker les handlers pour le nettoyage
        input._editBlurHandler = blurHandler;
        input._editKeydownHandler = keydownHandler;
        
        // Point d'extension après création du champ d'édition
        this.executeHook('afterEdit', cell, input, currentValue);
        
        return input;
    }

    handleKeydown(event, cell, input) {
        // Point d'extension pour le plugin clavier
        if (this.executeHook('onKeydown', event, cell, input) === false) {
            return;
        }
        
        // Gestion standard des touches
        if (event.key === 'Enter') {
            this.finishEditing(cell, input);
            event.preventDefault();
        } else if (event.key === 'Escape') {
            this.cancelEditing(cell);
            event.preventDefault();
        }
    }

    finishEditing(cell, input) {
        let newValue = input.value;
        
        // Appliquer le trimming si configuré
        if (this.config.trimValues) {
            newValue = newValue.trim();
        }
        
        // Vérifier si la valeur vide est autorisée
        if (!this.config.allowEmptyValue && newValue === '') {
            this.cancelEditing(cell);
            return;
        }
        
        const oldValue = cell.getAttribute('data-value');
        
        // Point d'extension avant sauvegarde
        if (this.executeHook('beforeSave', cell, newValue, oldValue) === false) {
            this.debug('Save prevented by a hook');
            this.cancelEditing(cell);
            return;
        }
        
        // Mise à jour de la valeur
        cell.setAttribute('data-value', newValue);
        
        // Mise à jour du contenu
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        
        // Utiliser le hook onRender pour personnaliser le rendu
        const renderResult = this.executeHook('onRender', cell, newValue);
        
        if (renderResult !== false) {
            if (wrapper === cell) {
                DOMSanitizer.setHTML(cell, newValue, { isPlainText: true });
                if (this.table.initializeWrappers) {
                    this.table.initializeWrappers();
                }
            } else {
                DOMSanitizer.setHTML(wrapper, newValue, { isPlainText: true });
            }
        }
        
        // Marquer la ligne comme modifiée si la valeur a changé
        const row = cell.closest('tr');
        const initialValue = cell.getAttribute('data-initial-value');
        if (newValue !== initialValue && row) {
            row.classList.add(this.config.modifiedClass);
        }
        
        // Déclencher l'événement de changement
        this.triggerChangeEvent(cell, newValue, oldValue);
        
        // Point d'extension après sauvegarde
        this.executeHook('afterSave', cell, newValue, oldValue);
    }

    cancelEditing(cell) {
        const originalValue = cell.getAttribute('data-value');
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        
        // Utiliser le hook onRender pour le rendu personnalisé
        const renderResult = this.executeHook('onRender', cell, originalValue);
        
        if (renderResult !== false) {
            DOMSanitizer.setHTML(wrapper, originalValue, { isPlainText: true });
        }
    }

    triggerChangeEvent(cell, newValue, oldValue) {
        const row = cell.closest('tr');
        const changeEvent = new CustomEvent('cell:change', {
            detail: {
                cellId: cell.id,
                columnId: cell.id.split('_')[0],
                rowId: row ? row.id : null,
                value: newValue,
                oldValue: oldValue,
                cell: cell,
                source: 'edit',
                tableId: this.table.table.id
            },
            bubbles: false
        });
        
        this.table.table.dispatchEvent(changeEvent);
    }

    /**
     * Ajoute un hook avec un namespace et un identifiant unique
     * @param {string} hookName - Nom du hook
     * @param {Function} callback - Fonction callback
     * @param {string} [namespace] - Namespace optionnel
     * @returns {string} - ID du hook pour suppression ultérieure
     */
    addHook(hookName, callback, namespace = 'default') {
        if (!this.hooks[hookName]) {
            throw new Error(`Hook inconnu: ${hookName}`);
        }
        
        // Générer un ID unique pour ce hook
        const hookId = `${namespace}_${hookName}_${++this.hookIdCounter}`;
        
        // Créer un wrapper qui inclut le namespace
        const wrappedCallback = (...args) => {
            try {
                return callback.apply(null, args);
            } catch (error) {
                console.error(`Error in hook ${hookName} (namespace: ${namespace}):`, error);
                // Ne pas propager l'erreur pour éviter de casser le flux
                return undefined;
            }
        };
        
        // Stocker le callback avec son ID et namespace
        this.hooks[hookName].push(wrappedCallback);
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
     * Supprime un hook spécifique par son ID
     * @param {string} hookId - ID du hook à supprimer
     * @returns {boolean} - true si supprimé, false sinon
     */
    removeHook(hookId) {
        const hookInfo = this.hookRegistry.get(hookId);
        
        if (!hookInfo) {
            this.debug(`Hook non trouvé: ${hookId}`);
            return false;
        }
        
        const { name, callback, namespace } = hookInfo;
        
        // Trouver et supprimer le callback du tableau
        const index = this.hooks[name].indexOf(callback);
        if (index !== -1) {
            this.hooks[name].splice(index, 1);
            this.hookRegistry.delete(hookId);
            
            // Retirer du registre des namespaces
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
     * Supprime tous les hooks d'un namespace donné
     * @param {string} namespace - Namespace des hooks à supprimer
     * @returns {number} - Nombre de hooks supprimés
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
     * Supprime tous les hooks d'un type donné
     * @param {string} hookName - Nom du hook
     * @param {string} [namespace] - Namespace optionnel
     * @returns {number} - Nombre de hooks supprimés
     */
    removeAllHooks(hookName, namespace = null) {
        if (!this.hooks[hookName]) {
            throw new Error(`Hook inconnu: ${hookName}`);
        }
        
        let count = 0;
        
        // Si un namespace est spécifié, filtrer par namespace
        if (namespace) {
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
            // Sinon, supprimer tous les hooks de ce type
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
     * Exécute tous les callbacks d'un hook
     * @param {string} hookName - Nom du hook
     * @param {...any} args - Arguments à passer aux callbacks
     * @returns {boolean} - true sauf si un callback retourne false
     */
    executeHook(hookName, ...args) {
        if (!this.hooks[hookName] || !this.hooks[hookName].length) {
            return true;
        }
        
        for (const callback of this.hooks[hookName]) {
            try {
                const result = callback(...args);
                // Si un hook retourne explicitement false, on arrête l'exécution
                if (result === false) return false;
            } catch (error) {
                console.error(`Error executing hook ${hookName}:`, error);
            }
        }
        
        return true;
    }

    /**
     * Liste tous les hooks enregistrés
     * @returns {Object} - État actuel des hooks
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

    refresh() {
        this.setupEditCells();
    }

    destroy() {
        // Nettoyage des événements et des références
        if (this.table?.table) {
            // Supprimer les gestionnaires d'événements globaux
            this._eventHandlers.forEach((handler, eventName) => {
                this.table.table.removeEventListener(eventName, handler);
            });
            this._eventHandlers.clear();
            
            // Supprimer les gestionnaires de double-clic des cellules
            const editCells = this.table.table.querySelectorAll('.' + this.config.cellClass);
            editCells.forEach(cell => {
                const handler = this._cellHandlers.get(cell);
                if (handler) {
                    cell.removeEventListener('dblclick', handler);
                    cell.removeAttribute('data-edit-initialized');
                }
            });
            this._cellHandlers = new WeakMap();
        }
        
        // Vider tous les hooks
        Object.keys(this.hooks).forEach(hookName => {
            this.hooks[hookName] = [];
        });
        
        // Nettoyer les registres
        this.hookRegistry.clear();
        this.namespaceRegistry.clear();
        
        this.debug('Plugin détruit');
    }
}