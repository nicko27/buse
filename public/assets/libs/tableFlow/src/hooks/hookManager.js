export class HookManager {
    constructor() {
        this.hooks = new Map();
        this.hookDependencies = new Map();
        this.hookPriorities = new Map();
    }

    /**
     * Enregistre un hook
     * @param {string} name - Nom du hook
     * @param {Function} callback - Fonction de callback
     * @param {Object} options - Options du hook
     * @param {number} [options.priority=10] - Priorité d'exécution
     * @param {Array<string>} [options.dependencies=[]] - Dépendances du hook
     * @returns {Function} Fonction de désinscription
     */
    register(name, callback, options = {}) {
        const { priority = 10, dependencies = [] } = options;

        if (!this.hooks.has(name)) {
            this.hooks.set(name, new Set());
            this.hookPriorities.set(name, new Map());
        }

        const hookSet = this.hooks.get(name);
        const priorityMap = this.hookPriorities.get(name);

        // Enregistrer le callback avec sa priorité
        hookSet.add(callback);
        priorityMap.set(callback, priority);

        // Enregistrer les dépendances
        if (dependencies.length > 0) {
            this.hookDependencies.set(callback, dependencies);
        }

        return () => this.unregister(name, callback);
    }

    /**
     * Désenregistre un hook
     * @param {string} name - Nom du hook
     * @param {Function} callback - Fonction de callback
     */
    unregister(name, callback) {
        if (this.hooks.has(name)) {
            const hookSet = this.hooks.get(name);
            const priorityMap = this.hookPriorities.get(name);

            hookSet.delete(callback);
            priorityMap.delete(callback);
            this.hookDependencies.delete(callback);

            if (hookSet.size === 0) {
                this.hooks.delete(name);
                this.hookPriorities.delete(name);
            }
        }
    }

    /**
     * Exécute un hook
     * @param {string} name - Nom du hook
     * @param {*} context - Contexte d'exécution
     * @param {Array} args - Arguments à passer aux callbacks
     * @returns {Promise<Array>} Résultats des callbacks
     */
    async execute(name, context, ...args) {
        if (!this.hooks.has(name)) {
            return [];
        }

        const hookSet = this.hooks.get(name);
        const priorityMap = this.hookPriorities.get(name);

        // Trier les callbacks par priorité
        const sortedCallbacks = Array.from(hookSet).sort((a, b) => {
            const priorityA = priorityMap.get(a) || 10;
            const priorityB = priorityMap.get(b) || 10;
            return priorityA - priorityB;
        });

        const results = [];

        // Exécuter les callbacks dans l'ordre
        for (const callback of sortedCallbacks) {
            try {
                // Vérifier les dépendances
                const dependencies = this.hookDependencies.get(callback) || [];
                const dependencyResults = await Promise.all(
                    dependencies.map(dep => this.execute(dep, context, ...args))
                );

                // Exécuter le callback
                const result = await callback.call(context, ...args, ...dependencyResults);
                results.push(result);
            } catch (error) {
                console.error(`Erreur dans le hook ${name}:`, error);
                throw error;
            }
        }

        return results;
    }

    /**
     * Vérifie si un hook existe
     * @param {string} name - Nom du hook
     * @returns {boolean} True si le hook existe
     */
    has(name) {
        return this.hooks.has(name) && this.hooks.get(name).size > 0;
    }

    /**
     * Nettoie tous les hooks
     */
    destroy() {
        this.hooks.clear();
        this.hookDependencies.clear();
        this.hookPriorities.clear();
    }
} 