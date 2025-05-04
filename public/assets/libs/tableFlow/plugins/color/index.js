import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

/**
 * Plugin Color pour TableFlow
 * Permet de gérer des cellules avec sélection de couleur
 */
export class ColorPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.EDIT;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        // Lier les méthodes
        this._boundInputHandler = this.handleInput.bind(this);
        this._boundChangeHandler = this.handleChange.bind(this);
        this._boundCellSavedHandler = this.handleCellSaved.bind(this);
        this._boundRowSavedHandler = this.handleRowSaved.bind(this);
        this._boundRowAddedHandler = this.handleRowAdded.bind(this);
    }

    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Color déjà initialisé');
            return;
        }

        try {
            // Vérifier si ColorFlow est disponible
            if (typeof ColorFlow === 'undefined') {
                throw new Error('ColorFlow est requis pour ce plugin');
            }
            
            // Initialiser ColorFlow
            this.colorHandler = new ColorFlow({
                customClass: this.config.customClass
            });
            
            this.setupColorCells();
            this.setupEventListeners();
            this.isInitialized = true;
            this.logger.info('Plugin Color initialisé avec succès');
        } catch (error) {
            this.errorHandler.handle(error, 'color_init');
            throw error;
        }
    }

    setupColorCells() {
        if (!this.tableFlow?.table) return;
        
        const headerCells = this.tableFlow.table.querySelectorAll('th');
        const colorColumns = Array.from(headerCells)
            .filter(header => header.hasAttribute(this.config.colorAttribute))
            .map(header => ({
                id: header.id,
                index: Array.from(headerCells).indexOf(header)
            }));
            
        if (!colorColumns.length) return;
        
        const rows = this.tableFlow.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            colorColumns.forEach(({id: columnId, index}) => {
                const cell = row.cells[index];
                if (!cell) return;
                
                if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'color') {
                    return;
                }
                
                this.setupColorCell(cell);
            });
        });
    }

    setupColorCell(cell) {
        cell.classList.add(this.config.cellClass);
        cell.setAttribute('data-plugin', 'color');
        
        let currentValue = cell.getAttribute('data-value');
        if (!currentValue) {
            currentValue = this.toHexColor(cell.textContent.trim()) || '#000000';
            cell.setAttribute('data-value', currentValue);
        }
        
        if (!cell.hasAttribute('data-initial-value')) {
            cell.setAttribute('data-initial-value', currentValue);
        }
        
        const wrapper = document.createElement('div');
        wrapper.className = 'tf-color-wrapper';
        wrapper.setAttribute('data-wrapper', 'color');
        
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'color-input';
        input.value = currentValue;
        input.setAttribute('cf-format', 'hex');
        
        wrapper.appendChild(input);
        cell.textContent = '';
        cell.appendChild(wrapper);
        
        // Attendre que le DOM soit prêt
        setTimeout(() => {
            this.colorHandler.setupInput(input);
            
            input.addEventListener('input', this._boundInputHandler);
            input.addEventListener('change', this._boundChangeHandler);
        }, 0);
    }

    setupEventListeners() {
        if (!this.tableFlow?.table) return;
        
        this.tableFlow.table.addEventListener('cell:saved', this._boundCellSavedHandler);
        this.tableFlow.table.addEventListener('row:saved', this._boundRowSavedHandler);
        this.tableFlow.table.addEventListener('row:added', this._boundRowAddedHandler);
    }

    handleInput(event) {
        const input = event.target;
        const cell = input.closest('td');
        if (!cell || !this.isManagedCell(cell)) return;
        
        this.updateValue(cell, input.value);
    }

    handleChange(event) {
        const input = event.target;
        const cell = input.closest('td');
        if (!cell || !this.isManagedCell(cell)) return;
        
        this.updateValue(cell, input.value, true);
    }

    async updateValue(cell, newValue, triggerChange = false) {
        try {
            const beforeResult = await this.tableFlow.hooks.trigger('beforeColorUpdate', {
                cell,
                newValue
            });

            if (beforeResult === false) return;

            const oldValue = cell.getAttribute('data-value');
            if (oldValue === newValue) return;
            
            cell.setAttribute('data-value', newValue);
            
            const preview = cell.querySelector('.color-preview');
            if (preview) {
                preview.style.backgroundColor = newValue;
            }
            
            const row = cell.closest('tr');
            if (row) {
                const isModified = newValue !== cell.getAttribute('data-initial-value');
                row.classList.toggle(this.config.modifiedClass, isModified);
            }
            
            if (triggerChange) {
                this.tableFlow.emit('color:updated', {
                    cell,
                    oldValue,
                    newValue,
                    columnId: cell.id.split('_')[0],
                    rowId: row?.id
                });
            }

            await this.tableFlow.hooks.trigger('afterColorUpdate', {
                cell,
                newValue
            });

            this.metrics.increment('color_updated');
        } catch (error) {
            this.errorHandler.handle(error, 'color_update');
            this.logger.error('Erreur lors de la mise à jour de la couleur:', error);
        }
    }

    handleCellSaved(event) {
        const cell = event.detail.cell;
        if (!cell || !this.isManagedCell(cell)) return;
        
        const currentValue = cell.getAttribute('data-value');
        cell.setAttribute('data-initial-value', currentValue);
    }

    handleRowSaved(event) {
        const row = event.detail.row;
        if (!row) return;
        
        Array.from(row.cells)
            .filter(cell => this.isManagedCell(cell))
            .forEach(cell => {
                const currentValue = cell.getAttribute('data-value');
                cell.setAttribute('data-initial-value', currentValue);
            });
    }

    handleRowAdded(event) {
        const row = event.detail.row;
        if (!row) return;
        
        this.setupColorCells();
    }

    isManagedCell(cell) {
        return cell && cell.getAttribute('data-plugin') === 'color';
    }

    toHexColor(color) {
        if (!color) return null;
        
        // Créer un élément temporaire pour obtenir la couleur calculée
        const temp = document.createElement('div');
        temp.style.color = color;
        temp.style.display = 'none';
        document.body.appendChild(temp);
        
        // Obtenir la couleur calculée
        const computed = window.getComputedStyle(temp).color;
        document.body.removeChild(temp);
        
        // Convertir RGB en HEX
        const rgb = computed.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (rgb) {
            const [_, r, g, b] = rgb;
            return `#${[r, g, b].map(x => parseInt(x).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
        }
        
        return null;
    }

    refresh() {
        if (!this.isInitialized) {
            this.logger.warn('Plugin Color non initialisé');
            return;
        }
        this.setupColorCells();
    }

    destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            if (this.tableFlow?.table) {
                this.tableFlow.table.removeEventListener('cell:saved', this._boundCellSavedHandler);
                this.tableFlow.table.removeEventListener('row:saved', this._boundRowSavedHandler);
                this.tableFlow.table.removeEventListener('row:added', this._boundRowAddedHandler);
            }
            
            // Nettoyer les cellules
            const cells = this.tableFlow.table.querySelectorAll(`.${this.config.cellClass}`);
            cells.forEach(cell => {
                const input = cell.querySelector('input');
                if (input) {
                    input.removeEventListener('input', this._boundInputHandler);
                    input.removeEventListener('change', this._boundChangeHandler);
                }
            });
            
            this.isInitialized = false;
            this.logger.info('Plugin Color détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'color_destroy');
        } finally {
            super.destroy();
        }
    }
}
