# Plugin Selection

Ce plugin permet d'ajouter des fonctionnalités avancées de sélection à votre tableau TableFlow. Il offre une expérience utilisateur riche avec la sélection de lignes et de cellules, la sélection multiple, la sélection par plage, et l'intégration avec le presse-papiers.

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

### Sélection de base
- Sélection de lignes individuelles
- Sélection de cellules individuelles
- Sélection par clic et par clavier
- Indicateurs visuels de sélection
- Mode de sélection configurable (ligne/cellule/les deux)

### Sélection avancée
- Sélection multiple avec Ctrl/Cmd
- Sélection par plage avec Shift
- Sélection de toutes les lignes/cellules
- Limitation du nombre de sélections
- Désélection automatique

### Manipulation
- Copier/Coller les sélections
- Supprimer les sélections
- Déplacer les sélections avec le clavier
- Étendre les sélections avec Shift + flèches
- Format personnalisable pour le presse-papiers

### Intégration
- Menu contextuel pour les actions de sélection
- Synchronisation avec d'autres plugins
- API complète pour la gestion des sélections
- Hooks pour personnaliser le comportement
- Événements pour suivre les changements

## Installation

```javascript
import { SelectionPlugin } from '@tableflow/plugins/selection';

const table = new TableFlow({
    plugins: {
        selection: {
            selectionMode: 'both',
            enableMultiSelect: true
        }
    }
});
```

## Configuration

### Options principales

```javascript
{
    // Classes CSS
    selectionClass: 'tableflow-selection',
    selectedRowClass: 'tableflow-row-selected',
    selectedCellClass: 'tableflow-cell-selected',
    multiSelectClass: 'tableflow-multi-select',
    rangeSelectClass: 'tableflow-range-select',
    
    // Configuration par défaut
    enableRowSelection: true,
    enableCellSelection: true,
    enableMultiSelect: true,
    enableRangeSelect: true,
    enableKeyboardNavigation: true,
    enableClipboard: true,
    maxSelections: 1000,
    
    // Modes de sélection
    selectionMode: 'row', // 'row' | 'cell' | 'both'
    multiSelectMode: 'ctrl', // 'ctrl' | 'shift' | 'both'
    
    // Raccourcis clavier
    keyboard: {
        enabled: true,
        selectAll: 'ctrl+a',
        copy: 'ctrl+c',
        cut: 'ctrl+x',
        paste: 'ctrl+v',
        delete: 'delete',
        moveUp: 'arrowup',
        moveDown: 'arrowdown',
        moveLeft: 'arrowleft',
        moveRight: 'arrowright',
        extendUp: 'shift+arrowup',
        extendDown: 'shift+arrowdown',
        extendLeft: 'shift+arrowleft',
        extendRight: 'shift+arrowright'
    }
}
```

### Styles

```javascript
{
    style: {
        // Sélection de ligne
        rowSelectedBackground: 'rgba(33, 150, 243, 0.1)',
        rowSelectedBorder: '1px solid rgba(33, 150, 243, 0.2)',
        rowSelectedColor: 'inherit',
        
        // Sélection de cellule
        cellSelectedBackground: 'rgba(33, 150, 243, 0.1)',
        cellSelectedBorder: '1px solid rgba(33, 150, 243, 0.2)',
        cellSelectedColor: 'inherit',
        
        // Sélection multiple
        multiSelectBackground: 'rgba(33, 150, 243, 0.15)',
        multiSelectBorder: '1px solid rgba(33, 150, 243, 0.3)',
        
        // Sélection par plage
        rangeSelectBackground: 'rgba(33, 150, 243, 0.05)',
        rangeSelectBorder: '1px dashed rgba(33, 150, 243, 0.3)',
        
        // Focus
        focusOutline: '2px solid rgba(33, 150, 243, 0.5)',
        focusOutlineOffset: '-2px',
        
        // Transitions
        transition: 'all 0.2s ease'
    }
}
```

### Configuration du presse-papiers

