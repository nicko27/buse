/**
 * ColumnReorderPlugin pour TableFlow
 * Permet de réorganiser les colonnes d'un tableau par glisser-déposer
 * Version: 1.0.0
 */
export default class ColumnReorderPlugin {
    constructor(config = {}) {
        this.name = 'columnreorder';
        this.version = '1.0.0';
        this.type = 'interaction';
        this.table = null;
        
        // Configuration par défaut
        this.config = {
            enabled: true,
            handleSelector: '.column-drag-handle',  // Sélecteur CSS pour la poignée de glisser-déposer
            handleHTML: '<div class="column-drag-handle" title="Glisser pour réorganiser"><i class="fas fa-grip-vertical"></i></div>',
            handlePosition: 'prepend',             // 'prepend', 'append', ou 'replace'
            reorderableClass: 'reorderable-column', // Classe pour les colonnes réorganisables
            draggingClass: 'column-dragging',       // Classe lors du glissement
            dropIndicatorClass: 'column-drop-indicator', // Classe pour l'indicateur de dépôt
            headerContainerClass: 'column-header-container', // Classe pour le conteneur de l'en-tête
            dragThreshold: 5,                      // Seuil de déplacement minimal pour déclencher le glissement
            animationDuration: 300,                // Durée de l'animation (ms)
            excludeSelector: '[th-noreorder]',     // Sélecteur CSS pour exclure des colonnes
            persistOrder: true,                    // Enregistrer l'ordre dans le localStorage
            storageKey: null,                      // Clé pour localStorage (par défaut: tableId + '_columnOrder')
            dragImage: null,                       // Image personnalisée pour le glisser-déposer
            dragImageOpacity: 0.7,                 // Opacité de l'image de glissement
            
            // Callbacks
            onColumnReorder: null,                 // Fonction appelée après réorganisation
            onDragStart: null,                     // Fonction appelée au début du glissement
            onDragEnd: null,                       // Fonction appelée à la fin du glissement
            
            debug: false,                          // Mode debug
            
            ...config                              // Fusionner avec la config passée
        };
        
        // État interne
        this.state = {
            isInitialized: false,                  // Si le plugin est initialisé
            isDragging: false,                     // Si une colonne est en cours de glissement
            draggedColumn: null,                   // Colonne en cours de glissement
            draggedIndex: -1,                      // Index de la colonne glissée
            dragStartX: 0,                         // Position X initiale du glissement
            dragStartY: 0,                         // Position Y initiale du glissement
            ghostElement: null,                    // Élément fantôme pour le glissement
            dropIndicator: null,                   // Indicateur de position de dépôt
            currentDropIndex: -1,                  // Index de la position de dépôt actuelle
            columnOrder: [],                       // Ordre actuel des colonnes (indices)
            columnElements: [],                    // Références aux éléments de colonne
            headerElements: [],                    // Références aux éléments d'en-tête
            originalOrder: [],                     // Ordre original des colonnes
            eventHandlers: {},                     // Gestionnaires d'événements
            mutationObserver: null,                // Observateur de mutations DOM
            resizeObserver: null,                  // Observateur de redimensionnement
        };
        
        // Lier les méthodes pour préserver le contexte
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleTableChange = this.handleTableChange.bind(this);
        
        // Fonctions de journalisation
        this.debug = this.config.debug ? 
            (...args) => console.log('[ColumnReorderPlugin]', ...args) : 
            () => {};
    }
    
    /**
     * Initialise le plugin
     * @param {Object} tableHandler - Instance de TableFlow
     */
    init(tableHandler) {
        if (!tableHandler) {
            console.error('[ColumnReorderPlugin] TableHandler requis pour l\'initialisation');
            return;
        }
        
        this.table = tableHandler;
        
        if (!this.table.table) {
            console.error('[ColumnReorderPlugin] Élément table non trouvé');
            return;
        }
        
        this.debug('Initialisation du plugin');
        
        // Configurer la clé de stockage si non définie
        if (!this.config.storageKey && this.config.persistOrder) {
            this.config.storageKey = `${this.table.options.tableId}_columnOrder`;
        }
        
        // Analyser la structure de la table
        this.analyzeTableStructure();
        
        // Charger l'ordre sauvegardé si activé
        if (this.config.persistOrder) {
            this.loadColumnOrder();
        }
        
        // Initialiser les poignées de glisser-déposer
        this.setupDragHandles();
        
        // Ajouter les gestionnaires d'événements
        this.setupEventListeners();
        
        // Ajouter les styles CSS
        this.injectStyles();
        
        // Créer l'indicateur de dépôt
        this.createDropIndicator();
        
        // Marquer comme initialisé
        this.state.isInitialized = true;
        
        // Configurer l'observateur pour détecter les changements dans la table
        this.setupMutationObserver();
        
        this.debug('Plugin initialisé avec succès');
    }
    
