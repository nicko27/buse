import { config } from './config.js';

export default class ValidationPlugin {
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.config = { ...config.options, ...options };
        this.logger = tableFlow.logger;
        this.metrics = tableFlow.metrics;
        this.errorHandler = tableFlow.errorHandler;
        this.validators = new Map();
        this.errors = new Map();
    }

    async init() {
        this.logger.info('Initialisation du plugin Validation');
        
        // Enregistrer les hooks
        this.tableFlow.addHook('beforeCellModify', this.validateCell.bind(this));
        this.tableFlow.addHook('beforeRowAdd', this.validateRow.bind(this));
        
        // Enregistrer les événements
        this.tableFlow.eventBus.on('cell:modified', this.onCellModified.bind(this));
        this.tableFlow.eventBus.on('row:added', this.onRowAdded.bind(this));
        
        // Initialiser les validateurs par défaut
        this.initDefaultValidators();
        
        this.logger.success('Plugin Validation initialisé');
    }

    initDefaultValidators() {
        this.addValidator('required', value => value !== null && value !== undefined && value !== '');
        this.addValidator('email', value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
        this.addValidator('number', value => !isNaN(value));
        this.addValidator('min', (value, min) => Number(value) >= min);
        this.addValidator('max', (value, max) => Number(value) <= max);
        this.addValidator('pattern', (value, pattern) => new RegExp(pattern).test(value));
    }

    addValidator(name, validator) {
        this.validators.set(name, validator);
    }

    removeValidator(name) {
        this.validators.delete(name);
    }

    async validateCell(cell, oldValue, newValue) {
        const timer = this.metrics.startTimer('validate_cell');
        try {
            const rules = this.getValidationRules(cell);
            if (!rules) return true;

            const results = await this.runHook('beforeValidation', { cell, oldValue, newValue, rules });
            if (results.some(result => result === false)) return false;

            const errors = [];
            for (const [rule, params] of Object.entries(rules)) {
                const validator = this.validators.get(rule);
                if (!validator) continue;

                const isValid = await validator(newValue, params);
                if (!isValid) {
                    errors.push({
                        rule,
                        params,
                        message: this.getErrorMessage(rule, params)
                    });
                }
            }

            if (errors.length > 0) {
                this.errors.set(cell.id, errors);
                await this.runHook('onValidationError', { cell, errors });
                this.tableFlow.eventBus.emit('validation:error', { cell, errors });
                return false;
            }

            this.errors.delete(cell.id);
            await this.runHook('afterValidation', { cell, oldValue, newValue });
            this.tableFlow.eventBus.emit('validation:complete', { cell });
            return true;
        } catch (error) {
            this.errorHandler.handle(error, this.errorHandler.errorTypes.VALIDATION, {
                cell,
                oldValue,
                newValue
            });
            return false;
        } finally {
            this.metrics.stopTimer(timer);
        }
    }

    async validateRow(data) {
        const timer = this.metrics.startTimer('validate_row');
        try {
            const results = await this.runHook('beforeValidation', { data });
            if (results.some(result => result === false)) return false;

            const errors = new Map();
            for (const [key, value] of Object.entries(data)) {
                const cell = this.tableFlow.dom.getCellByColumnId(key);
                if (!cell) continue;

                const cellErrors = await this.validateCell(cell, null, value);
                if (!cellErrors) {
                    errors.set(key, this.errors.get(cell.id));
                }
            }

            if (errors.size > 0) {
                await this.runHook('onValidationError', { data, errors });
                this.tableFlow.eventBus.emit('validation:error', { data, errors });
                return false;
            }

            await this.runHook('afterValidation', { data });
            this.tableFlow.eventBus.emit('validation:complete', { data });
        return true;
        } catch (error) {
            this.errorHandler.handle(error, this.errorHandler.errorTypes.VALIDATION, { data });
            return false;
        } finally {
            this.metrics.stopTimer(timer);
        }
    }

    getValidationRules(cell) {
        return cell.dataset.validation ? JSON.parse(cell.dataset.validation) : null;
    }

    getErrorMessage(rule, params) {
        let message = this.config.errorMessages[rule];
        if (!message) return `Erreur de validation: ${rule}`;
        
        if (typeof params === 'object') {
            for (const [key, value] of Object.entries(params)) {
                message = message.replace(`{${key}}`, value);
            }
        }
        return message;
    }

    async runHook(name, ...args) {
        return this.tableFlow.runHook(`validation:${name}`, ...args);
    }

    onCellModified({ cell, oldValue, newValue }) {
        if (this.config.validateOnChange) {
            this.validateCell(cell, oldValue, newValue);
        }
    }

    onRowAdded({ row, data }) {
        if (this.config.validateOnSubmit) {
            this.validateRow(data);
        }
    }
    
    destroy() {
        this.validators.clear();
        this.errors.clear();
        this.logger.info('Plugin Validation détruit');
    }
}