export default class SortPlugin {
    constructor(config = {}) {
        this.name = 'sort';
        this.version = '1.1.0';
        this.type = 'sort';
        this.table = null;
        this.options = {
            sortableAttribute: 'th-sort',
            showIcons: true,
            icons: {
                asc: '<i class="fa fa-sort-asc"></i>',
                desc: '<i class="fa fa-sort-desc"></i>',
                none: '<i class="fa fa-sort"></i>'
            },
            iconAsc: '<i class="fa fa-sort-asc"></i>',
            iconDesc: '<i class="fa fa-sort-desc"></i>',
            iconNone: '<i class="fa fa-sort"></i>',
            ignoreCase: true,
            ...config
        };
        
        this.currentSortColumn = null;
        this.currentDirection = null;
        this.sortableColumns = new Map();
        this.originalOrder = [];
    }

    init(tableHandler) {
        this.table = tableHandler;
        console.log('[SortPlugin] Initializing...');

        if (!this.table?.table) {
            console.error('[SortPlugin] Table not available');
            return;
        }

        // Stocker les indices originaux
        const rows = this.table.getAllRows();
        rows.forEach((row, index) => {
            row.setAttribute('data-original-index', index.toString());
        });

        // Trouver les en-têtes triables
        const headers = Array.from(this.table.table.querySelectorAll('th'));
        const sortableHeaders = headers.filter(header => header.hasAttribute(this.options.sortableAttribute));
        console.log('[SortPlugin] Found sortable headers:', sortableHeaders.length);

        // Créer un mapping des colonnes triables
        this.sortableColumns = new Map();
        sortableHeaders.forEach(header => {
            const columnIndex = Array.from(header.parentElement.children).indexOf(header);
            console.log('Column', header.id, 'has index', columnIndex);
            this.sortableColumns.set(header, columnIndex);
            this.setupSortColumn(header, columnIndex);
        });
    }

    setupSortColumn(header, index) {
        if (!header || header.hasAttribute('data-sort-initialized')) {
            return;
        }

        // Ajouter la classe de style
        header.classList.add('sortable');
        
        // Ajouter l'indicateur de tri
        const indicator = document.createElement('span');
        indicator.className = 'sort-indicator';
        indicator.innerHTML = this.options.iconNone;
        header.appendChild(indicator);

        // Gérer le clic
        const clickHandler = () => this.handleHeaderClick(header, index);
        header.addEventListener('click', clickHandler);
        header._sortClickHandler = clickHandler; // Stocker pour pouvoir le retirer plus tard
        
        // Marquer comme initialisé
        header.setAttribute('data-sort-initialized', 'true');
        header.setAttribute('data-sort-direction', 'none');
    }

    handleHeaderClick(header, columnIndex) {
        if (!header || typeof columnIndex !== 'number') {
            console.error('[SortPlugin] Invalid header click parameters');
            return;
        }

        // Déterminer la direction
        const currentDirection = header.getAttribute('data-sort-direction') || 'none';
        let newDirection;
        
        switch (currentDirection) {
            case 'none':
                newDirection = 'asc';
                break;
            case 'asc':
                newDirection = 'desc';
                break;
            default:
                newDirection = 'none';
        }

        // Réinitialiser tous les autres en-têtes
        const allHeaders = this.table.table.querySelectorAll(`th[${this.options.sortableAttribute}]`);
        allHeaders.forEach(h => {
            if (h !== header) {
                h.setAttribute('data-sort-direction', 'none');
                const ind = h.querySelector('.sort-indicator');
                if (ind) ind.innerHTML = this.options.iconNone;
            }
        });

        // Mettre à jour l'indicateur
        header.setAttribute('data-sort-direction', newDirection);
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
            indicator.innerHTML = this.options[`icon${newDirection.charAt(0).toUpperCase() + newDirection.slice(1)}`];
        }

        // Trier la colonne
        if (newDirection === 'none') {
            this.resetSort();
        } else {
            this.sortColumn(columnIndex, newDirection);
        }

        // Déclencher l'événement de tri
        const event = new CustomEvent('sortAppened', {
            detail: {
                column: header.id || columnIndex,
                direction: newDirection
            }
        });
        this.table.table.dispatchEvent(event);
    }

    normalizeString(str) {
        return this.options.ignoreCase ? str.toLowerCase() : str;
    }

    sortColumn(columnIndex, direction) {
        const tbody = this.table.table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.rows);
        const multiplier = direction === 'asc' ? 1 : -1;

        rows.sort((rowA, rowB) => {
            const cellA = rowA.cells[columnIndex];
            const cellB = rowB.cells[columnIndex];
            
            if (!cellA || !cellB) return 0;

            // Obtenir les valeurs à comparer
            let valueA = cellA.getAttribute('data-sort-value') || cellA.textContent.trim();
            let valueB = cellB.getAttribute('data-sort-value') || cellB.textContent.trim();

            // Convertir en nombres si possible
            const numA = parseFloat(valueA);
            const numB = parseFloat(valueB);
            
            if (!isNaN(numA) && !isNaN(numB)) {
                return (numA - numB) * multiplier;
            }

            // Sinon, comparer comme des chaînes
            valueA = this.normalizeString(valueA);
            valueB = this.normalizeString(valueB);
            
            return valueA.localeCompare(valueB) * multiplier;
        });

        // Réorganiser les lignes
        rows.forEach(row => tbody.appendChild(row));
    }

    resetSort() {
        const tbody = this.table.table.querySelector('tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.rows);
        
        // Trier par l'index original
        rows.sort((a, b) => {
            const indexA = parseInt(a.getAttribute('data-original-index') || '0');
            const indexB = parseInt(b.getAttribute('data-original-index') || '0');
            return indexA - indexB;
        });

        // Réorganiser les lignes
        rows.forEach(row => tbody.appendChild(row));

        // Réinitialiser les indicateurs
        const headers = this.table.table.querySelectorAll(`th[${this.options.sortableAttribute}]`);
        headers.forEach(header => {
            header.setAttribute('data-sort-direction', 'none');
            const indicator = header.querySelector('.sort-indicator');
            if (indicator) {
                indicator.innerHTML = this.options.iconNone;
            }
        });
    }

    destroy() {
        // Supprimer les gestionnaires d'événements
        this.sortableColumns.forEach((columnIndex, header) => {
            if (header._sortClickHandler) {
                header.removeEventListener('click', header._sortClickHandler);
                delete header._sortClickHandler;
            }

            // Supprimer l'indicateur
            const indicator = header.querySelector('.sort-indicator');
            if (indicator) {
                indicator.remove();
            }

            // Supprimer les attributs et classes
            header.removeAttribute('data-sort-initialized');
            header.removeAttribute('data-sort-direction');
            header.classList.remove('sortable');
        });

        // Réinitialiser les variables
        this.sortableColumns.clear();
        this.currentSortColumn = null;
        this.currentDirection = null;
    }
}
