/**
 * HidePlugin - Gestion de la visibilité des colonnes pour TableFlow
 * Permet de masquer/afficher des colonnes dynamiquement
 * 
 * @version 2.0.0
 */
export default class HidePlugin {
    constructor(config = {}) {
        this.name = 'hide';
        this.version = '2.0.0';
        this.type = 'column';
        this.table = null;
        this.dependencies = [];

        // Configuration par défaut
        this.config = {
            // Attributs
            hideAttribute: 'th-hide',
            visibilityAttribute: 'data-visible',
            hideClass: 'column-hidden',
            
            // Options
            persistState: true,
            storageKey: 'tableflow-hidden-columns',
            animation: true,
            animationDuration: 300,
            
            // UI
            showToggleButtons: false,
            toggleButtonClass: 'column-toggle-btn',
            toggleButtonContainer: null,
            
            // Comportement
            hideByDefault: true, // Si true, les colonnes avec th-hide sont cachées par défaut
            allowToggle: true, // Permet de basculer la visibilité
            minVisibleColumns: 1, // Nombre minimum de colonnes visibles
            
            // Callbacks
            onBeforeHide: null,
            onAfterHide: null,
            onBeforeShow: null,
            onAfterShow: null,
            
            debug: false
        };

        // Fusion de la configuration
        Object.assign(this.config, config);

        // Logger
        this.debug = this.config.debug ?
            (...args) => console.log('[HidePlugin]', ...args) :
            () => {};

        // État
        this.state = {
            hiddenColumns: new Set(),
            isInitialized: false,
            isAnimating: false
        };

        // Bind des méthodes
        this.handleColumnToggle = this.handleColumnToggle.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    init(tableHandler) {
        if (!tableHandler?.table) {
            throw new Error('TableHandler avec une table valide est requis');
        }

        this.table = tableHandler;
        this.debug('Initialisation du plugin Hide');

        // Charger l'état sauvegardé
        if (this.config.persistState) {
            this.loadState();
        }

        // Identifier les colonnes à cacher
        this.identifyHideColumns();

        // Appliquer l'état initial
        this.applyInitialState();

        // Créer les boutons de bascule si nécessaire
        if (this.config.showToggleButtons) {
            this.createToggleButtons();
        }

        // Ajouter les styles
        this.addStyles();

        // Configurer les écouteurs d'événements
        this.setupEventListeners();

        this.state.isInitialized = true;
        this.debug('Plugin Hide initialisé');
    }

    /**
     * Ajoute les styles CSS nécessaires
     */
    addStyles() {
        if (document.getElementById('hide-plugin-styles')) return;

        const styles = `
            .${this.config.hideClass} {
                display: none !important;
            }
            
            .${this.config.toggleButtonClass} {
                padding: 4px 8px;
                margin: 2px;
                border: 1px solid #ccc;
                border-radius: 4px;
                background: #fff;
                cursor: pointer;
                font-size: 12px;
                display: inline-flex;
                align-items: center;
                gap: 4px;
            }
            
            .${this.config.toggleButtonClass}:hover {
                background: #f5f5f5;
            }
            
            .${this.config.toggleButtonClass}.active {
                background: #e3f2fd;
                border-color: #2196f3;
                color: #1976d2;
            }
            
            .${this.config.toggleButtonClass}[disabled] {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .column-visibility-container {
                margin: 10px 0;
                padding: 10px;
                border: 1px solid #ddd;
                border-radius: 4px;
                background: #f9f9f9;
            }
            
            ${this.config.animation ? `
            .column-animating-hide {
                transition: opacity ${this.config.animationDuration}ms ease-out;
                opacity: 0;
            }
            
            .column-animating-show {
                transition: opacity ${this.config.animationDuration}ms ease-in;
                opacity: 1;
            }
            ` : ''}
        `;

        const styleElement = document.createElement('style');
        styleElement.id = 'hide-plugin-styles';
        styleElement.textContent = styles;
        document.head.appendChild(styleElement);
    }

    /**
     * Identifie les colonnes qui doivent être cachées
     */
    identifyHideColumns() {
        const headers = this.table.table.querySelectorAll('thead th');
        
        headers.forEach((header, index) => {
            if (header.hasAttribute(this.config.hideAttribute)) {
                const columnId = header.id || `col-${index}`;
                header.setAttribute('data-column-id', columnId);
                header.setAttribute('data-column-index', index);
                
                // Si hideByDefault est true, ajouter à la liste des colonnes cachées
                if (this.config.hideByDefault) {
                    this.state.hiddenColumns.add(columnId);
                }
            }
        });

        this.debug(`${this.state.hiddenColumns.size} colonnes identifiées pour être cachées`);
    }

    /**
     * Applique l'état initial (cache/affiche les colonnes)
     */
    applyInitialState() {
        const headers = this.table.table.querySelectorAll('thead th');
        
        headers.forEach((header) => {
            const columnId = header.getAttribute('data-column-id');
            const columnIndex = parseInt(header.getAttribute('data-column-index'));
            
            if (this.state.hiddenColumns.has(columnId)) {
                this.hideColumn(columnIndex, false); // false = pas d'animation
            } else {
                this.showColumn(columnIndex, false);
            }
        });
    }

    /**
     * Cache une colonne
     */
    hideColumn(columnIndex, animate = true) {
        if (this.state.isAnimating) return;

        const visibleColumns = this.getVisibleColumnsCount();
        if (visibleColumns <= this.config.minVisibleColumns) {
            this.debug(`Impossible de cacher plus de colonnes. Minimum requis: ${this.config.minVisibleColumns}`);
            return false;
        }

        const table = this.table.table;
        const headerCell = table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        const bodyCells = table.querySelectorAll(`tbody td:nth-child(${columnIndex + 1})`);
        const footerCells = table.querySelectorAll(`tfoot td:nth-child(${columnIndex + 1})`);
        
        if (!headerCell) return false;

        const columnId = headerCell.getAttribute('data-column-id') || headerCell.id;
        
        // Callback avant de cacher
        if (typeof this.config.onBeforeHide === 'function') {
            const result = this.config.onBeforeHide(columnId, columnIndex);
            if (result === false) return false;
        }

        // Animation si activée
        if (animate && this.config.animation) {
            this.state.isAnimating = true;
            
            // Appliquer la classe d'animation
            [headerCell, ...bodyCells, ...footerCells].forEach(cell => {
                cell.classList.add('column-animating-hide');
            });

            // Après l'animation, cacher les cellules
            setTimeout(() => {
                this.applyHideToColumn(headerCell, bodyCells, footerCells);
                this.state.isAnimating = false;
                
                // Callback après avoir caché
                if (typeof this.config.onAfterHide === 'function') {
                    this.config.onAfterHide(columnId, columnIndex);
                }
            }, this.config.animationDuration);
        } else {
            // Sans animation
            this.applyHideToColumn(headerCell, bodyCells, footerCells);
            
            // Callback après avoir caché
            if (typeof this.config.onAfterHide === 'function') {
                this.config.onAfterHide(columnId, columnIndex);
            }
        }

        // Mettre à jour l'état
        this.state.hiddenColumns.add(columnId);
        
        // Sauvegarder l'état
        if (this.config.persistState) {
            this.saveState();
        }

        // Émettre un événement
        this.table.table.dispatchEvent(new CustomEvent('column:hidden', {
            detail: { columnId, columnIndex },
            bubbles: true
        }));

        return true;
    }

    /**
     * Affiche une colonne
     */
    showColumn(columnIndex, animate = true) {
        if (this.state.isAnimating) return;

        const table = this.table.table;
        const headerCell = table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        const bodyCells = table.querySelectorAll(`tbody td:nth-child(${columnIndex + 1})`);
        const footerCells = table.querySelectorAll(`tfoot td:nth-child(${columnIndex + 1})`);
        
        if (!headerCell) return false;

        const columnId = headerCell.getAttribute('data-column-id') || headerCell.id;
        
        // Callback avant d'afficher
        if (typeof this.config.onBeforeShow === 'function') {
            const result = this.config.onBeforeShow(columnId, columnIndex);
            if (result === false) return false;
        }

        // Animation si activée
        if (animate && this.config.animation) {
            this.state.isAnimating = true;
            
            // Retirer la classe hide
            this.applyShowToColumn(headerCell, bodyCells, footerCells);
            
            // Appliquer la classe d'animation
            [headerCell, ...bodyCells, ...footerCells].forEach(cell => {
                cell.classList.add('column-animating-show');
            });

            // Après l'animation, nettoyer
            setTimeout(() => {
                [headerCell, ...bodyCells, ...footerCells].forEach(cell => {
                    cell.classList.remove('column-animating-show');
                });
                this.state.isAnimating = false;
                
                // Callback après avoir affiché
                if (typeof this.config.onAfterShow === 'function') {
                    this.config.onAfterShow(columnId, columnIndex);
                }
            }, this.config.animationDuration);
        } else {
            // Sans animation
            this.applyShowToColumn(headerCell, bodyCells, footerCells);
            
            // Callback après avoir affiché
            if (typeof this.config.onAfterShow === 'function') {
                this.config.onAfterShow(columnId, columnIndex);
            }
        }

        // Mettre à jour l'état
        this.state.hiddenColumns.delete(columnId);
        
        // Sauvegarder l'état
        if (this.config.persistState) {
            this.saveState();
        }

        // Émettre un événement
        this.table.table.dispatchEvent(new CustomEvent('column:shown', {
            detail: { columnId, columnIndex },
            bubbles: true
        }));

        return true;
    }

    /**
     * Applique le style de masquage aux cellules
     */
    applyHideToColumn(headerCell, bodyCells, footerCells) {
        [headerCell, ...bodyCells, ...footerCells].forEach(cell => {
            if (cell) {
                cell.classList.add(this.config.hideClass);
                cell.setAttribute(this.config.visibilityAttribute, 'false');
                cell.classList.remove('column-animating-hide');
            }
        });
    }

    /**
     * Applique le style d'affichage aux cellules
     */
    applyShowToColumn(headerCell, bodyCells, footerCells) {
        [headerCell, ...bodyCells, ...footerCells].forEach(cell => {
            if (cell) {
                cell.classList.remove(this.config.hideClass);
                cell.setAttribute(this.config.visibilityAttribute, 'true');
            }
        });
    }

    /**
     * Bascule la visibilité d'une colonne
     */
    toggleColumn(columnIndex) {
        const table = this.table.table;
        const headerCell = table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        
        if (!headerCell) return false;
        
        const columnId = headerCell.getAttribute('data-column-id') || headerCell.id;
        const isHidden = this.state.hiddenColumns.has(columnId);
        
        if (isHidden) {
            return this.showColumn(columnIndex);
        } else {
            return this.hideColumn(columnIndex);
        }
    }

    /**
     * Crée les boutons de bascule pour les colonnes
     */
    createToggleButtons() {
        let container = this.config.toggleButtonContainer;
        
        // Si pas de conteneur spécifié, en créer un
        if (!container) {
            container = document.createElement('div');
            container.className = 'column-visibility-container';
            this.table.table.parentNode.insertBefore(container, this.table.table);
        }

        const headers = this.table.table.querySelectorAll('thead th');
        
        headers.forEach((header, index) => {
            const columnId = header.getAttribute('data-column-id') || header.id || `col-${index}`;
            const columnText = header.textContent.trim() || `Colonne ${index + 1}`;
            
            const button = document.createElement('button');
            button.className = this.config.toggleButtonClass;
            button.setAttribute('data-column-index', index);
            button.setAttribute('data-column-id', columnId);
            
            const isVisible = !this.state.hiddenColumns.has(columnId);
            if (isVisible) {
                button.classList.add('active');
            }
            
            button.innerHTML = `
                <span>${isVisible ? '👁️' : '👁️‍🗨️'}</span>
                <span>${columnText}</span>
            `;
            
            button.addEventListener('click', () => this.handleColumnToggle(index));
            
            container.appendChild(button);
        });
    }

    /**
     * Gère le clic sur un bouton de bascule
     */
    handleColumnToggle(columnIndex) {
        if (!this.config.allowToggle) return;
        
        const success = this.toggleColumn(columnIndex);
        
        if (success) {
            // Mettre à jour le bouton
            const button = document.querySelector(`[data-column-index="${columnIndex}"]`);
            if (button) {
                const columnId = button.getAttribute('data-column-id');
                const isVisible = !this.state.hiddenColumns.has(columnId);
                
                button.classList.toggle('active', isVisible);
                button.querySelector('span:first-child').textContent = isVisible ? '👁️' : '👁️‍🗨️';
                
                // Désactiver le bouton si on atteint le minimum de colonnes visibles
                const visibleCount = this.getVisibleColumnsCount();
                if (visibleCount <= this.config.minVisibleColumns) {
                    // Désactiver tous les boutons des colonnes visibles
                    document.querySelectorAll(`.${this.config.toggleButtonClass}.active`).forEach(btn => {
                        btn.disabled = true;
                    });
                } else {
                    // Réactiver tous les boutons
                    document.querySelectorAll(`.${this.config.toggleButtonClass}`).forEach(btn => {
                        btn.disabled = false;
                    });
                }
            }
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        // Raccourcis clavier
        if (this.config.allowToggle) {
            document.addEventListener('keydown', this.handleKeyPress);
        }
    }

    /**
     * Gère les raccourcis clavier
     */
    handleKeyPress(event) {
        // Ctrl+H pour afficher/masquer le panneau de contrôle
        if (event.ctrlKey && event.key === 'h') {
            event.preventDefault();
            this.toggleControlPanel();
        }
    }

    /**
     * Affiche/masque le panneau de contrôle
     */
    toggleControlPanel() {
        const container = document.querySelector('.column-visibility-container');
        if (container) {
            container.style.display = container.style.display === 'none' ? '' : 'none';
        }
    }

    /**
     * Obtient le nombre de colonnes visibles
     */
    getVisibleColumnsCount() {
        const headers = this.table.table.querySelectorAll('thead th');
        let visibleCount = 0;
        
        headers.forEach((header) => {
            const columnId = header.getAttribute('data-column-id') || header.id;
            if (!this.state.hiddenColumns.has(columnId)) {
                visibleCount++;
            }
        });
        
        return visibleCount;
    }

    /**
     * Charge l'état sauvegardé
     */
    loadState() {
        if (!this.config.persistState) return;
        
        try {
            const savedState = localStorage.getItem(this.config.storageKey);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                if (parsed.hiddenColumns) {
                    this.state.hiddenColumns = new Set(parsed.hiddenColumns);
                }
            }
        } catch (error) {
            this.debug('Erreur lors du chargement de l\'état:', error);
        }
    }

    /**
     * Sauvegarde l'état actuel
     */
    saveState() {
        if (!this.config.persistState) return;
        
        try {
            const stateToSave = {
                hiddenColumns: Array.from(this.state.hiddenColumns)
            };
            localStorage.setItem(this.config.storageKey, JSON.stringify(stateToSave));
        } catch (error) {
            this.debug('Erreur lors de la sauvegarde de l\'état:', error);
        }
    }

    /**
     * API Publique
     */
    
    /**
     * Cache une colonne par son ID
     */
    hide(columnId) {
        const headers = this.table.table.querySelectorAll('thead th');
        let columnIndex = -1;
        
        headers.forEach((header, index) => {
            if (header.id === columnId || header.getAttribute('data-column-id') === columnId) {
                columnIndex = index;
            }
        });
        
        if (columnIndex !== -1) {
            return this.hideColumn(columnIndex);
        }
        
        return false;
    }

    /**
     * Affiche une colonne par son ID
     */
    show(columnId) {
        const headers = this.table.table.querySelectorAll('thead th');
        let columnIndex = -1;
        
        headers.forEach((header, index) => {
            if (header.id === columnId || header.getAttribute('data-column-id') === columnId) {
                columnIndex = index;
            }
        });
        
        if (columnIndex !== -1) {
            return this.showColumn(columnIndex);
        }
        
        return false;
    }

    /**
     * Bascule une colonne par son ID
     */
    toggle(columnId) {
        if (this.isHidden(columnId)) {
            return this.show(columnId);
        } else {
            return this.hide(columnId);
        }
    }

    /**
     * Vérifie si une colonne est cachée
     */
    isHidden(columnId) {
        return this.state.hiddenColumns.has(columnId);
    }

    /**
     * Obtient la liste des colonnes cachées
     */
    getHiddenColumns() {
        return Array.from(this.state.hiddenColumns);
    }

    /**
     * Obtient la liste des colonnes visibles
     */
    getVisibleColumns() {
        const headers = this.table.table.querySelectorAll('thead th');
        const visibleColumns = [];
        
        headers.forEach((header) => {
            const columnId = header.getAttribute('data-column-id') || header.id;
            if (!this.state.hiddenColumns.has(columnId)) {
                visibleColumns.push(columnId);
            }
        });
        
        return visibleColumns;
    }

    /**
     * Cache toutes les colonnes (sauf le minimum requis)
     */
    hideAll() {
        const headers = this.table.table.querySelectorAll('thead th');
        let hiddenCount = 0;
        const totalColumns = headers.length;
        const maxHideable = totalColumns - this.config.minVisibleColumns;
        
        headers.forEach((header, index) => {
            if (hiddenCount < maxHideable) {
                const columnId = header.getAttribute('data-column-id') || header.id;
                if (!this.state.hiddenColumns.has(columnId)) {
                    this.hideColumn(index);
                    hiddenCount++;
                }
            }
        });
    }

    /**
     * Affiche toutes les colonnes
     */
    showAll() {
        const headers = this.table.table.querySelectorAll('thead th');
        
        headers.forEach((header, index) => {
            const columnId = header.getAttribute('data-column-id') || header.id;
            if (this.state.hiddenColumns.has(columnId)) {
                this.showColumn(index);
            }
        });
    }

    /**
     * Réinitialise l'état (affiche toutes les colonnes)
     */
    reset() {
        this.showAll();
        if (this.config.persistState) {
            localStorage.removeItem(this.config.storageKey);
        }
    }

    /**
     * Rafraîchit le plugin
     */
    refresh() {
        this.identifyHideColumns();
        this.applyInitialState();
        
        if (this.config.showToggleButtons) {
            // Recréer les boutons
            const container = document.querySelector('.column-visibility-container');
            if (container) {
                container.innerHTML = '';
                this.createToggleButtons();
            }
        }
    }

    /**
     * Détruit le plugin
     */
    destroy() {
        // Supprimer les écouteurs d'événements
        document.removeEventListener('keydown', this.handleKeyPress);
        
        // Afficher toutes les colonnes
        this.showAll();
        
        // Supprimer les boutons de contrôle
        const container = document.querySelector('.column-visibility-container');
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        
        // Supprimer les styles
        const styleElement = document.getElementById('hide-plugin-styles');
        if (styleElement && styleElement.parentNode) {
            styleElement.parentNode.removeChild(styleElement);
        }
        
        // Réinitialiser l'état
        this.state = {
            hiddenColumns: new Set(),
            isInitialized: false,
            isAnimating: false
        };
        
        this.debug('Plugin détruit');
    }

    /**
     * Obtient la configuration actuelle
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Met à jour la configuration
     */
    updateConfig(newConfig) {
        Object.assign(this.config, newConfig);
        this.refresh();
    }
}