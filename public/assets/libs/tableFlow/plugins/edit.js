(function() {
    if (typeof window.editPlugin === 'undefined') {
        window.editPlugin = class editplugin {
            constructor(config = {}) {
                this.name = 'edit';
                this.version = '1.0.0';
                this.type = 'edit';
                this.table = null;
                this.dependencies = [];
                
                // Configuration unifiée
                this.config = {
                    // Configuration edit
                    editAttribute: 'th-edit',
                    cellClass: 'td-edit',
                    readOnlyClass: 'readonly',
                    inputClass: 'edit-input',
                    modifiedClass: 'modified',
                    
                    // Configuration validate
                    validateAttribute: 'th-validate',
                    validateClass: 'validate-cell',
                    invalidClass: 'invalid',
                    errorClass: 'validation-error',
                    validators: {
                        // Validation de longueur
                        maxLength: (value, config) => {
                            if (value && value.length > config.maxLength) {
                                return `Maximum ${config.maxLength} caractères`;
                            }
                            return true;
                        },
                        minLength: (value, config) => {
                            if (value && value.length < config.minLength) {
                                return `Minimum ${config.minLength} caractères`;
                            }
                            return true;
                        },
                        
                        // Validation numérique
                        number: (value, config) => {
                            if (!value) return true;
                            const num = parseFloat(value);
                            if (isNaN(num)) {
                                return 'Doit être un nombre';
                            }
                            if (config.min !== undefined && num < config.min) {
                                return `Doit être supérieur à ${config.min}`;
                            }
                            if (config.max !== undefined && num > config.max) {
                                return `Doit être inférieur à ${config.max}`;
                            }
                            if (config.integer && !Number.isInteger(num)) {
                                return 'Doit être un nombre entier';
                            }
                            return true;
                        },
                        
                        // Validation email
                        email: (value) => {
                            if (!value) return true;
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(value)) {
                                return 'Email invalide';
                            }
                            return true;
                        },
                        
                        // Validation date
                        date: (value, config) => {
                            if (!value) return true;
                            const date = new Date(value);
                            if (isNaN(date.getTime())) {
                                return 'Date invalide';
                            }
                            if (config.minDate && date < new Date(config.minDate)) {
                                return `Date doit être après ${config.minDate}`;
                            }
                            if (config.maxDate && date > new Date(config.maxDate)) {
                                return `Date doit être avant ${config.maxDate}`;
                            }
                            return true;
                        },
                        
                        // Validation regex
                        regex: (value, config) => {
                            if (!value || !config.pattern) return true;
                            const regex = new RegExp(config.pattern);
                            if (!regex.test(value)) {
                                return config.patternMessage || 'Format invalide';
                            }
                            return true;
                        },
                        
                        // Validation custom
                        custom: (value, config, cell) => {
                            if (typeof config.validate === 'function') {
                                return config.validate(value, cell) || 'Valeur invalide';
                            }
                            return true;
                        }
                    },
                    
                    debug: false,
                    ...config
                };

                this.validateColumns = new Map();
                this.errors = new Map();
                
                this.debug = this.config.debug === true ? 
                    (...args) => console.log('[EditPlugin]', ...args) : 
                    () => {};
            }

            getDefaultConfig() {
                return {
                    editAttribute: 'th-edit',
                    cellClass: 'td-edit',
                    readOnlyClass: 'readonly',
                    inputClass: 'edit-input',
                    modifiedClass: 'modified',
                    validateAttribute: 'th-validate',
                    validateClass: 'validate-cell',
                    invalidClass: 'invalid',
                    errorClass: 'validation-error',
                    validators: {
                        maxLength: (value, config) => {
                            if (value && value.length > config.maxLength) {
                                return `Maximum ${config.maxLength} caractères`;
                            }
                            return true;
                        }
                    },
                    debug: false
                };
            }

            init(tableHandler) {
                if (!tableHandler) {
                    throw new Error('TableHandler instance is required');
                }
                this.table = tableHandler;
                
                // Initialisation des colonnes de validation
                this.detectValidateColumns();
                
                // Configuration des cellules
                this.setupEditCells();
                
                // Configuration des événements
                this.setupEventListeners();
                
                this.debug('Plugin initialisé');
            }

            detectValidateColumns() {
                if (!this.table || !this.table.table) return;

                const headers = this.table.table.querySelectorAll('th');
                headers.forEach((header, index) => {
                    const validateConfig = header.getAttribute(this.config.validateAttribute);
                    if (validateConfig) {
                        try {
                            // Parser la configuration JSON
                            const config = JSON.parse(validateConfig);
                            this.validateColumns.set(index, config);
                            this.debug('Configuration de validation détectée', { index, config });
                        } catch (e) {
                            console.error('Erreur de parsing de la configuration de validation:', e);
                        }
                    }
                });
            }

            validateCell(cell, config) {
                const value = this.getCellValue(cell);
                const columnIndex = Array.from(cell.parentElement.children).indexOf(cell);
                const rowIndex = Array.from(cell.parentElement.parentElement.children).indexOf(cell.parentElement);

                // Vérifier chaque type de validation configuré
                for (const [validationType, validationConfig] of Object.entries(config)) {
                    if (this.config.validators[validationType]) {
                        const result = this.config.validators[validationType](value, validationConfig, cell);
                        if (result !== true) {
                            this.updateValidationDisplay(cell, false, result);
                            return false;
                        }
                    }
                }

                this.updateValidationDisplay(cell, true, '');
                return true;
            }

            updateValidationDisplay(cell, isValid, error) {
                // Ajouter le conteneur d'erreur s'il n'existe pas
                let errorContainer = cell.querySelector(`.${this.config.errorClass}`);
                if (!errorContainer) {
                    errorContainer = document.createElement('div');
                    errorContainer.className = this.config.errorClass;
                    cell.appendChild(errorContainer);
                }

                if (!isValid) {
                    cell.classList.add(this.config.invalidClass);
                    errorContainer.textContent = error;
                    errorContainer.style.display = 'block';
                } else {
                    cell.classList.remove(this.config.invalidClass);
                    errorContainer.style.display = 'none';
                }
            }

            getCellValue(cell) {
                // Essayer d'abord de récupérer la valeur de l'input si en cours d'édition
                const input = cell.querySelector(`.${this.config.inputClass}`);
                if (input) {
                    return input.value.trim();
                }

                // Sinon prendre la valeur stockée
                return cell.getAttribute('data-value') || cell.textContent.trim();
            }

            setupEditCells() {
                if (!this.table || !this.table.table) return;

                const headerCells = this.table.table.querySelectorAll('th');
                const editColumns = Array.from(headerCells)
                    .filter(header => header.hasAttribute(this.config.editAttribute))
                    .map(header => ({
                        id: header.id,
                        index: Array.from(headerCells).indexOf(header)
                    }));

                if (!editColumns.length) return;

                const rows = this.table.table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    editColumns.forEach(({id: columnId, index}) => {
                        const cell = row.cells[index];
                        if (!cell) return;

                        // Ne pas réinitialiser si la cellule est déjà gérée par un autre plugin
                        if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'edit') {
                            return;
                        }

                        cell.classList.add(this.config.cellClass);
                        cell.setAttribute('data-plugin', 'edit');

                        // Ajouter le gestionnaire de double-clic s'il n'existe pas déjà
                        if (!cell.hasAttribute('data-edit-initialized')) {
                            cell.addEventListener('dblclick', (e) => this.startEditing(e));
                            cell.setAttribute('data-edit-initialized', 'true');
                        }

                        // Récupérer la valeur actuelle
                        let currentValue = cell.getAttribute('data-value');
                        if (currentValue === null) {
                            currentValue = cell.textContent.trim();
                            cell.setAttribute('data-value', currentValue);
                        }

                        // Si pas de valeur initiale, la définir
                        if (cell.getAttribute('data-initial-value') === null) {
                            cell.setAttribute('data-initial-value', currentValue);
                        }
                    });
                });
            }

            setupEventListeners() {
                if (!this.table || !this.table.table) {
                    this.debug('Table not initialized');
                    return;
                }

                this.debug('Setting up event listeners');

                // Écouter l'événement cell:saved
                this.table.table.addEventListener('cell:saved', (event) => {
                    this.debug('cell:saved event received', event.detail);
                    const cell = event.detail.cell;
                    if (!cell || !cell.classList.contains(this.config.cellClass)) {
                        this.debug('Cell not managed by edit plugin');
                        return;
                    }

                    const currentValue = event.detail.value;
                    cell.setAttribute('data-initial-value', currentValue);
                    cell.setAttribute('data-value', currentValue);
                    
                    const wrapper = cell.querySelector('.cell-wrapper');
                    if (wrapper) {
                        wrapper.innerHTML = currentValue;
                    } else {
                        cell.innerHTML = currentValue;
                        if (this.table.initializeWrappers) {
                            this.table.initializeWrappers();
                        }
                    }
                });

                // Écouter l'événement row:saved
                this.table.table.addEventListener('row:saved', (event) => {
                    this.debug('row:saved event received');
                    const row = event.detail.row;
                    if (!row) return;

                    // Vérifier et mettre à jour toutes les cellules edit de la ligne
                    Array.from(row.cells).forEach((cell, index) => {
                        if (!cell.classList.contains(this.config.cellClass)) return;

                        const currentValue = cell.getAttribute('data-value');
                        
                        // Mettre à jour la valeur initiale
                        cell.setAttribute('data-initial-value', currentValue);

                        const wrapper = cell.querySelector('.cell-wrapper');
                        if (wrapper) {
                            wrapper.innerHTML = currentValue;
                        } else {
                            cell.innerHTML = currentValue;
                            if (this.table.initializeWrappers) {
                                this.table.initializeWrappers();
                            }
                        }
                    });
                });

                // Écouter l'ajout de nouvelles lignes
                this.table.table.addEventListener('row:added', () => {
                    this.debug('row:added event received');
                    this.setupEditCells();
                });

                // Écouter les touches spéciales
                this.table.table.addEventListener('keydown', (event) => {
                    if (event.key === 'Escape') {
                        const activeInput = document.querySelector(`.${this.config.inputClass}`);
                        if (activeInput) {
                            const cell = activeInput.closest('td');
                            const wrapper = cell.querySelector('.cell-wrapper') || cell;
                            wrapper.innerHTML = cell.getAttribute('data-value');
                            if (this.table.initializeWrappers) {
                                this.table.initializeWrappers();
                            }
                        }
                    }
                });
            }

            startEditing(event) {
                const cell = event.target.closest('td');
                if (!cell || cell.querySelector('input')) return;

                // Vérifier si la cellule est bien gérée par ce plugin
                if (cell.getAttribute('data-plugin') !== 'edit') {
                    return;
                }

                // Vérifier si la cellule est en lecture seule
                if (cell.classList.contains(this.config.readOnlyClass)) {
                    return;
                }

                const wrapper = cell.querySelector('.cell-wrapper') || cell;
                const currentValue = cell.getAttribute('data-value') || wrapper.textContent.trim();
                const input = document.createElement('input');
                
                // Déterminer le type d'input en fonction de la validation
                const columnIndex = Array.from(cell.parentElement.children).indexOf(cell);
                const validationConfig = this.validateColumns.get(columnIndex);
                
                if (validationConfig) {
                    // Type number pour la validation numérique
                    if (validationConfig.number) {
                        input.type = 'number';
                        if (validationConfig.number.min !== undefined) {
                            input.min = validationConfig.number.min;
                        }
                        if (validationConfig.number.max !== undefined) {
                            input.max = validationConfig.number.max;
                        }
                        if (validationConfig.number.step !== undefined) {
                            input.step = validationConfig.number.step;
                        }
                        if (validationConfig.number.integer) {
                            input.step = '1';
                        }
                        // Forcer la valeur à être un nombre valide
                        const numValue = parseFloat(currentValue);
                        input.value = !isNaN(numValue) ? numValue : '';
                    }
                    // Type email pour la validation email
                    else if (validationConfig.email) {
                        input.type = 'email';
                        input.value = currentValue;
                    }
                    // Type date pour la validation date
                    else if (validationConfig.date) {
                        input.type = 'date';
                        if (validationConfig.date.minDate) {
                            input.min = validationConfig.date.minDate;
                        }
                        if (validationConfig.date.maxDate) {
                            input.max = validationConfig.date.maxDate;
                        }
                        input.value = currentValue;
                    }
                    // Type par défaut
                    else {
                        input.type = 'text';
                        input.value = currentValue;
                    }

                    // Ajouter les attributs de validation HTML5
                    if (validationConfig.maxLength) {
                        input.maxLength = validationConfig.maxLength;
                    }
                    if (validationConfig.minLength) {
                        input.minLength = validationConfig.minLength;
                    }
                    if (validationConfig.pattern) {
                        input.pattern = validationConfig.pattern;
                    }
                    if (validationConfig.required) {
                        input.required = true;
                    }
                } else {
                    input.type = 'text';
                    input.value = currentValue;
                }

                input.className = this.config.inputClass;
                
                wrapper.innerHTML = '';
                wrapper.appendChild(input);
                input.focus();
                input.select();

                const finishEditing = () => {
                    let newValue = input.value.trim();

                    // Pour les nombres, s'assurer qu'on a une valeur valide
                    if (validationConfig && validationConfig.number) {
                        const numValue = parseFloat(newValue);
                        if (isNaN(numValue)) {
                            newValue = currentValue; // Restaurer la valeur initiale si ce n'est pas un nombre
                        }
                    }

                    // Valider la nouvelle valeur
                    if (validationConfig && !this.validateCell(cell, validationConfig)) {
                        if (wrapper === cell) {
                            cell.innerHTML = currentValue;
                            if (this.table.initializeWrappers) {
                                this.table.initializeWrappers();
                            }
                        } else {
                            wrapper.innerHTML = currentValue;
                        }
                        return;
                    }

                    cell.setAttribute('data-value', newValue);

                    // Mettre à jour le contenu
                    if (wrapper === cell) {
                        cell.innerHTML = newValue;
                        if (this.table.initializeWrappers) {
                            this.table.initializeWrappers();
                        }
                    } else {
                        wrapper.innerHTML = newValue;
                    }
                    
                    // Marquer la ligne comme modifiée si la valeur a changé
                    const row = cell.closest('tr');
                    const initialValue = cell.getAttribute('data-initial-value');
                    if (newValue !== initialValue && row) {
                        row.classList.add(this.config.modifiedClass);
                    }

                    // Déclencher l'événement de changement
                    const changeEvent = new CustomEvent('cell:change', {
                        detail: {
                            cellId: cell.id,
                            columnId: cell.id.split('_')[0],
                            rowId: row ? row.id : null,
                            value: newValue,
                            cell: cell
                        },
                        bubbles: true
                    });
                    cell.dispatchEvent(changeEvent);
                };

                const handleKeydown = (e) => {
                    if (e.key === 'Enter') {
                        finishEditing();
                        e.preventDefault();
                    } else if (e.key === 'Escape') {
                        wrapper.innerHTML = currentValue;
                        if (wrapper === cell && this.table.initializeWrappers) {
                            this.table.initializeWrappers();
                        }
                        e.preventDefault();
                    }
                };

                // Valider pendant la saisie
                input.addEventListener('input', () => {
                    const validationConfig = this.validateColumns.get(columnIndex);
                    if (validationConfig) {
                        this.validateCell(cell, validationConfig);
                    }
                });

                input.addEventListener('blur', finishEditing);
                input.addEventListener('keydown', handleKeydown);
            }
        }
    }
})();
