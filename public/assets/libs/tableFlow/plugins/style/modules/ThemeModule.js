/**
 * Module de thèmes pour le plugin Style
 */
export class ThemeModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.themes = new Map();
        this.activeTheme = null;
    }

    /**
     * Initialise le module
     * @returns {Promise<void>}
     */
    async init() {
        this.loadDefaultThemes();
        await this.loadSavedTheme();
    }

    /**
     * Charge les thèmes par défaut
     */
    loadDefaultThemes() {
        // Thème clair
        this.addTheme('light', {
            backgroundColor: '#ffffff',
            textColor: '#333333',
            borderColor: '#e0e0e0',
            headerBackground: '#f5f5f5',
            headerTextColor: '#333333',
            hoverBackground: '#f0f0f0',
            selectedBackground: '#e3f2fd',
            selectedTextColor: '#1976d2'
        });

        // Thème sombre
        this.addTheme('dark', {
            backgroundColor: '#1a1a1a',
            textColor: '#ffffff',
            borderColor: '#333333',
            headerBackground: '#2d2d2d',
            headerTextColor: '#ffffff',
            hoverBackground: '#333333',
            selectedBackground: '#0d47a1',
            selectedTextColor: '#ffffff'
        });
    }

    /**
     * Charge le thème sauvegardé
     * @returns {Promise<void>}
     */
    async loadSavedTheme() {
        const savedTheme = this.plugin.stateManager.get('activeTheme');
        if (savedTheme && this.themes.has(savedTheme)) {
            await this.setTheme(savedTheme);
        }
    }

    /**
     * Ajoute un thème
     * @param {string} name - Nom du thème
     * @param {Object} styles - Styles du thème
     */
    addTheme(name, styles) {
        this.themes.set(name, styles);
    }

    /**
     * Définit le thème actif
     * @param {string} name - Nom du thème
     * @returns {Promise<void>}
     */
    async setTheme(name) {
        if (!this.themes.has(name)) {
            throw new Error(`Theme "${name}" not found`);
        }

        const theme = this.themes.get(name);
        const root = document.documentElement;

        // Appliquer les variables CSS
        Object.entries(theme).forEach(([key, value]) => {
            const cssVar = `--tableflow-${key}`;
            root.style.setProperty(cssVar, value);
        });

        this.activeTheme = name;
        await this.plugin.stateManager.update('activeTheme', name);
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.themes.clear();
        this.activeTheme = null;
    }
} 