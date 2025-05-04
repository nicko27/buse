import { EventBus } from '../utils/eventBus.js';

export class TableState {
    constructor() {
        this.eventBus = new EventBus();
        this.state = {
            initialValues: new Map(),
            modifiedRows: new Set(),
            selectedCells: new Set(),
            filters: new Map(),
            sorting: {
                column: null,
                direction: null
            }
        };
    }

    // Gestion des valeurs initiales
    setInitialValue(rowId, columnId, value) {
        if (!this.state.initialValues.has(rowId)) {
            this.state.initialValues.set(rowId, new Map());
        }
        this.state.initialValues.get(rowId).set(columnId, value);
        this.eventBus.emit('state:initialValue:changed', { rowId, columnId, value });
    }

    getInitialValue(rowId, columnId) {
        return this.state.initialValues.get(rowId)?.get(columnId);
    }

    // Gestion des modifications
    markRowAsModified(rowId, isModified = true) {
        if (isModified) {
            this.state.modifiedRows.add(rowId);
        } else {
            this.state.modifiedRows.delete(rowId);
        }
        this.eventBus.emit('state:row:modified', { rowId, isModified });
    }

    isRowModified(rowId) {
        return this.state.modifiedRows.has(rowId);
    }

    // Gestion de la sélection
    setSelectedCells(cells) {
        this.state.selectedCells = new Set(cells);
        this.eventBus.emit('state:selection:changed', { cells: Array.from(cells) });
    }

    getSelectedCells() {
        return Array.from(this.state.selectedCells);
    }

    // Gestion des filtres
    setFilter(columnId, filterConfig) {
        this.state.filters.set(columnId, filterConfig);
        this.eventBus.emit('state:filter:changed', { columnId, filterConfig });
    }

    getFilter(columnId) {
        return this.state.filters.get(columnId);
    }

    // Gestion du tri
    setSorting(column, direction) {
        this.state.sorting = { column, direction };
        this.eventBus.emit('state:sorting:changed', { column, direction });
    }

    getSorting() {
        return { ...this.state.sorting };
    }

    // Abonnement aux événements
    subscribe(event, callback) {
        this.eventBus.on(event, callback);
    }

    unsubscribe(event, callback) {
        this.eventBus.off(event, callback);
    }

    // Réinitialisation de l'état
    reset() {
        this.state.initialValues.clear();
        this.state.modifiedRows.clear();
        this.state.selectedCells.clear();
        this.state.filters.clear();
        this.state.sorting = { column: null, direction: null };
        this.eventBus.emit('state:reset');
    }
} 