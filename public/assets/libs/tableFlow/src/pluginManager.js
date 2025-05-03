// src/pluginManager.js
export class PluginManager {
    constructor(tableInstance) {
        this.table = tableInstance;
        this.plugins = new Map();
        this.registry = null; // Référence optionnelle au pluginRegistry
        this.dependencies = new Map(); // Pour gérer les dépendances entre plugins
        
        // Logger
        this.logger = this.table.logger || {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {}
        };
    }

    /**
     * Charge un plugin de manière compatible avec l'ancienne API
     */
    async loadPlugin(name, config = {}) {
        try {
            this.logger.debug(`Chargement du plugin: ${name}`);
            
            // Vérifier si le plugin existe déjà
            if (this.plugins.has(name.toLowerCase())) {
                this.logger.warn(`Plugin ${name} déjà chargé`);
                return this.plugins.get(name.toLowerCase()).instance;
            }

            // Essayer d'abord le pluginRegistry s'il existe
            if (this.registry && this.registry.has(name)) {
                this.logger.debug(`Chargement du plugin ${name} depuis le registre`);
                const plugin = this.registry.get(name);
                return this.initializePlugin(name, plugin, config);
            }

            // Sinon, utiliser l'approche actuelle de TableFlow
            const pluginPath = `${this.table.options.pluginsPath}/${name.toLowerCase()}.js`;
            this.logger.debug(`Chargement du plugin ${name} depuis ${pluginPath}`);
            
            const pluginModule = await import(pluginPath);
            
            if (!pluginModule.default) {
                throw new Error(`Le plugin ${name} n'exporte pas de classe par défaut`);
            }

            // Instancier le plugin
            const pluginInstance = new pluginModule.default({
                ...config,
                tableHandler: this.table,
                debug: config.debug || this.table.options.debug
            });

            return this.initializePlugin(name, pluginInstance, config);

        } catch (error) {
            this.logger.error(`Erreur lors du chargement du plugin ${name}:`, error);
            // Stocker l'erreur pour référence
            this.plugins.set(name.toLowerCase(), { error });
            throw error;
        }
    }

    /**
     * Initialise un plugin et gère ses dépendances
     */
    async initializePlugin(name, pluginInstance, config) {
        const normalizedName = name.toLowerCase();
        
        // Vérifier les dépendances
        if (pluginInstance.dependencies && Array.isArray(pluginInstance.dependencies)) {
            this.logger.debug(`Vérification des dépendances pour ${name}: ${pluginInstance.dependencies.join(', ')}`);
            
            for (const dep of pluginInstance.dependencies) {
                if (!this.plugins.has(dep.toLowerCase())) {
                    throw new Error(`Dépendance manquante: ${dep} requis par ${name}`);
                }
                
                // Enregistrer la dépendance
                if (!this.dependencies.has(dep.toLowerCase())) {
                    this.dependencies.set(dep.toLowerCase(), new Set());
                }
                this.dependencies.get(dep.toLowerCase()).add(normalizedName);
            }
        }

        // Initialiser le plugin
        this.logger.debug(`Initialisation du plugin ${name}`);
        await Promise.resolve(pluginInstance.init(this.table));
        
        // Stocker l'instance
        this.plugins.set(normalizedName, {
            instance: pluginInstance,
            config: config,
            name: name
        });

        this.logger.info(`Plugin ${name} initialisé avec succès`);
        return pluginInstance;
    }

    /**
     * Active un plugin (alias pour loadPlugin pour la compatibilité future)
     */
    async activate(name, config = {}) {
        return this.loadPlugin(name, config);
    }

    /**
     * Désactive un plugin et ses dépendants
     */
    async deactivate(name) {
        const normalizedName = name.toLowerCase();
        const pluginInfo = this.plugins.get(normalizedName);
        
        if (!pluginInfo) {
            this.logger.warn(`Plugin ${name} non trouvé pour désactivation`);
            return;
        }

        // Vérifier s'il y a des plugins dépendants
        if (this.dependencies.has(normalizedName)) {
            const dependents = Array.from(this.dependencies.get(normalizedName));
            if (dependents.length > 0) {
                this.logger.warn(`Le plugin ${name} a des dépendants: ${dependents.join(', ')}`);
                
                // Désactiver d'abord les dépendants
                for (const dependent of dependents) {
                    await this.deactivate(dependent);
                }
            }
        }

        // Appeler destroy si disponible
        if (pluginInfo.instance && typeof pluginInfo.instance.destroy === 'function') {
            this.logger.debug(`Appel de destroy pour le plugin ${name}`);
            await Promise.resolve(pluginInfo.instance.destroy());
        }

        // Supprimer des maps
        this.plugins.delete(normalizedName);
        
        // Nettoyer les références de dépendances
        for (const [dep, dependents] of this.dependencies.entries()) {
            dependents.delete(normalizedName);
            if (dependents.size === 0) {
                this.dependencies.delete(dep);
            }
        }

        this.logger.info(`Plugin ${name} désactivé avec succès`);
    }

