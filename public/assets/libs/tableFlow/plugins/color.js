/**
 * Plugin Color pour NvTblHandler
 * Permet de gérer des cellules avec sélection de couleur
 */
(function() {
    if (typeof window.colorPlugin === 'undefined') {
        window.colorPlugin = class colorplugin {
            constructor(options = {}) {
                this.name = 'color';
                this.version = '1.0.0';
                this.type = 'edit';
                this.table = null;
                this.config = { ...this.getDefaultConfig(), ...options };
                this.colorHandler = null;
                
                this.debug('Plugin créé avec la config:', this.config);
            }

            getDefaultConfig() {
                return {
                    colorAttribute: 'th-color',
                    cellClass: 'td-color',
                    readOnlyClass: 'readonly',
                    modifiedClass: 'modified',
                    debug: false
                };
            }

            debug(message, data = null) {
                if (this.config.debug) {
                    if (data) {
                        console.log('[ColorPlugin]', message, data);
                    } else {
                        console.log('[ColorPlugin]', message);
                    }
                }
            }

            init(tableHandler) {
                if (!tableHandler) {
                    throw new Error('TableHandler instance is required');
                }
                this.table = tableHandler;
                this.debug('Initializing color plugin');

                this.colorHandler = new ColorFlow({
                    customClass: this.config.customClass
                });

                this.setupColorCells();
                this.setupEventListeners();
            }

            setupColorCells() {
                if (!this.table || !this.table.table) return;

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

                setTimeout(() => {
                    if (this.colorHandler) {
                        this.colorHandler.setupInput(input);
                        
                        // Fonction de mise à jour de la valeur
                        const updateValue = () => {
                            const oldValue = cell.getAttribute('data-value');
                            const newValue = input.value.toUpperCase();

                            // Ne rien faire si la valeur n'a pas changé
                            if (oldValue === newValue) return;

                            // Mettre à jour la valeur
                            cell.setAttribute('data-value', newValue);

                            // Mettre à jour la preview
                            const preview = input.previousElementSibling;
                            if (preview && preview.classList.contains('color-preview')) {
                                preview.style.backgroundColor = newValue;
                            }

                            // Marquer la ligne comme modifiée si la valeur a changé
                            const row = cell.closest('tr');
                            if (row && newValue !== cell.getAttribute('data-initial-value')) {
                                row.classList.add(this.config.modifiedClass);
                            }

                            // Déclencher l'événement de changement
                            const changeEvent = new CustomEvent('cell:change', {
                                detail: {
                                    cellId: cell.id,
                                    columnId: cell.id.split('_')[0],
                                    rowId: row.id,
                                    oldValue: oldValue,
                                    newValue: newValue,
                                    cell: cell
                                },
                                bubbles: true
                            });
                            cell.dispatchEvent(changeEvent);
                        };

                        // Écouter les deux types de changements
                        input.addEventListener('input', updateValue);
                        input.addEventListener('change', updateValue);
                    }
                }, 0);
            }

            setupEventListeners() {
                if (!this.table || !this.table.table) return;

                // Écouter l'événement cell:saved
                this.table.table.addEventListener('cell:saved', (event) => {
                    const cell = event.detail.cell;
                    if (!cell || !this.isManagedCell(cell)) return;

                    const input = cell.querySelector('input.color-input');
                    if (input) {
                        const currentValue = input.value;
                        cell.setAttribute('data-initial-value', currentValue);
                        cell.setAttribute('data-value', currentValue);
                    }
                });

                // Écouter l'événement row:saved
                this.table.table.addEventListener('row:saved', (event) => {
                    const row = event.detail.row;
                    if (!row) return;

                    Array.from(row.cells).forEach(cell => {
                        if (!this.isManagedCell(cell)) return;

                        const input = cell.querySelector('input.color-input');
                        if (input) {
                            const currentValue = input.value;
                            cell.setAttribute('data-initial-value', currentValue);
                            cell.setAttribute('data-value', currentValue);
                        }
                    });

                    row.classList.remove(this.config.modifiedClass);
                });

                // Écouter l'ajout de nouvelles lignes
                this.table.table.addEventListener('row:added', () => {
                    this.debug('row:added event received');
                    this.setupColorCells();
                });
            }

            isManagedCell(cell) {
                return cell && cell.getAttribute('data-plugin') === 'color';
            }

            toHexColor(color) {
                if (!color) return '#000000';
                
                if (color.startsWith('#')) {
                    return color.toUpperCase();
                }

                const temp = document.createElement('div');
                temp.style.color = color;
                document.body.appendChild(temp);
                const computedColor = window.getComputedStyle(temp).color;
                document.body.removeChild(temp);

                const rgb = computedColor.match(/\d+/g);
                if (rgb) {
                    const hex = '#' + rgb.map(x => {
                        const hex = parseInt(x).toString(16);
                        return hex.length === 1 ? '0' + hex : hex;
                    }).join('');
                    this.debug(`Converted color ${color} to hex ${hex}`);
                    return hex.toUpperCase();
                }
                return '#000000';
            }

            refresh() {
                this.setupColorCells();
            }

            destroy() {
                // Clean up code here
            }
        };
    }
})();
