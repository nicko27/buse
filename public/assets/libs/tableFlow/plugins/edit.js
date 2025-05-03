/**
 * Plugin Edit pour TableFlow
 * Permet l'édition en ligne des cellules par double-clic.
 * Fournit un système de hooks pour l'extension par d'autres plugins (Validation, Highlight, TextEditor, etc.).
 * C'est un plugin central pour de nombreuses fonctionnalités interactives.
 *
 * @class EditPlugin
 * @version 2.0.2 - Intégration TableInstance, implémentation hooks
 */
export default class EditPlugin {
    /**
     * Crée une instance de EditPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'edit';
        this.version = '2.0.2';
        this.type = 'edit'; // Type de plugin: gère l'édition
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (aucunes directes) */
        this.dependencies = [];

        /**
         * Système de hooks pour permettre l'extension par d'autres plugins.
         * Clé: Nom du hook. Valeur: Tableau d'objets { callback: Function, namespace: string|null }.
         * @type {object.<string, Array<{callback: Function, namespace: string|null}>>}
         */
        this.hooks = {
            beforeEdit: [],    // (cell, currentValue) => boolean | void - Avant de commencer l'édition. Retourner false pour annuler.
            afterEdit: [],     // (cell, inputElement, currentValue) => void - Après avoir créé le champ d'édition.
            beforeSave: [],    // (cell, newValue, oldValue) => boolean | void - Avant d'enregistrer les modifications. Retourner false pour annuler.
            afterSave: [],     // (cell, newValue, oldValue) => void - Après l'enregistrement réussi.
            onKeydown: [],     // (event, cell, inputElement) => boolean | void - Lors d'un événement keydown dans l'input. Retourner false pour empêcher le traitement par défaut (Entrée/Echap).
            onRender: []       // (cell, value) => boolean | void - Permet de personnaliser le rendu de la cellule. Retourner false pour empêcher le rendu par défaut.
        };

