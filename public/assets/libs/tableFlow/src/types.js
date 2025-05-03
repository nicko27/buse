// src/types.js

/**
 * Définit les types de base utilisés par TableFlow et ses plugins.
 * Utilise la syntaxe JSDoc pour la documentation et l'autocomplétion.
 */

// -----------------------------------------------------------------------------
// Types Énumérés
// -----------------------------------------------------------------------------

/**
 * Types possibles pour un plugin, indiquant sa fonction principale.
 * - `data`: Manipulation/transformation de données.
 * - `validation`: Validation des données avant sauvegarde.
 * - `action`: Ajout d'actions utilisateur (boutons, menu contextuel).
 * - `order`: Tri ou réorganisation (lignes, colonnes).
 * - `display`: Modification de l'affichage (style, surlignage).
 * - `edit`: Gestion de l'édition de cellules (input, selecteur, etc.).
 * - `filter`: Filtrage ou pagination des lignes.
 * - `interaction`: Gestion des interactions utilisateur (sélection, drag...).
 * - `ui`: Fourniture d'éléments d'interface (menu, modale...).
 * - `extension`: Étend les fonctionnalités d'un autre plugin.
 * @typedef {'data' | 'validation' | 'action' | 'order' | 'display' | 'edit' | 'filter' | 'interaction' | 'ui' | 'extension'} PluginType
 */
export const PLUGIN_TYPES = {
    DATA: 'data',
    VALIDATION: 'validation',
    ACTION: 'action',
    ORDER: 'order',
    DISPLAY: 'display',
    EDIT: 'edit',           // Ajouté pour Edit, Choice, Color
    FILTER: 'filter',         // Ajouté pour FilterAndPaginate
    INTERACTION: 'interaction', // Ajouté pour ColumnReorder, Selection
    UI: 'ui',             // Ajouté pour ContextMenu
    EXTENSION: 'extension'    // Ajouté pour TextEditor (étend Edit/ContextMenu)
};

// -----------------------------------------------------------------------------
// Configurations
// -----------------------------------------------------------------------------

/**
 * Configuration générale passée au constructeur de `TableFlow`.
 * @typedef {object} TableFlowConfig
 * @property {string} tableId - ID requis de l'élément <table> HTML.
 * @property {PluginSettings} [plugins={names:[]}] - Configuration des plugins à activer.
 * @property {string} [pluginsPath='../plugins'] - Chemin vers le dossier des fichiers JS des plugins.
 * @property {boolean} [debug=false] - Active les logs de débogage globaux.
 * @property {number} [verbosity=0] - Niveau de verbosité (0: erreurs, 1: +succès, 2: +debug).
 * @property {NotificationSettings} [notifications] - Fonctions pour afficher les notifications.
 * @property {boolean} [wrapCellsEnabled=true] - Activer l'enveloppement des cellules <td>.
 * @property {boolean} [wrapHeadersEnabled=true] - Activer l'enveloppement des en-têtes <th>.
 * @property {string} [wrapCellClass='cell-wrapper'] - Classe CSS pour le wrapper de cellule.
 * @property {string} [wrapHeaderClass='head-wrapper'] - Classe CSS pour le wrapper d'en-tête.
 * @property {object} [logger] - Instance de logger personnalisée (remplace console).
 * // Ajouter d'autres options globales spécifiques à TableFlow si nécessaire
 */

/**
 * Configuration des plugins à l'intérieur de `TableFlowConfig`.
 * @typedef {object} PluginSettings
 * @property {string[]} names - Tableau des noms des plugins à activer (ex: ['Sort', 'Edit']).
 * @property {object.<string, object>} [pluginName] - Configurations spécifiques pour chaque plugin,
 * où `pluginName` est le nom du plugin en minuscules (ex: `sort: { ignoreCase: true }`).
 */

/**
 * Configuration spécifique passée au constructeur d'un plugin.
 * Fusionne la configuration par défaut du plugin, la configuration globale
 * et la configuration spécifique de l'instance.
 * @typedef {object} PluginConfig
 * @property {boolean} [debug] - Active le mode debug pour ce plugin (hérite de TableFlowConfig).
 * @property {number} [execOrder=50] - Ordre d'exécution (non utilisé activement dans la structure actuelle).
 * // Les autres propriétés dépendent du plugin spécifique.
 */

/**
 * Fonctions de callback pour les notifications.
 * @typedef {object} NotificationSettings
 * @property {function(string): void} [info] - Fonction pour afficher un message d'information.
 * @property {function(string): void} [warning] - Fonction pour afficher un avertissement.
 * @property {function(string): void} [success] - Fonction pour afficher un message de succès.
 * @property {function(string): void} [error] - Fonction pour afficher un message d'erreur.
 */

