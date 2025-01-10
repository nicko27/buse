(function() {
    if (typeof window.filterandpaginatePlugin === 'undefined') {
        window.filterandpaginatePlugin = class filterandpaginateplugin {
            constructor(config = {}) {
                this.name = 'filterandpaginate';
                this.version = '1.0.0';
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
                    btnClass: 'btn btn-outline-secondary',
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
                if (!this.table?.table) {
                    this.debug('Table non disponible');
                    return null;
                }

                const tableId = this.table.table.id;
                if (!tableId) {
                    this.debug('Table sans ID');
                    return null;
                }

                // Créer le conteneur principal s'il n'existe pas déjà
                let container = document.getElementById(tableId + '-pagination');
                if (!container) {
                    container = document.createElement('div');
                    container.id = tableId + '-pagination';
                    container.className = 'pagination-container';

                    // Créer le sélecteur de taille de page
                    if (this.config.showPageSizes) {
                        const pageSizeContainer = document.createElement('div');
                        pageSizeContainer.className = 'page-size-container';

                        const label = document.createElement('label');
                        label.textContent = this.config.labels.pageSize;
                        pageSizeContainer.appendChild(label);

                        const select = document.createElement('select');
                        select.className = 'page-size-select';
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
                            this.config.pageSize = parseInt(e.target.value, 10);
                            this.currentPage = 1;
                            this.refresh();
                        });

                        pageSizeContainer.appendChild(select);
                        container.appendChild(pageSizeContainer);
                    }

                    // Créer la pagination
                    const paginationContainer = document.createElement('div');
                    paginationContainer.className = 'pagination-buttons';
                    container.appendChild(paginationContainer);

                    // Créer l'info
                    if (this.config.showInfo) {
                        const infoContainer = document.createElement('div');
                        infoContainer.className = 'pagination-info';
                        container.appendChild(infoContainer);
                    }

                    // Insérer après la table
                    const parent = this.table.table.parentNode;
                    if (parent && this.table.table.nextSibling) {
                        parent.insertBefore(container, this.table.table.nextSibling);
                    } else if (parent) {
                        parent.appendChild(container);
                    }
                }

                this.container = container;
                this.debug('Conteneur créé:', container);
                return container;
            }

            createPageButton(text, page, isDisabled = false) {
                const button = document.createElement('button');
                button.innerHTML = text; 
                button.className = `${this.config.btnClass} page-button`;

                if (isDisabled) {
                    button.classList.add(this.config.disabledClass);
                } else {
                    button.addEventListener('click', () => this.goToPage(page));
                }

                if (page === this.currentPage) {
                    button.classList.add(this.config.activeClass);
                }

                return button;
            }

            updatePagination() {
                if (!this.container) return;

                const paginationContainer = this.container.querySelector('.pagination-buttons');
                if (!paginationContainer) return;

                // Vider le conteneur de pagination
                paginationContainer.innerHTML = '';

                // Ajouter les boutons de navigation
                const buttons = [];

                // Bouton première page
                buttons.push(this.createPageButton(this.config.labels.first, 1, this.currentPage === 1));

                // Bouton précédent
                buttons.push(this.createPageButton(this.config.labels.prev, this.currentPage - 1, this.currentPage === 1));

                // Calculer les pages à afficher
                let startPage = Math.max(1, this.currentPage - 2);
                let endPage = Math.min(this.totalPages, startPage + 4);
                
                // Ajuster si on est proche de la fin
                if (endPage - startPage < 4) {
                    startPage = Math.max(1, endPage - 4);
                }

                // Ajouter les boutons de page
                for (let i = startPage; i <= endPage; i++) {
                    buttons.push(this.createPageButton(i.toString(), i, false));
                }

                // Bouton suivant
                buttons.push(this.createPageButton(this.config.labels.next, this.currentPage + 1, this.currentPage === this.totalPages));

                // Bouton dernière page
                buttons.push(this.createPageButton(this.config.labels.last, this.totalPages, this.currentPage === this.totalPages));

                // Ajouter tous les boutons au conteneur
                buttons.forEach(button => paginationContainer.appendChild(button));
            }

            updateInfo() {
                if (!this.container) return;

                const infoContainer = this.container.querySelector('.pagination-info');
                if (!infoContainer) return;

                const filteredRows = this.getFilteredRows();
                const start = (this.currentPage - 1) * this.config.pageSize + 1;
                const end = Math.min(start + this.config.pageSize - 1, filteredRows.length);
                const total = filteredRows.length;

                const info = this.config.labels.info
                    .replace('{start}', start)
                    .replace('{end}', end)
                    .replace('{total}', total);

                infoContainer.textContent = info;
            }

            getFilteredRows() {
                if (!this.table) {
                    this.debug('Table non disponible');
                    return [];
                }

                const allRows = this.table.getAllRows();
                this.debug('Lignes totales:', allRows.length);

                if (!this.filterValue) {
                    this.debug('Pas de valeur de filtre, retour de toutes les lignes', this.filterValue);
                    return allRows;
                }

                return allRows.filter(row => {
                    const cells = Array.from(row.cells);
                    return cells.some(cell => {
                        const value = this.getCellValue(cell);
                        return value.toLowerCase().includes(this.filterValue);
                    });
                });
            }

            getCellValue(cell) {
                if (!cell) return '';
                // Récupérer d'abord la valeur stockée
                const storedValue = cell.getAttribute('data-value');
                if (storedValue) return storedValue;
                
                // Sinon récupérer le contenu visible
                const wrapper = cell.querySelector('.cell-wrapper');
                return (wrapper ? wrapper.textContent : cell.textContent).trim();
            }

            goToPage(page) {
                if (page < 1 || page > this.totalPages) return;
                this.currentPage = page;
                this.refresh();
            }

            refresh() {
                if (!this.table || !this.container) {
                    this.debug('Table ou conteneur non disponible');
                    return;
                }

                // Récupérer les lignes filtrées
                const filteredRows = this.getFilteredRows();
                this.debug('Refresh - Lignes filtrées:', filteredRows.length);

                // Calculer la pagination
                const totalRows = filteredRows.length;
                this.totalPages = Math.max(1, Math.ceil(totalRows / this.config.pageSize));
                this.currentPage = Math.min(this.currentPage, this.totalPages);

                // Appliquer la pagination
                const start = (this.currentPage - 1) * this.config.pageSize;
                const end = Math.min(start + this.config.pageSize, totalRows);
                const visibleRows = filteredRows.slice(start, end);

                // Masquer toutes les lignes d'abord
                const allRows = this.table.getAllRows();
                allRows.forEach(row => {
                    row.style.display = 'none';
                });

                // Afficher uniquement les lignes visibles
                visibleRows.forEach(row => {
                    row.style.display = '';
                });

                // Mettre à jour l'interface de pagination
                this.updatePagination();
                if (this.config.showInfo) {
                    this.updateInfo();
                }

                // Émettre un événement de mise à jour
                const event = new CustomEvent('paginationUpdated', {
                    detail: {
                        currentPage: this.currentPage,
                        totalPages: this.totalPages,
                        pageSize: this.config.pageSize,
                        totalRows: totalRows,
                        visibleRows: visibleRows.length
                    },
                    bubbles: true
                });
                this.table.table.dispatchEvent(event);
            }

            destroy() {
                if (this.container) {
                    this.container.remove();
                }

                // Réinitialiser toutes les lignes
                if (this.table?.table) {
                    const rows = this.table.table.querySelectorAll('tbody tr');
                    rows.forEach(row => {
                        row.style.display = '';
                    });
                }

                this.table = null;
                this.container = null;
                this.debug('Plugin détruit');
            }

            debug(message, data = null) {
                if (this.table?.options?.debug) {
                    console.log(`[filterandpaginate] ${message}`, data || '');
                }
            }
        };
    }

    // Export pour ES modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = filterandpaginateplugin;
    } else if (typeof exports !== 'undefined') {
        exports.filterandpaginateplugin = filterandpaginateplugin;
    }
})();
