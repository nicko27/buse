/**
 * Plugin Sort pour TableFlow
 * Permet de trier les lignes d'un tableau en cliquant sur les en-têtes de colonnes.
 * Gère le tri ascendant, descendant et le retour à l'ordre initial.
 * Affiche des indicateurs visuels de tri dans les en-têtes.
 *
 * @class SortPlugin
 * @version 1.1.2 - Intégration TableInstance, tri amélioré, nettoyage
 */
export default class SortPlugin {
    /**
     * Crée une instance de SortPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'sort';
        this.version = '1.1.2';
        this.type = 'order'; // Type de plugin: modifie l'ordre des lignes
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (aucunes directes, mais peut affecter FilterAndPaginate) */
        this.dependencies = [];

        // Configuration par défaut fusionnée avec celle fournie
        // Utilise une fonction pour obtenir les défauts et éviter la mutation
        this.config = { ...this.getDefaultConfig(), ...config };

        // Fusionner les anciennes options d'icônes dans la nouvelle structure si non définies
        // pour assurer la compatibilité ascendante
        this.config.icons.asc = this.config.icons.asc ?? this.config.iconAsc;
        this.config.icons.desc = this.config.icons.desc ?? this.config.iconDesc;
        this.config.icons.none = this.config.icons.none ?? this.config.iconNone;