```javascript
{
    clipboard: {
        enabled: true,
        separator: '\t',
        formatHeaders: true,
        includeHeaders: true,
        formatData: true
    }
}
```

## Utilisation

### Sélection de base

```javascript
// Sélectionner une ligne
table.plugins.selection.selectRow(1);

// Sélectionner une cellule
table.plugins.selection.selectCell(1, 2);

// Sélectionner plusieurs lignes
table.plugins.selection.selectRows([1, 3, 5]);

// Sélectionner une plage de cellules
table.plugins.selection.selectRange({
    startRow: 1,
    startCol: 1,
    endRow: 3,
    endCol: 3
});
```

### Manipulation des sélections

```javascript
// Copier la sélection
const data = table.plugins.selection.copy();

// Coller des données
table.plugins.selection.paste(data);

// Supprimer la sélection
table.plugins.selection.delete();

// Obtenir les éléments sélectionnés
const selected = table.plugins.selection.getSelected();
```

### Gestion des événements

```javascript
// Écouter les changements de sélection
table.on('selection:change', (selection) => {
    console.log('Nouvelle sélection:', selection);
});

// Écouter les actions de copier/coller
table.on('selection:copy', (data) => {
    console.log('Données copiées:', data);
});
```

## API

### Méthodes de sélection

- `selectRow(rowIndex)`: Sélectionne une ligne
- `selectRows(rowIndexes)`: Sélectionne plusieurs lignes
- `selectCell(rowIndex, colIndex)`: Sélectionne une cellule
- `selectCells(cells)`: Sélectionne plusieurs cellules
- `selectRange(range)`: Sélectionne une plage
- `selectAll()`: Sélectionne tout
- `clearSelection()`: Efface la sélection

### Méthodes de manipulation

- `copy()`: Copie la sélection
- `cut()`: Coupe la sélection
- `paste(data)`: Colle des données
- `delete()`: Supprime la sélection
- `moveSelection(direction)`: Déplace la sélection
- `extendSelection(direction)`: Étend la sélection

### Méthodes d'information

- `getSelected()`: Retourne les éléments sélectionnés
- `isSelected(rowIndex, colIndex)`: Vérifie si un élément est sélectionné
- `getSelectionType()`: Retourne le type de sélection
- `getSelectionRange()`: Retourne la plage de sélection

## Hooks

### Avant la sélection
```javascript
table.hooks.register('beforeSelect', ({ type, indexes }) => {
    // Vérifier si la sélection est autorisée
    return true;
});
```

### Après la sélection
```javascript
table.hooks.register('afterSelect', ({ type, indexes }) => {
    // Effectuer des actions après la sélection
});
```

### Avant la copie
```javascript
table.hooks.register('beforeCopy', (selection) => {
    // Personnaliser les données à copier
    return selection;
});
```

### Avant le collage
```javascript
table.hooks.register('beforePaste', (data) => {
    // Valider ou transformer les données
    return data;
});
```

## Événements

### Changement de sélection
```javascript
table.on('selection:change', ({ type, indexes }) => {
    console.log(`Sélection changée: ${type}`, indexes);
});
```

### Actions de manipulation
```javascript
table.on('selection:copy', (data) => {
    console.log('Données copiées:', data);
});

table.on('selection:paste', (data) => {
    console.log('Données collées:', data);
});

table.on('selection:delete', (selection) => {
    console.log('Sélection supprimée:', selection);
});
```

## Styles

### Classes CSS
```css
.tableflow-selection { /* Style de base */ }
.tableflow-row-selected { /* Ligne sélectionnée */ }
.tableflow-cell-selected { /* Cellule sélectionnée */ }
.tableflow-multi-select { /* Sélection multiple */ }
.tableflow-range-select { /* Sélection par plage */ }
```

