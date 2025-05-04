# Plugin Actions

Ce plugin permet d'ajouter des actions personnalisables à votre tableau TableFlow. Il offre une interface intuitive pour gérer les actions sur les lignes, les cellules ou l'ensemble du tableau.

## Table des matières

1. [Fonctionnalités](#fonctionnalités)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Utilisation](#utilisation)
5. [API](#api)
6. [Hooks](#hooks)
7. [Événements](#événements)
8. [Styles](#styles)
9. [Accessibilité](#accessibilité)
10. [Raccourcis clavier](#raccourcis-clavier)
11. [Intégration](#intégration)
12. [Exemples](#exemples)
13. [Dépannage](#dépannage)

## Fonctionnalités

### Actions de base
- Actions prédéfinies (modifier, supprimer, dupliquer)
- Actions de navigation (déplacer vers le haut/bas)
- Actions de formatage
- Actions de validation

### Interface utilisateur
- Barre d'actions personnalisable
- Position configurable (gauche, droite, haut, bas)
- Groupement des actions
- Menus déroulants
- Icônes et labels personnalisables

### Fonctionnalités avancées
- Actions personnalisables
- Raccourcis clavier
- Confirmation des actions
- État des actions (activé/désactivé)
- Intégration avec d'autres plugins

### Intégration
- Compatible avec les autres plugins
- API complète pour la personnalisation
- Hooks pour les événements
- Styles entièrement personnalisables
- Support des thèmes

## Installation

```javascript
import { ActionsPlugin } from '@tableflow/plugins/actions';

const table = new TableFlow({
    plugins: {
        actions: {
            position: 'right',
            actions: {
                default: {
                    edit: true,
                    delete: true,
                    duplicate: true
                }
            }
        }
    }
});
```

## Configuration

### Options principales

```javascript
{
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
        default: {
            edit: {
                icon: '✏️',
                label: 'Modifier',
                shortcut: 'mod+e',
                enabled: true
            },
            // ... autres actions
        },
        custom: []
    },
    
    // Configuration de l'interface
    interface: {
        position: 'right',
        alignment: 'vertical',
        showIcons: true,
        showLabels: true,
        showShortcuts: true,
        groupActions: true,
        useDropdowns: true
    }
}
```

### Styles personnalisables

```javascript
{
    style: {
        // Conteneur principal
        containerBackground: '#ffffff',
        containerBorder: '1px solid #e0e0e0',
        containerBorderRadius: '4px',
        
        // Boutons d'action
        buttonSize: '32px',
        buttonPadding: '8px',
        buttonBackground: 'transparent',
        buttonColor: '#666666',
        
        // ... autres styles
    }
}
```

## Utilisation

### Initialisation de base

```javascript
const table = new TableFlow({
    plugins: {
        actions: {
            position: 'right',
            actions: {
                default: {
                    edit: true,
                    delete: true
                }
            }
        }
    }
});
```

### Ajout d'actions personnalisées

```javascript
const table = new TableFlow({
    plugins: {
        actions: {
            actions: {
                custom: [
                    {
                        id: 'custom-action',
                        icon: '⭐',
                        label: 'Action personnalisée',
                        shortcut: 'mod+a',
                        enabled: true,
                        action: (context) => {
                            console.log('Action personnalisée exécutée', context);
                        }
                    }
                ]
            }
        }
    }
});
```

### Gestion des événements

```javascript
table.on('actions:execute', (action, context) => {
    console.log('Action exécutée:', action, context);
});

table.on('actions:confirm', (action, context) => {
    return confirm('Confirmer l\'action ?');
});
```

## API

### Méthodes principales

- `addAction(action)`: Ajoute une action personnalisée
- `removeAction(id)`: Supprime une action
- `enableAction(id)`: Active une action
- `disableAction(id)`: Désactive une action
- `getActions()`: Récupère toutes les actions
- `executeAction(id, context)`: Exécute une action

### Méthodes de configuration

- `setPosition(position)`: Définit la position des actions
- `setAlignment(alignment)`: Définit l'alignement
- `showIcons(show)`: Affiche/masque les icônes
- `showLabels(show)`: Affiche/masque les labels
- `showShortcuts(show)`: Affiche/masque les raccourcis

## Hooks

### Avant l'exécution
```javascript
table.hooks.register('beforeAction', ({ action, context }) => {
    // Vérifier si l'action peut être exécutée
    return true;
});
```

### Après l'exécution
```javascript
table.hooks.register('afterAction', ({ action, context }) => {
    // Effectuer des actions après l'exécution
});
```

### Confirmation
```javascript
table.hooks.register('confirmAction', ({ action, context }) => {
    // Personnaliser la confirmation
    return confirm('Confirmer l\'action ?');
});
```

## Événements

### Exécution d'action
```javascript
table.on('actions:execute', ({ action, context }) => {
    console.log('Action exécutée:', action, context);
});
```

### Confirmation
```javascript
table.on('actions:confirm', ({ action, context }) => {
    console.log('Confirmation demandée:', action, context);
});
```

### État des actions
```javascript
table.on('actions:state', ({ action, enabled }) => {
    console.log('État de l\'action:', action, enabled);
});
```

## Styles

### Classes CSS
```css
.tableflow-actions { /* Conteneur principal */ }
.tableflow-action-button { /* Boutons d'action */ }
.tableflow-action-icon { /* Icônes */ }
.tableflow-action-label { /* Labels */ }
.tableflow-action-group { /* Groupes d'actions */ }
.tableflow-action-menu { /* Menus déroulants */ }
```

### Variables CSS
```css
.tableflow-actions {
    --container-background: #ffffff;
    --container-border: 1px solid #e0e0e0;
    --container-border-radius: 4px;
    
    --button-size: 32px;
    --button-padding: 8px;
    --button-background: transparent;
    --button-color: #666666;
    
    --icon-size: 16px;
    --label-font-size: 14px;
}
```

## Accessibilité

### Attributs ARIA
- `role="toolbar"` sur le conteneur
- `aria-label` sur les boutons
- `aria-expanded` sur les menus déroulants
- `aria-disabled` sur les actions désactivées
- `aria-describedby` pour les raccourcis

### Navigation au clavier
- Tab : Navigation entre les actions
- Entrée/Espace : Exécution de l'action
- Flèches : Navigation dans les menus
- Échap : Fermeture des menus
- Raccourcis personnalisés

## Raccourcis clavier

| Action | Raccourci |
|--------|-----------|
| Modifier | Mod+E |
| Supprimer | Mod+D |
| Dupliquer | Mod+Shift+D |
| Déplacer vers le haut | Mod+↑ |
| Déplacer vers le bas | Mod+↓ |
| Formater | Mod+F |
| Valider | Mod+V |

## Intégration

### Avec le plugin Selection
```javascript
table.hooks.register('afterSelect', ({ selection }) => {
    table.plugins.actions.updateContext({ selection });
});
```

### Avec le plugin ContextMenu
```javascript
table.plugins.contextMenu.registerProvider({
    getMenuItems: (context) => {
        return table.plugins.actions.getAvailableActions(context);
    }
});
```

## Exemples

### Configuration de base
```javascript
const table = new TableFlow({
    plugins: {
        actions: {
            position: 'right',
            actions: {
                default: {
                    edit: true,
                    delete: true,
                    duplicate: true
                }
            }
        }
    }
});
```

### Configuration avancée
```javascript
const table = new TableFlow({
    plugins: {
        actions: {
            position: 'right',
            alignment: 'vertical',
            showIcons: true,
            showLabels: true,
            groupActions: true,
            actions: {
                default: {
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
                    }
                },
                custom: [
                    {
                        id: 'custom-action',
                        icon: '⭐',
                        label: 'Action personnalisée',
                        shortcut: 'mod+a',
                        enabled: true,
                        action: (context) => {
                            console.log('Action personnalisée', context);
                        }
                    }
                ]
            }
        }
    }
});
```

### Personnalisation des styles
```javascript
const table = new TableFlow({
    plugins: {
        actions: {
            style: {
                containerBackground: '#f5f5f5',
                containerBorder: '1px solid #ddd',
                buttonSize: '40px',
                buttonBackground: '#fff',
                buttonColor: '#333'
            }
        }
    }
});
```

## Dépannage

### Problèmes courants

1. **Les actions ne s'affichent pas**
   - Vérifier que le plugin est correctement initialisé
   - Vérifier la configuration des actions
   - Vérifier la console pour les erreurs

2. **Les actions ne fonctionnent pas**
   - Vérifier que les actions sont activées
   - Vérifier les hooks de confirmation
   - Vérifier les permissions du navigateur

3. **Les styles ne s'appliquent pas**
   - Vérifier que les classes CSS sont correctes
   - Vérifier que les variables CSS sont définies
   - Vérifier la spécificité des sélecteurs

### Solutions

1. **Réinitialiser les actions**
```javascript
table.plugins.actions.destroy();
table.plugins.actions.init();
```

2. **Forcer la mise à jour**
```javascript
table.plugins.actions.refresh();
```

3. **Déboguer les événements**
```javascript
table.on('actions:execute', (data) => {
    console.log('Exécution:', data);
});
``` 