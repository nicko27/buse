import { config } from './config.js';

export default class ActionsPlugin {
    constructor(options = {}) {
        this.name = config.name;
        this.version = config.version;
        this.dependencies = config.dependencies;
        this.config = { ...config.options, ...options };
        this.table = null;
        this.actions = new Map();
        this.context = {};

        // Lier les méthodes pour préserver le contexte
        this.handleActionClick = this.handleActionClick.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleContextUpdate = this.handleContextUpdate.bind(this);
    }
    
    init(table) {
        this.table = table;
        this.setupActions();
        this.setupEventListeners();
        this.render();
    }
    
    setupActions() {
        // Actions par défaut
        Object.entries(this.config.actions.default).forEach(([id, action]) => {
            if (action.enabled) {
                this.addAction({
                    id,
                    ...action,
                    type: 'default'
                });
            }
        });
        
        // Actions personnalisées
        this.config.actions.custom.forEach(action => {
            if (action.enabled) {
                this.addAction({
                    ...action,
                    type: 'custom'
                });
            }
        });
    }

    setupEventListeners() {
        // Événements du tableau
        this.table.on('selection:change', this.handleContextUpdate);
        this.table.on('cell:focus', this.handleContextUpdate);
        this.table.on('row:focus', this.handleContextUpdate);
        
        // Événements du document
        document.addEventListener('keydown', this.handleKeyDown);
    }
    
    handleContextUpdate(context) {
        this.context = { ...this.context, ...context };
        this.updateActionsState();
    }
    
    handleActionClick(event) {
        const button = event.target.closest(`.${this.config.actionButtonClass}`);
        if (!button) return;
        
        const actionId = button.dataset.action;
        const action = this.actions.get(actionId);
        if (!action || !action.enabled) return;
        
        this.executeAction(actionId);
    }
    
    handleKeyDown(event) {
        if (!this.config.interface.keyboardShortcuts) return;
        
        const modifier = this.config.interface.shortcutModifier === 'mod' ?
            (event.ctrlKey || event.metaKey) :
            event[`${this.config.interface.shortcutModifier}Key`];
            
        if (!modifier) return;
        
        for (const [id, action] of this.actions) {
            if (action.shortcut && this.isShortcutMatch(event, action.shortcut)) {
                event.preventDefault();
                this.executeAction(id);
                break;
            }
        }
    }
    
    isShortcutMatch(event, shortcut) {
        const keys = shortcut.toLowerCase().split('+');
        return keys.every(key => {
            switch (key) {
                case 'mod':
                    return event.ctrlKey || event.metaKey;
                case 'shift':
                    return event.shiftKey;
                case 'alt':
                    return event.altKey;
                default:
                    return event.key.toLowerCase() === key;
            }
        });
    }
    
    addAction(action) {
        this.actions.set(action.id, {
            ...action,
            enabled: true
        });
        this.render();
    }
    
    removeAction(id) {
        this.actions.delete(id);
        this.render();
    }
    
    enableAction(id) {
        const action = this.actions.get(id);
        if (action) {
            action.enabled = true;
            this.render();
        }
    }
    
    disableAction(id) {
        const action = this.actions.get(id);
        if (action) {
            action.enabled = false;
            this.render();
        }
    }
    
    getActions() {
        return Array.from(this.actions.values());
    }
    
    async executeAction(id) {
        const action = this.actions.get(id);
        if (!action || !action.enabled) return;
        
        // Vérifier les hooks avant l'exécution
        const beforeResult = await this.table.hooks.trigger('beforeAction', {
            action,
            context: this.context
        });
        
        if (beforeResult === false) return;
        
        // Vérifier la confirmation si nécessaire
        if (action.confirm) {
            const confirmResult = await this.table.hooks.trigger('confirmAction', {
                action,
                context: this.context
            });
            
            if (confirmResult === false) return;
        }
        
        // Exécuter l'action
        try {
            await action.action(this.context);
            
            // Déclencher l'événement après l'exécution
            this.table.trigger('actions:execute', {
                action,
                context: this.context
            });
            
            // Déclencher les hooks après l'exécution
            await this.table.hooks.trigger('afterAction', {
                action,
                context: this.context
            });
        } catch (error) {
            console.error('Erreur lors de l\'exécution de l\'action:', error);
            this.table.trigger('actions:error', {
                action,
                context: this.context,
                error
            });
        }
    }
    
    updateActionsState() {
        for (const [id, action] of this.actions) {
            const enabled = typeof action.enabled === 'function' ?
                action.enabled(this.context) :
                action.enabled;
                
            this.actions.set(id, {
                ...action,
                enabled
            });
        }
        this.render();
    }
    
    render() {
        const container = this.table.table.querySelector(`.${this.config.actionsClass}`) ||
            document.createElement('div');
            
        container.className = this.config.actionsClass;
        container.setAttribute('data-position', this.config.interface.position);
        container.setAttribute('data-alignment', this.config.interface.alignment);
        container.innerHTML = '';
        
        // Grouper les actions si nécessaire
        const groups = this.config.interface.groupActions ?
            this.groupActions() :
            [{ actions: this.getActions() }];
            
        groups.forEach(group => {
            const groupElement = document.createElement('div');
            groupElement.className = this.config.actionGroupClass;
            
            group.actions.forEach(action => {
                const button = this.createActionButton(action);
                groupElement.appendChild(button);
            });
            
            container.appendChild(groupElement);
        });
        
        if (!this.table.table.contains(container)) {
            this.table.table.appendChild(container);
        }
    }
    
    groupActions() {
        const groups = new Map();
        
        for (const action of this.actions.values()) {
            const groupKey = this.config.interface.groupBy === 'type' ?
                action.type :
                action.category || 'default';
                
            if (!groups.has(groupKey)) {
                groups.set(groupKey, []);
            }
            
            groups.get(groupKey).push(action);
        }
        
        return Array.from(groups.entries()).map(([key, actions]) => ({
            key,
            actions
        }));
    }
    
    createActionButton(action) {
        const button = document.createElement('button');
        button.className = this.config.actionButtonClass;
        button.setAttribute('data-action', action.id);
        button.setAttribute('aria-label', action.label);
        button.setAttribute('aria-disabled', !action.enabled);
        
        if (this.config.interface.showIcons && action.icon) {
            const icon = document.createElement('span');
            icon.className = this.config.actionIconClass;
            icon.textContent = action.icon;
            button.appendChild(icon);
        }
        
        if (this.config.interface.showLabels) {
            const label = document.createElement('span');
            label.className = this.config.actionLabelClass;
            label.textContent = action.label;
            button.appendChild(label);
        }
        
        if (this.config.interface.showShortcuts && action.shortcut) {
            button.setAttribute('aria-describedby', `shortcut-${action.id}`);
            button.setAttribute('title', `${action.label} (${action.shortcut})`);
        }
        
        if (!action.enabled) {
            button.classList.add('disabled');
        }
        
        button.addEventListener('click', this.handleActionClick);
        
        return button;
    }

    refresh() {
        this.render();
    }

    destroy() {
        // Nettoyer les événements
        document.removeEventListener('keydown', this.handleKeyDown);
        
        // Supprimer le conteneur
        const container = this.table.table.querySelector(`.${this.config.actionsClass}`);
        if (container) {
            container.remove();
        }
        
        // Réinitialiser l'état
        this.actions.clear();
        this.context = {};
    }
}
