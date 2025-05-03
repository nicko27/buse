/**
 * Plugin TextEditor pour TableFlow
 * Étend les plugins Edit et ContextMenu pour fournir des actions
 * de manipulation de texte sur les cellules éditables (ex: supprimer phrase,
 * supprimer motif, mettre en majuscules).
 *
 * @class TextEditorPlugin
 * @version 1.0.2 - Intégration TableInstance, nettoyage destroy
 * @depends EditPlugin - Requis pour l'édition et le hook onKeydown.
 * @depends ContextMenuPlugin - Requis pour l'intégration du menu contextuel.
 */
export default class TextEditorPlugin {
    /**
     * Crée une instance de TextEditorPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'textEditor';
        this.version = '1.0.2';
        this.type = 'extension'; // Type de plugin: étend d'autres plugins
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {object|null} Référence à l'instance du plugin Edit */
        this.editPlugin = null;
        /** @type {object|null} Référence à l'instance du plugin ContextMenu */
        this.contextMenuPlugin = null;
        /** @type {string[]} Dépendances requises */
        this.dependencies = ['Edit', 'ContextMenu']; // Dépend de Edit et ContextMenu

        // Configuration par défaut fusionnée avec celle fournie
        // Utilise des fonctions pour obtenir les défauts et éviter la mutation
        const mergedConfig = {
            ...this.getDefaultConfig(),
            ...config
        };
        // Fusionner spécifiquement les actions et raccourcis
        mergedConfig.actions = { ...this.getDefaultActions(), ...(config.actions || {}) };
        mergedConfig.shortcuts = { ...this.getDefaultShortcuts(), ...(config.shortcuts || {}) };
        this.config = mergedConfig;


        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[TextEditor ${this.table?.tableId}]`, ...args) ?? console.debug('[TextEditor]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Lier les méthodes pour les hooks et listeners
        this._handleKeydown = this._handleKeydown.bind(this);
        this.getMenuItems = this.getMenuItems.bind(this); // Pour ContextMenu provider
        this.executeAction = this.executeAction.bind(this); // Pour ContextMenu provider
    }

    /** Retourne la configuration par défaut. */
    getDefaultConfig() {
        return {
            shortcutsEnabled: true,
            menuSection: 'Texte', // Titre section menu contextuel
            debug: false,
            actions: {}, // Sera peuplé par getDefaultActions
            shortcuts: {} // Sera peuplé par getDefaultShortcuts
        };
    }

    /** Retourne les actions par défaut. */
    getDefaultActions() {
        // Lie les handlers à 'this' au moment de la définition
        return {
            deleteSentence: { label: 'Supprimer 1ère phrase', icon: '✂️', handler: this._deleteFirstSentence.bind(this) },
            deleteRegexMatch: { label: 'Supprimer motif...', icon: '🔍', handler: this._deleteRegexMatch.bind(this) },
            capitalizeSentence: { label: 'Majuscules 1ère phrase', icon: 'Aa', handler: this._capitalizeFirstSentence.bind(this) }
        };
    }
     /** Retourne les raccourcis par défaut. */
     getDefaultShortcuts() {
         return { 'Ctrl+Delete': 'deleteSentence' };
     }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou le plugin Edit requis n'est pas valide/trouvé.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('TextEditorPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin TextEditor...');

        // 1. Obtenir les instances des plugins dépendants
        try {
            this.editPlugin = this.table.getPlugin('Edit'); // Requis
            // ContextMenu est optionnel, getPlugin peut retourner null ou lever une erreur
            this.contextMenuPlugin = this.table.getPlugin('ContextMenu');
        } catch (error) {
             if (error.message.includes("Plugin 'Edit' non actif")) {
                 this.logger.error("Le plugin 'Edit' est requis par TextEditorPlugin mais n'est pas actif.");
                 throw new Error("Le plugin 'Edit' est requis par TextEditorPlugin.");
             } else if (error.message.includes("Plugin 'ContextMenu' non actif")) {
                 this.debug("Plugin 'ContextMenu' non actif. Le menu contextuel TextEditor sera désactivé.");
                 this.contextMenuPlugin = null;
             } else {
                  // Autre erreur lors de getPlugin
                  this.logger.error(`Erreur inattendue lors de la récupération des dépendances: ${error.message}`, error);
                  throw error; // Propage l'erreur inconnue
             }
        }
        this.debug("Plugin 'Edit' trouvé.");
        if (this.contextMenuPlugin) {
             this.debug("Plugin 'ContextMenu' trouvé.");
             // Vérifier l'interface de ContextMenu
             if (typeof this.contextMenuPlugin.registerProvider !== 'function' || typeof this.contextMenuPlugin.unregisterProvider !== 'function') {
                  this.logger.warn("L'instance de ContextMenuPlugin ne semble pas supporter registerProvider/unregisterProvider. L'intégration du menu sera désactivée.");
                  this.contextMenuPlugin = null; // Désactiver l'intégration
             }
        }

        // 2. S'enregistrer auprès des plugins dépendants
        this.registerWithPlugins();

        this.debug('Plugin TextEditor initialisé.');
    }

    /**
     * S'enregistre aux hooks de Edit et comme fournisseur de ContextMenu.
     */
    registerWithPlugins() {
        // S'enregistrer au hook onKeydown de Edit pour les raccourcis
        if (this.config.shortcutsEnabled && this.editPlugin && typeof this.editPlugin.addHook === 'function') {
            // Utilise le namespace 'TextEditor' pour pouvoir se désenregistrer proprement
            this.editPlugin.addHook('onKeydown', this._handleKeydown, 'TextEditor');
            this.debug("Enregistré au hook 'onKeydown' du plugin Edit.");
        } else if (this.config.shortcutsEnabled) {
             this.logger.warn("Raccourcis TextEditor activés mais impossible de s'enregistrer au hook 'onKeydown' de EditPlugin (manquant ou invalide).");
        }

        // S'enregistrer comme fournisseur de ContextMenu
        if (this.contextMenuPlugin && typeof this.contextMenuPlugin.registerProvider === 'function') {
            this.contextMenuPlugin.registerProvider(this);
            this.debug("Enregistré comme fournisseur auprès de ContextMenuPlugin.");
        }
    }

    // -------------------------------------------------------------------------
    // Implémentation Interface Fournisseur pour ContextMenuPlugin
    // -------------------------------------------------------------------------

    /**
     * Retourne les items de menu pour le ContextMenuPlugin.
     * Appelé par ContextMenu lors d'un clic droit sur une cellule.
     * @param {HTMLTableCellElement} cell - La cellule <td> ciblée.
     * @returns {Array<object>} Tableau d'items de menu pour ce plugin.
     */
    getMenuItems(cell) {
        // Vérifier si la cellule est éditable (gérée par EditPlugin)
        // Utilise la classe configurée dans EditPlugin
        const editCellClass = this.editPlugin?.config?.cellClass || 'td-edit';
        if (!this.editPlugin || !cell.classList.contains(editCellClass)) {
            return []; // Ne rien ajouter si la cellule n'est pas éditable par Edit
        }

        const items = [];
        const availableActions = Object.entries(this.config.actions);

        if (availableActions.length === 0) {
             return []; // Pas d'actions configurées
        }

        // Ajouter l'en-tête de section si configuré et s'il y a des actions
        if (this.config.menuSection) {
            items.push({ type: 'header', label: this.config.menuSection });
        }

        // Ajouter chaque action configurée comme item de menu
        availableActions.forEach(([id, actionConfig]) => {
            if (actionConfig && actionConfig.label && typeof actionConfig.handler === 'function') {
                items.push({
                    id: id, // Utiliser la clé de l'action comme ID unique pour ce provider
                    label: actionConfig.label,
                    icon: actionConfig.icon || '' // Utiliser l'icône si fournie
                    // Le 'provider' sera ajouté par ContextMenuPlugin lors de la collecte
                });
            } else {
                 this.logger.warn(`Action TextEditor mal configurée ignorée: ${id}`, actionConfig);
            }
        });

        // Ne retourner des items que si on a ajouté autre chose que l'en-tête
        if (items.length <= (this.config.menuSection ? 1 : 0)) {
             return [];
        }

        this.debug(`Fourniture de ${items.length} item(s) de menu TextEditor pour ${cell.id}`);
        return items;
    }

    /**
     * Exécute une action demandée via le menu contextuel.
     * Appelé par ContextMenuPlugin lorsqu'un item de ce fournisseur est cliqué.
     * @param {string} actionId - L'ID de l'action (correspond à la clé dans config.actions).
     * @param {HTMLTableCellElement} cell - La cellule <td> qui était ciblée lors de l'ouverture du menu.
     */
    executeAction(actionId, cell) {
        const actionConfig = this.config.actions[actionId];

        if (!actionConfig || typeof actionConfig.handler !== 'function') {
            this.logger.error(`Action ContextMenu TextEditor non trouvée ou handler invalide pour ID: ${actionId}`);
            return;
        }

        // Récupérer la valeur actuelle de la cellule (priorité data-value)
        const currentValue = cell.getAttribute('data-value') ?? cell.textContent?.trim() ?? '';

        this.debug(`Exécution de l'action TextEditor '${actionId}' sur ${cell.id}`);
        try {
            // Appeler le handler de l'action configurée
            // Le handler reçoit (cell, currentValue) et 'this' est l'instance TextEditorPlugin
            actionConfig.handler(cell, currentValue);
        } catch (error) {
            this.logger.error(`Erreur lors de l'exécution du handler pour l'action '${actionId}': ${error.message}`, error);
            this.table?.notify('error', `Erreur lors de l'action '${actionConfig.label || actionId}'.`);
        }
    }

    // -------------------------------------------------------------------------
    // Handlers pour les Actions de Texte (Implémentations par défaut)
    // -------------------------------------------------------------------------

    /**
     * Handler pour l'action 'deleteSentence'. Supprime la première phrase.
     * @param {HTMLTableCellElement} cell - La cellule cible.
     * @param {string} text - Le texte actuel de la cellule.
     * @private
     */
    _deleteFirstSentence(cell, text) {
        if (!text) return;
        const sentences = this._splitIntoSentences(text);
        if (sentences.length <= 1) {
            this.debug('Impossible de supprimer la seule phrase restante.');
            this.updateCellValue(cell, ''); // Vider la cellule
            return;
        }
        sentences.shift(); // Supprimer la première
        this.updateCellValue(cell, sentences.join(' ').trim()); // Rejoindre et mettre à jour
    }

    /**
     * Handler pour l'action 'deleteRegexMatch'. Demande une regex et supprime les correspondances.
     * @param {HTMLTableCellElement} cell - La cellule cible.
     * @param {string} text - Le texte actuel de la cellule.
     * @private
     */
    _deleteRegexMatch(cell, text) {
        if (!text) return;
        // Demander le motif à l'utilisateur (simple prompt)
        const pattern = prompt('Entrez le texte ou le motif (regex) à supprimer:', '');
        if (pattern === null) { // Vérifier si l'utilisateur a annulé
            this.debug("Suppression par motif annulée par l'utilisateur.");
            return;
        }

        try {
            // Créer la regex globale et insensible à la casse par défaut
            const regex = new RegExp(pattern, 'gi');
            const newText = text.replace(regex, ''); // Remplacer par chaîne vide
            this.updateCellValue(cell, newText.trim()); // Mettre à jour
        } catch (error) {
            this.logger.error(`Expression régulière invalide fournie par l'utilisateur: "${pattern}"`, error);
            alert(`Expression régulière invalide: ${error.message}`);
        }
    }

    /**
     * Handler pour l'action 'capitalizeSentence'. Met la première phrase en majuscules.
     * @param {HTMLTableCellElement} cell - La cellule cible.
     * @param {string} text - Le texte actuel de la cellule.
     * @private
     */
    _capitalizeFirstSentence(cell, text) {
        if (!text) return;
        const sentences = this._splitIntoSentences(text);
        if (sentences.length === 0) return;
        sentences[0] = sentences[0].toUpperCase(); // Mettre la première en majuscules
        this.updateCellValue(cell, sentences.join(' ').trim()); // Rejoindre et mettre à jour
    }

    // -------------------------------------------------------------------------
    // Méthodes Utilitaires
    // -------------------------------------------------------------------------

    /**
     * Sépare un texte en phrases (méthode simpliste).
     * @param {string} text - Le texte à séparer.
     * @returns {string[]} Un tableau de phrases.
     * @private
     */
    _splitIntoSentences(text) {
        if (!text) return [];
        // Regex simple: coupe après ., !, ? suivi d'un espace ou fin de ligne.
         return text.split(/(?<=[.!?])\s+/).filter(s => s && s.trim() !== '');
    }

    /**
     * Met à jour la valeur d'une cellule et déclenche l'événement 'cell:change'.
     * C'est la méthode que les handlers d'action doivent appeler pour appliquer les modifications.
     * @param {HTMLTableCellElement} cell - La cellule <td> à mettre à jour.
     * @param {string} newValue - La nouvelle valeur textuelle.
     */
    updateCellValue(cell, newValue) {
        if (!cell || !this.table) return;
        const oldValue = cell.getAttribute('data-value') ?? cell.textContent?.trim() ?? '';

        // Ne rien faire si la valeur n'a pas changé
        if (newValue === oldValue) {
            this.debug(`Valeur inchangée pour ${cell.id}, pas de mise à jour par TextEditor.`);
            return;
        }
        this.debug(`Mise à jour de ${cell.id} par TextEditor: "${oldValue}" -> "${newValue}"`);

        // Mettre à jour l'attribut data-value
        cell.setAttribute('data-value', newValue);

        // Mettre à jour l'affichage (via le wrapper si possible)
        const wrapperClass = this.table.config?.wrapCellClass || 'cell-wrapper';
        const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;
        // Utiliser le sanitizer pour insérer la valeur (traiter comme texte brut)
        if (this.table.sanitizer) {
            this.table.sanitizer.setHTML(wrapper, newValue, { isPlainText: true });
        } else {
            wrapper.textContent = newValue; // Fallback
        }

        // Déclencher l'événement cell:change pour notifier les autres plugins et TableFlow
        const row = cell.closest('tr');
        const columnId = this.table.element?.querySelector(`thead th:nth-child(${cell.cellIndex + 1})`)?.id;
        const initialValue = cell.getAttribute('data-initial-value');
        const isModified = newValue !== initialValue;

        const changeEvent = new CustomEvent('cell:change', {
            detail: {
                cell: cell, cellId: cell.id, columnId: columnId, rowId: row?.id,
                value: newValue, oldValue: oldValue, initialValue: initialValue, isModified: isModified,
                source: 'textEditor', // Indiquer la source
                tableId: this.table.tableId
            },
            bubbles: true
        });
        this.table.element?.dispatchEvent(changeEvent);
        this.debug(`Événement cell:change déclenché depuis TextEditor pour ${cell.id}`);

        // La classe 'modified' sur la ligne sera gérée par le listener de cell:change
    }

    // -------------------------------------------------------------------------
    // Gestion des Raccourcis Clavier (via hook Edit)
    // -------------------------------------------------------------------------

    /**
     * Gestionnaire appelé par le hook `onKeydown` du plugin Edit.
     * Vérifie si la combinaison de touches correspond à un raccourci configuré.
     * @param {KeyboardEvent} event - L'événement keydown.
     * @param {HTMLTableCellElement} cell - La cellule en cours d'édition.
     * @param {HTMLInputElement} input - L'élément input d'édition.
     * @returns {boolean} `false` si le raccourci a été géré ici (pour empêcher Edit de continuer), `true` sinon.
     * @private
     */
    _handleKeydown(event, cell, input) {
        if (!this.config.shortcutsEnabled || !this.config.shortcuts) {
            return true; // Laisser Edit gérer
        }

        // Construire la chaîne identifiant la combinaison de touches
        let keyIdentifier = '';
        if (event.ctrlKey) keyIdentifier += 'Ctrl+';
        if (event.altKey) keyIdentifier += 'Alt+';
        if (event.shiftKey) keyIdentifier += 'Shift+';
        keyIdentifier += event.key;
        keyIdentifier = keyIdentifier.replace('Control', 'Ctrl'); // Normalisation

        const actionId = this.config.shortcuts[keyIdentifier];

        if (actionId && this.config.actions[actionId]) {
            this.debug(`Raccourci clavier détecté: ${keyIdentifier} -> Action: ${actionId}`);
            event.preventDefault();
            event.stopPropagation();

            // Exécuter l'action sur la valeur ACTUELLE de l'input
            // C'est différent de l'exécution via menu contextuel qui prend la valeur de la cellule
            const actionConfig = this.config.actions[actionId];
            if (typeof actionConfig.handler === 'function') {
                 try {
                     // Passer la valeur de l'input au handler
                     actionConfig.handler(cell, input.value);
                     // Mettre à jour l'input avec la nouvelle valeur de la cellule après l'action
                     const newValue = cell.getAttribute('data-value');
                     if (input.value !== newValue) {
                         input.value = newValue;
                         // Déclencher 'input' pour que d'autres plugins (Highlight) réagissent
                         input.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
                     }
                 } catch (error) {
                      this.logger.error(`Erreur lors de l'exécution du handler (raccourci) pour '${actionId}': ${error.message}`, error);
                      this.table?.notify('error', `Erreur lors de l'action '${actionConfig.label || actionId}'.`);
                 }
            } else {
                 this.logger.error(`Handler invalide pour l'action de raccourci '${actionId}'.`);
            }

            return false; // Indiquer à EditPlugin que l'événement a été géré
        }
        return true; // Laisser EditPlugin gérer
    }

    // -------------------------------------------------------------------------
    // Cycle de vie
    // -------------------------------------------------------------------------

    /**
     * Rafraîchit l'état du plugin (pas d'action spécifique requise ici).
     */
    refresh() {
        this.debug('Rafraîchissement du plugin TextEditor (aucune action spécifique).');
    }

    /**
     * Nettoie les ressources utilisées par le plugin (désenregistrement des hooks/providers).
     */
    destroy() {
        this.debug('Destruction du plugin TextEditor...');

        // Se désenregistrer du hook onKeydown de Edit
        if (this.config.shortcutsEnabled && this.editPlugin && typeof this.editPlugin.removeHook === 'function') {
            try {
                // Utilise le namespace 'TextEditor'
                this.editPlugin.removeHook('onKeydown', 'TextEditor');
                this.debug("Désenregistré du hook 'onKeydown' de EditPlugin.");
            } catch (error) {
                 this.logger.error(`Erreur lors du désenregistrement du hook 'onKeydown' d'Edit: ${error.message}`, error);
            }
        }

        // Se désenregistrer de ContextMenu
        if (this.contextMenuPlugin && typeof this.contextMenuPlugin.unregisterProvider === 'function') {
            try {
                this.contextMenuPlugin.unregisterProvider(this);
                this.debug("Désenregistré de ContextMenuPlugin.");
            } catch (error) {
                 this.logger.error(`Erreur lors du désenregistrement de ContextMenuPlugin: ${error.message}`, error);
            }
        }

        // Nettoyer les références
        this.table = null;
        this.editPlugin = null;
        this.contextMenuPlugin = null;
        this.debug('Plugin TextEditor détruit.');
    }
}
