// src/instanceManager.js

// Importations (Assurez-vous que les chemins sont corrects)
// import { PLUGIN_TYPES } from './types.js'; // Décommentez si TableConfig/PluginConfig sont utilisés ici
import { InstancePluginManager } from './instancePluginManager.js';

// Suggestion: Déplacer la classe TableInstance dans son propre fichier (ex: src/tableInstance.js)
// pour une meilleure organisation du code.
/**
 * Représente une instance unique d'une table gérée par TableFlow.
 * @class TableInstance
 */
class TableInstance {
    /**
     * Crée une instance de TableInstance.
     * @param {string} tableId - L'ID de l'élément table HTML.
     * @param {object} config - La configuration spécifique pour cette instance.
     * @throws {Error} Si l'élément table n'est pas trouvé.
     */
    constructor(tableId, config) {
        this.tableId = tableId;
        // Suggestion: Harmoniser la structure de configuration.
        // Actuellement, certaines options (comme wrapCellsEnabled) sont définies ici,
        // tandis que d'autres viennent de la configuration TableFlow.
        // Envisager une fusion plus claire ou une structure unique.
        this.config = {
            wrapCellsEnabled: true, // Valeur par défaut si non fournie
            wrapHeadersEnabled: true, // Valeur par défaut si non fournie
            wrapCellClass: 'cell-wrapper', // Valeur par défaut
            wrapHeaderClass: 'head-wrapper', // Valeur par défaut
            pluginsPath: '../plugins', // Chemin par défaut vers les plugins
            ...config // Fusionne avec la configuration fournie
        };
        this.element = document.getElementById(tableId);
        if (!this.element) {
            throw new Error(`Élément table #${tableId} non trouvé`);
        }
        if (this.element.tagName.toLowerCase() !== 'table') {
             throw new Error(`L'élément #${tableId} n'est pas une balise <table>.`);
        }

        /** @type {Map<string, object>} */ // Type plus générique pour l'instance de plugin
        this.plugins = new Map();

        /** @type {Map<string, any>} */ // Utiliser un type plus précis si CellState est défini
        this.cellStates = new Map(); // Pourrait stocker l'état des cellules si nécessaire

        // Initialisation du gestionnaire de plugins spécifique à cette instance
        this.pluginManager = new InstancePluginManager(this);

        // Ajouter un logger pour cette instance, peut-être hérité de la config
        this.logger = config.logger || console; // Utilise le logger fourni ou la console par défaut
    }

    /**
     * Initialise l'instance de table de manière asynchrone.
     * Configure la table et initialise les plugins.
     * @returns {Promise<void>}
     * @throws {Error} Si l'initialisation des plugins échoue.
     */
    async init() {
        this.logger.debug?.(`[TableInstance ${this.tableId}] Initialisation...`);
        try {
            this.setupTable();
            await this.initPlugins();
            this.logger.debug?.(`[TableInstance ${this.tableId}] Initialisation terminée.`);
        } catch (error) {
            this.logger.error?.(`[TableInstance ${this.tableId}] Échec de l'initialisation: ${error.message}`, error);
            // Propage l'erreur pour que createInstance puisse la gérer
            throw error;
        }
    }

    /**
     * Configure la structure de base de la table (wrappers).
     */
    setupTable() {
        this.logger.debug?.(`[TableInstance ${this.tableId}] Configuration de la table...`);
        // Envelopper les cellules et en-têtes si activé dans la configuration
        if (this.config.wrapCellsEnabled) {
            this.wrapCells();
        }
        if (this.config.wrapHeadersEnabled) {
            this.wrapHeaders();
        }
        this.logger.debug?.(`[TableInstance ${this.tableId}] Wrappers configurés (si activés).`);
    }

    /**
     * Initialise les plugins configurés pour cette instance.
     * Utilise InstancePluginManager pour charger et initialiser.
     * @returns {Promise<void>}
     * @throws {Error} Si le chargement ou l'initialisation d'un plugin échoue.
     */
    async initPlugins() {
        this.logger.debug?.(`[TableInstance ${this.tableId}] Initialisation des plugins...`);
        const pluginsConfig = this.config.plugins || {};
        const pluginNames = pluginsConfig.names || [];

        if (!Array.isArray(pluginNames)) {
             this.logger.warn?.(`[TableInstance ${this.tableId}] La configuration 'plugins.names' n'est pas un tableau.`);
             return;
        }
         if (pluginNames.length === 0) {
             this.logger.info?.(`[TableInstance ${this.tableId}] Aucun plugin à initialiser.`);
             return;
         }


        // Itérer sur les noms de plugins à activer
        for (const name of pluginNames) {
            const lowerName = name.toLowerCase();
            // Récupérer la configuration spécifique du plugin, ou un objet vide
            const pluginSpecificConfig = pluginsConfig[lowerName] || {};

            try {
                // Utiliser InstancePluginManager pour activer (charger et initialiser)
                // Passer la configuration spécifique fusionnée avec la config globale de debug
                await this.pluginManager.activate(name, {
                    ...pluginSpecificConfig,
                    debug: this.config.debug // Héritage du debug global
                });
                 this.logger.debug?.(`[TableInstance ${this.tableId}] Plugin '${name}' initialisé.`);
            } catch (error) {
                 this.logger.error?.(`[TableInstance ${this.tableId}] Échec de l'initialisation du plugin '${name}': ${error.message}`, error);
                 // Propage l'erreur pour arrêter l'initialisation de l'instance
                 throw new Error(`Échec de l'initialisation du plugin '${name}': ${error.message}`);
            }
        }
         this.logger.debug?.(`[TableInstance ${this.tableId}] Tous les plugins demandés ont été initialisés.`);
    }

