/**
 * Gestionnaire d'état pour le plugin Style
 */
export class StateManager {
    constructor(plugin) {
        this.plugin = plugin;
        this.state = {
            activeTheme: null,
            appliedStyles: new Map(),
            rules: new Map()
        };
    }

    /**
     * Charge l'état sauvegardé
     * @returns {Promise<void>}
     */
    async load() {
        try {
            const savedState = localStorage.getItem('tableflow-style-state');
            if (savedState) {
                const parsedState = JSON.parse(savedState);
                this.state = {
                    ...this.state,
                    ...parsedState,
                    appliedStyles: new Map(Object.entries(parsedState.appliedStyles)),
                    rules: new Map(Object.entries(parsedState.rules))
                };
            }
        } catch (error) {
            this.plugin.handleError(error);
        }
    }

    /**
     * Sauvegarde l'état actuel
     * @returns {Promise<void>}
     */
    async save() {
        try {
            const stateToSave = {
                ...this.state,
                appliedStyles: Object.fromEntries(this.state.appliedStyles),
                rules: Object.fromEntries(this.state.rules)
            };
            localStorage.setItem('tableflow-style-state', JSON.stringify(stateToSave));
        } catch (error) {
            this.plugin.handleError(error);
        }
    }

    /**
     * Met à jour l'état
     * @param {string} key - Clé de l'état
     * @param {any} value - Nouvelle valeur
     */
    update(key, value) {
        this.state[key] = value;
        this.save();
    }

    /**
     * Récupère une valeur de l'état
     * @param {string} key - Clé de l'état
     * @returns {any}
     */
    get(key) {
        return this.state[key];
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.state = {
            activeTheme: null,
            appliedStyles: new Map(),
            rules: new Map()
        };
    }
} 