    /**
     * Analyse la structure de la table pour préparer le réordonnancement
     */
    analyzeTableStructure() {
        const thead = this.table.table.querySelector('thead');
        if (!thead || !thead.rows || !thead.rows[0]) {
            this.debug('Aucun en-tête trouvé dans le tableau');
            return;
        }
        
        // Récupérer toutes les colonnes d'en-tête
        const headerRow = thead.rows[0];
        this.state.headerElements = Array.from(headerRow.cells).map((th, index) => ({
            element: th,
            index: index,
            id: th.id || `th_${index}`,
            width: th.offsetWidth,
            reorderable: !th.matches(this.config.excludeSelector),
            columnIndex: index
        }));
        
        // Initialiser l'ordre des colonnes
        this.state.columnOrder = this.state.headerElements.map((_, index) => index);
        this.state.originalOrder = [...this.state.columnOrder];
        
        // Indexer toutes les cellules de chaque colonne
        this.state.columnElements = [];
        
        for (let colIndex = 0; colIndex < this.state.headerElements.length; colIndex++) {
            const columnCells = [this.state.headerElements[colIndex].element];
            
            // Ajouter les cellules du corps du tableau
            const tbody = this.table.table.querySelector('tbody');
            if (tbody) {
                Array.from(tbody.rows).forEach(row => {
                    if (colIndex < row.cells.length) {
                        columnCells.push(row.cells[colIndex]);
                    }
                });
            }
            
            // Ajouter les cellules du pied du tableau
            const tfoot = this.table.table.querySelector('tfoot');
            if (tfoot) {
                Array.from(tfoot.rows).forEach(row => {
                    if (colIndex < row.cells.length) {
                        columnCells.push(row.cells[colIndex]);
                    }
                });
            }
            
            this.state.columnElements.push({
                index: colIndex,
                cells: columnCells,
                width: this.state.headerElements[colIndex].width
            });
        }
        
        this.debug('Structure de table analysée:', {
            colonnes: this.state.columnElements.length,
            ordre: this.state.columnOrder
        });
    }
    
    /**
     * Initialise les poignées de glisser-déposer
     */
    setupDragHandles() {
        this.state.headerElements.forEach(header => {
            // Ignorer les colonnes non réorganisables
            if (!header.reorderable) {
                this.debug(`Colonne ${header.id} non réorganisable, ignorée`);
                return;
            }
            
            // Créer un conteneur pour l'en-tête si nécessaire
            let headerContainer = header.element.querySelector(`.${this.config.headerContainerClass}`);
            
            if (!headerContainer) {
                // Créer un conteneur pour l'en-tête et le manipulateur
                headerContainer = document.createElement('div');
                headerContainer.className = this.config.headerContainerClass;
                
                // Déplacer le contenu actuel de l'en-tête dans le conteneur
                const thContent = Array.from(header.element.childNodes);
                thContent.forEach(node => headerContainer.appendChild(node));
                
                // Ajouter le conteneur à l'en-tête
                header.element.appendChild(headerContainer);
            }
            
            // Éviter d'ajouter plusieurs poignées
            if (header.element.querySelector(this.config.handleSelector)) {
                return;
            }
            
            // Créer la poignée
            const handleContainer = document.createElement('div');
            handleContainer.innerHTML = this.config.handleHTML;
            const handle = handleContainer.firstChild;
            
            // Positionner la poignée
            if (this.config.handlePosition === 'prepend') {
                headerContainer.insertBefore(handle, headerContainer.firstChild);
            } else if (this.config.handlePosition === 'replace') {
                headerContainer.innerHTML = '';
                headerContainer.appendChild(handle);
            } else { // 'append' par défaut
                headerContainer.appendChild(handle);
            }
            
            // Ajouter la classe réorganisable
            header.element.classList.add(this.config.reorderableClass);
            
            this.debug(`Poignée ajoutée à la colonne ${header.id}`);
        });
    }
    
