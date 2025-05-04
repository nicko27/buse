/**
 * Plugin de filtrage pour TableFlow
 * Gère le filtrage des données du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { config } from './config.js';

export class FilterPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = config.type;
        this.dependencies = config.dependencies;

        this.filters = new Map();
        this.filterInputs = new Map();
    }

    /**
     * Initialise le plugin
     * @returns {Promise<void>}
     */
    async init() {
        if (!this.tableFlow) {
            throw new Error('TableFlow instance is required');
        }

        this.createFilterUI();
        this.setupEventListeners();
        this.initialized = true;
    }

    /**
     * Crée l'interface de filtrage
     */
    createFilterUI() {
        const container = document.createElement('div');
        container.className = this.config.classes.container;

        // Créer les champs de filtrage pour chaque colonne
        const headers = this.tableFlow.table.tHead.rows[0].cells;
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            const filterInput = this.createFilterInput(i);
            this.filterInputs.set(i, filterInput);
            container.appendChild(filterInput);
        }

        // Ajouter au DOM
        this.tableFlow.table.parentNode.insertBefore(container, this.tableFlow.table);
    }

    /**
     * Crée un champ de filtrage
     * @param {number} columnIndex - Index de la colonne
     * @returns {HTMLInputElement}
     */
    createFilterInput(columnIndex) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = this.config.classes.filterInput;
        input.placeholder = this.config.messages.filterPlaceholder;
        input.dataset.columnIndex = columnIndex;
        return input;
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        this.filterInputs.forEach((input, columnIndex) => {
            input.addEventListener('input', () => {
                this.applyFilter(columnIndex, input.value);
            });
        });
    }

    /**
     * Applique un filtre à une colonne
     * @param {number} columnIndex - Index de la colonne
     * @param {string} value - Valeur du filtre
     */
    applyFilter(columnIndex, value) {
        this.filters.set(columnIndex, value);
        this.filterRows();
    }

    /**
     * Filtre les lignes du tableau
     */
    filterRows() {
        const rows = Array.from(this.tableFlow.table.tBodies[0].rows);
        rows.forEach(row => {
            let shouldShow = true;

            // Vérifier chaque filtre
            this.filters.forEach((filterValue, columnIndex) => {
                if (filterValue) {
                    const cellValue = row.cells[columnIndex].textContent.toLowerCase();
                    const searchValue = filterValue.toLowerCase();
                    shouldShow = shouldShow && cellValue.includes(searchValue);
                }
            });

            // Afficher/masquer la ligne
            row.style.display = shouldShow ? '' : 'none';
        });

        // Émettre l'événement
        this.tableFlow.emit('filter:changed', {
            filters: Array.from(this.filters.entries())
        });
    }

    /**
     * Réinitialise tous les filtres
     */
    resetFilters() {
        this.filters.clear();
        this.filterInputs.forEach(input => {
            input.value = '';
        });
        this.filterRows();
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        super.destroy();
        this.filters.clear();
        this.filterInputs.clear();
    }
} 
