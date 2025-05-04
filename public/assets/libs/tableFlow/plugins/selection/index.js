/**
 * Plugin de sélection pour TableFlow
 * Permet la sélection de cellules, lignes et colonnes avec différentes options
 * et méthodes pour manipuler les sélections
 */
import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';
import { config } from './config.js';
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';

export class SelectionPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.SELECTION;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        // État local
        this.state = {
            selectedCells: new Set(),
            selectedRows: new Set(),
            selectedColumns: new Set(),
            isSelecting: false,
            startCell: null,
            endCell: null
        };
        
        // Cache pour les performances
        this.cache = {
            selectionTimeout: null,
            lastSelectionTime: 0
        };
        
        // Lier les méthodes
        this._boundMouseDownHandler = this.handleMouseDown.bind(this);
        this._boundMouseMoveHandler = this.handleMouseMove.bind(this);
        this._boundMouseUpHandler = this.handleMouseUp.bind(this);
        this._boundKeyDownHandler = this.handleKeyDown.bind(this);
    }
    
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Selection déjà initialisé');
            return;
        }

        try {
            this.logger.info('Initialisation du plugin Selection');
            
            // Ajouter les écouteurs d'événements
            this.setupEventListeners();
            
            // Initialiser les styles
            this.initializeStyles();
            
            this.isInitialized = true;
            this.metrics.increment('plugin_selection_init');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_init');
            throw error;
        }
    }
    
    setupEventListeners() {
        try {
            // Événements de la souris
            this.tableFlow.table.addEventListener('mousedown', this._boundMouseDownHandler);
            document.addEventListener('mousemove', this._boundMouseMoveHandler);
            document.addEventListener('mouseup', this._boundMouseUpHandler);
            
            // Événements du clavier
            document.addEventListener('keydown', this._boundKeyDownHandler);
            
            this.metrics.increment('selection_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_setup_listeners');
        }
    }
    
    initializeStyles() {
        try {
            // Ajouter les styles CSS
            const style = document.createElement('style');
            style.textContent = `
                .${this.config.selectedClass} {
                    background-color: ${this.config.selection.backgroundColor};
                    color: ${this.config.selection.textColor};
                }
                .${this.config.selectedClass}-row {
                    background-color: ${this.config.selection.rowBackgroundColor};
                }
                .${this.config.selectedClass}-column {
                    background-color: ${this.config.selection.columnBackgroundColor};
                }
            `;
            document.head.appendChild(style);
            
            this.metrics.increment('selection_styles_initialized');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_initialize_styles');
        }
    }
    
    async handleMouseDown(event) {
        if (!this.isInitialized) return;

        try {
            const cell = event.target.closest('td, th');
            if (!cell) return;
            
            // Déclencher le hook beforeSelectionStart
            const beforeResult = await this.tableFlow.hooks.trigger('beforeSelectionStart', {
                cell,
                event
            });
            
            if (beforeResult === false) return;
            
            this.state.isSelecting = true;
            this.state.startCell = cell;
            this.state.endCell = cell;
            
            // Sélectionner la cellule initiale
            await this.selectCell(cell);
            
            this.metrics.increment('selection_mouse_down');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_handle_mouse_down');
        }
    }
    
    async handleMouseMove(event) {
        if (!this.isInitialized || !this.state.isSelecting) return;

        try {
            const cell = event.target.closest('td, th');
            if (!cell || cell === this.state.endCell) return;
            
            this.state.endCell = cell;
            
            // Déclencher le hook beforeSelectionUpdate
            const beforeResult = await this.tableFlow.hooks.trigger('beforeSelectionUpdate', {
                startCell: this.state.startCell,
                endCell: this.state.endCell,
                event
            });
            
            if (beforeResult === false) return;
            
            // Mettre à jour la sélection
            await this.updateSelection();
            
            this.metrics.increment('selection_mouse_move');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_handle_mouse_move');
        }
    }
    
    async handleMouseUp(event) {
        if (!this.isInitialized || !this.state.isSelecting) return;

        try {
            this.state.isSelecting = false;
            
            // Déclencher le hook afterSelectionEnd
            await this.tableFlow.hooks.trigger('afterSelectionEnd', {
                startCell: this.state.startCell,
                endCell: this.state.endCell,
                selectedCells: Array.from(this.state.selectedCells),
                selectedRows: Array.from(this.state.selectedRows),
                selectedColumns: Array.from(this.state.selectedColumns)
            });
            
            this.metrics.increment('selection_mouse_up');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_handle_mouse_up');
        }
    }
    
    async handleKeyDown(event) {
        if (!this.isInitialized) return;

        try {
            // Gérer les raccourcis clavier
            if (event.ctrlKey || event.metaKey) {
                switch (event.key) {
                    case 'a':
                        event.preventDefault();
                        await this.selectAll();
                        break;
                    case 'c':
                        event.preventDefault();
                        await this.copySelection();
                        break;
                }
            }
            
            this.metrics.increment('selection_key_down');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_handle_key_down');
        }
    }
    
    async selectCell(cell) {
        try {
            // Ajouter la cellule à la sélection
            this.state.selectedCells.add(cell);
            cell.classList.add(this.config.selectedClass);
            
            // Mettre à jour les lignes et colonnes sélectionnées
            const row = cell.closest('tr');
            const columnIndex = Array.from(row.cells).indexOf(cell);
            
            this.state.selectedRows.add(row);
            this.state.selectedColumns.add(columnIndex);
            
            // Mettre à jour les styles
            row.classList.add(`${this.config.selectedClass}-row`);
            this.updateColumnStyle(columnIndex);
            
            // Déclencher le hook afterCellSelect
            await this.tableFlow.hooks.trigger('afterCellSelect', {
                cell,
                row,
                columnIndex
            });
            
            this.metrics.increment('selection_cell_select');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_select_cell');
        }
    }
    
    async updateSelection() {
        try {
            // Calculer la zone de sélection
            const startRow = this.state.startCell.closest('tr');
            const endRow = this.state.endCell.closest('tr');
            const startColumn = Array.from(startRow.cells).indexOf(this.state.startCell);
            const endColumn = Array.from(endRow.cells).indexOf(this.state.endCell);
            
            // Déterminer les limites
            const minRow = Math.min(startRow.rowIndex, endRow.rowIndex);
            const maxRow = Math.max(startRow.rowIndex, endRow.rowIndex);
            const minColumn = Math.min(startColumn, endColumn);
            const maxColumn = Math.max(startColumn, endColumn);
            
            // Mettre à jour la sélection
            this.clearSelection();
            
            for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++) {
                const row = this.tableFlow.table.rows[rowIndex];
                for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex++) {
                    const cell = row.cells[columnIndex];
                    await this.selectCell(cell);
                }
            }
            
            this.metrics.increment('selection_update');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_update');
        }
    }
    
    clearSelection() {
        try {
            // Supprimer les styles
            this.state.selectedCells.forEach(cell => {
                cell.classList.remove(this.config.selectedClass);
            });
            
            this.state.selectedRows.forEach(row => {
                row.classList.remove(`${this.config.selectedClass}-row`);
            });
            
            this.state.selectedColumns.forEach(columnIndex => {
                this.updateColumnStyle(columnIndex, true);
            });
            
            // Réinitialiser l'état
            this.state.selectedCells.clear();
            this.state.selectedRows.clear();
            this.state.selectedColumns.clear();
            
            this.metrics.increment('selection_clear');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_clear');
        }
    }
    
    updateColumnStyle(columnIndex, remove = false) {
        try {
            const cells = this.tableFlow.table.querySelectorAll(`td:nth-child(${columnIndex + 1})`);
            cells.forEach(cell => {
                if (remove) {
                    cell.classList.remove(`${this.config.selectedClass}-column`);
                } else {
                    cell.classList.add(`${this.config.selectedClass}-column`);
                }
            });
        } catch (error) {
            this.errorHandler.handle(error, 'selection_update_column_style');
        }
    }
    
    async selectAll() {
        try {
            // Déclencher le hook beforeSelectAll
            const beforeResult = await this.tableFlow.hooks.trigger('beforeSelectAll');
            
            if (beforeResult === false) return;
            
            // Sélectionner toutes les cellules
            const cells = this.tableFlow.table.querySelectorAll('td, th');
            for (const cell of cells) {
                await this.selectCell(cell);
            }
            
            // Déclencher le hook afterSelectAll
            await this.tableFlow.hooks.trigger('afterSelectAll', {
                selectedCells: Array.from(this.state.selectedCells),
                selectedRows: Array.from(this.state.selectedRows),
                selectedColumns: Array.from(this.state.selectedColumns)
            });
            
            this.metrics.increment('selection_select_all');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_select_all');
        }
    }
    
    async copySelection() {
        try {
            // Déclencher le hook beforeCopy
            const beforeResult = await this.tableFlow.hooks.trigger('beforeCopy');
            
            if (beforeResult === false) return;
            
            // Copier les données sélectionnées
            const data = Array.from(this.state.selectedCells)
                .map(cell => cell.textContent)
                .join('\t');
            
            await navigator.clipboard.writeText(data);
            
            // Déclencher le hook afterCopy
            await this.tableFlow.hooks.trigger('afterCopy', {
                data
            });
            
            this.metrics.increment('selection_copy');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_copy');
        }
    }
    
    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            this.tableFlow.table.removeEventListener('mousedown', this._boundMouseDownHandler);
            document.removeEventListener('mousemove', this._boundMouseMoveHandler);
            document.removeEventListener('mouseup', this._boundMouseUpHandler);
            document.removeEventListener('keydown', this._boundKeyDownHandler);
            
            // Nettoyer la sélection
            this.clearSelection();
            
            // Supprimer les styles
            const style = document.querySelector(`style[data-plugin="${this.name}"]`);
            if (style) {
                style.remove();
            }
            
            // Réinitialiser l'état
            this.state = {
                selectedCells: new Set(),
                selectedRows: new Set(),
                selectedColumns: new Set(),
                isSelecting: false,
                startCell: null,
                endCell: null
            };
            
            this.isInitialized = false;
            this.logger.info('Plugin Selection détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'selection_destroy');
        } finally {
            super.destroy();
        }
    }
}