    /**
     * Initialise les gestionnaires d'événements
     */
    setupEventListeners() {
        // Gestionnaires pour la souris
        this.table.table.addEventListener('mousedown', this.handleMouseDown);
        document.addEventListener('mousemove', this.handleMouseMove);
        document.addEventListener('mouseup', this.handleMouseUp);
        
        // Gestionnaires pour le toucher
        this.table.table.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        document.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        document.addEventListener('touchend', this.handleTouchEnd);
        document.addEventListener('touchcancel', this.handleTouchEnd);
        
        // Événements de changement de tableau
        this.table.table.addEventListener('row:added', this.handleTableChange);
        this.table.table.addEventListener('row:removed', this.handleTableChange);
        
        // Stocker les références aux gestionnaires pour nettoyage
        this.state.eventHandlers = {
            mousedown: this.handleMouseDown,
            mousemove: this.handleMouseMove,
            mouseup: this.handleMouseUp,
            touchstart: this.handleTouchStart,
            touchmove: this.handleTouchMove,
            touchend: this.handleTouchEnd,
            tablechange: this.handleTableChange
        };
        
        this.debug('Gestionnaires d\'événements configurés');
    }
    
    /**
     * Configure l'observateur de mutations DOM
     */
    setupMutationObserver() {
        // Observer les changements dans la structure de la table
        if (window.MutationObserver) {
            this.state.mutationObserver = new MutationObserver(mutations => {
                let shouldRefresh = false;
                
                for (const mutation of mutations) {
                    // Vérifier si des cellules ou des lignes ont été ajoutées/supprimées
                    if (mutation.type === 'childList' && 
                        (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0)) {
                        const isRelevantNode = Array.from(mutation.addedNodes).some(node => 
                            node.nodeName === 'TR' || node.nodeName === 'TD' || node.nodeName === 'TH'
                        ) || Array.from(mutation.removedNodes).some(node => 
                            node.nodeName === 'TR' || node.nodeName === 'TD' || node.nodeName === 'TH'
                        );
                        
                        if (isRelevantNode) {
                            shouldRefresh = true;
                            break;
                        }
                    }
                }
                
                if (shouldRefresh) {
                    this.debug('Changements détectés dans la structure de la table, rafraîchissement...');
                    this.refresh();
                }
            });
            
            this.state.mutationObserver.observe(this.table.table, {
                childList: true,
                subtree: true
            });
            
            this.debug('Observateur de mutations DOM configuré');
        }
    }
    
    /**
     * Crée l'indicateur de position de dépôt
     */
    createDropIndicator() {
        if (!this.state.dropIndicator) {
            this.state.dropIndicator = document.createElement('div');
            this.state.dropIndicator.className = this.config.dropIndicatorClass;
            this.state.dropIndicator.style.display = 'none';
            document.body.appendChild(this.state.dropIndicator);
            
            this.debug('Indicateur de dépôt créé');
        }
    }
    
    /**
     * Gère l'événement mousedown
     * @param {MouseEvent} event - L'événement mousedown
     */
    handleMouseDown(event) {
        // Vérifier si l'événement provient d'une poignée
        const handle = event.target.closest(this.config.handleSelector);
        if (!handle) return;
        
        // Trouver l'en-tête parent
        const headerCell = handle.closest('th');
        if (!headerCell) return;
        
        // Vérifier si cette colonne est réorganisable
        const headerIndex = this.state.headerElements.findIndex(h => h.element === headerCell);
        if (headerIndex === -1 || !this.state.headerElements[headerIndex].reorderable) return;
        
        // Prévenir la sélection de texte et autres comportements par défaut
        event.preventDefault();
        
        // Initialiser le glissement
        this.startDrag(headerCell, headerIndex, event.clientX, event.clientY);
    }
    
    /**
     * Gère l'événement touchstart
     * @param {TouchEvent} event - L'événement touchstart
     */
    handleTouchStart(event) {
        // Vérifier si l'événement provient d'une poignée
        const touch = event.touches[0];
        if (!touch) return;
        
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const handle = element?.closest(this.config.handleSelector);
        if (!handle) return;
        
        // Trouver l'en-tête parent
        const headerCell = handle.closest('th');
        if (!headerCell) return;
        
        // Vérifier si cette colonne est réorganisable
        const headerIndex = this.state.headerElements.findIndex(h => h.element === headerCell);
        if (headerIndex === -1 || !this.state.headerElements[headerIndex].reorderable) return;
        
        // Prévenir le défilement
        event.preventDefault();
        
        // Initialiser le glissement
        this.startDrag(headerCell, headerIndex, touch.clientX, touch.clientY);
    }
    
