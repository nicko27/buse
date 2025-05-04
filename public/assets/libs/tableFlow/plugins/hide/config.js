export const config = {
    name: 'hide',
    version: '1.0.0',
    type: 'display',
    dependencies: [],
    options: {
        // Classes CSS
        buttonClass: 'tableflow-hide-button',
        hiddenClass: 'tableflow-hidden',
        menuClass: 'tableflow-hide-menu',
        menuItemClass: 'tableflow-hide-menu-item',
        activeClass: 'tableflow-hide-active',
        
        // Configuration du menu
        menu: {
            enabled: true,
            position: 'right', // 'left' | 'right'
            showLabels: true,
            showIcons: true,
            showCounter: true,
            maxHeight: 400,
            
            // Messages
            messages: {
                title: 'Colonnes visibles',
                toggleAll: 'Tout afficher/masquer',
                noColumns: 'Aucune colonne disponible',
                counter: '{visible} sur {total} colonnes'
            }
        },
        
        // Configuration de l'interface
        interface: {
            // Bouton
            buttonPosition: 'header', // 'header' | 'toolbar'
            buttonIcon: '👁️',
            buttonText: 'Afficher/Masquer',
            
            // Menu
            closeOnSelect: false,
            closeOnClickOutside: true,
            saveState: true,
            
            // Accessibilité
            ariaLabels: true,
            keyboardNavigation: true
        },
        
        // Styles
        style: {
            // Bouton
            buttonBackground: '#ffffff',
            buttonHoverBackground: '#f5f5f5',
            buttonActiveBackground: '#e0e0e0',
            buttonBorder: '1px solid #ddd',
            buttonBorderRadius: '4px',
            
            // Menu
            menuBackground: '#ffffff',
            menuBorder: '1px solid #ddd',
            menuBorderRadius: '4px',
            menuShadow: '0 2px 8px rgba(0,0,0,0.1)',
            
            // Items
            itemHoverBackground: '#f5f5f5',
            itemActiveBackground: '#e3f2fd',
            itemCheckColor: '#2196F3',
            
            // Transitions
            transition: 'all 0.2s ease'
        },
        
        // Hooks
        hooks: {
            // Avant de masquer une colonne
            beforeHide: null,
            // Après avoir masqué une colonne
            afterHide: null,
            // Avant d'afficher une colonne
            beforeShow: null,
            // Après avoir affiché une colonne
            afterShow: null,
            // Avant de mettre à jour l'état
            beforeStateUpdate: null,
            // Après avoir mis à jour l'état
            afterStateUpdate: null
        },
        
        // Persistance
        storage: {
            enabled: true,
            key: 'tableflow-hidden-columns',
            type: 'localStorage' // 'localStorage' | 'sessionStorage'
        }
    }
}; 