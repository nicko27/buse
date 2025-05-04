/**
 * ColumnReorderPlugin pour TableFlow
 * Permet de réorganiser les colonnes d'un tableau par glisser-déposer
 * Version: 1.0.0
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class ColumnReorderPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.ORDER;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        this.isDragging = false;
        this.draggedColumn = null;
        this.placeholder = null;
        this.ghost = null;
        this.originalOrder = [];
    }

    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin ColumnReorder déjà initialisé');
            return;
        }

        try {
            if (!this.tableFlow) {
                throw new Error('Instance de TableFlow requise');
            }

            this.setupHandles();
            this.setupEventListeners();
            this.saveOriginalOrder();
            this.isInitialized = true;
            this.logger.info('Plugin ColumnReorder initialisé avec succès');
        } catch (error) {
            this.errorHandler.handle(error, 'columnreorder_init');
            throw error;
        }
    }

    setupHandles() {
        const headers = this.tableFlow.getHeaders();
        headers.forEach(header => {
            const handle = this.createHandle(header);
            header.appendChild(handle);
        });
    }

    createHandle(header) {
        const handle = document.createElement('div');
        handle.className = this.config.handleClass;
        handle.setAttribute('role', 'button');
        handle.setAttribute('aria-label', this.config.messages.dragHandle);
        handle.setAttribute('tabindex', '0');
        
        // Position du handle
        if (this.config.interface.handlePosition === 'right') {
            handle.style.left = 'auto';
            handle.style.right = '0';
        }
        
        return handle;
    }

    setupEventListeners() {
        const handles = this.tableFlow.table.querySelectorAll(`.${this.config.handleClass}`);
        
        handles.forEach(handle => {
            handle.addEventListener('mousedown', this.handleMouseDown.bind(this));
            handle.addEventListener('touchstart', this.handleTouchStart.bind(this));
            handle.addEventListener('keydown', this.handleKeyDown.bind(this));
        });

        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        document.addEventListener('touchmove', this.handleTouchMove.bind(this));
        document.addEventListener('touchend', this.handleTouchEnd.bind(this));
    }

    handleMouseDown(e) {
        if (!this.config.reorder.enabled) return;
        
        const handle = e.target;
        const header = handle.parentElement;
        
        this.startDrag(header, e.clientX);
        e.preventDefault();
    }

    handleTouchStart(e) {
        if (!this.config.reorder.enabled) return;
        
        const handle = e.target;
        const header = handle.parentElement;
        const touch = e.touches[0];
        
        this.startDrag(header, touch.clientX);
        e.preventDefault();
    }

    startDrag(header, clientX) {
        this.isDragging = true;
        this.draggedColumn = header;
        
        // Créer le placeholder
        this.placeholder = this.createPlaceholder(header);
        header.parentElement.insertBefore(this.placeholder, header);
        
        // Créer le ghost
        this.ghost = this.createGhost(header);
        document.body.appendChild(this.ghost);
        
        // Appliquer les classes
        header.classList.add(this.config.draggingClass);
        this.ghost.classList.add(this.config.ghostClass);
        
        // Position initiale
        this.initialX = clientX;
        this.initialIndex = Array.from(header.parentElement.children).indexOf(header);
        
        // Appeler le hook beforeDrag
        if (typeof this.config.hooks.beforeDrag === 'function') {
            this.config.hooks.beforeDrag(header, this.initialIndex);
        }
    }

    createPlaceholder(header) {
        const placeholder = document.createElement('th');
        placeholder.className = this.config.placeholderClass;
        placeholder.style.width = `${header.offsetWidth}px`;
        placeholder.style.height = `${header.offsetHeight}px`;
        return placeholder;
    }

    createGhost(header) {
        const ghost = header.cloneNode(true);
        ghost.style.width = `${header.offsetWidth}px`;
        ghost.style.height = `${header.offsetHeight}px`;
        ghost.style.position = 'fixed';
        ghost.style.pointerEvents = 'none';
        return ghost;
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        this.updateGhostPosition(e.clientX);
        this.updateColumnOrder(e.clientX);
    }

    handleTouchMove(e) {
        if (!this.isDragging) return;
        
        const touch = e.touches[0];
        this.updateGhostPosition(touch.clientX);
        this.updateColumnOrder(touch.clientX);
    }

    updateGhostPosition(clientX) {
        if (!this.ghost) return;
        
        const deltaX = clientX - this.initialX;
        this.ghost.style.transform = `translateX(${deltaX}px)`;
    }

    updateColumnOrder(clientX) {
        const headers = Array.from(this.draggedColumn.parentElement.children);
        const currentIndex = headers.indexOf(this.placeholder);
        const targetIndex = this.calculateTargetIndex(clientX);
        
        if (targetIndex !== currentIndex) {
            headers[targetIndex].parentElement.insertBefore(
                this.placeholder,
                targetIndex > currentIndex ? headers[targetIndex].nextSibling : headers[targetIndex]
            );
        }
    }

    calculateTargetIndex(clientX) {
        const headers = Array.from(this.draggedColumn.parentElement.children);
        const headerWidth = this.draggedColumn.offsetWidth;
        const tableRect = this.tableFlow.table.getBoundingClientRect();
        const relativeX = clientX - tableRect.left;
        
        return Math.min(
            Math.max(
                0,
                Math.floor(relativeX / headerWidth)
            ),
            headers.length - 1
        );
    }

    handleMouseUp() {
        if (!this.isDragging) return;
        this.finishDrag();
    }

    handleTouchEnd() {
        if (!this.isDragging) return;
        this.finishDrag();
    }

    finishDrag() {
        if (!this.draggedColumn || !this.placeholder) return;
        
        const newIndex = Array.from(this.placeholder.parentElement.children).indexOf(this.placeholder);
        
        // Déplacer la colonne à sa nouvelle position
        this.placeholder.parentElement.insertBefore(
            this.draggedColumn,
            this.placeholder.nextSibling
        );
        
        // Nettoyer
        this.placeholder.remove();
        this.ghost.remove();
        this.draggedColumn.classList.remove(this.config.draggingClass);
        
        // Mettre à jour l'ordre des colonnes dans les données
        this.updateColumnOrderInData(newIndex);
        
        // Appeler le hook afterDrag
        if (typeof this.config.hooks.afterDrag === 'function') {
            this.config.hooks.afterDrag(this.draggedColumn, newIndex);
        }
        
        // Réinitialiser
        this.isDragging = false;
        this.draggedColumn = null;
        this.placeholder = null;
        this.ghost = null;
    }

    updateColumnOrderInData(newIndex) {
        const headers = Array.from(this.draggedColumn.parentElement.children);
        const columnOrder = headers.map(header => 
            header.getAttribute('data-column-id') || 
            header.getAttribute('data-field') || 
            header.textContent.trim()
        );
        
        this.tableFlow.updateColumnOrder(columnOrder);
    }

    handleKeyDown(e) {
        if (!this.config.reorder.enabled) return;
        
        const handle = e.target;
        const header = handle.parentElement;
        
        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                this.startDrag(header, header.getBoundingClientRect().left);
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                this.moveColumn(header, -1);
                break;
                
            case 'ArrowRight':
                e.preventDefault();
                this.moveColumn(header, 1);
                break;
                
            case 'Escape':
                if (this.isDragging) {
                    e.preventDefault();
                    this.cancelDrag();
                }
                break;
        }
    }

    moveColumn(header, direction) {
        try {
            const headers = Array.from(header.parentElement.children);
            const currentIndex = headers.indexOf(header);
            const newIndex = currentIndex + direction;

            if (newIndex >= 0 && newIndex < headers.length) {
                const beforeResult = this.tableFlow.hooks.trigger('beforeColumnMove', {
                    header,
                    fromIndex: currentIndex,
                    toIndex: newIndex
                });

                if (beforeResult === false) return;

                const parent = header.parentElement;
                if (direction > 0) {
                    parent.insertBefore(header, headers[newIndex + 1]);
                } else {
                    parent.insertBefore(header, headers[newIndex]);
                }

                this.updateColumnOrderInData(newIndex);

                this.tableFlow.hooks.trigger('afterColumnMove', {
                    header,
                    fromIndex: currentIndex,
                    toIndex: newIndex
                });

                this.metrics.increment('column_moved');
            }
        } catch (error) {
            this.errorHandler.handle(error, 'columnreorder_move');
            this.logger.error('Erreur lors du déplacement de la colonne:', error);
        }
    }

    cancelDrag() {
        if (!this.isDragging) return;

        try {
            if (this.placeholder) {
                this.placeholder.remove();
            }
            if (this.ghost) {
                this.ghost.remove();
            }
            if (this.draggedColumn) {
                this.draggedColumn.classList.remove(this.config.draggingClass);
            }

            this.isDragging = false;
            this.draggedColumn = null;
            this.placeholder = null;
            this.ghost = null;

            this.tableFlow.emit('columnreorder:cancelled');
            this.metrics.increment('columnreorder_cancelled');
        } catch (error) {
            this.errorHandler.handle(error, 'columnreorder_cancel');
        }
    }

    saveOriginalOrder() {
        const headers = this.tableFlow.getHeaders();
        this.originalOrder = headers.map(header => 
            header.getAttribute('data-column-id') || 
            header.getAttribute('data-field') || 
            header.textContent.trim()
        );
    }

    resetOrder() {
        try {
            const beforeResult = this.tableFlow.hooks.trigger('beforeOrderReset');
            if (beforeResult === false) return;

            this.tableFlow.updateColumnOrder(this.originalOrder);
            this.tableFlow.emit('columnreorder:reset');

            this.tableFlow.hooks.trigger('afterOrderReset');
            this.metrics.increment('columnreorder_reset');
        } catch (error) {
            this.errorHandler.handle(error, 'columnreorder_reset');
            this.logger.error('Erreur lors de la réinitialisation de l\'ordre:', error);
        }
    }

    refresh() {
        if (!this.isInitialized) {
            this.logger.warn('Plugin ColumnReorder non initialisé');
            return;
        }
        this.setupHandles();
    }

    destroy() {
        if (!this.isInitialized) return;

        try {
            this.cancelDrag();
            
            const handles = this.tableFlow.table.querySelectorAll(`.${this.config.handleClass}`);
            handles.forEach(handle => {
                handle.removeEventListener('mousedown', this.handleMouseDown);
                handle.removeEventListener('touchstart', this.handleTouchStart);
                handle.removeEventListener('keydown', this.handleKeyDown);
            });

            document.removeEventListener('mousemove', this.handleMouseMove);
            document.removeEventListener('mouseup', this.handleMouseUp);
            document.removeEventListener('touchmove', this.handleTouchMove);
            document.removeEventListener('touchend', this.handleTouchEnd);

            this.isInitialized = false;
            this.logger.info('Plugin ColumnReorder détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'columnreorder_destroy');
        } finally {
            super.destroy();
        }
    }
}