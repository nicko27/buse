// src/tableFlow.js

// Importe le gestionnaire d'instances centralisé
import { instanceManager } from './instanceManager.js';

/**
 * Classe principale TableFlow.
 * Agit comme une façade pour créer et interagir avec une instance de table gérée
 * via InstanceManager et TableInstance.
 * @class TableFlow
 */
export default class TableFlow {
    /**
     * Crée une instance de TableFlow et initialise la gestion de la table associée.
     * @param {object} options - Options de configuration pour la table et les plugins.
     * @param {string} options.tableId - ID requis de l'élément <table> HTML.
     * @param {object} [options.plugins={}] - Configuration des plugins (ex: { names: ['Sort', 'Edit'], sort: {...} }).
     * @param {string} [options.pluginsPath='../plugins'] - Chemin vers le dossier des plugins.
     * @param {boolean} [options.debug=false] - Active les logs de débogage.
     * @param {number} [options.verbosity=0] - Niveau de verbosité des logs (0: erreurs, 1: +succès, 2: +debug).
     * @param {object} [options.notifications={}] - Fonctions pour afficher les notifications (info, warning, success, error).
     * @param {boolean} [options.wrapCellsEnabled=true] - Activer l'enveloppement des cellules <td>.
     * @param {boolean} [options.wrapHeadersEnabled=true] - Activer l'enveloppement des en-têtes <th>.
     * @param {string} [options.wrapCellClass='cell-wrapper'] - Classe CSS pour le wrapper de cellule.
     * @param {string} [options.wrapHeaderClass='head-wrapper'] - Classe CSS pour le wrapper d'en-tête.
     * @throws {Error} Si tableId est manquant ou si l'initialisation de l'instance échoue.
     */
    constructor(options = {}) {
        /** @type {object} */
        this.options = {
            plugins: {}, // Initialiser comme objet vide par défaut
            pluginsPath: '../plugins',
            debug: false,
            verbosity: 0,
            notifications: {},
            wrapCellsEnabled: true,
            wrapHeadersEnabled: true,
            wrapCellClass: 'cell-wrapper',
            wrapHeaderClass: 'head-wrapper',
            ...options // Fusionner avec les options fournies
        };

        // Configurer le système de journalisation (logger)
        // Ce logger sera potentiellement passé à InstanceManager et TableInstance
        this.logger = this._setupLogger(this.options);

        /** @type {string} */
        this.tableId = this.options.tableId;

        /** @type {TableInstance | null} */
        this.tableInstance = null; // Référence à l'instance gérée par instanceManager

        // Vérification initiale de tableId
        if (!this.tableId) {
            const error = new Error("L'option 'tableId' est requise pour initialiser TableFlow.");
            this.logger.error(error.message);
            throw error; // Arrêter l'exécution si tableId manque
        }

        // --- Initialisation Déléguée ---
        // L'initialisation réelle (chargement plugins, wrappers, etc.)
        // est maintenant gérée par instanceManager.createInstance -> TableInstance.init()
        // On stocke la promesse d'initialisation pour pouvoir l'attendre si nécessaire.
        /** @type {Promise<TableInstance>} */
        this._initializationPromise = this._initializeInstance();

        // Log de début d'initialisation
        this.logger.info(`[TableFlow] Initialisation demandée pour la table #${this.tableId}...`);

        // Gérer les erreurs d'initialisation non capturées
        this._initializationPromise.catch(error => {
             // Log déjà fait dans instanceManager/TableInstance, mais on peut ajouter un log TableFlow
             this.logger.error(`[TableFlow] Échec final de l'initialisation pour #${this.tableId}. L'instance n'est pas utilisable.`, error);
             // L'erreur originale est déjà propagée par _initializeInstance
        });
    }

    /**
     * Met en place le logger basé sur les options.
     * @param {object} options - Les options fournies au constructeur.
     * @returns {object} L'instance du logger.
     * @private
     */
    _setupLogger(options) {
        // Utiliser le logger fourni si disponible, sinon créer un logger basé sur console
        if (options.logger) {
            return options.logger;
        }

        const debugEnabled = options.debug || options.verbosity > 1;
        const infoEnabled = options.debug || options.verbosity > 0;

        // Créer un objet logger simple
        const logger = {
            error: (message, data) => {
                console.error(`[TableFlow] ❌ ERREUR: ${message}`, data ?? '');
                this.notify('error', message); // Appelle la notification configurée
            },
            warn: (message, data) => {
                console.warn(`[TableFlow] ⚠️ ATTENTION: ${message}`, data ?? '');
                this.notify('warning', message);
            },
            info: (message, data) => {
                if (infoEnabled) {
                    console.info(`[TableFlow] ℹ️ INFO: ${message}`, data ?? '');
                }
                 // Ne pas notifier pour chaque info par défaut, sauf si explicitement voulu
                 // this.notify('info', message);
            },
            debug: (message, data) => {
                if (debugEnabled) {
                    console.log(`[TableFlow] 🔍 DEBUG: ${message}`, data ?? '');
                }
            },
            success: (message, data) => {
                if (infoEnabled) { // Log succès si verbosité > 0
                    console.log(`[TableFlow] ✅ SUCCÈS: ${message}`, data ?? '');
                }
                this.notify('success', message);
            }
        };
        return logger;
    }

