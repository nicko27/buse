import { config } from './config.js';

export class FilterPlugin {
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.config = { ...config, ...options };
        this.logger = tableFlow.logger;
        this.metrics = tableFlow.metrics;
        this.errorHandler = tableFlow.errorHandler;
        this.name = 'filter';
        
        // État local
        this.filterState = {
            column: this.config.defaultFilter.column,
            value: this.config.defaultFilter.value,
            operator: this.config.defaultFilter.operator
        };
        this.filters = new Map();
        
        // Cache pour les performances
        this.cache = {
            lastFilteredData: [],
            lastFilterTime: 0,
            filterTimeout: null,
            renderFrame: null,
            inputTimeout: null
        };

        // Cache DOM
        this.domCache = {
            table: null,
            tbody: null,
            rows: [],
            headers: []
        };
    }

    async init() {
        this.logger.info('Initializing Filter plugin');
        
        try {
            await this.initDOMCache();
            this.setupEventListeners();
            this.registerHooks();
            this.setupContextMenu();
            
            // S'enregistrer comme plugin coopératif
            this.tableFlow.registerCooperativePlugin(this);
            
            this.metrics.increment('plugin_filter_init');
        } catch (error) {
            this.handleError(error, 'init');
        }
    }

    async initDOMCache() {
        this.domCache = {
            table: this.tableFlow.table,
            tbody: this.tableFlow.table.querySelector('tbody'),
            rows: Array.from(this.tableFlow.table.querySelectorAll('tbody tr')),
            headers: Array.from(this.tableFlow.table.querySelectorAll('thead th'))
        };
    }

    clearCache() {
        if (this.cache.filterTimeout) {
            clearTimeout(this.cache.filterTimeout);
        }
        if (this.cache.inputTimeout) {
            clearTimeout(this.cache.inputTimeout);
        }
        if (this.cache.renderFrame) {
            cancelAnimationFrame(this.cache.renderFrame);
        }

        this.cache = {
            lastFilteredData: [],
            lastFilterTime: 0,
            filterTimeout: null,
            renderFrame: null,
            inputTimeout: null
        };
    }

    handleError(error, context) {
        this.errorHandler.handle(error, 'filter_error', { context });
        this.clearCache();
        this.resetState();
    }

    resetState() {
        this.filterState = {
            column: this.config.defaultFilter.column,
            value: this.config.defaultFilter.value,
            operator: this.config.defaultFilter.operator
        };
        this.filters.clear();
    }

    setupEventListeners() {
        this.tableFlow.on('headerClick', this.handleHeaderClick.bind(this));
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    registerHooks() {
        this.tableFlow.hooks.register('beforeFilter', this.beforeFilter.bind(this));
        this.tableFlow.hooks.register('afterFilter', this.afterFilter.bind(this));
        this.tableFlow.hooks.register('beforeClear', this.beforeClear.bind(this));
        this.tableFlow.hooks.register('afterClear', this.afterClear.bind(this));
        
        // Nouveaux hooks pour la synchronisation
        this.tableFlow.hooks.register('afterPageChange', this.handlePageChange.bind(this));
        this.tableFlow.hooks.register('afterSizeChange', this.handleSizeChange.bind(this));
    }

    setupContextMenu() {
        this.tableFlow.plugins.contextMenu.registerProvider({
            getMenuItems: (cell) => {
                if (cell.tagName === 'TH') {
                    return [
                        {
                            id: 'filter',
                            label: 'Filtrer',
                            icon: '🔍',
                            action: () => this.showFilter(cell.dataset.column)
                        }
                    ];
                }
                return [];
            }
        });
    }

    handleHeaderClick(event) {
        const header = event.target.closest('th');
        if (!header) return;

        this.showFilter(header.dataset.column);
    }

    handleDocumentClick(event) {
        const filter = event.target.closest(`.${this.config.filterClass}`);
        if (!filter) {
            this.hideDropdown();
        }
    }

    handleKeydown(event) {
        if (!this.config.keyboard.enabled) return;

        if (event.key === 'Escape' && this.config.keyboard.closeOnEscape) {
            this.hideDropdown();
        }
    }

    showFilter(column) {
        const header = this.tableFlow.table.querySelector(`th[data-column="${column}"]`);
        if (!header) return;

        let filter = header.querySelector(`.${this.config.filterClass}`);
        if (!filter) {
            filter = this.createFilter(column);
            header.appendChild(filter);
        }

        const input = filter.querySelector(`.${this.config.filterInputClass}`);
        const dropdown = filter.querySelector(`.${this.config.filterDropdownClass}`);

        if (input && dropdown) {
            input.focus();
            dropdown.classList.add('active');
            this.metrics.increment('filter_show');
        }
    }

    createFilter(column) {
        const filter = document.createElement('div');
        filter.className = this.config.filterClass;
        this.applyFilterStyles(filter);

        const input = document.createElement('input');
        input.className = this.config.filterInputClass;
        input.type = 'text';
        input.placeholder = 'Filtrer...';
        input.value = this.filters.get(column)?.value || '';
        input.addEventListener('input', () => this.handleInputChange(column, input));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && this.config.keyboard.filterOnEnter) {
                this.applyFilter(column, input.value);
            }
        });

        const button = document.createElement('button');
        button.className = this.config.filterButtonClass;
        button.innerHTML = '🔍';
        button.addEventListener('click', () => this.applyFilter(column, input.value));

        const dropdown = this.createDropdown(column);
        
        filter.appendChild(input);
        filter.appendChild(button);
        filter.appendChild(dropdown);

        return filter;
    }

    createDropdown(column) {
        const dropdown = document.createElement('div');
        dropdown.className = this.config.filterDropdownClass;

        const operators = [
            { value: 'contains', label: 'Contient' },
            { value: 'equals', label: 'Égal à' },
            { value: 'startsWith', label: 'Commence par' },
            { value: 'endsWith', label: 'Termine par' },
            { value: 'greaterThan', label: 'Supérieur à' },
            { value: 'lessThan', label: 'Inférieur à' }
        ];

        operators.forEach(operator => {
            const option = document.createElement('div');
            option.className = this.config.filterOptionClass;
            option.textContent = operator.label;
            option.dataset.value = operator.value;
            
            if (this.filters.get(column)?.operator === operator.value) {
                option.classList.add('active');
            }

            option.addEventListener('click', () => {
                this.setOperator(column, operator.value);
                dropdown.querySelectorAll(`.${this.config.filterOptionClass}`).forEach(opt => {
                    opt.classList.remove('active');
                });
                option.classList.add('active');
            });

            dropdown.appendChild(option);
        });

        return dropdown;
    }

    applyFilterStyles(element) {
        const style = this.config.style;
        element.style.setProperty('--input-width', style.inputWidth);
        element.style.setProperty('--input-height', style.inputHeight);
        element.style.setProperty('--input-padding', style.inputPadding);
        element.style.setProperty('--input-border-color', style.inputBorderColor);
        element.style.setProperty('--input-border-color-focus', style.inputBorderColorFocus);
        element.style.setProperty('--input-background', style.inputBackground);
        element.style.setProperty('--input-text-color', style.inputTextColor);
        element.style.setProperty('--dropdown-width', style.dropdownWidth);
        element.style.setProperty('--dropdown-background', style.dropdownBackground);
        element.style.setProperty('--dropdown-border-color', style.dropdownBorderColor);
        element.style.setProperty('--dropdown-shadow', style.dropdownShadow);
        element.style.setProperty('--option-hover-color', style.optionHoverColor);
        element.style.setProperty('--option-active-color', style.optionActiveColor);
        element.style.setProperty('--icon-color', style.iconColor);
        element.style.setProperty('--icon-color-active', style.iconColorActive);
        element.style.setProperty('--transition', style.transition);
    }

    handleInputChange(column, input) {
        if (this.cache.inputTimeout) {
            clearTimeout(this.cache.inputTimeout);
        }

        this.cache.inputTimeout = setTimeout(() => {
            const value = input.value.trim();
            if (value) {
                input.parentElement.classList.add(this.config.filterActiveClass);
            } else {
                input.parentElement.classList.remove(this.config.filterActiveClass);
            }
        }, 300);
    }

    async applyFilter(column, value) {
        try {
            const beforeFilterResult = await this.tableFlow.hooks.trigger('beforeFilter', {
                column,
                value,
                operator: this.filterState.operator,
                currentState: this.getFilterState()
            });

            if (beforeFilterResult === false) return;

            // Mettre à jour l'état local
            this.updateFilterState(column, value);

            // Filtrer les données avec debounce
            if (this.cache.filterTimeout) {
                clearTimeout(this.cache.filterTimeout);
            }

            this.cache.filterTimeout = setTimeout(async () => {
                const startTime = performance.now();
                await this.filterRows();
                
                // Mettre à jour l'état partagé
                await this.tableFlow.updateSharedState({
                    filteredData: this.cache.lastFilteredData,
                    currentPage: 1,
                    totalItems: this.cache.lastFilteredData.length
                });

                const duration = performance.now() - startTime;
                this.metrics.record('filter_duration', duration);

                await this.tableFlow.hooks.trigger('afterFilter', {
                    column,
                    value,
                    operator: this.filterState.operator,
                    newState: this.getFilterState(),
                    performance: {
                        duration,
                        itemsProcessed: this.domCache.rows.length,
                        itemsFiltered: this.cache.lastFilteredData.length
                    }
                });

                this.tableFlow.emit('filter:change', {
                    column,
                    value,
                    operator: this.filterState.operator,
                    filteredItems: this.cache.lastFilteredData,
                    performance: {
                        duration,
                        itemsProcessed: this.domCache.rows.length,
                        itemsFiltered: this.cache.lastFilteredData.length
                    }
                });

                this.metrics.increment('filter_apply');
            }, this.config.options.animationDuration);

        } catch (error) {
            this.handleError(error, 'apply_filter');
        }
    }

    setOperator(column, operator) {
        const filter = this.filters.get(column) || { value: '' };
        filter.operator = operator;
        this.filters.set(column, filter);
        this.applyFilter(column, filter.value);
    }

    updateFilterState(column, value) {
        if (value) {
            this.filters.set(column, {
                value,
                operator: this.filters.get(column)?.operator || this.config.defaultFilter.operator
            });
        } else {
            this.filters.delete(column);
        }
    }

    async filterRows() {
        const startTime = Date.now();
        const rows = this.tableFlow.table.querySelectorAll('tbody tr');
        this.cache.lastFilteredData = [];

        for (const row of rows) {
            const shouldShow = await this.evaluateRow(row);
            if (shouldShow) {
                this.cache.lastFilteredData.push(row);
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        }

        this.cache.lastFilterTime = Date.now() - startTime;
        this.metrics.record('filter_time', this.cache.lastFilterTime);
    }

    handlePageChange({ oldPage, newPage }) {
        this.sharedState.currentPage = newPage;
        this.updateVisibleRows();
    }

    handleSizeChange({ oldSize, newSize }) {
        this.sharedState.pageSize = newSize;
        this.updateVisibleRows();
    }

    async updateVisibleRows() {
        const { currentPage, pageSize } = this.tableFlow.sharedState;
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;

        this.cache.lastFilteredData.forEach((row, index) => {
            if (index >= startIndex && index < endIndex) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }

    hideDropdown() {
        const dropdowns = document.querySelectorAll(`.${this.config.filterDropdownClass}`);
        dropdowns.forEach(dropdown => {
            dropdown.classList.remove('active');
        });
    }

    getFilterState() {
        return Array.from(this.filters.entries()).map(([column, filter]) => ({
            column,
            value: filter.value,
            operator: filter.operator
        }));
    }

    clearFilter(column) {
        try {
            const beforeClearResult = this.tableFlow.hooks.trigger('beforeClear', {
                column,
                currentState: this.filterState
            });

            if (beforeClearResult === false) return;

            this.filters.delete(column);
            this.filterRows();

            const filter = this.tableFlow.table.querySelector(`th[data-column="${column}"] .${this.config.filterClass}`);
            if (filter) {
                const input = filter.querySelector(`.${this.config.filterInputClass}`);
                if (input) {
                    input.value = '';
                    input.parentElement.classList.remove(this.config.filterActiveClass);
                }
            }

            this.tableFlow.hooks.trigger('afterClear', {
                column,
                newState: this.filterState
            });

            this.tableFlow.emit('filter:clear', { column });
            this.metrics.increment('filter_clear');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_clear');
        }
    }

    beforeFilter({ column, value, operator, currentState }) {
        return true;
    }

    afterFilter({ column, value, operator, newState }) {
    }

    beforeClear({ column, currentState }) {
        return true;
    }

    afterClear({ column, newState }) {
    }

    requestRender() {
        if (this.cache.renderFrame) {
            cancelAnimationFrame(this.cache.renderFrame);
        }
        this.cache.renderFrame = requestAnimationFrame(() => this.render());
    }

    getPluginState() {
        return {
            filters: Array.from(this.filters.entries()),
            cache: {
                size: this.cache.lastFilteredData.length,
                lastUpdate: this.cache.lastFilterTime,
                performance: {
                    averageFilterTime: this.metrics.getAverage('filter_duration')
                }
            }
        };

    }

    destroy() {
        this.clearCache();
        this.resetState();
        this.tableFlow.off('headerClick', this.handleHeaderClick);
        document.removeEventListener('click', this.handleDocumentClick);
        document.removeEventListener('keydown', this.handleKeydown);
        this.metrics.increment('plugin_filter_destroy');
    }
} } 
