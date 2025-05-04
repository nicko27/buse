/**
 * Plugin de tri pour TableFlow
 * Gère le tri des colonnes du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { config } from './config.js';

export class SortPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = config.type;
        this.dependencies = config.dependencies;

        this.sortedColumn = null;
        this.sortDirection = null;
        this.sortFunctions = new Map();
    }

    /**
     * Initialise le plugin
     * @returns {Promise<void>}
     */
    async init() {
        if (!this.tableFlow) {
            throw new Error('TableFlow instance is required');
        }

        this.setupEventListeners();
        this.initialized = true;
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        this.tableFlow.table.addEventListener('click', this.handleHeaderClick.bind(this));
    }

    /**
     * Gère le clic sur un en-tête de colonne
     * @param {MouseEvent} event
     */
    handleHeaderClick(event) {
        const header = event.target.closest('th');
        if (!header) return;

        const columnIndex = Array.from(header.parentElement.children).indexOf(header);
        this.sortColumn(columnIndex);
    }

    /**
     * Trie une colonne
     * @param {number} columnIndex - Index de la colonne
     */
    sortColumn(columnIndex) {
        // Déterminer la direction du tri
        if (this.sortedColumn === columnIndex) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortedColumn = columnIndex;
            this.sortDirection = 'asc';
        }

        // Récupérer les données
        const rows = Array.from(this.tableFlow.table.tBodies[0].rows);
        const header = this.tableFlow.table.tHead.rows[0].cells[columnIndex];

        // Appliquer les classes CSS
        this.updateHeaderClasses(header);

        // Trier les données
        const sortFunction = this.getSortFunction(columnIndex);
        rows.sort((a, b) => {
            const aValue = a.cells[columnIndex].textContent;
            const bValue = b.cells[columnIndex].textContent;
            return sortFunction(aValue, bValue) * (this.sortDirection === 'asc' ? 1 : -1);
        });

        // Réorganiser les lignes
        const tbody = this.tableFlow.table.tBodies[0];
        rows.forEach(row => tbody.appendChild(row));

        // Émettre l'événement
        this.tableFlow.emit('sort:changed', {
            columnIndex,
            direction: this.sortDirection
        });
    }

    /**
     * Met à jour les classes CSS de l'en-tête
     * @param {HTMLTableCellElement} header - Cellule d'en-tête
     */
    updateHeaderClasses(header) {
        // Supprimer les classes existantes
        header.classList.remove('sort-asc', 'sort-desc');

        // Ajouter la nouvelle classe
        if (this.sortDirection) {
            header.classList.add(`sort-${this.sortDirection}`);
        }
    }

    /**
     * Obtient la fonction de tri pour une colonne
     * @param {number} columnIndex - Index de la colonne
     * @returns {Function}
     */
    getSortFunction(columnIndex) {
        if (this.sortFunctions.has(columnIndex)) {
            return this.sortFunctions.get(columnIndex);
        }

        // Fonction de tri par défaut
        return (a, b) => {
            if (a === b) return 0;
            return a < b ? -1 : 1;
        };
    }

    /**
     * Définit une fonction de tri personnalisée
     * @param {number} columnIndex - Index de la colonne
     * @param {Function} sortFunction - Fonction de tri
     */
    setSortFunction(columnIndex, sortFunction) {
        this.sortFunctions.set(columnIndex, sortFunction);
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        super.destroy();
        this.sortFunctions.clear();
    }
}
