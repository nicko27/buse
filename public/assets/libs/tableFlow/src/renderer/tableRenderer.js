export class TableRenderer {
    constructor(options = {}) {
        this.options = {
            virtualScroll: true,
            batchSize: 50,
            rowHeight: 40,
            bufferSize: 5,
            ...options
        };

        this.table = null;
        this.container = null;
        this.visibleRows = new Set();
        this.rowCache = new Map();
        this.scrollTop = 0;
        this.viewportHeight = 0;
        this.totalHeight = 0;
        this.scrollHandler = this.handleScroll.bind(this);
    }

    /**
     * Initialise le rendu de la table
     * @param {HTMLTableElement} table - Table à rendre
     * @param {HTMLElement} container - Conteneur de la table
     */
    init(table, container) {
        this.table = table;
        this.container = container;
        this.viewportHeight = container.clientHeight;
        this.totalHeight = this.calculateTotalHeight();

        if (this.options.virtualScroll) {
            this.setupVirtualScroll();
        }

        this.renderInitialRows();
    }

    /**
     * Configure le défilement virtuel
     */
    setupVirtualScroll() {
        this.container.style.overflow = 'auto';
        this.container.style.position = 'relative';
        this.container.addEventListener('scroll', this.scrollHandler);

        // Créer le conteneur virtuel
        const virtualContainer = document.createElement('div');
        virtualContainer.style.position = 'absolute';
        virtualContainer.style.top = '0';
        virtualContainer.style.left = '0';
        virtualContainer.style.width = '100%';
        virtualContainer.style.height = `${this.totalHeight}px`;
        this.container.appendChild(virtualContainer);
    }

    /**
     * Calcule la hauteur totale de la table
     * @returns {number} Hauteur totale
     */
    calculateTotalHeight() {
        return this.table.rows.length * this.options.rowHeight;
    }

    /**
     * Rend les lignes initiales
     */
    renderInitialRows() {
        const startIndex = 0;
        const endIndex = Math.min(
            this.table.rows.length,
            Math.ceil(this.viewportHeight / this.options.rowHeight) + this.options.bufferSize
        );

        this.renderRows(startIndex, endIndex);
    }

    /**
     * Gère le défilement
     */
    handleScroll() {
        this.scrollTop = this.container.scrollTop;
        this.updateVisibleRows();
    }

    /**
     * Met à jour les lignes visibles
     */
    updateVisibleRows() {
        const startIndex = Math.floor(this.scrollTop / this.options.rowHeight);
        const endIndex = Math.min(
            this.table.rows.length,
            startIndex + Math.ceil(this.viewportHeight / this.options.rowHeight) + this.options.bufferSize
        );

        // Supprimer les lignes non visibles
        for (const rowIndex of this.visibleRows) {
            if (rowIndex < startIndex || rowIndex >= endIndex) {
                this.removeRow(rowIndex);
            }
        }

        // Ajouter les nouvelles lignes visibles
        this.renderRows(startIndex, endIndex);
    }

    /**
     * Rend un ensemble de lignes
     * @param {number} startIndex - Index de début
     * @param {number} endIndex - Index de fin
     */
    renderRows(startIndex, endIndex) {
        for (let i = startIndex; i < endIndex; i++) {
            if (!this.visibleRows.has(i)) {
                this.renderRow(i);
            }
        }
    }

    /**
     * Rend une ligne spécifique
     * @param {number} index - Index de la ligne
     */
    renderRow(index) {
        const row = this.table.rows[index];
        if (!row) return;

        // Mettre en cache la ligne
        if (!this.rowCache.has(index)) {
            this.rowCache.set(index, row.cloneNode(true));
        }

        // Positionner la ligne
        row.style.position = 'absolute';
        row.style.top = `${index * this.options.rowHeight}px`;
        row.style.left = '0';
        row.style.width = '100%';

        this.visibleRows.add(index);
    }

    /**
     * Supprime une ligne
     * @param {number} index - Index de la ligne
     */
    removeRow(index) {
        const row = this.table.rows[index];
        if (row) {
            row.style.display = 'none';
        }
        this.visibleRows.delete(index);
    }

    /**
     * Met à jour une ligne
     * @param {number} index - Index de la ligne
     * @param {Object} data - Données de la ligne
     */
    updateRow(index, data) {
        const row = this.table.rows[index];
        if (!row) return;

        // Mettre à jour les cellules
        for (const [key, value] of Object.entries(data)) {
            const cell = row.querySelector(`[data-field="${key}"]`);
            if (cell) {
                cell.textContent = value;
            }
        }

        // Mettre à jour le cache
        if (this.rowCache.has(index)) {
            this.rowCache.set(index, row.cloneNode(true));
        }
    }

    /**
     * Nettoie le rendu de la table
     */
    destroy() {
        this.container.removeEventListener('scroll', this.scrollHandler);
        this.visibleRows.clear();
        this.rowCache.clear();
        this.table = null;
        this.container = null;
    }
} 