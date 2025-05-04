/**
 * @typedef {'data' | 'validation' | 'action' | 'order' | 'display'} PluginType
 */

/**
 * @typedef {Object} PluginConfig
 * @property {number} [execOrder] - Ordre d'exécution du plugin (défaut: 50)
 * @property {Object} [options] - Options spécifiques au plugin
 */

/**
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
 * @typedef {Object} Plugin
 * @property {PluginType} type - Type du plugin
 * @property {PluginConfig} config - Configuration du plugin
 * @property {function(TableInstance): Promise<void>} init - Initialisation du plugin
 * @property {function(): void} destroy - Nettoyage du plugin
 */

/**
 * @typedef {Object} CellState
 * @property {*} current - Valeur actuelle
 * @property {*} original - Valeur originale
 * @property {boolean} isModified - État de modification
 */

// Export pour ES modules
export const PLUGIN_TYPES = {
    DATA: 'data',
    VALIDATION: 'validation',
    ACTION: 'action',
    ORDER: 'order',
    DISPLAY: 'display'
};
