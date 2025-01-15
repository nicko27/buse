export default class FilterAndPaginatePlugin {
    constructor(config = {}) {
        this.name = 'filterandpaginate';
        this.version = '1.1.0';
        this.type = 'filter';
        this.table = null;
        this.config = {...this.getDefaultConfig(), ...config};

        this.currentPage = 1;
        this.totalPages = 1;
        this.container = null;
        this.filterValue = '';
        this.filterTimeout = null;

        this.debug('Plugin créé avec la config:', this.config);
    }

    getDefaultConfig() {
        return {
            enableFilter: true,
            globalFilter: null,
            debounceTime: 300,
            pageSize: 10,
            pageSizes: [10, 25, 50, 100],
            containerClass: 'pagination-container',
            paginationClass: 'pagination',
            activeClass: 'active',
            disabledClass: 'disabled',
            selectClass: 'form-select',
            btnClass: 'btn btn-glass btn-glass-blue',
            showPageSizes: true,
            showInfo: true,
            labels: {
                first: '«',
                prev: '‹',
                next: '›',
                last: '»',
                info: 'Affichage de {start} à {end} sur {total} entrées',
                pageSize: 'Entrées par page:'
            },
            icons: {
                first: '<i class="fas fa-angle-double-left"></i>',
                prev: '<i class="fas fa-chevron-left"></i>',
                next: '<i class="fas fa-chevron-right"></i>',
                last: '<i class="fas fa-angle-double-right"></i>'
            },
            backwardIcon: '<i class="fas fa-chevron-left"></i>',
            forwardIcon: '<i class="fas fa-chevron-right"></i>',
            fastBackwardIcon: '<i class="fas fa-angle-double-left"></i>',
            fastForwardIcon: '<i class="fas fa-angle-double-right"></i>'
        };
    }

    init(tableHandler) {
        this.table = tableHandler;
        this.debug('Initialisation avec la table:', this.table);

        // Setup du filtre si activé
        if (this.config.enableFilter) {
            this.setupFilter();
        }

        // Création et insertion du conteneur
        this.createContainer();

        // Écoute de l'événement de tri
        this.table.table.addEventListener('sortAppened', () => {
            this.refresh();
        });

        // Rafraîchissement initial
        this.refresh();
    }

    setupFilter() {
        if (!this.config.globalFilter) {
            this.debug('Pas de filtre global configuré');
            return;
        }

        const input = document.querySelector(this.config.globalFilter);
        if (!input) {
            this.debug('Input filtre non trouvé:', this.config.globalFilter);
            return;
        }

        this.debug('Configuration du filtre sur l\'input:', input);

        input.addEventListener('input', (e) => {
            this.debug('Événement input déclenché:', e.target.value);

            if (this.filterTimeout) {
                clearTimeout(this.filterTimeout);
            }

            this.filterTimeout = setTimeout(() => {
                this.filterValue = e.target.value.toLowerCase().trim();
                this.debug('Filtrage avec la valeur:', this.filterValue);
                this.currentPage = 1;
                this.refresh();

                // Déclencher l'événement onFilter s'il existe
                if (this.table.options.onFilter) {
                    this.table.options.onFilter(this.filterValue);
                }
            }, this.config.debounceTime);
        });
    }

    createContainer() {
        // Créer le conteneur principal
        this.container = document.createElement('div');
        this.container.className = this.config.containerClass;

        // Créer le conteneur de pagination
        const paginationContainer = document.createElement('div');
        paginationContainer.className = this.config.paginationClass;
        this.container.appendChild(paginationContainer);

        // Créer le sélecteur de taille de page si activé
        if (this.config.showPageSizes) {
            const pageSizeContainer = document.createElement('div');
            pageSizeContainer.className = 'page-size-container';

            if (this.config.labels.pageSize) {
                const label = document.createElement('span');
                label.textContent = this.config.labels.pageSize;
                pageSizeContainer.appendChild(label);
            }

            const select = document.createElement('select');
            select.className = this.config.selectClass;

            this.config.pageSizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size;
                option.textContent = size;
                if (size === this.config.pageSize) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            select.addEventListener('change', (e) => {
                this.config.pageSize = parseInt(e.target.value);
                this.currentPage = 1;
                this.refresh();
            });

            pageSizeContainer.appendChild(select);
            this.container.appendChild(pageSizeContainer);
        }

        // Créer le conteneur d'info si activé
        if (this.config.showInfo) {
            const infoContainer = document.createElement('div');
            infoContainer.className = 'pagination-info';
            this.container.appendChild(infoContainer);
        }

        // Insérer le conteneur après la table
        this.table.table.parentNode.insertBefore(this.container, this.table.table.nextSibling);
    }

    createPageButton(text, page, isDisabled = false) {
        const button = document.createElement('button');
        button.className = this.config.btnClass;
        button.innerHTML = text;
        button.disabled = isDisabled;

        if (isDisabled) {
            button.classList.add(this.config.disabledClass);
        }

        if (page === this.currentPage) {
            button.classList.add(this.config.activeClass);
        }

        if (!isDisabled) {
            button.addEventListener('click', () => this.goToPage(page));
        }

        return button;
    }

    updatePagination() {
        const paginationContainer = this.container.querySelector(`.${this.config.paginationClass}`);
        paginationContainer.innerHTML = '';

        // Boutons de navigation
        paginationContainer.appendChild(this.createPageButton(this.config.icons.first || this.config.labels.first, 1, this.currentPage === 1));
        paginationContainer.appendChild(this.createPageButton(this.config.icons.prev || this.config.labels.prev, this.currentPage - 1, this.currentPage === 1));

        // Pages
        let startPage = Math.max(1, this.currentPage - 2);
        let endPage = Math.min(this.totalPages, startPage + 4);
        startPage = Math.max(1, endPage - 4);

        for (let i = startPage; i <= endPage; i++) {
            paginationContainer.appendChild(this.createPageButton(i, i));
        }

        // Boutons suivant/dernier
        paginationContainer.appendChild(this.createPageButton(this.config.icons.next || this.config.labels.next, this.currentPage + 1, this.currentPage === this.totalPages));
        paginationContainer.appendChild(this.createPageButton(this.config.icons.last || this.config.labels.last, this.totalPages, this.currentPage === this.totalPages));
    }

    updateInfo() {
        if (!this.config.showInfo) return;

        const infoContainer = this.container.querySelector('.pagination-info');
        if (!infoContainer) return;

        const filteredRows = this.getFilteredRows();
        const start = (this.currentPage - 1) * this.config.pageSize + 1;
        const end = Math.min(start + this.config.pageSize - 1, filteredRows.length);

        let infoText = this.config.labels.info
            .replace('{start}', start)
            .replace('{end}', end)
            .replace('{total}', filteredRows.length);

        infoContainer.textContent = infoText;
    }

    getFilteredRows() {
        const rows = Array.from(this.table.getAllRows());
        
        if (!this.filterValue) {
            return rows;
        }

        return rows.filter(row => {
            return Array.from(row.cells).some(cell => {
                const value = this.getCellValue(cell);
                return value.toLowerCase().includes(this.filterValue);
            });
        });
    }

    getCellValue(cell) {
        if (!cell) return '';
        
        // Vérifier d'abord data-filter-value
        const filterValue = cell.getAttribute('data-filter-value');
        if (filterValue !== null) {
            return filterValue;
        }

        // Sinon utiliser le contenu de la cellule
        return cell.textContent.trim();
    }

    goToPage(page) {
        if (page < 1 || page > this.totalPages || page === this.currentPage) {
            return;
        }

        this.currentPage = page;
        this.refresh();

        // Déclencher l'événement de changement de page
        const event = new CustomEvent('pageChanged', {
            detail: {
                page: this.currentPage,
                pageSize: this.config.pageSize
            }
        });
        this.table.table.dispatchEvent(event);
    }

    refresh() {
        const filteredRows = this.getFilteredRows();
        this.totalPages = Math.ceil(filteredRows.length / this.config.pageSize);

        // Ajuster la page courante si nécessaire
        if (this.currentPage > this.totalPages) {
            this.currentPage = this.totalPages || 1;
        }

        // Calculer les indices de début et de fin
        const start = (this.currentPage - 1) * this.config.pageSize;
        const end = start + this.config.pageSize;

        // Masquer toutes les lignes
        const allRows = this.table.getAllRows();
        allRows.forEach(row => row.style.display = 'none');

        // Afficher uniquement les lignes de la page courante
        filteredRows.slice(start, end).forEach(row => row.style.display = '');

        // Mettre à jour la pagination et les infos
        this.updatePagination();
        this.updateInfo();
    }

    destroy() {
        // Supprimer le conteneur de pagination
        if (this.container) {
            this.container.remove();
        }

        // Supprimer le gestionnaire d'événements du filtre
        if (this.config.enableFilter && this.config.globalFilter) {
            const input = document.querySelector(this.config.globalFilter);
            if (input) {
                input.value = '';
                input.dispatchEvent(new Event('input'));
            }
        }

        // Réinitialiser les variables
        this.currentPage = 1;
        this.totalPages = 1;
        this.filterValue = '';
        this.container = null;
    }

    debug(message, data = null) {
        if (this.config.debug) {
            console.log(`[FilterAndPaginatePlugin] ${message}`, data || '');
        }
    }
}
