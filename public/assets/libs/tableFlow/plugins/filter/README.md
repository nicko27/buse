# Plugin Filter

Ce plugin permet de filtrer les données du tableau selon différents critères.

## Fonctionnalités

- Filtrage par colonne
- Différents opérateurs de filtrage (contient, égal, commence par, etc.)
- Interface utilisateur intuitive
- Navigation au clavier
- Animations fluides
- Style personnalisable
- Intégration avec le menu contextuel

## Configuration

```javascript
{
    filterClass: 'tableflow-filter',
    filterInputClass: 'tableflow-filter-input',
    filterButtonClass: 'tableflow-filter-button',
    filterActiveClass: 'tableflow-filter-active',
    filterIconClass: 'tableflow-filter-icon',
    filterDropdownClass: 'tableflow-filter-dropdown',
    filterOptionClass: 'tableflow-filter-option',
    animationDuration: 200,
    defaultFilter: {
        column: null,
        value: '',
        operator: 'contains'
    },
    keyboard: {
        enabled: true,
        filterOnEnter: true,
        closeOnEscape: true
    },
    style: {
        inputWidth: '200px',
        inputHeight: '32px',
        inputPadding: '8px',
        inputBorderColor: '#e0e0e0',
        inputBorderColorFocus: '#2196F3',
        inputBackground: '#ffffff',
        inputTextColor: '#333333',
        dropdownWidth: '200px',
        dropdownBackground: '#ffffff',
        dropdownBorderColor: '#e0e0e0',
        dropdownShadow: '0 2px 5px rgba(0,0,0,0.1)',
        optionHoverColor: '#f5f5f5',
        optionActiveColor: '#e3f2fd',
        iconColor: '#666666',
        iconColorActive: '#2196F3',
        transition: 'all 0.2s ease'
    }
}
```

## Utilisation

```javascript
const table = new TableFlow({
    plugins: {
        filter: {
            defaultFilter: {
                column: 'name',
                value: 'John',
                operator: 'contains'
            }
        }
    }
});

// Appliquer un filtre programmatiquement
table.plugins.filter.applyFilter({
    column: 'age',
    value: '30',
    operator: 'greaterThan'
});

// Obtenir l'état des filtres actuels
const filterState = table.plugins.filter.getFilterState();
```

## Opérateurs de filtrage

- `contains`: La valeur contient le texte recherché
- `equals`: La valeur est exactement égale au texte recherché
- `startsWith`: La valeur commence par le texte recherché
- `endsWith`: La valeur se termine par le texte recherché
- `greaterThan`: La valeur est supérieure au nombre recherché
- `lessThan`: La valeur est inférieure au nombre recherché

## Hooks

- `beforeFilter`: Avant l'application d'un filtre
- `afterFilter`: Après l'application d'un filtre
- `beforeClear`: Avant la suppression d'un filtre
- `afterClear`: Après la suppression d'un filtre

## Événements

- `filter:change`: Changement de filtre
- `filter:error`: Erreur lors du filtrage
- `filter:clear`: Suppression d'un filtre

## Intégration avec le menu contextuel

Le plugin s'intègre avec le menu contextuel pour offrir des options de filtrage supplémentaires :

```javascript
table.plugins.contextMenu.registerProvider({
    getMenuItems: (cell) => {
        if (cell.tagName === 'TH') {
            return [
                {
                    id: 'filter',
                    label: 'Filtrer',
                    icon: '🔍',
                    action: () => table.plugins.filter.showFilter(cell.dataset.column)
                }
            ];
        }
        return [];
    }
});
``` 