// -----------------------------------------------------------------------------
// Interfaces Plugin & Instance
// -----------------------------------------------------------------------------

/**
 * Interface de base pour la définition d'un plugin (souvent une classe).
 * @typedef {object} PluginDefinition
 * @property {string} name - Nom officiel du plugin (utilisé pour l'enregistrement).
 * @property {string} version - Version du plugin (ex: '1.0.0').
 * @property {PluginType} type - Catégorie fonctionnelle du plugin.
 * @property {string[]} [dependencies=[]] - Tableau des noms d'autres plugins requis.
 * // Le constructeur (si c'est une classe) devrait accepter PluginConfig.
 * // Les méthodes suivantes sont attendues sur l'instance créée:
 * @property {function(TableInstance): Promise<void> | void} init - Méthode d'initialisation, reçoit l'instance de table.
 * @property {function(): Promise<void> | void} destroy - Méthode de nettoyage (suppression écouteurs, etc.).
 * @property {function(): Promise<void> | void} [refresh] - Méthode optionnelle pour rafraîchir l'état du plugin.
 */

/**
 * Représente une instance de table gérée par `instanceManager`.
 * Contient la référence à l'élément DOM, la configuration spécifique,
 * et le gestionnaire de plugins pour cette instance.
 * (Type défini ici pour référence, classe implémentée dans instanceManager.js)
 * @typedef {object} TableInstance
 * @property {string} tableId - ID de la table HTML.
 * @property {HTMLElement} element - Référence à l'élément <table>.
 * @property {TableFlowConfig} config - Configuration fusionnée pour cette instance.
 * @property {InstancePluginManager} pluginManager - Gestionnaire des plugins pour cette instance.
 * @property {Map<string, object>} plugins - Map des instances de plugins actifs (gérée par pluginManager).
 * @property {Map<string, CellState>} cellStates - Map pour stocker l'état des cellules (si nécessaire).
 * @property {object} logger - Instance du logger.
 * @property {function(): Promise<void>} init - Initialise l'instance (setupTable, initPlugins).
 * @property {function(): void} setupTable - Configure la table (wrappers).
 * @property {function(): Promise<void>} initPlugins - Initialise les plugins via pluginManager.
 * @property {function(string): object | null} getPlugin - Récupère un plugin actif.
 * @property {function(): Promise<void>} destroy - Détruit l'instance et ses plugins.
 * @property {function(): void} wrapCells - Enveloppe les cellules <td>.
 * @property {function(): void} wrapHeaders - Enveloppe les en-têtes <th>.
 * // Ajouter ici les définitions des méthodes de l'API Core si elles sont implémentées sur TableInstance
 * @property {function(HTMLTableRowElement | string): object | null} [getRowData] - Récupère les données d'une ligne.
 * @property {function(HTMLTableRowElement, object): void} [markRowAsSaved] - Marque une ligne comme sauvegardée.
 * @property {function(object|Array, string): HTMLTableRowElement | null} [addRow] - Ajoute une ligne.
 * @property {function(HTMLTableRowElement | string): boolean} [removeRow] - Supprime une ligne.
 * @property {function(): Array<HTMLTableRowElement>} [getAllRows] - Récupère toutes les lignes du tbody.
 * @property {function(): Array<HTMLTableRowElement>} [getVisibleRows] - Récupère les lignes visibles du tbody.
 */

/**
 * Contexte passé aux handlers de certains plugins (ex: Actions).
 * @typedef {object} PluginContext
 * @property {HTMLTableRowElement} row - L'élément <tr> concerné.
 * @property {HTMLTableCellElement} cell - L'élément <td> spécifique (peut être la cellule d'action elle-même).
 * @property {TableInstance} tableHandler - L'instance de TableInstance gérant le tableau.
 * @property {object} data - Données de la ligne collectées (objet { columnId: value }).
 * @property {string} [source] - Origine du déclenchement (ex: 'manual', 'autoSave').
 */

// -----------------------------------------------------------------------------
// État Interne (Exemple)
// -----------------------------------------------------------------------------

/**
 * Représente l'état d'une cellule individuelle (si un suivi détaillé est nécessaire).
 * @typedef {object} CellState
 * @property {any} currentValue - Valeur actuelle de la cellule.
 * @property {any} originalValue - Valeur originale (au chargement ou dernière sauvegarde).
 * @property {boolean} isModified - Indique si la cellule a été modifiée.
 * @property {boolean} [isValid=true] - État de validation de la cellule.
 * @property {string|null} [errorMessage=null] - Message d'erreur de validation.
 */
