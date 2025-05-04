import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class ContextMenuPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.UI;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        this.menu = null;
        this.providers = new Set();
        this.currentCell = null;
        this.activeItem = null;
    }

    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin ContextMenu déjà initialisé');
            return;
        }

        try {
            this.logger.info('Initialisation du plugin ContextMenu');
            this.setupEventListeners();
            this.registerHooks();
            this.isInitialized = true;
            this.metrics.increment('plugin_contextmenu_init');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_init');
            throw error;
        }
    }

    setupEventListeners() {
        this.tableFlow.on('cellContextMenu', this.handleContextMenu.bind(this));
        document.addEventListener('click', this.handleDocumentClick.bind(this));
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    registerHooks() {
        this.tableFlow.hooks.register('beforeOpen', this.beforeOpen.bind(this));
        this.tableFlow.hooks.register('afterOpen', this.afterOpen.bind(this));
        this.tableFlow.hooks.register('beforeClose', this.beforeClose.bind(this));
        this.tableFlow.hooks.register('afterClose', this.afterClose.bind(this));
        this.tableFlow.hooks.register('beforeAction', this.beforeAction.bind(this));
        this.tableFlow.hooks.register('afterAction', this.afterAction.bind(this));
    }

    handleContextMenu(event) {
        event.preventDefault();
        const cell = event.target.closest('td');
        if (!cell) return;

        this.currentCell = cell;
        this.showMenu(event.clientX, event.clientY);
    }

    handleDocumentClick(event) {
        if (this.menu && !this.menu.contains(event.target)) {
            this.hideMenu();
        }
    }

    handleKeydown(event) {
        if (!this.menu || !this.config.keyboard.enabled) return;

        switch (event.key) {
            case 'Escape':
                if (this.config.keyboard.closeOnEscape) {
                    this.hideMenu();
                }
                break;
            case 'ArrowUp':
                if (this.config.keyboard.navigateWithArrows) {
                    this.navigateItems(-1);
                }
                break;
            case 'ArrowDown':
                if (this.config.keyboard.navigateWithArrows) {
                    this.navigateItems(1);
                }
                break;
            case 'Enter':
                if (this.activeItem) {
                    this.executeAction(this.activeItem);
                }
                break;
        }
    }

    async showMenu(x, y) {
        try {
            const beforeOpenResult = await this.tableFlow.hooks.trigger('beforeOpen', {
                cell: this.currentCell,
                x,
                y
            });

            if (beforeOpenResult === false) return;

            this.createMenu();
            this.updateMenuPosition(x, y);
            this.populateMenu();
            this.menu.classList.add(this.config.activeClass);

            await this.tableFlow.hooks.trigger('afterOpen', {
                cell: this.currentCell,
                menu: this.menu
            });

            this.tableFlow.emit('contextmenu:open', { cell: this.currentCell });
            this.metrics.increment('contextmenu_open');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_show');
        }
    }

    createMenu() {
        if (this.menu) {
            this.menu.remove();
        }

        this.menu = document.createElement('div');
        this.menu.className = this.config.menuClass;
        this.applyMenuStyles();
        document.body.appendChild(this.menu);
    }

    applyMenuStyles() {
        const style = this.config.style;
        this.menu.style.setProperty('--min-width', style.minWidth);
        this.menu.style.setProperty('--max-width', style.maxWidth);
        this.menu.style.setProperty('--z-index', style.zIndex);
        this.menu.style.setProperty('--background-color', style.backgroundColor);
        this.menu.style.setProperty('--border-color', style.borderColor);
        this.menu.style.setProperty('--text-color', style.textColor);
        this.menu.style.setProperty('--hover-color', style.hoverColor);
        this.menu.style.setProperty('--active-color', style.activeColor);
    }

    updateMenuPosition(x, y) {
        const rect = this.menu.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;

        let left = x + this.config.position.offsetX;
        let top = y + this.config.position.offsetY;

        if (this.config.position.align === 'right') {
            left = Math.min(left, windowWidth - rect.width);
        }

        if (top + rect.height > windowHeight) {
            top = Math.max(0, windowHeight - rect.height);
        }

        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
    }

    populateMenu() {
        this.menu.innerHTML = '';
        const items = this.getMenuItems();

        items.forEach(item => {
            if (item.visible === false) return;

            const element = this.createMenuItem(item);
            this.menu.appendChild(element);
        });
    }

    getMenuItems() {
        const items = [];
        this.providers.forEach(provider => {
            const providerItems = provider.getMenuItems(this.currentCell);
            if (Array.isArray(providerItems)) {
                items.push(...providerItems);
            }
        });
        return items;
    }

    createMenuItem(item) {
        if (item.type === 'separator') {
            return this.createSeparator();
        }

        if (item.type === 'header') {
            return this.createHeader(item);
        }

        const element = document.createElement('div');
        element.className = this.config.itemClass;
        if (item.disabled) {
            element.classList.add('disabled');
        }

        if (item.icon) {
            const icon = document.createElement('span');
            icon.className = 'icon';
            icon.textContent = item.icon;
            element.appendChild(icon);
        }

        const label = document.createElement('span');
        label.textContent = item.label;
        element.appendChild(label);

        if (item.items) {
            const submenu = this.createSubmenu(item.items);
            element.appendChild(submenu);
        }

        if (item.action && !item.disabled) {
            element.addEventListener('click', () => this.executeAction(item));
        }

        return element;
    }

    createSeparator() {
        const separator = document.createElement('div');
        separator.className = this.config.separatorClass;
        return separator;
    }

    createHeader(item) {
        const header = document.createElement('div');
        header.className = this.config.headerClass;
        header.textContent = item.label;
        return header;
    }

    createSubmenu(items) {
        const submenu = document.createElement('div');
        submenu.className = this.config.submenuClass;

        items.forEach(item => {
            if (item.visible === false) return;
            const element = this.createMenuItem(item);
            submenu.appendChild(element);
        });

        return submenu;
    }

    navigateItems(direction) {
        try {
            const items = Array.from(this.menu.querySelectorAll(`.${this.config.itemClass}:not(.disabled)`));
            if (items.length === 0) return;

            let index = 0;
            if (this.activeItem) {
                index = items.indexOf(this.activeItem) + direction;
                if (index < 0) index = items.length - 1;
                if (index >= items.length) index = 0;
            }

            this.setActiveItem(items[index]);
            this.metrics.increment('contextmenu_navigate');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_navigate');
            this.logger.error('Erreur lors de la navigation dans le menu:', error);
        }
    }

    setActiveItem(item) {
        try {
            if (this.activeItem) {
                this.activeItem.classList.remove(this.config.activeClass);
            }

            this.activeItem = item;
            if (item) {
                item.classList.add(this.config.activeClass);
                item.focus();
            }
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_set_active');
            this.logger.error('Erreur lors de la sélection de l\'élément:', error);
        }
    }

    async executeAction(item) {
        try {
            const beforeResult = await this.tableFlow.hooks.trigger('beforeAction', {
                cell: this.currentCell,
                item
            });

            if (beforeResult === false) return;

            if (typeof item.action === 'function') {
                await item.action(this.currentCell);
            }

            await this.tableFlow.hooks.trigger('afterAction', {
                cell: this.currentCell,
                item
            });

            this.hideMenu();
            this.metrics.increment('contextmenu_action');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_action');
            this.logger.error('Erreur lors de l\'exécution de l\'action:', error);
        }
    }

    hideMenu() {
        if (!this.menu) return;

        try {
            const beforeCloseResult = this.tableFlow.hooks.trigger('beforeClose', {
                cell: this.currentCell,
                menu: this.menu
            });

            if (beforeCloseResult === false) return;

            this.menu.classList.remove(this.config.activeClass);
            setTimeout(() => {
                if (this.menu) {
                    this.menu.remove();
                    this.menu = null;
                }
            }, this.config.animationDuration);

            this.tableFlow.hooks.trigger('afterClose', {
                cell: this.currentCell
            });

            this.tableFlow.emit('contextmenu:close', { cell: this.currentCell });
            this.metrics.increment('contextmenu_close');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_hide');
        }
    }

    registerProvider(provider) {
        try {
            if (typeof provider.getMenuItems !== 'function') {
                throw new Error('Le provider doit implémenter la méthode getMenuItems');
            }
            this.providers.add(provider);
            this.metrics.increment('contextmenu_provider_registered');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_register_provider');
            this.logger.error('Erreur lors de l\'enregistrement du provider:', error);
        }
    }

    unregisterProvider(provider) {
        try {
            this.providers.delete(provider);
            this.metrics.increment('contextmenu_provider_unregistered');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_unregister_provider');
            this.logger.error('Erreur lors de la suppression du provider:', error);
        }
    }

    beforeOpen({ cell, x, y }) {
        return true;
    }

    afterOpen({ cell, menu }) {
    }

    beforeClose({ cell, menu }) {
    }

    afterClose({ cell }) {
    }

    beforeAction({ cell, item }) {
        return true;
    }

    afterAction({ cell, item }) {
    }

    refresh() {
        if (!this.isInitialized) {
            this.logger.warn('Plugin ContextMenu non initialisé');
            return;
        }
        this.hideMenu();
    }

    destroy() {
        if (!this.isInitialized) return;

        try {
            this.hideMenu();
            this.providers.clear();
            
            if (this.tableFlow) {
                this.tableFlow.off('cellContextMenu', this.handleContextMenu);
                document.removeEventListener('click', this.handleDocumentClick);
                document.removeEventListener('keydown', this.handleKeydown);
            }
            
            this.isInitialized = false;
            this.logger.info('Plugin ContextMenu détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'contextmenu_destroy');
        } finally {
            super.destroy();
        }
    }
}