    /**
     * Initialise le glissement d'une colonne
     * @param {HTMLTableCellElement} headerCell - Cellule d'en-tête
     * @param {number} headerIndex - Index de l'en-tête
     * @param {number} clientX - Position X initiale
     * @param {number} clientY - Position Y initiale
     */
    startDrag(headerCell, headerIndex, clientX, clientY) {
        this.debug('Début du glissement', {
            colonne: this.state.headerElements[headerIndex].id,
            index: headerIndex
        });
        
        // Marquer comme en cours de glissement
        this.state.isDragging = true;
        this.state.draggedColumn = headerCell;
        this.state.draggedIndex = headerIndex;
        this.state.dragStartX = clientX;
        this.state.dragStartY = clientY;
        
        // Ajouter la classe de glissement
        headerCell.classList.add(this.config.draggingClass);
        
        // Créer l'élément fantôme
        this.createGhostElement(headerCell, clientX, clientY);
        
        // Callback
        if (typeof this.config.onDragStart === 'function') {
            this.config.onDragStart({
                columnId: this.state.headerElements[headerIndex].id,
                index: headerIndex,
                element: headerCell
            });
        }
    }
    
    /**
     * Crée l'élément fantôme pour le glissement
     * @param {HTMLTableCellElement} headerCell - Cellule d'en-tête
     * @param {number} clientX - Position X initiale
     * @param {number} clientY - Position Y initiale
     */
    createGhostElement(headerCell, clientX, clientY) {
        // Créer un clone de l'en-tête
        const ghost = headerCell.cloneNode(true);
        
        // Appliquer des styles pour le positionnement absolu
        Object.assign(ghost.style, {
            position: 'fixed',
            top: `${headerCell.getBoundingClientRect().top}px`,
            left: `${headerCell.getBoundingClientRect().left}px`,
            width: `${headerCell.offsetWidth}px`,
            height: `${headerCell.offsetHeight}px`,
            zIndex: '1000',
            opacity: this.config.dragImageOpacity,
            pointerEvents: 'none',
            transition: 'none',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            background: '#fff',
            cursor: 'grabbing'
        });
        
        // Utiliser une image personnalisée si définie
        if (this.config.dragImage) {
            const img = new Image();
            img.src = this.config.dragImage;
            img.style.pointerEvents = 'none';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            
            ghost.innerHTML = '';
            ghost.appendChild(img);
        }
        
        // Ajouter au corps du document
        document.body.appendChild(ghost);
        
        // Stocker la référence
        this.state.ghostElement = ghost;
        
        // Décalage initial pour le positionnement
        this.state.ghostOffsetX = clientX - headerCell.getBoundingClientRect().left;
        this.state.ghostOffsetY = clientY - headerCell.getBoundingClientRect().top;
    }
    
    /**
     * Gère l'événement mousemove
     * @param {MouseEvent} event - L'événement mousemove
     */
    handleMouseMove(event) {
        if (!this.state.isDragging) return;
        
        // Déplacer l'élément fantôme
        this.moveGhostElement(event.clientX, event.clientY);
        
        // Trouver la nouvelle position potentielle
        this.updateDropPosition(event.clientX);
    }
    
    /**
     * Gère l'événement touchmove
     * @param {TouchEvent} event - L'événement touchmove
     */
    handleTouchMove(event) {
        if (!this.state.isDragging) return;
        
        const touch = event.touches[0];
        if (!touch) return;
        
        // Prévenir le défilement
        event.preventDefault();
        
        // Déplacer l'élément fantôme
        this.moveGhostElement(touch.clientX, touch.clientY);
        
        // Trouver la nouvelle position potentielle
        this.updateDropPosition(touch.clientX);
    }
    
    /**
     * Déplace l'élément fantôme
     * @param {number} clientX - Position X actuelle
     * @param {number} clientY - Position Y actuelle
     */
    moveGhostElement(clientX, clientY) {
        if (!this.state.ghostElement) return;
        
        // Calculer la nouvelle position
        const left = clientX - this.state.ghostOffsetX;
        const top = clientY - this.state.ghostOffsetY;
        
        // Appliquer la position
        this.state.ghostElement.style.left = `${left}px`;
        this.state.ghostElement.style.top = `${top}px`;
    }
    
