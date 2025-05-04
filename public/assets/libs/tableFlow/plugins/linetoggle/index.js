/**
 * Plugin LineToggle pour TableFlow
 * Permet de modifier dynamiquement les classes CSS des lignes d'un tableau
 * en fonction de la valeur des cellules.
 * 
 * @requires EditPlugin
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class LineTogglePlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.LINE_TOGGLE;
        this.dependencies = config.dependencies;
        this.isInitialized = false;

        // Référence au plugin Edit (requis)
        this.editPlugin = null;

        // Cache pour les performances
        this.cache = {
            rules: new Map(), // Cache des règles compilées par colonne
            states: new Map() // Cache des états des lignes
        };

        // État interne
        this.state = {
            enabled: this.config.enabled,
            updating: false,
            pendingUpdates: new Set()
        };

        // Debounce pour les mises à jour
        this.updateDebounceTimeout = null;

        // Lier les méthodes pour les hooks et les listeners
        this._bindMethods();
    }

    /**
     * Fusionne les configurations par défaut et utilisateur
     * @private
     */
    _mergeConfigs(baseConfig, userConfig) {
        const merged = { ...baseConfig };
        for (const key in userConfig) {
            if (Object.prototype.hasOwnProperty.call(userConfig, key)) {
                const value = userConfig[key];
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    merged[key] = this._mergeConfigs(baseConfig[key] || {}, value);
                } else {
                    merged[key] = value;
                }
            }
        }
        return merged;
    }

    /**
     * Lie les méthodes utilisées comme callbacks
     * @private
     */
    _bindMethods() {
        // Handlers pour EditPlugin
        this.handleCellChange = this.handleCellChange.bind(this);
        this.handleRowAdd = this.handleRowAdd.bind(this);
        
        // Handlers pour les événements DOM
        this.handleMutation = this.handleMutation.bind(this);
        
        // Handlers pour la mise à jour
        this.processUpdates = this.processUpdates.bind(this);
    }

    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin LineToggle déjà initialisé');
            return;
        }

        try {
            if (!this.tableFlow) {
                throw new Error('Instance TableFlow requise');
            }

            // Récupérer EditPlugin (requis)
            this.editPlugin = this.tableFlow.getPlugin('Edit');
            if (!this.editPlugin) {
                throw new Error('EditPlugin non trouvé');
            }

            // Initialiser l'observateur de mutations si nécessaire
            if (this.config.apply.onEdit) {
                this.initMutationObserver();
            }

            // S'enregistrer aux hooks d'EditPlugin
            this.registerWithEditPlugin();

            // Appliquer les règles initiales si nécessaire
            if (this.config.apply.onInit) {
                await this.applyAllRules();
            }

            // Charger les règles sauvegardées si la persistance est activée
            if (this.config.storage.enabled) {
                await this.loadRules();
            }

            this.isInitialized = true;
            this.logger.info('Plugin LineToggle initialisé avec succès');
            this.metrics.increment('plugin_linetoggle_init');
        } catch (error) {
            this.errorHandler.handle(error, 'linetoggle_init');
            throw error;
        }
    }

    /**
     * Initialise l'observateur de mutations pour le suivi des changements DOM
     * @private
     */
    initMutationObserver() {
        this.observer = new MutationObserver(this.handleMutation);
        this.observer.observe(this.tableFlow.table, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true,
            attributeFilter: ['data-value']
        });
    }

    /**
     * S'enregistre aux hooks nécessaires d'EditPlugin
     * @private
     */
    registerWithEditPlugin() {
        if (!this.editPlugin) return;

        // Hook pour les changements de cellule
        this.editPlugin.on('cell:change', this.handleCellChange);
        
        // Hook pour l'ajout de ligne
        this.editPlugin.on('row:add', this.handleRowAdd);
    }

    async handleCellChange(event) {
        if (!this.state.enabled || !this.config.apply.onChange) return;

        try {
            const { cell, value, columnId } = event;
            if (!cell || !columnId) return;

            // Vérifier si la colonne a des règles
            const rules = this.getRulesForColumn(columnId);
            if (!rules || rules.length === 0) return;

            // Ajouter la mise à jour à la file d'attente
            const row = cell.closest('tr');
            if (row) {
                this.queueUpdate(row, columnId, value);
            }

            this.metrics.increment('linetoggle_cell_changed');
        } catch (error) {
            this.errorHandler.handle(error, 'linetoggle_handle_cell_change');
        }
    }

    /**
     * Gère l'ajout de nouvelles lignes
     * @private
     */
    handleRowAdd(event) {
        if (!this.state.enabled || !this.config.apply.onAdd) return;

        const { row } = event;
        if (!row) return;

        // Appliquer les règles à la nouvelle ligne
        this.applyRulesToRow(row);
    }

    /**
     * Gère les mutations DOM
     * @private
     */
    handleMutation(mutations) {
        if (!this.state.enabled || !this.config.apply.onEdit) return;

        for (const mutation of mutations) {
            // Ignorer les mutations causées par nos propres changements
            if (this.state.updating) continue;

            if (mutation.type === 'attributes' && mutation.attributeName === 'data-value') {
                const cell = mutation.target;
                const row = cell.closest('tr');
                const columnId = this.getColumnId(cell);

                if (row && columnId) {
                    const value = cell.getAttribute('data-value');
                    this.queueUpdate(row, columnId, value);
                }
            }
        }
    }

    /**
     * Ajoute une mise à jour à la file d'attente
     * @private
     */
    queueUpdate(row, columnId, value) {
        this.state.pendingUpdates.add({ row, columnId, value });

        // Debounce les mises à jour
        if (this.updateDebounceTimeout) {
            clearTimeout(this.updateDebounceTimeout);
        }

        this.updateDebounceTimeout = setTimeout(
            this.processUpdates,
            this.config.performance.debounceDelay
        );
    }

    async processUpdates() {
        if (this.state.updating || this.state.pendingUpdates.size === 0) return;

        this.state.updating = true;

        try {
            // Grouper les mises à jour par ligne
            const updatesByRow = new Map();
            
            for (const update of this.state.pendingUpdates) {
                const { row, columnId, value } = update;
                if (!updatesByRow.has(row)) {
                    updatesByRow.set(row, new Map());
                }
                updatesByRow.get(row).set(columnId, value);
            }

            // Appliquer les mises à jour groupées
            for (const [row, updates] of updatesByRow) {
                await this.applyRulesToRow(row, updates);
            }

            // Vider la file d'attente
            this.state.pendingUpdates.clear();

            this.metrics.increment('linetoggle_updates_processed');
        } catch (error) {
            this.errorHandler.handle(error, 'linetoggle_process_updates');
        } finally {
            this.state.updating = false;
        }
    }

    /**
     * Récupère les règles pour une colonne
     * @private
     */
    getRulesForColumn(columnId) {
        // Vérifier le cache
        if (this.cache.rules.has(columnId)) {
            return this.cache.rules.get(columnId);
        }

        const rules = [];

        // Règles de la configuration
        if (this.config.rules[columnId]) {
            rules.push(...this.config.rules[columnId]);
        }

        // Règles de l'attribut HTML
        const header = this.tableFlow.table.querySelector(`th#${columnId}`);
        if (header && header.hasAttribute(this.config.toggleAttribute)) {
            try {
                const attrRules = JSON.parse(header.getAttribute(this.config.toggleAttribute));
                if (Array.isArray(attrRules)) {
                    rules.push(...attrRules);
                }
            } catch (error) {
                this.tableFlow.logger.warn(
                    `Règles invalides dans l'attribut pour ${columnId}:`,
                    error
                );
            }
        }

        // Mettre en cache
        if (this.config.performance.cacheRules) {
            this.cache.rules.set(columnId, rules);
        }

        return rules;
    }

    async applyRulesToRow(row, updates = null) {
        try {
            const rowId = row.getAttribute('data-row-id');
            if (!rowId) return;

            const currentState = this.cache.states.get(rowId) || new Set();
            const newState = new Set();

            // Appliquer les règles pour chaque colonne
            for (const column of this.tableFlow.getColumns()) {
                const columnId = column.getAttribute('data-column-id');
                if (!columnId) continue;

                const cell = row.querySelector(`[data-column-id="${columnId}"]`);
                if (!cell) continue;

                const value = updates?.get(columnId) || cell.getAttribute('data-value');
                const rules = this.getRulesForColumn(columnId);

                if (rules) {
                    for (const rule of rules) {
                        if (this.ruleMatches(rule, value)) {
                            newState.add(rule.class);
                        }
                    }
                }
            }

            // Calculer les changements
            const addedClasses = [...newState].filter(cls => !currentState.has(cls));
            const removedClasses = [...currentState].filter(cls => !newState.has(cls));

            // Appliquer les changements
            if (addedClasses.length > 0 || removedClasses.length > 0) {
                row.classList.remove(...removedClasses);
                row.classList.add(...addedClasses);

                // Mettre à jour le cache
                this.cache.states.set(rowId, newState);

                // Annoncer les changements
                await this.announceChanges(row, addedClasses, removedClasses);
            }

            this.metrics.increment('linetoggle_rules_applied');
        } catch (error) {
            this.errorHandler.handle(error, 'linetoggle_apply_rules');
        }
    }

    /**
     * Vérifie si une règle correspond à une valeur
     * @private
     */
    ruleMatches(rule, value) {
        // Valider la règle si un validateur est configuré
        if (typeof this.config.hooks.validateRule === 'function') {
            if (!this.config.hooks.validateRule(rule, value)) {
                return false;
            }
        }

        // Valeur exacte
        if (rule.value !== undefined) {
            return String(rule.value) === String(value);
        }

        // Liste de valeurs
        if (Array.isArray(rule.values)) {
            return rule.values.some(v => String(v) === String(value));
        }

        // Expression régulière
        if (rule.pattern) {
            try {
                const regex = new RegExp(rule.pattern, rule.flags || '');
                return regex.test(String(value));
            } catch (error) {
                this.tableFlow.logger.warn('Expression régulière invalide:', error);
                return false;
            }
        }

        return false;
    }

    async announceChanges(row, addedClasses, removedClasses) {
        try {
            if (this.config.accessibility.announceChanges) {
                const message = [];
                
                if (addedClasses.length > 0) {
                    message.push(`Classes ajoutées : ${addedClasses.join(', ')}`);
                }
                
                if (removedClasses.length > 0) {
                    message.push(`Classes supprimées : ${removedClasses.join(', ')}`);
                }

                if (message.length > 0) {
                    const announcement = document.createElement('div');
                    announcement.setAttribute('role', 'status');
                    announcement.setAttribute('aria-live', 'polite');
                    announcement.className = 'sr-only';
                    announcement.textContent = message.join('. ');
                    document.body.appendChild(announcement);
                    setTimeout(() => announcement.remove(), 1000);
                }
            }

            this.metrics.increment('linetoggle_changes_announced');
        } catch (error) {
            this.errorHandler.handle(error, 'linetoggle_announce_changes');
        }
    }

    /**
     * Applique toutes les règles au tableau
     */
    async applyAllRules() {
        const rows = this.tableFlow.table.querySelectorAll('tbody tr');
        for (const row of rows) {
            await this.applyRulesToRow(row);
        }
    }

    /**
     * Active ou désactive le plugin
     */
    async toggle(enabled = null) {
        try {
            const newState = enabled !== null ? enabled : !this.state.enabled;
            
            if (newState === this.state.enabled) return;

            this.state.enabled = newState;

            if (newState) {
                await this.applyAllRules();
            } else {
                this.removeAllRules();
            }

            this.tableFlow.emit('linetoggle:toggled', { enabled: newState });
            this.metrics.increment('linetoggle_toggled');
        } catch (error) {
            this.errorHandler.handle(error, 'linetoggle_toggle');
        }
    }

    /**
     * Supprime toutes les règles appliquées
     */
    removeAllRules() {
        const rows = this.tableFlow.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            // Retirer toutes les classes prédéfinies
            Object.values(this.config.classNames).forEach(className => {
                row.classList.remove(className);
            });
        });

        // Vider le cache
        this.cache.states.clear();
    }

    /**
     * Sauvegarde les règles si la persistance est activée
     */
    saveRules() {
        if (!this.config.storage.enabled) return;

        try {
            const storage = this.config.storage.type === 'sessionStorage'
                ? sessionStorage
                : localStorage;

            const rules = {
                ...this.config.rules,
                timestamp: Date.now(),
                version: this.version
            };

            storage.setItem(this.config.storage.key, JSON.stringify(rules));
        } catch (error) {
            this.tableFlow.logger.error('Erreur lors de la sauvegarde des règles:', error);
        }
    }

    /**
     * Charge les règles sauvegardées
     */
    async loadRules() {
        if (!this.config.storage.enabled) return;

        try {
            const storage = this.config.storage.type === 'sessionStorage'
                ? sessionStorage
                : localStorage;

            const saved = storage.getItem(this.config.storage.key);
            if (saved) {
                const rules = JSON.parse(saved);
                // Vérifier la version
                if (rules.version === this.version) {
                    delete rules.timestamp;
                    delete rules.version;
                    this.config.rules = rules;
                    this.cache.rules.clear();
                    await this.applyAllRules();
                }
            }
        } catch (error) {
            this.tableFlow.logger.error('Erreur lors du chargement des règles:', error);
        }
    }

    /**
     * Nettoie les ressources utilisées par le plugin
     */
    async destroy() {
        if (!this.isInitialized) return;

        try {
            if (this.observer) {
                this.observer.disconnect();
            }

            if (this.editPlugin) {
                this.editPlugin.off('cell:change', this.handleCellChange);
                this.editPlugin.off('row:add', this.handleRowAdd);
            }

            this.cache.rules.clear();
            this.cache.states.clear();
            this.state.pendingUpdates.clear();

            if (this.updateDebounceTimeout) {
                clearTimeout(this.updateDebounceTimeout);
            }

            this.isInitialized = false;
            this.logger.info('Plugin LineToggle détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'linetoggle_destroy');
        } finally {
            super.destroy();
        }
    }
}