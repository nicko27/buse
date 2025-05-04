/**
 * Plugin de style pour TableFlow
 * Gère les styles, thèmes et animations du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
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
        this.type = PluginType.STYLE;
        this.dependencies = config.dependencies;
        this.isInitialized = false;

        // État local
        this.state = {
            activeTheme: null,
            activeStyles: new Map(),
            activeRules: new Map(),
            isProcessing: false
        };

        // Cache pour les performances
        this.cache = {
            styleTimeout: null,
            lastStyleTime: 0,
            computedStyles: new Map()
        };

        // Gestionnaires principaux
        this.styleManager = new StyleManager(this);
        this.ruleEngine = new RuleEngine(this);
        this.stateManager = new StateManager(this);

        // Modules
        this.modules = new Map();

        // Lier les méthodes
        this._boundStyleChangeHandler = this.handleStyleChange.bind(this);
        this._boundThemeChangeHandler = this.handleThemeChange.bind(this);
    }

    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Style déjà initialisé');
            return;
        }

        try {
            this.logger.info('Initialisation du plugin Style');

            // Initialiser les gestionnaires
            await this.initializeManagers();

            // Initialiser les modules
            await this.initializeModules();

            // Configurer les écouteurs d'événements
            this.setupEventListeners();

            // Charger l'état sauvegardé
            await this.loadState();

            this.isInitialized = true;
            this.metrics.increment('plugin_style_init');
        } catch (error) {
            this.errorHandler.handle(error, 'style_init');
            throw error;
        }
    }

    async initializeManagers() {
        try {
            // Initialiser le gestionnaire de styles
            await this.styleManager.init();
            this.metrics.increment('style_manager_init');

            // Initialiser le moteur de règles
            await this.ruleEngine.init();
            this.metrics.increment('rule_engine_init');

            // Initialiser le gestionnaire d'état
            await this.stateManager.init();
            this.metrics.increment('state_manager_init');
        } catch (error) {
            this.errorHandler.handle(error, 'style_initialize_managers');
        }
    }

    async initializeModules() {
        try {
            const moduleConfigs = {
                highlight: { class: HighlightModule, config: this.config.modules.highlight },
                conditional: { class: ConditionalModule, config: this.config.modules.conditional },
                theme: { class: ThemeModule, config: this.config.modules.theme },
                animation: { class: AnimationModule, config: this.config.modules.animation }
            };

            for (const [name, { class: ModuleClass, config: moduleConfig }] of Object.entries(moduleConfigs)) {
                if (moduleConfig.enabled) {
                    const module = new ModuleClass(this);
                    await module.init();
                    this.modules.set(name, module);
                    this.metrics.increment(`module_${name}_init`);
                }
            }
        } catch (error) {
            this.errorHandler.handle(error, 'style_initialize_modules');
        }
    }

    setupEventListeners() {
        try {
            // Événements de style
            this.tableFlow.on('styleChange', this._boundStyleChangeHandler);
            this.tableFlow.on('themeChange', this._boundThemeChangeHandler);

            // Ajouter les attributs ARIA
            const cells = this.tableFlow.table.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.setAttribute('data-style-applied', 'false');
                cell.setAttribute('role', 'gridcell');
            });

            this.metrics.increment('style_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'style_setup_listeners');
        }
    }

    async loadState() {
        try {
            await this.stateManager.load();
            
            // Restaurer le thème actif
            const activeTheme = this.stateManager.get('activeTheme');
            if (activeTheme) {
                await this.setTheme(activeTheme);
            }

            // Restaurer les styles appliqués
            const appliedStyles = this.stateManager.get('appliedStyles');
            if (appliedStyles) {
                for (const [elementId, styles] of appliedStyles) {
                    const element = document.getElementById(elementId);
                    if (element) {
                        await this.applyStyle(element, styles);
                    }
                }
            }

            this.metrics.increment('style_state_loaded');
        } catch (error) {
            this.errorHandler.handle(error, 'style_load_state');
        }
    }

    async handleStyleChange(event) {
        if (!this.isInitialized || this.state.isProcessing) return;

        try {
            const { element, styles } = event;
            const startTime = performance.now();
            this.state.isProcessing = true;

            // Déclencher le hook beforeStyleChange
            const beforeResult = await this.tableFlow.hooks.trigger('beforeStyleChange', {
                element,
                styles
            });

            if (beforeResult === false) return;

            // Appliquer les styles
            const styleId = await this.applyStyle(element, styles);

            // Déclencher le hook afterStyleChange
            await this.tableFlow.hooks.trigger('afterStyleChange', {
                element,
                styles,
                styleId,
                performance: {
                    duration: performance.now() - startTime
                }
            });

            this.metrics.increment('style_change_handled');
            this.metrics.record('style_change_duration', performance.now() - startTime);
        } catch (error) {
            this.errorHandler.handle(error, 'style_handle_style_change');
        } finally {
            this.state.isProcessing = false;
        }
    }

    async handleThemeChange(event) {
        if (!this.isInitialized) return;

        try {
            const { theme } = event;
            await this.setTheme(theme);
            this.metrics.increment('theme_change_handled');
        } catch (error) {
            this.errorHandler.handle(error, 'style_handle_theme_change');
        }
    }

    async applyStyle(elements, style) {
        try {
            const styleId = this.styleManager.applyStyle(elements, style);
            
            // Mettre à jour l'état
            this.state.activeStyles.set(styleId, {
                elements: Array.isArray(elements) ? elements : [elements],
                style
            });

            // Mettre à jour les attributs ARIA
            const elementsArray = Array.isArray(elements) ? elements : [elements];
            elementsArray.forEach(element => {
                element.setAttribute('data-style-applied', 'true');
                if (style.backgroundColor) {
                    element.setAttribute('aria-description', `Fond ${style.backgroundColor}`);
                }
            });

            return styleId;
        } catch (error) {
            this.errorHandler.handle(error, 'style_apply_style');
            return null;
        }
    }

    async removeStyle(elements, styleId) {
        try {
            this.styleManager.removeStyle(elements, styleId);
            
            // Mettre à jour l'état
            this.state.activeStyles.delete(styleId);

            // Mettre à jour les attributs ARIA
            const elementsArray = Array.isArray(elements) ? elements : [elements];
            elementsArray.forEach(element => {
                element.setAttribute('data-style-applied', 'false');
                element.removeAttribute('aria-description');
            });

            this.metrics.increment('style_removed');
        } catch (error) {
            this.errorHandler.handle(error, 'style_remove_style');
        }
    }

    addRule(condition, style) {
        try {
            const ruleId = this.ruleEngine.addRule(condition, style);
            
            // Mettre à jour l'état
            this.state.activeRules.set(ruleId, {
                condition,
                style
            });

            return ruleId;
        } catch (error) {
            this.errorHandler.handle(error, 'style_add_rule');
            return null;
        }
    }

    removeRule(ruleId) {
        try {
            this.ruleEngine.removeRule(ruleId);
            
            // Mettre à jour l'état
            this.state.activeRules.delete(ruleId);

            this.metrics.increment('rule_removed');
        } catch (error) {
            this.errorHandler.handle(error, 'style_remove_rule');
        }
    }

    async setTheme(name) {
        if (!this.isInitialized || !this.modules.has('theme')) return;

        try {
            const themeModule = this.modules.get('theme');
            await themeModule.setTheme(name);
            
            // Mettre à jour l'état
            this.state.activeTheme = name;
            await this.stateManager.update('activeTheme', name);

            this.metrics.increment('theme_set');
        } catch (error) {
            this.errorHandler.handle(error, 'style_set_theme');
        }
    }

    animate(element, name, options = {}) {
        if (!this.isInitialized || !this.modules.has('animation')) return;

        try {
            const animationModule = this.modules.get('animation');
            animationModule.animate(element, name, options);

            this.metrics.increment('animation_applied');
        } catch (error) {
            this.errorHandler.handle(error, 'style_animate');
        }
    }

    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Sauvegarder l'état
            await this.stateManager.save();

            // Supprimer les écouteurs d'événements
            this.tableFlow.off('styleChange', this._boundStyleChangeHandler);
            this.tableFlow.off('themeChange', this._boundThemeChangeHandler);

            // Nettoyer les attributs ARIA
            const cells = this.tableFlow.table.querySelectorAll('td, th');
            cells.forEach(cell => {
                cell.removeAttribute('data-style-applied');
                cell.removeAttribute('aria-description');
            });

            // Détruire les modules
            for (const [name, module] of this.modules) {
                await module.destroy();
                this.metrics.increment(`module_${name}_destroyed`);
            }
            this.modules.clear();

            // Détruire les gestionnaires
            await this.styleManager.destroy();
            await this.ruleEngine.destroy();
            await this.stateManager.destroy();

            // Nettoyer l'état et le cache
            this.state.activeStyles.clear();
            this.state.activeRules.clear();
            this.cache.computedStyles.clear();

            this.isInitialized = false;
            this.logger.info('Plugin Style détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'style_destroy');
        } finally {
            super.destroy();
        }
    }
} 