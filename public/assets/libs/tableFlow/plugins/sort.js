(function() {
    if (typeof window.sortPlugin === 'undefined') {
        window.sortPlugin = class sortplugin {
            constructor(config = {}) {
                this.options = {
                    sortableAttribute: 'th-sort',
                    showIcons: true,
                    icons: {
                        asc: '<i class="fa fa-sort-asc"></i>',
                        desc: '<i class="fa fa-sort-desc"></i>',
                        none: '<i class="fa fa-sort"></i>'
                    },
                    ignoreCase: true,
                    ...config
                };
                
                this.table = null;
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
                indicator.innerHTML = this.options.icons.none;
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
                        h.classList.remove('asc', 'desc');
                        const indicator = h.querySelector('.sort-indicator');
                        if (indicator) {
                            indicator.innerHTML = this.options.icons.none;
                        }
                    }
                });

                // Mettre à jour l'en-tête actuel
                header.setAttribute('data-sort-direction', newDirection);
                header.classList.remove('asc', 'desc');
                
                // Mettre à jour l'indicateur
                const indicator = header.querySelector('.sort-indicator');
                if (indicator) {
                    indicator.innerHTML = this.options.icons[newDirection] || this.options.icons.none;
                }

                if (newDirection !== 'none') {
                    header.classList.add(newDirection);
                    this.sortColumn(columnIndex, newDirection);
                } else {
                    this.resetSort();
                }

                // Mettre à jour l'état interne
                this.currentSortColumn = newDirection !== 'none' ? columnIndex : null;
                this.currentDirection = newDirection;
            }

            normalizeString(str) {
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            }

            sortColumn(columnIndex, direction) {
                if (!this.table || typeof columnIndex !== 'number') return;

                const allRows = this.table.getAllRows();
                if (!allRows || !allRows.length) return;

                const header = this.table.getHeaderCell(columnIndex);
                if (!header) return;

                // Préparer les données pour le tri
                const rowsWithData = allRows.map(row => {
                    const cell = row.cells[columnIndex];
                    let value = cell ? cell.textContent.trim() : '';
                    
                    // Debug
                    console.log('Raw value for row', row.id, ':', value);
                    
                    return [row, value];
                });

                // Tri avec gestion spéciale des colonnes
                rowsWithData.sort(([, a], [, b]) => {
                    if (a === b) return 0;
                    return direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
                });

                // Réorganiser les lignes
                const tbody = this.table.table.querySelector('tbody');
                if (!tbody) return;

                const fragment = document.createDocumentFragment();
                rowsWithData.forEach(([row]) => fragment.appendChild(row));
                tbody.innerHTML = '';
                tbody.appendChild(fragment);

                this.table.table.dispatchEvent(new CustomEvent('sortAppened', {
                    detail: { column: columnIndex, direction },
                    bubbles: true
                }));
            }

            resetSort() {
                if (!this.table) {
                    console.error('[SortPlugin] Table not available');
                    return;
                }

                const allRows = this.table.getAllRows();
                if (!allRows || !allRows.length) {
                    console.error('[SortPlugin] No rows to reset');
                    return;
                }

                // Trier par l'index original
                const rowsWithIndices = allRows.map(row => {
                    const index = parseInt(row.getAttribute('data-original-index') || '0', 10);
                    return [row, index];
                });

                rowsWithIndices.sort(([, indexA], [, indexB]) => indexA - indexB);

                // Réorganiser les lignes dans le DOM en utilisant un fragment
                const tbody = this.table.table.querySelector('tbody');
                if (!tbody) {
                    console.error('[SortPlugin] Table body not found');
                    return;
                }

                const fragment = document.createDocumentFragment();
                rowsWithIndices.forEach(([row]) => {
                    fragment.appendChild(row);
                });
                tbody.innerHTML = '';
                tbody.appendChild(fragment);

                // Réinitialiser les en-têtes
                const headers = this.table.table.querySelectorAll(`th[${this.options.sortableAttribute}]`);
                headers.forEach(header => {
                    header.setAttribute('data-sort-direction', 'none');
                    header.classList.remove('asc', 'desc');
                    const indicator = header.querySelector('.sort-indicator');
                    if (indicator) {
                        indicator.innerHTML = this.options.icons.none;
                    }
                });

                // Réinitialiser l'état interne
                this.currentSortColumn = null;
                this.currentDirection = null;

                // Émettre l'événement de réinitialisation
                const event = new CustomEvent('sortAppened', {
                    detail: {
                        column: null,
                        direction: 'none'
                    },
                    bubbles: true
                });
                this.table.table.dispatchEvent(event);
            }

            destroy() {
                if (!this.table?.table) return;

                // Supprimer les gestionnaires d'événements et les indicateurs
                const headers = this.table.table.querySelectorAll(`th[${this.options.sortableAttribute}]`);
                headers.forEach(header => {
                    if (header._sortClickHandler) {
                        header.removeEventListener('click', header._sortClickHandler);
                        delete header._sortClickHandler;
                    }
                    header.removeAttribute('data-sort-initialized');
                    header.removeAttribute('data-sort-direction');
                    header.classList.remove('sortable', 'asc', 'desc');
                    const indicator = header.querySelector('.sort-indicator');
                    if (indicator) {
                        indicator.remove();
                    }
                });

                // Réinitialiser l'état
                this.currentSortColumn = null;
                this.currentDirection = null;
            }

            debug(message, data = null) {
                if (this.table?.options?.debug) {
                    console.log(`[${this.name}] ${message}`, data || '');
                }
            }
        }
    }
})();
