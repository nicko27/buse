/**
 * Module de thèmes pour le plugin Style
 * Gère les thèmes et leur application dynamique au tableau
 */
export class ThemeModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.isInitialized = false;
        
        // État local
        this.state = {
            themes: new Map(),
            activeTheme: null,
            isProcessing: false,
            lastThemeChange: null
        };
        
        // Cache pour les performances
        this.cache = {
            themeTimeout: null,
            lastThemeTime: 0,
            cssVariables: new Map(),
            computedStyles: new Map()
        };
        
        // Lier les méthodes
        this._boundThemeChangeHandler = this.handleThemeChange.bind(this);
        this._boundMediaQueryHandler = this.handleMediaQuery.bind(this);
        
        // Media query pour le thème automatique
        this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    }

    async init() {
        if (this.isInitialized) {
            this.plugin.logger.warn('Module Theme déjà initialisé');
            return;
        }

        try {
            this.plugin.logger.info('Initialisation du module Theme');
            
            // Configurer les écouteurs d'événements
            this.setupEventListeners();
            
            // Charger les thèmes par défaut
            await this.loadDefaultThemes();
            
            // Charger le thème sauvegardé ou détecter le thème système
            await this.initializeTheme();
            
            this.isInitialized = true;
            this.plugin.metrics.increment('theme_module_init');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_init');
            throw error;
        }
    }

    setupEventListeners() {
        try {
            // Événements de thème
            this.plugin.tableFlow.on('themeChange', this._boundThemeChangeHandler);
            
            // Écouter les changements de thème système
            this.mediaQuery.addEventListener('change', this._boundMediaQueryHandler);
            
            // Ajouter les attributs ARIA
            const table = this.plugin.tableFlow.table;
            table.setAttribute('data-theme', 'default');
            table.setAttribute('aria-description', 'Tableau avec thème par défaut');
            
            this.plugin.metrics.increment('theme_event_listeners_setup');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_setup_listeners');
        }
    }

    async loadDefaultThemes() {
        try {
            // Thème clair
            const lightTheme = {
                name: 'light',
                label: 'Thème clair',
                styles: {
                    backgroundColor: '#ffffff',
                    textColor: '#333333',
                    borderColor: '#e0e0e0',
                    headerBackground: '#f5f5f5',
                    headerTextColor: '#333333',
                    hoverBackground: '#f0f0f0',
                    selectedBackground: '#e3f2fd',
                    selectedTextColor: '#1976d2',
                    focusOutline: '2px solid #2196F3',
                    errorColor: '#f44336',
                    successColor: '#4caf50'
                }
            };
            
            // Thème sombre
            const darkTheme = {
                name: 'dark',
                label: 'Thème sombre',
                styles: {
                    backgroundColor: '#1a1a1a',
                    textColor: '#ffffff',
                    borderColor: '#333333',
                    headerBackground: '#2d2d2d',
                    headerTextColor: '#ffffff',
                    hoverBackground: '#333333',
                    selectedBackground: '#0d47a1',
                    selectedTextColor: '#ffffff',
                    focusOutline: '2px solid #64b5f6',
                    errorColor: '#ef5350',
                    successColor: '#66bb6a'
                }
            };
            
            // Thème à contraste élevé
            const highContrastTheme = {
                name: 'high-contrast',
                label: 'Thème à contraste élevé',
                styles: {
                    backgroundColor: '#ffffff',
                    textColor: '#000000',
                    borderColor: '#000000',
                    headerBackground: '#000000',
                    headerTextColor: '#ffffff',
                    hoverBackground: '#e0e0e0',
                    selectedBackground: '#000000',
                    selectedTextColor: '#ffffff',
                    focusOutline: '3px solid #000000',
                    errorColor: '#ff0000',
                    successColor: '#008000'
                }
            };
            
            // Ajouter les thèmes
            await this.addTheme(lightTheme);
            await this.addTheme(darkTheme);
            await this.addTheme(highContrastTheme);
            
            this.plugin.metrics.increment('theme_default_themes_loaded');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_load_default_themes');
        }
    }

    async initializeTheme() {
        try {
            // Vérifier le thème sauvegardé
            const savedTheme = await this.plugin.stateManager.get('activeTheme');
            if (savedTheme && this.state.themes.has(savedTheme)) {
                await this.setTheme(savedTheme);
                return;
            }
            
            // Détecter le thème système
            const prefersDark = this.mediaQuery.matches;
            const defaultTheme = prefersDark ? 'dark' : 'light';
            await this.setTheme(defaultTheme);
            
            this.plugin.metrics.increment('theme_initialized');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_initialize');
        }
    }

    async handleThemeChange(event) {
        if (!this.isInitialized || this.state.isProcessing) return;

        try {
            const { theme } = event;
            const startTime = performance.now();
            this.state.isProcessing = true;
            
            // Déclencher le hook beforeThemeChange
            const beforeResult = await this.plugin.tableFlow.hooks.trigger('beforeThemeChange', {
                theme,
                previousTheme: this.state.activeTheme
            });
            
            if (beforeResult === false) return;
            
            // Changer le thème
            await this.setTheme(theme);
            
            // Déclencher le hook afterThemeChange
            await this.plugin.tableFlow.hooks.trigger('afterThemeChange', {
                theme,
                previousTheme: this.state.activeTheme,
                performance: {
                    duration: performance.now() - startTime
                }
            });
            
            this.plugin.metrics.increment('theme_change_handled');
            this.plugin.metrics.record('theme_change_duration', performance.now() - startTime);
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_handle_theme_change');
        } finally {
            this.state.isProcessing = false;
        }
    }

    async handleMediaQuery(event) {
        if (!this.isInitialized) return;

        try {
            const prefersDark = event.matches;
            const theme = prefersDark ? 'dark' : 'light';
            
            // Changer le thème si aucun thème n'est explicitement défini
            if (!this.state.activeTheme) {
                await this.setTheme(theme);
            }
            
            this.plugin.metrics.increment('theme_media_query_handled');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_handle_media_query');
        }
    }

    async addTheme(theme) {
        try {
            // Valider le thème
            if (!this.isValidTheme(theme)) {
                throw new Error(`Thème invalide : ${theme.name}`);
            }
            
            // Compiler les variables CSS
            const cssVariables = this.compileCssVariables(theme.styles);
            
            // Mettre en cache
            this.cache.cssVariables.set(theme.name, cssVariables);
            
            // Ajouter le thème
            this.state.themes.set(theme.name, theme);
            
            this.plugin.metrics.increment('theme_added');
            return theme.name;
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_add_theme');
            return null;
        }
    }

    async setTheme(name) {
        try {
            if (!this.state.themes.has(name)) {
                throw new Error(`Thème non trouvé : ${name}`);
            }
            
            const theme = this.state.themes.get(name);
            const cssVariables = this.cache.cssVariables.get(name);
            
            // Appliquer les variables CSS
            const root = document.documentElement;
            cssVariables.forEach((value, key) => {
                root.style.setProperty(key, value);
            });
            
            // Mettre à jour l'état
            const previousTheme = this.state.activeTheme;
            this.state.activeTheme = name;
            this.state.lastThemeChange = Date.now();
            
            // Mettre à jour les attributs ARIA
            const table = this.plugin.tableFlow.table;
            table.setAttribute('data-theme', name);
            table.setAttribute('aria-description', `Tableau avec ${theme.label}`);
            
            // Sauvegarder le thème
            await this.plugin.stateManager.update('activeTheme', name);
            
            this.plugin.metrics.increment('theme_set');
            return true;
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_set_theme');
            return false;
        }
    }

    isValidTheme(theme) {
        return (
            theme &&
            typeof theme === 'object' &&
            typeof theme.name === 'string' &&
            typeof theme.label === 'string' &&
            theme.styles &&
            typeof theme.styles === 'object'
        );
    }

    compileCssVariables(styles) {
        const variables = new Map();
        
        Object.entries(styles).forEach(([key, value]) => {
            const cssVar = `--tableflow-${key}`;
            variables.set(cssVar, value);
        });
        
        return variables;
    }

    getTheme(name) {
        return this.state.themes.get(name) || null;
    }

    getActiveTheme() {
        return this.state.activeTheme ? this.getTheme(this.state.activeTheme) : null;
    }

    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            this.plugin.tableFlow.off('themeChange', this._boundThemeChangeHandler);
            this.mediaQuery.removeEventListener('change', this._boundMediaQueryHandler);
            
            // Nettoyer les styles
            const root = document.documentElement;
            this.cache.cssVariables.get(this.state.activeTheme)?.forEach((_, key) => {
                root.style.removeProperty(key);
            });
            
            // Nettoyer les attributs ARIA
            const table = this.plugin.tableFlow.table;
            table.removeAttribute('data-theme');
            table.removeAttribute('aria-description');
            
            // Nettoyer l'état et le cache
            this.state.themes.clear();
            this.state.activeTheme = null;
            this.cache.cssVariables.clear();
            this.cache.computedStyles.clear();
            
            this.isInitialized = false;
            this.plugin.logger.info('Module Theme détruit');
            this.plugin.metrics.increment('theme_module_destroyed');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'theme_destroy');
        }
    }
} 