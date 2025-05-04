/**
 * Plugin de sélection pour TableFlow
 * Permet la sélection de cellules, lignes et colonnes avec différentes options
 * et méthodes pour manipuler les sélections
 */
import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';
import { config } from './config.js';

export class SelectionPlugin {
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.config = { ...config, ...options };
        this.logger = tableFlow.logger;
        this.metrics = tableFlow.metrics;
        this.errorHandler = tableFlow.errorHandler;
        
        this.state = {
            selectedRows: new Set(),
            selectedCells: new Set(),
            lastSelected: null,
            isRangeSelecting: false,
            rangeStart: null,
            rangeEnd: null,
            isKeyboardFocused: false
        };
    }

    init() {
        this.logger.info('Initializing Selection plugin');
        this.setupEventListeners();
        this.registerHooks();
        this.setupContextMenu();
        this.metrics.increment('plugin_selection_init');
    }

    setupEventListeners() {
        // Événements de souris
        this.tableFlow.table.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.tableFlow.table.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        
        // Événements de clavier
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Événements de presse-papiers
        if (this.config.enableClipboard) {
            document.addEventListener('copy', this.handleCopy.bind(this));
            document.addEventListener('cut', this.handleCut.bind(this));
            document.addEventListener('paste', this.handlePaste.bind(this));
        }
    }

    registerHooks() {
        this.tableFlow.hooks.register('beforeSelect', this.beforeSelect.bind(this));
        this.tableFlow.hooks.register('afterSelect', this.afterSelect.bind(this));
        this.tableFlow.hooks.register('beforeCopy', this.beforeCopy.bind(this));
        this.tableFlow.hooks.register('beforePaste', this.beforePaste.bind(this));
    }

    setupContextMenu() {
        this.tableFlow.plugins.contextMenu.registerProvider({
            getMenuItems: (cell) => {
                const items = [];
                
                if (this.hasSelection()) {
                    items.push(
                        {
                            id: 'copy',
                            label: 'Copier',
                            icon: '📋',
                            action: () => this.copy()
                        },
                        {
                            id: 'cut',
                            label: 'Couper',
                            icon: '✂️',
                            action: () => this.cut()
                        }
                    );
                }
                
                if (navigator.clipboard && this.config.enableClipboard) {
                    items.push({
                        id: 'paste',
                        label: 'Coller',
                        icon: '📌',
                        action: () => this.paste()
                    });
                }
                
                if (this.hasSelection()) {
                    items.push(
                        {
                            id: 'delete',
                            label: 'Supprimer',
                            icon: '🗑️',
                            action: () => this.delete()
                        },
                        {
                            id: 'clear_selection',
                            label: 'Effacer la sélection',
                            icon: '❌',
                            action: () => this.clearSelection()
                        }
                    );
                }
                
                return items;
            }
        });
    }

    handleMouseDown(event) {
        const cell = event.target.closest('td, th');
        if (!cell) return;
        
        const isMultiSelect = event.ctrlKey || event.metaKey;
        const isRangeSelect = event.shiftKey;
        
        if (!this.canSelect(cell)) return;
        
        if (isRangeSelect && this.config.enableRangeSelect) {
            this.startRangeSelection(cell);
        } else {
            if (!isMultiSelect || !this.config.enableMultiSelect) {
            this.clearSelection();
            }
            this.selectElement(cell);
        }

        this.state.lastSelected = cell;
        this.updateSelection();
    }

    handleMouseMove(event) {
        if (!this.state.isRangeSelecting) return;

        const cell = event.target.closest('td, th');
        if (!cell) return;

        this.state.rangeEnd = cell;
        this.updateRangeSelection();
    }

    handleMouseUp() {
        if (this.state.isRangeSelecting) {
            this.state.isRangeSelecting = false;
            this.updateSelection();
        }
    }
    
    handleKeyDown(event) {
        if (!this.config.keyboard.enabled) return;

        const key = event.key.toLowerCase();
        const isCtrl = event.ctrlKey || event.metaKey;
        const isShift = event.shiftKey;

        // Sélection totale
        if (isCtrl && key === 'a') {
            event.preventDefault();
            this.selectAll();
        }

        // Copier/Coller
        if (isCtrl && this.config.enableClipboard) {
            if (key === 'c') {
            event.preventDefault();
                this.copy();
            } else if (key === 'x') {
            event.preventDefault();
                this.cut();
            } else if (key === 'v') {
            event.preventDefault();
                this.paste();
            }
        }

        // Navigation
        if (this.hasSelection() && !isCtrl) {
            let direction = null;
            
            switch (key) {
                case 'arrowup':
                    direction = 'up';
                    break;
                case 'arrowdown':
                    direction = 'down';
                    break;
                case 'arrowleft':
                    direction = 'left';
                    break;
                case 'arrowright':
                    direction = 'right';
                    break;
            }

            if (direction) {
        event.preventDefault();
                if (isShift) {
                    this.extendSelection(direction);
                } else {
                    this.moveSelection(direction);
                }
            }
        }

        // Suppression
        if (key === 'delete' || key === 'backspace') {
            if (this.hasSelection()) {
                event.preventDefault();
                this.delete();
            }
        }
    }

    async handleCopy(event) {
        if (!this.config.enableClipboard || !this.hasSelection()) return;

        event.preventDefault();
        await this.copy();
    }

    async handleCut(event) {
        if (!this.config.enableClipboard || !this.hasSelection()) return;

        event.preventDefault();
        await this.cut();
    }

    async handlePaste(event) {
        if (!this.config.enableClipboard) return;

        event.preventDefault();
        const text = event.clipboardData.getData('text');
        await this.paste(text);
    }

    selectElement(element) {
        const isRow = element.tagName === 'TR';
        const isCell = element.tagName === 'TD' || element.tagName === 'TH';

        if (isRow && this.config.enableRowSelection) {
            this.selectRow(element);
        } else if (isCell && this.config.enableCellSelection) {
            this.selectCell(element);
        }
    }

    selectRow(row) {
        const index = row.rowIndex;
        
        if (this.state.selectedRows.has(index)) {
            this.state.selectedRows.delete(index);
            row.classList.remove(this.config.selectedRowClass);
        } else {
            if (this.state.selectedRows.size >= this.config.maxSelections) {
                this.errorHandler.handle(new Error(this.config.messages.maxSelectionsReached));
            return;
        }
            this.state.selectedRows.add(index);
            row.classList.add(this.config.selectedRowClass);
        }
    }

    selectCell(cell) {
        const key = `${cell.parentElement.rowIndex},${cell.cellIndex}`;
        
        if (this.state.selectedCells.has(key)) {
            this.state.selectedCells.delete(key);
            cell.classList.remove(this.config.selectedCellClass);
        } else {
            if (this.state.selectedCells.size >= this.config.maxSelections) {
                this.errorHandler.handle(new Error(this.config.messages.maxSelectionsReached));
                return;
            }
            this.state.selectedCells.add(key);
            cell.classList.add(this.config.selectedCellClass);
        }
    }

    startRangeSelection(cell) {
        this.state.isRangeSelecting = true;
        this.state.rangeStart = this.state.lastSelected || cell;
        this.state.rangeEnd = cell;
        this.updateRangeSelection();
    }

    updateRangeSelection() {
        if (!this.state.rangeStart || !this.state.rangeEnd) return;

        const start = {
            row: this.state.rangeStart.parentElement.rowIndex,
            col: this.state.rangeStart.cellIndex
        };

        const end = {
            row: this.state.rangeEnd.parentElement.rowIndex,
            col: this.state.rangeEnd.cellIndex
        };

        const minRow = Math.min(start.row, end.row);
        const maxRow = Math.max(start.row, end.row);
        const minCol = Math.min(start.col, end.col);
        const maxCol = Math.max(start.col, end.col);

        this.clearSelection();
        
        for (let row = minRow; row <= maxRow; row++) {
            for (let col = minCol; col <= maxCol; col++) {
                const cell = this.tableFlow.table.rows[row].cells[col];
                this.selectCell(cell);
            }
        }
    }

    moveSelection(direction) {
        if (!this.hasSelection()) return;

        const selected = this.getLastSelected();
        if (!selected) return;

        let nextElement;
        const row = selected.parentElement;
        const table = this.tableFlow.table;

        switch (direction) {
            case 'up':
                if (row.rowIndex > 0) {
                    nextElement = table.rows[row.rowIndex - 1].cells[selected.cellIndex];
                }
                break;
            case 'down':
                if (row.rowIndex < table.rows.length - 1) {
                    nextElement = table.rows[row.rowIndex + 1].cells[selected.cellIndex];
                }
                break;
            case 'left':
                if (selected.cellIndex > 0) {
                    nextElement = row.cells[selected.cellIndex - 1];
                }
                break;
            case 'right':
                if (selected.cellIndex < row.cells.length - 1) {
                    nextElement = row.cells[selected.cellIndex + 1];
                }
                break;
        }

        if (nextElement) {
            this.clearSelection();
            this.selectElement(nextElement);
            this.state.lastSelected = nextElement;
            this.scrollIntoView(nextElement);
        }
    }

    extendSelection(direction) {
        if (!this.hasSelection() || !this.state.lastSelected) return;

        const current = this.state.lastSelected;
        let nextElement;
        const row = current.parentElement;
        const table = this.tableFlow.table;

        switch (direction) {
            case 'up':
                if (row.rowIndex > 0) {
                    nextElement = table.rows[row.rowIndex - 1].cells[current.cellIndex];
                }
                break;
            case 'down':
                if (row.rowIndex < table.rows.length - 1) {
                    nextElement = table.rows[row.rowIndex + 1].cells[current.cellIndex];
                }
                break;
            case 'left':
                if (current.cellIndex > 0) {
                    nextElement = row.cells[current.cellIndex - 1];
                }
                break;
            case 'right':
                if (current.cellIndex < row.cells.length - 1) {
                    nextElement = row.cells[current.cellIndex + 1];
                }
                break;
        }
        
        if (nextElement) {
            this.state.rangeStart = current;
            this.state.rangeEnd = nextElement;
            this.updateRangeSelection();
            this.scrollIntoView(nextElement);
        }
    }

    scrollIntoView(element) {
        const rect = element.getBoundingClientRect();
        const containerRect = this.tableFlow.container.getBoundingClientRect();

        if (rect.top < containerRect.top) {
            element.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } else if (rect.bottom > containerRect.bottom) {
            element.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
    }

    async copy() {
        try {
            if (!this.hasSelection()) {
                throw new Error(this.config.messages.noSelection);
            }

            const data = this.getSelectedData();
            const formatted = this.formatDataForClipboard(data);

            if (this.config.enableClipboard) {
                await navigator.clipboard.writeText(formatted);
            }

            this.tableFlow.emit('selection:copy', { data });
            this.metrics.increment('selection_copy');
            
            return formatted;
        } catch (error) {
            this.errorHandler.handle(error, 'copy');
            throw error;
        }
    }

    async cut() {
        try {
            const data = await this.copy();
            await this.delete();
            return data;
        } catch (error) {
            this.errorHandler.handle(error, 'cut');
            throw error;
        }
    }

    async paste(data) {
        try {
            if (!data) {
                data = await navigator.clipboard.readText();
            }

            const parsedData = this.parseClipboardData(data);
            const beforePasteResult = await this.tableFlow.hooks.trigger('beforePaste', { data: parsedData });

            if (beforePasteResult === false) return;

            // Implémenter la logique de collage ici
            this.tableFlow.emit('selection:paste', { data: parsedData });
            this.metrics.increment('selection_paste');
        } catch (error) {
            this.errorHandler.handle(error, 'paste');
            throw error;
        }
    }

    async delete() {
        try {
            if (!this.hasSelection()) {
                throw new Error(this.config.messages.noSelection);
            }

            const selected = this.getSelectedElements();
            
            // Implémenter la logique de suppression ici
            
            this.tableFlow.emit('selection:delete', { elements: selected });
            this.metrics.increment('selection_delete');
        } catch (error) {
            this.errorHandler.handle(error, 'delete');
            throw error;
        }
    }

    selectAll() {
        this.clearSelection();
        
        const rows = this.tableFlow.table.rows;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            for (let j = 0; j < row.cells.length; j++) {
                this.selectCell(row.cells[j]);
            }
        }

        this.updateSelection();
        this.metrics.increment('selection_all');
    }

    clearSelection() {
        this.state.selectedRows.clear();
        this.state.selectedCells.clear();
        
        const rows = this.tableFlow.table.rows;
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            row.classList.remove(this.config.selectedRowClass);
            for (let j = 0; j < row.cells.length; j++) {
                row.cells[j].classList.remove(this.config.selectedCellClass);
            }
        }

        this.state.lastSelected = null;
        this.state.rangeStart = null;
        this.state.rangeEnd = null;
        this.updateSelection();
    }

    hasSelection() {
        return this.state.selectedRows.size > 0 || this.state.selectedCells.size > 0;
    }

    getSelectedElements() {
        const elements = [];
        
        this.state.selectedRows.forEach(rowIndex => {
            elements.push(this.tableFlow.table.rows[rowIndex]);
        });

        this.state.selectedCells.forEach(key => {
            const [rowIndex, colIndex] = key.split(',').map(Number);
            elements.push(this.tableFlow.table.rows[rowIndex].cells[colIndex]);
        });

        return elements;
    }

    getSelectedData() {
        const data = [];
        const rows = this.tableFlow.table.rows;
        
        if (this.state.selectedRows.size > 0) {
            this.state.selectedRows.forEach(rowIndex => {
                const row = rows[rowIndex];
                const rowData = Array.from(row.cells).map(cell => cell.textContent.trim());
                data.push(rowData);
            });
        } else {
            const selectedCells = Array.from(this.state.selectedCells).map(key => {
                const [rowIndex, colIndex] = key.split(',').map(Number);
                return { rowIndex, colIndex };
            });

            const minRow = Math.min(...selectedCells.map(cell => cell.rowIndex));
            const maxRow = Math.max(...selectedCells.map(cell => cell.rowIndex));
            const minCol = Math.min(...selectedCells.map(cell => cell.colIndex));
            const maxCol = Math.max(...selectedCells.map(cell => cell.colIndex));

            for (let i = minRow; i <= maxRow; i++) {
                const rowData = [];
                for (let j = minCol; j <= maxCol; j++) {
                    const key = `${i},${j}`;
                    if (this.state.selectedCells.has(key)) {
                        rowData.push(rows[i].cells[j].textContent.trim());
                    } else {
                        rowData.push('');
                    }
                }
                data.push(rowData);
            }
        }

        return data;
    }

    formatDataForClipboard(data) {
        const separator = this.config.clipboard.separator;
        return data.map(row => row.join(separator)).join('\n');
    }

    parseClipboardData(data) {
        const separator = this.config.clipboard.separator;
        return data.split('\n').map(row => row.split(separator));
    }

    getLastSelected() {
        return this.state.lastSelected;
    }

    canSelect(element) {
        return true; // Implémenter la logique de validation ici
    }

    updateSelection() {
        this.tableFlow.emit('selection:change', {
            rows: Array.from(this.state.selectedRows),
            cells: Array.from(this.state.selectedCells),
            elements: this.getSelectedElements(),
            data: this.getSelectedData()
        });
    }

    beforeSelect({ element, type }) {
        return true;
    }
    
    afterSelect({ element, type }) {
    }

    beforeCopy(data) {
        return data;
    }

    beforePaste(data) {
        return data;
    }

    destroy() {
        this.clearSelection();
        
        // Supprimer les écouteurs d'événements
        this.tableFlow.table.removeEventListener('mousedown', this.handleMouseDown);
        this.tableFlow.table.removeEventListener('mousemove', this.handleMouseMove);
        document.removeEventListener('mouseup', this.handleMouseUp);
            document.removeEventListener('keydown', this.handleKeyDown);
        
        if (this.config.enableClipboard) {
            document.removeEventListener('copy', this.handleCopy);
            document.removeEventListener('cut', this.handleCut);
            document.removeEventListener('paste', this.handlePaste);
        }

        this.metrics.increment('plugin_selection_destroy');
    }
}