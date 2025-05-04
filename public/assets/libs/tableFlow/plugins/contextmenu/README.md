# Plugin ContextMenu

Ce plugin permet d'ajouter des menus contextuels personnalisables aux cellules de TableFlow.

## Fonctionnalités

- Menus contextuels personnalisables
- Sous-menus
- Séparateurs et en-têtes
- Navigation au clavier
- Animations fluides
- Positionnement intelligent
- Style personnalisable
- Intégration avec d'autres plugins

## Configuration

```javascript
{
    menuClass: 'tableflow-contextmenu',
    itemClass: 'tableflow-contextmenu-item',
    separatorClass: 'tableflow-contextmenu-separator',
    headerClass: 'tableflow-contextmenu-header',
    submenuClass: 'tableflow-contextmenu-submenu',
    activeClass: 'active',
    animationDuration: 200,
    position: {
        offsetX: 0,
        offsetY: 0,
        align: 'right'
    },
    keyboard: {
        enabled: true,
        closeOnEscape: true,
        navigateWithArrows: true
    },
    style: {
        minWidth: '200px',
        maxWidth: '300px',
        zIndex: 1000,
        backgroundColor: '#ffffff',
        borderColor: '#e0e0e0',
        textColor: '#333333',
        hoverColor: '#f5f5f5',
        activeColor: '#e3f2fd'
    }
}
```

## Utilisation

```javascript
const table = new TableFlow({
    plugins: {
        contextMenu: {
            position: {
                align: 'left'
            }
        }
    }
});

// Enregistrer un fournisseur de menu
table.plugins.contextMenu.registerProvider({
    getMenuItems: (cell) => {
        return [
            {
                id: 'copy',
                label: 'Copier',
                icon: '📋',
                action: () => {
                    // Action de copie
                }
            },
            {
                type: 'separator'
            },
            {
                id: 'delete',
                label: 'Supprimer',
                icon: '🗑️',
                action: () => {
                    // Action de suppression
                }
            }
        ];
    }
});
```

## Structure des éléments de menu

```javascript
{
    id: string,          // Identifiant unique
    label: string,       // Texte affiché
    icon?: string,       // Icône (optionnel)
    action?: Function,   // Action à exécuter (optionnel)
    type?: string,       // 'separator' | 'header' | 'submenu'
    items?: Array,       // Éléments du sous-menu
    disabled?: boolean,  // Désactiver l'élément
    visible?: boolean    // Masquer l'élément
}
```

## Hooks

- `beforeOpen`: Avant l'ouverture du menu
- `afterOpen`: Après l'ouverture du menu
- `beforeClose`: Avant la fermeture du menu
- `afterClose`: Après la fermeture du menu
- `beforeAction`: Avant l'exécution d'une action
- `afterAction`: Après l'exécution d'une action

## Événements

- `contextmenu:open`: Ouverture du menu
- `contextmenu:close`: Fermeture du menu
- `contextmenu:action`: Exécution d'une action
- `contextmenu:error`: Erreur lors de l'exécution d'une action 