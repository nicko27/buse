import { DOMSanitizer } from '../src/domSanitizer.js';

/**
 * Plugin Choice pour TableFlow
 * Permet de gérer des sélections de valeurs avec deux modes :
 * - toggle : basculement direct entre les options par clic
 * - searchable : recherche et sélection dans une liste déroulante
 * 
 * @version 3.0.0
 */
export default class ChoicePlugin {
    constructor(config = {}) {
        this.name = 'choice';
        this.version = '3.0.0';
        this.type = 'edit';
        this.table = null;
        this.dependencies = [];
        
        // État actif
        this.activeDropdown = null;
        this.activeSearchInput = null;
        
        // Configuration par défaut
        this.defaultConfig = {
            // Attributs HTML
            choiceAttribute: 'th-choice',
            cellClass: 'choice-cell',
            readOnlyClass: 'readonly',
            modifiedClass: 'modified',
            
            // Interface
            dropdownClass: 'choice-dropdown',
            optionClass: 'choice-option',
            searchClass: 'choice-search',
            toggleClass: 'choice-toggle',
            readOnlyBadgeClass: 'choice-readonly-badge',
            
            // Comportement
            closeOnSelect: true,
            closeOnClickOutside: true,
            allowCustomValue: false,
            searchable: true,
            minSearchLength: 0,
            maxDropdownHeight: '300px',
            dropdownWidth: 'auto',
            
            // Textes
            placeholder: 'Rechercher...',
            noResultsText: 'Aucun résultat',
            customValueText: 'Utiliser "{value}"',
            loadingText: 'Chargement...',
            
            // API
            asyncLoad: false,
            asyncUrl: null,
            asyncParams: {},
            asyncTransform: null,
            
            // Animation
            animationDuration: 200,
            
            // Debug
            debug: false
        };
        
        // Configuration pour les dropdowns searchable
        this.searchableConfig = {
            minWidth: '200px',
            dropdownClass: 'choice-dropdown',
            optionClass: 'choice-option',
            searchClass: 'choice-search',
            placeholder: 'Rechercher...',
            noResultsText: 'Aucun résultat',
            ...config.searchable
        };

        // Configuration finale
        this.config = {
            ...this.defaultConfig,
            ...config,
            columns: config.columns || {}
        };

        // Logger
        this.debug = this.config.debug ?
            (...args) => console.log('[ChoicePlugin]', ...args) :
            () => {};

        // Gestion des événements
        this._processedEvents = new Map();
        this._cleanupInterval = null;
        this._maxProcessedEvents = 100;
        this._eventLifetime = 5000;
        
        // Bind des méthodes
        this.handleClick = this.handleClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
        this.handleCellSaved = this.handleCellSaved.bind(this);
        this.handleRowSaved = this.handleRowSaved.bind(this);
        this.handleRowAdded = this.handleRowAdded.bind(this);
        
        // Cache pour les données asynchrones
        this.dataCache = new Map();
        this.loadingPromises = new Map();
    }

    init(tableHandler) {
        if (!tableHandler) {
            throw new Error('TableHandler instance is required');
        }
        
        this.table = tableHandler;
        this.debug('Initializing choice plugin');

        this.setupChoiceCells();
        this.setupEventListeners();
        this.startCleanupInterval();
        this.addStyles();
    }

