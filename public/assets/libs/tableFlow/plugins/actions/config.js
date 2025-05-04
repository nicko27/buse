export const config = {
    name: 'actions',
    version: '1.0.0',
    dependencies: [],
    options: {
        // Classes CSS
        actionsClass: 'tableflow-actions',
        actionButtonClass: 'tableflow-action-button',
        actionIconClass: 'tableflow-action-icon',
        actionLabelClass: 'tableflow-action-label',
        actionGroupClass: 'tableflow-action-group',
        actionSeparatorClass: 'tableflow-action-separator',
        actionDropdownClass: 'tableflow-action-dropdown',
        actionMenuClass: 'tableflow-action-menu',
        
        // Configuration des actions
        actions: {
            // Actions par défaut
            default: {
                // Actions de base
                edit: {
                    icon: '✏️',
                    label: 'Modifier',
                    shortcut: 'mod+e',
                    enabled: true
                },
                delete: {
                    icon: '🗑️',
                    label: 'Supprimer',
                    shortcut: 'mod+d',
                    enabled: true,
                    confirm: true
                },
                duplicate: {
                    icon: '📋',
                    label: 'Dupliquer',
                    shortcut: 'mod+shift+d',
                    enabled: true
                },
                
                // Actions de navigation
                moveUp: {
                    icon: '⬆️',
                    label: 'Déplacer vers le haut',
                    shortcut: 'mod+arrowup',
                    enabled: true
                },
                moveDown: {
                    icon: '⬇️',
                    label: 'Déplacer vers le bas',
                    shortcut: 'mod+arrowdown',
                    enabled: true
                },
                
                // Actions de formatage
                format: {
                    icon: '🎨',
                    label: 'Formater',
                    shortcut: 'mod+f',
                    enabled: true
                },
                
                // Actions de validation
                validate: {
                    icon: '✓',
                    label: 'Valider',
                    shortcut: 'mod+v',
                    enabled: true
                }
            },
            
            // Actions personnalisables
            custom: []
        },
        
        // Configuration de l'interface
        interface: {
            // Position des actions
            position: 'right', // 'left' | 'right' | 'top' | 'bottom'
            alignment: 'vertical', // 'horizontal' | 'vertical'
            showIcons: true,
            showLabels: true,
            showShortcuts: true,
            
            // Groupement des actions
            groupActions: true,
            groupBy: 'type', // 'type' | 'category' | 'custom'
            
            // Menus déroulants
            useDropdowns: true,
            dropdownTrigger: 'click', // 'click' | 'hover'
            dropdownPosition: 'auto', // 'auto' | 'top' | 'bottom' | 'left' | 'right'
            
            // Raccourcis clavier
            keyboardShortcuts: true,
            shortcutModifier: 'mod', // 'ctrl' | 'cmd' | 'mod'
            
            // Accessibilité
            ariaLabels: true,
            keyboardNavigation: true
        },
        
        // Styles
        style: {
            // Conteneur principal
            containerBackground: '#ffffff',
            containerBorder: '1px solid #e0e0e0',
            containerBorderRadius: '4px',
            containerPadding: '8px',
            containerShadow: '0 1px 3px rgba(0,0,0,0.1)',
            
            // Boutons d'action
            buttonSize: '32px',
            buttonPadding: '8px',
            buttonMargin: '4px',
            buttonBorderRadius: '4px',
            buttonBackground: 'transparent',
            buttonColor: '#666666',
            buttonHoverBackground: '#f5f5f5',
            buttonHoverColor: '#333333',
            buttonActiveBackground: '#e3f2fd',
            buttonActiveColor: '#2196F3',
            
            // Icônes
            iconSize: '16px',
            iconMargin: '0 4px 0 0',
            
            // Labels
            labelFontSize: '14px',
            labelFontWeight: 'normal',
            labelColor: 'inherit',
            
            // Groupes
            groupMargin: '8px 0',
            groupPadding: '0 8px',
            groupBorder: '1px solid #e0e0e0',
            groupBorderRadius: '4px',
            
            // Séparateurs
            separatorColor: '#e0e0e0',
            separatorMargin: '8px 0',
            separatorHeight: '1px',
            
            // Menus déroulants
            dropdownBackground: '#ffffff',
            dropdownBorder: '1px solid #e0e0e0',
            dropdownBorderRadius: '4px',
            dropdownShadow: '0 2px 5px rgba(0,0,0,0.1)',
            dropdownPadding: '4px 0',
            
            // Transitions
            transition: 'all 0.2s ease'
        },
        
        // Messages
        messages: {
            noActions: 'Aucune action disponible',
            loading: 'Chargement des actions...',
            error: 'Erreur lors du chargement des actions',
            confirmDelete: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
            confirmAction: 'Confirmer l\'action ?'
        }
    }
}; 