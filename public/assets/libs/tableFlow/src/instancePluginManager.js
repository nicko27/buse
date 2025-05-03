// src/instancePluginManager.js

// Importations (Assurez-vous que les chemins sont corrects)
import { pluginRegistry } from './pluginRegistry.js';
// import { PLUGIN_TYPES } from './types.js'; // Décommentez si utilisé

/**
 * Gère le cycle de vie des plugins pour une instance spécifique de TableInstance.
 * @class InstancePluginManager
 */
export class InstancePluginManager {
    /**
     * Crée une instance de InstancePluginManager.
     * @param {TableInstance} instance - L'instance de TableInstance associée.
     */
    constructor(instance) {
        /** @type {TableInstance} */
        this.instance = instance; // Référence à l'instance de table
        /** @type {Map<string, object>} */ // Utiliser un type plus précis si Plugin est défini
        this.activePlugins = new Map(); // Map des plugins actifs pour cette instance
        // Utiliser le logger de l'instance parente
        this.logger = instance.logger || console;
    }

    /**
     * Active un plugin pour cette instance (charge et initialise).
     * Gère les dépendances avant l'initialisation.
     * @param {string} name - Nom du plugin (sensible à la casse pour le chargement, insensible pour la gestion interne).
     * @param {object} [config={}] - Configuration spécifique pour ce plugin dans cette instance.
     * @returns {Promise<void>}
     * @throws {Error} Si le plugin est déjà actif, si une dépendance manque, ou si le chargement/initialisation échoue.
     */
    async activate(name, config = {}) {
        const lowerName = name.toLowerCase(); // Utiliser une clé insensible à la casse pour la gestion interne

        if (this.activePlugins.has(lowerName)) {
            // Si déjà actif, on ne fait rien ou on log un avertissement
            this.logger.warn?.(`[PluginManager ${this.instance.tableId}] Le plugin '${name}' est déjà actif.`);
            // Optionnellement, on pourrait retourner ou rejeter, selon le comportement souhaité.
            // throw new Error(`Le plugin ${name} est déjà actif pour cette instance`);
            return;
        }

        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Activation du plugin '${name}'...`);

        // 1. Charger le code du plugin (via le registre)
        // Note: 'name' ici est sensible à la casse, correspondant au nom du fichier/classe
        const pluginDefinition = await this.loadPlugin(name);

        // 2. Vérifier les dépendances
        const dependencies = pluginDefinition.dependencies || [];
        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Dépendances pour '${name}':`, dependencies);
        for (const depName of dependencies) {
            const lowerDepName = depName.toLowerCase();
            if (!this.activePlugins.has(lowerDepName)) {
                // Tentative d'activation automatique de la dépendance (optionnel)
                 this.logger.warn?.(`[PluginManager ${this.instance.tableId}] Dépendance '${depName}' pour '${name}' non trouvée. Tentative d'activation...`);
                 try {
                     // Récupérer la config de la dépendance si elle existe dans la config générale
                     const depConfig = this.instance.config.plugins?.[depName.toLowerCase()] || {};
                     await this.activate(depName, { ...depConfig, debug: this.instance.config.debug });
                     this.logger.info?.(`[PluginManager ${this.instance.tableId}] Dépendance '${depName}' activée automatiquement.`);
                 } catch (depError) {
                     throw new Error(`Dépendance requise '${depName}' pour le plugin '${name}' est manquante ou n'a pas pu être activée: ${depError.message}`);
                 }
                // Si l'activation automatique n'est pas souhaitée :
                // throw new Error(`Dépendance requise '${depName}' pour le plugin '${name}' est manquante.`);
            } else {
                 this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Dépendance '${depName}' pour '${name}' trouvée.`);
            }
        }

        // 3. Fusionner la configuration
        // Priorité: config passée > config du pluginDefinition > config par défaut (si définie dans le plugin)
        // Note: La config par défaut est souvent gérée dans le constructeur du plugin lui-même.
        const mergedConfig = {
            // ...(pluginDefinition.defaultConfig || {}), // Si les plugins exportent une config par défaut
            ...(pluginDefinition.config || {}), // Config potentiellement définie dans le registre
            ...config // Config spécifique passée lors de l'activation
        };
        // Assurer que le debug est hérité si non spécifié
        mergedConfig.debug = mergedConfig.debug ?? this.instance.config.debug;

        // 4. Créer une instance du plugin pour CETTE instance de table
        // On utilise 'pluginDefinition' qui est la classe chargée par le registre
        // Le constructeur du plugin doit accepter la config
        let pluginInstance;
        try {
             // Supposant que pluginDefinition est la classe exportée par défaut
             pluginInstance = new pluginDefinition(mergedConfig);
             // Attribuer le logger de l'instance au plugin si le plugin le supporte
             if ('setLogger' in pluginInstance && typeof pluginInstance.setLogger === 'function') {
                 pluginInstance.setLogger(this.logger);
             } else if (!pluginInstance.logger) {
                 // Ou assigner directement si une propriété logger existe
                 pluginInstance.logger = this.logger;
             }
        } catch (error) {
             throw new Error(`Erreur lors de l'instanciation du plugin '${name}': ${error.message}`);
        }


        // 5. Initialiser le plugin pour cette instance
        if (typeof pluginInstance.init !== 'function') {
            throw new Error(`Le plugin '${name}' chargé n'a pas de méthode init().`);
        }
        // L'initialisation est asynchrone
        await pluginInstance.init(this.instance); // Passe l'instance de TableInstance

        // 6. Stocker le plugin actif
        // Utiliser lowerName comme clé pour une récupération insensible à la casse
        this.activePlugins.set(lowerName, pluginInstance);
        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Plugin '${name}' activé et initialisé.`);
    }

    /**
     * Charge la définition (classe) d'un plugin via le registre central.
     * @param {string} name - Nom du plugin (sensible à la casse, correspond au nom du fichier/classe).
     * @returns {Promise<Function>} La classe/constructeur du plugin.
     * @throws {Error} Si le chargement échoue.
     */
    async loadPlugin(name) {
        // Vérifier si déjà chargé dans le registre global
        if (pluginRegistry.has(name)) {
            this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Plugin '${name}' trouvé dans le registre.`);
            // Le registre devrait retourner la classe/définition, pas une instance
            return pluginRegistry.get(name);
        }

        // Construire l'URL du plugin
        // Utilisation du chemin configuré dans l'instance ou chemin par défaut
        const pluginsPath = this.instance.config.pluginsPath || '../plugins'; // Ajusté le chemin par défaut
        // Assurer que le nom de fichier est en minuscule par convention
        const fileName = name.toLowerCase() + '.js';
        // Construire l'URL complète. Attention à la gestion des / relatifs.
        // Ceci suppose que pluginsPath est relatif à l'emplacement de instancePluginManager.js
        // ou est un chemin absolu. Une URL de base pourrait être plus robuste.
        const url = new URL(fileName, new URL(pluginsPath + '/', import.meta.url)).href;


        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Chargement de la définition du plugin '${name}' depuis ${url}...`);
        // Utiliser le registre pour charger (gère le cache de chargement)
        // Le registre devrait retourner la classe exportée par défaut
        return pluginRegistry.load(name, url);
    }

    /**
     * Désactive un plugin pour cette instance (appelle sa méthode destroy).
     * @param {string} name - Nom du plugin (insensible à la casse).
     * @returns {Promise<void>}
     */
    async deactivate(name) {
        const lowerName = name.toLowerCase();
        const pluginInstance = this.activePlugins.get(lowerName);

        if (pluginInstance) {
            this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Désactivation du plugin '${name}'...`);
            try {
                // Vérifier et appeler la méthode destroy si elle existe
                if (typeof pluginInstance.destroy === 'function') {
                    // La méthode destroy peut être synchrone ou asynchrone
                    await Promise.resolve(pluginInstance.destroy());
                }
                this.activePlugins.delete(lowerName);
                this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Plugin '${name}' désactivé.`);
            } catch (error) {
                 this.logger.error?.(`[PluginManager ${this.instance.tableId}] Erreur lors de la désactivation du plugin '${name}': ${error.message}`, error);
                 // On retire quand même de la liste active même si destroy échoue
                 this.activePlugins.delete(lowerName);
                 // Propage l'erreur si nécessaire
                 // throw error;
            }
        } else {
             this.logger.warn?.(`[PluginManager ${this.instance.tableId}] Tentative de désactivation d'un plugin non actif: '${name}'.`);
        }
    }

    /**
     * Vérifie si un plugin est actif pour cette instance.
     * @param {string} name - Nom du plugin (insensible à la casse).
     * @returns {boolean}
     */
    isActive(name) {
        return this.activePlugins.has(name.toLowerCase());
    }

    /**
     * Récupère une instance de plugin active.
     * @param {string} name - Nom du plugin (insensible à la casse).
     * @returns {object} L'instance du plugin.
     * @throws {Error} Si le plugin n'est pas actif pour cette instance.
     */
    getPlugin(name) {
        const lowerName = name.toLowerCase();
        const pluginInstance = this.activePlugins.get(lowerName);
        if (!pluginInstance) {
            // Log l'erreur mais la propage aussi pour que l'appelant sache
            const errorMsg = `Plugin '${name}' non actif pour l'instance '${this.instance.tableId}'`;
            this.logger.error?.(`[PluginManager ${this.instance.tableId}] ${errorMsg}`);
            throw new Error(errorMsg);
        }
        return pluginInstance;
    }

    /**
     * Récupère tous les plugins actifs d'un type donné pour cette instance.
     * @param {string} type - Type de plugin (ex: 'edit', 'validation'). Voir `types.js`.
     * @returns {Array<object>} Un tableau des instances de plugins correspondantes.
     */
    getPluginsByType(type) {
        return Array.from(this.activePlugins.values())
            // Vérifie la propriété 'type' de l'instance du plugin
            .filter(pluginInstance => pluginInstance.type === type);
    }

    /**
     * Désactive tous les plugins actifs pour cette instance.
     * @returns {Promise<void>}
     */
    async deactivateAll() {
        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Désactivation de tous les plugins (${this.activePlugins.size})...`);
        // Créer une copie des clés car la map sera modifiée pendant l'itération
        const pluginNames = Array.from(this.activePlugins.keys());
        const deactivatePromises = pluginNames.map(name => this.deactivate(name)); // Utilise le nom insensible à la casse stocké

        // Attendre que toutes les désactivations soient terminées
        await Promise.allSettled(deactivatePromises);
        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Tous les plugins ont été traités pour désactivation.`);
        // La map activePlugins est vidée au fur et à mesure par deactivate
    }

    /**
     * Appelle la méthode `refresh` sur tous les plugins actifs qui la possèdent.
     * Respecte l'ordre des dépendances si possible (nécessite une logique plus avancée).
     * @returns {Promise<void>}
     */
     async refreshAll() {
        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Rafraîchissement des plugins actifs (${this.activePlugins.size})...`);
        // TODO: Implémenter une logique de rafraîchissement qui respecte les dépendances,
        // similaire à la logique d'activation mais pour la méthode refresh.
        // Pour l'instant, simple itération.
        const refreshPromises = [];
        for (const [name, pluginInstance] of this.activePlugins.entries()) {
            if (typeof pluginInstance.refresh === 'function') {
                this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Appel de refresh() sur le plugin '${name}'...`);
                try {
                    // Gérer le refresh synchrone ou asynchrone
                    refreshPromises.push(Promise.resolve(pluginInstance.refresh()));
                } catch (error) {
                     this.logger.error?.(`[PluginManager ${this.instance.tableId}] Erreur lors du rafraîchissement du plugin '${name}': ${error.message}`, error);
                     // Ne pas bloquer les autres rafraîchissements
                }
            } else {
                 this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Plugin '${name}' n'a pas de méthode refresh().`);
            }
        }
        await Promise.allSettled(refreshPromises);
        this.logger.debug?.(`[PluginManager ${this.instance.tableId}] Rafraîchissement des plugins terminé.`);
    }
}