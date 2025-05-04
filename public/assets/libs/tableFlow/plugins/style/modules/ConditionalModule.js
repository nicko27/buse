/**
 * Module de styles conditionnels pour le plugin Style
 */
export class ConditionalModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.conditionalStyles = new Map();
    }

    /**
     * Initialise le module
     * @returns {Promise<void>}
     */
    async init() {
        this.setupEventListeners();
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        this.plugin.tableFlow.on('data:change', this.handleDataChange.bind(this));
    }

    /**
     * Gère les changements de données
     * @param {Object} event - Événement de changement de données
     */
    handleDataChange(event) {
        const { data, element } = event;
        if (!data || !element) return;

        this.evaluateConditions(element, data);
    }

    /**
     * Évalue les conditions pour un élément
     * @param {HTMLElement} element - Élément à évaluer
     * @param {Object} data - Données de l'élément
     */
    evaluateConditions(element, data) {
        this.conditionalStyles.forEach(({ condition, style }, styleId) => {
            try {
                if (condition(data)) {
                    this.plugin.styleManager.applyStyle(element, style);
                } else {
                    this.plugin.styleManager.removeStyle(element, styleId);
                }
            } catch (error) {
                this.plugin.handleError(error);
            }
        });
    }

    /**
     * Ajoute un style conditionnel
     * @param {Function} condition - Fonction de condition
     * @param {Object} style - Style à appliquer
     * @returns {string} - ID du style conditionnel
     */
    addConditionalStyle(condition, style) {
        const styleId = this.plugin.ruleEngine.addRule(condition, style);
        this.conditionalStyles.set(styleId, { condition, style });
        return styleId;
    }

    /**
     * Supprime un style conditionnel
     * @param {string} styleId - ID du style à supprimer
     */
    removeConditionalStyle(styleId) {
        this.plugin.ruleEngine.removeRule(styleId);
        this.conditionalStyles.delete(styleId);
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.conditionalStyles.clear();
    }
} 