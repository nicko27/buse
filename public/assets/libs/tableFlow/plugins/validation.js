/**
 * Plugin Validation pour TableFlow
 * S'intègre au plugin Edit pour valider les données saisies avant la sauvegarde.
 * Affiche des messages d'erreur et empêche la sauvegarde si la validation échoue.
 * Utilise le système de hooks fourni par EditPlugin.
 *
 * @class ValidationPlugin
 * @version 1.0.2 - Intégration TableInstance, hooks vérifiés, validateur required
 * @depends EditPlugin - Requis pour l'édition et les hooks d'intégration.
 */
export default class ValidationPlugin {
    /**
     * Crée une instance de ValidationPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'validation';
        this.version = '1.0.2';
        this.type = 'validation'; // Type de plugin
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {object|null} Référence à l'instance du plugin Edit */
        this.editPlugin = null; // Dépendance essentielle
        /** @type {string[]} Dépendances requises */
        this.dependencies = ['Edit']; // Dépend explicitement du plugin Edit

        // Configuration par défaut fusionnée avec celle fournie
        // Utilise une fonction pour obtenir les défauts et éviter la mutation
        const mergedConfig = {
            ...this.getDefaultConfig(),
            ...config
        };
        // Fusionner spécifiquement les validateurs
        mergedConfig.validators = { ...this.getDefaultValidators(), ...(config.validators || {}) };
        this.config = mergedConfig;


        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[Validation ${this.table?.tableId}]`, ...args) ?? console.debug('[Validation]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        /**
         * Stocke la configuration de validation pour chaque colonne (index -> config).
         * @type {Map<number, object>}
         */
        this.validateColumns = new Map();

        // Lier les méthodes pour les hooks afin de conserver le contexte 'this'
        this._validateBeforeSave = this._validateBeforeSave.bind(this);
        this._setupValidationForInput = this._setupValidationForInput.bind(this);
    }

    /** Retourne la configuration par défaut (sans les validateurs). */
    getDefaultConfig() {
        return {
            validateAttribute: 'th-validate',   // Attribut HTML sur <th> contenant les règles JSON
            invalidClass: 'invalid',          // Classe CSS pour les <td> invalides
            errorClass: 'validation-error',   // Classe CSS pour le conteneur du message d'erreur
            debug: false,                     // Activer les logs de débogage
            validators: {}                    // Sera peuplé par getDefaultValidators
        };
    }

    /** Retourne les validateurs intégrés par défaut. */
    getDefaultValidators() {
        return {
            /** @type {function(*, boolean, HTMLTableCellElement?): (boolean|string)} */
            required: (value, isRequired, cell) => {
                if (isRequired === true && (value === null || value === undefined || String(value).trim() === '')) {
                    return 'Ce champ est requis.';
                }
                return true;
            },
            /** @type {function(string, {maxLength: number}, HTMLTableCellElement?): (boolean|string)} */
            maxLength: (value, config, cell) => {
                if (config && typeof config.maxLength === 'number') {
                    if (value != null && String(value).length > config.maxLength) {
                        return `Maximum ${config.maxLength} caractères.`;
                    }
                } else {
                     this.logger?.warn(`[ValidationPlugin] Config invalide pour maxLength dans ${cell?.id || 'cellule inconnue'}:`, config);
                }
                return true;
            },
            /** @type {function(string, {minLength: number}, HTMLTableCellElement?): (boolean|string)} */
            minLength: (value, config, cell) => {
                if (config && typeof config.minLength === 'number') {
                    // Valide seulement si une valeur non vide est présente
                    const stringValue = String(value ?? '').trim();
                    if (stringValue && stringValue.length < config.minLength) {
                        return `Minimum ${config.minLength} caractères.`;
                    }
                } else {
                    this.logger?.warn(`[ValidationPlugin] Config invalide pour minLength dans ${cell?.id || 'cellule inconnue'}:`, config);
                }
                return true;
            },
            /** @type {function(*, {min?: number, max?: number, integer?: boolean, step?: number|string}, HTMLTableCellElement?): (boolean|string)} */
            number: (value, config = {}, cell) => {
                if (value === null || value === undefined || String(value).trim() === '') return true; // Permet vide sauf si 'required'
                const num = Number(value);
                if (isNaN(num)) return 'Doit être un nombre valide.';
                if (config.min !== undefined && num < config.min) return `Doit être >= ${config.min}.`;
                if (config.max !== undefined && num > config.max) return `Doit être <= ${config.max}.`;
                if (config.integer === true && !Number.isInteger(num)) return 'Doit être un nombre entier.';
                if (config.step && config.step !== 'any') {
                    const step = Number(config.step);
                    const minValue = config.min ?? 0;
                    if (!isNaN(step) && step > 0) {
                        const tolerance = 1e-10; // Tolérance pour erreurs flottantes
                        if (Math.abs((num - minValue) % step) > tolerance && Math.abs(step - ((num - minValue) % step)) > tolerance) {
                            return `Doit être un multiple de ${step}` + (config.min !== undefined ? ` à partir de ${minValue}`: '');
                        }
                    }
                }
                return true;
            },
            /** @type {function(string, boolean, HTMLTableCellElement?): (boolean|string)} */
            email: (value, isActive, cell) => {
                if (!isActive || !value) return true; // Ne valide que si activé et non vide
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(String(value))) return 'Adresse email invalide.';
                return true;
            },
            /** @type {function(string, {minDate?: string, maxDate?: string}, HTMLTableCellElement?): (boolean|string)} */
            date: (value, config = {}, cell) => {
                if (!value) return true; // Permet vide sauf si 'required'
                const date = new Date(String(value));
                if (isNaN(date.getTime())) return 'Date invalide.';
                if (config.minDate) {
                    const minDate = new Date(config.minDate);
                    if (!isNaN(minDate.getTime())) {
                        minDate.setHours(0, 0, 0, 0);
                        const checkDate = new Date(date); checkDate.setHours(0,0,0,0);
                        if (checkDate < minDate) return `Date >= ${config.minDate}.`;
                    } else { this.logger?.warn(`[ValidationPlugin] minDate invalide: ${config.minDate}`); }
                }
                if (config.maxDate) {
                    const maxDate = new Date(config.maxDate);
                    if (!isNaN(maxDate.getTime())) {
                        maxDate.setHours(23, 59, 59, 999);
                        if (date > maxDate) return `Date <= ${config.maxDate}.`;
                    } else { this.logger?.warn(`[ValidationPlugin] maxDate invalide: ${config.maxDate}`); }
                }
                return true;
            },
            /** @type {function(string, {pattern: string, patternMessage?: string, flags?: string}, HTMLTableCellElement?): (boolean|string)} */
            regex: (value, config = {}, cell) => {
                if (!value || !config.pattern) return true; // Permet vide, ou si pas de pattern
                try {
                    const regex = new RegExp(config.pattern, config.flags || '');
                    if (!regex.test(String(value))) {
                        return config.patternMessage || 'Format invalide.';
                    }
                    return true;
                } catch (e) {
                     this.logger?.error(`[ValidationPlugin] Regex invalide: ${config.pattern}`, e);
                     return 'Erreur interne de validation (regex).';
                }
            }
        };
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou le plugin Edit requis n'est pas valide/trouvé.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('ValidationPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Validation...');

        // 1. Obtenir l'instance du plugin Edit (dépendance)
        try {
            this.editPlugin = this.table.getPlugin('Edit'); // Utilise getPlugin de TableInstance
        } catch (error) {
             this.logger.error(`Erreur lors de la récupération du plugin Edit: ${error.message}`);
             throw new Error(`Le plugin 'Edit' est requis par ValidationPlugin mais n'a pas pu être récupéré.`);
        }
        this.debug("Plugin 'Edit' trouvé.");

        // 2. Vérifier si Edit expose les hooks nécessaires
        if (typeof this.editPlugin.addHook !== 'function' || typeof this.editPlugin.removeHook !== 'function') {
             const errorMsg = "L'instance du plugin 'Edit' ne supporte pas les hooks (méthode 'addHook'/'removeHook' manquante). ValidationPlugin ne peut pas s'intégrer.";
             this.logger.error(errorMsg);
             throw new Error(errorMsg);
        }
        this.debug("Le plugin 'Edit' expose les méthodes de hook nécessaires.");

        // 3. Détecter les colonnes avec validation
        this.detectValidateColumns();

        // 4. S'enregistrer aux hooks du plugin Edit
        this.registerWithEditPlugin();

        this.debug('Plugin Validation initialisé.');
    }

    /**
     * S'enregistre aux hooks du plugin Edit pour intercepter les événements clés.
     */
    registerWithEditPlugin() {
        if (!this.editPlugin) return;
        this.debug("Enregistrement aux hooks du plugin Edit ('beforeSave', 'afterEdit').");
        // Utilise le namespace 'Validation' pour pouvoir se désenregistrer proprement
        this.editPlugin.addHook('beforeSave', this._validateBeforeSave, 'Validation');
        this.editPlugin.addHook('afterEdit', this._setupValidationForInput, 'Validation');
    }

    /**
     * Détecte les colonnes ayant l'attribut de validation et parse leur configuration JSON.
     */
    detectValidateColumns() {
        if (!this.table?.element) return;
        this.validateColumns.clear(); // Réinitialiser

        const headers = this.table.element.querySelectorAll(`thead th[${this.config.validateAttribute}]`);
        this.debug(`Détection des colonnes de validation via [${this.config.validateAttribute}]... Trouvé: ${headers.length}`);

        headers.forEach((header) => {
            const columnIndex = header.cellIndex;
            if (columnIndex === -1) {
                 this.logger.warn(`Impossible de déterminer l'index pour l'en-tête avec validation: ${header.id || header.textContent}`);
                 return;
            }
            const columnId = header.id || `col_${columnIndex}`; // Utiliser ID ou fallback

            const validateConfigJson = header.getAttribute(this.config.validateAttribute);
            if (validateConfigJson) {
                try {
                    const config = JSON.parse(validateConfigJson);
                    if (typeof config === 'object' && config !== null) {
                        this.validateColumns.set(columnIndex, config);
                        this.debug(`Configuration validation détectée pour colonne ${columnIndex} (${columnId}):`, config);
                    } else {
                         this.logger.error(`Config JSON invalide (non-objet) pour [${this.config.validateAttribute}] sur colonne ${columnIndex} (${columnId}). Ignoré.`);
                    }
                } catch (e) {
                    this.logger.error(`Erreur parsing JSON pour [${this.config.validateAttribute}] sur colonne ${columnIndex} (${columnId}): ${e.message}. Config: "${validateConfigJson}". Ignoré.`);
                }
            } else {
                 this.debug(`Attribut [${this.config.validateAttribute}] présent mais vide pour colonne ${columnIndex} (${columnId}).`);
            }
        });
    }

    // -------------------------------------------------------------------------
    // Logique de Validation (appelée par les hooks de Edit)
    // -------------------------------------------------------------------------

    /**
     * Hook `beforeSave` de Edit: Valide la nouvelle valeur avant sauvegarde.
     * @param {HTMLTableCellElement} cell
     * @param {string} newValue
     * @param {string} oldValue
     * @returns {boolean} `false` pour annuler la sauvegarde.
     * @private
     */
    _validateBeforeSave(cell, newValue, oldValue) {
        const columnIndex = cell.cellIndex;
        const validationConfig = this.validateColumns.get(columnIndex);
        if (!validationConfig) return true; // Pas de validation pour cette colonne

        this.debug(`Validation (beforeSave) pour ${cell.id}, nouvelle valeur: "${newValue}"`);
        const isValid = this.validateValue(cell, newValue, validationConfig);

        if (!isValid) {
            this.debug(`Validation échouée pour ${cell.id}. Sauvegarde annulée.`);
            // Optionnel: Remettre le focus
            const input = cell.querySelector(`.${this.editPlugin?.config?.inputClass || 'edit-input'}`);
            if (input && document.activeElement !== input) {
                 requestAnimationFrame(() => { input.focus(); input.select(); });
            }
        } else {
            this.debug(`Validation réussie pour ${cell.id}.`);
            this.clearValidationError(cell); // Assurer que l'erreur est effacée
        }
        return isValid;
    }

    /**
     * Valide une valeur par rapport à une configuration. Affiche/masque l'erreur.
     * @param {HTMLTableCellElement} cell
     * @param {*} value
     * @param {object} config - Configuration des règles pour la colonne.
     * @returns {boolean} True si valide.
     */
    validateValue(cell, value, config) {
        let firstErrorMessage = null;
        for (const [ruleName, ruleConfig] of Object.entries(config)) {
            const validatorFn = this.config.validators[ruleName];
            if (typeof validatorFn === 'function') {
                try {
                    const result = validatorFn(value, ruleConfig, cell);
                    if (result !== true && typeof result === 'string') {
                        firstErrorMessage = result;
                        this.debug(`Règle '${ruleName}' échouée pour ${cell.id}: ${firstErrorMessage}`);
                        break; // Première erreur suffit
                    } else if (result !== true) {
                         this.logger.warn(`Validateur '${ruleName}' a retourné une valeur inattendue:`, result);
                         firstErrorMessage = "Erreur de validation.";
                         break;
                    }
                } catch (error) {
                     this.logger.error(`Erreur validateur '${ruleName}' pour ${cell.id}: ${error.message}`, error);
                     firstErrorMessage = "Erreur interne validation.";
                     break;
                }
            } else {
                this.logger.warn(`Validateur non trouvé: '${ruleName}' (colonne ${cell.cellIndex}).`);
            }
        }

        if (firstErrorMessage) {
            this.showValidationError(cell, firstErrorMessage);
            return false;
        } else {
            this.clearValidationError(cell);
            return true;
        }
    }

    /** Affiche l'erreur sur la cellule. @param {HTMLTableCellElement} cell @param {string} errorMessage */
    showValidationError(cell, errorMessage) {
        if (!cell) return;
        cell.classList.add(this.config.invalidClass);
        let errorContainer = cell.querySelector(`.${this.config.errorClass}`);
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.className = this.config.errorClass;
            errorContainer.setAttribute('role', 'alert');
            errorContainer.style.display = 'none';
            const wrapper = cell.querySelector(`.${this.table?.config?.wrapCellClass || 'cell-wrapper'}`);
            // Insérer après le wrapper ou à la fin
            wrapper ? wrapper.insertAdjacentElement('afterend', errorContainer) : cell.appendChild(errorContainer);
        }
        errorContainer.textContent = errorMessage;
        errorContainer.style.display = 'block';
    }

    /** Masque l'erreur sur la cellule. @param {HTMLTableCellElement} cell */
    clearValidationError(cell) {
        if (!cell) return;
        cell.classList.remove(this.config.invalidClass);
        const errorContainer = cell.querySelector(`.${this.config.errorClass}`);
        if (errorContainer) {
            errorContainer.style.display = 'none';
            errorContainer.textContent = '';
        }
    }

    /**
     * Hook `afterEdit` de Edit: Configure l'input avec validation HTML5 et temps réel.
     * @param {HTMLTableCellElement} cell
     * @param {HTMLInputElement} input
     * @param {string} currentValue
     * @private
     */
    _setupValidationForInput(cell, input, currentValue) {
        const columnIndex = cell.cellIndex;
        const validationConfig = this.validateColumns.get(columnIndex);
        if (!validationConfig) return;

        this.debug(`Configuration validation (afterEdit) pour input ${cell.id}`);

        // --- Attributs HTML5 ---
        if (validationConfig.number) {
            input.type = 'number';
            if (validationConfig.number.min !== undefined) input.min = validationConfig.number.min;
            if (validationConfig.number.max !== undefined) input.max = validationConfig.number.max;
            input.step = validationConfig.number.step !== undefined ? String(validationConfig.number.step) : 'any';
            if (validationConfig.number.integer) input.step = '1';
        } else if (validationConfig.email) input.type = 'email';
        else if (validationConfig.date) {
            input.type = 'date';
            if (validationConfig.date.minDate) input.min = validationConfig.date.minDate;
            if (validationConfig.date.maxDate) input.max = validationConfig.date.maxDate;
        } else input.type = 'text';

        if (validationConfig.required === true) input.required = true;
        if (validationConfig.maxLength?.maxLength) input.maxLength = validationConfig.maxLength.maxLength;
        if (validationConfig.minLength?.minLength) input.minLength = validationConfig.minLength.minLength;
        if (validationConfig.regex?.pattern) {
            input.pattern = validationConfig.regex.pattern;
            if (validationConfig.regex.patternMessage) input.title = validationConfig.regex.patternMessage;
        }
        input.setAttribute('aria-invalid', 'false'); // Initial state

        // --- Validation temps réel ---
        // Nettoyer l'ancien listener s'il existe (sécurité pour refresh)
        if (input._validationInputHandler) {
             input.removeEventListener('input', input._validationInputHandler);
        }
        // Ajouter le nouveau listener
        const realtimeValidationHandler = () => {
            const isValid = this.validateValue(cell, input.value, validationConfig);
            input.setAttribute('aria-invalid', String(!isValid));
        };
        input.addEventListener('input', realtimeValidationHandler);
        input._validationInputHandler = realtimeValidationHandler; // Stocker pour nettoyage

        // Valider la valeur initiale
        const initialIsValid = this.validateValue(cell, currentValue, validationConfig);
        input.setAttribute('aria-invalid', String(!initialIsValid));
    }

    // -------------------------------------------------------------------------
    // API Publique
    // -------------------------------------------------------------------------

    /**
     * Enregistre un nouveau validateur personnalisé ou surcharge un existant pour cette instance.
     * @param {string} name - Nom de la règle (utilisé dans `th-validate`).
     * @param {function(*, object, HTMLTableCellElement): (boolean|string)} validatorFn - Fonction de validation.
     * @returns {this} L'instance pour chaînage.
     */
    registerValidator(name, validatorFn) {
        if (typeof validatorFn !== 'function') {
            this.logger.error(`Tentative d'enregistrement d'un validateur invalide pour '${name}'. Fonction requise.`);
            return this;
        }
        // Ajouter/Surcharger dans la config de l'instance
        this.config.validators[name] = validatorFn;
        this.debug(`Validateur personnalisé '${name}' enregistré/mis à jour pour cette instance.`);
        return this;
    }

    // -------------------------------------------------------------------------
    // Cycle de vie
    // -------------------------------------------------------------------------

    /** Rafraîchit le plugin (redétecte les colonnes). */
    refresh() {
        this.debug('Rafraîchissement du plugin Validation...');
        this.detectValidateColumns();
        // Pas besoin de se réenregistrer aux hooks, c'est fait à l'init.
        this.debug('Rafraîchissement Validation terminé.');
    }

    /** Nettoie les ressources (désenregistrement des hooks). */
    destroy() {
        this.debug('Destruction du plugin Validation...');
        // Se désenregistrer des hooks du plugin Edit
        if (this.editPlugin && typeof this.editPlugin.removeHook === 'function') {
            try {
                // Utilise le namespace 'Validation'
                this.editPlugin.removeHook('beforeSave', 'Validation');
                this.editPlugin.removeHook('afterEdit', 'Validation');
                this.debug("Désenregistrement des hooks ('beforeSave', 'afterEdit') du plugin Edit.");
            } catch (error) {
                 this.logger.error(`Erreur lors du désenregistrement des hooks d'Edit: ${error.message}`, error);
            }
        } else {
             this.logger.warn("Impossible de se désenregistrer des hooks d'Edit (plugin/méthode manquant).");
        }

        // Nettoyer les références
        this.validateColumns.clear();
        this.editPlugin = null;
        this.table = null;
        this.debug('Plugin Validation détruit.');
    }
}
