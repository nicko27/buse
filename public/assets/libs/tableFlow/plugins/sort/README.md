# Plugin Sort

Ce plugin permet de trier les colonnes du tableau par ordre croissant ou décroissant.

## Fonctionnalités

- Tri des colonnes par clic sur l'en-tête
- Tri multiple (shift + clic)
- Navigation au clavier
- Icônes de tri personnalisables
- Animations fluides
- Style personnalisable
- Intégration avec le menu contextuel

## Configuration

```javascript
{
    sortClass: 'tableflow-sort',
    sortAscClass: 'tableflow-sort-asc',
    sortDescClass: 'tableflow-sort-desc',
    sortableClass: 'tableflow-sortable',
    headerClass: 'tableflow-sort-header',
    iconClass: 'tableflow-sort-icon',
    animationDuration: 200,
    defaultSort: {
        column: null,
        direction: 'asc'
    },
    keyboard: {
        enabled: true,
        sortOnEnter: true
    },
    style: {
        iconSize: '16px',
        iconColor: '#666666',
        iconColorActive: '#2196F3',
        headerBackground: '#f5f5f5',
        headerBackgroundHover: '#e0e0e0',
        headerBackgroundActive: '#e3f2fd',
        transition: 'all 0.2s ease'
    }
}
```

## Utilisation

```javascript
const table = new TableFlow({
    plugins: {
        sort: {
            defaultSort: {
                column: 'name',
                direction: 'asc'
            }
        }
    }
});

// Trier une colonne programmatiquement
table.plugins.sort.sortColumn('name', 'asc');

// Obtenir l'état de tri actuel
const sortState = table.plugins.sort.getSortState();
```

## Hooks

- `beforeSort`: Avant le tri d'une colonne
- `afterSort`: Après le tri d'une colonne
- `beforeMultiSort`: Avant un tri multiple
- `afterMultiSort`: Après un tri multiple

## Événements

- `sort:change`: Changement de tri
- `sort:error`: Erreur lors du tri
- `sort:reset`: Réinitialisation du tri

## Intégration avec le menu contextuel

Le plugin s'intègre avec le menu contextuel pour offrir des options de tri supplémentaires :

```javascript
table.plugins.contextMenu.registerProvider({
    getMenuItems: (cell) => {
        if (cell.tagName === 'TH') {
            return [
                {
                    id: 'sort-asc',
                    label: 'Trier par ordre croissant',
                    icon: '↑',
                    action: () => table.plugins.sort.sortColumn(cell.dataset.column, 'asc')
                },
                {
                    id: 'sort-desc',
                    label: 'Trier par ordre décroissant',
                    icon: '↓',
                    action: () => table.plugins.sort.sortColumn(cell.dataset.column, 'desc')
                }
            ];
        }
        return [];
    }
});
``` 