    /**
     * Récupère un plugin actif
     */
    getPlugin(name) {
        const pluginInfo = this.plugins.get(name.toLowerCase());
        if (!pluginInfo) {
            this.logger.debug(`Plugin ${name} non trouvé`);
            return null;
        }
        
        if (pluginInfo.error) {
            this.logger.warn(`Le plugin ${name} a échoué lors de son chargement: ${pluginInfo.error.message}`);
            return null;
        }
        
        return pluginInfo.instance;
    }

    /**
     * Vérifie si un plugin est actif
     */
    hasPlugin(name) {
        if (!name) return false;
        const has = this.plugins.has(name.toLowerCase());
        return has && !this.plugins.get(name.toLowerCase()).error;
    }

    /**
     * Configure le registre de plugins (pour la migration vers le système avancé)
     */
    setRegistry(registry) {
        this.registry = registry;
        this.logger.info('Plugin registry configuré');
    }

    /**
     * Migre les plugins existants vers le registre
     */
    async migrateToRegistry() {
        if (!this.registry) {
            this.logger.warn('Pas de registre configuré pour la migration');
            return;
        }

        let migrated = 0;
        for (const [name, pluginInfo] of this.plugins.entries()) {
            if (!pluginInfo.error && pluginInfo.instance && !this.registry.has(name)) {
                try {
                    this.registry.register(name, pluginInfo.instance);
                    migrated++;
                    this.logger.debug(`Plugin ${name} migré vers le registre`);
                } catch (error) {
                    this.logger.error(`Erreur lors de la migration du plugin ${name}:`, error);
                }
            }
        }
        
        this.logger.info(`${migrated} plugins migrés vers le registre`);
    }

    /**
     * Récupère tous les plugins d'un type donné
     */
    getPluginsByType(type) {
        const result = [];
        for (const [name, pluginInfo] of this.plugins.entries()) {
            if (!pluginInfo.error && pluginInfo.instance && pluginInfo.instance.type === type) {
                result.push(pluginInfo.instance);
            }
        }
        return result;
    }

    /**
     * Vérifie si toutes les dépendances d'un plugin sont satisfaites
     */
    checkDependencies(pluginName) {
        const plugin = this.getPlugin(pluginName);
        if (!plugin || !plugin.dependencies) return true;

        const missing = [];
        for (const dep of plugin.dependencies) {
            if (!this.hasPlugin(dep)) {
                missing.push(dep);
            }
        }

        if (missing.length > 0) {
            this.logger.warn(`Dépendances manquantes pour ${pluginName}: ${missing.join(', ')}`);
            return false;
        }

        return true;
    }

    /**
     * Désactive tous les plugins
     */
    async deactivateAll() {
        // Créer une copie des noms pour éviter les problèmes de modification pendant l'itération
        const pluginNames = Array.from(this.plugins.keys());
        
        // Désactiver les plugins dans l'ordre inverse de leurs dépendances
        const sortedNames = this.sortPluginsByDependencies(pluginNames);
        
        for (const name of sortedNames.reverse()) {
            await this.deactivate(name);
        }
    }

    /**
     * Trie les plugins selon leurs dépendances
     */
    sortPluginsByDependencies(pluginNames) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (name) => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                this.logger.warn(`Cycle de dépendance détecté pour ${name}`);
                return;
            }

            visiting.add(name);

            const plugin = this.getPlugin(name);
            if (plugin && plugin.dependencies) {
                for (const dep of plugin.dependencies) {
                    if (pluginNames.includes(dep.toLowerCase())) {
                        visit(dep.toLowerCase());
                    }
                }
            }

            visiting.delete(name);
            visited.add(name);
            sorted.push(name);
        };

        for (const name of pluginNames) {
            visit(name);
        }

        return sorted;
    }

    /**
     * Obtient des informations de diagnostic
     */
    getDiagnostics() {
        const diagnostics = {
            totalPlugins: this.plugins.size,
            loadedPlugins: [],
            failedPlugins: [],
            dependencies: {}
        };

        for (const [name, info] of this.plugins.entries()) {
            if (info.error) {
                diagnostics.failedPlugins.push({
                    name,
                    error: info.error.message
                });
            } else {
                diagnostics.loadedPlugins.push({
                    name,
                    type: info.instance.type,
                    version: info.instance.version,
                    dependencies: info.instance.dependencies || []
                });
            }
        }

        // Mapper les dépendances
        for (const [dep, dependents] of this.dependencies.entries()) {
            diagnostics.dependencies[dep] = Array.from(dependents);
        }

        return diagnostics;
    }
}