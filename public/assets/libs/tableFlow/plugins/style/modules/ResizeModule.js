/**
 * Module de redimensionnement pour le plugin Style
 * Gère le redimensionnement des colonnes et des lignes du tableau
 */
export class ResizeModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.isInitialized = false;
        
        // État local
        this.state = {
            isResizing: false,
            currentElement: null,
            startPosition: null,
            originalSize: null,
            resizeType: null, // 'column' ou 'row'
            minSize: 50,
            maxSize: 500
        };
        
        // Cache pour les performances
        this.cache = {
            resizeTimeout: null,
            lastResizeTime: 0,
            elementSizes: new Map(),
            resizeHandles: new Map()
        };
        
        // Lier les méthodes
        this._boundMouseDownHandler = this.handleMouseDown.bind(this);
        this._boundMouseMoveHandler = this.handleMouseMove.bind(this);
        this._boundMouseUpHandler = this.handleMouseUp.bind(this);
        this._boundKeyDownHandler = this.handleKeyDown.bind(this);
        this._boundKeyUpHandler = this.handleKeyUp.bind(this);
    }

    async init() {
        if (this.isInitialized) {
            this.plugin.logger.warn('Module Resize déjà initialisé');
            return;
        }

        try {
            this.plugin.logger.info('Initialisation du module Resize');
            
            // Configurer les écouteurs d'événements
            this.setupEventListeners();
            
            // Initialiser les poignées de redimensionnement
            await this.initializeResizeHandles();
            
            this.isInitialized = true;
            this.plugin.metrics.increment('resize_module_init');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_init');
            throw error;
        }
    }

    setupEventListeners() {
        try {
            const table = this.plugin.tableFlow.table;
            
            // Événements de la souris
            document.addEventListener('mousemove', this._boundMouseMoveHandler);
            document.addEventListener('mouseup', this._boundMouseUpHandler);
            
            // Événements du clavier
            document.addEventListener('keydown', this._boundKeyDownHandler);
            document.addEventListener('keyup', this._boundKeyUpHandler);
            
            // Ajouter les attributs ARIA
            table.setAttribute('data-resizable', 'true');
            
            this.plugin.metrics.increment('resize_event_listeners_setup');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_setup_listeners');
        }
    }

    async initializeResizeHandles() {
        try {
            const table = this.plugin.tableFlow.table;
            const headers = table.querySelectorAll('th');
            
            headers.forEach((header, index) => {
                // Créer la poignée de redimensionnement
                const handle = document.createElement('div');
                handle.className = 'resize-handle';
                handle.setAttribute('role', 'separator');
                handle.setAttribute('aria-label', `Redimensionner la colonne ${index + 1}`);
                handle.setAttribute('tabindex', '0');
                handle.setAttribute('data-column', index);
                
                // Styles de base
                Object.assign(handle.style, {
                    position: 'absolute',
                    right: '0',
                    top: '0',
                    bottom: '0',
                    width: '6px',
                    cursor: 'col-resize',
                    backgroundColor: 'transparent',
                    transition: 'background-color 0.2s'
                });
                
                // Événements
                handle.addEventListener('mousedown', this._boundMouseDownHandler);
                handle.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.handleMouseDown(e);
                    }
                });
                
                // Ajouter au cache
                this.cache.resizeHandles.set(index, handle);
                
                // Ajouter au DOM
                header.style.position = 'relative';
                header.appendChild(handle);
            });
            
            this.plugin.metrics.increment('resize_handles_initialized');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_initialize_handles');
        }
    }

    async handleMouseDown(event) {
        if (!this.isInitialized) return;

        try {
            const handle = event.target;
            if (!handle.classList.contains('resize-handle')) return;
            
            const column = handle.closest('th');
            if (!column) return;
            
            // Déclencher le hook beforeResize
            const beforeResult = await this.plugin.tableFlow.hooks.trigger('beforeResize', {
                element: column,
                type: 'column',
                event
            });
            
            if (beforeResult === false) return;
            
            // Mettre à jour l'état
            this.state.isResizing = true;
            this.state.currentElement = column;
            this.state.startPosition = event.clientX;
            this.state.originalSize = column.offsetWidth;
            this.state.resizeType = 'column';
            
            // Ajouter la classe de redimensionnement
            column.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            
            // Mettre à jour les attributs ARIA
            column.setAttribute('aria-busy', 'true');
            
            this.plugin.metrics.increment('resize_started');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_handle_mouse_down');
        }
    }

    async handleMouseMove(event) {
        if (!this.isInitialized || !this.state.isResizing) return;

        try {
            const startTime = performance.now();
            
            // Calculer la nouvelle taille
            const diff = event.clientX - this.state.startPosition;
            let newSize = this.state.originalSize + diff;
            
            // Appliquer les limites
            newSize = Math.max(this.state.minSize, Math.min(newSize, this.state.maxSize));
            
            // Mettre à jour la taille
            this.state.currentElement.style.width = `${newSize}px`;
            
            // Mettre en cache la taille
            this.cache.elementSizes.set(this.state.currentElement, newSize);
            
            // Déclencher le hook onResize
            await this.plugin.tableFlow.hooks.trigger('onResize', {
                element: this.state.currentElement,
                type: this.state.resizeType,
                size: newSize,
                performance: {
                    duration: performance.now() - startTime
                }
            });
            
            this.plugin.metrics.increment('resize_moved');
            this.plugin.metrics.record('resize_duration', performance.now() - startTime);
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_handle_mouse_move');
        }
    }

    async handleMouseUp() {
        if (!this.isInitialized || !this.state.isResizing) return;

        try {
            // Déclencher le hook afterResize
            await this.plugin.tableFlow.hooks.trigger('afterResize', {
                element: this.state.currentElement,
                type: this.state.resizeType,
                size: this.cache.elementSizes.get(this.state.currentElement)
            });
            
            // Nettoyer l'état
            this.state.currentElement.classList.remove('resizing');
            this.state.currentElement.setAttribute('aria-busy', 'false');
            document.body.style.cursor = '';
            
            // Réinitialiser l'état
            this.state.isResizing = false;
            this.state.currentElement = null;
            this.state.startPosition = null;
            this.state.originalSize = null;
            this.state.resizeType = null;
            
            this.plugin.metrics.increment('resize_ended');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_handle_mouse_up');
        }
    }

    handleKeyDown(event) {
        if (!this.isInitialized || !this.state.isResizing) return;

        try {
            // Annuler le redimensionnement avec Escape
            if (event.key === 'Escape') {
                this.cancelResize();
            }
            
            // Ajuster la taille avec les flèches
            if (event.key.startsWith('Arrow')) {
                event.preventDefault();
                this.adjustSizeWithKeyboard(event.key);
            }
            
            this.plugin.metrics.increment('resize_key_down');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_handle_key_down');
        }
    }

    handleKeyUp(event) {
        if (!this.isInitialized || !this.state.isResizing) return;

        try {
            // Terminer le redimensionnement avec Enter
            if (event.key === 'Enter') {
                this.finishResize();
            }
            
            this.plugin.metrics.increment('resize_key_up');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_handle_key_up');
        }
    }

    async adjustSizeWithKeyboard(key) {
        try {
            const currentSize = this.cache.elementSizes.get(this.state.currentElement);
            let newSize = currentSize;
            
            switch (key) {
                case 'ArrowLeft':
                    newSize = Math.max(this.state.minSize, currentSize - 1);
                    break;
                case 'ArrowRight':
                    newSize = Math.min(this.state.maxSize, currentSize + 1);
                    break;
                case 'ArrowUp':
                    newSize = Math.max(this.state.minSize, currentSize - 10);
                    break;
                case 'ArrowDown':
                    newSize = Math.min(this.state.maxSize, currentSize + 10);
                    break;
            }
            
            if (newSize !== currentSize) {
                this.state.currentElement.style.width = `${newSize}px`;
                this.cache.elementSizes.set(this.state.currentElement, newSize);
                
                await this.plugin.tableFlow.hooks.trigger('onResize', {
                    element: this.state.currentElement,
                    type: this.state.resizeType,
                    size: newSize
                });
            }
            
            this.plugin.metrics.increment('resize_keyboard_adjusted');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_adjust_with_keyboard');
        }
    }

    async cancelResize() {
        try {
            if (this.state.currentElement && this.state.originalSize) {
                this.state.currentElement.style.width = `${this.state.originalSize}px`;
                this.cache.elementSizes.set(this.state.currentElement, this.state.originalSize);
                
                await this.plugin.tableFlow.hooks.trigger('onResizeCancel', {
                    element: this.state.currentElement,
                    type: this.state.resizeType
                });
            }
            
            this.handleMouseUp();
            this.plugin.metrics.increment('resize_cancelled');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_cancel');
        }
    }

    async finishResize() {
        try {
            if (this.state.currentElement) {
                const finalSize = this.cache.elementSizes.get(this.state.currentElement);
                
                await this.plugin.tableFlow.hooks.trigger('onResizeComplete', {
                    element: this.state.currentElement,
                    type: this.state.resizeType,
                    size: finalSize
                });
            }
            
            this.handleMouseUp();
            this.plugin.metrics.increment('resize_completed');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_finish');
        }
    }

    getColumnSize(index) {
        const header = this.plugin.tableFlow.table.querySelector(`th:nth-child(${index + 1})`);
        return header ? this.cache.elementSizes.get(header) : null;
    }

    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            document.removeEventListener('mousemove', this._boundMouseMoveHandler);
            document.removeEventListener('mouseup', this._boundMouseUpHandler);
            document.removeEventListener('keydown', this._boundKeyDownHandler);
            document.removeEventListener('keyup', this._boundKeyUpHandler);
            
            // Supprimer les poignées de redimensionnement
            this.cache.resizeHandles.forEach((handle, index) => {
                handle.removeEventListener('mousedown', this._boundMouseDownHandler);
                handle.remove();
            });
            
            // Nettoyer les styles
            const table = this.plugin.tableFlow.table;
            table.removeAttribute('data-resizable');
            
            const headers = table.querySelectorAll('th');
            headers.forEach(header => {
                header.style.width = '';
                header.style.position = '';
                header.classList.remove('resizing');
                header.removeAttribute('aria-busy');
            });
            
            // Nettoyer l'état et le cache
            this.state.isResizing = false;
            this.state.currentElement = null;
            this.cache.elementSizes.clear();
            this.cache.resizeHandles.clear();
            
            this.isInitialized = false;
            this.plugin.logger.info('Module Resize détruit');
            this.plugin.metrics.increment('resize_module_destroyed');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'resize_destroy');
        }
    }
} 