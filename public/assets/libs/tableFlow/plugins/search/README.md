# Plugin Search pour TableFlow

Ce plugin ajoute une fonctionnalité de recherche avancée à votre tableau TableFlow. Il permet de rechercher du texte dans les cellules du tableau avec des options de recherche flexibles et une interface utilisateur intuitive.

## Table des matières

1. [Fonctionnalités](#fonctionnalités)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Utilisation](#utilisation)
5. [API](#api)
6. [Événements](#événements)
7. [Styles](#styles)
8. [Accessibilité](#accessibilité)
9. [Exemples](#exemples)
10. [Dépannage](#dépannage)

## Fonctionnalités

### Recherche
- Recherche en temps réel
- Support des expressions régulières
- Recherche sensible à la casse
- Recherche de mots entiers
- Mise en surbrillance des résultats
- Limitation du nombre de résultats

### Interface utilisateur
- Barre de recherche intuitive
- Liste des résultats déroulante
- Navigation au clavier
- Messages d'état
- Thème sombre
- Support responsive

### Accessibilité
- Support ARIA
- Navigation au clavier
- Focus visible
- Support RTL

## Installation

```javascript
import { SearchPlugin } from '@tableflow/plugins/search';

const table = new TableFlow({
    plugins: {
        search: {
            // Options de configuration
            search: {
                caseSensitive: false,
                wholeWord: false,
                regex: false
            }
        }
    }
});
```

## Configuration

### Options principales

```javascript
{
    // Configuration de la recherche
    search: {
        caseSensitive: false,
        wholeWord: false,
        regex: false,
        highlight: true,
        debounce: 300,
        maxResults: 100,
        minLength: 2
    },
    
    // Configuration de l'interface
    interface: {
        position: 'top',
        alignment: 'right',
        showResults: true,
        showCount: true,
        showClear: true
    }
}
```

## Utilisation

### Recherche de base

```javascript
const table = new TableFlow({
    plugins: {
        search: {
            search: {
                caseSensitive: false,
                wholeWord: false
            }
        }
    }
});
```

### Recherche avancée

```javascript
const table = new TableFlow({
    plugins: {
        search: {
            search: {
                caseSensitive: true,
                wholeWord: true,
                regex: true,
                highlight: true
            }
        }
    }
});
```

## API

### Méthodes principales

- `search(query)`: Effectue une recherche
- `clear()`: Efface la recherche
- `focus()`: Met le focus sur l'input
- `blur()`: Retire le focus de l'input
- `destroy()`: Détruit le plugin

### Hooks

```javascript
// Avant la recherche
table.hooks.register('beforeSearch', (context) => {
    // Personnaliser la recherche
    return true;
});

// Après la recherche
table.hooks.register('afterSearch', (context) => {
    // Traiter les résultats
});

// Avant la sélection
table.hooks.register('beforeSelect', (context) => {
    // Valider la sélection
    return true;
});
```

## Événements

### Événements de recherche

```javascript
// Début de la recherche
table.on('search:start', (event) => {
    console.log('Recherche démarrée:', event.detail);
});

// Fin de la recherche
table.on('search:end', (event) => {
    console.log('Recherche terminée:', event.detail);
});

// Sélection d'un résultat
table.on('search:select', (event) => {
    console.log('Résultat sélectionné:', event.detail);
});
```

## Styles

### Classes CSS principales

```css
/* Conteneur de recherche */
.tableflow-search {
    /* Styles du conteneur */
}

/* Input de recherche */
.tableflow-search-input {
    /* Styles de l'input */
}

/* Résultats de recherche */
.tableflow-search-results {
    /* Styles des résultats */
}
```

### Variables CSS

```css
.tableflow-search {
    --container-background: #ffffff;
    --container-border: 1px solid #e0e0e0;
    --input-padding: 8px 12px;
    --highlight-background: #fff3cd;
    /* ... autres variables */
}
```

## Accessibilité

### Attributs ARIA
- `role="search"` sur le conteneur
- `role="listbox"` sur les résultats
- `role="option"` sur les éléments
- `aria-label` pour les descriptions
- `aria-selected` pour la sélection

### Navigation au clavier
- Flèches : Navigation entre les résultats
- Entrée : Sélection d'un résultat
- Échap : Fermeture des résultats
- Tab : Navigation focusable

## Exemples

### Recherche simple

```javascript
const table = new TableFlow({
    plugins: {
        search: {
            search: {
                caseSensitive: false,
                wholeWord: false
            }
        }
    }
});
```

### Recherche avec personnalisation

```javascript
const table = new TableFlow({
    plugins: {
        search: {
            search: {
                caseSensitive: true,
                wholeWord: true,
                regex: true
            },
            interface: {
                position: 'bottom',
                alignment: 'left'
            }
        }
    }
});
```

## Dépannage

### Problèmes courants

1. **La recherche ne fonctionne pas**
   - Vérifier que le plugin est correctement initialisé
   - Vérifier les options de recherche
   - Vérifier les hooks beforeSearch

2. **Les résultats ne s'affichent pas**
   - Vérifier les styles CSS
   - Vérifier la position du conteneur
   - Vérifier les messages d'erreur

3. **La navigation au clavier ne fonctionne pas**
   - Vérifier les attributs ARIA
   - Vérifier les événements clavier
   - Vérifier le focus

### Solutions

1. **Réinitialisation du plugin**
```javascript
table.plugins.search.destroy();
table.plugins.search.init(table);
```

2. **Mise à jour des options**
```javascript
table.plugins.search.config.search.caseSensitive = true;
```

3. **Débogage**
```javascript
const table = new TableFlow({
    plugins: {
        search: {
            debug: true
        }
    }
});
``` 