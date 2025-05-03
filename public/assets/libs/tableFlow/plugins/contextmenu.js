/**
 * Plugin ContextMenu pour TableFlow
 * Fournit un framework pour afficher un menu contextuel personnalisé sur les cellules <td>.
 * Il collecte les options de menu auprès d'autres plugins enregistrés comme "providers".
 *
 * @class ContextMenuPlugin
 * @version 1.0.2 - Intégration TableInstance, nettoyage listeners, unregisterProvider
 */
export default class ContextMenuPlugin {
    /**
     * Crée une instance de ContextMenuPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'contextMenu';
        this.version = '1.0.2';
        this.type = 'ui'; // Type de plugin: fournit une interface utilisateur
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (aucunes directes) */
        this.dependencies = [];

        // Configuration par défaut fusionnée avec celle fournie
        this.config = {
            menuClass: 'tf-context-menu',         // Classe CSS pour le conteneur du menu
            menuItemClass: 'tf-menu-item',        // Classe CSS pour une option de menu
            menuSeparatorClass: 'tf-menu-separator', // Classe CSS pour un séparateur
            menuHeaderClass: 'tf-menu-header',    // Classe CSS pour un titre de section
            debug: false,                         // Activer les logs de débogage
            ...config
        };

        // État interne
        /** @type {HTMLDivElement|null} L'élément DOM du menu contextuel (potentiellement partagé) */
        this.menu = null;
        /** @type {Array<object>} Liste des plugins fournisseurs enregistrés pour CETTE instance */
        this.providers = [];
        /** @type {HTMLTableCellElement|null} La cellule <td> actuellement ciblée par le menu de CETTE instance */
        this.currentCell = null;
        /** @type {Function|null} Référence au handler pour fermer le menu en cliquant ailleurs */
        this._boundCloseMenuOnClickOutside = null;
        /** @type {Function|null} Référence au handler pour fermer le menu avec Echap */
        this._boundCloseMenuOnEscape = null;
         /** @type {Function|null} Référence au handler pour contextmenu sur la table de cette instance */
        this._boundHandleContextMenu = null;
        /** @type {boolean} Indicateur si les listeners globaux (document) sont actifs */
        this._globalListenersActive = false;


        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[ContextMenu ${this.table?.tableId}]`, ...args) ?? console.debug('[ContextMenu]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;
    }

    /**
     * Initialise le plugin pour une instance de table.
     * Crée le menu (si nécessaire) et attache les écouteurs d'événements spécifiques à l'instance.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('ContextMenuPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin ContextMenu avec la configuration:', this.config);

        // Créer ou récupérer l'élément DOM du menu (potentiellement partagé)
        this.createContextMenu();

        // Attacher les écouteurs d'événements spécifiques à cette table
        this.setupInstanceEventListeners();

        this.debug('Plugin ContextMenu initialisé pour la table.', this.table.tableId);
    }

    /**
     * Crée l'élément DIV du menu contextuel et l'ajoute au body s'il n'existe pas.
     * Le menu est créé une seule fois globalement et réutilisé par toutes les instances.
     */
    createContextMenu() {
        // Utiliser un ID fixe pour le menu global pour le retrouver facilement
        const menuId = 'tableflow-global-context-menu';
        const existingMenu = document.getElementById(menuId);

        if (existingMenu) {
            this.menu = existingMenu;
            this.debug("Menu contextuel global existant réutilisé.");
            return;
        }

        // Créer l'élément du menu
        this.menu = document.createElement('div');
        this.menu.id = menuId;
        this.menu.className = this.config.menuClass; // Appliquer la classe configurée
        // Styles essentiels
        this.menu.style.display = 'none';
        this.menu.style.position = 'fixed'; // Utiliser fixed pour éviter les problèmes de scroll parent
        this.menu.style.zIndex = '1050';

        document.body.appendChild(this.menu);
        this.debug("Élément du menu contextuel global créé et ajouté au body.");
    }

    /**
     * Attache les écouteurs d'événements spécifiques à CETTE instance de table.
     * Les écouteurs globaux (document) sont gérés dans show/hideMenu.
     */
    setupInstanceEventListeners() {
        if (!this.table?.element || !this.menu) {
             this.logger.error("Impossible d'attacher les écouteurs: table ou menu non initialisé.");
             return;
        }
        this.debug("Configuration des écouteurs d'événements pour ContextMenu (instance)...");

        // Lier le handler contextmenu pour pouvoir le supprimer
        this._boundHandleContextMenu = this.handleContextMenu.bind(this);

        // Écouter le clic droit UNIQUEMENT sur la table de cette instance
        this.table.element.addEventListener('contextmenu', this._boundHandleContextMenu);

        this.debug("Écouteur 'contextmenu' ajouté à la table:", this.table.tableId);
    }

    /**
     * Gestionnaire pour l'événement 'contextmenu' sur la table de cette instance.
     * @param {MouseEvent} event - L'événement contextmenu.
     */
    handleContextMenu(event) {
        // Trouver la cellule <td> la plus proche ciblée par l'événement
        const cell = /** @type {HTMLElement} */ (event.target)?.closest('td');
        if (!cell) {
            this.debug("Clic droit en dehors d'une cellule <td>, menu ignoré.");
            this.hideMenu(); // Masquer au cas où il serait ouvert par une autre instance
            return;
        }

        this.debug(`Clic droit détecté sur la cellule: ${cell.id} (table: ${this.table?.tableId})`);
        // Stocker la cellule ciblée pour cette instance
        this.currentCell = cell;

        // Collecter les éléments de menu auprès des fournisseurs de CETTE instance
        const menuItems = this.collectMenuItems(cell);

        if (menuItems.length === 0) {
            this.debug("Aucun item de menu fourni pour cette cellule.");
            this.hideMenu();
            return;
        }

        // Empêcher le menu natif
        event.preventDefault();
        event.stopPropagation();

        // Afficher le menu global, positionné par rapport au clic
        this.showMenu(event.clientX, event.clientY, menuItems);
    }

    /**
     * Enregistre un plugin comme fournisseur d'options de menu pour CETTE instance.
     * @param {object} provider - L'instance du plugin fournisseur.
     * @returns {this} L'instance de ContextMenuPlugin pour le chaînage.
     * @throws {Error} Si le fournisseur n'a pas les méthodes requises.
     */
    registerProvider(provider) {
        if (typeof provider?.getMenuItems !== 'function') {
            throw new Error(`Le fournisseur de menu (${provider?.name || 'inconnu'}) doit implémenter 'getMenuItems(cell)'.`);
        }
        if (typeof provider?.executeAction !== 'function') {
             throw new Error(`Le fournisseur de menu (${provider?.name || 'inconnu'}) doit implémenter 'executeAction(actionId, cell)'.`);
        }

        if (!this.providers.includes(provider)) {
            this.providers.push(provider);
            this.debug(`Fournisseur '${provider.name || 'inconnu'}' enregistré pour l'instance ${this.table?.tableId}.`);
        } else {
             this.debug(`Fournisseur '${provider.name || 'inconnu'}' déjà enregistré pour l'instance ${this.table?.tableId}.`);
        }
        return this;
    }

    /**
     * Désenregistre un fournisseur de menu pour CETTE instance.
     * @param {object} provider - L'instance du plugin fournisseur à retirer.
     */
    unregisterProvider(provider) {
        const initialLength = this.providers.length;
        this.providers = this.providers.filter(p => p !== provider);
        if (this.providers.length < initialLength) {
            this.debug(`Fournisseur '${provider?.name || 'inconnu'}' désenregistré de l'instance ${this.table?.tableId}.`);
        }
    }

    /**
     * Collecte et fusionne les items de menu des fournisseurs de CETTE instance.
     * @param {HTMLTableCellElement} cell - La cellule cible.
     * @returns {Array<object>} Tableau fusionné des items de menu.
     */
    collectMenuItems(cell) {
        let allItems = [];
        this.debug(`Collecte des items de menu pour ${cell.id} auprès de ${this.providers.length} fournisseur(s) de l'instance ${this.table?.tableId}.`);

        this.providers.forEach((provider, index) => {
            try {
                const providerItems = provider.getMenuItems(cell); // Appelle la méthode du fournisseur

                if (Array.isArray(providerItems) && providerItems.length > 0) {
                    this.debug(`Items reçus de '${provider.name || `fournisseur ${index}`}' :`, providerItems.length);
                    // Ajouter un séparateur si nécessaire
                    if (allItems.length > 0 && providerItems.some(item => item.type !== 'separator' && item.type !== 'header')) {
                        if (allItems[allItems.length - 1]?.type !== 'separator') {
                             allItems.push({ type: 'separator' });
                        }
                    }
                    // Ajouter les items en liant le fournisseur
                    providerItems.forEach(item => {
                        if (typeof item.action !== 'function') {
                             allItems.push({ ...item, provider: provider }); // Lier le fournisseur
                        } else {
                             allItems.push(item); // Action directe
                        }
                    });
                } else {
                     this.debug(`Aucun item reçu de '${provider.name || `fournisseur ${index}`}'.`);
                }
            } catch (error) {
                this.logger.error(`Erreur lors de l'appel à getMenuItems sur '${provider.name || 'inconnu'}': ${error.message}`, error);
            }
        });

        // Nettoyer les séparateurs superflus
        allItems = allItems.filter((item, i, arr) => !(item.type === 'separator' && (i === 0 || i === arr.length - 1 || arr[i - 1]?.type === 'separator')));

        this.debug(`Total items collectés pour ${cell.id}: ${allItems.length}`);
        return allItems;
    }

    /**
     * Construit, positionne et affiche le menu contextuel global.
     * Attache les listeners globaux pour la fermeture si nécessaire.
     * @param {number} x - Position X (clientX) du clic.
     * @param {number} y - Position Y (clientY) du clic.
     * @param {Array<object>} items - Tableau des items de menu à afficher.
     */
    showMenu(x, y, items) {
        if (!this.menu) {
            this.logger.error("Tentative d'affichage du menu alors qu'il n'est pas créé.");
            return;
        }
        this.debug(`Affichage du menu à (${x}, ${y}) avec ${items.length} item(s).`);

        // Vider le contenu précédent
        this.menu.innerHTML = '';
        const sanitizer = this.table?.sanitizer; // Récupérer le sanitizer

        // Créer les éléments de menu
        items.forEach(item => {
            let menuItemElement;
            switch (item.type) {
                case 'separator':
                    menuItemElement = document.createElement('div');
                    menuItemElement.className = this.config.menuSeparatorClass;
                    // Styles par défaut si non définis par CSS
                    if (!menuItemElement.computedStyleMap().get('height') || menuItemElement.computedStyleMap().get('height').value === 'auto') {
                        Object.assign(menuItemElement.style, { height: '1px', backgroundColor: '#ddd', margin: '5px 0' });
                    }
                    break;
                case 'header':
                    menuItemElement = document.createElement('div');
                    menuItemElement.className = this.config.menuHeaderClass;
                    menuItemElement.textContent = item.label || '';
                    if (!menuItemElement.computedStyleMap().get('padding-left')) {
                         Object.assign(menuItemElement.style, { padding: '5px 15px', fontWeight: 'bold', color: '#666', fontSize: '0.9em' });
                    }
                    break;
                default: // Item standard
                    menuItemElement = document.createElement('div');
                    menuItemElement.className = this.config.menuItemClass;
                    const iconHtml = item.icon ? `<span class="menu-icon">${item.icon}</span>` : '';
                    const escapedLabel = sanitizer ? sanitizer.escapeHTML(item.label || '') : (item.label || '');
                    const labelHtml = `<span class="menu-label">${escapedLabel}</span>`;

                    if (sanitizer) {
                         sanitizer.setHTML(menuItemElement, iconHtml + labelHtml, { isTrustedIcon: !!item.icon });
                    } else {
                         menuItemElement.innerHTML = iconHtml + labelHtml;
                    }

                    if (!menuItemElement.computedStyleMap().get('padding-left')) {
                        Object.assign(menuItemElement.style, { padding: '8px 15px', cursor: 'pointer', display: 'flex', alignItems: 'center' });
                    }
                    const iconSpan = menuItemElement.querySelector('.menu-icon');
                    if (iconSpan && !iconSpan.computedStyleMap().get('margin-right')) {
                        Object.assign(iconSpan.style, { marginRight: '8px', fontSize: '1.1em', width: '20px', textAlign: 'center', flexShrink: '0' });
                    }

                    menuItemElement.addEventListener('mouseover', () => menuItemElement.style.backgroundColor = '#f5f5f5');
                    menuItemElement.addEventListener('mouseout', () => menuItemElement.style.backgroundColor = '');
                    menuItemElement.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.hideMenu(); // Fermer après clic

                        // Exécuter l'action (via provider ou action directe)
                        if (typeof item.action === 'function') {
                            this.debug(`Exécution action directe pour '${item.label}'`);
                            try { item.action(this.currentCell); } catch (err) { this.logger.error(`Erreur action directe '${item.label}': ${err.message}`, err); }
                        } else if (item.provider?.executeAction) {
                            this.debug(`Exécution action '${item.id}' via provider '${item.provider.name || 'inconnu'}'`);
                            try { item.provider.executeAction(item.id, this.currentCell); } catch (err) { this.logger.error(`Erreur executeAction provider '${item.provider.name || 'inconnu'}': ${err.message}`, err); }
                        } else {
                             this.logger.warn(`Aucune action pour item '${item.label}' (id: ${item.id})`);
                        }
                    });
                    break;
            }
            if (menuItemElement) this.menu.appendChild(menuItemElement);
        });

        // Positionner le menu (fixed position)
        const menuRect = this.menu.getBoundingClientRect(); // Obtenir dimensions réelles
        const docWidth = document.documentElement.clientWidth;
        const docHeight = document.documentElement.clientHeight;
        let finalX = x, finalY = y;
        if (x + menuRect.width > docWidth) finalX = docWidth - menuRect.width - 5;
        if (y + menuRect.height > docHeight) finalY = docHeight - menuRect.height - 5;
        finalX = Math.max(5, finalX);
        finalY = Math.max(5, finalY);

        this.menu.style.left = `${finalX}px`;
        this.menu.style.top = `${finalY}px`;
        this.menu.style.display = 'block'; // Afficher

        // Ajouter les listeners globaux pour fermer le menu s'ils ne sont pas déjà actifs
        this.addGlobalCloseListeners();
    }

    /** Masque le menu contextuel et nettoie les listeners globaux si nécessaire. */
    hideMenu() {
        if (this.menu && this.menu.style.display !== 'none') {
            this.menu.style.display = 'none';
            this.currentCell = null;
            this.debug("Menu contextuel masqué.");
            // Supprimer les listeners globaux maintenant que le menu est fermé
            this.removeGlobalCloseListeners();
        }
    }

    /** Ajoute les listeners sur document pour fermer le menu. */
    addGlobalCloseListeners() {
        if (!this._globalListenersActive) {
             // Lier les méthodes si pas déjà fait (normalement fait dans setupInstanceEventListeners)
             if (!this._boundCloseMenuOnClickOutside) this._boundCloseMenuOnClickOutside = this.closeMenuOnClickOutside.bind(this);
             if (!this._boundCloseMenuOnEscape) this._boundCloseMenuOnEscape = this.closeMenuOnEscape.bind(this);

             // Utiliser requestAnimationFrame pour éviter fermeture par le clic d'ouverture
             requestAnimationFrame(() => {
                 document.addEventListener('click', this._boundCloseMenuOnClickOutside, true); // Capture phase
                 document.addEventListener('keydown', this._boundCloseMenuOnEscape);
                 this._globalListenersActive = true;
                 this.debug("Listeners globaux pour fermer le menu ajoutés.");
             });
        }
    }

    /** Supprime les listeners sur document pour fermer le menu. */
    removeGlobalCloseListeners() {
        if (this._globalListenersActive) {
            if (this._boundCloseMenuOnClickOutside) document.removeEventListener('click', this._boundCloseMenuOnClickOutside, true);
            if (this._boundCloseMenuOnEscape) document.removeEventListener('keydown', this._boundCloseMenuOnEscape);
            this._globalListenersActive = false;
            this.debug("Listeners globaux pour fermer le menu retirés.");
        }
    }


    /** Gestionnaire pour fermer le menu lors d'un clic en dehors. @param {MouseEvent} event @private */
    closeMenuOnClickOutside(event) {
        if (this.menu && !this.menu.contains(/** @type {Node} */ (event.target))) {
            this.debug("Clic détecté en dehors du menu, fermeture.");
            this.hideMenu();
        }
    }

    /** Gestionnaire pour fermer le menu avec Echap. @param {KeyboardEvent} event @private */
    closeMenuOnEscape(event) {
        if (event.key === 'Escape') {
            this.debug("Touche Echap détectée, fermeture du menu.");
            this.hideMenu();
        }
    }


    /** Rafraîchit l'état du plugin (aucune action spécifique requise). */
    refresh() {
        this.debug('Rafraîchissement du plugin ContextMenu (aucune action spécifique).');
    }

    /** Nettoie les ressources (écouteurs d'événements spécifiques à l'instance). */
    destroy() {
        this.debug(`Destruction du plugin ContextMenu pour l'instance ${this.table?.tableId}...`);
        // Supprimer l'écouteur sur la table de cette instance
        if (this.table?.element && this._boundHandleContextMenu) {
            this.table.element.removeEventListener('contextmenu', this._boundHandleContextMenu);
            this.debug("Écouteur 'contextmenu' retiré de la table.");
        }

        // S'assurer que les listeners globaux sont retirés si cette instance les avait activés
        // (hideMenu est appelé, ce qui devrait le faire)
        this.hideMenu();

        // Ne PAS supprimer le menu global du DOM ici, car il peut être utilisé par d'autres instances.
        // Le nettoyage du menu global devrait être géré par instanceManager.destroyAll ou similaire.

        // Vider la liste des fournisseurs pour cette instance
        this.providers = [];
        this.table = null; // Effacer la référence
        this.debug(`Plugin ContextMenu détruit pour l'instance.`);
    }
}
