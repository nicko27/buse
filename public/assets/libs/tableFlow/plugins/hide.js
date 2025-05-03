/**
 * Plugin Hide pour TableFlow
 * Permet de masquer des colonnes spécifiques au chargement de la table
 * en se basant sur l'attribut `th-hide` sur les en-têtes <th>.
 * Fournit également des méthodes pour masquer/afficher des colonnes par programmation.
 *
 * @class HidePlugin
 */
export default class HidePlugin {
    /**
     * Crée une instance de HidePlugin.
     * @param {object} [config={}] - Configuration du plugin (options futures possibles).
     */
    constructor(config = {}) {
        this.name = 'hide';
        this.version = '1.0.1'; // Version mise à jour
        this.type = 'display'; // Type de plugin: modifie l'affichage
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (aucunes) */
        this.dependencies = [];

        // Configuration par défaut fusionnée avec celle fournie
        this.config = {
            hideAttribute: 'th-hide', // Nom de l'attribut HTML pour masquer
            debug: false,
            ...config
        };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[HidePlugin ${this.table?.tableId}]`, ...args) ?? console.debug('[HidePlugin]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Cache simple pour les colonnes masquées par l'attribut initial
        /** @type {Set<number>} */
        this.initiallyHiddenColumns = new Set();
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('HidePlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Hide...');

        // Appliquer le masquage initial basé sur les attributs HTML
        this.applyInitialHide();

        this.debug('Plugin Hide initialisé.');
    }

    /**
     * Identifie et masque les colonnes ayant l'attribut `th-hide` lors de l'initialisation.
     */
    applyInitialHide() {
        if (!this.table?.element) return;
        this.debug(`Recherche des colonnes à masquer initialement via [${this.config.hideAttribute}]...`);
        this.initiallyHiddenColumns.clear(); // Réinitialiser

        const headerCells = this.table.element.querySelectorAll(`thead th[${this.config.hideAttribute}]`);
        headerCells.forEach(headerCell => {
            const columnIndex = headerCell.cellIndex;
            if (columnIndex !== -1) {
                this.debug(`Masquage initial de la colonne ${columnIndex} (${headerCell.id || 'no-id'})`);
                this.hideColumn(columnIndex);
                this.initiallyHiddenColumns.add(columnIndex); // Garder une trace
            } else {
                 this.logger.warn(`Impossible de trouver l'index pour l'en-tête avec [${this.config.hideAttribute}]:`, headerCell);
            }
        });
        this.debug(`${this.initiallyHiddenColumns.size} colonne(s) masquée(s) initialement.`);
    }

    /**
     * Masque une colonne spécifique (en-tête et cellules de corps/pied).
     * @param {number} columnIndex - Index 0-based de la colonne à masquer.
     */
    hideColumn(columnIndex) {
        if (!this.table?.element || typeof columnIndex !== 'number' || columnIndex < 0) {
            this.logger.warn(`hideColumn appelé avec un index invalide: ${columnIndex}`);
            return;
        }
        this.debug(`Masquage de la colonne index ${columnIndex}...`);

        // Masquer l'en-tête
        const headerCell = this.table.element.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        if (headerCell) {
            headerCell.style.display = 'none';
        } else {
             this.logger.warn(`En-tête non trouvé pour l'index ${columnIndex} lors du masquage.`);
        }

        // Masquer les cellules du corps
        const bodyCells = this.table.element.querySelectorAll(`tbody td:nth-child(${columnIndex + 1})`);
        bodyCells.forEach(cell => cell.style.display = 'none');

        // Masquer les cellules du pied (si tfoot existe)
        const tfootCells = this.table.element.querySelectorAll(`tfoot td:nth-child(${columnIndex + 1})`);
        tfootCells.forEach(cell => cell.style.display = 'none');

        this.debug(`Colonne ${columnIndex} masquée (display: none appliqué).`);
    }

    /**
     * Affiche une colonne spécifique (en-tête et cellules de corps/pied).
     * Retire le style `display: none;`.
     * @param {number} columnIndex - Index 0-based de la colonne à afficher.
     */
    showColumn(columnIndex) {
        if (!this.table?.element || typeof columnIndex !== 'number' || columnIndex < 0) {
             this.logger.warn(`showColumn appelé avec un index invalide: ${columnIndex}`);
            return;
        }
        this.debug(`Affichage de la colonne index ${columnIndex}...`);

        // Afficher l'en-tête
        const headerCell = this.table.element.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        if (headerCell) {
            headerCell.style.display = ''; // Réinitialise au style par défaut (table-cell ou autre)
        } else {
             this.logger.warn(`En-tête non trouvé pour l'index ${columnIndex} lors de l'affichage.`);
        }

        // Afficher les cellules du corps
        const bodyCells = this.table.element.querySelectorAll(`tbody td:nth-child(${columnIndex + 1})`);
        bodyCells.forEach(cell => cell.style.display = '');

        // Afficher les cellules du pied
        const tfootCells = this.table.element.querySelectorAll(`tfoot td:nth-child(${columnIndex + 1})`);
        tfootCells.forEach(cell => cell.style.display = '');

        this.debug(`Colonne ${columnIndex} affichée (display réinitialisé).`);
    }

    /**
     * Rafraîchit l'état du plugin.
     * Ré-applique le masquage basé sur les attributs `th-hide` présents dans le DOM actuel.
     * Utile si la structure de l'en-tête a changé.
     */
    refresh() {
        this.debug('Rafraîchissement du plugin Hide...');
        // Ré-appliquer le masquage initial basé sur les attributs présents
        this.applyInitialHide();
        this.debug('Rafraîchissement Hide terminé.');
    }

    /**
     * Nettoie les ressources utilisées par le plugin.
     * Dans ce cas, il n'y a pas grand chose à nettoyer, mais la méthode est là pour la cohérence.
     * On pourrait optionnellement ré-afficher les colonnes masquées.
     */
    destroy() {
        this.debug('Destruction du plugin Hide...');
        // Optionnel: Ré-afficher les colonnes qui ont été masquées par ce plugin?
        // this.initiallyHiddenColumns.forEach(index => this.showColumn(index));
        // this.initiallyHiddenColumns.clear();

        // Effacer la référence à l'instance
        this.table = null;
        this.debug('Plugin Hide détruit.');
    }
}
