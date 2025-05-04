/**
 * HidePlugin pour TableFlow
 * Permet de masquer/afficher des colonnes du tableau
 * Version: 1.0.0
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class HidePlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.HIDE;
        this.dependencies = config.dependencies;
        this.isInitialized = false;

        this.hiddenColumns = new Set();
        this.menu = null;
        this.button = null;
        this.isMenuOpen = false;
    }

    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Hide déjà initialisé');
            return;
        }

        try {
            if (!this.tableFlow) {
                throw new Error('Instance de TableFlow requise');
            }

            this.createButton();
            this.createMenu();
            this.setupEventListeners();
            this.loadState();
            this.isInitialized = true;
            this.logger.info('Plugin Hide initialisé avec succès');
            this.metrics.increment('plugin_hide_init');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_init');
            throw error;
        }
    }

    createButton() {
        try {
            this.button = document.createElement('button');
            this.button.className = this.config.options.buttonClass;
            this.button.innerHTML = `
                ${this.config.options.interface.buttonIcon}
                <span>${this.config.options.interface.buttonText}</span>
            `;
            
            this.button.setAttribute('aria-label', this.config.options.interface.buttonText);
            this.button.setAttribute('aria-haspopup', 'true');
            this.button.setAttribute('aria-expanded', 'false');
            this.button.setAttribute('role', 'button');
            
            if (this.config.options.interface.buttonPosition === 'toolbar') {
                this.tableFlow.toolbar.appendChild(this.button);
            } else {
                this.tableFlow.header.appendChild(this.button);
            }

            this.metrics.increment('hide_button_created');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_create_button');
            this.logger.error('Erreur lors de la création du bouton:', error);
        }
    }

    createMenu() {
        try {
            this.menu = document.createElement('div');
            this.menu.className = this.config.options.menuClass;
            this.menu.setAttribute('role', 'menu');
            this.menu.setAttribute('aria-label', this.config.options.menu.messages.title);
            this.menu.style.display = 'none';
            
            const title = document.createElement('div');
            title.className = 'tableflow-hide-menu-title';
            title.textContent = this.config.options.menu.messages.title;
            this.menu.appendChild(title);
            
            if (this.config.options.menu.showLabels) {
                const toggleAll = this.createMenuItem('all', this.config.options.menu.messages.toggleAll);
                this.menu.appendChild(toggleAll);
            }
            
            const columns = this.tableFlow.getHeaders();
            columns.forEach(column => {
                const columnId = this.getColumnId(column);
                const label = column.textContent.trim();
                const item = this.createMenuItem(columnId, label);
                this.menu.appendChild(item);
            });
            
            if (this.config.options.menu.showCounter) {
                const counter = document.createElement('div');
                counter.className = 'tableflow-hide-counter';
                counter.setAttribute('role', 'status');
                counter.setAttribute('aria-live', 'polite');
                this.menu.appendChild(counter);
                this.updateCounter();
            }
            
            document.body.appendChild(this.menu);
            this.metrics.increment('hide_menu_created');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_create_menu');
            this.logger.error('Erreur lors de la création du menu:', error);
        }
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
        checkbox.setAttribute('role', 'checkbox');
        
        const text = document.createElement('span');
        text.textContent = label;
        
        item.appendChild(checkbox);
        item.appendChild(text);
        
        return item;
    }

    setupEventListeners() {
        try {
            this.button.addEventListener('click', this.toggleMenu.bind(this));
            
            const items = this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`);
            items.forEach(item => {
                item.addEventListener('click', this.handleItemClick.bind(this));
                item.addEventListener('keydown', this.handleItemKeyDown.bind(this));
            });
            
            if (this.config.options.interface.closeOnClickOutside) {
                document.addEventListener('click', this.handleClickOutside.bind(this));
            }
            
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            this.metrics.increment('hide_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_setup_listeners');
            this.logger.error('Erreur lors de la configuration des écouteurs d\'événements:', error);
        }
    }

    toggleMenu(e) {
        try {
            e.stopPropagation();
            
            if (this.isMenuOpen) {
                this.closeMenu();
            } else {
                this.openMenu();
            }
            this.metrics.increment('hide_menu_toggled');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_toggle_menu');
            this.logger.error('Erreur lors du basculement du menu:', error);
        }
    }

    openMenu() {
        try {
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
            this.metrics.increment('hide_menu_opened');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_open_menu');
            this.logger.error('Erreur lors de l\'ouverture du menu:', error);
        }
    }

    closeMenu() {
        try {
            this.menu.style.display = 'none';
            this.isMenuOpen = false;
            this.button.setAttribute('aria-expanded', 'false');
            this.metrics.increment('hide_menu_closed');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_close_menu');
            this.logger.error('Erreur lors de la fermeture du menu:', error);
        }
    }

    async handleItemClick(e) {
        try {
            const item = e.currentTarget;
            const columnId = item.getAttribute('data-column-id');
            const checkbox = item.querySelector('input[type="checkbox"]');
            
            if (columnId === 'all') {
                await this.toggleAllColumns(checkbox.checked);
            } else {
                await this.toggleColumn(columnId, checkbox.checked);
            }
            
            if (this.config.options.interface.closeOnSelect) {
                this.closeMenu();
            }
            
            this.updateCounter();
            this.saveState();
            this.metrics.increment('hide_item_clicked');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_handle_item_click');
            this.logger.error('Erreur lors du clic sur un élément du menu:', error);
        }
    }

    async toggleColumn(columnId, show) {
        try {
            const column = this.getColumnById(columnId);
            if (!column) return;
            
            const beforeResult = await this.tableFlow.hooks.trigger(show ? 'beforeShowColumn' : 'beforeHideColumn', {
                columnId,
                column
            });

            if (beforeResult === false) return;
            
            if (show) {
                this.hiddenColumns.delete(columnId);
                column.classList.remove(this.config.options.hiddenClass);
            } else {
                this.hiddenColumns.add(columnId);
                column.classList.add(this.config.options.hiddenClass);
            }
            
            await this.tableFlow.hooks.trigger(show ? 'afterShowColumn' : 'afterHideColumn', {
                columnId,
                column
            });

            this.tableFlow.emit(show ? 'column:shown' : 'column:hidden', {
                columnId,
                column
            });

            this.metrics.increment(show ? 'column_shown' : 'column_hidden');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_toggle_column');
            this.logger.error('Erreur lors du basculement de la colonne:', error);
        }
    }

    async toggleAllColumns(show) {
        try {
            const columns = this.tableFlow.getHeaders();
            for (const column of columns) {
                const columnId = this.getColumnId(column);
                await this.toggleColumn(columnId, show);
            }
            
            const items = this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`);
            items.forEach(item => {
                const checkbox = item.querySelector('input[type="checkbox"]');
                checkbox.checked = show;
            });

            this.metrics.increment(show ? 'all_columns_shown' : 'all_columns_hidden');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_toggle_all_columns');
            this.logger.error('Erreur lors du basculement de toutes les colonnes:', error);
        }
    }

    handleItemKeyDown(e) {
        try {
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
            }
        } catch (error) {
            this.errorHandler.handle(error, 'hide_handle_item_keydown');
            this.logger.error('Erreur lors de la gestion des touches:', error);
        }
    }

    handleKeyDown(e) {
        try {
            if (e.key === 'Escape' && this.isMenuOpen) {
                this.closeMenu();
            }
        } catch (error) {
            this.errorHandler.handle(error, 'hide_handle_keydown');
            this.logger.error('Erreur lors de la gestion des touches:', error);
        }
    }

    handleClickOutside(e) {
        try {
            if (!this.menu.contains(e.target) && !this.button.contains(e.target)) {
                this.closeMenu();
            }
        } catch (error) {
            this.errorHandler.handle(error, 'hide_handle_click_outside');
            this.logger.error('Erreur lors de la gestion du clic extérieur:', error);
        }
    }

    focusPreviousItem(currentItem) {
        try {
            const items = Array.from(this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`));
            const currentIndex = items.indexOf(currentItem);
            const previousIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            items[previousIndex].focus();
        } catch (error) {
            this.errorHandler.handle(error, 'hide_focus_previous_item');
            this.logger.error('Erreur lors du focus sur l\'élément précédent:', error);
        }
    }

    focusNextItem(currentItem) {
        try {
            const items = Array.from(this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`));
            const currentIndex = items.indexOf(currentItem);
            const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            items[nextIndex].focus();
        } catch (error) {
            this.errorHandler.handle(error, 'hide_focus_next_item');
            this.logger.error('Erreur lors du focus sur l\'élément suivant:', error);
        }
    }

    focusFirstItem() {
        try {
            const firstItem = this.menu.querySelector(`.${this.config.options.menuItemClass}`);
            if (firstItem) firstItem.focus();
        } catch (error) {
            this.errorHandler.handle(error, 'hide_focus_first_item');
            this.logger.error('Erreur lors du focus sur le premier élément:', error);
        }
    }

    focusLastItem() {
        try {
            const items = this.menu.querySelectorAll(`.${this.config.options.menuItemClass}`);
            if (items.length > 0) items[items.length - 1].focus();
        } catch (error) {
            this.errorHandler.handle(error, 'hide_focus_last_item');
            this.logger.error('Erreur lors du focus sur le dernier élément:', error);
        }
    }

    getColumnId(column) {
        return column.getAttribute('data-column-id') || column.cellIndex.toString();
    }

    getColumnById(id) {
        return this.tableFlow.table.querySelector(`[data-column-id="${id}"]`);
    }

    updateCounter() {
        try {
            if (!this.config.options.menu.showCounter) return;
            
            const counter = this.menu.querySelector('.tableflow-hide-counter');
            const hiddenCount = this.hiddenColumns.size;
            const totalCount = this.tableFlow.getHeaders().length;
            
            counter.textContent = `${hiddenCount}/${totalCount} colonnes masquées`;
            counter.setAttribute('aria-label', `${hiddenCount} colonnes masquées sur ${totalCount}`);
        } catch (error) {
            this.errorHandler.handle(error, 'hide_update_counter');
            this.logger.error('Erreur lors de la mise à jour du compteur:', error);
        }
    }

    saveState() {
        try {
            const state = {
                hiddenColumns: Array.from(this.hiddenColumns)
            };
            localStorage.setItem(`tableflow-hide-${this.tableFlow.id}`, JSON.stringify(state));
            this.metrics.increment('hide_state_saved');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_save_state');
            this.logger.error('Erreur lors de la sauvegarde de l\'état:', error);
        }
    }

    loadState() {
        try {
            const savedState = localStorage.getItem(`tableflow-hide-${this.tableFlow.id}`);
            if (savedState) {
                const state = JSON.parse(savedState);
                state.hiddenColumns.forEach(columnId => {
                    this.toggleColumn(columnId, false);
                });
            }
            this.metrics.increment('hide_state_loaded');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_load_state');
            this.logger.error('Erreur lors du chargement de l\'état:', error);
        }
    }

    refresh() {
        if (!this.isInitialized) {
            this.logger.warn('Plugin Hide non initialisé');
            return;
        }

        try {
            if (this.menu) {
                this.menu.remove();
            }
            if (this.button) {
                this.button.remove();
            }
            this.createButton();
            this.createMenu();
            this.setupEventListeners();
            this.metrics.increment('hide_refreshed');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_refresh');
            this.logger.error('Erreur lors du rafraîchissement:', error);
        }
    }

    destroy() {
        if (!this.isInitialized) return;

        try {
            if (this.menu) {
                this.menu.remove();
            }
            if (this.button) {
                this.button.remove();
            }
            this.hiddenColumns.clear();
            this.isInitialized = false;
            this.logger.info('Plugin Hide détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'hide_destroy');
        } finally {
            super.destroy();
        }
    }
}
