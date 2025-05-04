import { config } from './config.js';

export default class SearchPlugin {
    constructor(options = {}) {
        this.name = config.name;
        this.version = config.version;
        this.dependencies = config.dependencies;
        this.config = { ...config.options, ...options };
        this.table = null;
        this.container = null;
        this.input = null;
        this.results = null;
        this.currentResults = [];
        this.activeResult = null;
        this.searchTimeout = null;
        
        // Lier les méthodes
        this._boundInputHandler = this.handleInput.bind(this);
        this._boundKeyDownHandler = this.handleKeyDown.bind(this);
        this._boundClickHandler = this.handleClick.bind(this);
    }
    
    async init(table) {
        if (!table) {
            throw new Error('Instance de TableFlow requise');
        }
        
        this.table = table;
        
        // Créer l'interface
        this.createInterface();
        
        // Ajouter les écouteurs d'événements
        this.setupEventListeners();
    }
    
    createInterface() {
        // Créer le conteneur
        this.container = document.createElement('div');
        this.container.className = this.config.searchClass;
        
        // Créer l'input
        this.input = document.createElement('input');
        this.input.className = this.config.inputClass;
        this.input.type = 'text';
        this.input.placeholder = 'Rechercher...';
        this.input.setAttribute('aria-label', 'Rechercher dans le tableau');
        
        // Créer le conteneur des résultats
        this.results = document.createElement('div');
        this.results.className = this.config.resultsClass;
        this.results.setAttribute('role', 'listbox');
        
        // Assembler l'interface
        this.container.appendChild(this.input);
        this.container.appendChild(this.results);
        
        // Ajouter au DOM
        this.table.table.parentNode.insertBefore(this.container, this.table.table);
    }
    
    setupEventListeners() {
        // Événements de l'input
        this.input.addEventListener('input', this._boundInputHandler);
        this.input.addEventListener('keydown', this._boundKeyDownHandler);
        
        // Événements des résultats
        this.results.addEventListener('click', this._boundClickHandler);
    }
    
    handleInput(event) {
        const query = event.target.value.trim();
        
        // Effacer le timeout précédent
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
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
        const beforeSearchResult = this.table.hooks.trigger('beforeSearch', {
            query,
            event
        });
        
        if (beforeSearchResult === false) return;
        
        // Afficher le message de recherche
        this.showMessage(this.config.search.messages.searching);
        
        // Débouncer la recherche
        this.searchTimeout = setTimeout(() => {
            this.search(query);
        }, this.config.search.debounce);
    }
    
    async search(query) {
        try {
            // Rechercher dans le tableau
            const results = await this.searchInTable(query);
            
            // Limiter le nombre de résultats
            if (results.length > this.config.search.maxResults) {
                results.length = this.config.search.maxResults;
            }
            
            // Mettre à jour les résultats
            this.currentResults = results;
            this.renderResults();
            
            // Déclencher le hook afterSearch
            this.table.hooks.trigger('afterSearch', {
                query,
                results
            });
        } catch (error) {
            console.error('Erreur lors de la recherche:', error);
            this.showMessage('Une erreur est survenue');
        }
    }
    
    async searchInTable(query) {
        const results = [];
        const regex = this.createSearchRegex(query);
        
        // Parcourir les cellules du tableau
        const cells = this.table.table.querySelectorAll('td');
        for (const cell of cells) {
            const text = cell.textContent;
            const matches = text.match(regex);
            
            if (matches) {
                results.push({
                    cell,
                    text,
                    matches
                });
            }
        }
        
        return results;
    }
    
    createSearchRegex(query) {
        let pattern = query;
        
        if (!this.config.search.regex) {
            pattern = this.escapeRegex(query);
        }
        
        if (this.config.search.wholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        
        return new RegExp(pattern, this.config.search.caseSensitive ? 'g' : 'gi');
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    renderResults() {
        // Vider les résultats
        this.results.innerHTML = '';
        
        if (this.currentResults.length === 0) {
            this.showMessage(this.config.search.messages.noResults);
            return;
        }
        
        // Rendre chaque résultat
        this.currentResults.forEach((result, index) => {
            const element = document.createElement('div');
            element.className = `${this.config.resultsClass}-item`;
            element.setAttribute('role', 'option');
            element.setAttribute('aria-selected', 'false');
            element.setAttribute('data-index', index);
            
            // Mettre en surbrillance les correspondances
            let text = result.text;
            if (this.config.search.highlight) {
                text = text.replace(this.createSearchRegex(this.input.value), match => {
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
        this.currentResults = [];
        this.activeResult = null;
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
                if (this.activeResult) {
                    this.selectResult(this.activeResult);
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
        
        let index = this.activeResult ? parseInt(this.activeResult.dataset.index) : -1;
        
        if (direction === 'next') {
            index = index + 1 >= items.length ? 0 : index + 1;
        } else {
            index = index - 1 < 0 ? items.length - 1 : index - 1;
        }
        
        this.setActiveResult(items[index]);
    }
    
    setActiveResult(result) {
        // Retirer la classe active de l'ancien résultat
        if (this.activeResult) {
            this.activeResult.classList.remove(this.config.activeClass);
            this.activeResult.setAttribute('aria-selected', 'false');
        }
        
        // Définir le nouveau résultat actif
        this.activeResult = result;
        
        if (this.activeResult) {
            this.activeResult.classList.add(this.config.activeClass);
            this.activeResult.setAttribute('aria-selected', 'true');
            this.activeResult.scrollIntoView({ block: 'nearest' });
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
        const data = this.currentResults[index];
        
        // Déclencher le hook beforeSelect
        const beforeSelectResult = this.table.hooks.trigger('beforeSelect', {
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
            this.table.hooks.trigger('afterSelect', {
                result: data,
                index
            });
            
            // Fermer les résultats
            this.hideResults();
        } catch (error) {
            console.error('Erreur lors de la sélection:', error);
        }
    }
    
    destroy() {
        // Nettoyer les événements
        this.input.removeEventListener('input', this._boundInputHandler);
        this.input.removeEventListener('keydown', this._boundKeyDownHandler);
        this.results.removeEventListener('click', this._boundClickHandler);
        
        // Supprimer l'interface
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // Réinitialiser l'état
        this.container = null;
        this.input = null;
        this.results = null;
        this.currentResults = [];
        this.activeResult = null;
        this.searchTimeout = null;
    }
} 