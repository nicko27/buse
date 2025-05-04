/**
 * HidePlugin pour TableFlow
 * Permet de masquer/afficher des colonnes du tableau
 * Version: 1.0.0
 */
import { config } from './config.js';

export class HidePlugin {
    constructor(tableFlow) {
        this.tableFlow = tableFlow;
        this.name = config.name;
        this.version = config.version;
        this.type = config.type;
        this.dependencies = config.dependencies;
        this.config = config;
        
        this.hiddenColumns = new Set();
        this.menu = null;
        this.button = null;
        this.isMenuOpen = false;
    }

    init() {
        if (!this.tableFlow) {
            throw new Error('TableFlow instance is required');
        }

        this.createButton();
        this.createMenu();
        this.setupEventListeners();
        this.loadState();
    }

    createButton() {
        this.button = document.createElement('button');
        this.button.className = this.config.options.buttonClass;
        this.button.innerHTML = `
            ${this.config.options.interface.buttonIcon}
            <span>${this.config.options.interface.buttonText}</span>
        `;
        
        // Attributs d'accessibilité
        this.button.setAttribute('aria-label', this.config.options.interface.buttonText);
        this.button.setAttribute('aria-haspopup', 'true');
        this.button.setAttribute('aria-expanded', 'false');
        
        // Placement du bouton
        if (this.config.options.interface.buttonPosition === 'toolbar') {
            this.tableFlow.toolbar.appendChild(this.button);
        } else {
            this.tableFlow.header.appendChild(this.button);
        }
    }

    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = this.config.options.menuClass;
        this.menu.setAttribute('role', 'menu');
        this.menu.style.display = 'none';
        
        // Titre du menu
        const title = document.createElement('div');
        title.className = 'tableflow-hide-menu-title';
        title.textContent = this.config.options.menu.messages.title;
        this.menu.appendChild(title);
        
        // Option "Tout afficher/masquer"
        if (this.config.options.menu.showLabels) {
            const toggleAll = this.createMenuItem('all', this.config.options.menu.messages.toggleAll);
            this.menu.appendChild(toggleAll);
        }
        
        // Liste des colonnes
        const columns = this.tableFlow.getHeaders();
        columns.forEach(column => {
            const columnId = this.getColumnId(column);
            const label = column.textContent.trim();
            const item = this.createMenuItem(columnId, label);
            this.menu.appendChild(item);
        });
        
        // Compteur
        if (this.config.options.menu.showCounter) {
            const counter = document.createElement('div');
            counter.className = 'tableflow-hide-counter';
            this.menu.appendChild(counter);
            this.updateCounter();
        }
        
