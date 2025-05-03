/**
 * Plugin Choice pour TableFlow
 * Permet de gérer des sélections de valeurs dans les cellules avec deux modes :
 * - toggle : basculement direct entre les options par clic.
 * - searchable : recherche et sélection dans une liste déroulante.
 *
 * @class ChoicePlugin
 * @version 2.0.3 - Intégration TableInstance, sanitizer, nettoyage destroy
 */
export default class ChoicePlugin {
    /**
     * Crée une instance de ChoicePlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'choice';
        this.version = '2.0.3';
        this.type = 'edit'; // Ce plugin modifie la valeur des cellules
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (ex: ['Edit'] si on interagit fortement) */
        this.dependencies = []; // Pas de dépendance forte identifiée pour le moment
        /** @type {HTMLElement|null} Référence au dropdown 'searchable' actuellement ouvert */
        this.activeDropdown = null;

        // Configuration par défaut pour le mode searchable
        this.defaultSearchableConfig = {
            minWidth: '200px',
            dropdownClass: 'tf-choice-dropdown', // Préfixé pour éviter conflits
            optionClass: 'tf-choice-option',
            searchClass: 'tf-choice-search',
            placeholder: 'Rechercher...',
            noResultsText: 'Aucun résultat'
        };

        // Fusion de la configuration par défaut du plugin et celle fournie
        this.config = {
            choiceAttribute: 'th-choice',
            cellClass: 'choice-cell',
            readOnlyClass: 'readonly', // Classe pour cellules non modifiables (peut être surchargée par readOnlyValues)
            modifiedClass: 'modified',
            debug: false,
            columns: {}, // Configuration spécifique par colonne { columnId: { type, values, readOnlyValues, searchable } }
            ...config
        };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[ChoicePlugin ${this.table?.tableId}]`, ...args) ?? console.debug('[ChoicePlugin]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Ajouter les styles CSS nécessaires pour le dropdown searchable une seule fois
        // Note: Idéalement, ces styles devraient être dans un fichier CSS séparé.
        this._injectSearchableStylesOnce();

        // Lier les méthodes pour préserver le contexte 'this'
        this.handleClick = this.handleClick.bind(this);
        this.handleToggleClick = this.handleToggleClick.bind(this);
        this.handleSearchableClick = this.handleSearchableClick.bind(this);
        this._closeDropdownOnClickOutside = this._closeDropdownOnClickOutside.bind(this);
        this._handleCellSaved = this._handleCellSaved.bind(this);
        this._handleRowSaved = this._handleRowSaved.bind(this);
        this._handleRowAdded = this._handleRowAdded.bind(this);
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('ChoicePlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Choice avec la configuration:', this.config);

        this.setupChoiceCells(); // Configurer les cellules existantes
        this.setupEventListeners(); // Attacher les écouteurs

        this.debug('Plugin Choice initialisé.');
    }

    /**
     * Récupère et normalise la configuration pour une colonne spécifique.
     * Gère la conversion de l'ancienne syntaxe (tableau simple) et la fusion
     * avec les options par défaut du mode searchable.
     * @param {string} columnId - L'ID de la colonne (<th>).
     * @returns {object|null} La configuration normalisée de la colonne ou null si non trouvée/invalide.
     */
    getColumnConfig(columnId) {
        const columnConfigRaw = this.config.columns[columnId];
        if (!columnConfigRaw) {
            this.debug(`Aucune configuration JS trouvée pour la colonne '${columnId}'.`);
            return null;
        }

        let normalizedConfig = {};

        // Gérer l'ancienne syntaxe (tableau simple = mode toggle)
        if (Array.isArray(columnConfigRaw)) {
            this.debug(`Conversion de l'ancienne syntaxe (tableau) pour la colonne '${columnId}'.`);
            normalizedConfig = {
                type: 'toggle',
                values: columnConfigRaw,
                readOnlyValues: [],
                searchable: { ...this.defaultSearchableConfig }
            };
        } else if (typeof columnConfigRaw === 'object' && columnConfigRaw !== null) {
            normalizedConfig = {
                type: columnConfigRaw.type || 'toggle', // 'toggle' par défaut
                values: columnConfigRaw.values || [],
                readOnlyValues: columnConfigRaw.readOnlyValues || [],
                // Fusionner la config searchable fournie avec les défauts
                searchable: {
                    ...this.defaultSearchableConfig,
                    ...(columnConfigRaw.searchable || {})
                }
            };
        } else {
            this.logger.error(`Configuration invalide pour la colonne '${columnId}'. Attendu un objet ou un tableau.`);
            return null;
        }

        // Normaliser les 'values' pour avoir toujours la structure { value, label, class? }
        normalizedConfig.values = normalizedConfig.values.map(choice => {
            if (typeof choice === 'object' && choice !== null && choice.value !== undefined) {
                // Assurer que 'label' existe, utilise 'value' si manquant
                return { ...choice, label: choice.label ?? String(choice.value) };
            } else {
                // Si c'est une chaîne ou un nombre, le convertir en objet
                const val = String(choice); // Assurer que c'est une chaîne
                return { value: val, label: val };
            }
        });

        // Normaliser les 'readOnlyValues' pour avoir la structure { value, class? }
        normalizedConfig.readOnlyValues = normalizedConfig.readOnlyValues.map(roValue => {
             if (typeof roValue === 'object' && roValue !== null && roValue.value !== undefined) {
                 // Assurer que value est une chaîne pour la comparaison future
                 return { value: String(roValue.value), class: roValue.class };
             } else {
                 // Si c'est une chaîne ou un nombre, le convertir
                 return { value: String(roValue) };
             }
         });


        // Logique de dépréciation/migration pour 'readOnly: true' dans 'values'
        const readOnlyFromValues = [];
        normalizedConfig.values = normalizedConfig.values.filter(choice => {
            if (choice.readOnly === true) {
                this.logger.warn(`[ChoicePlugin ${this.table?.tableId}] La propriété 'readOnly: true' dans 'values' pour la colonne '${columnId}' est obsolète. Utilisez 'readOnlyValues'. Valeur: ${choice.value}`);
                readOnlyFromValues.push({
                    value: choice.value,
                    // Utilise la classe fournie ou la classe par défaut du plugin
                    class: choice.readOnlyClass || choice.class || this.config.readOnlyClass
                });
                return false; // Exclure de la liste des valeurs sélectionnables
            }
            return true;
        });
        // Ajouter les valeurs readOnly extraites à readOnlyValues
        if (readOnlyFromValues.length > 0) {
            normalizedConfig.readOnlyValues = [
                ...normalizedConfig.readOnlyValues,
                ...readOnlyFromValues
            ];
            // Éliminer les doublons potentiels dans readOnlyValues basés sur 'value'
            const uniqueROValues = new Map();
            normalizedConfig.readOnlyValues.forEach(item => uniqueROValues.set(item.value, item));
            normalizedConfig.readOnlyValues = Array.from(uniqueROValues.values());
        }


        this.debug(`Configuration normalisée pour la colonne '${columnId}':`, normalizedConfig);
        return normalizedConfig;
    }

    /**
     * Injecte les styles CSS nécessaires pour le dropdown searchable, une seule fois par page.
     * Note: Il est préférable de mettre ces styles dans un fichier CSS séparé.
     * @private
     */
    _injectSearchableStylesOnce() {
        const styleId = 'tableflow-choice-plugin-styles';
        if (document.getElementById(styleId)) return;

        this.debug("Injection des styles CSS pour ChoicePlugin (dropdown searchable)...");
        const style = document.createElement('style');
        style.id = styleId;
        // Styles utilisant les variables CSS globales et les classes par défaut/configurables
        style.textContent = `
            /* Styles pour ChoicePlugin - Idéalement dans tableFlow.css */
            .${this.config.cellClass} { cursor: pointer; position: relative; }
            .${this.defaultSearchableConfig.dropdownClass} {
                position: absolute; top: calc(100% + 2px); left: 0;
                z-index: 1000; display: none;
                min-width: ${this.defaultSearchableConfig.minWidth};
                max-height: 200px; overflow-y: auto;
                background: var(--tf-choice-dropdown-bg, var(--tf-bg-color, white));
                border: 1px solid var(--tf-border-color, #ddd);
                border-radius: var(--tf-border-radius, 4px);
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .${this.defaultSearchableConfig.dropdownClass}.active { display: block; }
            .${this.defaultSearchableConfig.searchClass} {
                width: 100%; padding: 8px; border: none;
                border-bottom: 1px solid var(--tf-border-color, #ddd);
                outline: none; box-sizing: border-box; font-size: 0.95em;
            }
            .${this.defaultSearchableConfig.dropdownClass} .options-container { /* Conteneur options */ }
            .${this.defaultSearchableConfig.optionClass} {
                padding: 8px 12px; cursor: pointer; white-space: nowrap; font-size: 0.95em;
            }
            .${this.defaultSearchableConfig.optionClass}:hover {
                background-color: var(--tf-choice-option-hover-bg, #f5f5f5);
            }
            .${this.defaultSearchableConfig.dropdownClass} .no-results {
                padding: 8px 12px; color: var(--tf-text-muted-color, #999);
                font-style: italic; text-align: center;
            }
            /* Classe Readonly */
            .${this.config.readOnlyClass}, .readonly-locked { /* Classe de config + ancienne classe */
                 font-style: italic; color: var(--tf-text-muted-color, #6c757d);
                 cursor: not-allowed !important;
                 background-color: var(--tf-header-bg, #f8f9fa) !important;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Configure les cellules <td> pour les colonnes de type 'choice'.
     * @param {HTMLTableRowElement} [specificRow=null] - Si fourni, configure uniquement cette ligne.
     */
    setupChoiceCells(specificRow = null) {
        if (!this.table?.element) return;
        this.debug(`Configuration des cellules 'choice' pour ${specificRow ? `la ligne ${specificRow.id}` : 'toutes les lignes'}...`);

        const headerCells = this.table.element.querySelectorAll('thead th');
        const choiceColumns = [];

        // Identifier les colonnes 'choice' et leur configuration valide
        headerCells.forEach((header, index) => {
            if (header.hasAttribute(this.config.choiceAttribute)) {
                const columnId = header.id;
                if (!columnId) {
                     this.logger.warn(`En-tête choice index ${index} sans ID. Configuration JS requise.`);
                     return;
                }
                const columnConfig = this.getColumnConfig(columnId);
                if (columnConfig && columnConfig.values?.length > 0) {
                    const htmlType = header.getAttribute(this.config.choiceAttribute);
                    const finalType = (htmlType === 'searchable' || htmlType === 'toggle') ? htmlType : columnConfig.type;
                    choiceColumns.push({ id: columnId, index, type: finalType, config: columnConfig });
                } else {
                     this.logger.warn(`Configuration invalide ou valeurs manquantes pour colonne choice '${columnId}'.`);
                }
            }
        });

        if (choiceColumns.length === 0) {
            this.debug("Aucune colonne 'choice' valide à configurer.");
            return;
        }
        this.debug(`Colonnes 'choice' valides trouvées:`, choiceColumns.map(c => ({id: c.id, type: c.type})));

        // Configurer les cellules <td> correspondantes
        const rowsToProcess = specificRow ? [specificRow] : this.table.getAllRows(); // Utilise méthode de l'instance
        rowsToProcess.forEach(row => {
            choiceColumns.forEach(({ id: columnId, index, type, config }) => {
                const cell = row.cells[index];
                if (!cell) {
                    this.logger.warn(`Cellule manquante à l'index ${index} pour la ligne ${row.id}`);
                    return;
                }
                const existingPlugin = cell.getAttribute('data-plugin');
                if (existingPlugin && existingPlugin !== 'choice') {
                    this.debug(`Cellule ${cell.id} déjà gérée par '${existingPlugin}', saut.`);
                    return;
                }
                // Vérifier si déjà initialisé pour éviter doublons de listeners/setup
                if (!cell.hasAttribute('data-choice-initialized')) {
                    this.setupChoiceCell(cell, columnId, type, config);
                    cell.setAttribute('data-choice-initialized', 'true');
                } else {
                     this.debug(`Cellule ${cell.id} déjà initialisée pour Choice.`);
                     // Mettre à jour l'affichage au cas où le label aurait changé
                     this.updateCellDisplayFromValue(cell, columnId, config);
                     // Réappliquer le style readonly
                     this.applyReadOnlyStyle(cell, columnId, cell.getAttribute('data-value'), config);
                }
            });
        });
        this.debug("Configuration des cellules 'choice' terminée.");
    }

    /**
     * Configure une cellule <td> individuelle.
     * @param {HTMLTableCellElement} cell - La cellule <td>.
     * @param {string} columnId - L'ID de la colonne.
     * @param {'toggle'|'searchable'} type - Le type d'interaction.
     * @param {object} columnConfig - La configuration normalisée de la colonne.
     */
    setupChoiceCell(cell, columnId, type, columnConfig) {
        cell.classList.add(this.config.cellClass);
        cell.setAttribute('data-plugin', 'choice');
        cell.setAttribute('data-choice-type', type);
        cell.setAttribute('data-choice-column', columnId);

        // Récupérer/Initialiser les valeurs data-*
        let currentValue = cell.hasAttribute('data-value') ? cell.getAttribute('data-value') : cell.textContent?.trim() ?? '';
        cell.setAttribute('data-value', currentValue);
        if (!cell.hasAttribute('data-initial-value')) {
            cell.setAttribute('data-initial-value', currentValue);
        }

        // Mettre à jour l'affichage initial
        this.updateCellDisplayFromValue(cell, columnId, columnConfig);
        // Appliquer le style readonly initial
        this.applyReadOnlyStyle(cell, columnId, currentValue, columnConfig);
    }

    /**
     * Met à jour le label affiché dans une cellule en fonction de sa valeur `data-value`.
     * @param {HTMLTableCellElement} cell
     * @param {string} columnId
     * @param {object} columnConfig
     */
    updateCellDisplayFromValue(cell, columnId, columnConfig) {
        const currentValue = cell.getAttribute('data-value');
        const currentChoice = columnConfig.values.find(c => c.value === currentValue);
        const currentLabel = currentChoice ? currentChoice.label : currentValue; // Fallback sur la valeur
        this.updateCellDisplay(cell, currentLabel);
    }


    /**
     * Met à jour le contenu affiché d'une cellule (le label).
     * Utilise le sanitizer si disponible pour permettre le HTML simple.
     * @param {HTMLTableCellElement} cell - La cellule à mettre à jour.
     * @param {string} label - Le label à afficher.
     */
    updateCellDisplay(cell, label) {
        const wrapperClass = this.table?.config?.wrapCellClass || 'cell-wrapper';
        let wrapper = cell.querySelector(`.${wrapperClass}`);
        if (!wrapper) {
             this.debug(`Wrapper .${wrapperClass} manquant pour ${cell.id}, création...`);
             wrapper = document.createElement('div');
             wrapper.className = wrapperClass;
             cell.textContent = '';
             cell.appendChild(wrapper);
        }

        // Utiliser le sanitizer pour insérer le label
        if (this.table?.sanitizer && typeof this.table.sanitizer.setHTML === 'function') {
             // Permet d'utiliser du HTML simple dans les labels (ex: <i class="..."></i> Statut)
             const mightBeIcon = typeof label === 'string' && label.trim().startsWith('<');
             this.table.sanitizer.setHTML(wrapper, label, { isTrustedIcon: mightBeIcon });
        } else {
             wrapper.textContent = label; // Fallback sécurisé
        }
    }

    /**
     * Attache les écouteurs d'événements globaux pour le plugin.
     */
    setupEventListeners() {
        if (!this.table?.element) return;
        this.debug('Configuration des écouteurs d\'événements pour Choice...');

        // Nettoyer les anciens listeners avant d'ajouter (sécurité pour refresh)
        this.table.element.removeEventListener('click', this.handleClick);
        document.removeEventListener('click', this._closeDropdownOnClickOutside, true);
        this.table.element.removeEventListener('cell:saved', this._handleCellSaved);
        this.table.element.removeEventListener('row:saved', this._handleRowSaved);
        this.table.element.removeEventListener('row:added', this._handleRowAdded);

        // Ajouter les nouveaux listeners
        this.table.element.addEventListener('click', this.handleClick);
        document.addEventListener('click', this._closeDropdownOnClickOutside, true); // Capture phase
        this.table.element.addEventListener('cell:saved', this._handleCellSaved);
        this.table.element.addEventListener('row:saved', this._handleRowSaved);
        this.table.element.addEventListener('row:added', this._handleRowAdded);

        this.debug('Écouteurs d\'événements Choice configurés.');
    }

    /** Handler pour 'cell:saved'. @param {CustomEvent} event @private */
    _handleCellSaved(event) {
        const cell = event.detail?.cell;
        if (!cell || !this.isManagedCell(cell)) return;
        const currentValue = cell.getAttribute('data-value');
        cell.setAttribute('data-initial-value', currentValue);
        this.debug(`Valeur initiale mise à jour pour ${cell.id}: ${currentValue}`);
        const columnId = cell.getAttribute('data-choice-column');
        const columnConfig = columnId ? this.getColumnConfig(columnId) : null;
        if (columnConfig) {
            this.updateCellDisplayFromValue(cell, columnId, columnConfig); // Mettre à jour le label
            this.applyReadOnlyStyle(cell, columnId, currentValue, columnConfig); // Réappliquer style readonly
        }
    }

    /** Handler pour 'row:saved'. @param {CustomEvent} event @private */
    _handleRowSaved(event) {
        const row = event.detail?.row;
        if (!row) return;
        this.debug(`Gestion row:saved pour cellules Choice ligne ${row.id}`);
        Array.from(row.cells).forEach(cell => {
            if (this.isManagedCell(cell)) {
                const currentValue = cell.getAttribute('data-value');
                cell.setAttribute('data-initial-value', currentValue);
                // L'affichage est géré par _handleCellSaved
            }
        });
    }

    /** Handler pour 'row:added'. @param {CustomEvent} event @private */
    _handleRowAdded(event) {
        const row = event.detail?.row;
        if (!row) return;
        this.debug(`Gestion row:added pour nouvelle ligne Choice ${row.id}`);
        this.setupChoiceCells(row); // Configure uniquement la nouvelle ligne
    }


    /** Handler principal pour les clics sur les cellules gérées. @param {MouseEvent} event */
    handleClick(event) {
        const cell = /** @type {HTMLElement} */ (event.target)?.closest('td');
        if (!cell || !this.isManagedCell(cell)) return;

        // Vérifier si readonly
        const columnId = cell.getAttribute('data-choice-column');
        const currentValue = cell.getAttribute('data-value');
        if (this.isReadOnly(columnId, currentValue, cell)) {
             this.debug(`Clic ignoré sur cellule readonly ${cell.id}`);
             return;
        }

        const type = cell.getAttribute('data-choice-type') || 'toggle';
        this.debug(`Clic détecté sur cellule ${cell.id} (type: ${type})`);

        if (type === 'toggle') {
            this.handleToggleClick(cell);
        } else if (type === 'searchable') {
            if (this.activeDropdown && this.activeDropdown.parentElement === cell) {
                this.closeAllDropdowns();
            } else {
                this.handleSearchableClick(cell);
            }
        }
    }

    /** Gère le clic pour le mode 'toggle'. @param {HTMLTableCellElement} cell */
    handleToggleClick(cell) {
        const columnId = cell.getAttribute('data-choice-column');
        const columnConfig = columnId ? this.getColumnConfig(columnId) : null;
        if (!columnConfig || !columnConfig.values?.length) return;

        const availableChoices = columnConfig.values.filter(choice => !this.isReadOnly(columnId, choice.value));
        if (!availableChoices.length) {
             this.debug(`Aucun choix modifiable disponible pour ${cell.id}`);
             return;
        }

        const currentValue = cell.getAttribute('data-value');
        const currentIndex = availableChoices.findIndex(choice => choice.value === currentValue);
        const nextIndex = (currentIndex + 1) % availableChoices.length;
        const nextChoice = availableChoices[nextIndex];

        this.debug(`Toggle ${cell.id}: '${currentValue}' -> '${nextChoice.value}'`);
        this.updateCellValue(cell, nextChoice.value, nextChoice.label, columnId);
    }

    /** Gère le clic pour le mode 'searchable'. @param {HTMLTableCellElement} cell */
    handleSearchableClick(cell) {
        const columnId = cell.getAttribute('data-choice-column');
        const columnConfig = columnId ? this.getColumnConfig(columnId) : null;
        if (!columnConfig || !columnConfig.values?.length) return;

        this.closeAllDropdowns(); // Fermer les autres
        this.debug(`Ouverture dropdown searchable pour ${cell.id}`);
        const dropdown = this.createSearchableDropdown(cell, columnConfig);
        cell.appendChild(dropdown);
        dropdown.classList.add('active');
        this.activeDropdown = dropdown;
        dropdown.querySelector(`.${columnConfig.searchable.searchClass}`)?.focus();
    }

    /** Crée l'élément DOM pour le dropdown 'searchable'. @param {HTMLTableCellElement} cell @param {object} columnConfig @returns {HTMLDivElement} */
    createSearchableDropdown(cell, columnConfig) {
        const searchableConfig = columnConfig.searchable;
        const choices = columnConfig.values;
        const columnId = cell.getAttribute('data-choice-column');

        const dropdown = document.createElement('div');
        dropdown.className = searchableConfig.dropdownClass;
        dropdown.style.minWidth = searchableConfig.minWidth;
        dropdown.addEventListener('click', (e) => e.stopPropagation()); // Empêche fermeture

        // Input de recherche
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = searchableConfig.searchClass;
        searchInput.placeholder = searchableConfig.placeholder;
        searchInput.setAttribute('aria-label', 'Filtrer les options');
        dropdown.appendChild(searchInput);

        // Conteneur des options
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'options-container';
        dropdown.appendChild(optionsContainer);

        // Rendu initial
        this.renderSearchableOptions(optionsContainer, choices, cell, columnConfig);

        // Filtrage
        searchInput.addEventListener('input', () => {
            const searchText = searchInput.value.toLowerCase();
            const filteredChoices = choices.filter(choice => choice.label.toLowerCase().includes(searchText));
            this.renderSearchableOptions(optionsContainer, filteredChoices, cell, columnConfig);
        });

        return dropdown;
    }

    /** Remplit le conteneur d'options du dropdown. @param {HTMLDivElement} container @param {Array<object>} choices @param {HTMLTableCellElement} cell @param {object} columnConfig */
    renderSearchableOptions(container, choices, cell, columnConfig) {
        container.innerHTML = '';
        const searchableConfig = columnConfig.searchable;
        const columnId = cell.getAttribute('data-choice-column');

        const availableChoices = choices.filter(choice => !this.isReadOnly(columnId, choice.value));

        if (availableChoices.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = searchableConfig.noResultsText;
            container.appendChild(noResults);
            return;
        }

        availableChoices.forEach(choice => {
            const optionElement = document.createElement('div');
            optionElement.className = searchableConfig.optionClass;
            optionElement.setAttribute('role', 'option');
            // Utiliser sanitizer pour le label
            if (this.table?.sanitizer) {
                this.table.sanitizer.setHTML(optionElement, choice.label, { isTrustedIcon: true });
            } else {
                optionElement.textContent = choice.label;
            }
            optionElement.setAttribute('data-choice-value', choice.value);

            optionElement.addEventListener('click', () => {
                this.debug(`Option searchable sélectionnée: ${choice.label} (valeur: ${choice.value}) pour ${cell.id}`);
                this.updateCellValue(cell, choice.value, choice.label, columnId);
                this.closeAllDropdowns();
            });
            container.appendChild(optionElement);
        });
    }

    /** Met à jour valeur/affichage et déclenche événement. @param {HTMLTableCellElement} cell @param {string} value @param {string} label @param {string|null} columnId */
    updateCellValue(cell, value, label, columnId) {
        const oldValue = cell.getAttribute('data-value');
        if (value === oldValue) return;

        this.debug(`Mise à jour ${cell.id}: valeur='${value}', label='${label}'`);
        cell.setAttribute('data-value', value);
        this.updateCellDisplay(cell, label);
        const columnConfig = columnId ? this.getColumnConfig(columnId) : null;
        if (columnConfig) this.applyReadOnlyStyle(cell, columnId, value, columnConfig);
        this.dispatchChangeEvent(cell, value, oldValue, columnId);
    }

     /** Applique/Retire les classes readonly. @param {HTMLTableCellElement} cell @param {string|null} columnId @param {string|null} currentValue @param {object|null} columnConfig */
     applyReadOnlyStyle(cell, columnId, currentValue, columnConfig) {
         if (!columnConfig?.readOnlyValues) return;
         const readOnlyClass = this.config.readOnlyClass;

         // Retirer toutes les classes readonly possibles pour cette colonne
         columnConfig.readOnlyValues.forEach(roConfig => {
             if (roConfig.class) cell.classList.remove(roConfig.class);
         });
         cell.classList.remove(readOnlyClass);

         // Vérifier si la valeur actuelle est readonly
         const readOnlyInfo = columnConfig.readOnlyValues.find(roConfig => roConfig.value === currentValue);
         if (readOnlyInfo) {
             const classToAdd = readOnlyInfo.class || readOnlyClass;
             if (classToAdd) {
                 cell.classList.add(classToAdd);
                 this.debug(`Classe readonly '${classToAdd}' ajoutée à ${cell.id}`);
             }
         }
     }

    /** Vérifie si une valeur est readonly. @param {string|null} columnId @param {string|null} value @param {HTMLTableCellElement|null} [cell] @returns {boolean} */
    isReadOnly(columnId, value, cell = null) {
        const columnConfig = columnId ? this.getColumnConfig(columnId) : null;
        if (!columnConfig?.readOnlyValues?.length) return false;
        const isRO = columnConfig.readOnlyValues.some(config => config.value === value);
        // Appliquer le style si la cellule est fournie
        if (cell) this.applyReadOnlyStyle(cell, columnId, value, columnConfig);
        return isRO;
    }

    /** Ferme tous les dropdowns ouverts. */
    closeAllDropdowns() {
        if (this.activeDropdown) {
            this.debug("Fermeture du dropdown actif.");
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }
        document.querySelectorAll(`.${this.defaultSearchableConfig.dropdownClass}.active`).forEach(dd => {
             this.debug("Fermeture d'un dropdown orphelin trouvé.");
             dd.remove();
        });
    }

    /** Handler pour fermer dropdown si clic extérieur. @param {MouseEvent} event @private */
    _closeDropdownOnClickOutside(event) {
        // Si un dropdown est actif ET que le clic n'est PAS sur une cellule choice de notre table
        const clickedCell = /** @type {HTMLElement} */ (event.target)?.closest('td');
        const isClickOnManagedCell = clickedCell && this.isManagedCell(clickedCell) && clickedCell.closest('table') === this.table?.element;

        if (this.activeDropdown && !isClickOnManagedCell) {
             // Vérifier aussi si le clic n'est pas DANS le dropdown lui-même
             if (!this.activeDropdown.contains(/** @type {Node} */ (event.target))) {
                this.debug("Clic détecté en dehors de la cellule/dropdown actif, fermeture.");
                this.closeAllDropdowns();
             }
        }
    }

    /** Vérifie si une cellule est gérée par ce plugin. @param {HTMLTableCellElement | null} cell @returns {boolean} */
    isManagedCell(cell) {
        return cell?.classList.contains(this.config.cellClass) && cell.getAttribute('data-plugin') === 'choice';
    }

     /** Déclenche l'événement 'cell:change'. @param {HTMLTableCellElement} cell @param {string} newValue @param {string|null} oldValue @param {string|null} columnId @private */
     dispatchChangeEvent(cell, newValue, oldValue, columnId) {
         const row = cell.closest('tr');
         const initialValue = cell.getAttribute('data-initial-value');
         const isModified = newValue !== initialValue;

         const changeEvent = new CustomEvent('cell:change', {
             detail: {
                 cell: cell, cellId: cell.id, columnId: columnId, rowId: row?.id,
                 value: newValue, oldValue: oldValue, initialValue: initialValue, isModified: isModified,
                 source: 'choice', tableId: this.table?.tableId
             },
             bubbles: true
         });
         this.debug(`Dispatching cell:change pour ${cell.id}`, changeEvent.detail);
         this.table?.element?.dispatchEvent(changeEvent);

         // Mettre à jour la classe 'modified' sur la ligne
         if (row) {
             let rowShouldBeModified = isModified;
             if (!isModified) { // Si revient à l'initial, vérifier les autres
                 rowShouldBeModified = Array.from(row.cells).some(c =>
                     c.getAttribute('data-value') !== c.getAttribute('data-initial-value')
                 );
             }
             row.classList.toggle(this.config.modifiedClass, rowShouldBeModified);
             this.debug(`Classe '${this.config.modifiedClass}' sur la ligne ${row.id}: ${rowShouldBeModified}`);
         }
     }

    /** Rafraîchit l'état du plugin. */
    refresh() {
        this.debug('Rafraîchissement du plugin Choice...');
        this.closeAllDropdowns();
        // Réinitialiser l'attribut pour forcer la reconfiguration
        this.table?.element?.querySelectorAll(`td.${this.config.cellClass}[data-choice-initialized]`)
            .forEach(cell => cell.removeAttribute('data-choice-initialized'));
        this.setupChoiceCells(); // Reconfigure toutes les cellules
        this.debug('Rafraîchissement Choice terminé.');
    }

    /** Nettoie les ressources (écouteurs). */
    destroy() {
        this.debug('Destruction du plugin Choice...');
        if (this.table?.element) {
            this.table.element.removeEventListener('click', this.handleClick);
            this.table.element.removeEventListener('cell:saved', this._handleCellSaved);
            this.table.element.removeEventListener('row:saved', this._handleRowSaved);
            this.table.element.removeEventListener('row:added', this._handleRowAdded);
        }
        document.removeEventListener('click', this._closeDropdownOnClickOutside, true);
        this.closeAllDropdowns();
        this.table = null;
        this.debug('Plugin Choice détruit.');
    }
}
