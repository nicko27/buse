import { Logger } from '../utils/logger.js';

export class ConfigManager {
    constructor(initialConfig = {}) {
        this.logger = new Logger('ConfigManager');
        this.config = {};
        this.schema = {};
        this.validators = new Map();
        this.watchers = new Map();

        // Configurer les validateurs par défaut
        this.setupDefaultValidators();

        // Initialiser la configuration
        this.setConfig(initialConfig);
    }

    setupDefaultValidators() {
        // Types de base
        this.addValidator('string', value => typeof value === 'string');
        this.addValidator('number', value => typeof value === 'number' && !isNaN(value));
        this.addValidator('boolean', value => typeof value === 'boolean');
        this.addValidator('function', value => typeof value === 'function');
        this.addValidator('object', value => typeof value === 'object' && value !== null);
        this.addValidator('array', value => Array.isArray(value));

        // Validateurs spéciaux
        this.addValidator('positive', value => typeof value === 'number' && value > 0);
        this.addValidator('integer', value => Number.isInteger(value));
        this.addValidator('url', value => {
            try {
                new URL(value);
                return true;
            } catch {
                return false;
            }
        });
        this.addValidator('email', value => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(value);
        });
    }

    addValidator(name, validator) {
        if (typeof validator !== 'function') {
            throw new Error(`Le validateur ${name} doit être une fonction`);
        }
        this.validators.set(name, validator);
    }

    setSchema(schema) {
        this.validateSchema(schema);
        this.schema = schema;
        
        // Valider la configuration existante avec le nouveau schéma
        this.validateConfig(this.config);
    }

    validateSchema(schema) {
        for (const [key, def] of Object.entries(schema)) {
            // Vérifier la présence des propriétés requises
            if (!def.type) {
                throw new Error(`Le champ ${key} doit avoir un type défini`);
            }

            // Vérifier que le validateur existe
            if (!this.validators.has(def.type)) {
                throw new Error(`Type de validateur inconnu: ${def.type}`);
            }

            // Vérifier la validité des valeurs par défaut
            if ('default' in def) {
                const validator = this.validators.get(def.type);
                if (!validator(def.default)) {
                    throw new Error(`Valeur par défaut invalide pour ${key}`);
                }
            }
        }
    }

    validateConfig(config) {
        const errors = [];

        for (const [key, def] of Object.entries(this.schema)) {
            // Vérifier si la valeur est requise
            if (def.required && !(key in config)) {
                errors.push(`Le champ ${key} est requis`);
                continue;
            }

            // Si la valeur est présente, la valider
            if (key in config) {
                const value = config[key];
                const validator = this.validators.get(def.type);

                if (!validator(value)) {
                    errors.push(`Valeur invalide pour ${key}: attendu ${def.type}`);
                }

                // Validation personnalisée si définie
                if (def.validate && !def.validate(value)) {
                    errors.push(`Validation personnalisée échouée pour ${key}`);
                }
            }
        }

        if (errors.length > 0) {
            throw new Error(`Erreurs de validation:\n${errors.join('\n')}`);
        }
    }

    setConfig(newConfig) {
        // Créer une copie profonde de la configuration
        const config = JSON.parse(JSON.stringify(newConfig));

        // Valider la configuration si un schéma est défini
        if (Object.keys(this.schema).length > 0) {
            this.validateConfig(config);
        }

        // Fusionner avec les valeurs par défaut du schéma
        const mergedConfig = { ...this.getDefaultValues(), ...config };

        // Détecter les changements
        const changes = new Map();
        for (const [key, value] of Object.entries(mergedConfig)) {
            if (JSON.stringify(this.config[key]) !== JSON.stringify(value)) {
                changes.set(key, {
                    oldValue: this.config[key],
                    newValue: value
                });
            }
        }

        // Mettre à jour la configuration
        this.config = mergedConfig;

        // Notifier les watchers des changements
        this.notifyWatchers(changes);

        this.logger.debug('Configuration mise à jour:', this.config);
    }

    getDefaultValues() {
        const defaults = {};
        for (const [key, def] of Object.entries(this.schema)) {
            if ('default' in def) {
                defaults[key] = def.default;
            }
        }
        return defaults;
    }

    get(key) {
        if (key === undefined) {
            return { ...this.config };
        }
        return this.config[key];
    }

    set(key, value) {
        const newConfig = { ...this.config, [key]: value };
        this.setConfig(newConfig);
    }

    watch(key, callback) {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, new Set());
        }
        this.watchers.get(key).add(callback);

        // Retourner une fonction pour arrêter le watching
        return () => {
            this.watchers.get(key)?.delete(callback);
        };
    }

    notifyWatchers(changes) {
        for (const [key, change] of changes) {
            if (this.watchers.has(key)) {
                this.watchers.get(key).forEach(callback => {
                    try {
                        callback(change.newValue, change.oldValue);
                    } catch (error) {
                        this.logger.error(`Erreur dans le watcher pour ${key}:`, error);
                    }
                });
            }
        }
    }

    reset() {
        this.setConfig(this.getDefaultValues());
    }

    toJSON() {
        return JSON.stringify(this.config, null, 2);
    }

    fromJSON(json) {
        try {
            const config = JSON.parse(json);
            this.setConfig(config);
        } catch (error) {
            throw new Error(`Erreur lors du parsing de la configuration: ${error.message}`);
        }
    }
} 