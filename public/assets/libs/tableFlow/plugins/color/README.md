# Plugin Color pour TableFlow

Ce plugin permet d'ajouter un sélecteur de couleurs avancé à votre tableau TableFlow, avec une intégration complète de ColorFlow. Il offre une interface intuitive pour choisir et gérer les couleurs avec support de différents formats et fonctionnalités avancées.

## Table des matières

1. [Prérequis](#prérequis)
2. [Fonctionnalités](#fonctionnalités)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Utilisation](#utilisation)
6. [API](#api)
7. [Événements](#événements)
8. [Styles](#styles)
9. [Accessibilité](#accessibilité)
10. [Exemples](#exemples)
11. [Dépannage](#dépannage)

## Prérequis

- TableFlow v1.0.0 ou supérieur
- ColorFlow (bibliothèque de sélection de couleurs)
- Navigateur moderne avec support ES6

## Fonctionnalités

### Intégration ColorFlow
- Sélecteur de couleurs ColorFlow intégré
- Support complet des fonctionnalités ColorFlow
- Conversion automatique des formats de couleur
- Interface utilisateur cohérente

### Gestion des couleurs
- Support de multiples formats (HEX, RGB, HSL)
- Conversion automatique en hexadécimal
- Validation des couleurs
- Prévisualisation en temps réel

### Interface utilisateur
- Aperçu de la couleur
- Champ de saisie directe
- Intégration transparente avec TableFlow
- Support des thèmes sombres

### Fonctionnalités avancées
- Détection automatique des colonnes de couleur
- Sauvegarde automatique des valeurs
- Gestion des modifications
- Support des cellules en lecture seule

## Installation

1. Assurez-vous d'avoir ColorFlow installé dans votre projet
2. Importez et initialisez le plugin :

```javascript
import { ColorPlugin } from '@tableflow/plugins/color';

const table = new TableFlow({
    plugins: {
        color: {
            // Options de configuration
            colorAttribute: 'th-color',
            cellClass: 'td-color',
            customClass: 'my-color-picker'
        }
    }
});
```

## Configuration

### Structure HTML

```html
<table id="myTable">
    <thead>
        <tr>
            <th>Nom</th>
            <th th-color>Couleur</th> <!-- Colonne avec sélecteur de couleur -->
        </tr>
    </thead>
    <tbody>
        <tr>
            <td>Item 1</td>
            <td data-value="#FF0000">Rouge</td>
        </tr>
    </tbody>
</table>
```

### Options de configuration

```javascript
{
    // Attributs et classes
    colorAttribute: 'th-color',     // Attribut pour identifier les colonnes de couleur
    cellClass: 'td-color',         // Classe CSS pour les cellules de couleur
    readOnlyClass: 'readonly',     // Classe pour les cellules en lecture seule
    modifiedClass: 'modified',     // Classe pour les lignes modifiées
    
    // Options ColorFlow
    customClass: '',               // Classe CSS personnalisée pour ColorFlow
    
    // Débogage
    debug: false                   // Active les logs de débogage
}
```

## Utilisation

### Initialisation basique

```javascript
const table = new TableFlow({
    plugins: {
        color: {
            colorAttribute: 'th-color'
        }
    }
});
```

### Configuration avancée

```javascript
const table = new TableFlow({
    plugins: {
        color: {
            colorAttribute: 'th-color',
            cellClass: 'custom-color-cell',
            customClass: 'custom-color-picker',
            debug: true
        }
    }
});
```

## API

### Méthodes du plugin

- `init(tableFlow)`: Initialise le plugin avec une instance TableFlow
- `setupColorCells()`: Configure les cellules de couleur
- `updateValue(cell, value)`: Met à jour la valeur d'une cellule
- `toHexColor(color)`: Convertit une couleur en format hexadécimal
- `destroy()`: Nettoie le plugin et ses événements

### Attributs de données

- `data-value`: Valeur actuelle de la couleur (hexadécimal)
- `data-initial-value`: Valeur initiale de la couleur
- `data-plugin="color"`: Identifie les cellules gérées par le plugin

## Événements

### Événements émis

```javascript
// Changement de couleur
table.on('cell:change', ({ detail }) => {
    const { cellId, oldValue, newValue } = detail;
    console.log(`Couleur changée: ${oldValue} -> ${newValue}`);
});

// Sauvegarde de cellule
table.on('cell:saved', ({ detail }) => {
    const { cell, value } = detail;
    console.log(`Cellule sauvegardée avec la couleur: ${value}`);
});
```

### Événements écoutés

- `cell:saved`: Mise à jour de la valeur initiale après sauvegarde
- `row:saved`: Mise à jour des valeurs initiales de la ligne
- `row:added`: Configuration des nouvelles cellules de couleur

## Styles

### Classes CSS

```css
/* Conteneur de la cellule de couleur */
.td-color {
    /* Styles personnalisés */
}

/* Wrapper du sélecteur de couleur */
.tf-color-wrapper {
    display: flex;
    align-items: center;
    gap: 5px;
}

/* Input de couleur */
.color-input {
    width: 80px;
    text-align: center;
}

/* État modifié */
.modified {
    background-color: rgba(255, 255, 0, 0.1);
}
```

## Accessibilité

- Support complet des attributs ARIA
- Navigation au clavier
- Messages d'état et de validation
- Contraste et visibilité optimisés

## Exemples

### Exemple basique

```javascript
const table = new TableFlow({
    plugins: {
        color: {
            colorAttribute: 'th-color'
        }
    }
});
```

### Exemple avec validation

```javascript
const table = new TableFlow({
    plugins: {
        color: {
            colorAttribute: 'th-color',
            validate: (color) => {
                // Validation personnalisée
                return /^#[0-9A-F]{6}$/i.test(color);
            }
        }
    }
});
```

### Exemple avec ColorFlow personnalisé

```javascript
const table = new TableFlow({
    plugins: {
        color: {
            colorAttribute: 'th-color',
            customClass: 'custom-picker',
            // Options spécifiques à ColorFlow
            colorFlow: {
                format: 'hex',
                showAlpha: false
            }
        }
    }
});
```

## Dépannage

### Problèmes courants

1. **ColorFlow non détecté**
   ```javascript
   // Vérifier que ColorFlow est chargé avant TableFlow
   <script src="colorflow.js"></script>
   <script src="tableflow.js"></script>
   ```

2. **Couleurs non sauvegardées**
   ```javascript
   // Vérifier les événements de sauvegarde
   table.on('cell:saved', (event) => {
       console.log('Sauvegarde:', event.detail);
   });
   ```

3. **Styles non appliqués**
   ```css
   /* Ajouter les styles nécessaires */
   .tf-color-wrapper {
       display: flex !important;
       align-items: center !important;
   }
   ```

### Solutions

1. **Réinitialisation du plugin**
   ```javascript
   table.plugins.color.destroy();
   table.plugins.color.init(table);
   ```

2. **Mise à jour forcée**
   ```javascript
   table.plugins.color.setupColorCells();
   ```

3. **Débogage**
   ```javascript
   const table = new TableFlow({
       plugins: {
           color: {
               debug: true
           }
       }
   });
   ``` 