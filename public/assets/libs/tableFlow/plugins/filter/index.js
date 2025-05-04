/**
 * Plugin de filtrage pour TableFlow
 * Gère le filtrage des données du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class FilterPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.FILTER;
        this.dependencies = config.dependencies;
        this.isInitialized = false;

        this.filters = new Map();
        this.filterInputs = new Map();
        this.debounceTimer = null;
    }

    /**
     * Initialise le plugin
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Filter déjà initialisé');
            return;
        }

        try {
            if (!this.tableFlow) {
                throw new Error('Instance de TableFlow requise');
            }

            this.createFilterUI();
            this.setupEventListeners();
            this.isInitialized = true;
            this.logger.info('Plugin Filter initialisé avec succès');
            this.metrics.increment('plugin_filter_init');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_init');
            throw error;
        }
    }

    /**
     * Crée l'interface de filtrage
     */
    createFilterUI() {
        try {
            const container = document.createElement('div');
            container.className = this.config.classes.container;
            container.setAttribute('role', 'search');
            container.setAttribute('aria-label', 'Filtres du tableau');

            const headers = this.tableFlow.table.tHead.rows[0].cells;
            for (let i = 0; i < headers.length; i++) {
                const header = headers[i];
                const filterInput = this.createFilterInput(i);
                this.filterInputs.set(i, filterInput);
                container.appendChild(filterInput);
            }

            this.tableFlow.table.parentNode.insertBefore(container, this.tableFlow.table);
            this.metrics.increment('filter_ui_created');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_create_ui');
            this.logger.error('Erreur lors de la création de l\'interface de filtrage:', error);
        }
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
        input.setAttribute('aria-label', `Filtrer la colonne ${columnIndex + 1}`);
        input.setAttribute('role', 'searchbox');
        return input;
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        try {
            this.filterInputs.forEach((input, columnIndex) => {
                input.addEventListener('input', () => {
                    this.debounceFilter(columnIndex, input.value);
                });
            });
            this.metrics.increment('filter_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_setup_listeners');
            this.logger.error('Erreur lors de la configuration des écouteurs d\'événements:', error);
        }
    }

    debounceFilter(columnIndex, value) {
        try {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.debounceTimer = setTimeout(() => {
                this.applyFilter(columnIndex, value);
            }, this.config.filter.debounceTime);
        } catch (error) {
            this.errorHandler.handle(error, 'filter_debounce');
            this.logger.error('Erreur lors du debounce du filtre:', error);
        }
    }

    /**
     * Applique un filtre à une colonne
     * @param {number} columnIndex - Index de la colonne
     * @param {string} value - Valeur du filtre
     */
    async applyFilter(columnIndex, value) {
        try {
            const beforeResult = await this.tableFlow.hooks.trigger('beforeFilter', {
                columnIndex,
                value
            });

            if (beforeResult === false) return;

            this.filters.set(columnIndex, value);
            await this.filterRows();

            await this.tableFlow.hooks.trigger('afterFilter', {
                columnIndex,
                value
            });

            this.metrics.increment('filter_applied');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_apply');
            this.logger.error('Erreur lors de l\'application du filtre:', error);
        }
    }

    /**
     * Filtre les lignes du tableau
     */
    async filterRows() {
        try {
            const rows = Array.from(this.tableFlow.table.tBodies[0].rows);
            let visibleCount = 0;

            rows.forEach(row => {
                let shouldShow = true;

                // Vérifier chaque filtre
                this.filters.forEach((filterValue, columnIndex) => {
                    if (filterValue) {
                        const cellValue = this.config.filter.caseSensitive 
                            ? row.cells[columnIndex].textContent 
                            : row.cells[columnIndex].textContent.toLowerCase();
                        const searchValue = this.config.filter.caseSensitive 
                            ? filterValue 
                            : filterValue.toLowerCase();
                        shouldShow = shouldShow && cellValue.includes(searchValue);
                    }
                });

                // Afficher/masquer la ligne
                row.style.display = shouldShow ? '' : 'none';
                if (shouldShow) visibleCount++;
            });

            await this.tableFlow.hooks.trigger('afterFilterRows', {
                filters: Array.from(this.filters.entries()),
                visibleCount
            });

            // Émettre l'événement
            this.tableFlow.emit('filter:changed', {
                filters: Array.from(this.filters.entries()),
                visibleCount
            });

            this.metrics.increment('rows_filtered');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_rows');
            this.logger.error('Erreur lors du filtrage des lignes:', error);
        }
    }

    /**
     * Réinitialise tous les filtres
     */
    resetFilters() {
        try {
            const beforeResult = this.tableFlow.hooks.trigger('beforeFilterReset');

            if (beforeResult === false) return;

            this.filters.clear();
            this.filterInputs.forEach(input => {
                input.value = '';
            });
            this.filterRows();

            this.tableFlow.hooks.trigger('afterFilterReset');
            this.metrics.increment('filters_reset');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_reset');
            this.logger.error('Erreur lors de la réinitialisation des filtres:', error);
        }
    }

    refresh() {
        if (!this.isInitialized) {
            this.logger.warn('Plugin Filter non initialisé');
            return;
        }

        try {
            const container = this.tableFlow.table.parentNode.querySelector(`.${this.config.classes.container}`);
            if (container) {
                container.remove();
            }
            this.createFilterUI();
            this.metrics.increment('filter_refreshed');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_refresh');
            this.logger.error('Erreur lors du rafraîchissement du filtre:', error);
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (!this.isInitialized) return;

        try {
            if (this.debounceTimer) {
                clearTimeout(this.debounceTimer);
            }

            this.filters.clear();
            this.filterInputs.clear();

            const container = this.tableFlow.table.parentNode.querySelector(`.${this.config.classes.container}`);
            if (container) {
                container.remove();
            }

            this.isInitialized = false;
            this.logger.info('Plugin Filter détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'filter_destroy');
        } finally {
            super.destroy();
        }
    }
} 
