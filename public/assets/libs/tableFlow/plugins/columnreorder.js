/**
 * Plugin ColumnReorderPlugin pour TableFlow
 * Permet de réorganiser les colonnes d'un tableau par glisser-déposer des en-têtes.
 * Gère la persistance de l'ordre via localStorage et fournit des indicateurs visuels.
 *
 * @class ColumnReorderPlugin
 * @version 1.0.2 - Intégration TableInstance et améliorations
 */
export default class ColumnReorderPlugin {
    /**
     * Crée une instance de ColumnReorderPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'columnreorder';
        this.version = '1.0.2';
        this.type = 'interaction'; // Type de plugin
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (aucunes pour l'instant) */
        this.dependencies = [];

        // Configuration par défaut fusionnée avec celle fournie
        this.config = {
            enabled: true,
            handleSelector: '.column-drag-handle',  // Sélecteur CSS pour la poignée
            handleHTML: '<div class="column-drag-handle" title="Glisser pour réorganiser"><i class="fas fa-grip-vertical"></i></div>', // HTML de la poignée
            handlePosition: 'prepend',             // 'prepend', 'append', ou 'replace'
            reorderableClass: 'reorderable-column', // Classe pour les <th> réorganisables
            draggingClass: 'column-dragging',       // Classe pour le <th> pendant le glissement
            dropIndicatorClass: 'column-drop-indicator', // Classe pour l'indicateur de dépôt
            headerContainerClass: 'column-header-container', // Classe pour le conteneur ajouté dans le <th>
            // dragThreshold: 5, // Seuil de déplacement (non implémenté dans cette version)
            // animationDuration: 300, // Durée d'animation (non implémenté dans cette version)
            excludeSelector: '[th-noreorder], [th-actions], [th-hide]', // Sélecteur CSS pour exclure des colonnes (actions et hide exclus par défaut)
            persistOrder: true,                    // Enregistrer l'ordre dans le localStorage
            storageKey: null,                      // Clé pour localStorage (défaut: tableId + '_columnOrder')
            dragImageOpacity: 0.7,                 // Opacité de l'élément fantôme
            resetOnDestroy: false,                 // Réinitialiser l'ordre lors de la destruction?

            // Callbacks
            onColumnReorder: null,                 // func({ from, to, columnId, originalIndex, newOrder })
            onDragStart: null,                     // func({ columnId, index, originalIndex, element })
            onDragEnd: null,                       // func({ sourceIndex, targetIndex, newOrder })

            debug: false,                          // Mode debug
            ...config                              // Fusionner avec la config passée
        };