    /**
     * Récupère une instance de plugin active pour cette table.
     * @param {string} name - Le nom du plugin.
     * @returns {object|null} L'instance du plugin ou null si non trouvé ou erreur.
     */
    getPlugin(name) {
        try {
            return this.pluginManager.getPlugin(name);
        } catch (error) {
            this.logger.warn?.(`[TableInstance ${this.tableId}] Tentative d'accès au plugin inactif '${name}': ${error.message}`);
            return null;
        }
    }

    /**
     * Détruit l'instance de table et nettoie les ressources.
     * Désactive tous les plugins actifs.
     * @returns {Promise<void>}
     */
    async destroy() {
        this.logger.debug?.(`[TableInstance ${this.tableId}] Destruction...`);
        // Désactiver tous les plugins gérés par le manager
        await this.pluginManager.deactivateAll();
        this.plugins.clear(); // Assurer que la map interne est vide (gérée par pluginManager)
        this.cellStates.clear();
        // Supprimer les éventuels écouteurs ajoutés par TableInstance elle-même (si applicable)
        this.logger.debug?.(`[TableInstance ${this.tableId}] Destruction terminée.`);
    }

    /**
     * Enveloppe le contenu des cellules <td> dans des divs.
     * Utilise la classe définie dans `config.wrapCellClass`.
     */
    wrapCells() {
        const cells = this.element.querySelectorAll('tbody td'); // Cible tbody uniquement
        this.logger.debug?.(`[TableInstance ${this.tableId}] Wrapping ${cells.length} cellules <td>...`);
        cells.forEach(cell => {
            // Vérifie si un wrapper existe déjà pour éviter doublons
            if (!cell.querySelector(`.${this.config.wrapCellClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.config.wrapCellClass;
                // Déplacer le contenu existant dans le wrapper
                while (cell.firstChild) {
                    wrapper.appendChild(cell.firstChild);
                }
                cell.appendChild(wrapper);
            }
        });
    }

    /**
     * Enveloppe le contenu des cellules d'en-tête <th> dans des divs.
     * Utilise la classe définie dans `config.wrapHeaderClass`.
     */
    wrapHeaders() {
        const headers = this.element.querySelectorAll('thead th'); // Cible thead uniquement
        this.logger.debug?.(`[TableInstance ${this.tableId}] Wrapping ${headers.length} en-têtes <th>...`);
        headers.forEach(header => {
            // Vérifie si un wrapper existe déjà
            if (!header.querySelector(`.${this.config.wrapHeaderClass}`)) {
                const wrapper = document.createElement('div');
                wrapper.className = this.config.wrapHeaderClass;
                // Déplacer le contenu existant
                while (header.firstChild) {
                    wrapper.appendChild(header.firstChild);
                }
                header.appendChild(wrapper);
            }
        });
    }

    // --- API Publique Potentielle pour TableInstance ---
    // Ajouter ici les méthodes de l'API Core qui agissent sur CETTE instance
    // spécifique, par exemple : getRowData, markRowAsSaved, addRow, removeRow, etc.
    // Ces méthodes utiliseraient this.element, this.config, this.plugins, etc.
    // Exemple:
    // getRowData(rowElementOrId) { /* ... logique ... */ }
    // markRowAsSaved(rowElement, options) { /* ... logique ... */ }
}


/**
 * Gestionnaire centralisé pour toutes les instances de TableFlow sur la page.
 * Assure qu'il n'y a qu'une seule instance par ID de table.
 * @class InstanceManager
 */
class InstanceManager {
    constructor() {
        /** @type {Map<string, TableInstance>} */
        this.instances = new Map();
        // Initialiser un logger simple par défaut
        this.logger = console;
    }

    /**
     * Configure le logger pour le gestionnaire.
     * @param {object} loggerInstance - Une instance de logger (ex: console, ou un logger personnalisé).
     */
    setLogger(loggerInstance) {
        this.logger = loggerInstance || console;
    }

    /**
     * Crée ou récupère une instance de table gérée.
     * Si une instance pour tableId existe déjà, elle est retournée.
     * Sinon, une nouvelle instance est créée et initialisée.
     * @param {string} tableId - L'ID de l'élément table HTML.
     * @param {object} config - La configuration pour la table et ses plugins. Doit inclure `plugins: { names: [...] }`.
     * @returns {Promise<TableInstance>} Une promesse qui résout avec l'instance de table initialisée.
     * @throws {Error} Si la création ou l'initialisation échoue.
     */
    async createInstance(tableId, config = {}) {
        // Vérifier si une instance existe déjà
        if (this.hasInstance(tableId)) {
            this.logger.warn?.(`[InstanceManager] Une instance existe déjà pour la table '${tableId}'. Retour de l'instance existante.`);
            return this.getInstance(tableId);
        }

        this.logger.info?.(`[InstanceManager] Création d'une nouvelle instance pour la table '${tableId}'...`);
        try {
            // Passer le logger à l'instance si non défini dans la config
            const instanceConfig = { logger: this.logger, ...config };
            const instance = new TableInstance(tableId, instanceConfig);

            // Initialiser l'instance (charge les plugins, etc.)
            // Le try...catch ici gère les erreurs d'initialisation de TableInstance
            await instance.init();

            // Stocker l'instance après initialisation réussie
            this.instances.set(tableId, instance);
            this.logger.info?.(`[InstanceManager] Instance pour la table '${tableId}' créée et initialisée avec succès.`);
            return instance;
        } catch (error) {
            this.logger.error?.(`[InstanceManager] Échec de la création/initialisation de l'instance pour '${tableId}': ${error.message}`, error);
            // Nettoyer si une instance partielle a été ajoutée à la map (peu probable ici)
            if (this.instances.has(tableId)) {
                this.instances.delete(tableId);
            }
            // Propage l'erreur pour informer l'appelant
            throw error;
        }
    }

    /**
     * Récupère une instance de table existante par son ID.
     * @param {string} tableId - L'ID de l'élément table HTML.
     * @returns {TableInstance | undefined} L'instance de table si elle existe, sinon undefined.
     */
    getInstance(tableId) {
        const instance = this.instances.get(tableId);
        if (!instance) {
            this.logger.warn?.(`[InstanceManager] Aucune instance trouvée pour la table '${tableId}'.`);
        }
        return instance;
    }

    /**
     * Vérifie si une instance existe pour un ID de table donné.
     * @param {string} tableId - L'ID de l'élément table HTML.
     * @returns {boolean} True si une instance existe, sinon false.
     */
    hasInstance(tableId) {
        return this.instances.has(tableId);
    }

    /**
     * Détruit une instance de table spécifique par son ID.
     * Appelle la méthode destroy() de l'instance pour nettoyer les plugins et les écouteurs.
     * @param {string} tableId - L'ID de l'élément table HTML.
     * @returns {Promise<boolean>} Une promesse qui résout avec true si l'instance a été détruite, false sinon.
     */
    async destroyInstance(tableId) {
        const instance = this.instances.get(tableId);
        if (instance) {
            this.logger.info?.(`[InstanceManager] Destruction de l'instance pour la table '${tableId}'...`);
            try {
                await instance.destroy(); // Appelle le nettoyage de l'instance et de ses plugins
                this.instances.delete(tableId); // Retire de la map
                this.logger.info?.(`[InstanceManager] Instance pour la table '${tableId}' détruite avec succès.`);
                return true;
            } catch (error) {
                 this.logger.error?.(`[InstanceManager] Erreur lors de la destruction de l'instance '${tableId}': ${error.message}`, error);
                 // Même en cas d'erreur, on essaie de retirer de la map
                 this.instances.delete(tableId);
                 return false;
            }
        } else {
            this.logger.warn?.(`[InstanceManager] Tentative de destruction d'une instance inexistante pour '${tableId}'.`);
            return false;
        }
    }

    /**
     * Détruit toutes les instances de tables gérées par ce gestionnaire.
     * @returns {Promise<void>}
     */
    async destroyAll() {
        this.logger.info?.(`[InstanceManager] Destruction de toutes les instances (${this.instances.size})...`);
        const destroyPromises = Array.from(this.instances.keys()).map(tableId =>
            // Utiliser destroyInstance pour assurer un logging et une gestion d'erreur corrects
            this.destroyInstance(tableId)
        );
        // Attendre que toutes les destructions soient terminées (ou échouent)
        await Promise.allSettled(destroyPromises);
        // La map `instances` est vidée au fur et à mesure par `destroyInstance`
        this.logger.info?.(`[InstanceManager] Toutes les instances ont été traitées pour destruction.`);
    }
}

// Créer et exporter une instance singleton du gestionnaire
export const instanceManager = new InstanceManager();
