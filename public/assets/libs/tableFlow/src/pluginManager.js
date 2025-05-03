// src/pluginManager.js
export class PluginManager {
    constructor(tableInstance) {
        this.table = tableInstance;
        this.plugins = new Map();
        this.loadingPlugins = new Map();
        this.dependencies = new Map();
        this.registry = null;
        
        // Logger
        this.logger = this.table.logger || {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {}
        };
    }

    /**
     * Configure le registre de plugins
     */
    setRegistry(registry) {
        this.registry = registry;
        this.logger.info('Plugin registry configuré');
    }

    /**
     * Charge un plugin
     * @param {string} name - Nom du plugin
     * @param {Object} config - Configuration du plugin
     * @returns {Promise<Object>} Instance du plugin
     */
    async loadPlugin(name, config = {}) {
        if (!name) {
            throw new Error('Le nom du plugin est requis');
        }

        const normalizedName = name.toLowerCase();

        // Vérifier si le plugin est déjà chargé
        if (this.plugins.has(normalizedName)) {
            this.logger.warn(`Plugin ${name} déjà chargé`);
            return this.plugins.get(normalizedName).instance;
        }

        // Vérifier si le plugin est en cours de chargement
        if (this.loadingPlugins.has(normalizedName)) {
            this.logger.debug(`Plugin ${name} déjà en cours de chargement`);
            return this.loadingPlugins.get(normalizedName);
        }

        // Créer une promesse de chargement
        const loadPromise = this._loadPluginAsync(name, config);
        this.loadingPlugins.set(normalizedName, loadPromise);

        try {
            const plugin = await loadPromise;
            return plugin;
        } finally {
            this.loadingPlugins.delete(normalizedName);
        }
    }

    /**
     * Charge un plugin de manière asynchrone
     * @private
     */
    async _loadPluginAsync(name, config) {
        const normalizedName = name.toLowerCase();

        try {
            this.logger.debug(`Chargement du plugin: ${name}`);

            let pluginInstance;

            // Essayer d'abord le registre si disponible
            if (this.registry && this.registry.has(name)) {
                this.logger.debug(`Chargement du plugin ${name} depuis le registre`);
                pluginInstance = this.registry.get(name);
            } else {
                // Charger depuis le système de fichiers
                const pluginPath = `${this.table.options.pluginsPath}/${normalizedName}.js`;
                this.logger.debug(`Chargement du plugin ${name} depuis ${pluginPath}`);
                
                const pluginModule = await import(pluginPath);
                
                if (!pluginModule.default) {
                    throw new Error(`Le plugin ${name} n'exporte pas de classe par défaut`);
                }

                // Instancier le plugin
                const PluginClass = pluginModule.default;
                pluginInstance = new PluginClass({
                    ...config,
                    tableHandler: this.table,
                    debug: config.debug || this.table.options.debug
                });
            }

            // Valider le plugin
            this._validatePlugin(name, pluginInstance);

            // Vérifier et charger les dépendances
            if (pluginInstance.dependencies && Array.isArray(pluginInstance.dependencies)) {
                await this._loadDependencies(name, pluginInstance.dependencies);
            }

            // Initialiser le plugin
            this.logger.debug(`Initialisation du plugin ${name}`);
            await Promise.resolve(pluginInstance.init(this.table));

            // Enregistrer le plugin
            this.plugins.set(normalizedName, {
                instance: pluginInstance,
                config: config,
                name: name,
                status: 'active'
            });

            this.logger.info(`Plugin ${name} chargé avec succès`);
            return pluginInstance;

        } catch (error) {
            this.logger.error(`Erreur lors du chargement du plugin ${name}:`, error);
            this.plugins.set(normalizedName, { 
                error,
                status: 'error'
            });
            throw error;
        }
    }

    /**
     * Valide qu'un plugin respecte l'interface requise
     * @private
     */
    _validatePlugin(name, plugin) {
        if (!plugin || typeof plugin !== 'object') {
            throw new Error(`Le plugin ${name} n'est pas un objet valide`);
        }

        if (typeof plugin.init !== 'function') {
            throw new Error(`Le plugin ${name} doit avoir une méthode init()`);
        }

        // Les autres propriétés sont optionnelles mais recommandées
        const recommendations = [];
        
        if (!plugin.name) recommendations.push('name');
        if (!plugin.version) recommendations.push('version');
        if (typeof plugin.destroy !== 'function') recommendations.push('destroy()');
        
        if (recommendations.length > 0) {
            this.logger.warn(`Le plugin ${name} devrait implémenter: ${recommendations.join(', ')}`);
        }
    }

