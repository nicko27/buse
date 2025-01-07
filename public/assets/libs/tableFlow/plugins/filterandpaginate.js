(function() {
    if (typeof window.filterandpaginatePlugin === 'undefined') {
        window.filterandpaginatePlugin = class FilterAndPaginatePlugin {
            constructor(config = {}) {
                this.config = {
                    pageSize: 10,
                    pageSizes: [5, 10, 25, 50, 100],
                    filterDelay: 300,
                    filterInputClass: 'filter-input',
                    paginationContainerClass: 'pagination-container',
                    filterContainerClass: 'filter-container',
                    pageSizeContainerClass: 'pagesize-container',
                    ...config
                };
                
                this.context = null;
                this.currentPage = 1;
                this.filterTimer = null;
                this.filterValue = '';
                this.filteredRows = [];
            }

            async init(context) {
                this.context = context;
                
                // Créer les conteneurs UI
                this.createFilterContainer();
                this.createPaginationContainer();
                this.createPageSizeContainer();
                
                // Initialiser le filtrage et la pagination
                this.setupEventListeners();
                this.applyFilterAndPagination();
            }

            createFilterContainer() {
                const { table, container } = this.context;
                
                const filterContainer = document.createElement('div');
                filterContainer.className = this.config.filterContainerClass;
                
                const filterInput = document.createElement('input');
                filterInput.type = 'text';
                filterInput.className = this.config.filterInputClass;
                filterInput.placeholder = 'Filtrer...';
                
                filterContainer.appendChild(filterInput);
                container.insertBefore(filterContainer, table);
            }

            createPaginationContainer() {
                const { container, table } = this.context;
                
                const paginationContainer = document.createElement('div');
                paginationContainer.className = this.config.paginationContainerClass;
                
                container.insertBefore(paginationContainer, table.nextSibling);
            }

            createPageSizeContainer() {
                const { container, table } = this.context;
                
                const pageSizeContainer = document.createElement('div');
                pageSizeContainer.className = this.config.pageSizeContainerClass;
                
                const select = document.createElement('select');
                this.config.pageSizes.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size;
                    option.textContent = `${size} lignes`;
                    if (size === this.config.pageSize) {
                        option.selected = true;
                    }
                    select.appendChild(option);
                });
                
                pageSizeContainer.appendChild(select);
                container.insertBefore(pageSizeContainer, table);
            }

            setupEventListeners() {
                const { container } = this.context;
                
                // Écouteur pour le filtre
                const filterInput = container.querySelector(`.${this.config.filterInputClass}`);
                filterInput.addEventListener('input', () => {
                    clearTimeout(this.filterTimer);
                    this.filterTimer = setTimeout(() => {
                        this.filterValue = filterInput.value.toLowerCase();
                        this.currentPage = 1;
                        this.applyFilterAndPagination();
                    }, this.config.filterDelay);
                });
                
                // Écouteur pour la taille de page
                const pageSizeSelect = container.querySelector(`.${this.config.pageSizeContainerClass} select`);
                pageSizeSelect.addEventListener('change', () => {
                    this.config.pageSize = parseInt(pageSizeSelect.value);
                    this.currentPage = 1;
                    this.applyFilterAndPagination();
                });
            }

            applyFilterAndPagination() {
                const rows = Array.from(this.context.getRows());
                
                // Appliquer le filtre
                this.filteredRows = this.filterValue
                    ? rows.filter(row => this.rowMatchesFilter(row))
                    : rows;
                
                // Calculer la pagination
                const totalPages = Math.ceil(this.filteredRows.length / this.config.pageSize);
                const start = (this.currentPage - 1) * this.config.pageSize;
                const end = start + this.config.pageSize;
                
                // Afficher les lignes de la page courante
                rows.forEach(row => row.style.display = 'none');
                this.filteredRows.slice(start, end).forEach(row => row.style.display = '');
                
                // Mettre à jour la pagination
                this.updatePaginationUI(totalPages);
            }

            rowMatchesFilter(row) {
                const cells = Array.from(row.cells);
                return cells.some(cell => {
                    const text = cell.textContent.toLowerCase();
                    return text.includes(this.filterValue);
                });
            }

            updatePaginationUI(totalPages) {
                const { container } = this.context;
                const paginationContainer = container.querySelector(`.${this.config.paginationContainerClass}`);
                paginationContainer.innerHTML = '';
                
                // Bouton précédent
                const prevButton = document.createElement('button');
                prevButton.textContent = '←';
                prevButton.disabled = this.currentPage === 1;
                prevButton.addEventListener('click', () => {
                    if (this.currentPage > 1) {
                        this.currentPage--;
                        this.applyFilterAndPagination();
                    }
                });
                paginationContainer.appendChild(prevButton);
                
                // Pages
                for (let i = 1; i <= totalPages; i++) {
                    const pageButton = document.createElement('button');
                    pageButton.textContent = i;
                    pageButton.classList.toggle('active', i === this.currentPage);
                    pageButton.addEventListener('click', () => {
                        this.currentPage = i;
                        this.applyFilterAndPagination();
                    });
                    paginationContainer.appendChild(pageButton);
                }
                
                // Bouton suivant
                const nextButton = document.createElement('button');
                nextButton.textContent = '→';
                nextButton.disabled = this.currentPage === totalPages;
                nextButton.addEventListener('click', () => {
                    if (this.currentPage < totalPages) {
                        this.currentPage++;
                        this.applyFilterAndPagination();
                    }
                });
                paginationContainer.appendChild(nextButton);
            }

            refresh() {
                this.applyFilterAndPagination();
            }

            destroy() {
                const { container } = this.context;
                
                // Supprimer les conteneurs UI
                container.querySelector(`.${this.config.filterContainerClass}`)?.remove();
                container.querySelector(`.${this.config.paginationContainerClass}`)?.remove();
                container.querySelector(`.${this.config.pageSizeContainerClass}`)?.remove();
                
                // Réinitialiser l'affichage des lignes
                this.context.getRows().forEach(row => row.style.display = '');
                
                this.context = null;
            }
        };
    }

    // Export pour ES modules
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = FilterAndPaginatePlugin;
    } else if (typeof exports !== 'undefined') {
        exports.FilterAndPaginatePlugin = FilterAndPaginatePlugin;
    }
})();
