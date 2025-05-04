import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class ValidationPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.VALIDATION;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        // État local
        this.state = {
            validators: new Map(),
            validationResults: new Map(),
            isValidating: false,
            lastValidatedCell: null
        };
        
        // Cache pour les performances
        this.cache = {
            validationTimeout: null,
            lastValidationTime: 0,
            cellValidators: new Map()
        };
        
        // Lier les méthodes
        this._boundCellChangeHandler = this.handleCellChange.bind(this);
        this._boundRowChangeHandler = this.handleRowChange.bind(this);
    }
    
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Validation déjà initialisé');
            return;
        }

        try {
            this.logger.info('Initialisation du plugin Validation');
            
            // Ajouter les écouteurs d'événements
            this.setupEventListeners();
            
            // Initialiser les styles
            this.initializeStyles();
            
            // Initialiser les validateurs par défaut
            this.initializeDefaultValidators();
            
            this.isInitialized = true;
            this.metrics.increment('plugin_validation_init');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_init');
            throw error;
        }
    }
    
    setupEventListeners() {
        try {
            // Événements des cellules
            this.tableFlow.on('cellChange', this._boundCellChangeHandler);
            this.tableFlow.on('rowChange', this._boundRowChangeHandler);
            
            // Ajouter les attributs ARIA
            const cells = this.tableFlow.table.querySelectorAll('td');
            cells.forEach(cell => {
                cell.setAttribute('aria-invalid', 'false');
                cell.setAttribute('role', 'gridcell');
            });
            
            this.metrics.increment('validation_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_setup_listeners');
        }
    }
    
    initializeStyles() {
        try {
            // Ajouter les styles CSS
            const style = document.createElement('style');
            style.textContent = `
                .${this.config.errorClass} {
                    background-color: ${this.config.validation.errorBackgroundColor};
                    border: ${this.config.validation.errorBorder};
                }
                .${this.config.errorClass}::after {
                    content: '⚠';
                    color: ${this.config.validation.errorColor};
                    position: absolute;
                    top: 2px;
                    right: 2px;
                    font-size: 12px;
                }
                .${this.config.warningClass} {
                    background-color: ${this.config.validation.warningBackgroundColor};
                    border: ${this.config.validation.warningBorder};
                }
                .${this.config.successClass} {
                    background-color: ${this.config.validation.successBackgroundColor};
                }
            `;
            document.head.appendChild(style);
            
            this.metrics.increment('validation_styles_initialized');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_initialize_styles');
        }
    }
    
    initializeDefaultValidators() {
        try {
            // Validateur requis
            this.addValidator('required', (value) => {
                return value !== null && value !== undefined && value.trim() !== '';
            }, 'Ce champ est requis');
            
            // Validateur numérique
            this.addValidator('numeric', (value) => {
                return !isNaN(value) && value !== '';
            }, 'Ce champ doit être un nombre');
            
            // Validateur email
            this.addValidator('email', (value) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(value);
            }, 'Email invalide');
            
            this.metrics.increment('validation_default_validators_initialized');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_initialize_default_validators');
        }
    }
    
    async handleCellChange(event) {
        if (!this.isInitialized) return;

        try {
            const { cell, value } = event;
            
            // Déclencher le hook beforeValidation
            const beforeResult = await this.tableFlow.hooks.trigger('beforeValidation', {
                cell,
                value
            });
            
            if (beforeResult === false) return;
            
            // Valider la cellule
            await this.validateCell(cell, value);
            
            this.metrics.increment('validation_cell_change');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_handle_cell_change');
        }
    }
    
    async handleRowChange(event) {
        if (!this.isInitialized) return;

        try {
            const { row, values } = event;
            
            // Déclencher le hook beforeRowValidation
            const beforeResult = await this.tableFlow.hooks.trigger('beforeRowValidation', {
                row,
                values
            });
            
            if (beforeResult === false) return;
            
            // Valider la ligne
            await this.validateRow(row, values);
            
            this.metrics.increment('validation_row_change');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_handle_row_change');
        }
    }
    
    async validateCell(cell, value) {
        try {
            const startTime = performance.now();
            this.state.isValidating = true;
            this.state.lastValidatedCell = cell;
            
            // Récupérer les validateurs pour cette cellule
            const validators = this.getCellValidators(cell);
            const errors = [];
            
            // Exécuter les validateurs
            for (const [name, validator] of validators) {
                const isValid = await validator.validate(value);
                if (!isValid) {
                    errors.push({
                        validator: name,
                        message: validator.message
                    });
                }
            }
            
            // Mettre à jour l'état et les styles
            this.updateCellValidationState(cell, errors);
            
            // Déclencher le hook afterValidation
            await this.tableFlow.hooks.trigger('afterValidation', {
                cell,
                value,
                errors,
                performance: {
                    duration: performance.now() - startTime
                }
            });
            
            this.metrics.increment('validation_cell_validated');
            this.metrics.record('validation_duration', performance.now() - startTime);
            
            return errors.length === 0;
        } catch (error) {
            this.errorHandler.handle(error, 'validation_validate_cell');
            return false;
        } finally {
            this.state.isValidating = false;
        }
    }
    
    async validateRow(row, values) {
        try {
            const startTime = performance.now();
            const cells = Array.from(row.cells);
            const errors = new Map();
            
            // Valider chaque cellule
            for (let i = 0; i < cells.length; i++) {
                const cell = cells[i];
                const value = values[i];
                const cellErrors = await this.validateCell(cell, value);
                if (cellErrors.length > 0) {
                    errors.set(cell, cellErrors);
                }
            }
            
            // Déclencher le hook afterRowValidation
            await this.tableFlow.hooks.trigger('afterRowValidation', {
                row,
                values,
                errors,
                performance: {
                    duration: performance.now() - startTime
                }
            });
            
            this.metrics.increment('validation_row_validated');
            return errors.size === 0;
        } catch (error) {
            this.errorHandler.handle(error, 'validation_validate_row');
            return false;
        }
    }
    
    getCellValidators(cell) {
        try {
            // Vérifier le cache
            if (this.cache.cellValidators.has(cell)) {
                return this.cache.cellValidators.get(cell);
            }
            
            const validators = new Map();
            const validatorNames = cell.dataset.validators?.split(',') || [];
            
            // Récupérer les validateurs configurés
            validatorNames.forEach(name => {
                const validator = this.state.validators.get(name.trim());
                if (validator) {
                    validators.set(name, validator);
                }
            });
            
            // Mettre en cache
            this.cache.cellValidators.set(cell, validators);
            
            return validators;
        } catch (error) {
            this.errorHandler.handle(error, 'validation_get_cell_validators');
            return new Map();
        }
    }
    
    updateCellValidationState(cell, errors) {
        try {
            // Supprimer les classes existantes
            cell.classList.remove(
                this.config.errorClass,
                this.config.warningClass,
                this.config.successClass
            );
            
            // Mettre à jour les attributs ARIA
            cell.setAttribute('aria-invalid', errors.length > 0 ? 'true' : 'false');
            
            if (errors.length > 0) {
                // Ajouter la classe d'erreur
                cell.classList.add(this.config.errorClass);
                
                // Mettre à jour le message d'erreur
                cell.setAttribute('aria-errormessage', errors[0].message);
                
                // Stocker les erreurs
                this.state.validationResults.set(cell, errors);
            } else {
                // Ajouter la classe de succès
                cell.classList.add(this.config.successClass);
                
                // Nettoyer les attributs
                cell.removeAttribute('aria-errormessage');
                this.state.validationResults.delete(cell);
            }
            
            this.metrics.increment('validation_cell_state_updated');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_update_cell_state');
        }
    }
    
    addValidator(name, validateFn, message) {
        try {
            this.state.validators.set(name, {
                validate: validateFn,
                message
            });
            
            // Invalider le cache des validateurs
            this.cache.cellValidators.clear();
            
            this.metrics.increment('validation_validator_added');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_add_validator');
        }
    }
    
    removeValidator(name) {
        try {
            this.state.validators.delete(name);
            
            // Invalider le cache des validateurs
            this.cache.cellValidators.clear();
            
            this.metrics.increment('validation_validator_removed');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_remove_validator');
        }
    }
    
    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            this.tableFlow.off('cellChange', this._boundCellChangeHandler);
            this.tableFlow.off('rowChange', this._boundRowChangeHandler);
            
            // Nettoyer les styles
            const cells = this.tableFlow.table.querySelectorAll('td');
            cells.forEach(cell => {
                cell.classList.remove(
                    this.config.errorClass,
                    this.config.warningClass,
                    this.config.successClass
                );
                cell.removeAttribute('aria-invalid');
                cell.removeAttribute('aria-errormessage');
            });
            
            // Supprimer les styles
            const style = document.querySelector(`style[data-plugin="${this.name}"]`);
            if (style) {
                style.remove();
            }
            
            // Nettoyer l'état et le cache
            this.state.validators.clear();
            this.state.validationResults.clear();
            this.cache.cellValidators.clear();
            
            this.isInitialized = false;
            this.logger.info('Plugin Validation détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'validation_destroy');
        } finally {
            super.destroy();
        }
    }
}