// src/pluginRegistry.js

// Importe les types définis (si nécessaire pour la validation)
import { PLUGIN_TYPES } from './types.js';

/**
 * Registre centralisé pour les définitions de plugins TableFlow.
 * Gère le chargement (y compris asynchrone via import()), l'enregistrement,
 * et la récupération des définitions de plugins. Assure qu'un plugin
 * n'est chargé qu'une seule fois.
 * @class PluginRegistry
 */
class PluginRegistry {
    constructor() {
        /**
         * Stocke les définitions de plugins chargées (la classe ou l'objet exporté).
         * Clé: Nom du plugin (sensible à la casse, correspond au nom de la classe/fichier).
         * Valeur: La définition du plugin (généralement la classe).
         * @type {Map<string, Function|object>}
         */
        this.plugins = new Map();

        /**
         * Stocke les promesses pour les plugins en cours de chargement.
         * Évite les chargements multiples si `load` est appelé plusieurs fois pour le même plugin.
         * Clé: Nom du plugin (sensible à la casse).
         * Valeur: Promesse résolvant avec la définition du plugin.
         * @type {Map<string, Promise<Function|object>>}
         */
        this.loadingPlugins = new Map();

        // Initialiser un logger simple
        this.logger = console;
    }

     /**
      * Configure le logger pour le registre.
      * @param {object} loggerInstance - Instance de logger.
      */
     setLogger(loggerInstance) {
         this.logger = loggerInstance || console;
     }


    /**
     * Enregistre une définition de plugin (généralement une classe) dans le registre.
     * @param {string} name - Nom du plugin (sensible à la casse).
     * @param {Function|object} pluginDefinition - La classe ou l'objet exporté par le module du plugin.
     * @throws {Error} Si un plugin du même nom est déjà enregistré.
     * @throws {Error} Si la définition du plugin est invalide (type, interface).
     */
    register(name, pluginDefinition) {
        this.logger.debug?.(`[PluginRegistry] Tentative d'enregistrement du plugin '${name}'...`);
        if (this.plugins.has(name)) {
            // Avertissement plutôt qu'erreur si la définition est identique? Pour l'instant, erreur.
            this.logger.error?.(`[PluginRegistry] Le plugin '${name}' est déjà enregistré.`);
            throw new Error(`Le plugin ${name} est déjà enregistré`);
        }

        // --- Validation de la définition du plugin ---
        // Supposons que la définition est la classe elle-même ou un objet avec les méthodes statiques/prototype
        let pluginPrototype;
        if (typeof pluginDefinition === 'function' && pluginDefinition.prototype) {
            pluginPrototype = pluginDefinition.prototype;
        } else if (typeof pluginDefinition === 'object' && pluginDefinition !== null) {
            // Si c'est un objet, on vérifie directement les propriétés
            pluginPrototype = pluginDefinition;
        } else {
             this.logger.error?.(`[PluginRegistry] La définition du plugin '${name}' n'est ni une fonction (classe) ni un objet valide.`);
            throw new Error(`La définition du plugin ${name} est invalide.`);
        }

        // 1. Validation du type (si défini sur le prototype ou l'objet)
        const pluginType = pluginPrototype.type || pluginDefinition.type; // Vérifie sur prototype ou classe/objet
        if (!pluginType || !Object.values(PLUGIN_TYPES).includes(pluginType)) {
             this.logger.error?.(`[PluginRegistry] Type de plugin invalide ou manquant pour '${name}': ${pluginType}`);
            throw new Error(`Type de plugin invalide ou manquant pour ${name}: ${pluginType}`);
        }

        // 2. Validation de l'interface minimale (méthodes init et destroy)
        // Ces méthodes sont généralement sur le prototype pour les classes
        if (typeof pluginPrototype.init !== 'function') {
             this.logger.error?.(`[PluginRegistry] Le plugin '${name}' doit implémenter la méthode 'init'.`);
            throw new Error(`Le plugin ${name} ne respecte pas l'interface requise (méthode 'init' manquante)`);
        }
         if (typeof pluginPrototype.destroy !== 'function') {
             this.logger.error?.(`[PluginRegistry] Le plugin '${name}' doit implémenter la méthode 'destroy'.`);
            throw new Error(`Le plugin ${name} ne respecte pas l'interface requise (méthode 'destroy' manquante)`);
        }
        // 3. Validation optionnelle (méthode refresh)
        if ('refresh' in pluginPrototype && typeof pluginPrototype.refresh !== 'function') {
            this.logger.warn?.(`[PluginRegistry] Le plugin '${name}' a une propriété 'refresh' mais ce n'est pas une fonction.`);
        }

        // 4. Validation de version (placeholder)
        // TODO: Implémenter une vérification de compatibilité de version si nécessaire.
        // Exemple: if (pluginDefinition.requiredCoreVersion && !isCompatible(CORE_VERSION, pluginDefinition.requiredCoreVersion)) { ... }
        // this.logger.debug?.(`[PluginRegistry] Version du plugin '${name}': ${pluginDefinition.version || 'non spécifiée'}`);

        // Enregistrement si toutes les validations passent
        this.plugins.set(name, pluginDefinition);
        this.logger.debug?.(`[PluginRegistry] Plugin '${name}' enregistré avec succès.`);
    }

