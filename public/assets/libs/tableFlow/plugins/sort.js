class SortPlugin {
    constructor(config = {}) {
        this.config = {
            sortableClass: 'sortable',
            ascClass: 'sort-asc',
            descClass: 'sort-desc',
            sortIconClass: 'sort-icon',
            multiSort: false,
            defaultSort: [],
            customSorts: {},
            ...config
        };
        
        this.context = null;
        this.currentSort = [];
    }

    async init(context) {
        this.context = context;
        
        // Initialiser le tri par défaut
        this.currentSort = [...this.config.defaultSort];
        
        // Configurer les en-têtes triables
        this.setupSortableHeaders();
        
        // Appliquer le tri initial
        if (this.currentSort.length > 0) {
            this.applySort();
        }
    }

    setupSortableHeaders() {
        const headers = this.context.getHeaders();
        headers.forEach(header => {
            if (this.isHeaderSortable(header)) {
                this.setupSortableHeader(header);
            }
        });
    }

    isHeaderSortable(header) {
        return header.classList.contains(this.config.sortableClass) || 
               header.hasAttribute('data-sortable');
    }

    setupSortableHeader(header) {
        // Ajouter l'icône de tri
        const wrapper = header.querySelector('.head-wrapper');
        const icon = document.createElement('span');
        icon.className = this.config.sortIconClass;
        wrapper.appendChild(icon);

        // Ajouter l'écouteur de clic
        header.addEventListener('click', (event) => this.handleHeaderClick(event));
    }

    handleHeaderClick(event) {
        const header = event.target.closest('th');
        if (!header || !this.isHeaderSortable(header)) return;

        event.preventDefault();
        
        const columnId = header.id;
        const currentSortIndex = this.currentSort.findIndex(sort => sort.column === columnId);
        
        if (currentSortIndex !== -1) {
            // Inverser la direction si la colonne est déjà triée
            if (this.currentSort[currentSortIndex].direction === 'asc') {
                this.currentSort[currentSortIndex].direction = 'desc';
            } else {
                // Retirer le tri si on clique une troisième fois
                this.currentSort.splice(currentSortIndex, 1);
            }
        } else {
            // Ajouter un nouveau tri
            const newSort = {
                column: columnId,
                direction: 'asc'
            };
            
            if (this.config.multiSort && event.shiftKey) {
                this.currentSort.push(newSort);
            } else {
                this.currentSort = [newSort];
            }
        }

        this.applySort();
    }

    applySort() {
        if (this.currentSort.length === 0) {
            this.resetSort();
            return;
        }

        // Mettre à jour les classes des en-têtes
        this.updateHeaderClasses();

        // Trier les lignes
        const rows = Array.from(this.context.getRows());
        const sortedRows = this.sortRows(rows);

        // Réorganiser les lignes dans le tableau
        const tbody = rows[0].parentNode;
        sortedRows.forEach(row => tbody.appendChild(row));
    }

    sortRows(rows) {
        return rows.sort((rowA, rowB) => {
            for (const sort of this.currentSort) {
                const result = this.compareRows(rowA, rowB, sort);
                if (result !== 0) {
                    return sort.direction === 'asc' ? result : -result;
                }
            }
            return 0;
        });
    }

    compareRows(rowA, rowB, sort) {
        const columnIndex = this.getColumnIndex(sort.column);
        const cellA = rowA.cells[columnIndex];
        const cellB = rowB.cells[columnIndex];
        
        // Utiliser un comparateur personnalisé s'il existe
        if (this.config.customSorts[sort.column]) {
            return this.config.customSorts[sort.column](cellA, cellB);
        }

        // Détecter le type de données
        const valueA = this.getCellValue(cellA);
        const valueB = this.getCellValue(cellB);
        
        if (this.isNumeric(valueA) && this.isNumeric(valueB)) {
            return parseFloat(valueA) - parseFloat(valueB);
        }
        
        if (this.isDate(valueA) && this.isDate(valueB)) {
            return new Date(valueA) - new Date(valueB);
        }
        
        return valueA.localeCompare(valueB);
    }

    getCellValue(cell) {
        return cell.getAttribute('data-sort-value') || 
               cell.textContent.trim();
    }

    isNumeric(value) {
        return !isNaN(parseFloat(value)) && isFinite(value);
    }

    isDate(value) {
        const date = new Date(value);
        return date instanceof Date && !isNaN(date);
    }

    getColumnIndex(columnId) {
        const headers = this.context.getHeaders();
        return Array.from(headers).findIndex(header => header.id === columnId);
    }

    updateHeaderClasses() {
        // Réinitialiser toutes les classes de tri
        const headers = this.context.getHeaders();
        headers.forEach(header => {
            header.classList.remove(this.config.ascClass, this.config.descClass);
        });

        // Appliquer les classes pour le tri actuel
        this.currentSort.forEach(sort => {
            const header = this.context.getColumnById(sort.column);
            if (header) {
                header.classList.add(
                    sort.direction === 'asc' ? 
                    this.config.ascClass : 
                    this.config.descClass
                );
            }
        });
    }

    resetSort() {
        // Réinitialiser les classes des en-têtes
        const headers = this.context.getHeaders();
        headers.forEach(header => {
            header.classList.remove(this.config.ascClass, this.config.descClass);
        });

        // Restaurer l'ordre initial des lignes
        const rows = Array.from(this.context.getRows());
        rows.sort((a, b) => {
            return parseInt(a.dataset.initialIndex || '0') - 
                   parseInt(b.dataset.initialIndex || '0');
        });

        // Réorganiser les lignes
        const tbody = rows[0].parentNode;
        rows.forEach(row => tbody.appendChild(row));
    }

    refresh() {
        if (this.currentSort.length > 0) {
            this.applySort();
        }
    }

    destroy() {
        // Réinitialiser le tri
        this.currentSort = [];
        this.resetSort();
        
        // Nettoyer les en-têtes
        const headers = this.context.getHeaders();
        headers.forEach(header => {
            const icon = header.querySelector(`.${this.config.sortIconClass}`);
            if (icon) {
                icon.remove();
            }
            header.classList.remove(
                this.config.sortableClass,
                this.config.ascClass,
                this.config.descClass
            );
        });
        
        this.context = null;
    }
}

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.SortPlugin = SortPlugin;
}
