import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class SearchPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.SEARCH;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        // État local
        this.state = {
            query: '',
            results: [],
            activeResult: null,
            isSearching: false
        };
        
        // Cache pour les performances
        this.cache = {
            searchTimeout: null,
            lastSearchTime: 0,
            regexCache: new Map()
        };
        
        // Lier les méthodes
        this._boundInputHandler = this.handleInput.bind(this);
        this._boundKeyDownHandler = this.handleKeyDown.bind(this);
        this._boundClickHandler = this.handleClick.bind(this);
    }
    
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Search déjà initialisé');
            return;
        }

        try {
            this.logger.info('Initialisation du plugin Search');
            
            // Créer l'interface
            await this.createInterface();
            
            // Ajouter les écouteurs d'événements
            this.setupEventListeners();
            
            this.isInitialized = true;
            this.metrics.increment('plugin_search_init');
        } catch (error) {
            this.errorHandler.handle(error, 'search_init');
            throw error;
        }
    }
    
    async createInterface() {
        try {
            // Créer le conteneur
            this.container = document.createElement('div');
            this.container.className = this.config.searchClass;
            this.container.setAttribute('role', 'search');
            
            // Créer l'input
            this.input = document.createElement('input');
            this.input.className = this.config.inputClass;
            this.input.type = 'text';
            this.input.placeholder = this.config.search.placeholder;
            this.input.setAttribute('aria-label', this.config.search.ariaLabel);
            this.input.setAttribute('aria-controls', 'search-results');
            this.input.setAttribute('aria-expanded', 'false');
            this.input.setAttribute('aria-autocomplete', 'list');
            
            // Créer le conteneur des résultats
            this.results = document.createElement('div');
            this.results.id = 'search-results';
            this.results.className = this.config.resultsClass;
            this.results.setAttribute('role', 'listbox');
            this.results.setAttribute('aria-label', this.config.search.resultsLabel);
            
            // Assembler l'interface
            this.container.appendChild(this.input);
            this.container.appendChild(this.results);
            
            // Ajouter au DOM
            this.tableFlow.container.insertBefore(this.container, this.tableFlow.table);
            
            this.metrics.increment('search_interface_created');
        } catch (error) {
            this.errorHandler.handle(error, 'search_create_interface');
            throw error;
        }
    }
    
    setupEventListeners() {
        try {
            // Événements de l'input
            this.input.addEventListener('input', this._boundInputHandler);
            this.input.addEventListener('keydown', this._boundKeyDownHandler);
            this.input.addEventListener('focus', () => {
                if (this.state.results.length > 0) {
                    this.results.classList.add('active');
                }
            });
            this.input.addEventListener('blur', () => {
                setTimeout(() => this.hideResults(), 200);
            });
            
            // Événements des résultats
            this.results.addEventListener('click', this._boundClickHandler);
            
            this.metrics.increment('search_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'search_setup_listeners');
        }
    }
    
    async handleInput(event) {
        if (!this.isInitialized) return;

        try {
            const query = event.target.value.trim();
            this.state.query = query;
            
            // Effacer le timeout précédent
            if (this.cache.searchTimeout) {
                clearTimeout(this.cache.searchTimeout);
            }
            
            // Vérifier la longueur minimale
            if (query.length < this.config.search.minLength) {
                if (query.length > 0) {
                    this.showMessage(this.config.search.messages.tooShort.replace('{minLength}', this.config.search.minLength));
                } else {
                    this.hideResults();
                }
                return;
            }
            
            // Déclencher le hook beforeSearch
            const beforeResult = await this.tableFlow.hooks.trigger('beforeSearch', {
                query,
                event
            });
            
            if (beforeResult === false) return;
            
            // Afficher le message de recherche
            this.showMessage(this.config.search.messages.searching);
            
            // Débouncer la recherche
            this.cache.searchTimeout = setTimeout(async () => {
                await this.search(query);
            }, this.config.search.debounce);
            
            this.metrics.increment('search_input_handled');
        } catch (error) {
            this.errorHandler.handle(error, 'search_handle_input');
        }
    }
    
    async search(query) {
        if (!this.isInitialized) return;

        try {
            this.state.isSearching = true;
            const startTime = performance.now();
            
            // Rechercher dans le tableau
            const results = await this.searchInTable(query);
            
            // Limiter le nombre de résultats
            if (results.length > this.config.search.maxResults) {
                results.length = this.config.search.maxResults;
            }
            
            // Mettre à jour les résultats
            this.state.results = results;
            await this.renderResults();
            
            // Déclencher le hook afterSearch
            await this.tableFlow.hooks.trigger('afterSearch', {
                query,
                results,
                performance: {
                    duration: performance.now() - startTime,
                    count: results.length
                }
            });
            
            this.metrics.increment('search_completed');
            this.metrics.record('search_duration', performance.now() - startTime);
        } catch (error) {
            this.errorHandler.handle(error, 'search_execute');
            this.showMessage(this.config.search.messages.error);
        } finally {
            this.state.isSearching = false;
        }
    }
    
    async searchInTable(query) {
        try {
            const results = [];
            const regex = this.getCachedRegex(query);
            
            // Parcourir les cellules du tableau
            const cells = this.tableFlow.table.querySelectorAll('td');
            for (const cell of cells) {
                const text = cell.textContent;
                const matches = text.match(regex);
                
                if (matches) {
                    results.push({
                        cell,
                        text,
                        matches,
                        row: cell.closest('tr'),
                        column: cell.cellIndex
                    });
                }
            }
            
            return results;
        } catch (error) {
            this.errorHandler.handle(error, 'search_in_table');
            return [];
        }
    }
    
    getCachedRegex(query) {
        if (this.cache.regexCache.has(query)) {
            return this.cache.regexCache.get(query);
        }
        
        let pattern = query;
        if (!this.config.search.regex) {
            pattern = this.escapeRegex(query);
        }
        
        if (this.config.search.wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        
        const regex = new RegExp(pattern, this.config.search.caseSensitive ? 'g' : 'gi');
        this.cache.regexCache.set(query, regex);
        
        return regex;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    renderResults() {
        // Vider les résultats
        this.results.innerHTML = '';
        
        if (this.state.results.length === 0) {
            this.showMessage(this.config.search.messages.noResults);
            return;
        }
        
        // Rendre chaque résultat
        this.state.results.forEach((result, index) => {
            const element = document.createElement('div');
            element.className = `${this.config.resultsClass}-item`;
            element.setAttribute('role', 'option');
            element.setAttribute('aria-selected', 'false');
            element.setAttribute('data-index', index);
            
            // Mettre en surbrillance les correspondances
            let text = result.text;
            if (this.config.search.highlight) {
                text = text.replace(this.getCachedRegex(this.state.query), match => {
                    return `<span class="${this.config.highlightClass}">${match}</span>`;
                });
            }
            
            element.innerHTML = text;
            this.results.appendChild(element);
        });
        
        // Afficher les résultats
        this.results.classList.add('active');
    }
    
    showMessage(message) {
        this.results.innerHTML = `<div class="${this.config.resultsClass}-message">${message}</div>`;
        this.results.classList.add('active');
    }
    
    hideResults() {
        this.results.classList.remove('active');
        this.state.results = [];
        this.state.activeResult = null;
    }
    
    handleKeyDown(event) {
        if (!this.results.classList.contains('active')) return;
        
        switch (event.key) {
            case 'ArrowDown':
                event.preventDefault();
                this.navigateResults('next');
                break;
                
            case 'ArrowUp':
                event.preventDefault();
                this.navigateResults('prev');
                break;
                
            case 'Enter':
                event.preventDefault();
                if (this.state.activeResult) {
                    this.selectResult(this.state.activeResult);
                }
                break;
                
            case 'Escape':
                event.preventDefault();
                this.hideResults();
                break;
        }
    }
    
    navigateResults(direction) {
        const items = this.results.querySelectorAll(`.${this.config.resultsClass}-item`);
        if (items.length === 0) return;
        
        let index = this.state.activeResult ? parseInt(this.state.activeResult.dataset.index) : -1;
        
        if (direction === 'next') {
            index = index + 1 >= items.length ? 0 : index + 1;
        } else {
            index = index - 1 < 0 ? items.length - 1 : index - 1;
        }
        
        this.setActiveResult(items[index]);
    }
    
    setActiveResult(result) {
        // Retirer la classe active de l'ancien résultat
        if (this.state.activeResult) {
            this.state.activeResult.classList.remove(this.config.activeClass);
            this.state.activeResult.setAttribute('aria-selected', 'false');
        }
        
        // Définir le nouveau résultat actif
        this.state.activeResult = result;
        
        if (this.state.activeResult) {
            this.state.activeResult.classList.add(this.config.activeClass);
            this.state.activeResult.setAttribute('aria-selected', 'true');
            this.state.activeResult.scrollIntoView({ block: 'nearest' });
        }
    }
    
    handleClick(event) {
        const result = event.target.closest(`.${this.config.resultsClass}-item`);
        if (result) {
            this.selectResult(result);
        }
    }
    
    async selectResult(result) {
        const index = parseInt(result.dataset.index);
        const data = this.state.results[index];
        
        // Déclencher le hook beforeSelect
        const beforeSelectResult = await this.tableFlow.hooks.trigger('beforeSelect', {
            result: data,
            index
        });
        
        if (beforeSelectResult === false) return;
        
        try {
            // Faire défiler jusqu'à la cellule
            data.cell.scrollIntoView({ block: 'center' });
            
            // Mettre en surbrillance la cellule
            data.cell.classList.add(this.config.highlightClass);
            setTimeout(() => {
                data.cell.classList.remove(this.config.highlightClass);
            }, 1000);
            
            // Déclencher le hook afterSelect
            await this.tableFlow.hooks.trigger('afterSelect', {
                result: data,
                index
            });
            
            // Fermer les résultats
            this.hideResults();
        } catch (error) {
            console.error('Erreur lors de la sélection:', error);
        }
    }
    
    async destroy() {
        if (!this.isInitialized) return;

        try {
            if (this.container) {
                this.container.remove();
            }
            
            if (this.cache.searchTimeout) {
                clearTimeout(this.cache.searchTimeout);
            }
            
            this.cache.regexCache.clear();
            this.state = {
                query: '',
                results: [],
                activeResult: null,
                isSearching: false
            };
            
            this.isInitialized = false;
            this.logger.info('Plugin Search détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'search_destroy');
        } finally {
            super.destroy();
        }
    }
} 