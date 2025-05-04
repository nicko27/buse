import { Logger } from '../utils/logger.js';

export class TableDom {
    constructor(table, config = {}) {
        this.table = table;
        this.config = {
            cellWrapperClass: 'cell-wrapper',
            headWrapperClass: 'head-wrapper',
            ...config
        };
        this.logger = new Logger('TableDom', config);
    }

    // Gestion des wrappers
    initializeWrappers() {
        this.initializeHeaderWrappers();
        this.initializeCellWrappers();
    }

    initializeHeaderWrappers() {
        const headers = this.table.querySelectorAll('thead th');
        headers.forEach(header => {
            if (!header.querySelector(`.${this.config.headWrapperClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.config.headWrapperClass;
                while (header.firstChild) {
                    wrapper.appendChild(header.firstChild);
                }
                header.appendChild(wrapper);
            }
        });
    }

    initializeCellWrappers() {
        const cells = this.table.querySelectorAll('tbody td');
        cells.forEach(cell => {
            if (!cell.querySelector(`.${this.config.cellWrapperClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.config.cellWrapperClass;
                while (cell.firstChild) {
                    wrapper.appendChild(cell.firstChild);
                }
                cell.appendChild(wrapper);
            }
        });
    }

    // Manipulation des cellules
    getCellValue(cell) {
        return cell.getAttribute('data-value') || 
               cell.querySelector(`.${this.config.cellWrapperClass}`)?.textContent.trim() || 
               cell.textContent.trim();
    }

    setCellValue(cell, value) {
        const wrapper = cell.querySelector(`.${this.config.cellWrapperClass}`);
        if (wrapper) {
            wrapper.textContent = value;
        } else {
            cell.textContent = value;
        }
        cell.setAttribute('data-value', value);
    }

    // Manipulation des lignes
    createRow(data = {}, headers) {
        const row = document.createElement('tr');
        const rowId = `row-${Date.now()}`;
        row.id = rowId;
        row.setAttribute('role', 'row');
        row.setAttribute('aria-rowindex', this.getRowIndex());

        headers.forEach((header, index) => {
            const cell = document.createElement('td');
            const columnId = header.id;
            cell.id = `${columnId}_${rowId}`;
            cell.setAttribute('role', 'cell');
            cell.setAttribute('aria-colindex', index + 1);
            cell.setAttribute('aria-describedby', columnId);

            const wrapper = document.createElement('div');
            wrapper.className = this.config.cellWrapperClass;
            wrapper.setAttribute('role', 'text');

            let displayValue = '';
            if (Array.isArray(data) && data[index] !== undefined) {
                displayValue = data[index];
            } else if (!Array.isArray(data) && columnId && data[columnId] !== undefined) {
                displayValue = data[columnId];
            } else {
                displayValue = header.getAttribute('th-text-default') || '';
            }

            wrapper.textContent = displayValue;
            cell.appendChild(wrapper);
            cell.setAttribute('data-value', displayValue);
            cell.setAttribute('data-initial-value', displayValue);
            
            row.appendChild(cell);
        });

        return row;
    }

    getRowIndex() {
        const rows = this.table.querySelectorAll('tbody tr');
        return rows.length + 1;
    }

    removeRow(row) {
        if (row && row.parentNode) {
            row.parentNode.removeChild(row);
            return true;
        }
        return false;
    }

    // Gestion des classes
    addRowClass(row, className) {
        if (row && className) {
            row.classList.add(className);
        }
    }

    removeRowClass(row, className) {
        if (row && className) {
            row.classList.remove(className);
        }
    }

    // Sélecteurs utiles
    getAllRows() {
        return Array.from(this.table.querySelectorAll('tbody tr'));
    }

    getVisibleRows() {
        return this.getAllRows().filter(row => 
            !row.classList.contains('filtered') && 
            row.style.display !== 'none'
        );
    }

    getHeaderCell(columnIndex) {
        const headerRow = this.table.querySelector('thead tr');
        return headerRow ? headerRow.children[columnIndex] : null;
    }

    // Gestion des attributs
    setRowAttribute(row, attribute, value) {
        if (row) {
            if (value === null) {
                row.removeAttribute(attribute);
            } else {
                row.setAttribute(attribute, value);
            }
        }
    }

    getRowAttribute(row, attribute) {
        return row ? row.getAttribute(attribute) : null;
    }

    // Validation
    isEditable() {
        return !this.table.hasAttribute('th-readonly');
    }

    // Nettoyage
    destroy() {
        // Supprimer les wrappers si nécessaire
        if (this.config.removeWrappersOnDestroy) {
            this.removeAllWrappers();
        }
    }

    removeAllWrappers() {
        const removeWrapper = (element, wrapperClass) => {
            const wrapper = element.querySelector(`.${wrapperClass}`);
            if (wrapper) {
                while (wrapper.firstChild) {
                    element.appendChild(wrapper.firstChild);
                }
                wrapper.remove();
            }
        };

        this.table.querySelectorAll('th').forEach(header => 
            removeWrapper(header, this.config.headWrapperClass)
        );

        this.table.querySelectorAll('td').forEach(cell => 
            removeWrapper(cell, this.config.cellWrapperClass)
        );
    }
} 