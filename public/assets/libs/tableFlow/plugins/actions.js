/**
 * Plugin Actions pour TableFlow
 * Permet d'ajouter des colonnes avec des boutons d'action (icônes) cliquables par ligne.
 * Gère l'affichage conditionnel et l'exécution de handlers personnalisés pour des opérations
 * comme la sauvegarde, la suppression, l'édition externe, etc.
 *
 * @class ActionsPlugin
 * @version 1.1.1 - Intégration TableInstance, nettoyage, clarification
 */
export default class ActionsPlugin {
    /**
     * Crée une instance de ActionsPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'actions';
        this.version = '1.1.1';
        this.type = 'action'; // Type de plugin
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (ex: ['Edit'] si une action dépend de l'état d'édition) */
        this.dependencies = []; // Pas de dépendances JS directes fortes par défaut

        // Fusion de la configuration par défaut et fournie
        this.config = { ...this.getDefaultConfig(), ...config };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[ActionsPlugin ${this.table?.tableId}]`, ...args) ?? console.debug('[ActionsPlugin]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Lier les méthodes pour préserver le contexte 'this' lors des appels d'événements
        this.handleCellChange = this.handleCellChange.bind(this);
        this.handleRowSaved = this.handleRowSaved.bind(this);
        this.handleRowAdded = this.handleRowAdded.bind(this);
        this._clickHandler = this._clickHandler.bind(this); // Handler générique pour les clics sur actions
    }

    /**
     * Retourne la configuration par défaut du plugin.
     * @returns {object} Configuration par défaut.
     */
    getDefaultConfig() {
        return {
            actionAttribute: 'th-actions',        // Attribut HTML sur <th> pour définir les actions
            sqlExcludeAttribute: 'th-sql-exclude',// Attribut HTML sur <th> pour exclure une colonne des données
            cellClass: 'td-actions',            // Classe CSS pour les cellules <td> contenant les actions
            useIcons: true,                     // Si true, insère le HTML des icônes
            debug: false,                       // Active les logs de débogage spécifiques
            showOnChange: [],                   // Actions à afficher/masquer par défaut si la ligne est modifiée (booléen ou array de noms)
            modifiedClass: 'modified',          // Classe CSS identifiant une ligne modifiée
            actions: {},                        // Définition des actions { name: { handler, showOnChange?, icon?, confirm?, autoSave? } }
            icons: {},                          // Icônes par défaut { name: '<i class="..."></i>' }
            confirmMessages: {},                // Messages de confirmation par défaut { name: 'Message?' }
            autoSave: false                     // Déclencher l'action 'save' automatiquement après modification?
        };
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('ActionsPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Actions avec la configuration:', this.config);

        // Vérifier si des colonnes d'actions existent
        const hasActions = this.hasActionColumns();
        this.debug('Colonnes d\'actions détectées:', hasActions);

        if (hasActions) {
            this.setupActionColumns(); // Configurer les cellules d'action existantes
        }
        this.setupEventListeners(); // Attacher les écouteurs d'événements globaux

        this.debug('Plugin Actions initialisé.');
    }

    /**
     * Vérifie si le tableau contient au moins une colonne d'actions.
     * @returns {boolean} True si au moins une colonne d'actions est définie.
     */
    hasActionColumns() {
        if (!this.table?.element) return false;
        const actionColumns = this.table.element.querySelectorAll(`thead th[${this.config.actionAttribute}]`);
        const count = actionColumns.length;
        this.debug(`${count} colonne(s) d'actions trouvée(s) via [${this.config.actionAttribute}]`);
        return count > 0;
    }

    /**
     * Attache les écouteurs d'événements nécessaires au fonctionnement du plugin.
     */
    setupEventListeners() {
        if (!this.table?.element) {
            this.logger.error('Impossible d\'attacher les événements - table non trouvée');
            return;
        }

        this.debug('Configuration des écouteurs d\'événements globaux (cell:change, row:saved, row:added)');
        // Utiliser l'élément table de l'instance pour les écouteurs
        this.table.element.addEventListener('cell:change', this.handleCellChange);
        this.table.element.addEventListener('row:saved', this.handleRowSaved);
        this.table.element.addEventListener('row:added', this.handleRowAdded);

        // Ajouter un seul écouteur de clic délégué sur le tbody pour gérer toutes les actions
        const tbody = this.table.element.querySelector('tbody');
        if (tbody) {
            tbody.addEventListener('click', this._clickHandler);
            this.debug('Écouteur de clic délégué ajouté au tbody.');
        } else {
             this.logger.warn('tbody non trouvé, l\'écouteur de clic délégué n\'a pas pu être ajouté.');
        }
    }

    /**
     * Handler de clic délégué pour les icônes/boutons d'action.
     * @param {Event} event - L'événement de clic.
     * @private
     */
    _clickHandler(event) {
        // Trouver l'élément action le plus proche (celui avec data-action)
        const actionElement = /** @type {HTMLElement} */ (event.target)?.closest('[data-action]');
        if (!actionElement) {
            return; // Clic en dehors d'une action
        }

        // Trouver la cellule parente
        const cell = actionElement.closest('td');
        // Vérifier si la cellule est bien une cellule d'action gérée par ce plugin
        if (!cell || !cell.classList.contains(this.config.cellClass)) {
            return;
        }

        const actionName = actionElement.getAttribute('data-action');
        if (actionName) {
            this.debug(`Clic détecté sur l'action '${actionName}' dans la cellule ${cell.id}`);
            event.preventDefault(); // Empêcher le comportement par défaut (ex: suivi de lien)
            event.stopPropagation(); // Empêcher la propagation (ex: dblclick sur cellule)
            this.executeAction(actionName, cell);
        }
    }


    /**
     * Gère l'événement 'row:saved' pour nettoyer l'état modifié de la ligne et mettre à jour les boutons.
     * @param {CustomEvent} event - L'événement 'row:saved'.
     */
    handleRowSaved(event) {
        const row = event.detail?.row;
        if (!row) {
            this.logger.warn('Événement row:saved reçu sans élément de ligne valide.');
            return;
        }

        this.debug('Gestion de row:saved pour la ligne:', row.id);
        // La classe modified est normalement retirée par markRowAsSaved, mais on s'assure
        row.classList.remove(this.config.modifiedClass);

        if (this.hasActionColumns()) {
            // Mettre à jour les boutons (ex: masquer 'save')
            // Récupérer les options passées à markRowAsSaved si elles existent
            const pluginOptions = event.detail?.options?.actions || {}; // Cherche une clé 'actions' dans les options
            this.updateActionButtons(row, {
                showOnModified: false, // La ligne n'est plus modifiée
                hideSpecificAction: pluginOptions.hideAction // Masquer une action spécifique si demandé via options
            });
        }
    }

    /**
     * Gère l'événement 'row:added' pour configurer les actions sur la nouvelle ligne.
     * @param {CustomEvent} event - L'événement 'row:added'.
     */
    handleRowAdded(event) {
        const row = event.detail?.row;
        if (!row) {
             this.logger.warn('Événement row:added reçu sans élément de ligne valide.');
            return;
        }

        this.debug('Gestion de row:added pour la nouvelle ligne:', row.id);

        // Re-parcourir les colonnes d'action pour configurer la nouvelle ligne
        if (this.hasActionColumns()) {
            this.setupActionColumns(row); // Passer la ligne spécifique pour optimiser
            this.updateActionButtons(row, { showOnModified: false }); // État initial (non modifié)
        }
    }

    /**
     * Configure les cellules d'action pour toutes les lignes ou une ligne spécifique.
     * @param {HTMLTableRowElement} [specificRow=null] - Si fourni, configure uniquement cette ligne.
     */
    setupActionColumns(specificRow = null) {
        const headerCells = this.table?.element?.querySelectorAll(`thead th[${this.config.actionAttribute}]`);
        if (!headerCells?.length) return; // Pas de colonnes d'action définies

        this.debug(`Configuration des colonnes d'actions pour ${specificRow ? `la ligne ${specificRow.id}` : 'toutes les lignes'}...`);

        headerCells.forEach(headerCell => {
            const columnIndex = headerCell.cellIndex;
            if (columnIndex === -1) {
                this.logger.warn(`Index de colonne invalide pour l'en-tête ${headerCell.id || 'inconnu'}`);
                return;
            }

            const actionsStr = headerCell.getAttribute(this.config.actionAttribute);
            if (!actionsStr) return;

            const actions = actionsStr.split(',').map(a => a.trim()).filter(Boolean);
            if (actions.length === 0) {
                this.logger.warn(`Aucune action définie dans [${this.config.actionAttribute}] pour la colonne ${columnIndex}`);
                return;
            }

            this.debug(`Colonne ${columnIndex + 1} (${headerCell.id}): actions [${actions.join(', ')}]`);

            // Sélectionner les lignes à traiter
            const rowsToProcess = specificRow ? [specificRow] : this.table?.getAllRows() ?? [];

            rowsToProcess.forEach(row => {
                const cell = row.cells[columnIndex];
                if (cell) {
                    // Vérifier si déjà initialisé pour éviter doublons
                    if (!cell.hasAttribute('data-actions-initialized')) {
                         this.setupActionCell(cell, actions);
                         cell.setAttribute('data-actions-initialized', 'true');
                    } else {
                         this.debug(`Cellule ${cell.id} déjà initialisée pour Actions, saut.`);
                         // Optionnel: Mettre à jour les icônes si elles peuvent changer
                         // this.updateActionCellIcons(cell, actions);
                    }
                } else {
                    this.logger.warn(`Cellule manquante à l'index ${columnIndex} pour la ligne ${row.id}`);
                }
            });
        });
    }

    /**
     * Configure une cellule <td> spécifique pour afficher les icônes/boutons d'action.
     * @param {HTMLTableCellElement} cell - La cellule <td> à configurer.
     * @param {string[]} actions - Tableau des noms d'actions à ajouter.
     */
    setupActionCell(cell, actions) {
        if (!cell) {
            this.logger.error('Cellule non valide fournie à setupActionCell');
            return;
        }

        cell.classList.add(this.config.cellClass);
        // Utiliser le wrapper s'il existe
        const wrapperClass = this.table?.config?.wrapCellClass || 'cell-wrapper';
        let wrapper = cell.querySelector(`.${wrapperClass}`);
        if (!wrapper) {
             this.debug(`Wrapper .${wrapperClass} manquant pour ${cell.id}, création...`);
             wrapper = document.createElement('div');
             wrapper.className = wrapperClass;
             cell.textContent = ''; // Vider avant d'ajouter le wrapper
             cell.appendChild(wrapper);
        }
        wrapper.innerHTML = ''; // Vider le contenu précédent du wrapper

        this.debug('Configuration des actions pour la cellule:', { cellId: cell.id, actions });

        actions.forEach(actionName => {
            const actionConfig = this.config.actions[actionName];
            if (!actionConfig) {
                this.logger.error(`Action '${actionName}' non trouvée dans la configuration 'plugins.actions.actions'.`);
                return;
            }

            // Utiliser l'icône spécifique ou l'icône globale
            const iconHTML = actionConfig.icon || this.config.icons[actionName];
            let actionElement;

            if (iconHTML && this.config.useIcons) {
                // Créer l'élément à partir du HTML de l'icône
                try {
                    const template = document.createElement('template');
                    // Utiliser le sanitizer pour nettoyer l'icône HTML avant insertion
                    if (this.table?.sanitizer) {
                        this.table.sanitizer.setHTML(template, iconHTML, { isTrustedIcon: true });
                    } else {
                        template.innerHTML = iconHTML.trim(); // Fallback moins sûr
                    }
                    actionElement = /** @type {HTMLElement} */ (template.content.firstChild);
                    if (!actionElement || !(actionElement instanceof Element)) {
                         throw new Error("Le HTML de l'icône n'a pas produit d'élément valide.");
                    }
                } catch (error) {
                     this.logger.error(`HTML invalide ou erreur sanitizer pour l'icône '${actionName}': ${error.message}`);
                     // Créer un bouton texte en fallback
                     actionElement = this._createActionButton(actionName, actionConfig);
                }
            } else {
                // Si pas d'icône ou useIcons est false, créer un bouton texte
                actionElement = this._createActionButton(actionName, actionConfig);
            }

            // Ajouter les attributs nécessaires à l'élément d'action
            actionElement.setAttribute('data-action', actionName);
            actionElement.setAttribute('title', actionConfig.label || actionName); // Tooltip

            // Stocker l'affichage original pour showOnChange
            const computedStyle = window.getComputedStyle(actionElement);
            const originalDisplay = computedStyle.display === 'none' ? 'inline-block' : computedStyle.display;
            actionElement.setAttribute('data-original-display', originalDisplay);
            this.debug(`Élément pour action '${actionName}' créé (display original: ${originalDisplay})`);

            // Appliquer l'état de visibilité initial basé sur showOnChange
            if (this.shouldShowOnChange(actionName)) {
                const row = cell.closest('tr');
                if (!row || !row.classList.contains(this.config.modifiedClass)) {
                     actionElement.style.display = 'none';
                }
            }

            wrapper.appendChild(actionElement);
        });
        // Note: Les écouteurs de clic sont gérés par le handler délégué sur tbody
    }

    /**
     * Crée un bouton texte pour une action.
     * @param {string} actionName - Nom de l'action.
     * @param {object} actionConfig - Configuration de l'action.
     * @returns {HTMLButtonElement}
     * @private
     */
    _createActionButton(actionName, actionConfig) {
        const button = document.createElement('button');
        button.textContent = actionConfig.label || actionName; // Utilise le label si défini
        button.type = 'button';
        button.classList.add('tf-action-button', `tf-action-${actionName}`); // Classes pour style
        this.debug(`Bouton texte créé pour l'action '${actionName}'`);
        return button;
    }


    /**
     * Détermine si une action doit être affichée/masquée en fonction de l'état modifié.
     * @param {string} actionName - Le nom de l'action.
     * @returns {boolean} True si l'action doit être conditionnelle, false sinon.
     */
    shouldShowOnChange(actionName) {
        const actionConfig = this.config.actions[actionName] || {};
        // Priorité : config spécifique de l'action > config globale (tableau ou booléen)
        if (typeof actionConfig.showOnChange === 'boolean') {
            return actionConfig.showOnChange;
        }
        if (typeof this.config.showOnChange === 'boolean') {
            return this.config.showOnChange;
        }
        if (Array.isArray(this.config.showOnChange)) {
            return this.config.showOnChange.includes(actionName);
        }
        return false; // Comportement par défaut: toujours visible
    }

    /**
     * Détermine si l'action 'save' doit être déclenchée automatiquement.
     * @param {string} actionName - Le nom de l'action (doit être 'save').
     * @returns {boolean} True si l'autoSave est activé pour 'save'.
     */
    shouldAutoSave(actionName) {
        if (actionName !== 'save') return false;
        const actionConfig = this.config.actions.save || {};
        if (typeof actionConfig.autoSave === 'boolean') {
            return actionConfig.autoSave;
        }
        return this.config.autoSave === true;
    }

    /**
     * Exécute une action spécifique pour une cellule donnée.
     * @param {string} actionName - Le nom de l'action à exécuter.
     * @param {HTMLTableCellElement} cell - La cellule <td> contenant l'action cliquée.
     * @param {object} [options={}] - Options supplémentaires (ex: { skipConfirm: true, source: 'autoSave' }).
     */
    executeAction(actionName, cell, options = {}) {
        const row = cell?.closest('tr');
        if (!row) {
            this.logger.error(`Ligne parente non trouvée pour la cellule ${cell?.id} lors de l'exécution de '${actionName}'.`);
            return;
        }

        const actionConfig = this.config.actions[actionName];
        if (!actionConfig || typeof actionConfig.handler !== 'function') {
            this.logger.error(`Configuration ou handler manquant pour l'action '${actionName}'.`);
            return;
        }

        this.debug(`Exécution de l'action '${actionName}' pour la ligne ${row.id}`, { options });

        // 1. Gérer la confirmation
        let proceed = true;
        const confirmOption = actionConfig.confirm; // Peut être true, false, ou une chaîne de message
        const confirmMessage = (typeof confirmOption === 'string' && confirmOption.length > 0)
            ? confirmOption
            : (confirmOption === true ? (this.config.confirmMessages[actionName] || `Confirmer l'action '${actionName}' ?`) : null);

        if (!options.skipConfirm && confirmMessage) {
            this.debug(`Demande de confirmation pour '${actionName}': "${confirmMessage}"`);
            proceed = window.confirm(confirmMessage); // Utilise confirm natif
        }

        if (!proceed) {
            this.debug('Action annulée par l\'utilisateur.');
            return;
        }

        // 2. Collecter les données de la ligne (en utilisant la méthode de l'instance)
        let rowData = {};
        if (this.table && typeof this.table.getRowData === 'function') {
            try {
                rowData = this.table.getRowData(row); // Délègue la récupération des données
            } catch (error) {
                 this.logger.error(`Erreur lors de getRowData pour la ligne ${row.id}: ${error.message}`, error);
            }
        } else {
            this.logger.warn(`La méthode getRowData n'est pas disponible sur tableHandler, les données seront vides.`);
        }
        this.debug('Données collectées pour l\'action:', rowData);


        // 3. Créer le contexte pour le handler
        const context = {
            row,
            cell, // La cellule d'action, pas forcément la cellule modifiée
            tableHandler: this.table, // Passe l'instance TableInstance
            data: rowData,
            source: options.source || 'manual' // Indique comment l'action a été déclenchée
        };

        // 4. Exécuter le handler
        try {
            this.debug(`Appel du handler pour '${actionName}' (source: ${context.source})`);
            // Le handler peut être synchrone ou asynchrone
            Promise.resolve(actionConfig.handler(context)).catch(handlerError => {
                 this.logger.error(`Erreur asynchrone dans le handler de l'action '${actionName}': ${handlerError.message}`, handlerError);
                 this.table?.notify('error', `Erreur lors de l'action '${actionConfig.label || actionName}'.`);
            });
        } catch (error) {
            this.logger.error(`Erreur synchrone lors de l'exécution du handler de l'action '${actionName}': ${error.message}`, error);
            this.table?.notify('error', `Erreur lors de l'action '${actionConfig.label || actionName}'.`);
        }
    }

    /**
     * Gère l'événement 'cell:change' pour mettre à jour l'état 'modified' et la visibilité des boutons.
     * @param {CustomEvent} event - L'événement 'cell:change'.
     */
    handleCellChange(event) {
        // Vérifier que l'événement vient de notre table
        if (event.detail?.tableId && event.detail.tableId !== this.table?.tableId) {
            this.debug('Événement cell:change ignoré (autre table):', event.detail.tableId);
            return;
        }

        // Commentaire: Gestion des doublons potentiels retirée pour l'instant.
        // Si nécessaire, réintroduire une logique basée sur event.detail.eventId.

        const row = event.detail?.row || event.target?.closest('tr');
         if (!row || !row.closest('tbody')) {
             this.debug('Événement cell:change ignoré (ligne non trouvée ou pas dans tbody).');
             return;
         }

        const cell = event.detail?.cell || event.target?.closest('td');
        this.debug('Gestion du changement de cellule:', { rowId: row.id, cellId: cell?.id });

        // Vérifier si la ligne est maintenant modifiée (basé sur l'événement ou recalculé)
        let isModified = event.detail?.isModified; // Utiliser l'info de l'événement si disponible
        if (isModified === undefined) {
             // Recalculer si non fourni par l'événement
             if (this.table && typeof this.table.isRowModified === 'function') {
                 isModified = this.table.isRowModified(row);
             } else {
                 isModified = row.classList.contains(this.config.modifiedClass); // Fallback
             }
        }

        this.debug(`État de modification de la ligne ${row.id}: ${isModified}`);

        // Mettre à jour la classe 'modified' sur la ligne
        // C'est important que ce plugin le fasse aussi car il dépend de cette classe
        row.classList.toggle(this.config.modifiedClass, isModified);

        // Mettre à jour la visibilité des boutons d'action
        if (this.hasActionColumns()) {
            this.updateActionButtons(row, { showOnModified: isModified });
        }

        // Gérer l'autoSave si la ligne EST modifiée et que l'option est activée
        if (isModified && this.shouldAutoSave('save')) {
            if (this.config.actions.save?.handler) {
                this.debug('Déclenchement de l\'autoSave...');
                // Trouver une cellule d'action pour passer au handler (même si pas la cellule modifiée)
                const actionCell = row.querySelector(`td.${this.config.cellClass}`);
                this.executeAction('save', actionCell || cell, { // Utilise la cellule d'action ou la cellule modifiée
                    skipConfirm: true,
                    source: 'autoSave'
                });
            } else {
                 this.logger.warn('autoSave activé mais aucune action "save" avec un handler n\'est définie.');
            }
        }
    }

    /**
     * Met à jour la visibilité des boutons d'action dans une ligne donnée.
     * @param {HTMLTableRowElement} row - La ligne à mettre à jour.
     * @param {object} [options={}] - Options.
     * @param {boolean} [options.showOnModified=false] - Indique si la ligne est considérée comme modifiée.
     * @param {string|null} [options.hideSpecificAction=null] - Nom d'une action à masquer spécifiquement.
     */
    updateActionButtons(row, options = {}) {
        if (!row) {
            this.logger.warn('Ligne non valide fournie à updateActionButtons');
            return;
        }

        const { showOnModified = false, hideSpecificAction = null } = options;
        this.debug('Mise à jour des boutons d\'action:', { rowId: row.id, showOnModified, hideSpecificAction });

        // Trouver les cellules d'action dans cette ligne
        const actionCells = Array.from(row.cells).filter(cell =>
            cell.classList.contains(this.config.cellClass)
        );

        actionCells.forEach(cell => {
            const actionElements = cell.querySelectorAll('[data-action]'); // Cible les éléments avec data-action
            actionElements.forEach(element => {
                const actionName = element.getAttribute('data-action');
                const originalDisplay = element.getAttribute('data-original-display') || 'inline-block';

                let shouldShow = true;

                // Masquer si spécifiquement demandé
                if (hideSpecificAction && actionName === hideSpecificAction) {
                    shouldShow = false;
                    this.debug(`Action '${actionName}' masquée spécifiquement.`);
                }
                // Sinon, vérifier la condition showOnChange
                else if (this.shouldShowOnChange(actionName)) {
                    shouldShow = showOnModified;
                    this.debug(`Visibilité de l'action '${actionName}' basée sur l'état modifié (${showOnModified}): ${shouldShow}`);
                }

                // Appliquer le style display
                element.style.display = shouldShow ? originalDisplay : 'none';
            });
        });
    }

    /**
     * Méthode appelée par TableFlow/TableInstance lorsqu'une ligne est marquée comme sauvegardée.
     * Permet au plugin de réagir (ex: mettre à jour l'état des boutons).
     * @param {HTMLTableRowElement} row - La ligne sauvegardée.
     * @param {object} [options={}] - Options passées lors de l'appel à markRowAsSaved.
     */
    markRowAsSaved(row, options = {}) {
        // Cette méthode est appelée par le système central.
        // La logique principale de réaction est dans handleRowSaved qui écoute l'événement.
        this.debug(`Notification markRowAsSaved reçue pour la ligne ${row?.id}`, options);
    }


    /**
     * Rafraîchit l'état du plugin, par exemple après des modifications du DOM.
     * Reconfigure les cellules d'action.
     */
    refresh() {
        this.debug('Rafraîchissement du plugin Actions...');
        if (this.hasActionColumns()) {
            // Réinitialiser l'attribut pour forcer la reconfiguration
             this.table?.element?.querySelectorAll(`td.${this.config.cellClass}[data-actions-initialized]`)
                 .forEach(cell => cell.removeAttribute('data-actions-initialized'));
            this.setupActionColumns(); // Reconfigure toutes les lignes
            // Mettre à jour l'état initial des boutons pour toutes les lignes
            this.table?.getAllRows().forEach(row => {
                 const isModified = row.classList.contains(this.config.modifiedClass);
                 this.updateActionButtons(row, { showOnModified: isModified });
            });
        }
         this.debug('Rafraîchissement Actions terminé.');
    }

    /**
     * Nettoie les ressources utilisées par le plugin (écouteurs d'événements).
     */
    destroy() {
        this.debug('Destruction du plugin Actions...');
        // Supprimer les écouteurs d'événements globaux ajoutés par ce plugin
        if (this.table?.element) {
            this.table.element.removeEventListener('cell:change', this.handleCellChange);
            this.table.element.removeEventListener('row:saved', this.handleRowSaved);
            this.table.element.removeEventListener('row:added', this.handleRowAdded);

            // Supprimer l'écouteur de clic délégué du tbody
            const tbody = this.table.element.querySelector('tbody');
            if (tbody && this._clickHandler) {
                tbody.removeEventListener('click', this._clickHandler);
                 this.debug('Écouteur de clic délégué retiré du tbody.');
            }
        }
        // Effacer la référence à l'instance
        this.table = null;
        this.debug('Plugin Actions détruit.');
    }
}