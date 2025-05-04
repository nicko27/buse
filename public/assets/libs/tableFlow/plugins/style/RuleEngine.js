/**
 * Moteur de règles pour le plugin Style
 */
export class RuleEngine {
    constructor(plugin) {
        this.plugin = plugin;
        this.rules = new Map();
    }

    /**
     * Ajoute une règle conditionnelle
     * @param {Function} condition - Fonction de condition
     * @param {Object} style - Style à appliquer
     * @returns {string} - ID de la règle
     */
    addRule(condition, style) {
        const ruleId = this.generateRuleId();
        this.rules.set(ruleId, { condition, style });
        return ruleId;
    }

    /**
     * Supprime une règle
     * @param {string} ruleId - ID de la règle à supprimer
     */
    removeRule(ruleId) {
        this.rules.delete(ruleId);
    }

    /**
     * Évalue toutes les règles pour un élément
     * @param {HTMLElement} element - Élément à évaluer
     * @param {Object} data - Données de l'élément
     */
    evaluateRules(element, data) {
        for (const [ruleId, rule] of this.rules) {
            try {
                if (rule.condition(data)) {
                    this.plugin.styleManager.applyStyle(element, rule.style);
                } else {
                    this.plugin.styleManager.removeStyle(element, ruleId);
                }
            } catch (error) {
                this.plugin.handleError(error);
            }
        }
    }

    /**
     * Génère un ID unique pour une règle
     * @returns {string}
     */
    generateRuleId() {
        return `tableflow-rule-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.rules.clear();
    }
} 