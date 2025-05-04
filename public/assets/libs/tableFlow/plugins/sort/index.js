/**
 * Plugin de tri pour TableFlow
 * Gère le tri des colonnes du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class SortPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.SORT;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        // État local
        this.state = {
            sortedColumn: null,
            sortDirection: 'asc',
            sortType: 'string',
            isSorting: false
        };
        
        // Cache pour les performances
        this.cache = {
            sortTimeout: null,
            lastSortTime: 0,
            columnTypes: new Map()
        };
        
        // Lier les méthodes
        this._boundHeaderClickHandler = this.handleHeaderClick.bind(this);
    }
    
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Sort déjà initialisé');
            return;
        }

        try {
            this.logger.info('Initialisation du plugin Sort');
            
            // Ajouter les écouteurs d'événements
            this.setupEventListeners();
            
            // Initialiser les styles
            this.initializeStyles();
            
            // Détecter les types de colonnes
            this.detectColumnTypes();
            
            this.isInitialized = true;
            this.metrics.increment('plugin_sort_init');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_init');
            throw error;
        }
    }
    
    setupEventListeners() {
        try {
            // Événements des en-têtes
            const headers = this.tableFlow.table.querySelectorAll('th');
            headers.forEach(header => {
                header.addEventListener('click', this._boundHeaderClickHandler);
                header.setAttribute('role', 'button');
                header.setAttribute('aria-label', 'Trier par ' + header.textContent);
            });
            
            this.metrics.increment('sort_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_setup_listeners');
        }
    }
    
    initializeStyles() {
        try {
            // Ajouter les styles CSS
            const style = document.createElement('style');
            style.textContent = `
                .${this.config.sortClass} {
                    cursor: pointer;
                    position: relative;
                }
                .${this.config.sortClass}::after {
                    content: '';
                    position: absolute;
                    right: 8px;
                    top: 50%;
                    transform: translateY(-50%);
                    width: 0;
                    height: 0;
                    border-left: 4px solid transparent;
                    border-right: 4px solid transparent;
                }
                .${this.config.sortClass}-asc::after {
                    border-bottom: 4px solid ${this.config.sort.ascColor};
                }
                .${this.config.sortClass}-desc::after {
                    border-top: 4px solid ${this.config.sort.descColor};
                }
            `;
            document.head.appendChild(style);
            
            this.metrics.increment('sort_styles_initialized');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_initialize_styles');
        }
    }
    
    detectColumnTypes() {
        try {
            const headers = this.tableFlow.table.querySelectorAll('th');
            const rows = this.tableFlow.table.querySelectorAll('tbody tr');
            
            headers.forEach((header, index) => {
                const sampleCell = rows[0]?.cells[index];
                if (!sampleCell) return;
                
                const value = sampleCell.textContent.trim();
                let type = 'string';
                
                // Détecter le type de données
                if (!isNaN(value) && value !== '') {
                    type = 'number';
                } else if (this.isDate(value)) {
                    type = 'date';
                }
                
                this.cache.columnTypes.set(index, type);
                header.setAttribute('data-type', type);
            });
            
            this.metrics.increment('sort_column_types_detected');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_detect_column_types');
        }
    }
    
    isDate(value) {
        const date = new Date(value);
        return date instanceof Date && !isNaN(date);
    }
    
    async handleHeaderClick(event) {
        if (!this.isInitialized) return;

        try {
            const header = event.target.closest('th');
            if (!header) return;
            
            const columnIndex = Array.from(header.parentElement.cells).indexOf(header);
            
            // Déclencher le hook beforeSort
            const beforeResult = await this.tableFlow.hooks.trigger('beforeSort', {
                column: columnIndex,
                header,
                event
            });
            
            if (beforeResult === false) return;
            
            // Déterminer la direction de tri
            let direction = 'asc';
            if (this.state.sortedColumn === columnIndex) {
                direction = this.state.sortDirection === 'asc' ? 'desc' : 'asc';
            }
            
            // Mettre à jour l'état
            this.state.sortedColumn = columnIndex;
            this.state.sortDirection = direction;
            this.state.sortType = this.cache.columnTypes.get(columnIndex) || 'string';
            
            // Trier le tableau
            await this.sortTable();
            
            // Mettre à jour les styles
            this.updateHeaderStyles();
            
            this.metrics.increment('sort_header_click');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_handle_header_click');
        }
    }
    
    async sortTable() {
        if (!this.isInitialized) return;

        try {
            this.state.isSorting = true;
            const startTime = performance.now();
            
            const tbody = this.tableFlow.table.querySelector('tbody');
            const rows = Array.from(tbody.rows);
            
            // Trier les lignes
            rows.sort((a, b) => {
                const aValue = a.cells[this.state.sortedColumn].textContent.trim();
                const bValue = b.cells[this.state.sortedColumn].textContent.trim();
                
                return this.compareValues(aValue, bValue);
            });
            
            // Réorganiser le tableau
            if (this.state.sortDirection === 'desc') {
                rows.reverse();
            }
            
            // Mettre à jour le DOM
            rows.forEach(row => tbody.appendChild(row));
            
            // Déclencher le hook afterSort
            await this.tableFlow.hooks.trigger('afterSort', {
                column: this.state.sortedColumn,
                direction: this.state.sortDirection,
                type: this.state.sortType,
                performance: {
                    duration: performance.now() - startTime,
                    rows: rows.length
                }
            });
            
            this.metrics.increment('sort_table');
            this.metrics.record('sort_duration', performance.now() - startTime);
        } catch (error) {
            this.errorHandler.handle(error, 'sort_table');
        } finally {
            this.state.isSorting = false;
        }
    }
    
    compareValues(a, b) {
        try {
            switch (this.state.sortType) {
                case 'number':
                    return Number(a) - Number(b);
                case 'date':
                    return new Date(a) - new Date(b);
                default:
                    return a.localeCompare(b, undefined, { sensitivity: 'base' });
            }
        } catch (error) {
            this.errorHandler.handle(error, 'sort_compare_values');
            return 0;
        }
    }
    
    updateHeaderStyles() {
        try {
            const headers = this.tableFlow.table.querySelectorAll('th');
            
            headers.forEach((header, index) => {
                header.classList.remove(this.config.sortClass, 
                    `${this.config.sortClass}-asc`, 
                    `${this.config.sortClass}-desc`);
                
                if (index === this.state.sortedColumn) {
                    header.classList.add(this.config.sortClass);
                    header.classList.add(`${this.config.sortClass}-${this.state.sortDirection}`);
                }
            });
            
            this.metrics.increment('sort_header_styles_updated');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_update_header_styles');
        }
    }
    
    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            const headers = this.tableFlow.table.querySelectorAll('th');
            headers.forEach(header => {
                header.removeEventListener('click', this._boundHeaderClickHandler);
            });
            
            // Supprimer les styles
            const style = document.querySelector(`style[data-plugin="${this.name}"]`);
            if (style) {
                style.remove();
            }
            
            // Réinitialiser l'état
            this.state = {
                sortedColumn: null,
                sortDirection: 'asc',
                sortType: 'string',
                isSorting: false
            };
            
            this.cache.columnTypes.clear();
            
            this.isInitialized = false;
            this.logger.info('Plugin Sort détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'sort_destroy');
        } finally {
            super.destroy();
        }
    }
}