    /**
     * Met à jour la position de l'indicateur de dépôt
     * @param {number} clientX - Position X actuelle
     */
    updateDropPosition(clientX) {
        // Trouver la position potentielle de dépôt
        let dropIndex = -1;
        let dropPosition = -1;
        
        // Parcourir tous les en-têtes pour trouver la position de dépôt
        for (let i = 0; i < this.state.headerElements.length; i++) {
            // Ignorer les colonnes non réorganisables
            if (!this.state.headerElements[i].reorderable) continue;
            
            const header = this.state.headerElements[i].element;
            const rect = header.getBoundingClientRect();
            
            // Vérifier si le curseur est sur cet en-tête
            if (clientX >= rect.left && clientX <= rect.right) {
                // Calculer la position dans l'en-tête (début ou fin)
                const midpoint = rect.left + rect.width / 2;
                
                if (clientX < midpoint) {
                    // Avant cette colonne
                    dropIndex = i;
                    dropPosition = rect.left;
                } else {
                    // Après cette colonne
                    dropIndex = i + 1;
                    dropPosition = rect.right;
                }
                
                break;
            } else if (i === 0 && clientX < rect.left) {
                // Avant la première colonne
                dropIndex = 0;
                dropPosition = rect.left;
                break;
            } else if (i === this.state.headerElements.length - 1 && clientX > rect.right) {
                // Après la dernière colonne
                dropIndex = this.state.headerElements.length;
                dropPosition = rect.right;
                break;
            }
        }
        
        // Ajuster l'index si nécessaire pour éviter de déposer sur la même position
        if (dropIndex === this.state.draggedIndex || dropIndex === this.state.draggedIndex + 1) {
            this.hideDropIndicator();
            return;
        }
        
        // Mettre à jour l'indicateur de dépôt
        this.showDropIndicator(dropPosition);
        
        // Stocker l'index de dépôt actuel
        this.state.currentDropIndex = dropIndex;
    }
    
    /**
     * Affiche l'indicateur de dépôt
     * @param {number} position - Position X où afficher l'indicateur
     */
    showDropIndicator(position) {
        if (!this.state.dropIndicator) return;
        
        // Récupérer les dimensions de la table
        const tableRect = this.table.table.getBoundingClientRect();
        
        // Positionner l'indicateur
        this.state.dropIndicator.style.left = `${position}px`;
        this.state.dropIndicator.style.top = `${tableRect.top}px`;
        this.state.dropIndicator.style.height = `${tableRect.height}px`;
        this.state.dropIndicator.style.display = 'block';
    }
    
    /**
     * Masque l'indicateur de dépôt
     */
    hideDropIndicator() {
        if (this.state.dropIndicator) {
            this.state.dropIndicator.style.display = 'none';
        }
    }
    
    /**
     * Gère l'événement mouseup
     * @param {MouseEvent} event - L'événement mouseup
     */
    handleMouseUp() {
        if (!this.state.isDragging) return;
        
        // Confirmer le dépôt
        this.finishDrag();
    }
    
    /**
     * Gère l'événement touchend
     */
    handleTouchEnd() {
        if (!this.state.isDragging) return;
        
        // Confirmer le dépôt
        this.finishDrag();
    }
    
    /**
     * Termine le glissement et confirme le réordonnancement
     */
    finishDrag() {
        this.debug('Fin du glissement', {
            sourceIndex: this.state.draggedIndex,
            targetIndex: this.state.currentDropIndex
        });
        
        // Vérifier si le dépôt est valide
        if (
            this.state.currentDropIndex !== -1 && 
            this.state.currentDropIndex !== this.state.draggedIndex && 
            this.state.currentDropIndex !== this.state.draggedIndex + 1
        ) {
            // Réorganiser les colonnes
            this.reorderColumns(this.state.draggedIndex, this.state.currentDropIndex);
        }
        
        // Nettoyer l'interface
        this.cleanupDragState();
        
        // Callback
        if (typeof this.config.onDragEnd === 'function') {
            this.config.onDragEnd({
                sourceIndex: this.state.draggedIndex,
                targetIndex: this.state.currentDropIndex,
                newOrder: this.state.columnOrder
            });
        }
    }
    
    /**
     * Réorganise les colonnes
     * @param {number} fromIndex - Index source
     * @param {number} toIndex - Index cible
     */
    reorderColumns(fromIndex, toIndex) {
        // Ajuster l'index cible si on déplace vers la droite
        if (fromIndex < toIndex) {
            toIndex--;
        }
        
        this.debug('Réorganisation des colonnes', {
            de: fromIndex,
            à: toIndex,
            ordre_avant: [...this.state.columnOrder]
        });
        
        // Mettre à jour l'ordre des colonnes
        const newOrder = [...this.state.columnOrder];
        const [removed] = newOrder.splice(fromIndex, 1);
        newOrder.splice(toIndex, 0, removed);
        
        this.state.columnOrder = newOrder;
        
        this.debug('Nouvel ordre des colonnes', this.state.columnOrder);
        
        // Appliquer le nouvel ordre
        this.applyColumnOrder();
        
        // Enregistrer l'ordre si activé
        if (this.config.persistOrder) {
            this.saveColumnOrder();
        }
        
        // Déclencher l'événement de réorganisation
        if (typeof this.config.onColumnReorder === 'function') {
            this.config.onColumnReorder({
                from: fromIndex,
                to: toIndex,
                columnId: this.state.headerElements[fromIndex].id,
                newOrder: this.state.columnOrder
            });
        }
        
        // Déclencher un événement personnalisé
        const event = new CustomEvent('column:reordered', {
            detail: {
                from: fromIndex,
                to: toIndex,
                columnId: this.state.headerElements[fromIndex].id,
                newOrder: this.state.columnOrder
            },
            bubbles: true
        });
        this.table.table.dispatchEvent(event);
    }
    
