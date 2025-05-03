/**
 * Plugin FilterAndPaginate pour TableFlow
 * Ajoute le filtrage global côté client et la pagination aux tableaux.
 * Permet aux utilisateurs de rechercher dans le contenu de la table et de naviguer
 * à travers les lignes via des pages.
 *
 * @class FilterAndPaginatePlugin
 * @version 1.1.1 - Intégration TableInstance, nettoyage, commentaires
 */
export default class FilterAndPaginatePlugin {
    /**
     * Crée une instance de FilterAndPaginatePlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'filterandpaginate';
        this.version = '1.1.1';
        this.type = 'filter'; // Type de plugin: affecte les lignes affichées
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (ex: ['Sort'] si on veut réagir au tri) */
        this.dependencies = ['Sort']; // Dépend optionnellement de Sort pour rafraîchir après tri

        // Fusion de la configuration par défaut et fournie
        this.config = {...this.getDefaultConfig(), ...config};

        // État interne
        /** @type {number} Page actuelle (1-based) */
        this.currentPage = 1;
        /** @type {number} Nombre total de pages */
        this.totalPages = 1;
        /** @type {HTMLDivElement|null} Conteneur principal pour les contrôles de pagination */
        this.container = null;
        /** @type {string} Valeur actuelle du filtre (en minuscules et trimée) */
        this.filterValue = '';
        /** @type {number|null} ID du timeout pour le debounce du filtre */
        this.filterTimeout = null;
        /** @type {HTMLInputElement|null} Référence à l'élément input utilisé pour le filtre */
        this.filterInput = null;