        // État interne du plugin
        this.state = {
            isInitialized: false,
            isDragging: false,
            draggedColumn: null, // HTMLElement <th>
            draggedIndex: -1,    // Index *actuel* (dans columnOrder) de la colonne glissée
            draggedOriginalIndex: -1, // Index *original* (DOM initial) de la colonne glissée
            dragStartX: 0,
            dragStartY: 0,
            ghostElement: null, // HTMLElement fantôme
            ghostOffsetX: 0,
            ghostOffsetY: 0,
            dropIndicator: null, // HTMLElement indicateur
            currentDropIndex: -1, // Index *actuel* où la colonne serait déposée
            columnOrder: [],      // Ordre actuel des indices originaux [2, 0, 1]
            originalOrder: [],    // Ordre initial des indices [0, 1, 2]
            headerElements: [],   // Cache des infos sur les <th> { element, index, id, width, reorderable }
            eventHandlers: {},    // Stockage des références aux handlers pour le nettoyage
            mutationObserver: null,
        };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[ColReorder ${this.table?.tableId}]`, ...args) ?? console.debug('[ColReorder]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Lier les méthodes pour préserver le contexte 'this'
        this._bindMethods();
    }

    /** Lie les méthodes utilisées comme gestionnaires d'événements. @private */
    _bindMethods() {
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleTableChange = this.handleTableChange.bind(this);
        // _handleBodyUserSelect n'est plus nécessaire avec la classe sur body
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('ColumnReorderPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin ColumnReorder avec la configuration:', this.config);

        if (!this.config.enabled) {
            this.debug('Plugin désactivé par la configuration.');
            return;
        }

        // Configurer la clé de stockage
        if (!this.config.storageKey && this.config.persistOrder && this.table.tableId) {
            this.config.storageKey = `${this.table.tableId}_columnOrder`;
            this.debug(`Clé de stockage configurée automatiquement: ${this.config.storageKey}`);
        }

        // Injecter les styles CSS (une seule fois par page)
        this.injectStyles(); // Note: Devrait idéalement être dans un fichier CSS séparé

        // Analyser la structure initiale
        if (!this.analyzeTableStructure()) {
            this.logger.warn("Analyse initiale de la structure échouée (pas d'en-tête?), plugin non pleinement initialisé.");
            return; // Ne pas continuer si la structure est invalide
        }

        // Charger et appliquer l'ordre sauvegardé si valide
        if (this.config.persistOrder) {
            this.loadColumnOrder();
        }

        // Configurer les poignées sur les en-têtes
        this.setupDragHandles();

        // Créer l'indicateur de dépôt
        this.createDropIndicator();

        // Attacher les écouteurs d'événements
        this.setupEventListeners();

        // Configurer l'observateur de mutations
        this.setupMutationObserver();

        this.state.isInitialized = true;
        this.debug('Plugin ColumnReorder initialisé avec succès.');
    }

    /**
     * Analyse la structure de l'en-tête de la table pour identifier les colonnes.
     * Initialise ou met à jour `this.state.headerElements`.
     * Initialise `this.state.columnOrder` et `this.state.originalOrder` si nécessaire.
     * @returns {boolean} True si la structure est valide, false sinon.
     */
    analyzeTableStructure() {
        const thead = this.table.element.querySelector('thead');
        const headerRow = thead?.rows?.[0];

        if (!headerRow || headerRow.cells.length === 0) {
            this.logger.warn('Aucune ligne d\'en-tête (thead tr) ou aucune cellule (th) trouvée.');
            this.state.headerElements = []; // Vider si invalide
            return false;
        }

        // Mettre à jour les informations des en-têtes
        this.state.headerElements = Array.from(headerRow.cells).map((th, index) => ({
            element: th,
            index: index, // Index original dans le DOM initial (important!)
            id: th.id || `th_idx_${index}`, // ID plus robuste si absent
            width: th.offsetWidth,
            reorderable: !th.matches(this.config.excludeSelector),
        }));

        // Initialiser l'ordre seulement si ce n'est pas déjà fait ou si le nombre de colonnes a changé
        if (this.state.columnOrder.length === 0 || this.state.columnOrder.length !== this.state.headerElements.length) {
            this.state.columnOrder = this.state.headerElements.map(h => h.index); // Ordre initial = indices originaux
            // Sauvegarder l'ordre original la première fois
            if (this.state.originalOrder.length === 0 || this.state.originalOrder.length !== this.state.headerElements.length) {
                this.state.originalOrder = [...this.state.columnOrder];
            }
             this.debug(`Ordre initialisé: [${this.state.columnOrder.join(', ')}]`);
        } else {
             // Si l'ordre existe déjà, vérifier sa cohérence (si des colonnes ont été ajoutées/supprimées)
             const currentOriginalIndexes = new Set(this.state.headerElements.map(h => h.index));
             const orderIsValid = this.state.columnOrder.every(idx => currentOriginalIndexes.has(idx)) &&
                                this.state.columnOrder.length === currentOriginalIndexes.size;
             if (!orderIsValid) {
                 this.logger.warn("L'ordre interne des colonnes est incohérent avec la structure actuelle. Réinitialisation de l'ordre.");
                 this.state.columnOrder = this.state.headerElements.map(h => h.index);
                 this.state.originalOrder = [...this.state.columnOrder];
                 // Supprimer l'ordre potentiellement invalide du localStorage?
                 if (this.config.persistOrder && this.config.storageKey) {
                     localStorage.removeItem(this.config.storageKey);
                 }
             } else {
                this.debug(`Analyse structure: ${this.state.headerElements.length} colonnes. Ordre existant conservé: [${this.state.columnOrder.join(', ')}]`);
             }
        }

        // Limitation connue: Ne gère pas colspan/rowspan.
        if (Array.from(headerRow.cells).some(th => th.colSpan > 1 || th.rowSpan > 1)) {
            this.logger.warn("L'en-tête contient colspan/rowspan. La réorganisation peut être incorrecte.");
        }
        return true;
    }

    /**
     * Ajoute les poignées de glisser-déposer aux en-têtes réorganisables.
     */
    setupDragHandles() {
        this.debug("Configuration des poignées de drag...");
        this.state.headerElements.forEach(headerInfo => {
            const th = headerInfo.element;

            // Nettoyer ancienne poignée et classe avant de reconfigurer
            const existingHandle = th.querySelector(this.config.handleSelector);
            if (existingHandle) existingHandle.remove();
            th.classList.remove(this.config.reorderableClass);

            if (!headerInfo.reorderable) {
                // this.debug(`Colonne ${headerInfo.id} non réorganisable.`);
                return;
            }

            th.classList.add(this.config.reorderableClass);

            // Trouver ou créer le conteneur interne
            // Utiliser la classe configurée pour le wrapper d'en-tête
            const wrapperClass = this.table?.config?.wrapHeaderClass || 'head-wrapper';
            let headerContainer = th.querySelector(`.${this.config.headerContainerClass}`); // Utilise la classe spécifique du plugin
            if (!headerContainer) {
                // Si le conteneur spécifique n'existe pas, vérifier si le wrapper général existe
                headerContainer = th.querySelector(`.${wrapperClass}`);
                if (!headerContainer) {
                    // Si aucun wrapper n'existe, en créer un avec la classe générale
                    this.debug(`Wrapper d'en-tête .${wrapperClass} manquant pour ${headerInfo.id}, création...`);
                    headerContainer = document.createElement('div');
                    headerContainer.className = wrapperClass;
                    while (th.firstChild) headerContainer.appendChild(th.firstChild);
                    th.appendChild(headerContainer);
                }
                // Ajouter la classe spécifique du plugin au wrapper existant ou nouveau
                headerContainer.classList.add(this.config.headerContainerClass);
            }


            // Créer et insérer la nouvelle poignée
            try {
                const template = document.createElement('template');
                // Utiliser le sanitizer si disponible pour le HTML de la poignée
                if (this.table?.sanitizer) {
                     this.table.sanitizer.setHTML(template, this.config.handleHTML.trim(), { isTrustedIcon: true });
                } else {
                     template.innerHTML = this.config.handleHTML.trim(); // Fallback
                }
                const handleElement = template.content.firstChild;

                if (!handleElement || !(handleElement instanceof Element)) throw new Error("handleHTML invalide.");
                if (!handleElement.matches(this.config.handleSelector)) {
                    this.logger.warn(`L'élément racine de handleHTML ne correspond pas au handleSelector ('${this.config.handleSelector}').`);
                }

                if (this.config.handlePosition === 'append') headerContainer.appendChild(handleElement);
                else if (this.config.handlePosition === 'replace') {
                    headerContainer.innerHTML = '';
                    headerContainer.appendChild(handleElement);
                } else headerContainer.insertBefore(handleElement, headerContainer.firstChild); // prepend par défaut

            } catch (error) {
                 this.logger.error(`Erreur création/insertion poignée pour ${headerInfo.id}: ${error.message}`, error);
            }
        });
    }

    /** Crée l'indicateur de dépôt (une seule fois). */
    createDropIndicator() {
        if (!this.state.dropIndicator) {
            this.state.dropIndicator = document.createElement('div');
            this.state.dropIndicator.className = this.config.dropIndicatorClass;
            this.state.dropIndicator.style.display = 'none';
            this.state.dropIndicator.style.position = 'fixed'; // Important pour positionnement absolu écran
            this.state.dropIndicator.style.pointerEvents = 'none';
            document.body.appendChild(this.state.dropIndicator);
            this.debug('Indicateur de dépôt créé.');
        }
    }

    /** Attache les écouteurs d'événements. */
    setupEventListeners() {
        this.debug('Configuration des écouteurs d\'événements...');
        const tableElement = this.table?.element;
        if (!tableElement) return;

        // Supprimer les anciens listeners avant d'ajouter les nouveaux (sécurité pour refresh)
        this._removeEventListeners(); // Appelle la méthode de nettoyage

        // Attacher les nouveaux listeners
        tableElement.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        tableElement.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd);
        document.addEventListener('touchcancel', this.handleTouchEnd);
        tableElement.addEventListener('row:added', this.handleTableChange);
        tableElement.addEventListener('row:removed', this.handleTableChange);

        // Stocker les références pour le futur nettoyage
        this.state.eventHandlers = {
            mousedown: this.handleMouseDown, mousemove: this.handleMouseMove, mouseup: this.handleMouseUp,
            touchstart: this.handleTouchStart, touchmove: this.handleTouchMove, touchend: this.handleTouchEnd,
            tablechange: this.handleTableChange
        };
        this.debug('Écouteurs d\'événements drag & drop configurés.');
    }

    /** Supprime les écouteurs d'événements principaux. @private */
    _removeEventListeners() {
        const tableElement = this.table?.element;
        const handlers = this.state.eventHandlers;
        if (tableElement && handlers) {
            tableElement.removeEventListener('mousedown', handlers.mousedown);
            document.removeEventListener('mousemove', handlers.mousemove);
            document.removeEventListener('mouseup', handlers.mouseup);
            tableElement.removeEventListener('touchstart', handlers.touchstart);
            document.removeEventListener('touchmove', handlers.touchmove);
            document.removeEventListener('touchend', handlers.touchend);
            document.removeEventListener('touchcancel', handlers.touchend); // Même handler que touchend
            tableElement.removeEventListener('row:added', handlers.tablechange);
            tableElement.removeEventListener('row:removed', handlers.tablechange);
            this.debug("Anciens écouteurs d'événements principaux retirés.");
        }
        this.state.eventHandlers = {}; // Vider les références stockées
    }


    /** Configure un MutationObserver pour rafraîchir en cas de changement structurel. */
    setupMutationObserver() {
        if (!window.MutationObserver || this.state.mutationObserver) return;

        this.state.mutationObserver = new MutationObserver(mutations => {
            const isRelevantChange = mutations.some(mutation =>
                mutation.type === 'childList' &&
                (Array.from(mutation.addedNodes).some(n => n.nodeType === 1 && ['TR', 'TH', 'TD', 'THEAD', 'TBODY', 'TFOOT'].includes(n.nodeName)) ||
                 Array.from(mutation.removedNodes).some(n => n.nodeType === 1 && ['TR', 'TH', 'TD', 'THEAD', 'TBODY', 'TFOOT'].includes(n.nodeName)))
            );

            if (isRelevantChange) {
                this.debug('MutationObserver: Changement structurel détecté, refresh différé...');
                // Utiliser requestAnimationFrame pour s'assurer que le DOM est stable
                requestAnimationFrame(() => this.refresh());
            }
        });

        this.state.mutationObserver.observe(this.table.element, { childList: true, subtree: true });
        this.debug('MutationObserver configuré.');
    }

    // --- Gestion du Drag & Drop ---

    /** Gestionnaire mousedown. @param {MouseEvent} event */
    handleMouseDown(event) {
        if (event.button !== 0) return; // Seulement clic gauche
        const handle = /** @type {HTMLElement} */ (event.target)?.closest(this.config.handleSelector);
        if (!handle) return;
        const headerCell = /** @type {HTMLTableCellElement} */ (handle.closest('th'));
        if (!headerCell || !headerCell.classList.contains(this.config.reorderableClass)) return;

        const headerInfo = this.state.headerElements.find(h => h.element === headerCell);
        if (!headerInfo) return;

        event.preventDefault(); // Empêcher sélection texte
        this.startDrag(headerCell, headerInfo.index, event.clientX, event.clientY);
    }

    /** Gestionnaire touchstart. @param {TouchEvent} event */
    handleTouchStart(event) {
        const touch = event.touches[0];
        if (!touch) return;
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const handle = element?.closest(this.config.handleSelector);
        if (!handle) return;
        const headerCell = /** @type {HTMLTableCellElement} */ (handle.closest('th'));
        if (!headerCell || !headerCell.classList.contains(this.config.reorderableClass)) return;

        const headerInfo = this.state.headerElements.find(h => h.element === headerCell);
        if (!headerInfo) return;

        event.preventDefault(); // Empêcher scroll
        this.startDrag(headerCell, headerInfo.index, touch.clientX, touch.clientY);
    }

    /**
     * Initialise le glissement.
     * @param {HTMLTableCellElement} headerCell - Le <th> glissé.
     * @param {number} originalHeaderIndex - L'index *original* (DOM initial) de la colonne.
     * @param {number} clientX - Position X initiale.
     * @param {number} clientY - Position Y initiale.
     */
    startDrag(headerCell, originalHeaderIndex, clientX, clientY) {
        if (this.state.isDragging) return; // Éviter double drag

        const currentOrderIndex = this.state.columnOrder.indexOf(originalHeaderIndex);
        if (currentOrderIndex === -1) {
             this.logger.error(`[startDrag] Index actuel non trouvé pour index original ${originalHeaderIndex}.`);
             return;
        }

        this.state.isDragging = true;
        this.state.draggedColumn = headerCell;
        this.state.draggedIndex = currentOrderIndex; // Index dans l'ordre actuel
        this.state.draggedOriginalIndex = originalHeaderIndex; // Index original
        this.state.dragStartX = clientX;
        this.state.dragStartY = clientY;
        this.state.currentDropIndex = -1;

        headerCell.classList.add(this.config.draggingClass);
        document.body.classList.add('user-select-none'); // Classe pour CSS global (ex: cursor, user-select)

        this.createGhostElement(headerCell, clientX, clientY);
        this.debug(`Début drag colonne ${headerCell.id} (original ${originalHeaderIndex}, actuel ${currentOrderIndex})`);

        // Callback onDragStart
        if (typeof this.config.onDragStart === 'function') {
            try {
                this.config.onDragStart({
                    columnId: headerCell.id,
                    index: currentOrderIndex, // Index actuel
                    originalIndex: originalHeaderIndex,
                    element: headerCell
                });
            } catch (error) {
                this.logger.error(`Erreur dans callback onDragStart: ${error.message}`, error);
            }
        }
    }

     /** Crée l'élément fantôme. @param {HTMLTableCellElement} headerCell @param {number} clientX @param {number} clientY */
     createGhostElement(headerCell, clientX, clientY) {
         if (this.state.ghostElement) this.state.ghostElement.remove();
         const ghost = /** @type {HTMLElement} */ (headerCell.cloneNode(true));
         ghost.classList.add('column-reorder-ghost'); // Classe pour style
         const rect = headerCell.getBoundingClientRect();
         this.state.ghostOffsetX = clientX - rect.left;
         this.state.ghostOffsetY = clientY - rect.top;
         // Appliquer styles via CSS et inline pour position/taille
         Object.assign(ghost.style, {
             position: 'fixed', left: '0px', top: '0px', // Positionné par transform
             width: `${rect.width}px`, height: `${rect.height}px`,
             opacity: this.config.dragImageOpacity.toString(),
             transform: `translate(${rect.left}px, ${rect.top}px)` // Position initiale
         });
         document.body.appendChild(ghost);
         this.state.ghostElement = ghost;
         this.debug("Élément fantôme créé.");
     }

    /** Gestionnaire mousemove. @param {MouseEvent} event */
    handleMouseMove(event) {
        if (!this.state.isDragging) return;
        // Utiliser requestAnimationFrame pour la fluidité
        requestAnimationFrame(() => {
            if (!this.state.isDragging) return; // Vérifier à nouveau
            this.moveGhostElement(event.clientX, event.clientY);
            this.updateDropPosition(event.clientX);
        });
    }

    /** Gestionnaire touchmove. @param {TouchEvent} event */
    handleTouchMove(event) {
        if (!this.state.isDragging) return;
        const touch = event.touches[0];
        if (!touch) return;
        event.preventDefault(); // Empêcher scroll
        requestAnimationFrame(() => {
            if (!this.state.isDragging) return;
            this.moveGhostElement(touch.clientX, touch.clientY);
            this.updateDropPosition(touch.clientX);
        });
    }

    /** Déplace l'élément fantôme via transform. @param {number} clientX @param {number} clientY */
    moveGhostElement(clientX, clientY) {
        if (!this.state.ghostElement) return;
        const left = clientX - this.state.ghostOffsetX;
        const top = clientY - this.state.ghostOffsetY;
        this.state.ghostElement.style.transform = `translate(${left}px, ${top}px)`;
    }

    /** Met à jour la position de l'indicateur de dépôt. @param {number} clientX */
    updateDropPosition(clientX) {
        let potentialDropIndex = -1; // Index dans l'ordre *actuel* du DOM
        let indicatorXPosition = -1;
        // Récupérer les en-têtes dans l'ordre actuel du DOM
        const currentHeaders = this.table.element?.querySelectorAll('thead th');
        if (!currentHeaders) return;

        for (let i = 0; i < currentHeaders.length; i++) {
            const header = /** @type {HTMLTableCellElement} */ (currentHeaders[i]);
            const headerInfo = this.state.headerElements.find(h => h.element === header);

            // Ignorer si la colonne cible n'est pas réorganisable
            if (!headerInfo?.reorderable) continue;

            const rect = header.getBoundingClientRect();
            const midpoint = rect.left + rect.width / 2;

            if (clientX < midpoint) {
                potentialDropIndex = i;
                indicatorXPosition = rect.left;
                break;
            }
            if (i === currentHeaders.length - 1) { // Dernière colonne
                potentialDropIndex = i + 1;
                indicatorXPosition = rect.right;
                break;
            }
        }

        // L'index `potentialDropIndex` est l'index DOM actuel où l'insertion aurait lieu.
        // C'est aussi l'index dans le tableau `columnOrder` où l'élément serait inséré.
        const targetOrderIndex = potentialDropIndex;

        // Vérifier si le dépôt est valide (pas sur soi-même ou juste à côté)
        const draggedCurrentIndex = this.state.draggedIndex; // Index actuel de l'élément glissé
        if (targetOrderIndex === draggedCurrentIndex || targetOrderIndex === draggedCurrentIndex + 1) {
            this.hideDropIndicator();
            this.state.currentDropIndex = -1; // Marquer comme invalide
        } else if (targetOrderIndex !== -1) {
            this.showDropIndicator(indicatorXPosition);
            this.state.currentDropIndex = targetOrderIndex; // Stocker l'index de dépôt (dans l'ordre actuel)
        } else {
            this.hideDropIndicator();
            this.state.currentDropIndex = -1;
        }
    }

    /** Affiche l'indicateur. @param {number} positionX */
    showDropIndicator(positionX) {
        if (!this.state.dropIndicator || !this.table?.element) return;
        const tableRect = this.table.element.getBoundingClientRect();
        // Positionner l'indicateur
        const indicatorWidth = this.state.dropIndicator.offsetWidth || 4; // Prendre la largeur réelle ou 4px
        this.state.dropIndicator.style.left = `${positionX - (indicatorWidth / 2)}px`; // Centrer l'indicateur
        this.state.dropIndicator.style.top = `${tableRect.top + window.scrollY}px`; // Position Y + scroll
        this.state.dropIndicator.style.height = `${tableRect.height}px`;
        this.state.dropIndicator.style.display = 'block';
    }

    /** Masque l'indicateur. */
    hideDropIndicator() {
        if (this.state.dropIndicator) {
            this.state.dropIndicator.style.display = 'none';
        }
    }

    /** Gestionnaire mouseup. @param {MouseEvent} event */
    handleMouseUp(event) {
        if (!this.state.isDragging || event.button !== 0) return;
        this.finishDrag();
    }

    /** Gestionnaire touchend/touchcancel. */
    handleTouchEnd() {
        if (!this.state.isDragging) return;
        this.finishDrag();
    }

    /** Termine le drag et effectue la réorganisation si valide. */
    finishDrag() {
        this.debug(`Fin du drag. Index de dépôt potentiel (actuel): ${this.state.currentDropIndex}`);
        const sourceIndex = this.state.draggedIndex; // Index actuel de départ
        const targetIndex = this.state.currentDropIndex; // Index actuel d'arrivée (-1 si invalide)

        if (targetIndex !== -1) { // Si l'index de dépôt est valide
            try {
                // Passe les index actuels (avant correction interne)
                this.reorderColumns(sourceIndex, targetIndex);
            } catch (error) {
                 this.logger.error(`Erreur lors de reorderColumns: ${error.message}`, error);
            }
        } else {
             this.debug("Aucun déplacement valide effectué.");
        }

        this.cleanupDragState(); // Nettoyer l'état et l'UI

        // Callback onDragEnd
        if (typeof this.config.onDragEnd === 'function') {
            try {
                this.config.onDragEnd({
                    sourceIndex: sourceIndex,
                    targetIndex: targetIndex, // Peut être -1
                    newOrder: [...this.state.columnOrder] // Nouvel ordre des indices originaux
                });
            } catch (error) {
                this.logger.error(`Erreur dans callback onDragEnd: ${error.message}`, error);
            }
        }
    }

    /** Nettoie l'état et les éléments visuels du drag. */
    cleanupDragState() {
        if (this.state.draggedColumn) {
            this.state.draggedColumn.classList.remove(this.config.draggingClass);
        }
        document.body.classList.remove('user-select-none');
        if (this.state.ghostElement) {
            this.state.ghostElement.remove();
            this.state.ghostElement = null;
        }
        this.hideDropIndicator();
        this.state.isDragging = false;
        this.state.draggedColumn = null;
        this.state.draggedIndex = -1;
        this.state.draggedOriginalIndex = -1;
        this.state.currentDropIndex = -1;
        this.debug("État du drag nettoyé.");
    }

    /**
     * Réorganise les colonnes logiquement et dans le DOM.
     * @param {number} currentFromIndex - Index actuel (dans columnOrder) de la colonne à déplacer.
     * @param {number} currentToIndex - Index actuel (dans columnOrder) où insérer la colonne.
     */
    reorderColumns(currentFromIndex, currentToIndex) {
        // 1. Mettre à jour le tableau `columnOrder` (ordre des indices originaux)
        const newOrder = [...this.state.columnOrder];
        const movedOriginalIndex = newOrder.splice(currentFromIndex, 1)[0];
        const correctedToIndex = (currentFromIndex < currentToIndex) ? currentToIndex - 1 : currentToIndex;
        newOrder.splice(correctedToIndex, 0, movedOriginalIndex);
        this.state.columnOrder = newOrder;
        this.debug(`Nouvel ordre des indices originaux: [${this.state.columnOrder.join(', ')}]`);

        // 2. Appliquer le nouvel ordre au DOM
        this.applyColumnOrder();

        // 3. Sauvegarder si persistance activée
        if (this.config.persistOrder) this.saveColumnOrder();

        // 4. Déclencher callback et événement
        const columnId = this.state.headerElements.find(h => h.index === movedOriginalIndex)?.id || `original_${movedOriginalIndex}`;
        if (typeof this.config.onColumnReorder === 'function') {
            try {
                this.config.onColumnReorder({
                    from: currentFromIndex, to: correctedToIndex, columnId, originalIndex: movedOriginalIndex, newOrder: [...this.state.columnOrder]
                });
            } catch (e) { this.logger.error(`Erreur callback onColumnReorder: ${e.message}`, e); }
        }
        const event = new CustomEvent('column:reordered', {
            detail: { from: currentFromIndex, to: correctedToIndex, columnId, originalIndex: movedOriginalIndex, newOrder: [...this.state.columnOrder], tableId: this.table.tableId },
            bubbles: true
        });
        this.table.element.dispatchEvent(event);
        this.debug(`Événement 'column:reordered' déclenché.`);
    }

    /** Applique l'ordre actuel (`this.state.columnOrder`) au DOM. */
    applyColumnOrder() {
        this.debug("Application de l'ordre au DOM...");
        const table = this.table.element;
        const newOrderIndexes = this.state.columnOrder; // Ordre des indices originaux

        const moveCellsInRow = (row) => {
            const currentCells = Array.from(row.cells);
            const fragment = document.createDocumentFragment();
            const cellMap = new Map();
            // Mapper l'index original à la cellule actuelle dans le DOM
            currentCells.forEach((cell, currentDomIndex) => {
                const originalIndex = this.state.columnOrder[currentDomIndex];
                if (originalIndex !== undefined) cellMap.set(originalIndex, cell);
            });
            // Ajouter au fragment dans le nouvel ordre
            newOrderIndexes.forEach(originalIndex => {
                const cellToMove = cellMap.get(originalIndex);
                if (cellToMove) fragment.appendChild(cellToMove);
                else this.logger.warn(`Cellule non trouvée pour index original ${originalIndex} dans ligne ${row.id}`);
            });
            row.appendChild(fragment); // Réinsérer
        };

        // Réorganiser thead, tbody, tfoot
        ['thead', 'tbody', 'tfoot'].forEach(tag => {
            const section = table.querySelector(tag);
            if (section) { Array.from(section.rows).forEach(row => moveCellsInRow(row)); this.debug(`Section '${tag}' réorganisée.`); }
        });

        // Important: Ré-analyser la structure après modification pour màj headerElements.index etc.
        this.analyzeTableStructure();
        // Reconfigurer les poignées car les éléments ont été déplacés/recréés
        this.setupDragHandles();

        this.debug("Application de l'ordre au DOM terminée.");
    }

    /** Gestionnaire pour row:added/row:removed. */
    handleTableChange(event) {
        this.debug(`Événement ${event.type} détecté, refresh différé...`);
        requestAnimationFrame(() => this.refresh());
    }

    // --- Persistance ---

    /** Sauvegarde l'ordre actuel dans localStorage. */
    saveColumnOrder() {
        if (!this.config.persistOrder || !this.config.storageKey) return;
        try {
            const orderData = {
                order: this.state.columnOrder,
                columns: this.state.headerElements.slice().sort((a, b) => a.index - b.index).map(h => h.id), // IDs dans l'ordre original
                timestamp: Date.now()
            };
            localStorage.setItem(this.config.storageKey, JSON.stringify(orderData));
            this.debug('Ordre sauvegardé:', orderData);
        } catch (error) {
            this.logger.error(`Erreur sauvegarde localStorage: ${error.message}`, error);
        }
    }

    /** Charge et applique l'ordre depuis localStorage. */
    loadColumnOrder() {
        if (!this.config.persistOrder || !this.config.storageKey) return;
        try {
            const savedData = localStorage.getItem(this.config.storageKey);
            if (!savedData) return;
            const orderData = JSON.parse(savedData);

            // Validation de cohérence
            const currentHeadersOriginalOrder = this.state.headerElements.slice().sort((a, b) => a.index - b.index);
            const currentColumnIdsOriginalOrder = currentHeadersOriginalOrder.map(h => h.id);
            if (!orderData.order || !orderData.columns || orderData.order.length !== this.state.headerElements.length || orderData.columns.length !== currentColumnIdsOriginalOrder.length || !orderData.columns.every((id, i) => id === currentColumnIdsOriginalOrder[i])) {
                this.logger.warn("Ordre localStorage invalide/incohérent. Ignoré."); localStorage.removeItem(this.config.storageKey); return;
            }
            const maxIndex = this.state.headerElements.length - 1; const uniqueIndexes = new Set(orderData.order);
             if (orderData.order.some(idx => typeof idx !== 'number' || idx < 0 || idx > maxIndex) || uniqueIndexes.size !== orderData.order.length) {
                 this.logger.warn("Ordre localStorage indices invalides/doublons. Ignoré."); localStorage.removeItem(this.config.storageKey); return;
             }

            // Appliquer l'ordre sauvegardé
            this.state.columnOrder = orderData.order;
            this.applyColumnOrder();
            this.debug('Ordre restauré depuis localStorage:', this.state.columnOrder);

        } catch (error) {
            this.logger.error(`Erreur chargement/application ordre localStorage: ${error.message}`, error);
            localStorage.removeItem(this.config.storageKey);
        }
    }

    // --- API Publique / Méthodes ---

    /** Réinitialise l'ordre des colonnes à l'original. */
    resetColumnOrder() {
        this.debug('Réinitialisation de l\'ordre...');
        if (this.state.originalOrder.length !== this.state.headerElements.length) {
             this.logger.warn("Ordre original manquant/incohérent. Réinitialisation à 0, 1, 2...");
             this.state.columnOrder = this.state.headerElements.map(h => h.index);
        } else {
             this.state.columnOrder = [...this.state.originalOrder];
        }
        this.applyColumnOrder();
        if (this.config.persistOrder && this.config.storageKey) { try { localStorage.removeItem(this.config.storageKey); } catch (e) {} }
        const event = new CustomEvent('column:orderreset', { detail: { order: [...this.state.columnOrder], tableId: this.table.tableId }, bubbles: true });
        this.table.element.dispatchEvent(event);
        this.debug('Ordre réinitialisé.');
    }

    /** Rafraîchit le plugin. */
    refresh() {
        if (!this.state.isInitialized || !this.config.enabled) return;
        this.debug('Rafraîchissement ColumnReorder...');
        if (this.state.isDragging) this.cleanupDragState();
        if (!this.analyzeTableStructure()) return; // Réanalyse la structure
        if (this.config.persistOrder) this.loadColumnOrder(); // Recharge et applique si valide
        else this.applyColumnOrder(); // Sinon, s'assurer que le DOM reflète l'ordre interne
        this.setupDragHandles(); // Reconfigure les poignées
        this.debug('Rafraîchissement ColumnReorder terminé.');
    }

    /**
     * Injecte les styles CSS nécessaires (une seule fois).
     * NOTE: Il est préférable de déplacer ces styles dans un fichier CSS dédié.
     */
    injectStyles() {
        const styleId = 'tableflow-column-reorder-styles';
        if (document.getElementById(styleId)) return;
        this.debug("Injection des styles CSS pour ColumnReorder (préférez un fichier CSS dédié)...");
        const style = document.createElement('style');
        style.id = styleId;
        // Styles utilisant les variables CSS globales (--tf-*) et les classes configurées
        style.textContent = `
            /* Styles ColumnReorder - Idéalement dans tableFlow.css ou un fichier séparé */
            th.${this.config.reorderableClass} { position: relative; cursor: grab; }
            .${this.config.headerContainerClass} { display: flex; align-items: center; width: 100%; position: relative; }
            ${this.config.handleSelector} { cursor: grab; color: var(--tf-reorder-handle-color, #999); transition: color 0.2s ease; padding: 0 5px; touch-action: none; flex-shrink: 0; }
            ${this.config.handleSelector}:hover { color: var(--tf-reorder-handle-hover-color, #333); }
            th.${this.config.draggingClass} { opacity: 0.5; cursor: grabbing !important; }
            .${this.config.dropIndicatorClass} { position: fixed; width: 4px; background-color: var(--tf-reorder-indicator-color, #4f46e5); z-index: 1000; pointer-events: none; transition: left 0.1s ease-out, top 0.1s ease-out; box-shadow: 0 0 5px rgba(79, 70, 229, 0.5); display: none; }
            body > .column-reorder-ghost { position: fixed; left: 0; top: 0; z-index: 1001; pointer-events: none; transition: none; box-shadow: 0 4px 8px rgba(0,0,0,0.2); background: var(--tf-bg-color, #fff); cursor: grabbing !important; border: 1px solid var(--tf-border-color, #ccc); }
            body.user-select-none { user-select: none; -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; }
        `;
        document.head.appendChild(style);
    }

    /** Vérifie si une colonne est réorganisable. @param {number} originalIndex */
    isColumnReorderable(originalIndex) {
        const headerInfo = this.state.headerElements.find(h => h.index === originalIndex);
        return headerInfo?.reorderable ?? false;
    }

    /** Obtient l'ordre actuel des colonnes. @returns {number[]} */
    getColumnOrder() {
        return [...this.state.columnOrder];
    }

    /** Définit l'ordre des colonnes. @param {number[]} newOrder @param {boolean} [persist=true] */
    setColumnOrder(newOrder, persist = true) {
        // Validation
        if (!Array.isArray(newOrder) || newOrder.length !== this.state.headerElements.length) {
            throw new Error('Ordre invalide: taille incorrecte.');
        }
        const expectedIndexes = new Set(this.state.headerElements.map(h => h.index));
        const receivedIndexes = new Set(newOrder);
        if (expectedIndexes.size !== receivedIndexes.size || ![...receivedIndexes].every(idx => expectedIndexes.has(idx))) {
            throw new Error('Ordre invalide: indices manquants ou dupliqués.');
        }
        this.debug('Définition programmatique de l\'ordre:', newOrder);
        this.state.columnOrder = [...newOrder];
        this.applyColumnOrder();
        if (persist && this.config.persistOrder) this.saveColumnOrder();
    }

    /** Active ou désactive le plugin. @param {boolean} enabled */
    setEnabled(enabled) {
        if (this.config.enabled === enabled) return;
        this.config.enabled = enabled;
        this.debug(`Plugin ${enabled ? 'activé' : 'désactivé'}.`);
        if (enabled) {
            if (!this.state.isInitialized) this.init(this.table);
            else { this.setupDragHandles(); this.setupEventListeners(); }
        } else {
            this.cleanupDragState();
            this.state.headerElements.forEach(h => {
                 const handle = h.element.querySelector(this.config.handleSelector);
                 if (handle) handle.remove();
                 h.element.classList.remove(this.config.reorderableClass);
            });
            this._removeEventListeners();
        }
    }

    /** Nettoie les ressources du plugin. */
    destroy() {
        this.debug('Destruction du plugin ColumnReorder...');
        this.cleanupDragState();
        if (this.state.dropIndicator) this.state.dropIndicator.remove();
        this._removeEventListeners(); // Nettoie les listeners attachés
        if (this.state.mutationObserver) this.state.mutationObserver.disconnect();

        // Nettoyer le DOM (poignées, classes)
        if (this.table?.element) {
            this.state.headerElements.forEach(h => {
                 const handle = h.element.querySelector(this.config.handleSelector);
                 if (handle) handle.remove();
                 h.element.classList.remove(this.config.reorderableClass);
                 // Retirer le conteneur ajouté? Peut-être pas nécessaire si TableFlow le gère.
                 // const container = h.element.querySelector(`.${this.config.headerContainerClass}`);
                 // if (container) { ... déplacer contenu ... container.remove() ... }
            });
        }

        if (this.config.resetOnDestroy) {
             // Attention: resetColumnOrder peut ré-analyser et ré-ajouter des éléments
             // Il vaut mieux juste restaurer l'ordre DOM ici si nécessaire.
             // Pour l'instant, on ne fait rien de plus que le nettoyage ci-dessus.
             this.debug("resetOnDestroy activé, mais la restauration DOM complexe est omise pour l'instant.");
             // Pour une vraie restauration, il faudrait stocker l'ordre initial du DOM
             // et le réappliquer ici sans appeler toute la logique de `resetColumnOrder`.
        }

        this.table = null;
        // Réinitialiser l'état interne
        this.state = {
            isInitialized: false, isDragging: false, draggedColumn: null, draggedIndex: -1,
            draggedOriginalIndex: -1, dragStartX: 0, dragStartY: 0, ghostElement: null,
            ghostOffsetX: 0, ghostOffsetY: 0, dropIndicator: this.state.dropIndicator, // Garder la réf si on ne le supprime pas du DOM
            currentDropIndex: -1, columnOrder: [], originalOrder: [], headerElements: [],
            eventHandlers: {}, mutationObserver: null
        };
        this.debug('Plugin ColumnReorder détruit.');
    }
}
