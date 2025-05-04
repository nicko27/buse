import { BasePlugin } from '../basePlugin.js';
import { config } from './config.js';

export class SortPlugin extends BasePlugin {
    constructor(config = {}) {
        const pluginConfig = {
            enabled: true,
            debug: false,
            execOrder: 20,
            dependencies: ['contextmenu'],
            
            // Configuration spécifique au tri
            defaultSort: {
                column: null,
                direction: 'asc'
            },
            sortableClass: 'sortable',
            sortAscClass: 'sort-asc',
            sortDescClass: 'sort-desc',
            keyboard: {
                enabled: true,
                sortOnEnter: true
            },
            ...config
        };

        super(pluginConfig);

        this.sortState = {
            column: this.config.get('defaultSort.column'),
            direction: this.config.get('defaultSort.direction'),
            multiSort: []
        };
    }

    async onInit(context) {
        this.logger.info('Initialisation du plugin Sort');
        
        this.setupEventListeners(context);
        this.registerHooks(context);
        this.setupContextMenu(context);
        
        this.metrics.increment('plugin_sort_init');
    }

    setupEventListeners(context) {
        context.eventBus.on('headerClick', this.handleHeaderClick.bind(this));
        context.eventBus.on('headerKeydown', this.handleHeaderKeydown.bind(this));
    }

    registerHooks(context) {
        context.hooks.register('beforeSort', this.beforeSort.bind(this));
        context.hooks.register('afterSort', this.afterSort.bind(this));
        context.hooks.register('beforeMultiSort', this.beforeMultiSort.bind(this));
        context.hooks.register('afterMultiSort', this.afterMultiSort.bind(this));
    }

    setupContextMenu(context) {
        context.plugins.contextMenu.registerProvider({
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
        if (!this.config.get('enabled')) return;
        
        const header = event.target.closest('th');
        if (!header || !header.classList.contains(this.config.get('sortableClass'))) return;

        const column = header.dataset.column;
        const direction = this.getNextDirection(column);
        this.sortColumn(column, direction, event.shiftKey);
    }

    handleHeaderKeydown(event) {
        if (!this.config.get('enabled') || !this.config.get('keyboard.enabled')) return;

        const header = event.target.closest('th');
        if (!header || !header.classList.contains(this.config.get('sortableClass'))) return;

        if (event.key === 'Enter' && this.config.get('keyboard.sortOnEnter')) {
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
                const beforeMultiSortResult = await context.hooks.trigger('beforeMultiSort', {
                    column,
                    direction,
                    currentState: this.sortState
                });

                if (beforeMultiSortResult === false) return;

                this.updateMultiSort(column, direction);
                await this.applyMultiSort();

                await context.hooks.trigger('afterMultiSort', {
                    column,
                    direction,
                    newState: this.sortState
                });
            } else {
                const beforeSortResult = await context.hooks.trigger('beforeSort', {
                    column,
                    direction,
                    currentState: this.sortState
                });

                if (beforeSortResult === false) return;

                this.updateSortState(column, direction);
                await this.applySort();

                await context.hooks.trigger('afterSort', {
                    column,
                    direction,
                    newState: this.sortState
                });
            }

            context.eventBus.emit('sort:change', { column, direction, isMultiSort });
            this.metrics.increment('sort_change');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_column');
            context.eventBus.emit('sort:error', { column, direction, error });
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
        const rows = Array.from(context.table.querySelectorAll('tbody tr'));
        
        rows.sort((a, b) => {
            const aValue = a.querySelector(`td[data-column="${column}"]`).textContent;
            const bValue = b.querySelector(`td[data-column="${column}"]`).textContent;
            return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        });

        const tbody = context.table.querySelector('tbody');
        rows.forEach(row => tbody.appendChild(row));

        this.updateHeaderStyles();
    }

    async applyMultiSort() {
        const rows = Array.from(context.table.querySelectorAll('tbody tr'));
        
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

        const tbody = context.table.querySelector('tbody');
        rows.forEach(row => tbody.appendChild(row));

        this.updateHeaderStyles();
    }

    updateHeaderStyles() {
        const headers = context.table.querySelectorAll('th');
        headers.forEach(header => {
            header.classList.remove(
                this.config.get('sortAscClass'),
                this.config.get('sortDescClass'),
                'multi-sort'
            );

            if (this.sortState.multiSort.length > 0) {
                const multiSort = this.sortState.multiSort.find(sort => sort.column === header.dataset.column);
                if (multiSort) {
                    header.classList.add(multiSort.direction === 'asc' ? 
                        this.config.get('sortAscClass') : 
                        this.config.get('sortDescClass'));
                    header.classList.add('multi-sort');
                }
            } else if (header.dataset.column === this.sortState.column) {
                header.classList.add(this.sortState.direction === 'asc' ? 
                    this.config.get('sortAscClass') : 
                    this.config.get('sortDescClass'));
            }
        });
    }

    getSortState() {
        return { ...this.sortState };
    }

    resetSort() {
        this.sortState = {
            column: this.config.get('defaultSort.column'),
            direction: this.config.get('defaultSort.direction'),
            multiSort: []
        };
        this.updateHeaderStyles();
        context.eventBus.emit('sort:reset');
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

    async onRefresh() {
        this.logger.info('Rafraîchissement du plugin Sort...');
        this.updateHeaderStyles();
    }

    async onDestroy() {
        this.logger.info('Destruction du plugin Sort...');
        
        context.eventBus.off('headerClick', this.handleHeaderClick);
        context.eventBus.off('headerKeydown', this.handleHeaderKeydown);
        
        this.resetSort();
        this.metrics.increment('plugin_sort_destroy');
    }
}
