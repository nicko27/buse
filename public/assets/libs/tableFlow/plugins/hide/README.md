# Plugin Hide pour TableFlow

Ce plugin permet de masquer/afficher des colonnes dans un tableau avec une interface utilisateur intuitive.

## Fonctionnalités

- Menu de sélection des colonnes à afficher/masquer
- Bouton de basculement rapide
- Option "Tout afficher/masquer"
- Compteur de colonnes visibles
- Persistance de l'état
- Support du thème sombre
- Accessibilité complète
- Support RTL
- Responsive

## Installation

```javascript
import { HidePlugin } from './plugins/hide/index.js';

const tableFlow = new TableFlow('#myTable', {
    plugins: [
        new HidePlugin()
    ]
});
```

## Configuration

```javascript
{
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
            position: 'right',
            showLabels: true,
            showIcons: true,
            showCounter: true,
            maxHeight: 400,
            messages: {
                title: 'Colonnes visibles',
                toggleAll: 'Tout afficher/masquer',
                noColumns: 'Aucune colonne disponible',
                counter: '{visible} sur {total} colonnes'
            }
        },
        
        // Configuration de l'interface
        interface: {
            buttonPosition: 'header',
            buttonIcon: '👁️',
            buttonText: 'Afficher/Masquer',
            closeOnSelect: false,
            closeOnClickOutside: true,
            saveState: true,
            ariaLabels: true,
            keyboardNavigation: true
        }
    }
}
```

## Utilisation

### Interface utilisateur

1. Cliquez sur le bouton "Afficher/Masquer" pour ouvrir le menu
2. Cochez/décochez les colonnes à afficher/masquer
3. Utilisez l'option "Tout afficher/masquer" pour une action globale
4. Le compteur indique le nombre de colonnes visibles

### Navigation au clavier

- `Tab` : Navigation entre les éléments
- `Espace`/`Entrée` : Sélection d'un élément
- `Flèches` : Navigation dans le menu
- `Échap` : Fermeture du menu
- `Début`/`Fin` : Aller au début/fin du menu

## Événements

Le plugin émet les événements suivants :

- `columnHide` : Une colonne est masquée
- `columnShow` : Une colonne est affichée
- `stateChange` : L'état des colonnes change

```javascript
tableFlow.on('columnHide', (event) => {
    console.log('Colonne masquée:', event.detail.column);
});

tableFlow.on('stateChange', (event) => {
    console.log('Nouvel état:', event.detail.state);
});
```

## Hooks

Des hooks sont disponibles pour personnaliser le comportement :

```javascript
{
    hooks: {
        beforeHide: (column) => {
            // Avant de masquer une colonne
        },
        afterHide: (column) => {
            // Après avoir masqué une colonne
        },
        beforeShow: (column) => {
            // Avant d'afficher une colonne
        },
        afterShow: (column) => {
            // Après avoir affiché une colonne
        },
        beforeStateUpdate: (state) => {
            // Avant la mise à jour de l'état
        },
        afterStateUpdate: (state) => {
            // Après la mise à jour de l'état
        }
    }
}
```

## Persistance

Le plugin peut sauvegarder l'état des colonnes :

```javascript
{
    storage: {
        enabled: true,
        key: 'tableflow-hidden-columns',
        type: 'localStorage' // ou 'sessionStorage'
    }
}
```

## Accessibilité

- Support ARIA complet
- Navigation au clavier
- Messages pour lecteurs d'écran
- Contraste suffisant
- Focus visible

## Support des thèmes

Le plugin supporte automatiquement :
- Le thème sombre
- Les thèmes personnalisés via CSS variables
- Le mode RTL

## Limitations

- Les colonnes fixes ne peuvent pas être masquées
- Au moins une colonne doit rester visible
- La persistance nécessite le support du stockage local

## Dépendances

- TableFlow core

## Compatibilité

- Chrome 76+
- Firefox 68+
- Safari 12.1+
- Edge 79+
- iOS 12.2+
- Android 7+ 