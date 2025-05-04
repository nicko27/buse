/**
 * Gestionnaire de styles pour le plugin Style
 */
export class StyleManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.styles = new Map();
        this.styleSheet = null;
    }

    /**
     * Initialise le gestionnaire de styles
     */
    init() {
        this.createStyleSheet();
    }

    /**
     * Crée une feuille de style dynamique
     */
    createStyleSheet() {
        const style = document.createElement('style');
        document.head.appendChild(style);
        this.styleSheet = style.sheet;
    }

    /**
     * Applique un style à des éléments
     * @param {HTMLElement|HTMLElement[]} elements - Éléments à styliser
     * @param {Object} style - Style à appliquer
     * @returns {string} - ID du style appliqué
     */
    applyStyle(elements, style) {
        const styleId = this.generateStyleId();
        const cssRules = this.convertStyleToCSS(style);
        
        // Ajouter les règles CSS
        this.styleSheet.insertRule(cssRules, this.styleSheet.cssRules.length);
        this.styles.set(styleId, { elements, style, cssRules });

        // Appliquer la classe aux éléments
        const elementsArray = Array.isArray(elements) ? elements : [elements];
        elementsArray.forEach(element => {
            element.classList.add(styleId);
        });

        return styleId;
    }

    /**
     * Supprime un style appliqué
     * @param {HTMLElement|HTMLElement[]} elements - Éléments concernés
     * @param {string} styleId - ID du style à supprimer
     */
    removeStyle(elements, styleId) {
        const style = this.styles.get(styleId);
        if (!style) return;

        // Supprimer la classe des éléments
        const elementsArray = Array.isArray(elements) ? elements : [elements];
        elementsArray.forEach(element => {
            element.classList.remove(styleId);
        });

        // Supprimer les règles CSS
        const index = Array.from(this.styleSheet.cssRules).findIndex(
            rule => rule.cssText.includes(styleId)
        );
        if (index !== -1) {
            this.styleSheet.deleteRule(index);
        }

        this.styles.delete(styleId);
    }

    /**
     * Génère un ID unique pour un style
     * @returns {string}
     */
    generateStyleId() {
        return `tableflow-style-${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Convertit un objet style en règles CSS
     * @param {Object} style - Style à convertir
     * @returns {string}
     */
    convertStyleToCSS(style) {
        const styleId = this.generateStyleId();
        let css = `.${styleId} {`;
        
        for (const [property, value] of Object.entries(style)) {
            const cssProperty = this.convertPropertyToCSS(property);
            css += `${cssProperty}: ${value};`;
        }
        
        css += '}';
        return css;
    }

    /**
     * Convertit une propriété JavaScript en propriété CSS
     * @param {string} property - Propriété à convertir
     * @returns {string}
     */
    convertPropertyToCSS(property) {
        return property.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (this.styleSheet && this.styleSheet.parentNode) {
            this.styleSheet.parentNode.removeChild(this.styleSheet);
        }
        this.styles.clear();
    }
} 