### Variables CSS
```css
.tableflow-selection {
    --row-selected-background: rgba(33, 150, 243, 0.1);
    --row-selected-border: 1px solid rgba(33, 150, 243, 0.2);
    --cell-selected-background: rgba(33, 150, 243, 0.1);
    --cell-selected-border: 1px solid rgba(33, 150, 243, 0.2);
    --multi-select-background: rgba(33, 150, 243, 0.15);
    --range-select-background: rgba(33, 150, 243, 0.05);
    --focus-outline: 2px solid rgba(33, 150, 243, 0.5);
}
```

## Accessibilité

### Attributs ARIA
- `aria-selected="true"` sur les éléments sélectionnés
- `aria-multiselectable="true"` sur le tableau
- `role="grid"` sur le tableau
- `role="row"` sur les lignes
- `role="cell"` sur les cellules

### Navigation au clavier
- Flèches : Déplacement de la sélection
- Shift + Flèches : Extension de la sélection
- Ctrl/Cmd + A : Sélection totale
- Espace : Sélection de l'élément actif
- Entrée : Validation de la sélection

## Raccourcis clavier

| Action | Raccourci |
|--------|-----------|
| Sélectionner tout | Ctrl/Cmd + A |
| Copier | Ctrl/Cmd + C |
| Couper | Ctrl/Cmd + X |
| Coller | Ctrl/Cmd + V |
| Supprimer | Delete |
| Déplacer haut | ↑ |
| Déplacer bas | ↓ |
| Déplacer gauche | ← |
| Déplacer droite | → |
| Étendre haut | Shift + ↑ |
| Étendre bas | Shift + ↓ |
| Étendre gauche | Shift + ← |
| Étendre droite | Shift + → |

## Intégration

### Avec le plugin Edit
```javascript
table.hooks.register('afterSelect', ({ type, indexes }) => {
    if (type === 'cell') {
        table.plugins.edit.startEdit(indexes.row, indexes.col);
    }
});
```

### Avec le plugin ContextMenu
```javascript
table.plugins.contextMenu.registerProvider({
    getMenuItems: (cell) => [
        {
            id: 'copy',
            label: 'Copier',
            action: () => table.plugins.selection.copy()
        },
        {
            id: 'paste',
            label: 'Coller',
            action: () => table.plugins.selection.paste()
        }
    ]
});
```

## Exemples

### Configuration de base
```javascript
const table = new TableFlow({
    plugins: {
        selection: {
            selectionMode: 'both',
            enableMultiSelect: true,
            enableRangeSelect: true
        }
    }
});
```

### Configuration avancée
```javascript
const table = new TableFlow({
    plugins: {
        selection: {
            selectionMode: 'cell',
            multiSelectMode: 'both',
            maxSelections: 500,
            style: {
                cellSelectedBackground: '#e3f2fd',
                cellSelectedBorder: '2px solid #2196F3'
            },
            clipboard: {
                separator: ',',
                formatHeaders: true
            }
        }
    }
});
```

### Personnalisation des sélections
```javascript
table.hooks.register('beforeSelect', ({ type, indexes }) => {
    // Empêcher la sélection de certaines cellules
    if (type === 'cell') {
        const cell = table.getCell(indexes.row, indexes.col);
        return !cell.classList.contains('non-selectable');
    }
    return true;
});
```

## Dépannage

### Problèmes courants

1. **La sélection ne fonctionne pas**
   - Vérifier que le plugin est correctement initialisé
   - Vérifier les conflits avec d'autres plugins
   - Vérifier la console pour les erreurs

2. **Le copier/coller ne fonctionne pas**
   - Vérifier que le presse-papiers est activé
   - Vérifier les permissions du navigateur
   - Vérifier le format des données

3. **Les styles ne s'appliquent pas**
   - Vérifier que le CSS est chargé
   - Vérifier les priorités des styles
   - Vérifier les variables CSS

### Solutions

1. **Réinitialiser les sélections**
```javascript
table.plugins.selection.clearSelection();
table.plugins.selection.init();
```

2. **Forcer la mise à jour**
```javascript
table.plugins.selection.refresh();
```

3. **Déboguer les événements**
```javascript
table.on('selection:change', (data) => {
    console.log('Sélection:', data);
});
``` 