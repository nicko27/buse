# Plugin TextEditor

Ce plugin fournit un éditeur de texte riche pour les cellules de TableFlow. Il offre une interface intuitive avec une barre d'outils complète, des raccourcis clavier, et de nombreuses options de personnalisation.

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

### Édition de texte
- Formatage de texte (gras, italique, souligné, barré)
- Alignement du texte (gauche, centre, droite, justifié)
- Listes (à puces et numérotées)
- Insertion et gestion de liens
- Couleurs de texte et de fond
- Annulation/rétablissement illimité

### Interface utilisateur
- Barre d'outils personnalisable
- Position de la barre d'outils configurable
- Dropdowns pour les options avancées
- Palette de couleurs intégrée
- Indicateurs visuels d'état

### Fonctionnalités avancées
- Auto-sauvegarde
- Limite de caractères
- Hauteur minimale et maximale
- Placeholder personnalisable
- Support du copier/coller
- Historique des modifications

### Intégration
- Compatible avec les autres plugins
- API complète pour la personnalisation
- Hooks pour les événements
- Styles entièrement personnalisables
- Support des thèmes

## Installation

```javascript
import { TextEditorPlugin } from '@tableflow/plugins/texteditor';

const table = new TableFlow({
    plugins: {
        texteditor: {
            toolbar: {
                position: 'top',
                buttons: ['bold', 'italic', 'underline']
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
    editorClass: 'tableflow-texteditor',
    activeClass: 'active',
    toolbarClass: 'tableflow-toolbar',
    buttonClass: 'tableflow-toolbar-button',
    dropdownClass: 'tableflow-toolbar-dropdown',
    separatorClass: 'tableflow-toolbar-separator',
    contentClass: 'tableflow-editor-content',
    placeholderClass: 'tableflow-editor-placeholder',
    
    // Configuration de l'éditeur
    placeholder: 'Saisissez votre texte...',
    spellcheck: true,
    autofocus: true,
    maxLength: 1000,
    minHeight: '100px',
    maxHeight: '300px',
    
    // Options d'auto-sauvegarde
    autoSave: true,
    autoSaveInterval: 5000
}
```

### Configuration de la barre d'outils

```javascript
{
    toolbar: {
        position: 'top', // 'top' | 'bottom' | 'left' | 'right'
        sticky: true,
        buttons: {
            bold: {
                icon: '𝐁',
                title: 'Gras',
                command: 'bold'
            },
            italic: {
                icon: '𝑰',
                title: 'Italique',
                command: 'italic'
            },
            // ... autres boutons
        }
    }
}
```

### Styles personnalisables

```javascript
{
    style: {
        // Éditeur
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: '14px',
        lineHeight: '1.5',
        color: '#333333',
        background: '#ffffff',
        padding: '8px',
        borderRadius: '4px',
        border: '1px solid #e0e0e0',
        
        // ... autres styles
    }
}
```

## Utilisation

### Initialisation de base

```javascript
const table = new TableFlow({
    plugins: {
        texteditor: {
            autoSave: true,
            maxLength: 500
        }
    }
});
```

### Personnalisation de la barre d'outils

```javascript
const table = new TableFlow({
    plugins: {
        texteditor: {
            toolbar: {
                position: 'top',
                buttons: {
                    bold: true,
                    italic: true,
                    alignment: {
                        type: 'dropdown',
                        options: ['left', 'center', 'right']
                    }
                }
            }
        }
    }
});
```

### Gestion des événements

```javascript
table.on('texteditor:change', (content) => {
    console.log('Contenu modifié:', content);
});

table.on('texteditor:save', (content) => {
    console.log('Contenu sauvegardé:', content);
});
```

## API

### Méthodes d'édition

- `startEdit(cell)`: Démarre l'édition d'une cellule
- `stopEdit()`: Arrête l'édition
- `getContent()`: Récupère le contenu actuel
- `setContent(content)`: Définit le contenu
- `focus()`: Donne le focus à l'éditeur
- `blur()`: Retire le focus

### Méthodes de formatage

- `execCommand(command, value)`: Exécute une commande de formatage
- `queryCommandState(command)`: Vérifie l'état d'une commande
- `queryCommandValue(command)`: Récupère la valeur d'une commande
- `addFormat(format)`: Ajoute un format personnalisé
- `removeFormat()`: Supprime tout le formatage

### Méthodes d'historique

- `undo()`: Annule la dernière modification
- `redo()`: Rétablit la dernière modification
- `clearHistory()`: Efface l'historique
- `canUndo()`: Vérifie si une annulation est possible
- `canRedo()`: Vérifie si un rétablissement est possible

## Hooks

### Avant l'édition
```javascript
table.hooks.register('beforeEdit', ({ cell, content }) => {
    // Vérifier si l'édition est autorisée
    return true;
});
```

### Après l'édition
```javascript
table.hooks.register('afterEdit', ({ cell, content }) => {
    // Effectuer des actions après l'édition
});
```

### Avant la sauvegarde
```javascript
table.hooks.register('beforeSave', (content) => {
    // Valider ou transformer le contenu
    return content;
});
```

### Après la sauvegarde
```javascript
table.hooks.register('afterSave', (content) => {
    // Effectuer des actions après la sauvegarde
});
```