    /**
     * Ajoute les styles CSS nécessaires
     */
    addStyles() {
        if (document.getElementById('choice-plugin-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'choice-plugin-styles';
        style.textContent = `
            .${this.config.cellClass} {
                cursor: pointer;
                position: relative;
                user-select: none;
            }
            
            .${this.config.cellClass}:hover {
                background-color: rgba(0, 0, 0, 0.02);
            }
            
            .${this.config.cellClass} .cell-wrapper {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
            }
            
            .${this.config.dropdownClass} {
                position: absolute;
                z-index: 1000;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                overflow: auto;
                display: none;
                animation: choiceDropdownShow ${this.config.animationDuration}ms ease-out;
            }
            
            .${this.config.dropdownClass}.active {
                display: block;
            }
            
            .${this.config.searchClass} {
                width: 100%;
                padding: 8px 12px;
                border: none;
                border-bottom: 1px solid #eee;
                outline: none;
                font-size: 14px;
                box-sizing: border-box;
            }
            
            .${this.config.searchClass}:focus {
                border-bottom-color: #007bff;
            }
            
            .${this.config.optionClass} {
                padding: 8px 12px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                transition: background-color 0.15s;
            }
            
            .${this.config.optionClass}:hover {
                background-color: #f5f5f5;
            }
            
            .${this.config.optionClass}.selected {
                background-color: #e3f2fd;
                font-weight: 500;
            }
            
            .${this.config.optionClass}.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            .${this.config.optionClass}.custom-value {
                border-top: 1px solid #eee;
                font-style: italic;
            }
            
            .choice-option-content {
                flex: 1;
            }
            
            .choice-option-icon {
                width: 20px;
                text-align: center;
            }
            
            .choice-option-badge {
                font-size: 0.75em;
                padding: 2px 6px;
                border-radius: 10px;
                background: #e0e0e0;
            }
            
            .${this.config.readOnlyBadgeClass} {
                font-size: 0.75em;
                padding: 2px 6px;
                border-radius: 10px;
                background: #ffebee;
                color: #c62828;
                margin-left: 4px;
            }
            
            .choice-no-results {
                padding: 12px;
                text-align: center;
                color: #666;
                font-style: italic;
            }
            
            .choice-loading {
                padding: 12px;
                text-align: center;
                color: #666;
            }
            
            .choice-loading::after {
                content: '';
                display: inline-block;
                width: 16px;
                height: 16px;
                margin-left: 8px;
                border: 2px solid #ddd;
                border-top-color: #333;
                border-radius: 50%;
                animation: choiceSpinner 0.6s linear infinite;
            }
            
            @keyframes choiceDropdownShow {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            @keyframes choiceSpinner {
                to {
                    transform: rotate(360deg);
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    /**
     * Configure les cellules de choix
     */
    setupChoiceCells() {
        if (!this.table?.table) return;

        const headerCells = this.table.table.querySelectorAll('th');
        const choiceColumns = Array.from(headerCells)
            .filter(header => header.hasAttribute(this.config.choiceAttribute))
            .map(header => {
                const columnId = header.id;
                const columnConfig = this.getColumnConfig(columnId);
                const headerType = header.getAttribute(this.config.choiceAttribute);

                return {
                    id: columnId,
                    index: Array.from(headerCells).indexOf(header),
                    type: headerType || (columnConfig ? columnConfig.type : 'toggle'),
                    config: columnConfig
                };
            });

        if (!choiceColumns.length) return;

        const rows = this.table.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            choiceColumns.forEach(({ id: columnId, index, type, config }) => {
                const cell = row.cells[index];
                if (!cell) return;

                if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'choice') {
                    return;
                }

                this.setupChoiceCell(cell, columnId, type, config);
            });
        });
    }

    /**
     * Configure une cellule de choix
     */
    setupChoiceCell(cell, columnId, type, columnConfig) {
        cell.classList.add(this.config.cellClass);
        cell.setAttribute('data-plugin', 'choice');
        cell.setAttribute('data-choice-type', type);
        cell.setAttribute('data-choice-column', columnId);

        // Récupérer la valeur actuelle
        let currentValue = cell.getAttribute('data-value');
        if (currentValue === null) {
            currentValue = cell.textContent.trim();
            cell.setAttribute('data-value', currentValue);
        }

        // Définir la valeur initiale si elle n'existe pas
        if (!cell.hasAttribute('data-initial-value')) {
            cell.setAttribute('data-initial-value', currentValue);
        }

        // Configurer le wrapper
        this.updateCellDisplay(cell, currentValue, columnConfig);
    }

    /**
     * Met à jour l'affichage d'une cellule
     */
    updateCellDisplay(cell, value, columnConfig) {
        const wrapper = cell.querySelector('.cell-wrapper') || document.createElement('div');
        wrapper.className = 'cell-wrapper';
        
        // Trouver l'option correspondante
        const option = this.findOption(value, columnConfig);
        const label = option ? (option.label || option.value) : value;
        
        // Vérifier si readonly
        const isReadOnly = this.isReadOnly(cell.getAttribute('data-choice-column'), value, cell);
        
        // Créer le contenu
        let content = `<span class="choice-value">${DOMSanitizer.escapeHTML(label)}</span>`;
        
        if (isReadOnly) {
            content += `<span class="${this.config.readOnlyBadgeClass}">🔒</span>`;
        }
        
        if (option?.icon) {
            content = `<span class="choice-icon">${option.icon}</span> ${content}`;
        }
        
        wrapper.innerHTML = content;
        
        if (!wrapper.parentNode) {
            cell.textContent = '';
            cell.appendChild(wrapper);
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        if (!this.table?.table) return;

        // Gestionnaire de clic
        this.table.table.addEventListener('click', this.handleClick);
        
        // Gestionnaire de clavier
        this.table.table.addEventListener('keydown', this.handleKeyDown);

        // Fermer le dropdown quand on clique ailleurs
        document.addEventListener('click', this.handleOutsideClick);
        
        // Gérer le redimensionnement de la fenêtre
        window.addEventListener('resize', this.handleWindowResize);

        // Écouter les événements de sauvegarde
        this.table.table.addEventListener('cell:saved', this.handleCellSaved);
        this.table.table.addEventListener('row:saved', this.handleRowSaved);
        this.table.table.addEventListener('row:added', this.handleRowAdded);
    }

    /**
     * Gestionnaire de clic
     */
    handleClick(event) {
        const cell = event.target.closest('td');
        if (!cell || !this.isManagedCell(cell)) return;

        // Ne pas traiter si readonly
        if (cell.classList.contains(this.config.readOnlyClass)) return;

        const type = cell.getAttribute('data-choice-type') || 'toggle';

        if (type === 'toggle') {
            this.handleToggleClick(cell);
        } else if (type === 'searchable') {
            this.handleSearchableClick(cell);
        }
    }

    /**
     * Gestionnaire de touches clavier
     */
    handleKeyDown(event) {
        if (!this.activeDropdown) return;

        switch (event.key) {
            case 'Escape':
                this.closeAllDropdowns();
                event.preventDefault();
                break;
                
            case 'ArrowDown':
                this.navigateOptions('down');
                event.preventDefault();
                break;
                
            case 'ArrowUp':
                this.navigateOptions('up');
                event.preventDefault();
                break;
                
            case 'Enter':
                this.selectHighlightedOption();
                event.preventDefault();
                break;
                
            case 'Tab':
                this.closeAllDropdowns();
                break;
        }
    }

    /**
     * Gestion du clic en mode toggle
     */
    handleToggleClick(cell) {
        const columnId = cell.getAttribute('data-choice-column');
        const columnConfig = this.getColumnConfig(columnId);
        if (!columnConfig) return;

        const choices = columnConfig.values;
        if (!choices || !choices.length) return;

        // Filtrer les choix non-readonly
        const availableChoices = choices.filter(choice => {
            const value = typeof choice === 'object' ? choice.value : choice;
            return !this.isReadOnly(columnId, value);
        });

        if (!availableChoices.length) return;

        // Obtenir la valeur actuelle
        const currentValue = cell.getAttribute('data-value');

        // Trouver l'index du choix actuel
        const currentIndex = availableChoices.findIndex(choice =>
            (typeof choice === 'object' ? choice.value : choice) === currentValue
        );

        // Obtenir le prochain choix
        const nextChoice = availableChoices[(currentIndex + 1) % availableChoices.length];
        const nextValue = typeof nextChoice === 'object' ? nextChoice.value : nextChoice;
        const nextLabel = typeof nextChoice === 'object' ? nextChoice.label : nextChoice;

        this.updateCellValue(cell, nextValue, nextLabel, columnId);
    }

    /**
     * Gestion du clic en mode searchable
     */
    async handleSearchableClick(cell) {
        const columnId = cell.getAttribute('data-choice-column');
        const columnConfig = this.getColumnConfig(columnId);
        if (!columnConfig) return;

        // Fermer les autres dropdowns
        this.closeAllDropdowns();

        // Créer et afficher le dropdown
        const dropdown = await this.createSearchableDropdown(cell, columnConfig, columnId);
        cell.appendChild(dropdown);
        
        // Positionner le dropdown
        this.positionDropdown(dropdown, cell);
        
        dropdown.classList.add('active');
        this.activeDropdown = dropdown;

        // Focus sur la recherche
        const searchInput = dropdown.querySelector(`.${this.config.searchClass}`);
        if (searchInput) {
            searchInput.focus();
            this.activeSearchInput = searchInput;
        }
    }

    /**
     * Crée un dropdown searchable
     */
    async createSearchableDropdown(cell, columnConfig, columnId) {
        const dropdown = document.createElement('div');
        dropdown.className = this.config.dropdownClass;
        
        // Appliquer les styles de configuration
        dropdown.style.minWidth = this.searchableConfig.minWidth;
        dropdown.style.maxHeight = this.config.maxDropdownHeight;
        dropdown.style.width = this.config.dropdownWidth;

        // Créer le contenu
        let content = '';
        
        // Barre de recherche
        if (this.config.searchable) {
            content += `
                <input type="text" 
                       class="${this.config.searchClass}" 
                       placeholder="${this.config.placeholder}"
                       autocomplete="off">
            `;
        }
        
        // Conteneur pour les options
        content += '<div class="options-container"></div>';
        
        dropdown.innerHTML = content;

        // Charger les options
        const optionsContainer = dropdown.querySelector('.options-container');
        
        if (columnConfig.asyncLoad && columnConfig.asyncUrl) {
            await this.loadAsyncOptions(optionsContainer, columnConfig, cell, columnId);
        } else {
            this.renderOptions(optionsContainer, columnConfig.values || [], cell, columnId);
        }

        // Gestionnaire de recherche
        if (this.config.searchable) {
            const searchInput = dropdown.querySelector(`.${this.config.searchClass}`);
            let searchTimeout;
            
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(async () => {
                    const searchText = searchInput.value.toLowerCase();
                    
                    if (columnConfig.asyncLoad && columnConfig.asyncUrl) {
                        await this.loadAsyncOptions(optionsContainer, columnConfig, cell, columnId, searchText);
                    } else {
                        const filteredChoices = (columnConfig.values || []).filter(choice => {
                            const label = typeof choice === 'object' ? choice.label : choice;
                            return label.toLowerCase().includes(searchText);
                        });
                        
                        this.renderOptions(optionsContainer, filteredChoices, cell, columnId, searchText);
                    }
                }, 300);
            });
        }

        return dropdown;
    }

    /**
     * Charge les options de manière asynchrone
     */
    async loadAsyncOptions(container, columnConfig, cell, columnId, searchText = '') {
        const cacheKey = `${columnId}:${searchText}`;
        
        // Vérifier le cache
        if (this.dataCache.has(cacheKey)) {
            const cachedData = this.dataCache.get(cacheKey);
            this.renderOptions(container, cachedData, cell, columnId, searchText);
            return;
        }
        
        // Vérifier si déjà en cours de chargement
        if (this.loadingPromises.has(cacheKey)) {
            const data = await this.loadingPromises.get(cacheKey);
            this.renderOptions(container, data, cell, columnId, searchText);
            return;
        }
        
        // Afficher l'indicateur de chargement
        container.innerHTML = `<div class="choice-loading">${this.config.loadingText}</div>`;
        
        // Construire les paramètres
        const params = {
            ...columnConfig.asyncParams,
            search: searchText
        };
        
        // Créer la promesse de chargement
        const loadingPromise = fetch(columnConfig.asyncUrl + '?' + new URLSearchParams(params))
            .then(response => response.json())
            .then(data => {
                // Transformer les données si nécessaire
                if (columnConfig.asyncTransform) {
                    data = columnConfig.asyncTransform(data);
                }
                
                // Mettre en cache
                this.dataCache.set(cacheKey, data);
                
                return data;
            })
            .finally(() => {
                this.loadingPromises.delete(cacheKey);
            });
        
        this.loadingPromises.set(cacheKey, loadingPromise);
        
        try {
            const data = await loadingPromise;
            this.renderOptions(container, data, cell, columnId, searchText);
        } catch (error) {
            console.error('Erreur lors du chargement des options:', error);
            container.innerHTML = `<div class="choice-no-results">Erreur de chargement</div>`;
        }
    }

    /**
     * Affiche les options
     */
    renderOptions(container, choices, cell, columnId, searchText = '') {
        container.innerHTML = '';
        
        const currentValue = cell.getAttribute('data-value');

        if (!choices.length) {
            container.innerHTML = `
                <div class="choice-no-results">${this.config.noResultsText}</div>
            `;
            
            // Option pour valeur personnalisée
            if (this.config.allowCustomValue && searchText) {
                const customOption = document.createElement('div');
                customOption.className = `${this.config.optionClass} custom-value`;
                customOption.innerHTML = `
                    <span class="choice-option-content">
                        ${this.config.customValueText.replace('{value}', searchText)}
                    </span>
                `;
                customOption.addEventListener('click', () => {
                    this.updateCellValue(cell, searchText, searchText, columnId);
                    this.closeAllDropdowns();
                });
                container.appendChild(customOption);
            }
            
            return;
        }

        choices.forEach(choice => {
            const value = typeof choice === 'object' ? choice.value : choice;
            const label = typeof choice === 'object' ? choice.label : choice;
            const icon = typeof choice === 'object' ? choice.icon : null;
            const badge = typeof choice === 'object' ? choice.badge : null;

            // Vérifier si readonly
            if (this.isReadOnly(columnId, value)) {
                return;
            }

            const optionElement = document.createElement('div');
            optionElement.className = this.config.optionClass;
            optionElement.setAttribute('data-value', value);
            
            // Marquer comme sélectionné si c'est la valeur courante
            if (value === currentValue) {
                optionElement.classList.add('selected');
            }
            
            // Marquer comme désactivé si nécessaire
            if (choice.disabled) {
                optionElement.classList.add('disabled');
            }
            
            // Construire le contenu
            let content = '';
            
            if (icon) {
                content += `<span class="choice-option-icon">${icon}</span>`;
            }
            
            content += `<span class="choice-option-content">${DOMSanitizer.escapeHTML(label)}</span>`;
            
            if (badge) {
                content += `<span class="choice-option-badge">${DOMSanitizer.escapeHTML(badge)}</span>`;
            }
            
            optionElement.innerHTML = content;
            
            // Gestionnaire de clic
            if (!choice.disabled) {
                optionElement.addEventListener('click', () => {
                    this.updateCellValue(cell, value, label, columnId);
                    if (this.config.closeOnSelect) {
                        this.closeAllDropdowns();
                    }
                });
            }

            container.appendChild(optionElement);
        });
    }

    /**
     * Navigation au clavier dans les options
     */
    navigateOptions(direction) {
        if (!this.activeDropdown) return;
        
        const options = Array.from(this.activeDropdown.querySelectorAll(`.${this.config.optionClass}:not(.disabled)`));
        if (!options.length) return;
        
        let currentIndex = options.findIndex(option => option.classList.contains('highlighted'));
        
        if (currentIndex !== -1) {
            options[currentIndex].classList.remove('highlighted');
        }
        
        if (direction === 'down') {
            currentIndex = currentIndex < options.length - 1 ? currentIndex + 1 : 0;
        } else {
            currentIndex = currentIndex > 0 ? currentIndex - 1 : options.length - 1;
        }
        
        options[currentIndex].classList.add('highlighted');
        options[currentIndex].scrollIntoView({ block: 'nearest' });
    }

    /**
     * Sélectionne l'option surlignée
     */
    selectHighlightedOption() {
        if (!this.activeDropdown) return;
        
        const highlightedOption = this.activeDropdown.querySelector(`.${this.config.optionClass}.highlighted`);
        if (highlightedOption && !highlightedOption.classList.contains('disabled')) {
            highlightedOption.click();
        }
    }

    /**
     * Positionne le dropdown
     */
    positionDropdown(dropdown, cell) {
        const cellRect = cell.getBoundingClientRect();
        const dropdownRect = dropdown.getBoundingClientRect();
        
        // Position par défaut : sous la cellule
        let top = cellRect.bottom;
        let left = cellRect.left;
        
        // Vérifier si le dropdown dépasse en bas
        if (top + dropdownRect.height > window.innerHeight) {
            // Positionner au-dessus si possible
            if (cellRect.top - dropdownRect.height > 0) {
                top = cellRect.top - dropdownRect.height;
            }
        }
        
        // Vérifier si le dropdown dépasse à droite
        if (left + dropdownRect.width > window.innerWidth) {
            left = window.innerWidth - dropdownRect.width - 10;
        }
        
        dropdown.style.position = 'fixed';
        dropdown.style.top = `${top}px`;
        dropdown.style.left = `${left}px`;
    }

    /**
     * Met à jour la valeur d'une cellule
     */
    updateCellValue(cell, value, label, columnId) {
        const oldValue = cell.getAttribute('data-value');
        
        // Mettre à jour les attributs
        cell.setAttribute('data-value', value);
        
        // Mettre à jour l'affichage
        const columnConfig = this.getColumnConfig(columnId);
        this.updateCellDisplay(cell, value, columnConfig);
        
        // S'assurer que data-initial-value existe
        if (!cell.hasAttribute('data-initial-value')) {
            cell.setAttribute('data-initial-value', value);
        }

        // Marquer comme modifié si nécessaire
        const initialValue = cell.getAttribute('data-initial-value');
        const isModified = value !== initialValue;
        const row = cell.closest('tr');

        if (isModified && row) {
            row.classList.add(this.config.modifiedClass);
        } else if (row && !isModified) {
            row.classList.remove(this.config.modifiedClass);
        }

        // Créer un événement unique
        const eventId = this.generateEventId();
        const changeEvent = new CustomEvent('cell:change', {
            detail: {
                cell,
                value,
                oldValue,
                columnId,
                rowId: row?.id,
                source: 'choice',
                tableId: this.table.table.id,
                isModified,
                eventId
            },
            bubbles: true
        });

        this.table.table.dispatchEvent(changeEvent);
    }

    /**
     * Gestion des clics en dehors
     */
    handleOutsideClick(event) {
        if (!this.config.closeOnClickOutside) return;
        
        const target = event.target;
        
        // Vérifier si le clic est dans un dropdown
        if (target.closest(`.${this.config.dropdownClass}`)) return;
        
        // Vérifier si le clic est sur une cellule choice
        if (target.closest(`.${this.config.cellClass}`)) return;
        
        this.closeAllDropdowns();
    }

    /**
     * Gestion du redimensionnement
     */
    handleWindowResize() {
        if (this.activeDropdown) {
            const cell = this.activeDropdown.parentElement;
            if (cell) {
                this.positionDropdown(this.activeDropdown, cell);
            }
        }
    }

    /**
     * Récupère la configuration d'une colonne
     */
    getColumnConfig(columnId) {
        const columnConfig = this.config.columns[columnId];
        if (!columnConfig) return null;

        // Convertir l'ancien format si nécessaire
        if (Array.isArray(columnConfig)) {
            return {
                type: 'toggle',
                values: columnConfig
            };
        }

        // Gérer les valeurs readonly
        if (columnConfig.values) {
            const readOnlyValues = [];
            const values = columnConfig.values.map(value => {
                if (typeof value === 'object' && value.readOnly) {
                    readOnlyValues.push({
                        value: value.value,
                        class: value.readOnlyClass || value.class || 'readonly-locked'
                    });
                    const { readOnly, readOnlyClass, ...cleanValue } = value;
                    return cleanValue;
                }
                return value;
            });

            return {
                ...columnConfig,
                type: columnConfig.type || 'toggle',
                values: values,
                readOnlyValues: [...(columnConfig.readOnlyValues || []), ...readOnlyValues],
                searchable: {
                    ...this.searchableConfig,
                    ...(columnConfig.searchable || {})
                }
            };
        }

        return {
            type: columnConfig.type || 'toggle',
            values: columnConfig.values || [],
            readOnlyValues: columnConfig.readOnlyValues || [],
            searchable: {
                ...this.searchableConfig,
                ...(columnConfig.searchable || {})
            }
        };
    }

    /**
     * Trouve une option par sa valeur
     */
    findOption(value, columnConfig) {
        if (!columnConfig || !columnConfig.values) return null;
        
        return columnConfig.values.find(option => {
            if (typeof option === 'object') {
                return option.value === value;
            }
            return option === value;
        });
    }

/**
    * Vérifie si une valeur est en lecture seule
    */
isReadOnly(columnId, value, cell) {
    const columnConfig = this.getColumnConfig(columnId);
    if (!columnConfig) return false;

    // Vérifier dans readOnlyValues
    if (columnConfig.readOnlyValues?.length) {
        const readOnlyConfig = columnConfig.readOnlyValues.find(config => config.value === value);
        if (readOnlyConfig) {
            if (cell && readOnlyConfig.class) {
                cell.classList.add(readOnlyConfig.class);
            }
            return true;
        }
    }

    return false;
}

/**
 * Ferme tous les dropdowns
 */
closeAllDropdowns() {
    if (this.activeDropdown) {
        this.activeDropdown.classList.remove('active');
        
        // Supprimer après l'animation
        setTimeout(() => {
            if (this.activeDropdown && this.activeDropdown.parentNode) {
                this.activeDropdown.parentNode.removeChild(this.activeDropdown);
            }
            this.activeDropdown = null;
            this.activeSearchInput = null;
        }, this.config.animationDuration);
    }
}

/**
 * Vérifie si une cellule est gérée par ce plugin
 */
isManagedCell(cell) {
    return cell?.classList.contains(this.config.cellClass);
}

/**
 * Génère un ID unique pour un événement
 */
generateEventId() {
    return `choice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Démarre le nettoyage automatique des événements
 */
startCleanupInterval() {
    if (this._cleanupInterval) {
        clearInterval(this._cleanupInterval);
    }
    
    this._cleanupInterval = setInterval(() => {
        const now = Date.now();
        const expiredEvents = [];
        
        for (const [eventId, timestamp] of this._processedEvents.entries()) {
            if (now - timestamp > this._eventLifetime) {
                expiredEvents.push(eventId);
            }
        }
        
        expiredEvents.forEach(eventId => {
            this._processedEvents.delete(eventId);
        });
        
        if (this._processedEvents.size > this._maxProcessedEvents) {
            const entries = Array.from(this._processedEvents.entries());
            entries.sort((a, b) => b[1] - a[1]);
            entries.slice(this._maxProcessedEvents).forEach(([eventId]) => {
                this._processedEvents.delete(eventId);
            });
        }
    }, 1000);
}

/**
 * Gestionnaires d'événements de la table
 */
handleCellSaved(event) {
    const cell = event.detail.cell;
    if (!cell || !this.isManagedCell(cell)) return;

    const currentValue = cell.getAttribute('data-value');
    cell.setAttribute('data-initial-value', currentValue);

    // Mettre à jour l'affichage si nécessaire
    const columnId = cell.getAttribute('data-choice-column');
    const columnConfig = this.getColumnConfig(columnId);
    if (columnConfig) {
        this.updateCellDisplay(cell, currentValue, columnConfig);
    }
}

handleRowSaved(event) {
    const row = event.detail.row;
    if (!row) return;

    Array.from(row.cells).forEach(cell => {
        if (!this.isManagedCell(cell)) return;

        const currentValue = cell.getAttribute('data-value');
        cell.setAttribute('data-initial-value', currentValue);
    });

    row.classList.remove(this.config.modifiedClass);
}

handleRowAdded() {
    this.debug('row:added event received');
    this.setupChoiceCells();
}

/**
 * API Publique
 */

/**
 * Obtient la valeur actuelle d'une cellule
 */
getValue(cell) {
    if (!this.isManagedCell(cell)) return null;
    return cell.getAttribute('data-value');
}

/**
 * Définit la valeur d'une cellule
 */
setValue(cell, value) {
    if (!this.isManagedCell(cell)) return false;
    
    const columnId = cell.getAttribute('data-choice-column');
    const columnConfig = this.getColumnConfig(columnId);
    
    if (!columnConfig) return false;
    
    // Trouver l'option correspondante
    const option = this.findOption(value, columnConfig);
    const label = option ? (option.label || option.value) : value;
    
    this.updateCellValue(cell, value, label, columnId);
    return true;
}

/**
 * Obtient toutes les options disponibles pour une colonne
 */
getOptions(columnId) {
    const columnConfig = this.getColumnConfig(columnId);
    return columnConfig ? columnConfig.values : [];
}

/**
 * Ajoute une option à une colonne
 */
addOption(columnId, option) {
    const columnConfig = this.getColumnConfig(columnId);
    if (!columnConfig) return false;
    
    if (!columnConfig.values) {
        columnConfig.values = [];
    }
    
    columnConfig.values.push(option);
    return true;
}

/**
 * Supprime une option d'une colonne
 */
removeOption(columnId, value) {
    const columnConfig = this.getColumnConfig(columnId);
    if (!columnConfig || !columnConfig.values) return false;
    
    const index = columnConfig.values.findIndex(option => {
        if (typeof option === 'object') {
            return option.value === value;
        }
        return option === value;
    });
    
    if (index !== -1) {
        columnConfig.values.splice(index, 1);
        return true;
    }
    
    return false;
}

/**
 * Met à jour les options d'une colonne
 */
updateOptions(columnId, options) {
    const columnConfig = this.getColumnConfig(columnId);
    if (!columnConfig) return false;
    
    columnConfig.values = options;
    
    // Rafraîchir l'affichage des cellules
    const cells = this.table.table.querySelectorAll(`[data-choice-column="${columnId}"]`);
    cells.forEach(cell => {
        const value = cell.getAttribute('data-value');
        this.updateCellDisplay(cell, value, columnConfig);
    });
    
    return true;
}

/**
 * Active/désactive une cellule
 */
setEnabled(cell, enabled) {
    if (!this.isManagedCell(cell)) return false;
    
    if (enabled) {
        cell.classList.remove(this.config.readOnlyClass);
        cell.style.pointerEvents = '';
    } else {
        cell.classList.add(this.config.readOnlyClass);
        cell.style.pointerEvents = 'none';
    }
    
    return true;
}

/**
 * Rafraîchit l'affichage de toutes les cellules
 */
refresh() {
    this.setupChoiceCells();
}

/**
 * Détruit le plugin
 */
destroy() {
    // Fermer les dropdowns actifs
    this.closeAllDropdowns();
    
    // Arrêter le nettoyage des événements
    if (this._cleanupInterval) {
        clearInterval(this._cleanupInterval);
    }
    
    // Supprimer les gestionnaires d'événements
    if (this.table?.table) {
        this.table.table.removeEventListener('click', this.handleClick);
        this.table.table.removeEventListener('keydown', this.handleKeyDown);
        this.table.table.removeEventListener('cell:saved', this.handleCellSaved);
        this.table.table.removeEventListener('row:saved', this.handleRowSaved);
        this.table.table.removeEventListener('row:added', this.handleRowAdded);
    }
    
    document.removeEventListener('click', this.handleOutsideClick);
    window.removeEventListener('resize', this.handleWindowResize);
    
    // Nettoyer les caches
    this._processedEvents.clear();
    this.dataCache.clear();
    this.loadingPromises.clear();
    
    // Supprimer les styles
    const style = document.getElementById('choice-plugin-styles');
    if (style) {
        style.remove();
    }
}

/**
 * Exporte la configuration actuelle
 */
exportConfig() {
    return {
        ...this.config,
        columns: { ...this.config.columns }
    };
}

/**
 * Importe une configuration
 */
importConfig(config) {
    this.config = {
        ...this.config,
        ...config
    };
    
    if (config.columns) {
        this.config.columns = { ...config.columns };
    }
    
    this.refresh();
}

/**
 * Obtient des statistiques d'utilisation
 */
getStats() {
    const stats = {
        totalChoiceCells: 0,
        toggleCells: 0,
        searchableCells: 0,
        readOnlyCells: 0,
        modifiedCells: 0,
        asyncColumns: 0
    };
    
    const cells = this.table.table.querySelectorAll(`.${this.config.cellClass}`);
    stats.totalChoiceCells = cells.length;
    
    cells.forEach(cell => {
        const type = cell.getAttribute('data-choice-type');
        if (type === 'toggle') stats.toggleCells++;
        if (type === 'searchable') stats.searchableCells++;
        
        if (cell.classList.contains(this.config.readOnlyClass)) {
            stats.readOnlyCells++;
        }
        
        const value = cell.getAttribute('data-value');
        const initialValue = cell.getAttribute('data-initial-value');
        if (value !== initialValue) {
            stats.modifiedCells++;
        }
    });
    
    // Compter les colonnes asynchrones
    Object.values(this.config.columns).forEach(columnConfig => {
        if (columnConfig.asyncLoad && columnConfig.asyncUrl) {
            stats.asyncColumns++;
        }
    });
    
    return stats;
}
}