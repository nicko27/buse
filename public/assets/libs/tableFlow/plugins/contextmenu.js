export default class ContextMenuPlugin {
    constructor(config = {}) {
        this.name = 'contextMenu';
        this.version = '1.0.0';
        this.type = 'ui';
        this.table = null;
        
        // Configuration par défaut
        this.config = {
            menuClass: 'tf-context-menu',
            menuItemClass: 'tf-menu-item',
            menuSeparatorClass: 'tf-menu-separator',
            menuHeaderClass: 'tf-menu-header',
            debug: false
        };
        
        // Fusion avec la configuration fournie
        Object.assign(this.config, config);
        
        // Le menu contextuel
        this.menu = null;
        // Liste des fournisseurs de menu
        this.providers = [];
        // Cellule actuellement ciblée
        this.currentCell = null;
        
        this.debug = this.config.debug ? 
            (...args) => console.log('[ContextMenuPlugin]', ...args) : 
            () => {};
    }
    
    init(tableHandler) {
        this.table = tableHandler;
        
        // Créer le menu contextuel
        this.createContextMenu();
        
        // Ajouter les écouteurs d'événements
        this.setupEventListeners();
    }
    
    createContextMenu() {
        // Créer le menu une seule fois
        if (this.menu) return;
        
        // Créer l'élément du menu
        this.menu = document.createElement('div');
        this.menu.className = this.config.menuClass;
        this.menu.style.display = 'none';
        this.menu.style.position = 'absolute';
        this.menu.style.zIndex = '1000';
        
        // Styles de base pour le menu
        this.menu.style.background = 'white';
        this.menu.style.border = '1px solid #ccc';
        this.menu.style.borderRadius = '4px';
        this.menu.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
        this.menu.style.padding = '5px 0';
        this.menu.style.minWidth = '180px';
        
        // Ajouter au body pour qu'il puisse apparaître n'importe où
        document.body.appendChild(this.menu);
    }
    
    setupEventListeners() {
        // Écouter les événements de clic droit
        this.table.table.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
        // Fermer le menu quand on clique ailleurs
        document.addEventListener('click', () => {
            this.hideMenu();
        });
        
        // Fermer le menu avec Échap
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.hideMenu();
            }
        });
    }
    
    handleContextMenu(event) {
        // Trouver la cellule ciblée
        const cell = event.target.closest('td');
        if (!cell) return;
        
        // Stocker la cellule ciblée
        this.currentCell = cell;
        
        // Collecter les éléments de menu de tous les fournisseurs
        const menuItems = this.collectMenuItems(cell);
        
        // S'il n'y a pas d'éléments de menu, ne pas afficher le menu
        if (menuItems.length === 0) return;
        
        // Empêcher le menu contextuel par défaut
        event.preventDefault();
        
        // Afficher notre menu personnalisé
        this.showMenu(event.clientX, event.clientY, menuItems);
    }
    
    registerProvider(provider) {
        // Vérifier que le provider a une méthode getMenuItems
        if (typeof provider.getMenuItems !== 'function') {
            console.error('Menu provider must have a getMenuItems method');
            return;
        }
        
        this.providers.push(provider);
        this.debug(`Provider ${provider.name || 'unnamed'} registered`);
        
        return this;
    }
    
    collectMenuItems(cell) {
        let items = [];
        
        // Collecter les éléments de chaque fournisseur
        for (const provider of this.providers) {
            try {
                const providerItems = provider.getMenuItems(cell);
                if (providerItems && providerItems.length > 0) {
                    // Ajouter un séparateur si nécessaire
                    if (items.length > 0) {
                        items.push({ type: 'separator' });
                    }
                    
                    // Ajouter les éléments avec une référence au fournisseur
                    providerItems.forEach(item => {
                        items.push({
                            ...item,
                            provider
                        });
                    });
                }
            } catch (error) {
                console.error(`Error getting menu items from provider:`, error);
            }
        }
        
        return items;
    }
    
    showMenu(x, y, items) {
        // Vider le menu existant
        this.menu.innerHTML = '';
        
        // Créer les éléments de menu
        items.forEach(item => {
            if (item.type === 'separator') {
                // Séparateur
                const separator = document.createElement('div');
                separator.className = this.config.menuSeparatorClass;
                separator.style.height = '1px';
                separator.style.background = '#ddd';
                separator.style.margin = '5px 0';
                this.menu.appendChild(separator);
            } 
            else if (item.type === 'header') {
                // En-tête de section
                const header = document.createElement('div');
                header.className = this.config.menuHeaderClass;
                header.textContent = item.label;
                header.style.padding = '5px 10px';
                header.style.fontWeight = 'bold';
                header.style.color = '#666';
                header.style.fontSize = '0.9em';
                this.menu.appendChild(header);
            }
            else {
                // Élément de menu standard
                const menuItem = document.createElement('div');
                menuItem.className = this.config.menuItemClass;
                menuItem.innerHTML = `
                    ${item.icon ? `<span class="menu-icon">${item.icon}</span>` : ''}
                    <span class="menu-label">${item.label}</span>
                `;
                
                // Styles de base pour l'élément
                menuItem.style.padding = '8px 15px';
                menuItem.style.cursor = 'pointer';
                menuItem.style.display = 'flex';
                menuItem.style.alignItems = 'center';
                
                // Style pour l'icône
                const iconSpan = menuItem.querySelector('.menu-icon');
                if (iconSpan) {
                    iconSpan.style.marginRight = '8px';
                    iconSpan.style.fontSize = '1.1em';
                    iconSpan.style.width = '20px';
                    iconSpan.style.textAlign = 'center';
                }
                
                // Hover
                menuItem.addEventListener('mouseover', () => {
                    menuItem.style.background = '#f5f5f5';
                });
                menuItem.addEventListener('mouseout', () => {
                    menuItem.style.background = '';
                });
                
                // Action
                menuItem.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.hideMenu();
                    
                    // Exécuter l'action via le fournisseur
                    if (item.provider && typeof item.provider.executeAction === 'function') {
                        item.provider.executeAction(item.id, this.currentCell);
                    } else if (typeof item.action === 'function') {
                        item.action(this.currentCell);
                    }
                });
                
                this.menu.appendChild(menuItem);
            }
        });
        
        // Positionner et afficher le menu
        this.menu.style.left = `${x}px`;
        this.menu.style.top = `${y}px`;
        this.menu.style.display = 'block';
        
        // Ajuster la position pour éviter de sortir de l'écran
        const rect = this.menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.menu.style.left = `${window.innerWidth - rect.width - 5}px`;
        }
        
        if (rect.bottom > window.innerHeight) {
            this.menu.style.top = `${window.innerHeight - rect.height - 5}px`;
        }
    }
    
    hideMenu() {
        if (this.menu) {
            this.menu.style.display = 'none';
            this.currentCell = null;
        }
    }
    
    refresh() {
        // Rien à rafraîchir spécifiquement
    }
    
    destroy() {
        // Supprimer le menu contextuel
        if (this.menu) {
            this.menu.remove();
            this.menu = null;
        }
        
        // Supprimer les écouteurs d'événements
        if (this.table?.table) {
            this.table.table.removeEventListener('contextmenu', this.handleContextMenu);
        }
        
        // Vider les providers
        this.providers = [];
    }
}