    /**
     * Applique l'ordre des colonnes au tableau
     */
    applyColumnOrder() {
        // Manipuler le DOM pour réorganiser les colonnes
        const thead = this.table.table.querySelector('thead');
        const tbody = this.table.table.querySelector('tbody');
        const tfoot = this.table.table.querySelector('tfoot');
        
        // Appliquer le nouvel ordre aux en-têtes
        if (thead && thead.rows.length > 0) {
            const headerRow = thead.rows[0];
            
            // Créer un tableau temporaire pour stocker les cellules d'en-tête
            const tempHeaders = this.state.columnOrder.map(originalIndex => {
                return headerRow.cells[originalIndex];
            });
            
            // Vider la ligne d'en-tête
            while (headerRow.cells.length > 0) {
                headerRow.removeChild(headerRow.cells[0]);
            }
            
            // Ajouter les en-têtes dans le nouvel ordre
            tempHeaders.forEach(header => {
                headerRow.appendChild(header);
            });
        }
        
        // Appliquer le nouvel ordre au corps du tableau
        if (tbody) {
            Array.from(tbody.rows).forEach(row => {
                // Créer un tableau temporaire pour stocker les cellules
                const tempCells = this.state.columnOrder.map(originalIndex => {
                    return originalIndex < row.cells.length ? row.cells[originalIndex] : null;
                }).filter(Boolean);
                
                // Vider la ligne
                while (row.cells.length > 0) {
                    row.removeChild(row.cells[0]);
                }
                
                // Ajouter les cellules dans le nouvel ordre
                tempCells.forEach(cell => {
                    row.appendChild(cell);
                });
            });
        }
        
        // Appliquer le nouvel ordre au pied du tableau
        if (tfoot) {
            Array.from(tfoot.rows).forEach(row => {
                // Créer un tableau temporaire pour stocker les cellules
                const tempCells = this.state.columnOrder.map(originalIndex => {
                    return originalIndex < row.cells.length ? row.cells[originalIndex] : null;
                }).filter(Boolean);
                
                // Vider la ligne
                while (row.cells.length > 0) {
                    row.removeChild(row.cells[0]);
                }
                
                // Ajouter les cellules dans le nouvel ordre
                tempCells.forEach(cell => {
                    row.appendChild(cell);
                });
            });
        }
        
        // Mettre à jour les références internes
        this.analyzeTableStructure();
    }
    
    /**
     * Nettoie l'état du glissement
     */
    cleanupDragState() {
        // Supprimer la classe de glissement
        if (this.state.draggedColumn) {
            this.state.draggedColumn.classList.remove(this.config.draggingClass);
        }
        
        // Supprimer l'élément fantôme
        if (this.state.ghostElement) {
            document.body.removeChild(this.state.ghostElement);
            this.state.ghostElement = null;
        }
        
        // Masquer l'indicateur de dépôt
        this.hideDropIndicator();
        
        // Réinitialiser l'état
        this.state.isDragging = false;
        this.state.draggedColumn = null;
        this.state.draggedIndex = -1;
        this.state.currentDropIndex = -1;
        this.state.dragStartX = 0;
        this.state.dragStartY = 0;
    }
    
    /**
     * Gère les événements de changement de table
     */
    handleTableChange() {
        // Différer le rafraîchissement pour éviter des problèmes pendant les mutations
        setTimeout(() => {
            this.refresh();
        }, 0);
    }
    
    /**
     * Enregistre l'ordre des colonnes dans le localStorage
     */
    saveColumnOrder() {
        if (!this.config.persistOrder || !this.config.storageKey) return;
        
        try {
            // Créer un objet avec l'ordre et les identifiants des colonnes pour validation
            const orderData = {
                order: this.state.columnOrder,
                columns: this.state.headerElements.map(h => h.id),
                timestamp: Date.now()
            };
            
            localStorage.setItem(this.config.storageKey, JSON.stringify(orderData));
            this.debug('Ordre des colonnes enregistré', orderData);
        } catch (error) {
            console.error('[ColumnReorderPlugin] Erreur lors de l\'enregistrement de l\'ordre des colonnes', error);
        }
    }
    