    /**
     * Appelle instanceManager pour créer et initialiser l'instance de table.
     * Stocke la référence à l'instance une fois initialisée.
     * @returns {Promise<TableInstance>} La promesse résolue avec l'instance initialisée.
     * @private
     * @throws {Error} Si l'initialisation échoue.
     */
    async _initializeInstance() {
        try {
            // Passer le logger configuré à instanceManager
            instanceManager.setLogger(this.logger);
            // Créer (ou obtenir) et initialiser l'instance via le manager
            // Passe toutes les options pour que TableInstance puisse les utiliser
            const instance = await instanceManager.createInstance(this.tableId, this.options);
            this.tableInstance = instance; // Stocker la référence
            this.logger.success(`[TableFlow] Instance pour #${this.tableId} prête.`);
            return instance;
        } catch (error) {
            // L'erreur est déjà logguée par instanceManager ou TableInstance
            // On la propage pour que l'appelant de new TableFlow() soit informé
            throw error;
        }
    }

    /**
     * Retourne une promesse qui résout lorsque l'instance TableFlow est initialisée.
     * Utile pour s'assurer que l'instance et ses plugins sont prêts avant d'interagir.
     * @returns {Promise<TableFlow>} La promesse résout avec l'instance TableFlow elle-même.
     */
    ready() {
        // Retourne la promesse stockée, mais résout avec 'this' (l'instance TableFlow)
        return this._initializationPromise.then(() => this);
    }

    // --- Méthodes API Déléguées à TableInstance ---
    // Ces méthodes vérifient que l'initialisation est terminée avant de déléguer.

    /**
     * Vérifie si l'instance est initialisée et log une erreur si ce n'est pas le cas.
     * @returns {boolean} True si l'instance est prête, false sinon.
     * @private
     */
    _checkReady() {
        if (!this.tableInstance) {
            this.logger.error(`[TableFlow #${this.tableId}] Tentative d'appel API avant la fin de l'initialisation ou après un échec.`);
            return false;
        }
        return true;
    }

    /**
     * Récupère l'instance d'un plugin actif pour cette table.
     * @param {string} name - Le nom du plugin (insensible à la casse).
     * @returns {object | null} L'instance du plugin ou null si non trouvé ou non initialisé.
     */
    getPlugin(name) {
        if (!this._checkReady()) return null;
        // La méthode getPlugin de TableInstance gère déjà le cas où le plugin n'est pas trouvé
        return this.tableInstance.getPlugin(name);
    }

    /**
     * Appelle la méthode `refresh()` sur tous les plugins actifs de l'instance.
     * @returns {Promise<void>}
     */
    async refreshPlugins() {
        if (!this._checkReady()) return;
        // Utilise le pluginManager de l'instance associée
        await this.tableInstance.pluginManager.refreshAll();
    }

    /**
     * Marque une ligne comme sauvegardée (met à jour les valeurs initiales).
     * @param {HTMLTableRowElement} row - L'élément TR de la ligne.
     * @param {object} [options={}] - Options à passer aux plugins et à l'événement row:saved.
     */
    markRowAsSaved(row, options = {}) {
        if (!this._checkReady()) return;
        // Déléguer à la méthode de TableInstance si elle existe
        if (typeof this.tableInstance.markRowAsSaved === 'function') {
             this.tableInstance.markRowAsSaved(row, options);
        } else {
             // Fallback ou implémentation si la méthode n'est pas sur TableInstance
             this.logger.warn(`[TableFlow #${this.tableId}] La méthode markRowAsSaved n'est pas implémentée sur TableInstance.`);
             // Logique de base (peut être déplacée dans TableInstance)
             if (!row) return;
             row.classList.remove(this.options.modifiedClass || 'modified');
             // Mettre à jour les data-initial-value (logique plus complexe nécessaire ici)
             this.logger.debug(`[TableFlow Fallback] Ligne ${row.id} marquée comme sauvegardée (basique).`);
             // Déclencher l'événement
             this.tableInstance.element?.dispatchEvent(new CustomEvent('row:saved', { detail: { row, options, rowId: row.id } }));
        }
    }