        document.body.appendChild(this.menu);
    }

    createMenuItem(id, label) {
        const item = document.createElement('div');
        item.className = this.config.options.menuItemClass;
        item.setAttribute('role', 'menuitem');
        item.setAttribute('data-column-id', id);
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !this.hiddenColumns.has(id);
        checkbox.setAttribute('aria-label', label);
        
        const text = document.createElement('span');
        text.textContent = label;
        
        item.appendChild(checkbox);
        item.appendChild(text);
        
        return item;
    }

    setupEventListeners() {
        // Événements du bouton
        this.button.addEventListener('click', this.toggleMenu.bind(this));
        
        // Événements du menu
        const items = this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`);
        items.forEach(item => {
            item.addEventListener('click', this.handleItemClick.bind(this));
            item.addEventListener('keydown', this.handleItemKeyDown.bind(this));
        });
        
        // Fermeture du menu au clic extérieur
        if (this.config.options.interface.closeOnClickOutside) {
            document.addEventListener('click', this.handleClickOutside.bind(this));
        }
        
        // Événements clavier
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
    }

    toggleMenu(e) {
        e.stopPropagation();
        
        if (this.isMenuOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        const buttonRect = this.button.getBoundingClientRect();
        
        this.menu.style.display = 'block';
        this.menu.style.top = `${buttonRect.bottom + 5}px`;
        
        if (this.config.options.menu.position === 'right') {
            this.menu.style.right = '0';
        } else {
            this.menu.style.left = `${buttonRect.left}px`;
        }
        
        this.isMenuOpen = true;
        this.button.setAttribute('aria-expanded', 'true');
        this.updateCounter();
    }

    closeMenu() {
        this.menu.style.display = 'none';
        this.isMenuOpen = false;
        this.button.setAttribute('aria-expanded', 'false');
    }

    handleItemClick(e) {
        const item = e.currentTarget;
        const columnId = item.getAttribute('data-column-id');
        const checkbox = item.querySelector('input[type="checkbox"]');
        
        if (columnId === 'all') {
            this.toggleAllColumns(checkbox.checked);
        } else {
            this.toggleColumn(columnId, checkbox.checked);
        }
        
        if (this.config.options.interface.closeOnSelect) {
            this.closeMenu();
        }
        
        this.updateCounter();
        this.saveState();
    }

    toggleColumn(columnId, show) {
        const column = this.getColumnById(columnId);
        if (!column) return;
        
        if (show) {
            // Afficher la colonne
            if (typeof this.config.options.hooks.beforeShow === 'function') {
                this.config.options.hooks.beforeShow(column);
            }
            
            this.hiddenColumns.delete(columnId);
            column.classList.remove(this.config.options.hiddenClass);
            
            if (typeof this.config.options.hooks.afterShow === 'function') {
                this.config.options.hooks.afterShow(column);
            }
        } else {
            // Masquer la colonne
            if (typeof this.config.options.hooks.beforeHide === 'function') {
                this.config.options.hooks.beforeHide(column);
            }
            
            this.hiddenColumns.add(columnId);
            column.classList.add(this.config.options.hiddenClass);
            
            if (typeof this.config.options.hooks.afterHide === 'function') {
                this.config.options.hooks.afterHide(column);
            }
        }
    }

    toggleAllColumns(show) {
        const columns = this.tableFlow.getHeaders();
        columns.forEach(column => {
            const columnId = this.getColumnId(column);
            this.toggleColumn(columnId, show);
        });
        
        // Mettre à jour les checkboxes
        const items = this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`);
        items.forEach(item => {
            const checkbox = item.querySelector('input[type="checkbox"]');
            checkbox.checked = show;
        });
    }

    handleItemKeyDown(e) {
        const item = e.currentTarget;
        
        switch (e.key) {
            case ' ':
            case 'Enter':
                e.preventDefault();
                item.click();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.focusPreviousItem(item);
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                this.focusNextItem(item);
                break;
                
            case 'Home':
                e.preventDefault();
                this.focusFirstItem();
                break;
                
            case 'End':
                e.preventDefault();
                this.focusLastItem();
                break;
        }
    }

    handleKeyDown(e) {
        if (e.key === 'Escape' && this.isMenuOpen) {
            e.preventDefault();
            this.closeMenu();
        }
    }

    handleClickOutside(e) {
        if (this.isMenuOpen && 
            !this.menu.contains(e.target) && 
            !this.button.contains(e.target)) {
            this.closeMenu();
        }
    }

    focusPreviousItem(currentItem) {
        const items = Array.from(this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`));
        const currentIndex = items.indexOf(currentItem);
        const previousItem = items[currentIndex - 1] || items[items.length - 1];
        previousItem.focus();
    }

    focusNextItem(currentItem) {
        const items = Array.from(this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`));
        const currentIndex = items.indexOf(currentItem);
        const nextItem = items[currentIndex + 1] || items[0];
        nextItem.focus();
    }

    focusFirstItem() {
        const firstItem = this.menu.querySelector(`.${this.config.options.menuItemClass}`);
        if (firstItem) firstItem.focus();
    }

    focusLastItem() {
        const items = this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`);
        const lastItem = items[items.length - 1];
        if (lastItem) lastItem.focus();
    }

    getColumnId(column) {
        return column.getAttribute('data-column-id') || 
               column.getAttribute('data-field') || 
               column.textContent.trim();
    }

    getColumnById(id) {
        const headers = this.tableFlow.getHeaders();
        return Array.from(headers).find(header => this.getColumnId(header) === id);
    }

    updateCounter() {
        if (!this.config.options.menu.showCounter) return;
        
        const counter = this.menu.querySelector('.tableflow-hide-counter');
        const total = this.tableFlow.getHeaders().length;
        const visible = total - this.hiddenColumns.size;
        
        counter.textContent = this.config.options.menu.messages.counter
            .replace('{visible}', visible)
            .replace('{total}', total);
    }

    saveState() {
        if (!this.config.options.storage.enabled) return;
        
        const state = Array.from(this.hiddenColumns);
        
        if (typeof this.config.options.hooks.beforeStateUpdate === 'function') {
            this.config.options.hooks.beforeStateUpdate(state);
        }
        
        const storage = this.config.options.storage.type === 'sessionStorage' 
            ? sessionStorage 
            : localStorage;
            
        storage.setItem(this.config.options.storage.key, JSON.stringify(state));
        
        if (typeof this.config.options.hooks.afterStateUpdate === 'function') {
            this.config.options.hooks.afterStateUpdate(state);
        }
    }

    loadState() {
        if (!this.config.options.storage.enabled) return;
        
        const storage = this.config.options.storage.type === 'sessionStorage' 
            ? sessionStorage 
            : localStorage;
            
        const state = storage.getItem(this.config.options.storage.key);
        
        if (state) {
            const hiddenColumns = JSON.parse(state);
            hiddenColumns.forEach(columnId => {
                this.toggleColumn(columnId, false);
                
                // Mettre à jour la checkbox
                const item = this.menu.querySelector(`[data-column-id="${columnId}"]`);
                if (item) {
                    const checkbox = item.querySelector('input[type="checkbox"]');
                    checkbox.checked = false;
                }
            });
            
            this.updateCounter();
        }
    }

    destroy() {
        // Supprimer le bouton
        if (this.button && this.button.parentNode) {
            this.button.parentNode.removeChild(this.button);
        }
        
        // Supprimer le menu
        if (this.menu && this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu);
        }
        
        // Supprimer les classes des colonnes masquées
        this.hiddenColumns.forEach(columnId => {
            const column = this.getColumnById(columnId);
            if (column) {
                column.classList.remove(this.config.options.hiddenClass);
            }
        });
        
        // Supprimer les événements
        document.removeEventListener('click', this.handleClickOutside.bind(this));
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
    }
}
