/**
 * Enum des types de plugins disponibles
 * @readonly
 * @enum {string}
 */
export const PluginType = {
    DATA: 'data',
    VALIDATION: 'validation',
    ACTION: 'action',
    ORDER: 'order',
    DISPLAY: 'display',
    STYLE: 'style'
};

/**
 * Configuration d'un plugin
 * @typedef {Object} PluginConfig
 * @property {number} [execOrder=50] - Ordre d'exécution du plugin (défaut: 50)
 * @property {Object} [options] - Options spécifiques au plugin
 * @property {boolean} [enabled=true] - Indique si le plugin est activé
 * @property {string} [name] - Nom unique du plugin
 * @property {string} [version] - Version du plugin
 * @property {string[]} [dependencies] - Liste des plugins requis
 */

/**
 * Configuration d'un tableau
 * @typedef {Object} TableConfig
 * @property {string} tableId - ID du tableau HTML
 * @property {number} [verbosity=0] - Niveau de verbosité (0: erreurs, 1: erreurs+succès, 2: tout)
 * @property {boolean} [wrapCellsEnabled=true] - Active le wrapping des cellules
 * @property {boolean} [wrapHeadersEnabled=true] - Active le wrapping des en-têtes
 * @property {string} [cellWrapperClass='cell-wrapper'] - Classe CSS pour les cellules wrappées
 * @property {string} [headerWrapperClass='head-wrapper'] - Classe CSS pour les en-têtes wrappés
 * @property {string} [modifiedCellClass='cell-modified'] - Classe CSS pour les cellules modifiées
 * @property {Object} [notifications] - Configuration des notifications
 * @property {string} [pluginsPath='/buse/public/assets/libs/nvTblHandler/plugins'] - Chemin vers les plugins
 * @property {Object} [cache] - Configuration du cache
 * @property {Object} [validation] - Configuration de la validation
 * @property {Object} [metrics] - Configuration des métriques
 * @property {boolean} [debug=false] - Active le mode debug
 */

/**
 * Interface d'un plugin
 * @typedef {Object} Plugin
 * @property {PluginType} type - Type du plugin
 * @property {PluginConfig} config - Configuration du plugin
 * @property {function(TableInstance): Promise<void>} init - Initialisation du plugin
 * @property {function(): void} destroy - Nettoyage du plugin
 * @property {function(): Promise<void>} [refresh] - Rafraîchissement du plugin
 * @property {function(): boolean} [isValid] - Validation du plugin
 * @property {function(Object): Promise<void>} [handleEvent] - Gestionnaire d'événements
 */

/**
 * État d'une cellule
 * @typedef {Object} CellState
 * @property {*} current - Valeur actuelle de la cellule
 * @property {*} original - Valeur originale de la cellule
 * @property {boolean} isModified - Indique si la cellule a été modifiée
 * @property {Date} lastModified - Date de dernière modification
 * @property {string} [validationError] - Message d'erreur de validation si applicable
 * @property {Object} [metadata] - Métadonnées supplémentaires
 */

/**
 * Événement de cellule
 * @typedef {Object} CellEvent
 * @property {HTMLElement} cell - Élément HTML de la cellule
 * @property {string} rowId - ID de la ligne
 * @property {string} cellId - ID de la cellule
 * @property {*} value - Valeur de la cellule
 * @property {Event} [originalEvent] - Événement DOM original
 */

/**
 * Valide qu'un type de plugin est valide
 * @param {string} type - Type de plugin à valider
 * @returns {boolean} True si le type est valide
 */
export function isValidPluginType(type) {
    return Object.values(PluginType).includes(type);
}

/**
 * Valide une configuration de plugin
 * @param {PluginConfig} config - Configuration à valider
 * @returns {boolean} True si la configuration est valide
 */
export function isValidPluginConfig(config) {
    if (!config) return false;
    if (config.execOrder !== undefined && typeof config.execOrder !== 'number') return false;
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') return false;
    if (config.name && typeof config.name !== 'string') return false;
    if (config.version && typeof config.version !== 'string') return false;
    if (config.dependencies && !Array.isArray(config.dependencies)) return false;
    return true;
}

/**
 * Valide une configuration de tableau
 * @param {TableConfig} config - Configuration à valider
 * @returns {boolean} True si la configuration est valide
 */
export function isValidTableConfig(config) {
    if (!config) return false;
    if (!config.tableId || typeof config.tableId !== 'string') return false;
    if (config.verbosity !== undefined && typeof config.verbosity !== 'number') return false;
    if (config.wrapCellsEnabled !== undefined && typeof config.wrapCellsEnabled !== 'boolean') return false;
    if (config.wrapHeadersEnabled !== undefined && typeof config.wrapHeadersEnabled !== 'boolean') return false;
    return true;
}