        // État interne
        /** @type {Map<HTMLTableCellElement, number>} Map des en-têtes triables et leur index original */
        this.sortableColumns = new Map();
        /** @type {Map<HTMLTableCellElement, Function>} Stocke les handlers de clic pour le nettoyage */
        this.clickHandlers = new Map();
        /** @type {HTMLTableCellElement | null} En-tête actuellement utilisé pour le tri */
        this.currentSortHeader = null;
        /** @type {'asc' | 'desc' | 'none'} Direction actuelle du tri */
        this.currentSortDirection = 'none';


        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[SortPlugin ${this.table?.tableId}]`, ...args) ?? console.debug('[SortPlugin]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;
    }

    /**
     * Retourne la configuration par défaut du plugin.
     * @returns {object} Configuration par défaut.
     */
    getDefaultConfig() {
        return {
            sortableAttribute: 'th-sort', // Attribut HTML sur <th> pour activer le tri
            sortIndicatorClass: 'sort-indicator', // Classe CSS pour le span de l'indicateur
            sortableClass: 'sortable',      // Classe CSS ajoutée aux <th> triables
            icons: {                        // Icônes pour les états de tri (structure préférée)
                asc: '<i class="fas fa-sort-up"></i>',      // Icône tri ascendant (FontAwesome exemple)
                desc: '<i class="fas fa-sort-down"></i>',   // Icône tri descendant
                none: '<i class="fas fa-sort"></i>'         // Icône tri neutre/initial
            },
            // Anciennes options (compatibilité)
            iconAsc: null,
            iconDesc: null,
            iconNone: null,
            ignoreCase: true, // Ignorer la casse pour le tri textuel par défaut
            debug: false
        };
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('SortPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Sort avec la configuration:', this.config);

        // Stocker l'ordre initial des lignes si ce n'est pas déjà fait
        // C'est utile pour la fonction resetSort()
        this.ensureOriginalOrderStored();

        // Identifier et configurer les colonnes triables
        this.setupSortableColumns();

        this.debug('Plugin Sort initialisé.');
    }

     /**
      * Assure que chaque ligne du tbody a un attribut `data-original-index`.
      * Nécessaire pour pouvoir réinitialiser l'ordre de tri.
      */
     ensureOriginalOrderStored() {
         const rows = this.table?.getAllRows() ?? []; // Utilise la méthode de l'instance
         let count = 0;
         rows.forEach((row, index) => {
             if (!row.hasAttribute('data-original-index')) {
                 row.setAttribute('data-original-index', index.toString());
                 count++;
             }
         });
         if (count > 0) {
            this.debug(`${count} lignes nouvellement indexées pour l'ordre original.`);
         } else {
             this.debug("Toutes les lignes avaient déjà un index original.");
         }
     }

    /**
     * Identifie les en-têtes triables et configure les écouteurs et indicateurs.
     */
    setupSortableColumns() {
        if (!this.table?.element) return;
        this.debug("Recherche et configuration des colonnes triables...");
        // Nettoyer la configuration précédente avant de re-scanner (utile pour refresh)
        this.removeSortConfiguration();

        const headers = Array.from(this.table.element.querySelectorAll(`thead th[${this.config.sortableAttribute}]`));
        this.debug(`Trouvé ${headers.length} en-tête(s) avec l'attribut [${this.config.sortableAttribute}]`);

        headers.forEach(header => {
            const columnIndex = header.cellIndex;
            if (columnIndex !== -1) {
                // Utiliser l'élément header comme clé dans la Map
                this.sortableColumns.set(header, columnIndex); // Stocker l'en-tête et son index
                this.setupSortColumn(header, columnIndex); // Configurer l'indicateur et le listener
            } else {
                 this.logger.warn(`Impossible de trouver l'index pour l'en-tête triable:`, header);
            }
        });
        this.debug(`Configuration de ${this.sortableColumns.size} colonnes triables terminée.`);
    }


    /**
     * Configure un en-tête de colonne spécifique pour le tri.
     * Ajoute la classe CSS, l'indicateur visuel et l'écouteur de clic.
     * @param {HTMLTableCellElement} header - L'élément <th>.
     * @param {number} index - L'index 0-based de la colonne.
     */
    setupSortColumn(header, index) {
        // Vérifier si déjà initialisé pour éviter doublons
        if (header.hasAttribute('data-sort-initialized')) {
            this.debug(`Colonne ${index} (${header.id || 'no-id'}) déjà initialisée pour le tri.`);
            return;
        }

        this.debug(`Configuration de la colonne triable ${index} (${header.id || 'no-id'})...`);
        header.classList.add(this.config.sortableClass); // Ajouter classe pour style/curseur

        // Ajouter l'indicateur de tri (span)
        let indicator = header.querySelector(`.${this.config.sortIndicatorClass}`);
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = this.config.sortIndicatorClass;
            indicator.setAttribute('aria-hidden', 'true'); // Cacher aux lecteurs d'écran

            // Utiliser le sanitizer si disponible pour insérer l'icône HTML
            const iconHtml = this.config.icons.none;
            if (this.table?.sanitizer) {
                 this.table.sanitizer.setHTML(indicator, iconHtml, { isTrustedIcon: true });
            } else {
                 indicator.innerHTML = iconHtml; // Fallback
            }

            // Ajouter l'indicateur à l'intérieur du wrapper s'il existe
            const wrapperClass = this.table?.config?.wrapHeaderClass || 'head-wrapper';
            const wrapper = header.querySelector(`.${wrapperClass}`);
            if (wrapper) {
                wrapper.appendChild(indicator); // Ajouter à la fin du wrapper
            } else {
                header.appendChild(indicator); // Ajouter directement au th si pas de wrapper
            }
            this.debug(`Indicateur de tri ajouté à ${header.id || index}.`);
        }

        // Ajouter l'écouteur de clic
        // Créer une nouvelle fonction liée pour chaque en-tête
        const clickHandler = () => this.handleHeaderClick(header, index);
        header.addEventListener('click', clickHandler);
        // Stocker la référence au handler pour pouvoir le supprimer dans destroy
        this.clickHandlers.set(header, clickHandler);

        // Marquer comme initialisé et définir l'état initial
        header.setAttribute('data-sort-initialized', 'true');
        header.setAttribute('data-sort-direction', 'none'); // État initial: non trié
        header.setAttribute('aria-sort', 'none'); // Accessibilité
    }

    /**
     * Gestionnaire de clic sur un en-tête de colonne triable.
     * Détermine la nouvelle direction de tri et lance le tri.
     * @param {HTMLTableCellElement} header - L'élément <th> cliqué.
     * @param {number} columnIndex - L'index de la colonne cliquée.
     */
    handleHeaderClick(header, columnIndex) {
        if (!header || typeof columnIndex !== 'number') {
            this.logger.error('Paramètres invalides pour handleHeaderClick');
            return;
        }
        this.debug(`Clic détecté sur l'en-tête de la colonne ${columnIndex} (${header.id || 'no-id'})`);

        // 1. Déterminer la nouvelle direction de tri
        const currentDirection = header.getAttribute('data-sort-direction') || 'none';
        let newDirection;
        // Cycle: none -> asc -> desc -> none
        if (this.currentSortHeader === header) { // Si on clique sur la même colonne
             switch (currentDirection) {
                 case 'none': newDirection = 'asc'; break;
                 case 'asc': newDirection = 'desc'; break;
                 case 'desc': newDirection = 'none'; break; // Retour à l'ordre initial
                 default: newDirection = 'asc';
             }
        } else { // Si on clique sur une nouvelle colonne
             newDirection = 'asc'; // Commencer par ascendant
        }
        this.debug(`Nouvelle direction de tri: ${newDirection} (précédente: ${currentDirection} sur cette colonne)`);

        // 2. Réinitialiser visuellement les autres en-têtes triables
        this.sortableColumns.forEach((colIndex, th) => {
            if (th !== header) {
                th.setAttribute('data-sort-direction', 'none');
                th.setAttribute('aria-sort', 'none');
                const otherIndicator = th.querySelector(`.${this.config.sortIndicatorClass}`);
                if (otherIndicator) {
                     const iconHtml = this.config.icons.none;
                     if (this.table?.sanitizer) this.table.sanitizer.setHTML(otherIndicator, iconHtml, { isTrustedIcon: true });
                     else otherIndicator.innerHTML = iconHtml;
                }
            }
        });

        // 3. Mettre à jour l'indicateur et l'attribut ARIA de l'en-tête cliqué
        header.setAttribute('data-sort-direction', newDirection);
        let ariaSortValue = 'none';
        if (newDirection === 'asc') ariaSortValue = 'ascending';
        else if (newDirection === 'desc') ariaSortValue = 'descending';
        header.setAttribute('aria-sort', ariaSortValue);

        const indicator = header.querySelector(`.${this.config.sortIndicatorClass}`);
        if (indicator) {
             const iconHtml = this.config.icons[newDirection];
             if (this.table?.sanitizer) this.table.sanitizer.setHTML(indicator, iconHtml, { isTrustedIcon: true });
             else indicator.innerHTML = iconHtml;
        }

        // 4. Mettre à jour l'état interne
        this.currentSortHeader = (newDirection === 'none') ? null : header;
        this.currentSortDirection = newDirection;

        // 5. Appliquer le tri ou réinitialiser
        if (newDirection === 'none') {
            this.resetSort();
        } else {
            this.sortColumn(columnIndex, newDirection);
        }

        // 6. Déclencher l'événement 'sortAppened' pour informer les autres plugins
        this.dispatchSortEvent(header, columnIndex, newDirection);
    }

    /**
     * Normalise une chaîne pour la comparaison (ignore la casse si configuré).
     * @param {*} value - La valeur à normaliser.
     * @returns {string} La chaîne normalisée.
     */
    normalizeString(value) {
        const str = String(value ?? ''); // Convertit en chaîne, gère null/undefined
        return this.config.ignoreCase ? str.toLowerCase() : str;
    }

    /**
     * Trie les lignes du tableau en fonction des valeurs d'une colonne spécifique.
     * Utilise `localeCompare` pour un tri textuel et numérique plus robuste.
     * @param {number} columnIndex - L'index de la colonne à trier.
     * @param {'asc' | 'desc'} direction - La direction du tri.
     */
    sortColumn(columnIndex, direction) {
        this.debug(`Tri de la colonne ${columnIndex} en direction ${direction}...`);
        const tbody = this.table?.element?.querySelector('tbody');
        if (!tbody) {
            this.logger.error("Élément tbody non trouvé, impossible de trier.");
            return;
        }

        const rows = Array.from(tbody.rows);
        // Multiplicateur pour inverser l'ordre si 'desc'
        const multiplier = direction === 'asc' ? 1 : -1;
        // Options pour localeCompare
        const compareOptions = {
            numeric: true, // Tente de trier numériquement si possible
            sensitivity: this.config.ignoreCase ? 'base' : 'variant' // Gestion de la casse
        };

        // Fonction de comparaison
        const compareRows = (rowA, rowB) => {
            const cellA = rowA.cells[columnIndex];
            const cellB = rowB.cells[columnIndex];

            // Gérer les cellules manquantes
            if (!cellA && !cellB) return 0;
            if (!cellA) return -1 * multiplier;
            if (!cellB) return 1 * multiplier;

            // Obtenir les valeurs à comparer (priorité: data-sort-value > data-value > textContent)
            let valueA = cellA.getAttribute('data-sort-value') ?? cellA.getAttribute('data-value') ?? cellA.textContent ?? '';
            let valueB = cellB.getAttribute('data-sort-value') ?? cellB.getAttribute('data-value') ?? cellB.textContent ?? '';

            // Convertir en chaîne pour localeCompare
            const strA = String(valueA).trim();
            const strB = String(valueB).trim();

            // Comparer en utilisant localeCompare avec options
            // Le troisième argument 'undefined' utilise la locale par défaut du navigateur
            return strA.localeCompare(strB, undefined, compareOptions) * multiplier;
        };

        // Trier le tableau des lignes
        // Utiliser sort directement sur le tableau d'éléments DOM
        rows.sort(compareRows);

        // Réorganiser les lignes dans le tbody via un fragment pour la performance
        const fragment = document.createDocumentFragment();
        rows.forEach(row => fragment.appendChild(row)); // Déplace les lignes existantes
        tbody.appendChild(fragment); // Réinsère les lignes triées

        this.debug(`Tri terminé pour la colonne ${columnIndex}.`);
    }

    /**
     * Réinitialise l'ordre des lignes à leur ordre DOM original (basé sur data-original-index).
     */
    resetSort() {
        this.debug("Réinitialisation de l'ordre des lignes...");
        const tbody = this.table?.element?.querySelector('tbody');
        if (!tbody) {
            this.logger.error("Élément tbody non trouvé, impossible de réinitialiser le tri.");
            return;
        }

        const rows = Array.from(tbody.rows);

        // Trier en utilisant l'attribut data-original-index
        rows.sort((a, b) => {
            const indexA = parseInt(a.getAttribute('data-original-index') || '0', 10);
            const indexB = parseInt(b.getAttribute('data-original-index') || '0', 10);
            return indexA - indexB;
        });

        // Réorganiser les lignes dans le tbody
        const fragment = document.createDocumentFragment();
        rows.forEach(row => fragment.appendChild(row));
        tbody.appendChild(fragment);

        // Réinitialiser visuellement tous les indicateurs de tri des en-têtes
        this.sortableColumns.forEach((colIndex, header) => {
            header.setAttribute('data-sort-direction', 'none');
            header.setAttribute('aria-sort', 'none');
            const indicator = header.querySelector(`.${this.config.sortIndicatorClass}`);
            if (indicator) {
                 const iconHtml = this.config.icons.none;
                 if (this.table?.sanitizer) this.table.sanitizer.setHTML(indicator, iconHtml, { isTrustedIcon: true });
                 else indicator.innerHTML = iconHtml;
            }
        });

        // Réinitialiser l'état interne
        this.currentSortHeader = null;
        this.currentSortDirection = 'none';

        this.debug("Ordre des lignes réinitialisé à l'original.");
    }

    /**
     * Déclenche l'événement 'sortAppened' sur l'élément table.
     * @param {HTMLTableCellElement} header - L'en-tête trié.
     * @param {number} columnIndex - L'index de la colonne.
     * @param {'asc'|'desc'|'none'} direction - La direction du tri.
     * @private
     */
    dispatchSortEvent(header, columnIndex, direction) {
        const event = new CustomEvent('sortAppened', {
            detail: {
                columnId: header.id || null,
                columnIndex: columnIndex,
                direction: direction,
                tableId: this.table?.tableId
            },
            bubbles: true // Permettre la propagation
        });
        this.table?.element?.dispatchEvent(event);
        this.debug("Événement 'sortAppened' déclenché.", event.detail);
    }


    /**
     * Rafraîchit l'état du plugin. Utile si les en-têtes ou les attributs `th-sort` ont changé.
     */
    refresh() {
        this.debug('Rafraîchissement du plugin Sort...');
        // Re-scanner et configurer les colonnes triables
        this.setupSortableColumns();
        // Appliquer l'état de tri actuel (visuel) s'il y en avait un
        if (this.currentSortHeader && this.currentSortDirection !== 'none') {
             // Retrouver l'en-tête dans la nouvelle liste (au cas où l'élément aurait été recréé)
             const headerToUpdate = Array.from(this.sortableColumns.keys()).find(h => h.isSameNode(this.currentSortHeader));
             if (headerToUpdate) {
                 headerToUpdate.setAttribute('data-sort-direction', this.currentSortDirection);
                 let ariaSortValue = 'none';
                 if (this.currentSortDirection === 'asc') ariaSortValue = 'ascending';
                 else if (this.currentSortDirection === 'desc') ariaSortValue = 'descending';
                 headerToUpdate.setAttribute('aria-sort', ariaSortValue);

                 const indicator = headerToUpdate.querySelector(`.${this.config.sortIndicatorClass}`);
                 if (indicator) {
                      const iconHtml = this.config.icons[this.currentSortDirection];
                      if (this.table?.sanitizer) this.table.sanitizer.setHTML(indicator, iconHtml, { isTrustedIcon: true });
                      else indicator.innerHTML = iconHtml;
                 }
                 this.currentSortHeader = headerToUpdate; // Mettre à jour la référence
             } else {
                  // L'ancien header trié n'existe plus, réinitialiser l'état
                  this.currentSortHeader = null;
                  this.currentSortDirection = 'none';
             }
        }
        this.debug('Rafraîchissement Sort terminé.');
    }

    /**
     * Supprime les indicateurs et écouteurs ajoutés par le plugin.
     * @private
     */
    removeSortConfiguration() {
        this.debug("Suppression de la configuration de tri existante (indicateurs, listeners)...");
        this.sortableColumns.forEach((columnIndex, header) => {
            // Supprimer l'écouteur de clic
            const handler = this.clickHandlers.get(header);
            if (handler) {
                header.removeEventListener('click', handler);
            } // La map clickHandlers est vidée dans destroy

            // Supprimer l'indicateur visuel
            const indicator = header.querySelector(`.${this.config.sortIndicatorClass}`);
            if (indicator) {
                indicator.remove();
            }

            // Retirer les attributs et classes ajoutés par le plugin
            header.removeAttribute('data-sort-initialized');
            header.removeAttribute('data-sort-direction');
            header.removeAttribute('aria-sort');
            header.classList.remove(this.config.sortableClass);
        });
        // Vider la map des colonnes triables car elles seront redétectées
        this.sortableColumns.clear();
    }


    /**
     * Nettoie les ressources utilisées par le plugin (écouteurs d'événements, éléments ajoutés).
     */
    destroy() {
        this.debug('Destruction du plugin Sort...');
        // Supprimer les indicateurs et écouteurs
        this.removeSortConfiguration();

        // Vider les maps internes
        this.clickHandlers.clear();
        // sortableColumns est déjà vidé par removeSortConfiguration

        // Effacer la référence à l'instance
        this.table = null;
        this.debug('Plugin Sort détruit.');
    }
}
