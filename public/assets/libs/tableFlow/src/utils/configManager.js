export class ConfigManager {
    constructor(defaultConfig = {}) {
        this.defaultConfig = defaultConfig;
        this.config = { ...defaultConfig };
        this.validators = new Map();
        this.configChangeListeners = new Set();
    }

    /**
     * Définit un validateur pour une clé de configuration
     * @param {string} key - Clé de configuration
     * @param {Function} validator - Fonction de validation
     */
    setValidator(key, validator) {
        this.validators.set(key, validator);
    }

    /**
     * Valide une valeur de configuration
     * @param {string} key - Clé de configuration
     * @param {*} value - Valeur à valider
     * @returns {boolean} True si la valeur est valide
     */
    validate(key, value) {
        const validator = this.validators.get(key);
        if (validator) {
            return validator(value);
        }
        return true;
    }

    /**
     * Définit une valeur de configuration
     * @param {string} key - Clé de configuration
     * @param {*} value - Valeur à définir
     * @param {boolean} [notify=true] - Notifier les écouteurs
     */
    set(key, value, notify = true) {
        if (this.validate(key, value)) {
            this.config[key] = value;
            if (notify) {
                this.notifyConfigChange(key, value);
            }
        } else {
            throw new Error(`Valeur invalide pour la configuration ${key}`);
        }
    }

    /**
     * Récupère une valeur de configuration
     * @param {string} key - Clé de configuration
     * @param {*} [defaultValue] - Valeur par défaut
     * @returns {*} Valeur de configuration
     */
    get(key, defaultValue) {
        return this.config[key] ?? defaultValue ?? this.defaultConfig[key];
    }

    /**
     * Fusionne une configuration avec la configuration actuelle
     * @param {Object} newConfig - Nouvelle configuration
     * @param {boolean} [notify=true] - Notifier les écouteurs
     */
    merge(newConfig, notify = true) {
        Object.entries(newConfig).forEach(([key, value]) => {
            this.set(key, value, false);
        });
        if (notify) {
            this.notifyConfigChange('*', newConfig);
        }
    }

    /**
     * Réinitialise la configuration aux valeurs par défaut
     * @param {boolean} [notify=true] - Notifier les écouteurs
     */
    reset(notify = true) {
        this.config = { ...this.defaultConfig };
        if (notify) {
            this.notifyConfigChange('*', this.config);
        }
    }

    /**
     * Ajoute un écouteur de changement de configuration
     * @param {Function} listener - Fonction d'écoute
     * @returns {Function} Fonction de désinscription
     */
    onConfigChange(listener) {
        this.configChangeListeners.add(listener);
        return () => this.configChangeListeners.delete(listener);
    }

    /**
     * Notifie les écouteurs d'un changement de configuration
     * @param {string} key - Clé modifiée
     * @param {*} value - Nouvelle valeur
     */
    notifyConfigChange(key, value) {
        this.configChangeListeners.forEach(listener => {
            try {
                listener(key, value, this.config);
            } catch (error) {
                console.error('Erreur dans l\'écouteur de configuration:', error);
            }
        });
    }

    /**
     * Nettoie le gestionnaire de configuration
     */
    destroy() {
        this.config = {};
        this.validators.clear();
        this.configChangeListeners.clear();
    }
} 