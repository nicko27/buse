/**
 * Plugin de style pour TableFlow
 * Gère les styles, thèmes et animations du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { config } from './config.js';
import { StyleManager } from './StyleManager.js';
import { RuleEngine } from './RuleEngine.js';
import { StateManager } from './StateManager.js';
import { HighlightModule } from './modules/HighlightModule.js';
import { ConditionalModule } from './modules/ConditionalModule.js';
import { ThemeModule } from './modules/ThemeModule.js';
import { AnimationModule } from './modules/AnimationModule.js';

export class StylePlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = config.type;
        this.dependencies = config.dependencies;

        // Gestionnaires principaux
        this.styleManager = new StyleManager(this);
        this.ruleEngine = new RuleEngine(this);
        this.stateManager = new StateManager(this);

        // Modules
        this.modules = new Map();
    }

    /**
     * Initialise le plugin
     * @returns {Promise<void>}
     */
    async init() {
        if (!this.tableFlow) {
            throw new Error('TableFlow instance is required');
        }

        // Initialiser les gestionnaires
        this.styleManager.init();

        // Initialiser les modules
        await this.initModules();

        // Charger l'état sauvegardé
        await this.stateManager.load();

        this.initialized = true;
    }

    /**
     * Initialise les modules
     * @returns {Promise<void>}
     */
    async initModules() {
        // Module de surbrillance
        if (this.config.modules.highlight.enabled) {
            const highlightModule = new HighlightModule(this);
            await highlightModule.init();
            this.modules.set('highlight', highlightModule);
        }

        // Module de styles conditionnels
        if (this.config.modules.conditional.enabled) {
            const conditionalModule = new ConditionalModule(this);
            await conditionalModule.init();
            this.modules.set('conditional', conditionalModule);
        }

        // Module de thèmes
        if (this.config.modules.theme.enabled) {
            const themeModule = new ThemeModule(this);
            await themeModule.init();
            this.modules.set('theme', themeModule);
        }

        // Module d'animations
        if (this.config.modules.animation.enabled) {
            const animationModule = new AnimationModule(this);
            await animationModule.init();
            this.modules.set('animation', animationModule);
        }
    }

    /**
     * Applique un style à des éléments
     * @param {HTMLElement|HTMLElement[]} elements - Éléments à styliser
     * @param {Object} style - Style à appliquer
     * @returns {string} - ID du style appliqué
     */
    applyStyle(elements, style) {
        return this.styleManager.applyStyle(elements, style);
    }

    /**
     * Supprime un style appliqué
     * @param {HTMLElement|HTMLElement[]} elements - Éléments concernés
     * @param {string} styleId - ID du style à supprimer
     */
    removeStyle(elements, styleId) {
        this.styleManager.removeStyle(elements, styleId);
    }

    /**
     * Ajoute une règle conditionnelle
     * @param {Function} condition - Fonction de condition
     * @param {Object} style - Style à appliquer
     * @returns {string} - ID de la règle
     */
    addRule(condition, style) {
        return this.ruleEngine.addRule(condition, style);
    }

    /**
     * Supprime une règle
     * @param {string} ruleId - ID de la règle à supprimer
     */
    removeRule(ruleId) {
        this.ruleEngine.removeRule(ruleId);
    }

    /**
     * Définit le thème actif
     * @param {string} name - Nom du thème
     * @returns {Promise<void>}
     */
    async setTheme(name) {
        if (this.modules.has('theme')) {
            await this.modules.get('theme').setTheme(name);
        }
    }

    /**
     * Applique une animation à un élément
     * @param {HTMLElement} element - Élément à animer
     * @param {string} name - Nom de l'animation
     * @param {Object} [options] - Options supplémentaires
     */
    animate(element, name, options) {
        if (this.modules.has('animation')) {
            this.modules.get('animation').animate(element, name, options);
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        super.destroy();

        // Détruire les modules
        this.modules.forEach(module => module.destroy());
        this.modules.clear();

        // Détruire les gestionnaires
        this.styleManager.destroy();
        this.ruleEngine.destroy();
        this.stateManager.destroy();
    }
} 