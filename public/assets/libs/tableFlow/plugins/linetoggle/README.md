# Plugin LineToggle pour TableFlow

Ce plugin permet de modifier dynamiquement les classes CSS des lignes d'un tableau en fonction de la valeur des cellules. Il supporte des règles complexes basées sur des valeurs exactes, des listes de valeurs ou des expressions régulières.

## Dépendances

- **EditPlugin** (requis) : Pour la détection des changements dans les cellules

## Fonctionnalités

- Application conditionnelle de classes CSS aux lignes
- Règles basées sur des valeurs exactes, listes ou expressions régulières
- Support des règles via configuration ou attributs HTML
- Application automatique à l'initialisation et/ou aux changements
- Animations et transitions personnalisables
- Support du thème sombre
- Accessibilité complète
- Support RTL
- Responsive

## Installation

```javascript
import { LineTogglePlugin } from './plugins/linetoggle/index.js';

const tableFlow = new TableFlow('#myTable', {
    plugins: [
        new EditPlugin(), // Requis
        new LineTogglePlugin({
            apply: {
                onInit: true,
                onChange: true
            },
            rules: {
                'status': [
                    { value: 'active', addClass: 'tf-row-active' },
                    { values: ['pending', 'waiting'], addClass: 'tf-row-pending' },
                    { pattern: '^error-.*$', addClass: 'tf-row-error' }
                ]
            }
        })
    ]
});
```

## Configuration

```javascript
{
    // Options générales
    enabled: true,
    debug: false,

    // Attribut HTML pour activer le plugin
    toggleAttribute: 'th-linetoggle',

    // Application des règles
    apply: {
        onInit: true,      // À l'initialisation
        onChange: true,    // Lors des changements
        onAdd: true,       // Nouvelles lignes
        onEdit: true      // Pendant l'édition
    },

    // Règles par défaut
    rules: {
        'columnId': [
            {
                value: 'exactMatch',           // Valeur exacte
                addClass: 'tf-row-active',     // Classe à ajouter
                removeClass: 'tf-row-inactive'  // Classe à retirer
            },
            {
                values: ['val1', 'val2'],      // Liste de valeurs
                addClass: 'tf-row-pending'
            },
            {
                pattern: '^prefix-.*$',        // Expression régulière
                addClass: 'tf-row-error'
            }
        ]
    }
}
```

## Utilisation

### Via Configuration

```javascript
const linetoggle = new LineTogglePlugin({
    rules: {
        'status': [
            { value: 'active', addClass: 'tf-row-active' },
            { value: 'inactive', addClass: 'tf-row-inactive' },
            { values: ['pending', 'waiting'], addClass: 'tf-row-pending' },
            { pattern: '^error-.*$', addClass: 'tf-row-error' }
        ],
        'priority': [
            { value: 'high', addClass: 'tf-row-warning' },
            { value: 'critical', addClass: 'tf-row-error' }
        ]
    }
});
```

### Via Attributs HTML

```html
<th id="status" th-linetoggle='[
    {"value": "active", "addClass": "tf-row-active"},
    {"values": ["pending", "waiting"], "addClass": "tf-row-pending"}
]'>
    Status
</th>
```

### Classes CSS Prédéfinies

- `tf-row-active` : Style pour les lignes actives
- `tf-row-inactive` : Style pour les lignes inactives
- `tf-row-pending` : Style pour les lignes en attente
- `tf-row-error` : Style pour les lignes en erreur
- `tf-row-warning` : Style pour les lignes avec avertissement
- `tf-row-success` : Style pour les lignes avec succès

## Événements

Le plugin émet les événements suivants :

```javascript
// Avant l'application d'une règle
tableFlow.on('linetoggle:beforeApply', (event) => {
    console.log('Règle à appliquer:', event.detail.rule);
    console.log('Ligne cible:', event.detail.row);
});

// Après l'application d'une règle
tableFlow.on('linetoggle:afterApply', (event) => {
    console.log('Règle appliquée:', event.detail.rule);
    console.log('Classes ajoutées:', event.detail.addedClasses);
});

// Changement d'état
tableFlow.on('linetoggle:stateChange', (event) => {
    console.log('Nouvel état:', event.detail.state);
});
```

## API

### Méthodes Principales

```javascript
const linetoggle = tableFlow.getPlugin('linetoggle');

// Activer/désactiver le plugin
linetoggle.toggle(true);

// Ajouter une règle
linetoggle.addRule('status', {
    value: 'active',
    addClass: 'tf-row-active'
});

// Mettre à jour une règle
linetoggle.updateRule('status', 0, {
    enabled: false
});

// Supprimer une règle
linetoggle.removeRule('status', 0);

// Appliquer les règles à une ligne
linetoggle.applyToRow(rowElement);

// Réinitialiser toutes les règles
linetoggle.reset();
```

## Accessibilité

- Support ARIA complet
- Annonces des changements d'état
- Support de la navigation au clavier
- Compatibilité avec les lecteurs d'écran
- Option pour réduire les animations

## Support des thèmes

Le plugin supporte automatiquement :
- Le thème sombre via `prefers-color-scheme`
- Les thèmes personnalisés via variables CSS
- Le mode RTL

## Performance

- Mise en cache des règles compilées
- Debounce des mises à jour
- Groupement des modifications
- Optimisation des sélecteurs

## Limitations

- Impact sur les performances avec un grand nombre de règles complexes
- Les expressions régulières complexes peuvent affecter les performances
- Certaines animations peuvent être désactivées sur les appareils mobiles

## Compatibilité

- Chrome 76+
- Firefox 68+
- Safari 12.1+
- Edge 79+
- iOS 12.2+
- Android 7+ 