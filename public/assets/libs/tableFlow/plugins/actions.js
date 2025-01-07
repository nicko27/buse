class ActionsPlugin {
    constructor(config = {}) {
        this.config = {
            actions: [],
            containerClass: 'actions-container',
            buttonClass: 'action-button',
            iconClass: 'action-icon',
            labelClass: 'action-label',
            position: 'right', // 'left', 'right', 'top', 'bottom'
            showLabels: true,
            ...config
        };
        
        this.context = null;
        this.container = null;
    }

    async init(context) {
        this.context = context;
        
        // Créer le conteneur d'actions
        this.createActionsContainer();
        
        // Initialiser les actions
        this.setupActions();
    }

    createActionsContainer() {
        const { table, container } = this.context;
        
        this.container = document.createElement('div');
        this.container.className = this.config.containerClass;
        this.container.classList.add(`actions-${this.config.position}`);
        
        // Positionner le conteneur selon la configuration
        switch (this.config.position) {
            case 'top':
                container.insertBefore(this.container, table);
                break;
            case 'bottom':
                container.insertBefore(this.container, table.nextSibling);
                break;
            default:
                container.appendChild(this.container);
                break;
        }
    }

    setupActions() {
        // Vider le conteneur
        this.container.innerHTML = '';
        
        // Créer les boutons d'action
        this.config.actions.forEach(action => {
            const button = this.createActionButton(action);
            this.container.appendChild(button);
        });
    }

    createActionButton(action) {
        const button = document.createElement('button');
        button.className = this.config.buttonClass;
        button.title = action.tooltip || action.label;
        
        // Ajouter l'icône si spécifiée
        if (action.icon) {
            const icon = document.createElement('span');
            icon.className = this.config.iconClass;
            icon.innerHTML = action.icon;
            button.appendChild(icon);
        }
        
        // Ajouter le label si configuré
        if (this.config.showLabels && action.label) {
            const label = document.createElement('span');
            label.className = this.config.labelClass;
            label.textContent = action.label;
            button.appendChild(label);
        }
        
        // Configurer l'état du bouton
        if (action.disabled) {
            button.disabled = true;
        }
        
        // Ajouter le gestionnaire d'événements
        button.addEventListener('click', async (event) => {
            event.preventDefault();
            
            // Vérifier si l'action est désactivée
            if (button.disabled) return;
            
            try {
                // Désactiver le bouton pendant l'exécution
                button.disabled = true;
                
                // Exécuter l'action
                await action.handler({
                    table: this.context.table,
                    getSelectedRows: () => {
                        const selectPlugin = this.context.getPlugin('select');
                        return selectPlugin ? selectPlugin.getSelectedRows() : [];
                    },
                    notify: this.context.notify
                });
                
                // Notifier le succès
                this.context.notify('success', action.successMessage || 'Action exécutée avec succès');
            } catch (error) {
                // Notifier l'erreur
                this.context.notify('error', error.message || 'Erreur lors de l\'exécution de l\'action');
            } finally {
                // Réactiver le bouton
                button.disabled = action.disabled || false;
            }
        });
        
        return button;
    }

    addAction(action) {
        this.config.actions.push(action);
        const button = this.createActionButton(action);
        this.container.appendChild(button);
    }

    removeAction(actionId) {
        const index = this.config.actions.findIndex(a => a.id === actionId);
        if (index !== -1) {
            this.config.actions.splice(index, 1);
            this.setupActions();
        }
    }

    enableAction(actionId) {
        const action = this.config.actions.find(a => a.id === actionId);
        if (action) {
            action.disabled = false;
            this.setupActions();
        }
    }

    disableAction(actionId) {
        const action = this.config.actions.find(a => a.id === actionId);
        if (action) {
            action.disabled = true;
            this.setupActions();
        }
    }

    refresh() {
        this.setupActions();
    }

    destroy() {
        // Supprimer le conteneur
        this.container?.remove();
        
        this.container = null;
        this.context = null;
    }
}

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.ActionsPlugin = ActionsPlugin;
}
