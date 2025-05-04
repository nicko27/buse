/**
 * Module de surbrillance pour le plugin Style
 * Gère la mise en évidence des cellules au survol
 */
export class HighlightModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.isInitialized = false;
        
        // État local
        this.state = {
            highlightedElements: new Map(),
            isProcessing: false,
            currentElement: null
        };
        
        // Cache pour les performances
        this.cache = {
            highlightTimeout: null,
            lastHighlightTime: 0,
            styleCache: new Map()
        };
        
        // Lier les méthodes
        this._boundMouseOverHandler = this.handleMouseOver.bind(this);
        this._boundMouseOutHandler = this.handleMouseOut.bind(this);
        this._boundFocusHandler = this.handleFocus.bind(this);
        this._boundBlurHandler = this.handleBlur.bind(this);
        this._boundKeyDownHandler = this.handleKeyDown.bind(this);
    }

    /**
     * Initialise le module
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            this.plugin.logger.warn('Module Highlight déjà initialisé');
            return;
        }

        try {
            this.plugin.logger.info('Initialisation du module Highlight');
            
            // Configurer les écouteurs d'événements
            this.setupEventListeners();
            
            // Initialiser les styles
            this.initializeStyles();
            
            this.isInitialized = true;
            this.plugin.metrics.increment('highlight_module_init');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_init');
            throw error;
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        try {
            const table = this.plugin.tableFlow.table;
            
            // Événements de la souris
            table.addEventListener('mouseover', this._boundMouseOverHandler);
            table.addEventListener('mouseout', this._boundMouseOutHandler);
            
            // Événements du clavier et du focus
            table.addEventListener('focus', this._boundFocusHandler, true);
            table.addEventListener('blur', this._boundBlurHandler, true);
            table.addEventListener('keydown', this._boundKeyDownHandler);
            
            // Ajouter les attributs ARIA
            const cells = table.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.setAttribute('tabindex', '0');
                cell.setAttribute('aria-selected', 'false');
            });
            
            this.plugin.metrics.increment('highlight_event_listeners_setup');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_setup_listeners');
        }
    }

    initializeStyles() {
        try {
            // Créer les styles de base
            const baseStyle = {
                backgroundColor: this.plugin.config.highlight.backgroundColor || 'rgba(33, 150, 243, 0.1)',
                transition: 'background-color 0.2s ease',
                outline: this.plugin.config.highlight.focusOutline || '2px solid #2196F3'
            };
            
            // Mettre en cache le style de base
            this.cache.styleCache.set('base', baseStyle);
            
            // Créer les styles pour le focus
            const focusStyle = {
                ...baseStyle,
                backgroundColor: this.plugin.config.highlight.focusBackgroundColor || 'rgba(33, 150, 243, 0.2)',
                outlineOffset: '2px'
            };
            
            this.cache.styleCache.set('focus', focusStyle);
            
            this.plugin.metrics.increment('highlight_styles_initialized');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_initialize_styles');
        }
    }

    /**
     * Gère le survol de la souris
     * @param {MouseEvent} event
     */
    async handleMouseOver(event) {
        if (!this.isInitialized || this.state.isProcessing) return;

        try {
            const element = event.target.closest('td, th');
            if (!element) return;
            
            const startTime = performance.now();
            this.state.isProcessing = true;
            
            // Déclencher le hook beforeHighlight
            const beforeResult = await this.plugin.tableFlow.hooks.trigger('beforeHighlight', {
                element,
                event,
                type: 'hover'
            });
            
            if (beforeResult === false) return;
            
            // Appliquer le style
            const style = this.cache.styleCache.get('base');
            const styleId = this.plugin.styleManager.applyStyle(element, style);
            
            // Mettre à jour l'état
            this.state.highlightedElements.set(element, styleId);
            this.state.currentElement = element;
            
            // Mettre à jour les attributs ARIA
            element.setAttribute('aria-selected', 'true');
            
            // Déclencher le hook afterHighlight
            await this.plugin.tableFlow.hooks.trigger('afterHighlight', {
                element,
                styleId,
                type: 'hover',
                performance: {
                    duration: performance.now() - startTime
                }
            });
            
            this.plugin.metrics.increment('highlight_mouse_over');
            this.plugin.metrics.record('highlight_duration', performance.now() - startTime);
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_handle_mouse_over');
        } finally {
            this.state.isProcessing = false;
        }
    }

    /**
     * Gère la sortie de la souris
     * @param {MouseEvent} event
     */
    async handleMouseOut(event) {
        if (!this.isInitialized) return;

        try {
            const element = event.target.closest('td, th');
            if (!element) return;
            
            const styleId = this.state.highlightedElements.get(element);
            if (!styleId) return;
            
            // Déclencher le hook beforeUnhighlight
            const beforeResult = await this.plugin.tableFlow.hooks.trigger('beforeUnhighlight', {
                element,
                event,
                type: 'hover'
            });
            
            if (beforeResult === false) return;
            
            // Supprimer le style
            this.plugin.styleManager.removeStyle(element, styleId);
            
            // Mettre à jour l'état
            this.state.highlightedElements.delete(element);
            if (this.state.currentElement === element) {
                this.state.currentElement = null;
            }
            
            // Mettre à jour les attributs ARIA
            element.setAttribute('aria-selected', 'false');
            
            // Déclencher le hook afterUnhighlight
            await this.plugin.tableFlow.hooks.trigger('afterUnhighlight', {
                element,
                type: 'hover'
            });
            
            this.plugin.metrics.increment('highlight_mouse_out');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_handle_mouse_out');
        }
    }

    /**
     * Gère le focus
     * @param {FocusEvent} event
     */
    async handleFocus(event) {
        if (!this.isInitialized) return;

        try {
            const element = event.target.closest('td, th');
            if (!element) return;
            
            // Appliquer le style de focus
            const style = this.cache.styleCache.get('focus');
            const styleId = this.plugin.styleManager.applyStyle(element, style);
            
            // Mettre à jour l'état
            this.state.highlightedElements.set(element, styleId);
            this.state.currentElement = element;
            
            // Mettre à jour les attributs ARIA
            element.setAttribute('aria-selected', 'true');
            
            this.plugin.metrics.increment('highlight_focus');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_handle_focus');
        }
    }

    /**
     * Gère le blur
     * @param {FocusEvent} event
     */
    async handleBlur(event) {
        if (!this.isInitialized) return;

        try {
            const element = event.target.closest('td, th');
            if (!element) return;
            
            const styleId = this.state.highlightedElements.get(element);
            if (!styleId) return;
            
            // Supprimer le style
            this.plugin.styleManager.removeStyle(element, styleId);
            
            // Mettre à jour l'état
            this.state.highlightedElements.delete(element);
            if (this.state.currentElement === element) {
                this.state.currentElement = null;
            }
            
            // Mettre à jour les attributs ARIA
            element.setAttribute('aria-selected', 'false');
            
            this.plugin.metrics.increment('highlight_blur');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_handle_blur');
        }
    }

    handleKeyDown(event) {
        if (!this.isInitialized || !this.state.currentElement) return;

        try {
            // Gérer la navigation au clavier
            switch (event.key) {
                case 'ArrowRight':
                    this.navigateToNextCell('next');
                    break;
                case 'ArrowLeft':
                    this.navigateToNextCell('previous');
                    break;
                case 'ArrowDown':
                    this.navigateToNextRow('next');
                    break;
                case 'ArrowUp':
                    this.navigateToNextRow('previous');
                    break;
            }
            
            this.plugin.metrics.increment('highlight_key_down');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_handle_key_down');
        }
    }

    navigateToNextCell(direction) {
        const currentCell = this.state.currentElement;
        const cells = Array.from(currentCell.parentElement.cells);
        const currentIndex = cells.indexOf(currentCell);
        
        let nextCell;
        if (direction === 'next') {
            nextCell = cells[currentIndex + 1];
        } else {
            nextCell = cells[currentIndex - 1];
        }
        
        if (nextCell) {
            nextCell.focus();
        }
    }

    navigateToNextRow(direction) {
        const currentCell = this.state.currentElement;
        const currentRow = currentCell.parentElement;
        const rows = Array.from(this.plugin.tableFlow.table.rows);
        const currentRowIndex = rows.indexOf(currentRow);
        const currentCellIndex = Array.from(currentRow.cells).indexOf(currentCell);
        
        let nextRow;
        if (direction === 'next') {
            nextRow = rows[currentRowIndex + 1];
        } else {
            nextRow = rows[currentRowIndex - 1];
        }
        
        if (nextRow && nextRow.cells[currentCellIndex]) {
            nextRow.cells[currentCellIndex].focus();
        }
    }

    /**
     * Nettoie les ressources
     */
    async destroy() {
        if (!this.isInitialized) return;

        try {
            const table = this.plugin.tableFlow.table;
            
            // Supprimer les écouteurs d'événements
            table.removeEventListener('mouseover', this._boundMouseOverHandler);
            table.removeEventListener('mouseout', this._boundMouseOutHandler);
            table.removeEventListener('focus', this._boundFocusHandler, true);
            table.removeEventListener('blur', this._boundBlurHandler, true);
            table.removeEventListener('keydown', this._boundKeyDownHandler);
            
            // Nettoyer les styles
            for (const [element, styleId] of this.state.highlightedElements) {
                this.plugin.styleManager.removeStyle(element, styleId);
            }
            
            // Nettoyer les attributs ARIA
            const cells = table.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.removeAttribute('tabindex');
                cell.removeAttribute('aria-selected');
            });
            
            // Nettoyer l'état et le cache
            this.state.highlightedElements.clear();
            this.state.currentElement = null;
            this.cache.styleCache.clear();
            
            this.isInitialized = false;
            this.plugin.logger.info('Module Highlight détruit');
            this.plugin.metrics.increment('highlight_module_destroyed');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'highlight_destroy');
        }
    }
} 