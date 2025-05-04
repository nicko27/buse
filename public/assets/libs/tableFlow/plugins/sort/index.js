import { config } from './config.js';

export class SortPlugin {
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.config = { ...config, ...options };
        this.logger = tableFlow.logger;
        this.metrics = tableFlow.metrics;
        this.errorHandler = tableFlow.errorHandler;
        this.sortState = {
            column: this.config.defaultSort.column,
            direction: this.config.defaultSort.direction,
            multiSort: []
        };
    }

    init() {
        this.logger.info('Initializing Sort plugin');
        this.setupEventListeners();
        this.registerHooks();
        this.setupContextMenu();
        this.metrics.increment('plugin_sort_init');
    }

    setupEventListeners() {
        this.tableFlow.on('headerClick', this.handleHeaderClick.bind(this));
        this.tableFlow.on('headerKeydown', this.handleHeaderKeydown.bind(this));
    }

    registerHooks() {
        this.tableFlow.hooks.register('beforeSort', this.beforeSort.bind(this));
        this.tableFlow.hooks.register('afterSort', this.afterSort.bind(this));
        this.tableFlow.hooks.register('beforeMultiSort', this.beforeMultiSort.bind(this));
        this.tableFlow.hooks.register('afterMultiSort', this.afterMultiSort.bind(this));
    }

    setupContextMenu() {
        this.tableFlow.plugins.contextMenu.registerProvider({
            getMenuItems: (cell) => {
                if (cell.tagName === 'TH') {
                    return [
                        {
                            id: 'sort-asc',
                            label: 'Trier par ordre croissant',
                            icon: '↑',
                            action: () => this.sortColumn(cell.dataset.column, 'asc')
                        },
                        {
                            id: 'sort-desc',
                            label: 'Trier par ordre décroissant',
                            icon: '↓',
                            action: () => this.sortColumn(cell.dataset.column, 'desc')
                        }
                    ];
                }
                return [];
            }
        });
    }

    handleHeaderClick(event) {
        const header = event.target.closest('th');
        if (!header || !header.classList.contains(this.config.sortableClass)) return;

        const column = header.dataset.column;
        const direction = this.getNextDirection(column);
        this.sortColumn(column, direction, event.shiftKey);
    }

    handleHeaderKeydown(event) {
        if (!this.config.keyboard.enabled) return;

        const header = event.target.closest('th');
        if (!header || !header.classList.contains(this.config.sortableClass)) return;

        if (event.key === 'Enter' && this.config.keyboard.sortOnEnter) {
            const column = header.dataset.column;
            const direction = this.getNextDirection(column);
            this.sortColumn(column, direction, event.shiftKey);
        }
    }

    getNextDirection(column) {
        if (this.sortState.column === column) {
            return this.sortState.direction === 'asc' ? 'desc' : 'asc';
        }
        return 'asc';
    }

    async sortColumn(column, direction, isMultiSort = false) {
        try {
            if (isMultiSort) {
                const beforeMultiSortResult = await this.tableFlow.hooks.trigger('beforeMultiSort', {
                    column,
                    direction,
                    currentState: this.sortState
                });

                if (beforeMultiSortResult === false) return;

                this.updateMultiSort(column, direction);
                await this.applyMultiSort();

                await this.tableFlow.hooks.trigger('afterMultiSort', {
                    column,
                    direction,
                    newState: this.sortState
                });
            } else {
                const beforeSortResult = await this.tableFlow.hooks.trigger('beforeSort', {
                    column,
                    direction,
                    currentState: this.sortState
                });

                if (beforeSortResult === false) return;

                this.updateSortState(column, direction);
                await this.applySort();

                await this.tableFlow.hooks.trigger('afterSort', {
                    column,
                    direction,
                    newState: this.sortState
                });
            }

            this.tableFlow.emit('sort:change', { column, direction, isMultiSort });
            this.metrics.increment('sort_change');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_column');
            this.tableFlow.emit('sort:error', { column, direction, error });
        }
    }

    updateSortState(column, direction) {
        this.sortState.column = column;
        this.sortState.direction = direction;
        this.sortState.multiSort = [];
    }

    updateMultiSort(column, direction) {
        const existingIndex = this.sortState.multiSort.findIndex(sort => sort.column === column);
        
        if (existingIndex >= 0) {
            this.sortState.multiSort[existingIndex].direction = direction;
        } else {
            this.sortState.multiSort.push({ column, direction });
        }
    }

    async applySort() {
        const { column, direction } = this.sortState;
        const rows = Array.from(this.tableFlow.table.querySelectorAll('tbody tr'));
        
        rows.sort((a, b) => {
            const aValue = a.querySelector(`td[data-column="${column}"]`).textContent;
            const bValue = b.querySelector(`td[data-column="${column}"]`).textContent;
            return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        });

        const tbody = this.tableFlow.table.querySelector('tbody');
        rows.forEach(row => tbody.appendChild(row));

        this.updateHeaderStyles();
    }

    async applyMultiSort() {
        const rows = Array.from(this.tableFlow.table.querySelectorAll('tbody tr'));
        
        rows.sort((a, b) => {
            for (const sort of this.sortState.multiSort) {
                const aValue = a.querySelector(`td[data-column="${sort.column}"]`).textContent;
                const bValue = b.querySelector(`td[data-column="${sort.column}"]`).textContent;
                const comparison = sort.direction === 'asc' ? 
                    aValue.localeCompare(bValue) : 
                    bValue.localeCompare(aValue);
                
                if (comparison !== 0) return comparison;
            }
            return 0;
        });

        const tbody = this.tableFlow.table.querySelector('tbody');
        rows.forEach(row => tbody.appendChild(row));

        this.updateHeaderStyles();
    }

    updateHeaderStyles() {
        const headers = this.tableFlow.table.querySelectorAll('th');
        headers.forEach(header => {
            header.classList.remove(
                this.config.sortAscClass,
                this.config.sortDescClass,
                'multi-sort'
            );

            if (this.sortState.multiSort.length > 0) {
                const multiSort = this.sortState.multiSort.find(sort => sort.column === header.dataset.column);
                if (multiSort) {
                    header.classList.add(multiSort.direction === 'asc' ? 
                        this.config.sortAscClass : 
                        this.config.sortDescClass);
                    header.classList.add('multi-sort');
                }
            } else if (header.dataset.column === this.sortState.column) {
                header.classList.add(this.sortState.direction === 'asc' ? 
                    this.config.sortAscClass : 
                    this.config.sortDescClass);
            }
        });
    }

    getSortState() {
        return { ...this.sortState };
    }

    resetSort() {
        this.sortState = {
            column: this.config.defaultSort.column,
            direction: this.config.defaultSort.direction,
            multiSort: []
        };
        this.updateHeaderStyles();
        this.tableFlow.emit('sort:reset');
        this.metrics.increment('sort_reset');
    }

    beforeSort({ column, direction, currentState }) {
        return true;
    }

    afterSort({ column, direction, newState }) {
    }

    beforeMultiSort({ column, direction, currentState }) {
        return true;
    }

    afterMultiSort({ column, direction, newState }) {
    }

    destroy() {
        this.tableFlow.off('headerClick', this.handleHeaderClick);
        this.tableFlow.off('headerKeydown', this.handleHeaderKeydown);
        this.resetSort();
        this.metrics.increment('plugin_sort_destroy');
    }
}
