import { BasePlugin } from '../basePlugin.js';

export class ExamplePlugin extends BasePlugin {
    constructor(config = {}) {
        // Configuration spécifique au plugin
        const pluginConfig = {
            // Configuration de base (héritée de BasePlugin)
            enabled: true,
            debug: false,
            execOrder: 50,
            dependencies: ['dependencyPlugin'],
            
            // Configuration spécifique
            exampleOption: {
                type: 'string',
                default: 'defaultValue',
                validate: value => typeof value === 'string'
            },
            ...config
        };

        super(pluginConfig);
    }

    /**
     * Initialisation spécifique au plugin
     * @param {Object} context - Contexte d'initialisation
     */
    async onInit(context) {
        this.logger.info('Initialisation du ExamplePlugin...');
        
        // Exemple d'initialisation
        this.exampleOption = this.config.get('exampleOption');
        
        // Enregistrer des écouteurs d'événements
        this.eventListeners = [
            context.eventBus.on('example:event', this.handleExampleEvent.bind(this))
        ];
    }

    /**
     * Gestionnaire d'événement d'exemple
     * @param {Object} data - Données de l'événement
     */
    handleExampleEvent(data) {
        this.logger.info('Événement reçu:', data);
    }

    /**
     * Rafraîchissement spécifique au plugin
     */
    async onRefresh() {
        this.logger.info('Rafraîchissement du ExamplePlugin...');
        // Implémentation du rafraîchissement
    }

    /**
     * Destruction spécifique au plugin
     */
    async onDestroy() {
        this.logger.info('Destruction du ExamplePlugin...');
        
        // Nettoyer les écouteurs d'événements
        if (this.eventListeners) {
            this.eventListeners.forEach(remove => remove());
            this.eventListeners = null;
        }
    }
} 