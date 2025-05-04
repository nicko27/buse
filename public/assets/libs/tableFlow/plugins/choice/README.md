# Plugin Choice

Ce plugin permet d'ajouter des sélections et des listes déroulantes personnalisables à votre tableau TableFlow. Il offre une interface intuitive pour gérer les sélections simples et multiples avec support de recherche et de filtrage.

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
10. [Intégration](#intégration)
11. [Exemples](#exemples)
12. [Dépannage](#dépannage)

## Fonctionnalités

### Sélection
- Sélection simple et multiple
- Recherche et filtrage
- Options personnalisables
- Validation des sélections
- Limites de sélection

### Interface utilisateur
- Menu déroulant personnalisable
- Positionnement automatique
- Icônes et descriptions
- Sélection/désélection globale
- Effacement rapide

### Fonctionnalités avancées
- Recherche floue
- Chargement asynchrone
- Formatage personnalisé
- État désactivé
- Validation personnalisée

### Intégration
- Compatible avec les autres plugins
- API complète
- Hooks personnalisables
- Styles flexibles
- Support des thèmes

## Installation

```javascript
import { ChoicePlugin } from '@tableflow/plugins/choice';

const table = new TableFlow({
    plugins: {
        choice: {
            select: {
                multiple: true,
                searchable: true
            }
        }
    }
});
```

## Configuration

### Options principales

```javascript
{
    // Configuration des sélections
    select: {
        multiple: false,
        searchable: true,
        clearable: true,
        placeholder: 'Sélectionner...',
        maxItems: null,
        minItems: null,
        closeOnSelect: true,
        openOnFocus: true
    },
    
    // Configuration de l'interface
    interface: {
        position: 'bottom',
        alignment: 'left',
        showIcons: true,
        showSearch: true,
        showSelectAll: true
    }
}
```

### Styles personnalisables

```javascript
{
    style: {
        // Select
        selectBackground: '#ffffff',
        selectBorder: '1px solid #e0e0e0',
        selectBorderRadius: '4px',
        
        // Options
        optionBackground: 'transparent',
        optionHoverBackground: '#f5f5f5',
        optionSelectedBackground: '#e3f2fd',
        
        // États
        focusBorderColor: '#2196F3',
        errorBorderColor: '#f44336'
    }
}
```

## Utilisation

### Initialisation de base

```javascript
const table = new TableFlow({
    plugins: {
        choice: {
            select: {
                multiple: false,
                searchable: true
            }
        }
    }
});
```

### Configuration avancée

```javascript
const table = new TableFlow({
    plugins: {
        choice: {
            select: {
                multiple: true,
                searchable: true,
                maxItems: 5,
                minItems: 1,
                placeholder: 'Sélectionner des options...',
                optionFormat: {
                    text: 'label',
                    value: 'id',
                    description: 'desc',
                    icon: 'icon'
                }
            },
            interface: {
                position: 'bottom',
                showIcons: true,
                showSearch: true,
                showSelectAll: true
            }
        }
    }
});
```

## API

### Méthodes principales

- `setValue(value)`: Définit la valeur sélectionnée
- `getValue()`: Récupère la valeur sélectionnée
- `setOptions(options)`: Définit les options disponibles
- `getOptions()`: Récupère les options disponibles
- `open()`: Ouvre le menu déroulant
- `close()`: Ferme le menu déroulant
- `enable()`: Active le select
- `disable()`: Désactive le select
- `clear()`: Efface la sélection
- `refresh()`: Rafraîchit l'affichage

### Méthodes de configuration

```javascript
// Définir les options
choice.setOptions([
    { value: 1, text: 'Option 1' },
    { value: 2, text: 'Option 2', disabled: true },
    { value: 3, text: 'Option 3', icon: '⭐' }
]);

// Définir la valeur
choice.setValue(1);

// Récupérer la valeur
const value = choice.getValue();

// Activer/désactiver
choice.enable();
choice.disable();
```

## Hooks

### Avant la sélection
```javascript
table.hooks.register('beforeSelect', ({ value, options }) => {
    // Valider la sélection
    return true;
});
```

### Après la sélection
```javascript
table.hooks.register('afterSelect', ({ value, options }) => {
    // Effectuer des actions après la sélection
});
```

### Recherche personnalisée
```javascript
table.hooks.register('onSearch', ({ query, options }) => {
    // Filtrer les options selon la recherche
    return filteredOptions;
});
```

## Événements

### Changement de sélection
```javascript
table.on('choice:change', ({ value, options }) => {
    console.log('Sélection modifiée:', value);
});
```

### Ouverture/fermeture
```javascript
table.on('choice:open', () => {
    console.log('Menu ouvert');
});

table.on('choice:close', () => {
    console.log('Menu fermé');
});
```

### Recherche
```javascript
table.on('choice:search', ({ query }) => {
    console.log('Recherche:', query);
});
```

## Styles

### Classes CSS
```css
.tableflow-choice { /* Conteneur principal */ }
.tableflow-select { /* Select */ }
.tableflow-option { /* Options */ }
.tableflow-dropdown { /* Menu déroulant */ }
.tableflow-search { /* Barre de recherche */ }
```

### Variables CSS
```css
.tableflow-choice {
    --select-background: #ffffff;
    --select-border: 1px solid #e0e0e0;
    --select-border-radius: 4px;
    --option-background: transparent;
    --option-hover-background: #f5f5f5;
    --option-selected-background: #e3f2fd;
}
```

## Accessibilité

### Attributs ARIA
- `role="combobox"` sur le select
- `aria-expanded` pour l'état du menu
- `aria-selected` sur les options
- `aria-disabled` pour les options désactivées
- `aria-multiselectable` pour la sélection multiple

### Navigation au clavier
- Espace/Entrée : Ouvre/ferme le menu
- Flèches : Navigation dans les options
- Tab : Navigation entre les éléments
- Échap : Ferme le menu
- Caractères : Recherche rapide

## Intégration

### Avec le plugin Validation
```javascript
table.plugins.validation.addRule('choice', {
    validate: (value) => value && value.length >= 2,
    message: 'Sélectionnez au moins 2 options'
});
```

### Avec le plugin Filter
```javascript
table.plugins.filter.addFilter('choice', {
    type: 'select',
    options: ['Option 1', 'Option 2', 'Option 3']
});
```

## Exemples

### Sélection simple
```javascript
const table = new TableFlow({
    plugins: {
        choice: {
            select: {
                multiple: false,
                searchable: true,
                placeholder: 'Choisir une option'
            }
        }
    }
});
```

### Sélection multiple avec limite
```javascript
const table = new TableFlow({
    plugins: {
        choice: {
            select: {
                multiple: true,
                maxItems: 3,
                minItems: 1,
                placeholder: 'Sélectionner (max 3)'
            }
        }
    }
});
```

### Options avec icônes et descriptions
```javascript
const table = new TableFlow({
    plugins: {
        choice: {
            select: {
                optionFormat: {
                    text: 'label',
                    value: 'id',
                    description: 'desc',
                    icon: 'icon'
                }
            }
        }
    }
});

table.plugins.choice.setOptions([
    {
        id: 1,
        label: 'Option 1',
        desc: 'Description de l\'option 1',
        icon: '⭐'
    },
    {
        id: 2,
        label: 'Option 2',
        desc: 'Description de l\'option 2',
        icon: '📌'
    }
]);
```

## Dépannage

### Problèmes courants

1. **Le menu ne s'ouvre pas**
   - Vérifier que le plugin est correctement initialisé
   - Vérifier les erreurs dans la console
   - Vérifier les conflits de z-index

2. **La recherche ne fonctionne pas**
   - Vérifier que l'option `searchable` est activée
   - Vérifier le format des options
   - Vérifier les hooks de recherche

3. **Les styles ne s'appliquent pas**
   - Vérifier que les classes CSS sont correctes
   - Vérifier la spécificité des sélecteurs
   - Vérifier les variables CSS personnalisées

### Solutions

1. **Réinitialiser le plugin**
```javascript
table.plugins.choice.destroy();
table.plugins.choice.init();
```

2. **Forcer la mise à jour**
```javascript
table.plugins.choice.refresh();
```

3. **Déboguer les événements**
```javascript
table.on('choice:change', (data) => {
    console.log('Changement:', data);
});
``` 