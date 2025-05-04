/**
 * Plugin Choice pour TableFlow
 * Permet de gérer des sélections de valeurs avec deux modes :
 * - toggle : basculement direct entre les options par clic
 * - searchable : recherche et sélection dans une liste déroulante
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class ChoicePlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.EDIT;
        this.dependencies = config.dependencies;
        this.activeDropdown = null;
        this.isInitialized = false;

        // Configuration par défaut
        this.defaultSearchableConfig = {
            minWidth: '200px',
            dropdownClass: 'choice-dropdown',
            optionClass: 'choice-option',
            searchClass: 'choice-search',
            placeholder: 'Rechercher...',
            noResultsText: 'Aucun résultat'
        };

        // Configuration unifiée
        this.config = {
            // Configuration de base
            choiceAttribute: 'th-choice',
            cellClass: 'choice-cell',
            readOnlyClass: 'readonly',
            modifiedClass: 'modified',
            debug: false,

            // Options pour chaque colonne
            columns: {}
        };

        // Fusionner avec la config fournie
        Object.assign(this.config, config);

        // Configurer le debug
        this.debug = this.config.debug ?
            (...args) => console.log('[ChoicePlugin]', ...args) :
            () => { };

        // Lier les méthodes pour préserver le contexte
        this.handleClick = this.handleClick.bind(this);
        this.handleToggleClick = this.handleToggleClick.bind(this);
        this.handleSearchableClick = this.handleSearchableClick.bind(this);
    }

    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Choice déjà initialisé');
            return;
        }

        try {
            this.addSearchableStyles();
            this.setupChoiceCells();
            this.setupEventListeners();
            this.isInitialized = true;
            this.logger.info('Plugin Choice initialisé avec succès');
        } catch (error) {
            this.errorHandler.handle(error, 'choice_init');
            throw error;
        }
    }

    getColumnConfig(columnId) {
        const columnConfig = this.config.columns[columnId];
        if (!columnConfig) return null;

        // Si c'est un tableau (ancienne syntaxe), le convertir en objet
        if (Array.isArray(columnConfig)) {
            return {
                type: 'toggle',
                values: columnConfig
            };
        }

        // Convertir les valeurs readOnly en readOnlyValues si nécessaire
        if (columnConfig.values) {
            const readOnlyValues = [];
            columnConfig.values = columnConfig.values.map(value => {
                if (typeof value === 'object' && value.readOnly) {
                    readOnlyValues.push({
                        value: value.value,
                        class: value.readOnlyClass || value.class || 'readonly-locked'
                    });
                    // Créer une nouvelle copie sans les propriétés readOnly
                    const { readOnly, readOnlyClass, ...cleanValue } = value;
                    return cleanValue;
                }
                return value;
            });

            // Fusionner avec les readOnlyValues existants
            if (readOnlyValues.length > 0) {
                columnConfig.readOnlyValues = [
                    ...(columnConfig.readOnlyValues || []),
                    ...readOnlyValues
                ];
            }
        }

        return {
            type: columnConfig.type || 'toggle',
            values: columnConfig.values || [],
            readOnlyValues: columnConfig.readOnlyValues || [],
            searchable: {
                ...this.defaultSearchableConfig,
                ...(columnConfig.searchable || {})
            }
        };
    }

    createSearchableDropdown(cell, choices, columnId) {
        const dropdown = document.createElement('div');
        const columnConfig = this.getColumnConfig(columnId);
        const searchableConfig = columnConfig.searchable || this.defaultSearchableConfig;

        dropdown.className = searchableConfig.dropdownClass || this.defaultSearchableConfig.dropdownClass;
        dropdown.style.minWidth = searchableConfig.minWidth || this.defaultSearchableConfig.minWidth;

        // Ajouter la barre de recherche
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = searchableConfig.searchClass || this.defaultSearchableConfig.searchClass;
        searchInput.placeholder = searchableConfig.placeholder || this.defaultSearchableConfig.placeholder;
        dropdown.appendChild(searchInput);

        // Conteneur pour les options
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'options-container';

        // Ajouter les options
        this.renderSearchableOptions(optionsContainer, choices, cell, columnId);
        dropdown.appendChild(optionsContainer);

        // Gestionnaire de recherche
        searchInput.addEventListener('input', () => {
            const searchText = searchInput.value.toLowerCase();
            const filteredChoices = choices.filter(choice => {
                const label = typeof choice === 'object' ? choice.label : choice;
                return label.toLowerCase().includes(searchText);
            });
            this.renderSearchableOptions(optionsContainer, filteredChoices, cell, columnId);
        });

        return dropdown;
    }

    renderSearchableOptions(container, choices, cell, columnId) {
        container.innerHTML = '';
        const columnConfig = this.getColumnConfig(columnId);
        const searchableConfig = columnConfig.searchable || this.defaultSearchableConfig;

        if (!choices.length) {
            const noResults = document.createElement('div');
            noResults.className = 'no-results';
            noResults.textContent = searchableConfig.noResultsText || this.defaultSearchableConfig.noResultsText;
            container.appendChild(noResults);
            return;
        }

        choices.forEach(choice => {
            const value = typeof choice === 'object' ? choice.value : choice;
            const label = typeof choice === 'object' ? choice.label : choice;

            // Ne pas afficher les options en lecture seule
            if (this.isReadOnly(columnId, value)) {
                return;
            }

            const optionElement = document.createElement('div');
            optionElement.className = searchableConfig.optionClass || this.defaultSearchableConfig.optionClass;
            optionElement.innerHTML = label;

            optionElement.addEventListener('click', () => {
                this.updateCellValue(cell, value, label, columnId);
                this.closeAllDropdowns();
            });

            container.appendChild(optionElement);
        });
    }

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

    addSearchableStyles() {
        if (!document.getElementById('choice-plugin-styles')) {
            const style = document.createElement('style');
            style.id = 'choice-plugin-styles';
            style.textContent = `
                .${this.config.cellClass} {
                    cursor: pointer;
                    position: relative;
                }
                .${this.defaultSearchableConfig.dropdownClass} {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    z-index: 1000;
                    display: none;
                    min-width: ${this.defaultSearchableConfig.minWidth};
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 4px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    overflow: auto;
                    max-height: 200px;
                }
                .${this.defaultSearchableConfig.dropdownClass}.active {
                    display: block;
                }
                .${this.defaultSearchableConfig.searchClass} {
                    width: 100%;
                    padding: 8px;
                    border: none;
                    border-bottom: 1px solid #ddd;
                    outline: none;
                    box-sizing: border-box;
                }
                .${this.defaultSearchableConfig.optionClass} {
                    padding: 8px;
                    cursor: pointer;
                }
                .${this.defaultSearchableConfig.optionClass}:hover {
                    background-color: #f5f5f5;
                }
                .no-results {
                    padding: 8px;
                    color: #999;
                    font-style: italic;
                    text-align: center;
                }
            `;
            document.head.appendChild(style);
        }
    }

    setupChoiceCells() {
        if (!this.tableFlow?.table) return;

        const headerCells = this.tableFlow.table.querySelectorAll('th');
        const choiceColumns = Array.from(headerCells)
            .filter(header => header.hasAttribute(this.config.choiceAttribute))
            .map(header => {
                const columnId = header.id;
                const columnConfig = this.getColumnConfig(columnId);
                const headerType = header.getAttribute(this.config.choiceAttribute);

                return {
                    id: columnId,
                    index: Array.from(headerCells).indexOf(header),
                    type: headerType || (columnConfig ? columnConfig.type : 'toggle')
                };
            });

        if (!choiceColumns.length) return;

        const rows = this.tableFlow.table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            choiceColumns.forEach(({ id: columnId, index, type }) => {
                const cell = row.cells[index];
                if (!cell) return;

                if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'choice') {
                    return;
                }

                this.setupChoiceCell(cell, columnId, type);
            });
        });
    }

    setupChoiceCell(cell, columnId, type) {
        cell.classList.add(this.config.cellClass);
        cell.setAttribute('data-plugin', 'choice');
        cell.setAttribute('data-choice-type', type);
        cell.setAttribute('data-choice-column', columnId);  // Nouvelle attribution

        const columnConfig = this.getColumnConfig(columnId);
        if (!columnConfig) return;

        const choices = columnConfig.values;
        if (!choices || !choices.length) return;

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

        // Trouver et afficher la valeur actuelle
        const currentChoice = choices.find(c =>
            (typeof c === 'object' ? c.value : c) === currentValue
        );

        if (currentChoice) {
            const label = typeof currentChoice === 'object' ? currentChoice.label : currentChoice;
            const wrapper = cell.querySelector('.cell-wrapper') || document.createElement('div');
            wrapper.className = 'cell-wrapper';
            wrapper.innerHTML = label;
            if (!wrapper.parentNode) {
                cell.textContent = '';
                cell.appendChild(wrapper);
            }
        }
    }

    setupEventListeners() {
        if (!this.tableFlow?.table) return;

        // Gestionnaire de clic sur les cellules
        this.tableFlow.table.addEventListener('click', this.handleClick);

        // Fermer le dropdown quand on clique ailleurs
        document.addEventListener('click', (event) => {
            if (!event.target.closest(`.${this.config.cellClass}`)) {
                this.closeAllDropdowns();
            }
        });

        // Écouter l'événement cell:saved
        this.tableFlow.table.addEventListener('cell:saved', (event) => {
            const cell = event.detail.cell;
            if (!cell || !this.isManagedCell(cell)) return;

            const currentValue = cell.getAttribute('data-value');
            cell.setAttribute('data-initial-value', currentValue);

            // Mettre à jour le label si nécessaire
            const columnId = cell.getAttribute('data-choice-column') || cell.id.split('_')[0];
            const columnConfig = this.getColumnConfig(columnId);
            if (columnConfig) {
                const currentChoice = columnConfig.values.find(c =>
                    (typeof c === 'object' ? c.value : c) === currentValue
                );
                if (currentChoice) {
                    const label = typeof currentChoice === 'object' ? currentChoice.label : currentChoice;
                    const wrapper = cell.querySelector('.cell-wrapper');
                    if (wrapper) {
                        wrapper.innerHTML = label;
                    }
                }
            }
        });

        // Écouter l'événement row:saved
        this.tableFlow.table.addEventListener('row:saved', (event) => {
            const row = event.detail.row;
            if (!row) return;

            Array.from(row.cells).forEach(cell => {
                if (!this.isManagedCell(cell)) return;

                const currentValue = cell.getAttribute('data-value');
                cell.setAttribute('data-initial-value', currentValue);
            });

            row.classList.remove(this.config.modifiedClass);
        });

        // Écouter l'ajout de nouvelles lignes
        this.tableFlow.table.addEventListener('row:added', () => {
            this.debug('row:added event received');
            this.setupChoiceCells();
        });
    }

    handleClick(event) {
        const cell = event.target.closest('td');
        if (!cell || !this.isManagedCell(cell)) return;

        // Vérifier si la cellule est en lecture seule
        if (cell.classList.contains(this.config.readOnlyClass)) return;

        const type = cell.getAttribute('data-choice-type') || 'toggle';

        if (type === 'toggle') {
            this.handleToggleClick(cell);
        } else if (type === 'searchable') {
            this.handleSearchableClick(cell);
        }
    }

    handleToggleClick(cell) {
        const columnId = cell.getAttribute('data-choice-column') || cell.id.split('_')[0];
        const columnConfig = this.getColumnConfig(columnId);
        if (!columnConfig) return;

        const choices = columnConfig.values;
        if (!choices || !choices.length) return;

        // Filtrer les choix pour exclure ceux en readOnly
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

        // Retirer toutes les classes de lecture seule précédentes
        if (columnConfig.readOnlyValues) {
            columnConfig.readOnlyValues.forEach(config => {
                if (config.class) {
                    cell.classList.remove(config.class);
                }
            });
        }

        this.updateCellValue(cell, nextValue, nextLabel, columnId);
    }

    handleSearchableClick(cell) {
        const columnId = cell.getAttribute('data-choice-column') || cell.id.split('_')[0];
        const columnConfig = this.getColumnConfig(columnId);
        if (!columnConfig) return;

        const choices = columnConfig.values;
        if (!choices || !choices.length) return;

        // Fermer les autres dropdowns
        this.closeAllDropdowns();

        // Créer et afficher le dropdown
        const dropdown = this.createSearchableDropdown(cell, choices, columnId);
        cell.appendChild(dropdown);
        dropdown.classList.add('active');
        this.activeDropdown = dropdown;

        // Focus sur la recherche
        const searchInput = dropdown.querySelector(`.${this.defaultSearchableConfig.searchClass}`);
        if (searchInput) {
            searchInput.focus();
        }
    }

    async updateCellValue(cell, value, label, columnId) {
        try {
            const beforeResult = await this.tableFlow.hooks.trigger('beforeChoiceUpdate', {
                cell,
                value,
                label,
                columnId
            });

            if (beforeResult === false) return;

            const oldValue = cell.dataset.value;
            cell.dataset.value = value;
            cell.textContent = label;

            if (oldValue !== value) {
                cell.classList.add(this.config.modifiedClass);
                this.tableFlow.emit('choice:updated', {
                    cell,
                    oldValue,
                    newValue: value,
                    columnId
                });
            }

            await this.tableFlow.hooks.trigger('afterChoiceUpdate', {
                cell,
                value,
                label,
                columnId
            });

            this.metrics.increment('choice_updated');
        } catch (error) {
            this.errorHandler.handle(error, 'choice_update');
            this.logger.error('Erreur lors de la mise à jour de la cellule:', error);
        }
    }

    closeAllDropdowns() {
        if (this.activeDropdown) {
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }
    }

    isManagedCell(cell) {
        return cell?.classList.contains(this.config.cellClass);
    }

    refresh() {
        if (!this.isInitialized) {
            this.logger.warn('Plugin Choice non initialisé');
            return;
        }
        this.setupChoiceCells();
    }

    destroy() {
        if (!this.isInitialized) return;

        try {
            // Supprimer les écouteurs d'événements
            document.removeEventListener('click', this.handleClick);
            
            // Fermer tous les menus déroulants
            this.closeAllDropdowns();
            
            // Supprimer les styles
            const styleElement = document.getElementById('choice-plugin-styles');
            if (styleElement) {
                styleElement.remove();
            }
            
            this.isInitialized = false;
            this.logger.info('Plugin Choice détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'choice_destroy');
        } finally {
            super.destroy();
        }
    }
}