    /**
     * Charge les dépendances d'un plugin
     * @private
     */
    async _loadDependencies(pluginName, dependencies) {
        this.logger.debug(`Vérification des dépendances pour ${pluginName}: ${dependencies.join(', ')}`);

        // Détection des dépendances circulaires
        const visited = new Set();
        const recursionStack = new Set();

        const checkCircularDeps = async (name, deps) => {
            if (recursionStack.has(name)) {
                throw new Error(`Dépendance circulaire détectée: ${Array.from(recursionStack).join(' -> ')} -> ${name}`);
            }

            if (visited.has(name)) {
                return;
            }

            visited.add(name);
            recursionStack.add(name);

            for (const dep of deps) {
                const normalizedDep = dep.toLowerCase();
                
                // Si la dépendance n'est pas chargée, la charger
                if (!this.plugins.has(normalizedDep)) {
                    await this.loadPlugin(dep);
                }

                // Vérifier les sous-dépendances
                const depPlugin = this.plugins.get(normalizedDep);
                if (depPlugin?.instance?.dependencies) {
                    await checkCircularDeps(dep, depPlugin.instance.dependencies);
                }
            }

            recursionStack.delete(name);
        };

        await checkCircularDeps(pluginName, dependencies);

        // Enregistrer les dépendances
        for (const dep of dependencies) {
            const normalizedDep = dep.toLowerCase();
            
            if (!this.dependencies.has(normalizedDep)) {
                this.dependencies.set(normalizedDep, new Set());
            }
            
            this.dependencies.get(normalizedDep).add(pluginName.toLowerCase());
        }
    }

    /**
     * Active un plugin
     */
    async activate(name) {
        const normalizedName = name.toLowerCase();
        const pluginInfo = this.plugins.get(normalizedName);

        if (!pluginInfo) {
            throw new Error(`Plugin ${name} non trouvé`);
        }

        if (pluginInfo.status === 'active') {
            this.logger.warn(`Plugin ${name} déjà actif`);
            return pluginInfo.instance;
        }

        if (pluginInfo.status === 'error') {
            throw new Error(`Le plugin ${name} est en erreur: ${pluginInfo.error.message}`);
        }

        // Réactiver le plugin
        if (pluginInfo.instance && typeof pluginInfo.instance.activate === 'function') {
            await Promise.resolve(pluginInfo.instance.activate());
        }

        pluginInfo.status = 'active';
        this.logger.info(`Plugin ${name} activé`);
        
        return pluginInfo.instance;
    }

    /**
     * Désactive un plugin
     */
    async deactivate(name) {
        const normalizedName = name.toLowerCase();
        const pluginInfo = this.plugins.get(normalizedName);

        if (!pluginInfo || pluginInfo.status !== 'active') {
            this.logger.warn(`Plugin ${name} non trouvé ou inactif`);
            return false;
        }

        // Vérifier les dépendances
        const dependents = this.getDependents(name);
        if (dependents.length > 0) {
            this.logger.warn(`Le plugin ${name} a des dépendants actifs: ${dependents.join(', ')}`);
            
            // Demander confirmation ou désactiver les dépendants d'abord
            for (const dependent of dependents) {
                await this.deactivate(dependent);
            }
        }

        // Désactiver le plugin
        if (pluginInfo.instance) {
            if (typeof pluginInfo.instance.deactivate === 'function') {
                await Promise.resolve(pluginInfo.instance.deactivate());
            } else if (typeof pluginInfo.instance.destroy === 'function') {
                await Promise.resolve(pluginInfo.instance.destroy());
            }
        }

        pluginInfo.status = 'inactive';
        this.logger.info(`Plugin ${name} désactivé`);
        
        return true;
    }

    /**
     * Supprime complètement un plugin
     */
    async unload(name) {
        const normalizedName = name.toLowerCase();
        
        // Désactiver d'abord si nécessaire
        if (this.isActive(name)) {
            await this.deactivate(name);
        }

        // Nettoyer les dépendances
        this.dependencies.forEach((dependents, dependency) => {
            dependents.delete(normalizedName);
            if (dependents.size === 0) {
                this.dependencies.delete(dependency);
            }
        });

        // Supprimer le plugin
        this.plugins.delete(normalizedName);
        this.logger.info(`Plugin ${name} déchargé`);
        
        return true;
    }

    /**
     * Récupère un plugin par son nom
     */
    getPlugin(name) {
        if (!name) return null;
        
        const pluginInfo = this.plugins.get(name.toLowerCase());
        if (!pluginInfo || pluginInfo.status !== 'active') {
            return null;
        }
        
        return pluginInfo.instance;
    }

    /**
     * Vérifie si un plugin est chargé
     */
    hasPlugin(name) {
        if (!name) return false;
        
        const pluginInfo = this.plugins.get(name.toLowerCase());
        return pluginInfo && pluginInfo.status === 'active';
    }

