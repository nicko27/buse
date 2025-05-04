import { Logger } from '../utils/logger.js';

export class ConfigManager {
    constructor(options = {}) {
        this.logger = new Logger('ConfigManager');
        this.config = new Map();
        this.schema = new Map();
        this.validators = new Map();
        this.setupDefaultValidators();
    }

    setupDefaultValidators() {
        this.validators.set('string', value => typeof value === 'string');
        this.validators.set('number', value => typeof value === 'number' && !isNaN(value));
        this.validators.set('boolean', value => typeof value === 'boolean');
        this.validators.set('object', value => value && typeof value === 'object' && !Array.isArray(value));
        this.validators.set('array', value => Array.isArray(value));
    }

    setSchema(schema) {
        if (!schema || typeof schema !== 'object') {
            throw new Error('Le schéma doit être un objet');
        }

        for (const [key, definition] of Object.entries(schema)) {
            if (!definition.type || !this.validators.has(definition.type)) {
                throw new Error(`Type invalide pour la clé ${key}`);
            }
            this.schema.set(key, definition);
        }
    }

    validate(key, value) {
        const definition = this.schema.get(key);
        if (!definition) {
            throw new Error(`Clé de configuration non définie: ${key}`);
        }

        const validator = this.validators.get(definition.type);
        if (!validator(value)) {
            throw new Error(`Type invalide pour ${key}: attendu ${definition.type}`);
        }

        if (definition.required && (value === undefined || value === null)) {
            throw new Error(`${key} est requis`);
        }

        if (definition.validate && !definition.validate(value)) {
            throw new Error(`Validation échouée pour ${key}`);
        }

        if (definition.enum && !definition.enum.includes(value)) {
            throw new Error(`${key} doit être l'une des valeurs suivantes: ${definition.enum.join(', ')}`);
        }

        return true;
    }

    set(key, value) {
        this.validate(key, value);
        this.config.set(key, value);
        this.logger.debug(`Configuration mise à jour: ${key} = ${JSON.stringify(value)}`);
    }

    get(key) {
        const value = this.config.get(key);
        if (value === undefined && this.schema.get(key)?.required) {
            throw new Error(`Configuration requise manquante: ${key}`);
        }
        return value;
    }

    has(key) {
        return this.config.has(key);
    }

    setConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('La configuration doit être un objet');
        }

        for (const [key, value] of Object.entries(config)) {
            try {
                this.set(key, value);
            } catch (error) {
                this.logger.error(`Erreur de configuration pour ${key}: ${error.message}`);
                throw error;
            }
        }
    }

    getConfig() {
        return Object.fromEntries(this.config);
    }

    reset() {
        this.config.clear();
        this.logger.info('Configuration réinitialisée');
    }
} 