## Événements

### Changement de contenu
```javascript
table.on('texteditor:change', ({ content, source }) => {
    console.log('Contenu modifié:', content);
});
```

### Sauvegarde
```javascript
table.on('texteditor:save', ({ content, cell }) => {
    console.log('Contenu sauvegardé:', content);
});
```

### Focus
```javascript
table.on('texteditor:focus', ({ cell }) => {
    console.log('Éditeur focalisé');
});

table.on('texteditor:blur', ({ cell }) => {
    console.log('Éditeur non focalisé');
});
```

## Styles

### Classes CSS
```css
.tableflow-texteditor { /* Conteneur principal */ }
.tableflow-toolbar { /* Barre d'outils */ }
.tableflow-toolbar-button { /* Boutons */ }
.tableflow-toolbar-dropdown { /* Menus déroulants */ }
.tableflow-editor-content { /* Zone d'édition */ }
```

### Variables CSS
```css
.tableflow-texteditor {
    --editor-font-family: -apple-system, system-ui, sans-serif;
    --editor-font-size: 14px;
    --editor-line-height: 1.5;
    --editor-color: #333333;
    --editor-background: #ffffff;
    --editor-border-color: #e0e0e0;
    --editor-border-radius: 4px;
    --editor-padding: 8px;
    
    --toolbar-background: #ffffff;
    --toolbar-border-color: #e0e0e0;
    --toolbar-shadow: 0 1px 3px rgba(0,0,0,0.1);
    
    --button-size: 32px;
    --button-color: #666666;
    --button-hover-color: #333333;
    --button-active-color: #2196F3;
}
```

## Accessibilité

### Attributs ARIA
- `role="textbox"` sur la zone d'édition
- `aria-label` sur les boutons de la barre d'outils
- `aria-pressed` sur les boutons à bascule
- `aria-expanded` sur les menus déroulants
- `aria-describedby` pour les messages d'aide

### Navigation au clavier
- Tab : Navigation entre les boutons
- Entrée/Espace : Activation des boutons
- Flèches : Navigation dans les menus
- Échap : Fermeture des menus
- Mod+B/I/U : Raccourcis de formatage

## Raccourcis clavier

| Action | Raccourci |
|--------|-----------|
| Gras | Mod+B |
| Italique | Mod+I |
| Souligné | Mod+U |
| Lien | Mod+K |
| Annuler | Mod+Z |
| Rétablir | Mod+Y |
| Rétablir (alt) | Mod+Shift+Z |

## Intégration

### Avec le plugin Selection
```javascript
table.hooks.register('afterSelect', ({ cell }) => {
    if (cell.hasAttribute('data-editable')) {
        table.plugins.texteditor.startEdit(cell);
    }
});
```

### Avec le plugin ContextMenu
```javascript
table.plugins.contextMenu.registerProvider({
    getMenuItems: (cell) => [
        {
            id: 'edit',
            label: 'Éditer',
            action: () => table.plugins.texteditor.startEdit(cell)
        }
    ]
});
```

## Exemples

### Configuration de base
```javascript
const table = new TableFlow({
    plugins: {
        texteditor: {
            autoSave: true,
            maxLength: 1000,
            toolbar: {
                position: 'top',
                buttons: ['bold', 'italic', 'underline']
            }
        }
    }
});
```

### Configuration avancée
```javascript
const table = new TableFlow({
    plugins: {
        texteditor: {
            toolbar: {
                position: 'top',
                sticky: true,
                buttons: {
                    formatting: {
                        type: 'dropdown',
                        icon: 'T',
                        options: ['bold', 'italic', 'underline']
                    },
                    alignment: {
                        type: 'dropdown',
                        icon: '⫏',
                        options: ['left', 'center', 'right']
                    },
                    color: {
                        type: 'color',
                        icon: 'A',
                        colors: ['#000', '#F00', '#0F0', '#00F']
                    }
                }
            },
            style: {
                fontFamily: 'Roboto, sans-serif',
                fontSize: '16px',
                toolbarBackground: '#f5f5f5'
            }
        }
    }
});
```

### Personnalisation des formats
```javascript
table.plugins.texteditor.addFormat({
    name: 'highlight',
    tag: 'mark',
    style: {
        backgroundColor: 'yellow'
    }
});
```

## Dépannage

### Problèmes courants

1. **L'éditeur ne s'affiche pas**
   - Vérifier que le plugin est correctement initialisé
   - Vérifier que la cellule est éditable
   - Vérifier la console pour les erreurs

2. **Les boutons ne fonctionnent pas**
   - Vérifier que les commandes sont supportées
   - Vérifier que le focus est dans l'éditeur
   - Vérifier les permissions du navigateur

3. **L'auto-sauvegarde ne fonctionne pas**
   - Vérifier que l'option est activée
   - Vérifier l'intervalle de sauvegarde
   - Vérifier les hooks de sauvegarde

### Solutions

1. **Réinitialiser l'éditeur**
```javascript
table.plugins.texteditor.destroy();
table.plugins.texteditor.init();
```

2. **Forcer la mise à jour**
```javascript
table.plugins.texteditor.refresh();
```

3. **Déboguer les événements**
```javascript
table.on('texteditor:change', (data) => {
    console.log('Changement:', data);
});
``` 