    /**
     * Vérifie si un plugin est actif
     */
    isActive(name) {
        if (!name) return false;
        
        const pluginInfo = this.plugins.get(name.toLowerCase());
        return pluginInfo && pluginInfo.status === 'active';
    }

    /**
     * Récupère tous les plugins d'un certain type
     */
    getPluginsByType(type) {
        const result = [];
        
        for (const [name, pluginInfo] of this.plugins.entries()) {
            if (pluginInfo.status === 'active' && 
                pluginInfo.instance && 
                pluginInfo.instance.type === type) {
                result.push(pluginInfo.instance);
            }
        }
        
        return result;
    }

    /**
     * Récupère la liste des plugins qui dépendent d'un plugin donné
     */
    getDependents(pluginName) {
        const normalizedName = pluginName.toLowerCase();
        const dependents = this.dependencies.get(normalizedName);
        
        return dependents ? Array.from(dependents) : [];
    }

    /**
     * Vérifie si toutes les dépendances d'un plugin sont satisfaites
     */
    checkDependencies(pluginName) {
        const plugin = this.getPlugin(pluginName);
        if (!plugin || !plugin.dependencies) return true;

        const missing = plugin.dependencies.filter(dep => !this.hasPlugin(dep));
        
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
        const plugins = Array.from(this.plugins.keys());
        const deactivated = [];
        const failed = [];

        // Trier les plugins par dépendances (les dépendants en premier)
        const sorted = this._sortByDependencies(plugins);
        
        for (const name of sorted.reverse()) {
            try {
                await this.deactivate(name);
                deactivated.push(name);
            } catch (error) {
                this.logger.error(`Erreur lors de la désactivation de ${name}:`, error);
                failed.push(name);
            }
        }

        this.logger.info(`Plugins désactivés: ${deactivated.length}, échecs: ${failed.length}`);
        
        return { deactivated, failed };
    }

    /**
     * Trie les plugins selon leurs dépendances
     * @private
     */
    _sortByDependencies(pluginNames) {
        const sorted = [];
        const visited = new Set();
        const visiting = new Set();

        const visit = (name) => {
            if (visited.has(name)) return;
            if (visiting.has(name)) {
                this.logger.warn(`Cycle de dépendance détecté impliquant ${name}`);
                return;
            }

            visiting.add(name);

            const plugin = this.getPlugin(name);
            if (plugin?.dependencies) {
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
            if (!visited.has(name)) {
                visit(name);
            }
        }

        return sorted;
    }

    /**
     * Recharge un plugin
     */
    async reload(name) {
        const pluginInfo = this.plugins.get(name.toLowerCase());
        if (!pluginInfo) {
            throw new Error(`Plugin ${name} non trouvé`);
        }

        const config = pluginInfo.config;
        
        // Désactiver le plugin
        await this.deactivate(name);
        
        // Supprimer le plugin
        await this.unload(name);
        
        // Recharger le plugin
        return this.loadPlugin(name, config);
    }

    /**
     * Obtient des informations de diagnostic
     */
    getDiagnostics() {
        const diagnostics = {
            total: this.plugins.size,
            active: 0,
            inactive: 0,
            error: 0,
            plugins: [],
            dependencies: {}
        };

        for (const [name, info] of this.plugins.entries()) {
            const pluginInfo = {
                name,
                status: info.status,
                type: info.instance?.type,
                version: info.instance?.version,
                dependencies: info.instance?.dependencies || []
            };

            if (info.status === 'error') {
                pluginInfo.error = info.error.message;
                diagnostics.error++;
            } else if (info.status === 'active') {
                diagnostics.active++;
            } else {
                diagnostics.inactive++;
            }

            diagnostics.plugins.push(pluginInfo);
        }

        // Map des dépendances
        for (const [dep, dependents] of this.dependencies.entries()) {
            diagnostics.dependencies[dep] = Array.from(dependents);
        }

        return diagnostics;
    }

    /**
     * Exporte la configuration actuelle des plugins
     */
    exportConfiguration() {
        const config = {};
        
        for (const [name, info] of this.plugins.entries()) {
            if (info.status === 'active') {
                config[name] = info.config;
            }
        }
        
        return config;
    }

    /**
     * Importe une configuration de plugins
     */
    async importConfiguration(config) {
        const results = {
            loaded: [],
            failed: []
        };

        for (const [name, pluginConfig] of Object.entries(config)) {
            try {
                await this.loadPlugin(name, pluginConfig);
                results.loaded.push(name);
            } catch (error) {
                this.logger.error(`Échec du chargement de ${name}:`, error);
                results.failed.push({ name, error: error.message });
            }
        }

        return results;
    }
}