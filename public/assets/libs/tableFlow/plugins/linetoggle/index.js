/**
 * Plugin LineToggle pour TableFlow
 * Permet de modifier dynamiquement les classes CSS des lignes d'un tableau
 * en fonction de la valeur des cellules.
 * 
 * @requires EditPlugin
 */
import { config } from './config.js';

export class LineTogglePlugin {
    constructor(tableFlow) {
        this.tableFlow = tableFlow;
        this.name = config.name;
        this.version = config.version;
        this.type = config.type;
        this.dependencies = config.dependencies;
        this.config = this._mergeConfigs(config, tableFlow?.config?.plugins?.linetoggle || {});

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

    /**
     * Initialise le plugin
     * @throws {Error} Si EditPlugin n'est pas disponible
     */
    init() {
        if (!this.tableFlow) {
            throw new Error('Instance TableFlow requise');
        }

        // Récupérer EditPlugin (requis)
        try {
            this.editPlugin = this.tableFlow.getPlugin('Edit');
            if (!this.editPlugin) {
                throw new Error('EditPlugin non trouvé');
            }
        } catch (error) {
            this.tableFlow.logger.error('LineTogglePlugin requiert EditPlugin');
            throw error;
        }

        // Initialiser l'observateur de mutations si nécessaire
        if (this.config.apply.onEdit) {
            this.initMutationObserver();
        }

        // S'enregistrer aux hooks d'EditPlugin
        this.registerWithEditPlugin();

        // Appliquer les règles initiales si nécessaire
        if (this.config.apply.onInit) {
            this.applyAllRules();
        }

        // Charger les règles sauvegardées si la persistance est activée
        if (this.config.storage.enabled) {
            this.loadRules();
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

    /**
     * Gère les changements de cellule
     * @private
     */
    handleCellChange(event) {
        if (!this.state.enabled || !this.config.apply.onChange) return;

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

    /**
     * Traite les mises à jour en attente
     * @private
     */
    processUpdates() {
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
                this.applyRulesToRow(row, updates);
            }

            // Vider la file d'attente
            this.state.pendingUpdates.clear();

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

    /**
     * Applique les règles à une ligne
     * @private
     */
    applyRulesToRow(row, updates = null) {
        if (!row) return;

        // Émettre l'événement beforeApply
        const beforeEvent = { row, updates, preventDefault: false };
        this.tableFlow.emit('linetoggle:beforeApply', beforeEvent);
        if (beforeEvent.preventDefault) return;

        const appliedRules = [];
        const addedClasses = new Set();
        const removedClasses = new Set();

        // Pour chaque colonne avec des règles
        const headers = this.tableFlow.table.querySelectorAll(`th[${this.config.toggleAttribute}]`);
        headers.forEach(header => {
            const columnId = header.id;
            const rules = this.getRulesForColumn(columnId);
            if (!rules || rules.length === 0) return;

            // Récupérer la valeur (soit des updates, soit de la cellule)
            let value;
            if (updates && updates.has(columnId)) {
                value = updates.get(columnId);
            } else {
                const cell = row.querySelector(`td[data-column="${columnId}"]`);
                value = cell?.getAttribute('data-value') || cell?.textContent.trim();
            }

            // Appliquer chaque règle
            rules.forEach(rule => {
                if (this.ruleMatches(rule, value)) {
                    appliedRules.push({ columnId, rule, value });

                    // Ajouter les classes
                    if (rule.addClass) {
                        const classes = Array.isArray(rule.addClass) 
                            ? rule.addClass 
                            : [rule.addClass];
                        classes.forEach(cls => {
                            if (cls) {
                                row.classList.add(cls);
                                addedClasses.add(cls);
                            }
                        });
                    }

                    // Retirer les classes
                    if (rule.removeClass) {
                        const classes = Array.isArray(rule.removeClass)
                            ? rule.removeClass
                            : [rule.removeClass];
                        classes.forEach(cls => {
                            if (cls) {
                                row.classList.remove(cls);
                                removedClasses.add(cls);
                            }
                        });
                    }
                }
            });
        });

        // Ajouter la classe d'animation si nécessaire
        if (this.config.ui.animate && (addedClasses.size > 0 || removedClasses.size > 0)) {
            row.classList.add('tf-row-animate');
            setTimeout(() => {
                row.classList.remove('tf-row-animate');
            }, 600); // Durée de l'animation
        }

        // Mettre à jour le cache d'état
        if (this.config.performance.cacheRules) {
            this.cache.states.set(row.id, {
                appliedRules,
                addedClasses: Array.from(addedClasses),
                removedClasses: Array.from(removedClasses),
                timestamp: Date.now()
            });
        }

        // Émettre l'événement afterApply
        this.tableFlow.emit('linetoggle:afterApply', {
            row,
            appliedRules,
            addedClasses: Array.from(addedClasses),
            removedClasses: Array.from(removedClasses)
        });

        // Annoncer les changements pour l'accessibilité
        if (this.config.accessibility.announceChanges && (addedClasses.size > 0 || removedClasses.size > 0)) {
            this.announceChanges(row, addedClasses, removedClasses);
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

    /**
     * Annonce les changements pour l'accessibilité
     * @private
     */
    announceChanges(row, addedClasses, removedClasses) {
        // Créer ou réutiliser l'élément d'annonce
        let announcer = document.getElementById('tf-linetoggle-announcer');
        if (!announcer) {
            announcer = document.createElement('div');
            announcer.id = 'tf-linetoggle-announcer';
            announcer.setAttribute('role', 'status');
            announcer.setAttribute('aria-live', 'polite');
            announcer.style.position = 'absolute';
            announcer.style.width = '1px';
            announcer.style.height = '1px';
            announcer.style.padding = '0';
            announcer.style.margin = '-1px';
            announcer.style.overflow = 'hidden';
            announcer.style.clip = 'rect(0, 0, 0, 0)';
            announcer.style.whiteSpace = 'nowrap';
            announcer.style.border = '0';
            document.body.appendChild(announcer);
        }

        // Construire le message
        const rowId = row.getAttribute('data-row-id') || row.id || 'ligne';
        const changes = [];
        
        if (addedClasses.size > 0) {
            changes.push(`Ajout des états: ${Array.from(addedClasses).join(', ')}`);
        }
        if (removedClasses.size > 0) {
            changes.push(`Suppression des états: ${Array.from(removedClasses).join(', ')}`);
        }

        announcer.textContent = `${rowId}: ${changes.join('. ')}`;
    }

    /**
     * Applique toutes les règles au tableau
     */
    applyAllRules() {
        const rows = this.tableFlow.table.querySelectorAll('tbody tr');
        rows.forEach(row => this.applyRulesToRow(row));
    }

    /**
     * Active ou désactive le plugin
     */
    toggle(enabled = null) {
        const newState = enabled === null ? !this.state.enabled : Boolean(enabled);
        
        if (newState === this.state.enabled) return;
        
        this.state.enabled = newState;
        
        if (newState) {
            this.applyAllRules();
        } else {
            this.removeAllRules();
        }

        this.tableFlow.emit('linetoggle:stateChange', {
            enabled: newState
        });
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
    loadRules() {
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
                    this.applyAllRules();
                }
            }
        } catch (error) {
            this.tableFlow.logger.error('Erreur lors du chargement des règles:', error);
        }
    }

    /**
     * Nettoie les ressources utilisées par le plugin
     */
    destroy() {
        // Arrêter l'observateur de mutations
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        // Supprimer les écouteurs d'événements
        if (this.editPlugin) {
            this.editPlugin.off('cell:change', this.handleCellChange);
            this.editPlugin.off('row:add', this.handleRowAdd);
        }

        // Annuler les mises à jour en attente
        if (this.updateDebounceTimeout) {
            clearTimeout(this.updateDebounceTimeout);
            this.updateDebounceTimeout = null;
        }

        // Supprimer l'élément d'annonce
        const announcer = document.getElementById('tf-linetoggle-announcer');
        if (announcer) {
            announcer.remove();
        }

        // Nettoyer les caches
        this.cache.rules.clear();
        this.cache.states.clear();

        // Réinitialiser l'état
        this.state = null;
        this.editPlugin = null;
        this.tableFlow = null;
    }
}