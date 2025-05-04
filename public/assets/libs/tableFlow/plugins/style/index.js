import { BasePlugin } from '../basePlugin.js';
import { config } from './config.js';
import { StyleManager } from './StyleManager.js';
import { RuleEngine } from './RuleEngine.js';
import { StateManager } from './StateManager.js';
import { HighlightModule } from './modules/HighlightModule.js';
import { ConditionalModule } from './modules/ConditionalModule.js';
import { ThemeModule } from './modules/ThemeModule.js';
import { AnimationModule } from './modules/AnimationModule.js';

export class StylePlugin extends BasePlugin {
    constructor(config = {}) {
        const pluginConfig = {
            enabled: true,
            debug: false,
            execOrder: 10,
            dependencies: [],
            
            // Configuration spécifique au style
            modules: {
                highlight: {
                    enabled: true
                },
                conditional: {
                    enabled: true
                },
                theme: {
                    enabled: true
                },
                animation: {
                    enabled: true
                }
            },
            ...config
        };

        super(pluginConfig);

        // Gestionnaires principaux
        this.styleManager = new StyleManager(this);
        this.ruleEngine = new RuleEngine(this);
        this.stateManager = new StateManager(this);

        // Modules
        this.modules = new Map();
        
        // Interface
        this.container = null;
        this.toolbar = null;
        this.menu = null;
    }

    async onInit(context) {
        this.logger.info('Initialisation du StylePlugin');

        // Créer les éléments d'interface
        await this.createInterface();

        // Initialiser les modules
        await this.initModules();

        // Charger l'état sauvegardé
        await this.stateManager.load();

        // Configurer les écouteurs d'événements
        this.setupEventListeners();

        this.logger.success('StylePlugin initialisé avec succès');
    }

    async createInterface() {
        // Créer le conteneur principal
        this.container = document.createElement('div');
        this.container.className = this.config.classes.container;

        // Créer la barre d'outils
        this.toolbar = document.createElement('div');
        this.toolbar.className = this.config.classes.toolbar;
        this.container.appendChild(this.toolbar);

        // Créer le menu
        this.menu = document.createElement('div');
        this.menu.className = this.config.classes.menu;
        this.menu.style.display = 'none';
        this.container.appendChild(this.menu);

        // Ajouter au DOM
        context.container.appendChild(this.container);
    }

    async initModules() {
        // Highlight Module
        if (this.config.get('modules.highlight.enabled')) {
            const highlightModule = new HighlightModule(this);
            await highlightModule.init();
            this.modules.set('highlight', highlightModule);
        }

        // Conditional Module
        if (this.config.get('modules.conditional.enabled')) {
            const conditionalModule = new ConditionalModule(this);
            await conditionalModule.init();
            this.modules.set('conditional', conditionalModule);
        }

        // Theme Module
        if (this.config.get('modules.theme.enabled')) {
            const themeModule = new ThemeModule(this);
            await themeModule.init();
            this.modules.set('theme', themeModule);
        }

        // Animation Module
        if (this.config.get('modules.animation.enabled')) {
            const animationModule = new AnimationModule(this);
            await animationModule.init();
            this.modules.set('animation', animationModule);
        }
    }

    setupEventListeners() {
        // Écouter les changements de données
        context.eventBus.on('data:change', this.handleDataChange.bind(this));
        
        // Écouter les changements d'état
        context.eventBus.on('state:change', this.handleStateChange.bind(this));
        
        // Écouter les événements de sélection
        context.table.addEventListener('mousedown', this.handleSelectionStart.bind(this));
        context.table.addEventListener('mousemove', this.handleSelectionMove.bind(this));
        document.addEventListener('mouseup', this.handleSelectionEnd.bind(this));
        
        // Écouter les événements clavier
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    handleDataChange(event) {
        if (!this.config.get('enabled')) return;
        
        // Mettre à jour les styles conditionnels
        if (this.modules.has('conditional')) {
            this.modules.get('conditional').update(event.data);
        }
    }

    handleStateChange(event) {
        if (!this.config.get('enabled')) return;
        
        // Mettre à jour l'état des modules
        this.modules.forEach(module => {
            if (typeof module.handleStateChange === 'function') {
                module.handleStateChange(event);
            }
        });
    }

    handleSelectionStart(event) {
        if (!this.config.get('enabled')) return;
        
        // Déléguer aux modules actifs
        this.modules.forEach(module => {
            if (typeof module.handleSelectionStart === 'function') {
                module.handleSelectionStart(event);
            }
        });
    }

    handleSelectionMove(event) {
        if (!this.config.get('enabled')) return;
        
        // Déléguer aux modules actifs
        this.modules.forEach(module => {
            if (typeof module.handleSelectionMove === 'function') {
                module.handleSelectionMove(event);
            }
        });
    }

    handleSelectionEnd(event) {
        if (!this.config.get('enabled')) return;
        
        // Déléguer aux modules actifs
        this.modules.forEach(module => {
            if (typeof module.handleSelectionEnd === 'function') {
                module.handleSelectionEnd(event);
            }
        });
    }

    handleKeyDown(event) {
        if (!this.config.get('enabled')) return;
        
        // Déléguer aux modules actifs
        this.modules.forEach(module => {
            if (typeof module.handleKeyDown === 'function') {
                module.handleKeyDown(event);
            }
        });
    }

    // API publique
    applyStyle(elements, style) {
        return this.styleManager.applyStyle(elements, style);
    }

    removeStyle(elements, styleId) {
        return this.styleManager.removeStyle(elements, styleId);
    }

    addRule(condition, style) {
        return this.ruleEngine.addRule(condition, style);
    }

    setTheme(themeName) {
        if (this.modules.has('theme')) {
            return this.modules.get('theme').setTheme(themeName);
        }
    }

    async onRefresh() {
        this.logger.info('Rafraîchissement du StylePlugin...');
        await this.stateManager.load();
    }

    async onDestroy() {
        this.logger.info('Destruction du StylePlugin...');
        
        // Supprimer les écouteurs d'événements
        context.eventBus.off('data:change', this.handleDataChange);
        context.eventBus.off('state:change', this.handleStateChange);
        context.table.removeEventListener('mousedown', this.handleSelectionStart);
        context.table.removeEventListener('mousemove', this.handleSelectionMove);
        document.removeEventListener('mouseup', this.handleSelectionEnd);
        document.removeEventListener('keydown', this.handleKeyDown);

        // Détruire les modules
        this.modules.forEach(module => module.destroy());
        this.modules.clear();

        // Nettoyer le DOM
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }

        // Sauvegarder l'état final
        this.stateManager.save();
    }
} 