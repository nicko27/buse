export default class ValidationPlugin {
    constructor(config = {}) {
        this.name = 'validation';
        this.version = '1.0.0';
        this.type = 'validation';
        this.table = null;
        this.editPlugin = null;
        
        // Configuration par défaut
        this.config = {
            validateAttribute: 'th-validate',
            validateClass: 'validate-cell',
            invalidClass: 'invalid',
            errorClass: 'validation-error',
            
            // Validateurs intégrés
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
                }
            },
            
            debug: false
        };
        
        // Fusion avec la config fournie
        Object.assign(this.config, config);
        
        this.validateColumns = new Map();
        
        this.debug = this.config.debug ? 
            (...args) => console.log('[ValidationPlugin]', ...args) : 
            () => {};
    }
    
    init(tableHandler) {
        this.table = tableHandler;
        
        // Trouver le plugin Edit
        this.editPlugin = this.table.getPlugin('edit');
        if (!this.editPlugin) {
            console.error('ValidationPlugin: Edit plugin is required but not found');
            return;
        }
        
        // Détecter les colonnes avec validation
        this.detectValidateColumns();
        
        // S'enregistrer aux hooks du plugin Edit
        this.registerWithEditPlugin();
    }
    
    registerWithEditPlugin() {
        // S'accrocher aux hooks du plugin Edit
        this.editPlugin.addHook('beforeSave', this.validateBeforeSave.bind(this));
        this.editPlugin.addHook('afterEdit', this.setupValidationForInput.bind(this));
    }
    
    // Détection des colonnes avec validation
    detectValidateColumns() {
        if (!this.table || !this.table.table) return;
        
        const headers = this.table.table.querySelectorAll('th');
        headers.forEach((header, index) => {
            const validateConfig = header.getAttribute(this.config.validateAttribute);
            if (validateConfig) {
                try {
                    const config = JSON.parse(validateConfig);
                    this.validateColumns.set(index, config);
                    this.debug('Validation configuration detected', { index, config });
                } catch (e) {
                    console.error('Error parsing validation configuration:', e);
                }
            }
        });
    }
    
    // Méthodes de validation
    validateBeforeSave(cell, newValue, oldValue) {
        const columnIndex = Array.from(cell.parentElement.children).indexOf(cell);
        const validationConfig = this.validateColumns.get(columnIndex);
        
        if (!validationConfig) return true;
        
        return this.validateValue(cell, newValue, validationConfig);
    }
    
    validateValue(cell, value, config) {
        // Vérifier chaque type de validation configuré
        for (const [validationType, validationConfig] of Object.entries(config)) {
            if (this.config.validators[validationType]) {
                const result = this.config.validators[validationType](value, validationConfig, cell);
                if (result !== true) {
                    this.showValidationError(cell, result);
                    return false;
                }
            }
        }
        
        this.clearValidationError(cell);
        return true;
    }
    
    showValidationError(cell, errorMessage) {
        // Ajouter le conteneur d'erreur
        let errorContainer = cell.querySelector(`.${this.config.errorClass}`);
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = this.config.errorClass;
            cell.appendChild(errorContainer);
        }
        
        cell.classList.add(this.config.invalidClass);
        errorContainer.textContent = errorMessage;
        errorContainer.style.display = 'block';
    }
    
    clearValidationError(cell) {
        cell.classList.remove(this.config.invalidClass);
        
        const errorContainer = cell.querySelector(`.${this.config.errorClass}`);
        if (errorContainer) {
            errorContainer.style.display = 'none';
        }
    }
    
    setupValidationForInput(cell, input, currentValue) {
        const columnIndex = Array.from(cell.parentElement.children).indexOf(cell);
        const validationConfig = this.validateColumns.get(columnIndex);
        
        if (!validationConfig) return;
        
        // Configurer le type de l'input selon la validation
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
        } 
        else if (validationConfig.email) {
            input.type = 'email';
        }
        else if (validationConfig.date) {
            input.type = 'date';
            if (validationConfig.date.minDate) {
                input.min = validationConfig.date.minDate;
            }
            if (validationConfig.date.maxDate) {
                input.max = validationConfig.date.maxDate;
            }
        }
        
        // Ajouter des attributs HTML5 pour la validation
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
        
        // Validation en temps réel pendant la saisie
        input.addEventListener('input', () => {
            this.validateValue(cell, input.value, validationConfig);
        });
    }
    
    // Ajouter un validateur personnalisé
    registerValidator(name, validatorFn) {
        this.config.validators[name] = validatorFn;
        return this;
    }
    
    refresh() {
        this.detectValidateColumns();
    }
    
    destroy() {
        // Rien à détruire spécifiquement
    }
}