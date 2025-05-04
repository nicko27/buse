import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';

export class ValidationManager {
    constructor(config = {}) {
        this.logger = new Logger('ValidationManager');
        this.eventBus = new EventBus();
        this.config = {
            strictMode: true,
            validateOnChange: true,
            validateOnBlur: true,
            validateOnSubmit: true,
            ...config
        };

        this.validators = new Map();
        this.rules = new Map();
        this.errors = new Map();
        this.customValidators = new Map();

        // Configurer les validateurs par défaut
        this.setupDefaultValidators();
    }

    // Configuration des validateurs par défaut
    setupDefaultValidators() {
        // Validateurs de type
        this.addValidator('required', value => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'string') return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            return true;
        });

        this.addValidator('string', value => typeof value === 'string');
        this.addValidator('number', value => typeof value === 'number' && !isNaN(value));
        this.addValidator('boolean', value => typeof value === 'boolean');
        this.addValidator('array', value => Array.isArray(value));
        this.addValidator('object', value => typeof value === 'object' && value !== null && !Array.isArray(value));

        // Validateurs de chaîne
        this.addValidator('minLength', (value, min) => {
            if (typeof value !== 'string') return false;
            return value.length >= min;
        });

        this.addValidator('maxLength', (value, max) => {
            if (typeof value !== 'string') return false;
            return value.length <= max;
        });

        this.addValidator('email', value => {
            if (typeof value !== 'string') return false;
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value);
        });

        this.addValidator('pattern', (value, pattern) => {
            if (typeof value !== 'string') return false;
            const regex = new RegExp(pattern);
            return regex.test(value);
        });

        // Validateurs numériques
        this.addValidator('min', (value, min) => {
            if (typeof value !== 'number') return false;
            return value >= min;
        });

        this.addValidator('max', (value, max) => {
            if (typeof value !== 'number') return false;
            return value <= max;
        });

        this.addValidator('integer', value => {
            if (typeof value !== 'number') return false;
            return Number.isInteger(value);
        });

        // Validateurs de tableau
        this.addValidator('minItems', (value, min) => {
            if (!Array.isArray(value)) return false;
            return value.length >= min;
        });

        this.addValidator('maxItems', (value, max) => {
            if (!Array.isArray(value)) return false;
            return value.length <= max;
        });

        this.addValidator('uniqueItems', value => {
            if (!Array.isArray(value)) return false;
            return new Set(value).size === value.length;
        });
    }

    // Gestion des validateurs
    addValidator(name, validator, options = {}) {
        if (typeof validator !== 'function') {
            throw new Error(`Le validateur ${name} doit être une fonction`);
        }

        this.customValidators.set(name, {
            validator,
            options
        });
    }

    removeValidator(name) {
        this.customValidators.delete(name);
    }

    // Gestion des règles
    addRule(field, rules) {
        this.rules.set(field, Array.isArray(rules) ? rules : [rules]);
    }

    removeRule(field) {
        this.rules.delete(field);
    }

    // Validation
    async validate(data, fields = null) {
        this.errors.clear();
        const fieldsToValidate = fields || Array.from(this.rules.keys());
        
        for (const field of fieldsToValidate) {
            const rules = this.rules.get(field);
            if (!rules) continue;

            const value = data[field];
            const fieldErrors = [];

            for (const rule of rules) {
                const validatorName = typeof rule === 'string' ? rule : rule.type;
                const validatorConfig = typeof rule === 'object' ? rule : {};
                
                const validator = this.customValidators.get(validatorName);
                if (!validator) {
                    this.logger.warn(`Validateur non trouvé: ${validatorName}`);
                    continue;
                }

                try {
                    const isValid = await Promise.resolve(
                        validator.validator(value, validatorConfig.value, validatorConfig)
                    );

                    if (!isValid) {
                        fieldErrors.push({
                            type: validatorName,
                            message: validatorConfig.message || `Validation ${validatorName} échouée`,
                            params: validatorConfig
                        });

                        // En mode strict, on arrête à la première erreur
                        if (this.config.strictMode) break;
                    }
                } catch (error) {
                    this.logger.error(`Erreur lors de la validation ${validatorName}:`, error);
                    fieldErrors.push({
                        type: 'error',
                        message: 'Erreur interne de validation',
                        error
                    });
                }
            }

            if (fieldErrors.length > 0) {
                this.errors.set(field, fieldErrors);
            }
        }

        const hasErrors = this.errors.size > 0;
        this.eventBus.emit('validation:complete', {
            isValid: !hasErrors,
            errors: this.getErrors()
        });

        return !hasErrors;
    }

    // Gestion des erreurs
    hasErrors(field = null) {
        if (field) {
            return this.errors.has(field);
        }
        return this.errors.size > 0;
    }

    getErrors(field = null) {
        if (field) {
            return this.errors.get(field) || [];
        }
        const allErrors = {};
        for (const [field, errors] of this.errors.entries()) {
            allErrors[field] = errors;
        }
        return allErrors;
    }

    clearErrors(field = null) {
        if (field) {
            this.errors.delete(field);
        } else {
            this.errors.clear();
        }
        this.eventBus.emit('validation:clear', { field });
    }

    // Événements
    onValidation(callback) {
        return this.eventBus.on('validation:complete', callback);
    }

    onError(callback) {
        return this.eventBus.on('validation:error', callback);
    }

    onClear(callback) {
        return this.eventBus.on('validation:clear', callback);
    }

    // Utilitaires
    async validateField(field, value) {
        const rules = this.rules.get(field);
        if (!rules) return true;

        await this.validate({ [field]: value }, [field]);
        return !this.hasErrors(field);
    }

    getFieldRules(field) {
        return this.rules.get(field) || [];
    }

    // Nettoyage
    destroy() {
        this.rules.clear();
        this.errors.clear();
        this.customValidators.clear();
        this.eventBus.removeAllListeners();
    }
} 