        // Références aux gestionnaires d'événements liés pour un nettoyage correct
        /** @type {Function|null} */
        this._boundFilterInputHandler = null;
        /** @type {Function|null} */
        this._boundPageSizeChangeHandler = null;
        /** @type {Function|null} */
        this._boundSortHandler = null; // Handler pour l'événement de tri

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[FilterPaginate ${this.table?.tableId}]`, ...args) ?? console.debug('[FilterPaginate]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        this.debug('Plugin FilterAndPaginate créé avec la config:', this.config);
    }

    /**
     * Retourne la configuration par défaut du plugin.
     * @returns {object} Configuration par défaut.
     */
    getDefaultConfig() {
        return {
            enableFilter: true,                     // Activer le filtrage
            globalFilter: null,                     // Sélecteur CSS de l'input de filtre (ex: '#monFiltre')
            debounceTime: 300,                      // Délai (ms) avant d'appliquer le filtre après saisie
            pageSize: 10,                           // Nombre de lignes par page
            pageSizes: [10, 25, 50, 100],           // Options de taille de page disponibles
            containerClass: 'pagination-container', // Classe CSS du conteneur global de pagination
            paginationClass: 'pagination',          // Classe CSS du conteneur des boutons de page
            activeClass: 'active',                  // Classe CSS pour le bouton de page actif
            disabledClass: 'disabled',              // Classe CSS pour les boutons désactivés
            selectClass: 'tf-pagesize-select',      // Classe CSS pour le <select> de taille de page
            btnClass: 'tf-page-button',             // Classe(s) CSS pour les <button> de pagination
            showPageSizes: true,                    // Afficher le sélecteur de taille de page
            showInfo: true,                         // Afficher l'info "Affichage X à Y sur Z"
            labels: {                               // Textes personnalisables pour l'interface
                first: '«', // Premier
                prev: '‹',  // Précédent
                next: '›',  // Suivant
                last: '»',  // Dernier
                info: 'Affichage de {start} à {end} sur {total} entrées', // Texte d'information
                pageSize: 'Entrées par page:' // Label pour le sélecteur
            },
            icons: {                                // Icônes HTML (remplacent les labels si fournis)
                first: null, // Ex: '<i class="fas fa-angle-double-left"></i>'
                prev: null,  // Ex: '<i class="fas fa-chevron-left"></i>'
                next: null,  // Ex: '<i class="fas fa-chevron-right"></i>'
                last: null   // Ex: '<i class="fas fa-angle-double-right"></i>'
            },
            debug: false                            // Activer les logs spécifiques à ce plugin
        };
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('FilterAndPaginatePlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin FilterAndPaginate...');

        // Création et insertion du conteneur de pagination dans le DOM
        this.createContainer();

        // Configuration du filtre si activé
        if (this.config.enableFilter) {
            this.setupFilter();
        }

        // Attacher les écouteurs d'événements système (ex: après tri)
        this.setupEventListeners();

        // Rafraîchissement initial pour afficher la première page et les contrôles
        this.refresh();

        this.debug('Plugin FilterAndPaginate initialisé.');
    }

    /**
     * Configure l'input de filtre global et attache l'écouteur avec debounce.
     */
    setupFilter() {
        if (!this.config.globalFilter) {
            this.debug('Filtrage activé mais aucun sélecteur globalFilter fourni.');
            return;
        }

        this.filterInput = document.querySelector(this.config.globalFilter);
        if (!this.filterInput) {
            this.logger.error(`Input de filtre global non trouvé avec le sélecteur: '${this.config.globalFilter}'`);
            return;
        }

        this.debug('Configuration du filtre sur l\'input:', this.filterInput);

        // Lier le handler pour pouvoir le supprimer dans destroy
        // Utilise une fonction fléchée pour capturer 'this' correctement
        this._boundFilterInputHandler = (event) => {
            this.debug('Événement input détecté sur le filtre:', event.target.value);
            // Annuler le timeout précédent si l'utilisateur tape encore
            if (this.filterTimeout) {
                clearTimeout(this.filterTimeout);
            }
            // Déclencher le filtrage après le délai de debounce
            this.filterTimeout = window.setTimeout(() => { // Utiliser window.setTimeout
                const newFilterValue = event.target.value.toLowerCase().trim();
                // Appliquer seulement si la valeur a changé pour éviter refresh inutile
                if (newFilterValue !== this.filterValue) {
                    this.filterValue = newFilterValue;
                    this.debug('Application du filtre avec la valeur:', this.filterValue);
                    this.currentPage = 1; // Revenir à la première page lors d'un nouveau filtre
                    this.refresh();

                    // Déclencher le callback global onFilter de TableFlow s'il est défini
                    if (typeof this.table.options?.onFilter === 'function') {
                        try {
                            this.table.options.onFilter(this.filterValue);
                        } catch (error) {
                             this.logger.error(`Erreur dans le callback global onFilter: ${error.message}`, error);
                        }
                    }
                } else {
                     this.debug('Valeur de filtre inchangée, refresh ignoré.');
                }
            }, this.config.debounceTime);
        };

        // Attacher l'écouteur
        this.filterInput.addEventListener('input', this._boundFilterInputHandler);
    }

    /**
     * Crée les éléments DOM pour la pagination (conteneur, boutons, info, sélecteur)
     * et les insère après la table.
     */
    createContainer() {
        // Vérifier si le conteneur existe déjà (ex: après un refresh)
        const existingContainer = document.getElementById(`tf-pagination-${this.table?.tableId}`);
        if (existingContainer) {
            this.debug("Conteneur de pagination déjà existant, réutilisation.");
            this.container = existingContainer;
            // Vider le contenu pour le recréer lors de la mise à jour
            this.container.innerHTML = '';
        } else {
            // Créer le conteneur principal avec un ID unique
            this.container = document.createElement('div');
            this.container.id = `tf-pagination-${this.table?.tableId}`; // ID pour ciblage facile
            this.container.className = this.config.containerClass;
            // Insérer le conteneur après la table
            this.table?.element?.parentNode?.insertBefore(this.container, this.table.element.nextSibling);
            this.debug("Conteneur de pagination créé et inséré.", this.container.id);
        }

        // --- Créer les composants internes ---

        // 1. Conteneur pour les boutons de pagination (<nav> pour sémantique)
        const paginationNav = document.createElement('nav');
        paginationNav.setAttribute('aria-label', 'Pagination de la table');
        const paginationControls = document.createElement('div'); // ou ul
        paginationControls.className = this.config.paginationClass;
        paginationNav.appendChild(paginationControls)
        this.container.appendChild(paginationNav);

        // 2. Conteneur pour le sélecteur de taille de page (si activé)
        if (this.config.showPageSizes) {
            const pageSizeContainer = document.createElement('div');
            pageSizeContainer.className = 'page-size-container'; // Classe interne

            if (this.config.labels.pageSize) {
                const label = document.createElement('label');
                // Associer le label au select pour l'accessibilité
                const selectId = `tf-pagesize-select-${this.table?.tableId}`;
                label.htmlFor = selectId;
                label.textContent = this.config.labels.pageSize;
                pageSizeContainer.appendChild(label);
            }

            const select = document.createElement('select');
            select.id = `tf-pagesize-select-${this.table?.tableId}`; // ID unique
            select.className = this.config.selectClass; // Utilise la classe configurée
            select.setAttribute('aria-label', 'Nombre d\'éléments par page');

            // Ajouter les options de taille
            this.config.pageSizes.forEach(size => {
                const option = document.createElement('option');
                option.value = size.toString();
                option.textContent = size.toString();
                if (size === this.config.pageSize) {
                    option.selected = true;
                }
                select.appendChild(option);
            });

            // Lier le handler pour le nettoyage
            this._boundPageSizeChangeHandler = (event) => {
                const newSize = parseInt(event.target.value, 10);
                if (newSize !== this.config.pageSize) {
                    this.debug(`Changement de taille de page: ${this.config.pageSize} -> ${newSize}`);
                    this.config.pageSize = newSize;
                    this.currentPage = 1; // Revenir à la première page
                    this.refresh();
                }
            };
            select.addEventListener('change', this._boundPageSizeChangeHandler);

            pageSizeContainer.appendChild(select);
            this.container.appendChild(pageSizeContainer);
        }

        // 3. Conteneur pour les informations de pagination (si activé)
        if (this.config.showInfo) {
            const infoContainer = document.createElement('div');
            infoContainer.className = 'pagination-info'; // Classe interne
            infoContainer.setAttribute('role', 'status'); // Pour l'accessibilité
            infoContainer.setAttribute('aria-live', 'polite'); // Annonce les changements poliment
            this.container.appendChild(infoContainer);
        }
    }

    /**
     * Crée un bouton de pagination individuel.
     * @param {string} content - Le texte ou HTML du bouton (label ou icône).
     * @param {number} page - Le numéro de page cible (1-based).
     * @param {boolean} [isDisabled=false] - Si le bouton doit être désactivé.
     * @param {boolean} [isActive=false] - Si le bouton représente la page active.
     * @param {string} [ariaLabel=''] - Label ARIA pour l'accessibilité.
     * @returns {HTMLButtonElement} Le bouton créé.
     */
    createPageButton(content, page, isDisabled = false, isActive = false, ariaLabel = '') {
        const button = document.createElement('button');
        button.type = 'button'; // Type correct pour éviter soumission
        button.className = this.config.btnClass; // Appliquer la classe configurée

        // Utiliser le sanitizer si disponible pour insérer le contenu HTML (icônes)
        if (this.table?.sanitizer) {
            this.table.sanitizer.setHTML(button, content, { isTrustedIcon: true });
        } else {
            button.innerHTML = content; // Fallback
        }
        button.disabled = isDisabled;

        // Attributs ARIA pour l'accessibilité
        if (ariaLabel) button.setAttribute('aria-label', ariaLabel);
        if (isDisabled) {
            button.classList.add(this.config.disabledClass);
            button.setAttribute('aria-disabled', 'true');
        }
        if (isActive) {
            button.classList.add(this.config.activeClass);
            button.setAttribute('aria-current', 'page'); // Indique la page actuelle
        }

        // Ajouter l'écouteur de clic seulement si non désactivé
        if (!isDisabled) {
            // Utiliser une fonction fléchée pour conserver le contexte et passer les arguments
            button.addEventListener('click', () => this.goToPage(page));
            // Note: Pas besoin de stocker ce listener car le bouton est recréé à chaque refresh
        }

        return button;
    }

    /**
     * Met à jour les boutons et indicateurs de pagination dans le conteneur.
     */
    updatePagination() {
        // Trouver le conteneur des contrôles (ex: <ul> ou <div>)
        const paginationControls = this.container?.querySelector(`.${this.config.paginationClass}`);
        if (!paginationControls) {
            this.logger.warn("Conteneur des contrôles de pagination non trouvé pour la mise à jour.");
            return;
        }

        paginationControls.innerHTML = ''; // Vider les anciens boutons
        this.debug(`Mise à jour de la pagination: page ${this.currentPage}/${this.totalPages}`);

        // Ne rien afficher si une seule page et showInfo est désactivé? Optionnel.
        if (this.totalPages <= 1 && !this.config.showInfo && !this.config.showPageSizes) {
             this.debug("Pagination masquée (une seule page et pas d'info/sélecteur taille).");
             return;
        }

        // --- Création des boutons ---
        const isFirstPage = this.currentPage === 1;
        const isLastPage = this.currentPage === this.totalPages || this.totalPages === 0;

        // 1. Bouton "Première page"
        const firstContent = this.config.icons.first || this.config.labels.first;
        paginationControls.appendChild(this.createPageButton(firstContent, 1, isFirstPage, false, 'Aller à la première page'));

        // 2. Bouton "Page précédente"
        const prevContent = this.config.icons.prev || this.config.labels.prev;
        paginationControls.appendChild(this.createPageButton(prevContent, this.currentPage - 1, isFirstPage, false, 'Aller à la page précédente'));

        // 3. Boutons des numéros de page (logique améliorée pour affichage intelligent)
        const maxPagesToShow = 5; // Nombre max de boutons de page à afficher
        let startPage, endPage;

        if (this.totalPages <= maxPagesToShow) {
            // Afficher toutes les pages si peu nombreuses
            startPage = 1;
            endPage = this.totalPages;
        } else {
            // Calculer la plage centrée autour de la page actuelle
            const maxPagesBeforeCurrent = Math.floor((maxPagesToShow - 1) / 2);
            const maxPagesAfterCurrent = Math.ceil((maxPagesToShow - 1) / 2);

            if (this.currentPage <= maxPagesBeforeCurrent) {
                // Près du début
                startPage = 1;
                endPage = maxPagesToShow;
            } else if (this.currentPage + maxPagesAfterCurrent >= this.totalPages) {
                // Près de la fin
                startPage = this.totalPages - maxPagesToShow + 1;
                endPage = this.totalPages;
            } else {
                // Au milieu
                startPage = this.currentPage - maxPagesBeforeCurrent;
                endPage = this.currentPage + maxPagesAfterCurrent;
            }
        }

        // Ajouter "..." au début si nécessaire
        if (startPage > 1) {
            // Optionnel: Ajouter le bouton de la page 1 explicitement avant les "..."
            // paginationControls.appendChild(this.createPageButton('1', 1, false, false, 'Aller à la page 1'));
            const ellipsisStart = document.createElement('span');
            ellipsisStart.textContent = '...';
            ellipsisStart.className = 'pagination-ellipsis'; // Classe pour style optionnel
            paginationControls.appendChild(ellipsisStart);
        }

        // Ajouter les boutons de page dans la plage calculée
        for (let i = startPage; i <= endPage; i++) {
            const isActive = (i === this.currentPage);
            paginationControls.appendChild(this.createPageButton(i.toString(), i, false, isActive, `Aller à la page ${i}`));
        }

        // Ajouter "..." à la fin si nécessaire
        if (endPage < this.totalPages) {
            const ellipsisEnd = document.createElement('span');
            ellipsisEnd.textContent = '...';
            ellipsisEnd.className = 'pagination-ellipsis';
            paginationControls.appendChild(ellipsisEnd);
             // Optionnel: Ajouter le bouton de la dernière page explicitement après les "..."
             // paginationControls.appendChild(this.createPageButton(this.totalPages.toString(), this.totalPages, false, false, `Aller à la page ${this.totalPages}`));
        }


        // 4. Bouton "Page suivante"
        const nextContent = this.config.icons.next || this.config.labels.next;
        paginationControls.appendChild(this.createPageButton(nextContent, this.currentPage + 1, isLastPage, false, 'Aller à la page suivante'));

        // 5. Bouton "Dernière page"
        const lastContent = this.config.icons.last || this.config.labels.last;
        paginationControls.appendChild(this.createPageButton(lastContent, this.totalPages, isLastPage, false, 'Aller à la dernière page'));
    }

    /**
     * Met à jour le texte d'information de pagination (ex: "Affichage 1 à 10 sur 57").
     */
    updateInfo() {
        if (!this.config.showInfo) return;

        const infoContainer = this.container?.querySelector('.pagination-info');
        if (!infoContainer) {
            this.logger.warn("Conteneur d'info non trouvé pour la mise à jour.");
            return;
        }

        const filteredRows = this.getFilteredRows(); // Récupère les lignes après filtrage
        const totalEntries = filteredRows.length;

        if (totalEntries === 0) {
            infoContainer.textContent = 'Aucune entrée à afficher';
            return;
        }

        const start = Math.min(totalEntries, (this.currentPage - 1) * this.config.pageSize + 1); // Ne peut pas être > totalEntries
        const end = Math.min(start + this.config.pageSize - 1, totalEntries); // Ne peut pas dépasser totalEntries

        // Remplacer les placeholders dans le label configuré
        const infoText = this.config.labels.info
            .replace('{start}', start.toString())
            .replace('{end}', end.toString())
            .replace('{total}', totalEntries.toString());

        infoContainer.textContent = infoText;
        this.debug("Info de pagination mise à jour:", infoText);
    }

    /**
     * Récupère les lignes du tbody qui correspondent au filtre actuel.
     * @returns {HTMLTableRowElement[]} Tableau des lignes filtrées.
     */
    getFilteredRows() {
        // Utilise la méthode de l'instance TableInstance pour obtenir toutes les lignes
        const allRows = this.table?.getAllRows() ?? [];

        if (!this.filterValue) {
            this.debug(`Filtrage non appliqué, retour de ${allRows.length} ligne(s).`);
            return allRows; // Pas de filtre, retourne toutes les lignes
        }

        this.debug(`Application du filtre '${this.filterValue}' sur ${allRows.length} ligne(s)...`);
        const filterLower = this.filterValue; // Déjà en minuscules

        const filtered = allRows.filter(row => {
            // Vérifier si AU MOINS UNE cellule de la ligne contient le texte du filtre
            // Utiliser les cellules directement peut être plus rapide que querySelectorAll
            for (let i = 0; i < row.cells.length; i++) {
                const cell = row.cells[i];
                const cellValue = this.getCellValue(cell); // Récupère la valeur pertinente pour le filtre
                // Comparaison insensible à la casse
                if (cellValue.toLowerCase().includes(filterLower)) {
                    return true; // Trouvé dans cette ligne, passer à la suivante
                }
            }
            return false; // Non trouvé dans cette ligne
        });
        this.debug(`${filtered.length} ligne(s) correspondent au filtre.`);
        return filtered;
    }

    /**
     * Récupère la valeur textuelle d'une cellule à utiliser pour le filtrage.
     * Priorise l'attribut `data-filter-value`, sinon utilise `textContent`.
     * @param {HTMLTableCellElement} cell - La cellule <td>.
     * @returns {string} La valeur textuelle de la cellule pour le filtrage.
     */
    getCellValue(cell) {
        if (!cell) return '';

        // 1. Vérifier l'attribut data-filter-value
        const filterAttr = cell.getAttribute('data-filter-value');
        if (filterAttr !== null) {
            // this.debug(`Utilisation de data-filter-value pour ${cell.id}: "${filterAttr}"`);
            return filterAttr;
        }

        // 2. Sinon, utiliser textContent (plus fiable que innerText)
        const textContent = cell.textContent ?? ''; // Utilise ?? pour gérer null/undefined
        // this.debug(`Utilisation de textContent pour ${cell.id}: "${textContent.trim()}"`);
        return textContent.trim(); // trim() pour enlever les espaces superflus
    }

    /**
     * Navigue vers une page spécifique.
     * @param {number} page - Le numéro de la page cible (1-based).
     */
    goToPage(page) {
        // Assurer que page est un nombre valide
        const targetPage = Number(page);
        if (isNaN(targetPage)) return;

        // Vérifier si la page demandée est valide
        if (targetPage < 1 || targetPage > this.totalPages || targetPage === this.currentPage || this.totalPages === 0) {
            this.debug(`Navigation vers la page ${targetPage} ignorée (invalide ou actuelle).`);
            return;
        }

        this.debug(`Navigation vers la page ${targetPage}`);
        this.currentPage = targetPage;
        this.refresh(); // Mettre à jour l'affichage

        // Déclencher l'événement de changement de page sur l'élément table
        const event = new CustomEvent('pageChanged', {
            detail: {
                page: this.currentPage,
                pageSize: this.config.pageSize,
                totalPages: this.totalPages,
                tableId: this.table?.tableId
            },
            bubbles: true // Permettre la propagation
        });
        this.table?.element?.dispatchEvent(event);
        this.debug("Événement 'pageChanged' déclenché.", event.detail);
    }

    /**
     * Rafraîchit l'affichage de la pagination et des lignes filtrées.
     * C'est la méthode centrale appelée après un filtre, un tri, un changement de taille, etc.
     */
    refresh() {
        this.debug('Rafraîchissement de FilterAndPaginate...');
        if (!this.table || !this.container) {
             this.logger.error("Impossible de rafraîchir: instance de table ou conteneur manquant.");
             return;
        }

        // 1. Récupérer les lignes filtrées
        const filteredRows = this.getFilteredRows();
        const totalRows = filteredRows.length;

        // 2. Calculer le nombre total de pages
        this.totalPages = Math.max(1, Math.ceil(totalRows / this.config.pageSize)); // Au moins 1 page

        // 3. Ajuster la page courante si elle est devenue invalide
        if (this.currentPage > this.totalPages) {
            this.debug(`Page courante (${this.currentPage}) invalide, ajustement à ${this.totalPages}`);
            this.currentPage = this.totalPages;
        }
        // Assurer que currentPage est au moins 1
        this.currentPage = Math.max(1, this.currentPage);


        // 4. Calculer les indices de début et de fin pour la page actuelle
        const startIndex = (this.currentPage - 1) * this.config.pageSize;
        const endIndex = startIndex + this.config.pageSize; // slice est exclusif à la fin

        // 5. Masquer toutes les lignes du tableau
        const allRows = this.table.getAllRows();
        allRows.forEach(row => row.style.display = 'none');

        // 6. Afficher uniquement les lignes filtrées de la page courante
        const rowsToShow = filteredRows.slice(startIndex, endIndex);
        rowsToShow.forEach(row => row.style.display = ''); // Rétablir l'affichage par défaut

        this.debug(`Affichage des lignes ${startIndex + 1} à ${startIndex + rowsToShow.length} sur ${totalRows} filtrées.`);

        // 7. Mettre à jour les contrôles de pagination (boutons)
        this.updatePagination();

        // 8. Mettre à jour les informations de pagination (texte)
        this.updateInfo();
         this.debug('Rafraîchissement FilterAndPaginate terminé.');
    }

    /**
     * Attache les écouteurs d'événements système (ex: après un tri).
     */
    setupEventListeners() {
        if (!this.table?.element) return;
        this.debug('Configuration des écouteurs d\'événements système pour FilterAndPaginate...');

        // Nettoyer l'ancien listener avant d'ajouter
        if (this._boundSortHandler) {
             this.table.element.removeEventListener('sortAppened', this._boundSortHandler);
        }

        // Écouter l'événement de tri pour rafraîchir la pagination
        this._boundSortHandler = () => {
            this.debug("Événement 'sortAppened' détecté, rafraîchissement de la pagination...");
            // Optionnel: Revenir à la page 1 après un tri? Ou rester sur la page actuelle?
            // this.currentPage = 1;
            this.refresh();
        };
        this.table.element.addEventListener('sortAppened', this._boundSortHandler);
        this.debug("Écouteur 'sortAppened' ajouté.");

        // Ajouter d'autres listeners si nécessaire (ex: row:added/removed sont gérés par refresh global)
    }


    /**
     * Nettoie les ressources utilisées par le plugin (écouteurs, timeouts, éléments DOM).
     */
    destroy() {
        this.debug('Destruction du plugin FilterAndPaginate...');

        // 1. Annuler timeout de filtre
        if (this.filterTimeout) clearTimeout(this.filterTimeout);

        // 2. Supprimer listener de l'input de filtre
        if (this.filterInput && this._boundFilterInputHandler) {
            this.filterInput.removeEventListener('input', this._boundFilterInputHandler);
            this.debug("Écouteur de l'input de filtre retiré.");
        }

        // 3. Supprimer listener du sélecteur de taille
        const selectElement = this.container?.querySelector(`.${this.config.selectClass}`);
        if (selectElement && this._boundPageSizeChangeHandler) {
             selectElement.removeEventListener('change', this._boundPageSizeChangeHandler);
             this.debug("Écouteur du sélecteur de taille retiré.");
        }

        // 4. Supprimer listener de l'événement de tri
        if (this.table?.element && this._boundSortHandler) {
            this.table.element.removeEventListener('sortAppened', this._boundSortHandler);
            this.debug("Écouteur de l'événement de tri retiré.");
        }

        // 5. Supprimer le conteneur de pagination du DOM
        if (this.container) {
            this.container.remove();
            this.debug("Conteneur de pagination retiré du DOM.");
        }

        // 6. Réafficher toutes les lignes (optionnel)
        // this.table?.getAllRows().forEach(row => row.style.display = '');

        // 7. Effacer les références et états internes
        this.table = null;
        this.container = null;
        this.filterInput = null;
        this._boundFilterInputHandler = null;
        this._boundPageSizeChangeHandler = null;
        this._boundSortHandler = null;
        this.filterTimeout = null;

        this.debug('Plugin FilterAndPaginate détruit.');
    }
}
