/**
 * Module de styles conditionnels pour le plugin Style
 * Gère l'application de styles basée sur des conditions dynamiques
 */
export class ConditionalModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.isInitialized = false;
        
        // État local
        this.state = {
            conditionalStyles: new Map(),
            activeStyles: new Map(),
            isProcessing: false,
            lastEvaluation: null
        };
        
        // Cache pour les performances
        this.cache = {
            evaluationTimeout: null,
            lastEvaluationTime: 0,
            conditionResults: new Map(),
            styleCache: new Map()
        };
        
        // Lier les méthodes
        this._boundDataChangeHandler = this.handleDataChange.bind(this);
        this._boundCellChangeHandler = this.handleCellChange.bind(this);
        this._boundRowChangeHandler = this.handleRowChange.bind(this);
    }

    async init() {
        if (this.isInitialized) {
            this.plugin.logger.warn('Module Conditional déjà initialisé');
            return;
        }

        try {
            this.plugin.logger.info('Initialisation du module Conditional');
            
            // Configurer les écouteurs d'événements
            this.setupEventListeners();
            
            // Initialiser les styles par défaut
            await this.initializeDefaultStyles();
            
            this.isInitialized = true;
            this.plugin.metrics.increment('conditional_module_init');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_init');
            throw error;
        }
    }

    setupEventListeners() {
        try {
            // Événements de données
            this.plugin.tableFlow.on('data:change', this._boundDataChangeHandler);
            this.plugin.tableFlow.on('cell:change', this._boundCellChangeHandler);
            this.plugin.tableFlow.on('row:change', this._boundRowChangeHandler);
            
            // Ajouter les attributs ARIA
            const cells = this.plugin.tableFlow.table.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.setAttribute('data-conditional-style', 'false');
            });
            
            this.plugin.metrics.increment('conditional_event_listeners_setup');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_setup_listeners');
        }
    }

    async initializeDefaultStyles() {
        try {
            // Styles pour les conditions numériques
            const numericStyles = {
                positive: {
                    color: this.plugin.config.conditional.positiveColor || '#4CAF50',
                    fontWeight: 'bold'
                },
                negative: {
                    color: this.plugin.config.conditional.negativeColor || '#F44336',
                    fontWeight: 'bold'
                },
                zero: {
                    color: this.plugin.config.conditional.zeroColor || '#9E9E9E'
                }
            };
            
            // Styles pour les conditions de texte
            const textStyles = {
                empty: {
                    backgroundColor: this.plugin.config.conditional.emptyBackground || '#F5F5F5',
                    fontStyle: 'italic'
                },
                error: {
                    backgroundColor: this.plugin.config.conditional.errorBackground || '#FFEBEE',
                    color: this.plugin.config.conditional.errorColor || '#D32F2F'
                }
            };
            
            // Mettre en cache les styles
            this.cache.styleCache.set('numeric', numericStyles);
            this.cache.styleCache.set('text', textStyles);
            
            this.plugin.metrics.increment('conditional_styles_initialized');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_initialize_styles');
        }
    }

    async handleDataChange(event) {
        if (!this.isInitialized || this.state.isProcessing) return;

        try {
            const { data, element } = event;
            if (!data || !element) return;
            
            const startTime = performance.now();
            this.state.isProcessing = true;
            
            // Déclencher le hook beforeConditionEvaluation
            const beforeResult = await this.plugin.tableFlow.hooks.trigger('beforeConditionEvaluation', {
                element,
                data
            });
            
            if (beforeResult === false) return;
            
            // Évaluer les conditions
            await this.evaluateConditions(element, data);
            
            // Déclencher le hook afterConditionEvaluation
            await this.plugin.tableFlow.hooks.trigger('afterConditionEvaluation', {
                element,
                data,
                performance: {
                    duration: performance.now() - startTime
                }
            });
            
            this.plugin.metrics.increment('conditional_data_change');
            this.plugin.metrics.record('conditional_evaluation_duration', performance.now() - startTime);
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_handle_data_change');
        } finally {
            this.state.isProcessing = false;
        }
    }

    async handleCellChange(event) {
        if (!this.isInitialized) return;

        try {
            const { cell, value } = event;
            
            // Évaluer les conditions spécifiques aux cellules
            await this.evaluateCellConditions(cell, value);
            
            this.plugin.metrics.increment('conditional_cell_change');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_handle_cell_change');
        }
    }

    async handleRowChange(event) {
        if (!this.isInitialized) return;

        try {
            const { row, data } = event;
            
            // Évaluer les conditions pour chaque cellule de la ligne
            const cells = Array.from(row.cells);
            for (const cell of cells) {
                await this.evaluateCellConditions(cell, data[cell.dataset.column]);
            }
            
            this.plugin.metrics.increment('conditional_row_change');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_handle_row_change');
        }
    }

    async evaluateConditions(element, data) {
        try {
            // Vérifier le cache des résultats
            const cacheKey = JSON.stringify({ element: element.id, data });
            if (this.cache.conditionResults.has(cacheKey)) {
                const cachedResult = this.cache.conditionResults.get(cacheKey);
                if (Date.now() - cachedResult.timestamp < 1000) { // Cache valide pendant 1 seconde
                    return cachedResult.result;
                }
            }
            
            const appliedStyles = new Set();
            
            // Évaluer chaque condition
            for (const [styleId, { condition, style }] of this.state.conditionalStyles) {
                try {
                    const result = await condition(data);
                    
                    if (result) {
                        // Appliquer le style
                        const appliedStyleId = this.plugin.styleManager.applyStyle(element, style);
                        appliedStyles.add(appliedStyleId);
                        
                        // Mettre à jour les attributs ARIA
                        element.setAttribute('data-conditional-style', 'true');
                        if (style.description) {
                            element.setAttribute('aria-description', style.description);
                        }
                    } else {
                        // Supprimer le style si nécessaire
                        this.plugin.styleManager.removeStyle(element, styleId);
                    }
                } catch (error) {
                    this.plugin.errorHandler.handle(error, 'conditional_evaluate_condition');
                }
            }
            
            // Mettre à jour l'état
            this.state.activeStyles.set(element, appliedStyles);
            
            // Mettre en cache le résultat
            this.cache.conditionResults.set(cacheKey, {
                result: appliedStyles,
                timestamp: Date.now()
            });
            
            this.plugin.metrics.increment('conditional_conditions_evaluated');
            return appliedStyles;
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_evaluate_conditions');
            return new Set();
        }
    }

    async evaluateCellConditions(cell, value) {
        try {
            // Évaluer les conditions numériques
            if (typeof value === 'number') {
                const numericStyles = this.cache.styleCache.get('numeric');
                if (value > 0) {
                    await this.applyConditionalStyle(cell, numericStyles.positive);
                } else if (value < 0) {
                    await this.applyConditionalStyle(cell, numericStyles.negative);
                } else {
                    await this.applyConditionalStyle(cell, numericStyles.zero);
                }
            }
            
            // Évaluer les conditions de texte
            if (typeof value === 'string') {
                const textStyles = this.cache.styleCache.get('text');
                if (!value.trim()) {
                    await this.applyConditionalStyle(cell, textStyles.empty);
                }
            }
            
            this.plugin.metrics.increment('conditional_cell_conditions_evaluated');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_evaluate_cell_conditions');
        }
    }

    async applyConditionalStyle(element, style) {
        try {
            const styleId = this.plugin.styleManager.applyStyle(element, style);
            
            // Mettre à jour l'état
            const elementStyles = this.state.activeStyles.get(element) || new Set();
            elementStyles.add(styleId);
            this.state.activeStyles.set(element, elementStyles);
            
            // Mettre à jour les attributs ARIA
            element.setAttribute('data-conditional-style', 'true');
            if (style.description) {
                element.setAttribute('aria-description', style.description);
            }
            
            return styleId;
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_apply_style');
            return null;
        }
    }

    addConditionalStyle(condition, style) {
        try {
            const styleId = this.plugin.ruleEngine.addRule(condition, style);
            
            // Mettre à jour l'état
            this.state.conditionalStyles.set(styleId, { condition, style });
            
            // Invalider le cache
            this.cache.conditionResults.clear();
            
            this.plugin.metrics.increment('conditional_style_added');
            return styleId;
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_add_style');
            return null;
        }
    }

    removeConditionalStyle(styleId) {
        try {
            // Supprimer la règle
            this.plugin.ruleEngine.removeRule(styleId);
            
            // Mettre à jour l'état
            this.state.conditionalStyles.delete(styleId);
            
            // Supprimer les styles actifs
            for (const [element, styles] of this.state.activeStyles) {
                if (styles.has(styleId)) {
                    this.plugin.styleManager.removeStyle(element, styleId);
                    styles.delete(styleId);
                }
            }
            
            // Invalider le cache
            this.cache.conditionResults.clear();
            
            this.plugin.metrics.increment('conditional_style_removed');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_remove_style');
        }
    }

    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            this.plugin.tableFlow.off('data:change', this._boundDataChangeHandler);
            this.plugin.tableFlow.off('cell:change', this._boundCellChangeHandler);
            this.plugin.tableFlow.off('row:change', this._boundRowChangeHandler);
            
            // Nettoyer les styles
            for (const [element, styles] of this.state.activeStyles) {
                for (const styleId of styles) {
                    this.plugin.styleManager.removeStyle(element, styleId);
                }
            }
            
            // Nettoyer les attributs ARIA
            const cells = this.plugin.tableFlow.table.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.removeAttribute('data-conditional-style');
                cell.removeAttribute('aria-description');
            });
            
            // Nettoyer l'état et le cache
            this.state.conditionalStyles.clear();
            this.state.activeStyles.clear();
            this.cache.conditionResults.clear();
            this.cache.styleCache.clear();
            
            this.isInitialized = false;
            this.plugin.logger.info('Module Conditional détruit');
            this.plugin.metrics.increment('conditional_module_destroyed');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'conditional_destroy');
        }
    }
} 