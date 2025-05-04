# Plugin ColumnReorder pour TableFlow

Ce plugin permet de réorganiser les colonnes d'un tableau par glisser-déposer ou au clavier.

## Fonctionnalités

- Glisser-déposer des colonnes
- Navigation au clavier
- Support tactile
- Placeholder visuel pendant le glissement
- Animation fluide
- Support du thème sombre
- Accessibilité (ARIA, navigation au clavier)
- Support RTL
- Responsive

## Installation

```javascript
import { ColumnReorderPlugin } from './plugins/columnreorder/index.js';

const tableFlow = new TableFlow('#myTable', {
    plugins: [
        new ColumnReorderPlugin()
    ]
});
```

## Configuration

```javascript
{
    name: 'ColumnReorder',
    version: '1.0.0',
    type: 'order',
    dependencies: [],
    
    // Classes CSS
    classNames: {
        handleClass: 'tableflow-columnreorder-handle',
        draggingClass: 'tableflow-columnreorder-dragging',
        placeholderClass: 'tableflow-columnreorder-placeholder',
        ghostClass: 'tableflow-columnreorder-ghost'
    },
    
    // Configuration du réordonnancement
    reorder: {
        enabled: true,
        animation: {
            duration: 200,
            easing: 'ease'
        },
        constraints: {
            minWidth: 50,
            maxWidth: 500
        },
        messages: {
            dragHandle: 'Glisser pour réorganiser la colonne',
            dragStart: 'Début du glissement de la colonne',
            dragEnd: 'Fin du glissement de la colonne',
            dragCancel: 'Glissement annulé'
        }
    },
    
    // Configuration de l'interface
    interface: {
        handlePosition: 'left', // 'left' | 'right'
        handleSize: 8,
        handleVisible: 'hover', // 'always' | 'hover' | 'never'
        accessibility: {
            keyboardOnly: false,
            screenReaderText: true
        }
    },
    
    // Styles
    styles: {
        handle: {
            background: '#e0e0e0',
            border: '1px solid #bdbdbd',
            borderRadius: '2px'
        },
        placeholder: {
            background: 'rgba(33, 150, 243, 0.1)',
            border: '2px dashed #2196F3'
        },
        ghost: {
            background: '#ffffff',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
            opacity: 0.5
        }
    },
    
    // Hooks
    hooks: {
        beforeDrag: null,
        afterDrag: null,
        onCancel: null
    }
}
```

## Utilisation

### Glisser-déposer

1. Survolez une colonne pour voir la poignée de réorganisation
2. Cliquez et maintenez la poignée
3. Glissez la colonne à sa nouvelle position
4. Relâchez pour valider

### Navigation au clavier

1. Tab jusqu'à la poignée de la colonne
2. Utilisez les flèches gauche/droite pour déplacer la colonne
3. Appuyez sur Échap pour annuler

## Événements

Le plugin émet les événements suivants :

- `columnReorderStart`: Début du glissement
- `columnReorderMove`: Pendant le glissement
- `columnReorderEnd`: Fin du glissement
- `columnReorderCancel`: Annulation du glissement

```javascript
tableFlow.on('columnReorderEnd', (event) => {
    console.log('Nouvel ordre des colonnes:', event.detail.order);
});
```

## Accessibilité

- Support ARIA
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

- Nécessite un navigateur supportant les événements de glisser-déposer
- Les colonnes fixes ne peuvent pas être réorganisées
- Les colonnes avec une largeur minimale/maximale sont respectées

## Dépendances

- TableFlow core
- Support des événements tactiles (optionnel)

## Compatibilité

- Chrome 76+
- Firefox 68+
- Safari 12.1+
- Edge 79+
- iOS 12.2+
- Android 7+ 