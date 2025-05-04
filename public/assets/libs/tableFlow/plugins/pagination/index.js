import { config } from './config.js';

export class PaginationPlugin {
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.config = { ...config, ...options };
        this.logger = tableFlow.logger;
        this.metrics = tableFlow.metrics;
        this.errorHandler = tableFlow.errorHandler;
        this.name = 'pagination';
        
        // État local
        this.state = {
            currentPage: 1,
            pageSize: this.config.defaultPageSize,
            totalItems: 0,
            totalPages: 0
        };
        
        // Cache pour les performances
        this.cache = {
            lastRenderTime: 0,
            renderTimeout: null,
            renderFrame: null,
            visibleRows: [],
            domNodes: new Map()
        };
        
        // Cache DOM
        this.domCache = {
            table: null,
            tbody: null,
            rows: [],
            container: null,
            pagesContainer: null,
            infoContainer: null,
            sizeSelector: null
        };
        
        this.container = null;
        this.pagesContainer = null;
        this.infoContainer = null;
        this.sizeSelector = null;
    }

    async init() {
        this.logger.info('Initializing Pagination plugin');
        
        try {
            await this.initDOMCache();
            this.setupEventListeners();
            this.registerHooks();
            await this.createContainer();
            
            // S'enregistrer comme plugin coopératif
            this.tableFlow.registerCooperativePlugin(this);
            
            this.metrics.increment('plugin_pagination_init');
        } catch (error) {
            this.handleError(error, 'init');
        }
    }

    async initDOMCache() {
        this.domCache = {
            table: this.tableFlow.table,
            tbody: this.tableFlow.table.querySelector('tbody'),
            rows: Array.from(this.tableFlow.table.querySelectorAll('tbody tr'))
        };
    }

    clearCache() {
        if (this.cache.renderTimeout) {
            clearTimeout(this.cache.renderTimeout);
        }
        if (this.cache.renderFrame) {
            cancelAnimationFrame(this.cache.renderFrame);
        }

        this.cache = {
            lastRenderTime: 0,
            renderTimeout: null,
            renderFrame: null,
            visibleRows: [],
            domNodes: new Map()
        };
    }

    handleError(error, context) {
        this.errorHandler.handle(error, 'pagination_error', { context });
        this.clearCache();
        this.resetState();
    }

    resetState() {
        this.state = {
            currentPage: 1,
            pageSize: this.config.defaultPageSize,
            totalItems: 0,
            totalPages: 0
        };
    }

    setupEventListeners() {
        document.addEventListener('keydown', this.handleKeydown.bind(this));
        this.tableFlow.on('data:change', this.handleDataChange.bind(this));
    }

    registerHooks() {
        this.tableFlow.hooks.register('beforePageChange', this.beforePageChange.bind(this));
        this.tableFlow.hooks.register('afterPageChange', this.afterPageChange.bind(this));
        this.tableFlow.hooks.register('beforeSizeChange', this.beforeSizeChange.bind(this));
        this.tableFlow.hooks.register('afterSizeChange', this.afterSizeChange.bind(this));
        
        // Nouveaux hooks pour la synchronisation
        this.tableFlow.hooks.register('afterFilter', this.handleFilterChange.bind(this));
        this.tableFlow.hooks.register('afterClear', this.handleFilterClear.bind(this));
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = this.config.paginationClass;
        this.applyContainerStyles(this.container);

        this.pagesContainer = document.createElement('div');
        this.pagesContainer.className = 'tableflow-pagination-pages';
        this.container.appendChild(this.pagesContainer);

        if (this.config.showInfo) {
            this.infoContainer = document.createElement('div');
            this.infoContainer.className = this.config.infoClass;
            this.infoContainer.setAttribute('aria-live', 'polite');
            this.container.appendChild(this.infoContainer);
        }

        if (this.config.showSizeSelector) {
            this.sizeSelector = document.createElement('div');
            this.sizeSelector.className = this.config.sizeSelectorClass;
            
            const select = document.createElement('select');
            this.config.sizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = `${size} par page`;
                if (size === this.state.pageSize) {
                    option.selected = true;
                }
                select.appendChild(option);
            });
            
            select.addEventListener('change', (e) => {
                this.setPageSize(parseInt(e.target.value));
            });
            
            this.sizeSelector.appendChild(select);
            this.container.appendChild(this.sizeSelector);
        }

        this.tableFlow.container.appendChild(this.container);
    }

    applyContainerStyles(element) {
        const style = this.config.style;
        element.style.setProperty('--container-background', style.containerBackground);
        element.style.setProperty('--container-border', style.containerBorder);
        element.style.setProperty('--container-border-radius', style.containerBorderRadius);
        element.style.setProperty('--container-padding', style.containerPadding);
        element.style.setProperty('--container-margin', style.containerMargin);
        element.style.setProperty('--page-size', style.pageSize);
        element.style.setProperty('--page-padding', style.pagePadding);
        element.style.setProperty('--page-margin', style.pageMargin);
        element.style.setProperty('--page-border', style.pageBorder);
        element.style.setProperty('--page-border-radius', style.pageBorderRadius);
        element.style.setProperty('--page-background', style.pageBackground);
        element.style.setProperty('--page-color', style.pageColor);
        element.style.setProperty('--page-hover-background', style.pageHoverBackground);
        element.style.setProperty('--page-hover-color', style.pageHoverColor);
        element.style.setProperty('--page-active-background', style.pageActiveBackground);
        element.style.setProperty('--page-active-color', style.pageActiveColor);
        element.style.setProperty('--page-disabled-background', style.pageDisabledBackground);
        element.style.setProperty('--page-disabled-color', style.pageDisabledColor);
        element.style.setProperty('--selector-width', style.selectorWidth);
        element.style.setProperty('--selector-height', style.selectorHeight);
        element.style.setProperty('--selector-padding', style.selectorPadding);
        element.style.setProperty('--selector-border', style.selectorBorder);
        element.style.setProperty('--selector-border-radius', style.selectorBorderRadius);
        element.style.setProperty('--selector-background', style.selectorBackground);
        element.style.setProperty('--selector-color', style.selectorColor);
        element.style.setProperty('--info-color', style.infoColor);
        element.style.setProperty('--info-font-size', style.infoFontSize);
        element.style.setProperty('--info-margin', style.infoMargin);
        element.style.setProperty('--transition', style.transition);
    }

    handleKeydown(event) {
        if (!this.config.keyboard.enabled) return;

        switch (event.key) {
            case this.config.keyboard.prevPageKey:
                event.preventDefault();
                this.prevPage();
                break;
            case this.config.keyboard.nextPageKey:
                event.preventDefault();
                this.nextPage();
                break;
            case this.config.keyboard.firstPageKey:
                event.preventDefault();
                this.firstPage();
                break;
            case this.config.keyboard.lastPageKey:
                event.preventDefault();
                this.lastPage();
                break;
        }
    }

    handleDataChange() {
        // Utiliser les éléments filtrés si disponibles
        if (this.tableFlow.plugins.filter) {
            this.state.totalItems = this.tableFlow.plugins.filter.sharedState.filteredItems.length;
        } else {
            this.state.totalItems = this.tableFlow.getTotalItems();
        }
        
        this.state.totalPages = Math.ceil(this.state.totalItems / this.state.pageSize);
        this.updateInfo();
        this.render();
    }

    handleFilterChange({ filteredItems }) {
        this.state.totalItems = filteredItems.length;
        this.state.totalPages = Math.ceil(filteredItems.length / this.state.pageSize);
        
        if (this.state.currentPage > this.state.totalPages) {
            this.state.currentPage = 1;
        }
        
        this.updateInfo();
        this.render();
    }

    handleFilterClear() {
        this.state.totalItems = this.tableFlow.getTotalItems();
        this.state.totalPages = Math.ceil(this.state.totalItems / this.state.pageSize);
        
        if (this.state.currentPage > this.state.totalPages) {
            this.state.currentPage = 1;
        }
        
        this.updateInfo();
        this.render();
    }

    async goToPage(page) {
        try {
            const beforePageChangeResult = await this.tableFlow.hooks.trigger('beforePageChange', {
                currentPage: this.state.currentPage,
                newPage: page,
                pageSize: this.state.pageSize
            });

            if (beforePageChangeResult === false) return;

            this.state.currentPage = page;
            
            // Mettre à jour l'état partagé
            await this.tableFlow.updateSharedState({
                currentPage: page
            });

            await this.updateVisibleRows();
            this.render();

            await this.tableFlow.hooks.trigger('afterPageChange', {
                page,
                pageSize: this.state.pageSize
            });

            this.tableFlow.emit('pagination:change', {
                page,
                pageSize: this.state.pageSize
            });

            this.metrics.increment('pagination_page_change');
        } catch (error) {
            this.handleError(error, 'goToPage');
        }
    }

    nextPage() {
        if (this.state.currentPage < this.state.totalPages) {
            this.goToPage(this.state.currentPage + 1);
        }
    }

    prevPage() {
        if (this.state.currentPage > 1) {
            this.goToPage(this.state.currentPage - 1);
        }
    }

    firstPage() {
        if (this.state.currentPage > 1) {
            this.goToPage(1);
        }
    }

    lastPage() {
        if (this.state.currentPage < this.state.totalPages) {
            this.goToPage(this.state.totalPages);
        }
    }

    async setPageSize(size) {
        try {
            if (!Number.isInteger(size) || size < 1) {
                throw new Error('Invalid page size');
            }

            const beforeSizeChangeResult = await this.tableFlow.hooks.trigger('beforeSizeChange', {
                currentSize: this.state.pageSize,
                newSize: size
            });

            if (beforeSizeChangeResult === false) return;

            this.state.pageSize = size;
            this.state.totalPages = Math.ceil(this.state.totalItems / size);
            
            if (this.state.currentPage > this.state.totalPages) {
                this.state.currentPage = 1;
            }

            // Mettre à jour l'état partagé
            await this.tableFlow.updateSharedState({
                pageSize: size,
                currentPage: this.state.currentPage
            });

            const startTime = performance.now();
            await this.updateVisibleRows();
            const duration = performance.now() - startTime;
            
            this.requestRender();

            await this.tableFlow.hooks.trigger('afterSizeChange', {
                size,
                currentPage: this.state.currentPage,
                performance: {
                    duration,
                    visibleRows: this.cache.visibleRows.length
                }
            });

            this.tableFlow.emit('pagination:size_change', {
                size,
                currentPage: this.state.currentPage,
                performance: {
                    duration,
                    visibleRows: this.cache.visibleRows.length
                }
            });

            this.metrics.increment('pagination_size_change');
            this.metrics.record('pagination_size_change_duration', duration);
        } catch (error) {
            this.handleError(error, 'set_page_size');
        }
    }

    updateInfo() {
        if (!this.infoContainer) return;

        const start = (this.state.currentPage - 1) * this.state.pageSize + 1;
        const end = Math.min(start + this.state.pageSize - 1, this.state.totalItems);
        
        this.infoContainer.textContent = `Affichage de ${start} à ${end} sur ${this.state.totalItems} éléments`;
    }

    render() {
        if (this.cache.renderTimeout) {
            clearTimeout(this.cache.renderTimeout);
        }

        this.cache.renderTimeout = setTimeout(() => {
            // Mettre à jour l'interface utilisateur
            this.updateInfo();
            this.updateButtons();
        }, this.config.options.animationDuration);
    }

    updateButtons() {
        if (!this.pagesContainer) return;

        this.pagesContainer.innerHTML = '';
        
        // Première page
        if (this.config.showFirstLast) {
            this.createPageButton('first', 'Première page', this.firstPage.bind(this), this.state.currentPage === 1);
        }

        // Page précédente
        if (this.config.showPrevNext) {
            this.createPageButton('prev', 'Page précédente', this.prevPage.bind(this), this.state.currentPage === 1);
        }

        // Pages numérotées
        const pages = this.getVisiblePages();
        pages.forEach(page => {
            if (page === '...') {
                this.createEllipsis();
            } else {
                this.createPageButton(page, `Page ${page}`, () => this.goToPage(page), page === this.state.currentPage);
            }
        });

        // Page suivante
        if (this.config.showPrevNext) {
            this.createPageButton('next', 'Page suivante', this.nextPage.bind(this), this.state.currentPage === this.state.totalPages);
        }

        // Dernière page
        if (this.config.showFirstLast) {
            this.createPageButton('last', 'Dernière page', this.lastPage.bind(this), this.state.currentPage === this.state.totalPages);
        }
    }

    getVisiblePages() {
        const pages = [];
        const maxVisible = this.config.maxVisiblePages;
        const current = this.state.currentPage;
        const total = this.state.totalPages;

        if (total <= maxVisible) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }

        let start = Math.max(1, current - Math.floor(maxVisible / 2));
        let end = Math.min(total, start + maxVisible - 1);

        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }

        if (start > 1) {
            pages.push(1);
            if (start > 2) {
                pages.push('...');
            }
        }

        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        if (end < total) {
            if (end < total - 1) {
                pages.push('...');
            }
            pages.push(total);
        }

        return pages;
    }

    createPageButton(type, label, onClick, disabled) {
        const button = document.createElement('button');
        button.className = `${this.config.pageClass} ${this.config[`${type}PageClass`]}`;
        button.textContent = type === 'first' || type === 'last' || type === 'prev' || type === 'next' ? '' : type;
        button.setAttribute('aria-label', label);
        
        if (disabled) {
            button.classList.add(this.config.disabledPageClass);
            button.setAttribute('aria-disabled', 'true');
        } else {
            button.addEventListener('click', onClick);
        }

        if (type === this.state.currentPage) {
            button.classList.add(this.config.activePageClass);
            button.setAttribute('aria-current', 'page');
        }

        this.pagesContainer.appendChild(button);
    }

    createEllipsis() {
        const ellipsis = document.createElement('span');
        ellipsis.className = this.config.ellipsisClass;
        ellipsis.textContent = '...';
        this.pagesContainer.appendChild(ellipsis);
    }

    getState() {
        return {
            currentPage: this.state.currentPage,
            pageSize: this.state.pageSize,
            totalPages: this.state.totalPages,
            totalItems: this.state.totalItems,
            startItem: (this.state.currentPage - 1) * this.state.pageSize + 1,
            endItem: Math.min(this.state.currentPage * this.state.pageSize, this.state.totalItems)
        };
    }

    beforePageChange({ currentPage, newPage }) {
        return true;
    }

    afterPageChange({ oldPage, newPage }) {
    }

    beforeSizeChange({ currentSize, newSize }) {
        return true;
    }

    afterSizeChange({ oldSize, newSize }) {
    }

    async updateVisibleRows() {
        if (!this.tableFlow.sharedState.filteredData) {
            return;
        }

        const startTime = performance.now();
        const { filteredData } = this.tableFlow.sharedState;
        const startIndex = (this.state.currentPage - 1) * this.state.pageSize;
        const endIndex = startIndex + this.state.pageSize;

        this.cache.visibleRows = filteredData.slice(startIndex, endIndex);
        
        // Optimisation : utiliser le cache DOM
        if (!this.domCache.rows.length) {
            await this.initDOMCache();
        }

        // Mettre à jour la visibilité des lignes avec requestAnimationFrame
        if (this.cache.renderFrame) {
            cancelAnimationFrame(this.cache.renderFrame);
        }

        this.cache.renderFrame = requestAnimationFrame(() => {
            this.domCache.rows.forEach((row, index) => {
                const isVisible = index >= startIndex && index < endIndex;
                row.style.display = isVisible ? '' : 'none';
                
                // Mettre en cache l'état de visibilité
                this.cache.domNodes.set(row, isVisible);
            });
        });

        this.cache.lastRenderTime = performance.now() - startTime;
        this.metrics.record('pagination_render_time', this.cache.lastRenderTime);
    }

    requestRender() {
        if (this.cache.renderFrame) {
            cancelAnimationFrame(this.cache.renderFrame);
        }
        this.cache.renderFrame = requestAnimationFrame(() => {
            this.updateInfo();
            this.updateButtons();
        });
    }

    getPluginState() {
        return {
            ...this.state,
            cache: {
                visibleRows: this.cache.visibleRows.length,
                lastRender: this.cache.lastRenderTime,
                performance: {
                    averageRenderTime: this.metrics.getAverage('pagination_render_time')
                }
            }
        };
    }

    destroy() {
        this.clearCache();
        this.resetState();
        document.removeEventListener('keydown', this.handleKeydown);
        this.tableFlow.off('data:change', this.handleDataChange);
        if (this.domCache.container && this.domCache.container.parentNode) {
            this.domCache.container.parentNode.removeChild(this.domCache.container);
        }
        this.metrics.increment('plugin_pagination_destroy');
    }
} 