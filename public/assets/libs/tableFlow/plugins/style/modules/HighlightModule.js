/**
 * Module de surbrillance pour le plugin Style
 */
export class HighlightModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.highlightedElements = new Map();
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
        this.plugin.tableFlow.table.addEventListener('mouseover', this.handleMouseOver.bind(this));
        this.plugin.tableFlow.table.addEventListener('mouseout', this.handleMouseOut.bind(this));
    }

    /**
     * Gère le survol de la souris
     * @param {MouseEvent} event
     */
    handleMouseOver(event) {
        const element = event.target.closest('td, th');
        if (!element) return;

        const style = {
            backgroundColor: this.plugin.config.highlight.backgroundColor || 'rgba(33, 150, 243, 0.1)',
            transition: 'background-color 0.2s ease'
        };

        const styleId = this.plugin.styleManager.applyStyle(element, style);
        this.highlightedElements.set(element, styleId);
    }

    /**
     * Gère la sortie de la souris
     * @param {MouseEvent} event
     */
    handleMouseOut(event) {
        const element = event.target.closest('td, th');
        if (!element) return;

        const styleId = this.highlightedElements.get(element);
        if (styleId) {
            this.plugin.styleManager.removeStyle(element, styleId);
            this.highlightedElements.delete(element);
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.plugin.tableFlow.table.removeEventListener('mouseover', this.handleMouseOver);
        this.plugin.tableFlow.table.removeEventListener('mouseout', this.handleMouseOut);
        this.highlightedElements.clear();
    }
} 