    /**
     * Ajoute une nouvelle ligne au tableau.
     * @param {object | Array} [data={}] - Données pour la nouvelle ligne (objet {columnId: value} ou tableau [value1, value2]).
     * @param {'start' | 'end'} [position='end'] - Où ajouter la ligne ('start' ou 'end').
     * @returns {HTMLTableRowElement | null} L'élément TR ajouté ou null en cas d'échec.
     */
    addRow(data = {}, position = 'end') {
        if (!this._checkReady()) return null;
        // Déléguer à TableInstance si la méthode existe
        if (typeof this.tableInstance.addRow === 'function') {
            return this.tableInstance.addRow(data, position);
        } else {
            this.logger.error(`[TableFlow #${this.tableId}] La méthode addRow n'est pas implémentée sur TableInstance.`);
            return null;
        }
    }

    /**
     * Supprime une ligne du tableau.
     * @param {HTMLTableRowElement | string} rowOrId - L'élément TR de la ligne ou son ID.
     * @returns {boolean} True si la suppression a réussi, false sinon.
     */
    removeRow(rowOrId) {
        if (!this._checkReady()) return false;
         // Déléguer à TableInstance si la méthode existe
         if (typeof this.tableInstance.removeRow === 'function') {
            return this.tableInstance.removeRow(rowOrId);
        } else {
            this.logger.error(`[TableFlow #${this.tableId}] La méthode removeRow n'est pas implémentée sur TableInstance.`);
            return false;
        }
    }

    /**
     * Récupère les données d'une ligne spécifique.
     * @param {HTMLTableRowElement | string} rowOrId - L'élément TR de la ligne ou son ID.
     * @returns {object | null} Un objet { columnId: value } ou null si la ligne n'est pas trouvée.
     */
    getRowData(rowOrId) {
        if (!this._checkReady()) return null;
        // Déléguer à TableInstance si la méthode existe
        if (typeof this.tableInstance.getRowData === 'function') {
            return this.tableInstance.getRowData(rowOrId);
        } else {
            this.logger.error(`[TableFlow #${this.tableId}] La méthode getRowData n'est pas implémentée sur TableInstance.`);
            return null;
        }
    }

    /**
     * Récupère toutes les lignes actuellement dans le tbody.
     * @returns {Array<HTMLTableRowElement>} Un tableau des éléments TR.
     */
    getAllRows() {
        if (!this._checkReady()) return [];
         // Déléguer à TableInstance si la méthode existe
         if (typeof this.tableInstance.getAllRows === 'function') {
            return this.tableInstance.getAllRows();
        } else {
             // Fallback
             return Array.from(this.tableInstance.element?.querySelectorAll('tbody tr') ?? []);
        }
    }

     /**
     * Récupère les lignes actuellement visibles (non masquées par CSS ou filtrage).
     * @returns {Array<HTMLTableRowElement>} Un tableau des éléments TR visibles.
     */
    getVisibleRows() {
        if (!this._checkReady()) return [];
        // Déléguer à TableInstance si la méthode existe
        if (typeof this.tableInstance.getVisibleRows === 'function') {
            return this.tableInstance.getVisibleRows();
        } else {
             // Fallback simple (ne prend pas en compte le filtrage complexe)
             return Array.from(this.tableInstance.element?.querySelectorAll('tbody tr') ?? [])
                 .filter(row => row.style.display !== 'none');
        }
    }

    /**
     * Détruit l'instance TableFlow et l'instance de table associée.
     * @returns {Promise<void>}
     */
    async destroy() {
        this.logger.info(`[TableFlow] Destruction demandée pour #${this.tableId}...`);
        // Attendre que l'initialisation soit terminée (ou ait échoué) avant de détruire
        try {
            await this._initializationPromise; // Attend la fin de l'init
        } catch (error) {
            // L'initialisation a échoué, mais on tente quand même de nettoyer via instanceManager
            this.logger.warn(`[TableFlow #${this.tableId}] Destruction après échec d'initialisation.`);
        }

        // Utiliser instanceManager pour détruire l'instance gérée
        if (this.tableId) {
            await instanceManager.destroyInstance(this.tableId);
        }
        this.tableInstance = null; // Effacer la référence
        this.logger.info(`[TableFlow] Instance pour #${this.tableId} détruite.`);
    }

    /**
     * Affiche une notification en utilisant le système configuré.
     * @param {'info' | 'warning' | 'success' | 'error'} type - Le type de notification.
     * @param {string} message - Le message à afficher.
     */
    notify(type, message) {
        try {
            const notificationCallback = this.options.notifications?.[type];
            if (typeof notificationCallback === 'function') {
                notificationCallback(message);
            } else if (!this.options.notifications || Object.keys(this.options.notifications).length === 0) {
                // Pas de log si aucun système de notif n'a été fourni, pour éviter le bruit
            } else {
                // Log si un système de notif est fourni mais manque le type spécifique
                this.logger.warn?.(`[TableFlow] Type de notification non géré: '${type}'`);
            }
        } catch (error) {
            console.error(`[TableFlow] Erreur interne lors de la notification (${type}): ${error.message}`);
        }
    }
}