    /**
     * Charge l'ordre des colonnes depuis le localStorage
     */
    loadColumnOrder() {
        if (!this.config.persistOrder || !this.config.storageKey) return;
        
        try {
            const savedData = localStorage.getItem(this.config.storageKey);
            if (!savedData) return;
            
            const orderData = JSON.parse(savedData);
            
            // Vérifier que l'ordre sauvegardé correspond toujours à la structure actuelle
            const currentColumns = this.state.headerElements.map(h => h.id);
            
            // Vérifier si le nombre de colonnes correspond
            if (orderData.order.length !== this.state.columnOrder.length) {
                this.debug('La structure de la table a changé, impossible de restaurer l\'ordre');
                localStorage.removeItem(this.config.storageKey);
                return;
            }
            
            // Vérifier si les ID des colonnes correspondent
            const columnsMatch = orderData.columns.every((id, i) => id === currentColumns[i]);
            if (!columnsMatch) {
                this.debug('Les identifiants des colonnes ont changé, impossible de restaurer l\'ordre');
                localStorage.removeItem(this.config.storageKey);
                return;
            }
            
            // Appliquer l'ordre sauvegardé
            this.state.columnOrder = orderData.order;
            this.applyColumnOrder();
            
            this.debug('Ordre des colonnes restauré', this.state.columnOrder);
        } catch (error) {
            console.error('[ColumnReorderPlugin] Erreur lors du chargement de l\'ordre des colonnes', error);
        }
    }
    
    /**
     * Réinitialise l'ordre des colonnes à l'ordre original
     */
    resetColumnOrder() {
        this.debug('Réinitialisation de l\'ordre des colonnes');
        
        // Restaurer l'ordre original
        this.state.columnOrder = [...this.state.originalOrder];
        
        // Appliquer l'ordre
        this.applyColumnOrder();
        
        // Supprimer l'ordre sauvegardé
        if (this.config.persistOrder && this.config.storageKey) {
            localStorage.removeItem(this.config.storageKey);
        }
        
        // Déclencher un événement personnalisé
        const event = new CustomEvent('column:orderreset', {
            detail: {
                order: this.state.columnOrder
            },
            bubbles: true
        });
        this.table.table.dispatchEvent(event);
    }
    
    /**
     * Rafraîchit le plugin après des modifications de la table
     */
    refresh() {
        if (!this.state.isInitialized) return;
        
        this.debug('Rafraîchissement du plugin');
        
        // Réinitialiser les états internes
        this.cleanupDragState();
        
        // Ré-analyser la structure de la table
        this.analyzeTableStructure();
        
        // Réinitialiser les poignées de glisser-déposer
        this.setupDragHandles();
    }
    
    /**
     * Injecte les styles CSS requis pour le plugin
     */
    injectStyles() {
        if (!document.getElementById('column-reorder-styles')) {
            const style = document.createElement('style');
            style.id = 'column-reorder-styles';
            style.textContent = `
                /* Styles de base pour les colonnes réorganisables */
                .${this.config.reorderableClass} {
                    position: relative;
                    cursor: grab;
                }
                
                /* Styles pour le conteneur d'en-tête */
                .${this.config.headerContainerClass} {
                    display: flex;
                    align-items: center;
                    width: 100%;
                }
                
                /* Styles pour la poignée de glisser-déposer */
                .${this.config.handleSelector.replace('.', '')} {
                    cursor: grab;
                    margin-right: 8px;
                    color: #999;
                    transition: color 0.2s ease;
                }
                
                .${this.config.handleSelector.replace('.', '')}:hover {
                    color: #333;
                }
                
                /* Styles pour l'élément en cours de glissement */
                .${this.config.draggingClass} {
                    opacity: 0.5;
                    cursor: grabbing;
                }
                
                /* Styles pour l'indicateur de dépôt */
                .${this.config.dropIndicatorClass} {
                    position: fixed;
                    width: 4px;
                    background-color: #4f46e5; /* Indigo */
                    z-index: 1000;
                    pointer-events: none;
                }
            `;
            document.head.appendChild(style);
            this.debug('Styles CSS injectés');
        }
    }
    
    /**
     * Vérifie si une colonne est réorganisable
     * @param {number} columnIndex - Index de la colonne
     * @returns {boolean} - True si la colonne est réorganisable
     */
    isColumnReorderable(columnIndex) {
        if (columnIndex < 0 || columnIndex >= this.state.headerElements.length) {
            return false;
        }
        
        return this.state.headerElements[columnIndex].reorderable;
    }
    
