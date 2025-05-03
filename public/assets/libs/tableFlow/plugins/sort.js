export default class SortPlugin {
    constructor(config = {}) {
        this.name = 'sort';
        this.version = '1.2.0';
        this.type = 'sort';
        this.table = null;
        
        // Configuration par défaut
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
            debug: false,
            ...config
        };
        
        // État du tri
        this.currentSortColumn = null;
        this.currentDirection = null;
        this.sortableColumns = new Map();
        this.originalOrder = [];
        
        // Gestionnaires d'événements liés
        this._boundHandlers = new Map();
        
        // Fonction de débogage conditionnelle
        this.debug = this.options.debug ? 
            (...args) => console.log('[SortPlugin]', ...args) : 
            () => {};
    }

    init(tableHandler) {
        this.table = tableHandler;
        this.debug('Initializing...');

        if (!this.table?.table) {
            console.error('[SortPlugin] Table not available');
            return;
        }

        // Stocker les indices originaux
        const rows = this.table.getAllRows();
        rows.forEach((row, index) => {
            row.setAttribute('data-original-index', index.toString());
        });
        
        // Sauvegarder l'ordre original
        this.originalOrder = Array.from(rows);

        // Trouver les en-têtes triables
        const headers = Array.from(this.table.table.querySelectorAll('th'));
        const sortableHeaders = headers.filter(header => header.hasAttribute(this.options.sortableAttribute));
        this.debug('Found sortable headers:', sortableHeaders.length);

        // Créer un mapping des colonnes triables
        this.sortableColumns = new Map();
        sortableHeaders.forEach(header => {
            const columnIndex = Array.from(header.parentElement.children).indexOf(header);
            this.debug('Column', header.id, 'has index', columnIndex);
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
        
        // Ajouter l'indicateur de tri si non présent
        if (!header.querySelector('.sort-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'sort-indicator';
            indicator.innerHTML = this.options.iconNone;
            header.appendChild(indicator);
        }

        // Créer et stocker le gestionnaire d'événements
        const clickHandler = () => this.handleHeaderClick(header, index);
        this._boundHandlers.set(header, clickHandler);
        
        // Ajouter l'écouteur d'événements
        header.addEventListener('click', clickHandler);
        
        // Marquer comme initialisé
        header.setAttribute('data-sort-initialized', 'true');
        header.setAttribute('data-sort-direction', 'none');
        
        this.debug('Sort column initialized:', header.id);
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
            const iconKey = `icon${newDirection.charAt(0).toUpperCase() + newDirection.slice(1)}`;
            indicator.innerHTML = this.options[iconKey];
        }

        // Trier la colonne
        if (newDirection === 'none') {
            this.resetSort();
        } else {
            this.sortColumn(columnIndex, newDirection);
        }

        // Mettre à jour l'état du tri
        this.currentSortColumn = newDirection === 'none' ? null : columnIndex;
        this.currentDirection = newDirection === 'none' ? null : newDirection;

        // Déclencher l'événement de tri avec le nom corrigé
        const event = new CustomEvent('sort:applied', {
            detail: {
                column: header.id || columnIndex,
                direction: newDirection,
                columnIndex: columnIndex
            },
            bubbles: true
        });
        this.table.table.dispatchEvent(event);
        
        // Événement avec l'ancien nom pour la rétrocompatibilité temporaire
        const oldEvent = new CustomEvent('sortAppened', {
            detail: {
                column: header.id || columnIndex,
                direction: newDirection
            },
            bubbles: true
        });
        this.table.table.dispatchEvent(oldEvent);
        
        this.debug('Sort applied:', { column: header.id, direction: newDirection });
    }

    normalizeString(str) {
        if (typeof str !== 'string') return '';
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
            let valueA = cellA.getAttribute('data-sort-value') || cellA.getAttribute('data-value') || cellA.textContent.trim();
            let valueB = cellB.getAttribute('data-sort-value') || cellB.getAttribute('data-value') || cellB.textContent.trim();

            // Gérer les valeurs nulles ou undefined
            if (valueA === null || valueA === undefined) valueA = '';
            if (valueB === null || valueB === undefined) valueB = '';

            // Détecter le type de données
            const numA = parseFloat(valueA);
            const numB = parseFloat(valueB);
            
            // Si les deux valeurs sont numériques
            if (!isNaN(numA) && !isNaN(numB)) {
                return (numA - numB) * multiplier;
            }
            
            // Traitement des dates
            const dateA = new Date(valueA);
            const dateB = new Date(valueB);
            if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
                return (dateA.getTime() - dateB.getTime()) * multiplier;
            }

            // Sinon, comparer comme des chaînes
            valueA = this.normalizeString(valueA.toString());
            valueB = this.normalizeString(valueB.toString());
            
            return valueA.localeCompare(valueB) * multiplier;
        });

        // Réorganiser les lignes
        rows.forEach(row => tbody.appendChild(row));
        
        this.debug('Column sorted:', { columnIndex, direction });
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
        
        this.currentSortColumn = null;
        this.currentDirection = null;
        
        this.debug('Sort reset to original order');
    }

    /**
     * Obtient l'état actuel du tri
     * @returns {Object|null} L'état du tri ou null si aucun tri actif
     */
    getSortState() {
        if (this.currentSortColumn === null) return null;
        
        return {
            columnIndex: this.currentSortColumn,
            direction: this.currentDirection
        };
    }

    /**
     * Applique un tri programmatiquement
     * @param {number} columnIndex - Index de la colonne à trier
     * @param {string} direction - Direction du tri ('asc' ou 'desc')
     */
    sortByColumn(columnIndex, direction = 'asc') {
        if (!['asc', 'desc'].includes(direction)) {
            console.error('[SortPlugin] Invalid sort direction. Use "asc" or "desc"');
            return;
        }
        
        const headers = Array.from(this.table.table.querySelectorAll('th'));
        if (columnIndex < 0 || columnIndex >= headers.length) {
            console.error('[SortPlugin] Invalid column index');
            return;
        }
        
        const header = headers[columnIndex];
        if (!header.hasAttribute(this.options.sortableAttribute)) {
            console.error('[SortPlugin] Column is not sortable');
            return;
        }
        
        // Mettre à jour l'interface
        header.setAttribute('data-sort-direction', direction);
        const indicator = header.querySelector('.sort-indicator');
        if (indicator) {
            const iconKey = `icon${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
            indicator.innerHTML = this.options[iconKey];
        }
        
        // Effectuer le tri
        this.sortColumn(columnIndex, direction);
        
        // Mettre à jour l'état
        this.currentSortColumn = columnIndex;
        this.currentDirection = direction;
        
        // Déclencher l'événement
        const event = new CustomEvent('sort:applied', {
            detail: {
                column: header.id || columnIndex,
                direction: direction,
                columnIndex: columnIndex
            },
            bubbles: true
        });
        this.table.table.dispatchEvent(event);
    }

    destroy() {
        this.debug('Destroying sort plugin...');
        
        // Supprimer les gestionnaires d'événements
        this._boundHandlers.forEach((handler, header) => {
            header.removeEventListener('click', handler);
        });
        this._boundHandlers.clear();

        // Nettoyer les attributs et classes des en-têtes
        if (this.sortableColumns) {
            this.sortableColumns.forEach((columnIndex, header) => {
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
        }

        // Réinitialiser les variables
        this.sortableColumns.clear();
        this.currentSortColumn = null;
        this.currentDirection = null;
        this.originalOrder = [];
        
        this.debug('Sort plugin destroyed');
    }

    /**
     * Rafraîchit le plugin (réinitialise les colonnes triables)
     */
    refresh() {
        this.debug('Refreshing sort plugin...');
        
        // Détruire proprement d'abord
        this.destroy();
        
        // Réinitialiser
        this.init(this.table);
    }
}