        // Configuration par défaut fusionnée avec celle fournie
        this.config = {
            editAttribute: 'th-edit',       // Attribut HTML sur <th> pour activer l'édition
            cellClass: 'td-edit',           // Classe CSS ajoutée aux <td> éditables
            readOnlyClass: 'readonly',      // Classe CSS pour marquer une cellule comme non éditable
            inputClass: 'edit-input',       // Classe CSS pour l'élément <input> créé
            modifiedClass: 'modified',      // Classe CSS pour marquer une ligne modifiée
            debug: false,                   // Activer les logs de débogage
            ...config
        };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[EditPlugin ${this.table?.tableId}]`, ...args) ?? console.debug('[EditPlugin]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Lier les méthodes pour préserver le contexte 'this' dans les listeners et handlers
        this._handleDblClick = this._handleDblClick.bind(this);
        this._handleCellSaved = this._handleCellSaved.bind(this);
        this._handleRowSaved = this._handleRowSaved.bind(this);
        this._handleRowAdded = this._handleRowAdded.bind(this);
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('EditPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Edit avec la configuration:', this.config);

        // Configurer les cellules éditables existantes
        this.setupEditCells();

        // Attacher les écouteurs d'événements système
        this.setupEventListeners();

        this.debug('Plugin Edit initialisé.');
    }

    /**
     * Configure les cellules <td> pour les colonnes marquées comme éditables.
     * Ajoute les classes et les écouteurs de double-clic.
     * @param {HTMLTableRowElement} [specificRow=null] - Si fourni, configure uniquement cette ligne.
     */
    setupEditCells(specificRow = null) {
        if (!this.table?.element) return;
        this.debug(`Configuration des cellules éditables pour ${specificRow ? `la ligne ${specificRow.id}` : 'toutes les lignes'}...`);

        const headerCells = this.table.element.querySelectorAll(`thead th[${this.config.editAttribute}]`);
        if (!headerCells.length) {
            this.debug("Aucune colonne éditable trouvée via [th-edit].");
            return;
        }

        const rowsToProcess = specificRow ? [specificRow] : this.table.getAllRows(); // Utilise la méthode de l'instance

        headerCells.forEach(headerCell => {
            const columnIndex = headerCell.cellIndex;
            if (columnIndex === -1) {
                 this.logger.warn(`Index de colonne invalide pour l'en-tête éditable ${headerCell.id || 'inconnu'}`);
                 return;
            }
            const columnId = headerCell.id; // Récupérer l'ID de la colonne

            rowsToProcess.forEach(row => {
                const cell = row.cells[columnIndex];
                if (!cell) {
                    this.logger.warn(`Cellule manquante à l'index ${columnIndex} pour la ligne ${row.id}`);
                    return;
                }

                // Vérifier si un plugin plus spécifique gère déjà la cellule
                const existingPlugin = cell.getAttribute('data-plugin');
                if (existingPlugin && existingPlugin !== 'edit') {
                    this.debug(`Cellule ${cell.id} gérée par '${existingPlugin}', EditPlugin n'ajoute que la classe.`);
                    // Ajouter la classe pour que les hooks puissent potentiellement agir
                    cell.classList.add(this.config.cellClass);
                    return; // Ne pas ajouter l'écouteur de double-clic
                }

                // Marquer comme géré par Edit (ou confirmer)
                cell.setAttribute('data-plugin', 'edit');
                cell.classList.add(this.config.cellClass);

                // Ajouter l'écouteur de double-clic s'il n'existe pas déjà
                // Vérifier aussi si le handler est déjà attaché pour éviter doublons lors de refresh partiels
                if (!cell.hasAttribute('data-edit-initialized') || !cell._editDblClickHandler) {
                    // Supprimer l'ancien listener au cas où avant d'ajouter le nouveau
                    if (cell._editDblClickHandler) {
                         cell.removeEventListener('dblclick', cell._editDblClickHandler);
                    }
                    cell.addEventListener('dblclick', this._handleDblClick);
                    cell._editDblClickHandler = this._handleDblClick; // Stocker la référence
                    cell.setAttribute('data-edit-initialized', 'true');
                    this.debug(`Écouteur dblclick ajouté/mis à jour pour ${cell.id}`);
                }

                // Récupérer/Initialiser les valeurs data-*
                let currentValue = cell.hasAttribute('data-value')
                    ? cell.getAttribute('data-value') ?? '' // Utiliser chaîne vide si attribut vide
                    : cell.textContent?.trim() ?? '';
                cell.setAttribute('data-value', currentValue);
                if (!cell.hasAttribute('data-initial-value')) {
                    cell.setAttribute('data-initial-value', currentValue);
                }

                // Appeler le hook onRender pour l'affichage initial
                this.executeHook('onRender', cell, currentValue);
            });
        });
        this.debug("Configuration des cellules éditables terminée.");
    }

    /**
     * Attache les écouteurs d'événements système de TableFlow.
     */
    setupEventListeners() {
        if (!this.table?.element) return;
        this.debug('Configuration des écouteurs d\'événements système pour Edit...');

        // Nettoyer les anciens listeners avant d'ajouter (sécurité pour refresh)
        this.table.element.removeEventListener('cell:saved', this._handleCellSaved);
        this.table.element.removeEventListener('row:saved', this._handleRowSaved);
        this.table.element.removeEventListener('row:added', this._handleRowAdded);

        // Ajouter les nouveaux listeners
        this.table.element.addEventListener('cell:saved', this._handleCellSaved);
        this.table.element.addEventListener('row:saved', this._handleRowSaved);
        this.table.element.addEventListener('row:added', this._handleRowAdded);

        this.debug('Écouteurs d\'événements système Edit configurés.');
    }

    /**
     * Gestionnaire pour l'événement 'cell:saved'. Met à jour la valeur initiale et l'affichage.
     * @param {CustomEvent} event
     * @private
     */
    _handleCellSaved(event) {
        const cell = event.detail?.cell;
        if (!cell || !this.isManagedCell(cell)) return; // Vérifie si c'est une cellule gérée par Edit

        const currentValue = event.detail?.value ?? cell.getAttribute('data-value');
        cell.setAttribute('data-initial-value', currentValue);
        this.debug(`Valeur initiale mise à jour pour ${cell.id} après sauvegarde: ${currentValue}`);

        // Mettre à jour l'affichage via le hook onRender
        const renderHookResult = this.executeHook('onRender', cell, currentValue);
        if (renderHookResult !== false) {
            this.updateCellDisplay(cell, currentValue);
        }
    }

    /**
     * Gestionnaire pour l'événement 'row:saved'. Met à jour les valeurs initiales de la ligne.
     * @param {CustomEvent} event
     * @private
     */
    _handleRowSaved(event) {
        const row = event.detail?.row;
        if (!row) return;
        this.debug(`Gestion de row:saved pour les cellules Edit de la ligne ${row.id}`);

        Array.from(row.cells).forEach(cell => {
            if (this.isManagedCell(cell)) {
                const currentValue = cell.getAttribute('data-value');
                cell.setAttribute('data-initial-value', currentValue);
                // Mettre à jour l'affichage via onRender
                 const renderHookResult = this.executeHook('onRender', cell, currentValue);
                 if (renderHookResult !== false) {
                     this.updateCellDisplay(cell, currentValue);
                 }
            }
        });
    }

    /**
     * Gestionnaire pour l'événement 'row:added'. Configure la nouvelle ligne.
     * @param {CustomEvent} event
     * @private
     */
    _handleRowAdded(event) {
        const row = event.detail?.row;
        if (!row) return;
        this.debug(`Gestion de row:added pour la nouvelle ligne Edit ${row.id}`);
        this.setupEditCells(row); // Configure uniquement la nouvelle ligne
    }

    /**
     * Gestionnaire pour l'événement double-clic sur une cellule éditable.
     * @param {MouseEvent} event - L'événement double-clic.
     * @private
     */
    _handleDblClick(event) {
        // currentTarget est la cellule où le listener est attaché
        const cell = /** @type {HTMLTableCellElement} */ (event.currentTarget);
        this.startEditing(cell);
    }

    /**
     * Démarre le processus d'édition pour une cellule.
     * @param {HTMLTableCellElement} cell - La cellule <td> à éditer.
     */
    startEditing(cell) {
        // Vérifications préliminaires
        if (!cell || !this.isManagedCell(cell)) {
            this.debug("Tentative d'édition sur une cellule non gérée ou invalide.");
            return;
        }
        if (cell.querySelector(`.${this.config.inputClass}`)) {
            this.debug(`Cellule ${cell.id} déjà en cours d'édition.`);
            return;
        }
        if (cell.classList.contains(this.config.readOnlyClass)) {
            this.debug(`Tentative d'édition sur cellule readonly ${cell.id}.`);
            return;
        }

        // Utiliser le wrapper s'il existe
        const wrapperClass = this.table?.config?.wrapCellClass || 'cell-wrapper';
        const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;
        const currentValue = cell.getAttribute('data-value') ?? wrapper.textContent?.trim() ?? '';

        this.debug(`Début de l'édition pour ${cell.id}, valeur actuelle: "${currentValue}"`);

        // --- Hook: beforeEdit ---
        if (this.executeHook('beforeEdit', cell, currentValue) === false) {
            this.debug('Édition annulée par le hook beforeEdit.');
            return;
        }

        // Créer et configurer le champ d'édition
        this.createEditField(cell, wrapper, currentValue);
    }

    /**
     * Crée et insère l'élément <input> pour l'édition.
     * @param {HTMLTableCellElement} cell - La cellule <td>.
     * @param {HTMLElement} wrapper - L'élément (wrapper ou cellule) contenant le contenu actuel.
     * @param {string} currentValue - La valeur actuelle à mettre dans l'input.
     */
    createEditField(cell, wrapper, currentValue) {
        // Créer l'input
        const input = document.createElement('input');
        input.type = 'text'; // Type par défaut
        input.className = this.config.inputClass;
        input.value = currentValue;
        input.setAttribute('aria-label', `Éditer ${cell.id}`);

        // Remplacer le contenu du wrapper par l'input
        wrapper.innerHTML = '';
        wrapper.appendChild(input);

        // Focus et sélection du contenu
        // Utiliser requestAnimationFrame pour s'assurer que l'élément est dans le DOM et visible
        requestAnimationFrame(() => {
            input.focus();
            try { input.select(); } catch(e) { /* Ignorer erreur potentielle sur select */ }
        });


        // Attacher les gestionnaires d'événements à l'input
        // Utiliser des fonctions nommées ou liées pour pouvoir les supprimer
        const blurHandler = () => this.finishEditing(cell, input);
        const keydownHandler = (e) => this.handleKeydown(e, cell, input);

        input.addEventListener('blur', blurHandler);
        input.addEventListener('keydown', keydownHandler);

        // Stocker les handlers pour pouvoir les supprimer proprement
        input._editBlurHandler = blurHandler;
        input._editKeydownHandler = keydownHandler;

        // --- Hook: afterEdit ---
        // Permet aux plugins (Validation, Highlight) de modifier l'input
        this.executeHook('afterEdit', cell, input, currentValue);

        this.debug(`Champ d'édition créé pour ${cell.id}`);
    }

    /**
     * Gestionnaire pour les événements keydown dans l'input d'édition.
     * @param {KeyboardEvent} event - L'événement keydown.
     * @param {HTMLTableCellElement} cell - La cellule en cours d'édition.
     * @param {HTMLInputElement} input - L'élément input.
     */
    handleKeydown(event, cell, input) {
        // --- Hook: onKeydown ---
        // Permet à TextEditor d'intercepter des raccourcis
        if (this.executeHook('onKeydown', event, cell, input) === false) {
            this.debug(`Keydown ${event.key} géré par un hook pour ${cell.id}.`);
            event.preventDefault();
            return;
        }

        // Gestion par défaut pour Entrée et Echap
        switch (event.key) {
            case 'Enter':
                this.debug(`Touche Entrée détectée pour ${cell.id}, fin de l'édition.`);
                event.preventDefault();
                input.blur(); // Forcer le blur déclenche finishEditing
                break;
            case 'Escape':
                this.debug(`Touche Echap détectée pour ${cell.id}, annulation de l'édition.`);
                event.preventDefault();
                this.cancelEditing(cell, input); // Annuler explicitement
                break;
        }
    }

    /**
     * Termine le processus d'édition, valide (via hook) et sauvegarde la nouvelle valeur.
     * @param {HTMLTableCellElement} cell - La cellule <td>.
     * @param {HTMLInputElement} input - L'élément <input> contenant la nouvelle valeur.
     */
    finishEditing(cell, input) {
        // Vérifier si l'input est toujours dans le DOM (évite exécution après cancelEditing)
        if (!input.isConnected) {
            this.debug(`finishEditing appelé sur un input non connecté pour ${cell.id}. Ignoré.`);
            return;
        }

        const newValue = input.value; // Obtenir la valeur actuelle de l'input
        const oldValue = cell.getAttribute('data-value'); // Valeur avant le début de cette session d'édition
        this.debug(`Fin de l'édition pour ${cell.id}. Nouvelle valeur: "${newValue}", Ancienne valeur: "${oldValue}"`);

        // --- Hook: beforeSave ---
        // Permet à ValidationPlugin d'intervenir.
        if (this.executeHook('beforeSave', cell, newValue, oldValue) === false) {
            this.debug('Sauvegarde annulée par le hook beforeSave.');
            // Le hook (Validation) est responsable de l'UI d'erreur et potentiellement du focus.
            // On ne restaure PAS l'ancienne valeur ici pour laisser l'utilisateur corriger.
            return;
        }

        // Sauvegarde validée, procéder à la mise à jour
        this.debug(`Sauvegarde validée pour ${cell.id}.`);
        cell.setAttribute('data-value', newValue); // Mettre à jour la valeur sémantique

        // Mettre à jour l'affichage de la cellule via le hook onRender ou la méthode par défaut
        const renderHookResult = this.executeHook('onRender', cell, newValue);
        if (renderHookResult !== false) {
            this.updateCellDisplay(cell, newValue);
        }

        // Nettoyer les listeners de l'input AVANT de potentiellement le retirer du DOM (via updateCellDisplay/onRender)
        this.removeInputListeners(input);
        // Le wrapper est mis à jour par updateCellDisplay ou onRender

        // Marquer la ligne comme modifiée si la valeur a changé par rapport à l'initiale
        const initialValue = cell.getAttribute('data-initial-value');
        const row = cell.closest('tr');
        if (newValue !== initialValue && row) {
             row.classList.add(this.config.modifiedClass);
             this.debug(`Ligne ${row.id} marquée comme modifiée.`);
        } else if (row) {
             // Si la valeur revient à l'initiale, vérifier si d'autres cellules sont modifiées avant de retirer la classe
             const isStillModified = Array.from(row.cells).some(c =>
                 c.getAttribute('data-value') !== c.getAttribute('data-initial-value')
             );
             if (!isStillModified) {
                  row.classList.remove(this.config.modifiedClass);
                  this.debug(`Ligne ${row.id} n'est plus modifiée.`);
             }
        }


        // Déclencher l'événement de changement système
        this.dispatchChangeEvent(cell, newValue, oldValue);

        // --- Hook: afterSave ---
        this.executeHook('afterSave', cell, newValue, oldValue);
        this.debug(`Sauvegarde terminée pour ${cell.id}.`);
    }

    /**
     * Annule l'édition en cours, restaure l'affichage et nettoie l'input.
     * @param {HTMLTableCellElement} cell - La cellule <td>.
     * @param {HTMLInputElement} input - L'input d'édition.
     */
    cancelEditing(cell, input) {
        // Nettoyer les listeners de l'input
        this.removeInputListeners(input);

        // Restaurer la valeur affichée à la valeur actuelle stockée (celle avant cette tentative d'édition)
        const currentValue = cell.getAttribute('data-value');
        this.debug(`Annulation de l'édition pour ${cell.id}, restauration de la valeur: "${currentValue}"`);

        // Restaurer l'affichage via le hook onRender ou la méthode par défaut
        const renderHookResult = this.executeHook('onRender', cell, currentValue);
        if (renderHookResult !== false) {
            this.updateCellDisplay(cell, currentValue);
        }

        // Effacer les erreurs de validation affichées par ValidationPlugin
        if (typeof this.table?.getPlugin === 'function') {
            const validationPlugin = this.table.getPlugin('Validation');
            validationPlugin?.clearValidationError?.(cell);
        }
    }

    /**
     * Met à jour le contenu affiché d'une cellule (dans son wrapper).
     * Utilise le sanitizer si disponible.
     * @param {HTMLTableCellElement} cell - La cellule <td>.
     * @param {string} value - La valeur à afficher.
     */
    updateCellDisplay(cell, value) {
        const wrapperClass = this.table?.config?.wrapCellClass || 'cell-wrapper';
        const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;

        // Utiliser le sanitizer pour insérer la valeur (traiter comme texte par défaut)
        if (this.table?.sanitizer && typeof this.table.sanitizer.setHTML === 'function') {
            this.table.sanitizer.setHTML(wrapper, value, { isPlainText: true });
        } else {
            wrapper.textContent = value; // Fallback sécurisé
        }
    }

    /**
     * Supprime les écouteurs d'événements ajoutés à un input d'édition.
     * @param {HTMLInputElement} input - L'élément input.
     * @private
     */
    removeInputListeners(input) {
        if (input._editBlurHandler) {
            input.removeEventListener('blur', input._editBlurHandler);
            delete input._editBlurHandler;
        }
        if (input._editKeydownHandler) {
            input.removeEventListener('keydown', input._editKeydownHandler);
            delete input._editKeydownHandler;
        }
        // Supprimer aussi le listener de validation temps réel s'il a été ajouté
         if (input._validationInputHandler) {
            input.removeEventListener('input', input._validationInputHandler);
            delete input._validationInputHandler;
        }
         // Supprimer le listener de highlight si ajouté
         if (input._highlightUpdateListener) {
             input.removeEventListener('input', input._highlightUpdateListener);
             input.removeEventListener('scroll', input._highlightUpdateListener); // Supposer que scroll utilise le même
             delete input._highlightUpdateListener;
         }

    }


    /**
     * Déclenche l'événement 'cell:change' sur l'élément table.
     * @param {HTMLTableCellElement} cell
     * @param {string} newValue
     * @param {string} oldValue
     * @private
     */
    dispatchChangeEvent(cell, newValue, oldValue) {
        const row = cell.closest('tr');
        // Trouver l'ID de colonne de manière plus robuste
        const columnId = this.table?.element?.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`)?.id;
        const initialValue = cell.getAttribute('data-initial-value');
        const isModified = newValue !== initialValue;

        const changeEvent = new CustomEvent('cell:change', {
            detail: {
                cell: cell,
                cellId: cell.id,
                columnId: columnId || `col_${cell.cellIndex}`, // Fallback si ID manquant
                rowId: row?.id,
                value: newValue,
                oldValue: oldValue,
                initialValue: initialValue,
                isModified: isModified,
                source: 'edit', // Source du changement
                tableId: this.table?.tableId
            },
            bubbles: true // Permettre la propagation
        });

        this.debug(`Dispatching cell:change pour ${cell.id}`, changeEvent.detail);
        this.table?.element?.dispatchEvent(changeEvent);
    }

     /**
      * Vérifie si une cellule est gérée par ce plugin Edit.
      * @param {HTMLTableCellElement | null} cell
      * @returns {boolean}
      */
     isManagedCell(cell) {
         // Vérifie la classe et l'attribut data-plugin
         // Permet à d'autres plugins (Choice, Color) de prendre le dessus s'ils définissent data-plugin
         return cell?.classList.contains(this.config.cellClass) && cell.getAttribute('data-plugin') === 'edit';
     }

    // -------------------------------------------------------------------------
    // Méthodes de Gestion des Hooks (Implémentation)
    // -------------------------------------------------------------------------

    /**
     * Ajoute une fonction de rappel (callback) à un hook spécifique.
     * @param {string} hookName - Le nom du hook (ex: 'beforeSave').
     * @param {Function} callback - La fonction à exécuter lorsque le hook est déclenché.
     * @param {string} [namespace] - Optionnel: Un espace de noms pour identifier/supprimer le callback.
     * @returns {this} L'instance du plugin Edit pour le chaînage.
     * @throws {Error} Si le nom du hook est invalide ou le callback n'est pas une fonction.
     */
    addHook(hookName, callback, namespace = null) {
        if (!this.hooks[hookName]) {
            const availableHooks = Object.keys(this.hooks).join(', ');
            throw new Error(`Hook invalide: ${hookName}. Hooks disponibles: ${availableHooks}`);
        }
        if (typeof callback !== 'function') {
            throw new Error(`Le callback fourni pour le hook '${hookName}' n'est pas une fonction.`);
        }

        this.hooks[hookName].push({ callback, namespace });
        this.debug(`Callback ajouté au hook '${hookName}'` + (namespace ? ` (namespace: ${namespace})` : ''));
        return this;
    }

    /**
     * Supprime des callbacks d'un hook, soit par référence de fonction, soit par namespace.
     * @param {string} hookName - Le nom du hook.
     * @param {Function | string} callbackOrNamespace - La fonction callback exacte ou le namespace.
     * @returns {this} L'instance du plugin Edit pour le chaînage.
     * @throws {Error} Si le nom du hook est invalide.
     */
    removeHook(hookName, callbackOrNamespace) {
        if (!this.hooks[hookName]) {
            throw new Error(`Hook invalide: ${hookName}.`);
        }
        if (!callbackOrNamespace) {
             this.logger.warn(`Appel à removeHook pour '${hookName}' sans callback ni namespace.`);
             return this;
        }

        const initialLength = this.hooks[hookName].length;
        let filterFn;
        if (typeof callbackOrNamespace === 'function') {
            // Supprimer par référence de fonction
            filterFn = hook => hook.callback !== callbackOrNamespace;
            this.debug(`Tentative de suppression du callback du hook '${hookName}' par référence.`);
        } else if (typeof callbackOrNamespace === 'string') {
            // Supprimer par namespace
            filterFn = hook => hook.namespace !== callbackOrNamespace;
             this.debug(`Tentative de suppression des callbacks du hook '${hookName}' pour le namespace '${callbackOrNamespace}'.`);
        } else {
             this.logger.warn(`Type invalide pour callbackOrNamespace dans removeHook pour '${hookName}'.`);
             return this;
        }

        this.hooks[hookName] = this.hooks[hookName].filter(filterFn);
        const removedCount = initialLength - this.hooks[hookName].length;

        if (removedCount > 0) {
             this.debug(`${removedCount} callback(s) retiré(s) du hook '${hookName}'.`);
        } else {
             this.debug(`Aucun callback trouvé à retirer pour le hook '${hookName}' avec l'identifiant fourni.`);
        }
        return this;
    }

    /**
     * Exécute tous les callbacks enregistrés pour un hook donné.
     * @param {string} hookName - Le nom du hook à exécuter.
     * @param {...any} args - Arguments à passer aux fonctions de rappel du hook.
     * @returns {boolean} `false` si au moins un callback a retourné `false`, sinon `true`.
     */
    executeHook(hookName, ...args) {
        if (!this.hooks[hookName]) {
            this.logger.error(`Tentative d'exécution d'un hook inexistant: ${hookName}`);
            return true; // Ne pas bloquer par défaut
        }

        // Ne logguer que si des callbacks existent pour éviter le bruit
        if (this.hooks[hookName].length > 0) {
            this.debug(`Exécution du hook '${hookName}' avec ${this.hooks[hookName].length} callback(s)...`);
        }

        let continueExecution = true;
        // Itérer sur une copie pour éviter les problèmes si un hook modifie la liste
        const hooksToExecute = [...this.hooks[hookName]];

        for (const hook of hooksToExecute) {
            try {
                const result = hook.callback(...args);
                // Si un callback retourne explicitement false, on arrête et on retourne false
                if (result === false) {
                    this.debug(`Hook '${hookName}' interrompu par callback (namespace: ${hook.namespace || 'aucun'}).`);
                    continueExecution = false;
                    break; // Arrêter l'exécution des hooks suivants pour celui-ci
                }
            } catch (error) {
                this.logger.error(`Erreur lors de l'exécution d'un callback du hook ${hookName} (namespace: ${hook.namespace || 'aucun'}): ${error.message}`, error);
                // Optionnel: Décider si une erreur dans un hook doit bloquer (return false)
                // Pour l'instant, on continue.
            }
        }
        return continueExecution;
    }

    // -------------------------------------------------------------------------
    // Cycle de vie
    // -------------------------------------------------------------------------

    /**
     * Rafraîchit l'état du plugin, reconfigurant les cellules éditables.
     */
    refresh() {
        this.debug('Rafraîchissement du plugin Edit...');
        // Réinitialiser l'attribut pour forcer la reconfiguration des listeners dblclick
         this.table?.element?.querySelectorAll(`td.${this.config.cellClass}[data-edit-initialized]`)
             .forEach(cell => {
                 // Retirer l'ancien listener avant de potentiellement en ajouter un nouveau
                 if (cell._editDblClickHandler) {
                     cell.removeEventListener('dblclick', cell._editDblClickHandler);
                     delete cell._editDblClickHandler;
                 }
                 cell.removeAttribute('data-edit-initialized');
             });
        this.setupEditCells(); // Reconfigure toutes les cellules
        this.debug('Rafraîchissement Edit terminé.');
    }

    /**
     * Nettoie les ressources utilisées par le plugin (écouteurs d'événements).
     */
    destroy() {
        this.debug('Destruction du plugin Edit...');
        if (this.table?.element) {
            // Supprimer les écouteurs d'événements système
            this.table.element.removeEventListener('cell:saved', this._handleCellSaved);
            this.table.element.removeEventListener('row:saved', this._handleRowSaved);
            this.table.element.removeEventListener('row:added', this._handleRowAdded);

            // Supprimer les écouteurs de double-clic ajoutés aux cellules
            const editCells = this.table.element.querySelectorAll(`td.${this.config.cellClass}[data-edit-initialized]`);
            editCells.forEach(cell => {
                 if (cell._editDblClickHandler) {
                    cell.removeEventListener('dblclick', cell._editDblClickHandler);
                    delete cell._editDblClickHandler; // Nettoyer la référence stockée
                 }
                cell.removeAttribute('data-edit-initialized');
            });
             this.debug(`${editCells.length} écouteurs dblclick retirés.`);
        }

        // Vider les hooks (important si l'instance TableFlow est détruite)
        Object.keys(this.hooks).forEach(key => {
            this.hooks[key] = [];
        });
        this.debug("Hooks vidés.");

        this.table = null; // Effacer la référence
        this.debug('Plugin Edit détruit.');
    }
}
