import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';
import { config } from './config.js';

/**
 * Plugin Color pour TableFlow
 * Permet de gérer des cellules avec sélection de couleur
 */
export default class ColorPlugin {
    constructor(config = {}) {
        this.name = 'color';
        this.version = '1.0.0';
        this.type = 'edit';
        this.table = null;
        this.logger = new Logger('ColorPlugin');
        this.eventBus = new EventBus();
        this.config = {
            ...this.getDefaultConfig(),
            ...config
        };
        this.colorHandler = null;
        
        // Lier les méthodes
        this._boundInputHandler = this.handleInput.bind(this);
        this._boundChangeHandler = this.handleChange.bind(this);
        this._boundCellSavedHandler = this.handleCellSaved.bind(this);
        this._boundRowSavedHandler = this.handleRowSaved.bind(this);
        this._boundRowAddedHandler = this.handleRowAdded.bind(this);
        
        this.logger.debug('Plugin créé avec la config:', this.config);
    }

    getDefaultConfig() {
        return {
            colorAttribute: 'th-color',
            cellClass: 'td-color',
            readOnlyClass: 'readonly',
            modifiedClass: 'modified',
            debug: false,
            customClass: ''
        };
    }

    async init(tableFlow) {
        if (!tableFlow) {
            throw new Error('Instance de TableFlow requise');
        }
        
        this.table = tableFlow;
        
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
    }

    setupColorCells() {
        if (!this.table?.table) return;
        
        const headerCells = this.table.table.querySelectorAll('th');
        const colorColumns = Array.from(headerCells)
            .filter(header => header.hasAttribute(this.config.colorAttribute))
            .map(header => ({
                id: header.id,
                index: Array.from(headerCells).indexOf(header)
            }));
            
        if (!colorColumns.length) return;
        
        const rows = this.table.table.querySelectorAll('tbody tr');
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
        if (!this.table?.table) return;
        
        this.table.table.addEventListener('cell:saved', this._boundCellSavedHandler);
        this.table.table.addEventListener('row:saved', this._boundRowSavedHandler);
        this.table.table.addEventListener('row:added', this._boundRowAddedHandler);
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

    updateValue(cell, newValue, triggerChange = false) {
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
            const event = new CustomEvent('cell:change', {
                detail: {
                    cellId: cell.id,
                    columnId: cell.id.split('_')[0],
                    rowId: row?.id,
                    oldValue,
                    newValue,
                    cell
                },
                bubbles: true
            });
            
            this.table.table.dispatchEvent(event);
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

    destroy() {
        if (!this.table?.table) return;
        
        this.table.table.removeEventListener('cell:saved', this._boundCellSavedHandler);
        this.table.table.removeEventListener('row:saved', this._boundRowSavedHandler);
        this.table.table.removeEventListener('row:added', this._boundRowAddedHandler);
        
        const cells = this.table.table.querySelectorAll(`.${this.config.cellClass}`);
        cells.forEach(cell => {
            const input = cell.querySelector('input');
            if (input) {
                input.removeEventListener('input', this._boundInputHandler);
                input.removeEventListener('change', this._boundChangeHandler);
            }
        });
    }
}