    /**
     * Charge dynamiquement un plugin depuis une URL via import().
     * Utilise un cache pour éviter les chargements multiples.
     * Enregistre automatiquement le plugin après chargement réussi.
     * @param {string} name - Nom du plugin (sensible à la casse, utilisé pour l'enregistrement).
     * @param {string} url - URL absolue ou relative du fichier JS du plugin.
     * @returns {Promise<Function|object>} Une promesse qui résout avec la définition du plugin (classe/objet).
     * @throws {Error} Si le chargement ou l'enregistrement échoue.
     */
    async load(name, url) {
        // Si le plugin est déjà enregistré, le retourner directement
        if (this.plugins.has(name)) {
            this.logger.debug?.(`[PluginRegistry] Plugin '${name}' déjà enregistré, retour direct.`);
            return this.plugins.get(name);
        }

        // Si le plugin est déjà en cours de chargement, retourner la promesse existante
        if (this.loadingPlugins.has(name)) {
            this.logger.debug?.(`[PluginRegistry] Plugin '${name}' en cours de chargement, retour de la promesse existante.`);
            return this.loadingPlugins.get(name);
        }

        this.logger.debug?.(`[PluginRegistry] Lancement du chargement pour le plugin '${name}' depuis ${url}...`);

        // Créer et stocker la promesse de chargement
        const loadPromise = (async () => {
            try {
                // Utiliser import() dynamique pour charger le module
                const module = await import(url);

                // Vérifier si l'export par défaut existe et est valide (classe ou objet)
                if (!module.default || (typeof module.default !== 'function' && typeof module.default !== 'object')) {
                    throw new Error(`Le module chargé depuis ${url} pour le plugin '${name}' n'exporte pas une classe ou un objet valide par défaut.`);
                }

                const pluginDefinition = module.default;

                // Enregistrer le plugin chargé (avec validation interne)
                this.register(name, pluginDefinition);

                this.logger.debug?.(`[PluginRegistry] Plugin '${name}' chargé et enregistré avec succès depuis ${url}.`);
                return pluginDefinition; // Retourner la définition (classe/objet)

            } catch (error) {
                this.logger.error?.(`[PluginRegistry] Erreur lors du chargement/enregistrement du plugin '${name}' depuis ${url}: ${error.message}`, error);
                // Propager l'erreur pour que l'appelant puisse la gérer
                throw new Error(`Erreur lors du chargement du plugin ${name}: ${error.message}`);
            } finally {
                // Nettoyer la promesse de chargement une fois terminée (succès ou échec)
                this.loadingPlugins.delete(name);
            }
        })();

        // Stocker la promesse pour éviter les chargements concurrents
        this.loadingPlugins.set(name, loadPromise);
        return loadPromise;
    }

    /**
     * Récupère la définition d'un plugin enregistré.
     * @param {string} name - Nom du plugin (sensible à la casse).
     * @returns {Function|object} La définition du plugin (classe/objet).
     * @throws {Error} Si le plugin n'est pas trouvé dans le registre.
     */
    get(name) {
        const pluginDefinition = this.plugins.get(name);
        if (!pluginDefinition) {
             this.logger.error?.(`[PluginRegistry] Plugin '${name}' non trouvé dans le registre.`);
            throw new Error(`Plugin ${name} non trouvé`);
        }
        return pluginDefinition;
    }

    /**
     * Vérifie si un plugin est enregistré (déjà chargé et validé).
     * @param {string} name - Nom du plugin (sensible à la casse).
     * @returns {boolean} True si le plugin est enregistré, false sinon.
     */
    has(name) {
        return this.plugins.has(name);
    }

    /**
     * Supprime un plugin du registre.
     * @param {string} name - Nom du plugin (sensible à la casse).
     */
    unregister(name) {
        const deleted = this.plugins.delete(name);
        if (deleted) {
             this.logger.debug?.(`[PluginRegistry] Plugin '${name}' désenregistré.`);
        } else {
             this.logger.warn?.(`[PluginRegistry] Tentative de désenregistrement d'un plugin non trouvé: '${name}'.`);
        }
        // Doit-on aussi annuler une promesse de chargement en cours ? C'est complexe.
        // Pour l'instant, on ne supprime que les plugins déjà enregistrés.
    }

    /**
     * Récupère toutes les définitions de plugins enregistrées d'un type donné.
     * @param {string} type - Type de plugin (ex: 'edit', 'validation'). Voir `types.js`.
     * @returns {Array<Function|object>} Un tableau des définitions de plugins correspondantes.
     */
    getByType(type) {
        const matchingPlugins = [];
        for (const pluginDefinition of this.plugins.values()) {
            // Accéder au type via le prototype pour les classes, ou directement pour les objets
            const pluginType = (typeof pluginDefinition === 'function' ? pluginDefinition.prototype.type : pluginDefinition.type);
            if (pluginType === type) {
                matchingPlugins.push(pluginDefinition);
            }
        }
        return matchingPlugins;
    }

    /**
     * Vide complètement le registre des plugins et des chargements en cours.
     * Principalement utile pour les tests ou un redémarrage complet.
     */
    clear() {
        this.plugins.clear();
        this.loadingPlugins.clear();
        this.logger.info?.(`[PluginRegistry] Registre vidé.`);
    }
}

// Exporter une instance singleton du registre pour être utilisée globalement
export const pluginRegistry = new PluginRegistry();