    /**
     * Obtient l'ordre actuel des colonnes
     * @returns {Array<number>} - Tableau des indices de colonne dans l'ordre actuel
     */
    getColumnOrder() {
        return [...this.state.columnOrder];
    }
    
    /**
     * Définit l'ordre des colonnes programmatiquement
     * @param {Array<number>} newOrder - Nouvel ordre des colonnes (indices)
     * @param {boolean} [persist=true] - Si on doit persister l'ordre
     */
    setColumnOrder(newOrder, persist = true) {
        // Valider le nouvel ordre
        if (!Array.isArray(newOrder) || newOrder.length !== this.state.columnOrder.length) {
            console.error('[ColumnReorderPlugin] Ordre de colonnes invalide', newOrder);
            return;
        }
        
        // Vérifier que tous les indices sont présents
        const sortedOrder = [...newOrder].sort((a, b) => a - b);
        const expectedOrder = Array.from({ length: this.state.columnOrder.length }, (_, i) => i);
        const isValid = sortedOrder.every((val, idx) => val === expectedOrder[idx]);
        
        if (!isValid) {
            console.error('[ColumnReorderPlugin] Ordre de colonnes invalide', newOrder);
            return;
        }
        
        this.debug('Définition programmatique de l\'ordre des colonnes', newOrder);
        
        // Appliquer le nouvel ordre
        this.state.columnOrder = newOrder;
        this.applyColumnOrder();
        
        // Persister si demandé
        if (persist && this.config.persistOrder) {
            this.saveColumnOrder();
        }
    }
    
    /**
     * Active ou désactive le plugin
     * @param {boolean} enabled - Si le plugin doit être activé
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
        
        if (enabled && !this.state.isInitialized) {
            // Réinitialiser le plugin s'il était désactivé
            this.init(this.table);
        } else if (!enabled && this.state.isInitialized) {
            // Nettoyer si on désactive
            this.cleanupDragState();
            
            // Supprimer les poignées
            const handles = this.table.table.querySelectorAll(this.config.handleSelector);
            handles.forEach(handle => handle.remove());
            
            // Supprimer les classes réorganisables
            const headers = this.table.table.querySelectorAll(`.${this.config.reorderableClass}`);
            headers.forEach(header => header.classList.remove(this.config.reorderableClass));
            
            this.state.isInitialized = false;
        }
    }
    
    /**
     * Nettoyage avant la destruction du plugin
     */
    destroy() {
        this.debug('Destruction du plugin');
        
        // Nettoyage des états de glissement
        this.cleanupDragState();
        
        // Supprimer l'indicateur de dépôt
        if (this.state.dropIndicator && this.state.dropIndicator.parentNode) {
            this.state.dropIndicator.parentNode.removeChild(this.state.dropIndicator);
        }
        
        // Supprimer les gestionnaires d'événements
        this.table.table.removeEventListener('mousedown', this.state.eventHandlers.mousedown);
        document.removeEventListener('mousemove', this.state.eventHandlers.mousemove);
        document.removeEventListener('mouseup', this.state.eventHandlers.mouseup);
        
        this.table.table.removeEventListener('touchstart', this.state.eventHandlers.touchstart);
        document.removeEventListener('touchmove', this.state.eventHandlers.touchmove);
        document.removeEventListener('touchend', this.state.eventHandlers.touchend);
        
        this.table.table.removeEventListener('row:added', this.state.eventHandlers.tablechange);
        this.table.table.removeEventListener('row:removed', this.state.eventHandlers.tablechange);
        
        // Arrêter les observateurs
        if (this.state.mutationObserver) {
            this.state.mutationObserver.disconnect();
        }
        
        if (this.state.resizeObserver) {
            this.state.resizeObserver.disconnect();
        }
        
        // Supprimer les poignées
        const handles = this.table.table.querySelectorAll(this.config.handleSelector);
        handles.forEach(handle => handle.remove());
        
        // Supprimer les classes réorganisables
        const headers = this.table.table.querySelectorAll(`.${this.config.reorderableClass}`);
        headers.forEach(header => header.classList.remove(this.config.reorderableClass));
        
        // Supprimer les styles
        const style = document.getElementById('column-reorder-styles');
        if (style) {
            style.parentNode.removeChild(style);
        }
        
        // Réinitialiser l'ordre des colonnes à l'état original si demandé
        if (this.config.resetOnDestroy) {
            this.resetColumnOrder();
        }
    }
}