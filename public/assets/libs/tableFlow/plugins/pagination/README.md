# Plugin Pagination

Ce plugin permet d'ajouter une pagination complète et personnalisable à votre tableau TableFlow. Il offre une navigation intuitive, un contrôle de la taille des pages, et une intégration parfaite avec les autres plugins.

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
10. [Responsive](#responsive)
11. [Intégration](#intégration)
12. [Exemples](#exemples)
13. [Dépannage](#dépannage)

## Fonctionnalités

### Navigation
- Navigation entre les pages avec des boutons Précédent/Suivant
- Accès direct aux première et dernière pages
- Affichage intelligent des numéros de page avec ellipses
- Navigation au clavier (flèches, Home, End)
- Indicateur visuel de la page active

### Personnalisation
- Choix du nombre d'éléments par page
- Configuration des tailles de page disponibles
- Personnalisation complète des styles via CSS
- Affichage/masquage des éléments de navigation
- Limitation du nombre de pages visibles

### Informations
- Affichage des informations de pagination (éléments affichés, total)
- Mise à jour dynamique des informations
- Formatage personnalisable des informations

### Intégration
- Compatible avec les autres plugins TableFlow
- Synchronisation automatique avec le filtrage et le tri
- Gestion des événements de pagination
- Système de hooks pour personnaliser le comportement

## Installation

```javascript
import { PaginationPlugin } from '@tableflow/plugins/pagination';

const table = new TableFlow({
    plugins: {
        pagination: {
            defaultPage: 1,
            defaultSize: 10
        }
    }
});
```

## Configuration

### Options principales

```javascript
{
    // Classes CSS
    paginationClass: 'tableflow-pagination',
    pageClass: 'tableflow-page',
    activePageClass: 'tableflow-page-active',
    disabledPageClass: 'tableflow-page-disabled',
    prevPageClass: 'tableflow-page-prev',
    nextPageClass: 'tableflow-page-next',
    firstPageClass: 'tableflow-page-first',
    lastPageClass: 'tableflow-page-last',
    ellipsisClass: 'tableflow-page-ellipsis',
    infoClass: 'tableflow-pagination-info',
    sizeSelectorClass: 'tableflow-size-selector',
    
    // Configuration par défaut
    defaultPage: 1,
    defaultSize: 10,
    sizes: [5, 10, 20, 50, 100],
    showFirstLast: true,
    showPrevNext: true,
    showInfo: true,
    showSizeSelector: true,
    maxVisiblePages: 5,
    
    // Navigation au clavier
    keyboard: {
        enabled: true,
        prevPageKey: 'ArrowLeft',
        nextPageKey: 'ArrowRight',
        firstPageKey: 'Home',
        lastPageKey: 'End'
    }
}
```

### Styles

```javascript
{
    style: {
        // Conteneur principal
        containerBackground: '#ffffff',
        containerBorder: '1px solid #e0e0e0',
        containerBorderRadius: '4px',
        containerPadding: '8px',
        containerMargin: '16px 0',
        
        // Pages
        pageSize: '32px',
        pagePadding: '0 12px',
        pageMargin: '0 4px',
        pageBorder: '1px solid #e0e0e0',
        pageBorderRadius: '4px',
        pageBackground: '#ffffff',
        pageColor: '#333333',
        pageHoverBackground: '#f5f5f5',
        pageHoverColor: '#2196F3',
        pageActiveBackground: '#2196F3',
        pageActiveColor: '#ffffff',
        pageDisabledBackground: '#f5f5f5',
        pageDisabledColor: '#999999',
        
        // Sélecteur de taille
        selectorWidth: '80px',
        selectorHeight: '32px',
        selectorPadding: '0 8px',
        selectorBorder: '1px solid #e0e0e0',
        selectorBorderRadius: '4px',
        selectorBackground: '#ffffff',
        selectorColor: '#333333',
        
        // Info
        infoColor: '#666666',
        infoFontSize: '14px',
        infoMargin: '0 16px',
        
        // Transitions
        transition: 'all 0.2s ease',
        
        // Responsive
        mobileBreakpoint: '768px',
        mobilePageSize: '28px',
        mobilePagePadding: '0 8px',
        mobileInfoFontSize: '12px'
    }
}
```

## Utilisation

### Initialisation de base

```javascript
const table = new TableFlow({
    plugins: {
        pagination: {
            defaultPage: 1,
            defaultSize: 10,
            sizes: [5, 10, 20, 50, 100]
        }
    }
});
```

### Navigation programmatique

```javascript
// Aller à une page spécifique
table.plugins.pagination.goToPage(3);

// Changer la taille de la page
table.plugins.pagination.setPageSize(20);

// Obtenir l'état actuel
const state = table.plugins.pagination.getState();
console.log(state.currentPage, state.pageSize, state.totalPages);
```

### Personnalisation de l'affichage

```javascript
const table = new TableFlow({
    plugins: {
        pagination: {
            showFirstLast: false,
            showInfo: false,
            maxVisiblePages: 3,
            style: {
                pageActiveBackground: '#ff0000',
                pageActiveColor: '#ffffff'
            }
        }
    }
});
```

## API

### Méthodes

- `goToPage(page: number)`: Navigue vers une page spécifique
- `nextPage()`: Va à la page suivante
- `prevPage()`: Va à la page précédente
- `firstPage()`: Va à la première page
- `lastPage()`: Va à la dernière page
- `setPageSize(size: number)`: Change le nombre d'éléments par page
- `getState()`: Retourne l'état actuel de la pagination
- `updateInfo()`: Met à jour les informations affichées
- `destroy()`: Nettoie les ressources du plugin

### Propriétés

- `currentPage`: Page actuelle
- `pageSize`: Nombre d'éléments par page
- `totalPages`: Nombre total de pages
- `totalItems`: Nombre total d'éléments
- `startItem`: Premier élément de la page actuelle
- `endItem`: Dernier élément de la page actuelle

## Hooks

### Avant la navigation
```javascript
table.hooks.register('beforePageChange', ({ currentPage, newPage }) => {
    // Vérifier si la navigation est autorisée
    return true;
});
```

### Après la navigation
```javascript
table.hooks.register('afterPageChange', ({ oldPage, newPage }) => {
    // Effectuer des actions après le changement de page
});
```

### Avant le changement de taille
```javascript
table.hooks.register('beforeSizeChange', ({ currentSize, newSize }) => {
    // Vérifier si le changement est autorisé
    return true;
});
```

### Après le changement de taille
```javascript
table.hooks.register('afterSizeChange', ({ oldSize, newSize }) => {
    // Effectuer des actions après le changement de taille
});
```

## Événements

### Changement de page
```javascript
table.on('page:change', ({ page, size }) => {
    console.log(`Page changée: ${page}, Taille: ${size}`);
});
```

### Changement de taille
```javascript
table.on('size:change', ({ oldSize, newSize }) => {
    console.log(`Taille changée de ${oldSize} à ${newSize}`);
});
```

### Erreur
```javascript
table.on('pagination:error', ({ error, action }) => {
    console.error(`Erreur lors de ${action}:`, error);
});
```

## Styles

### Classes CSS
- `.tableflow-pagination`: Conteneur principal
- `.tableflow-page`: Bouton de page
- `.tableflow-page-active`: Page active
- `.tableflow-page-disabled`: Bouton désactivé
- `.tableflow-page-prev`: Bouton précédent
- `.tableflow-page-next`: Bouton suivant
- `.tableflow-page-first`: Bouton première page
- `.tableflow-page-last`: Bouton dernière page
- `.tableflow-page-ellipsis`: Points de suspension
- `.tableflow-pagination-info`: Informations
- `.tableflow-size-selector`: Sélecteur de taille

### Variables CSS
```css
.tableflow-pagination {
    --container-background: #ffffff;
    --container-border: 1px solid #e0e0e0;
    --container-border-radius: 4px;
    --container-padding: 8px;
    --container-margin: 16px 0;
    
    --page-size: 32px;
    --page-padding: 0 12px;
    --page-margin: 0 4px;
    --page-border: 1px solid #e0e0e0;
    --page-border-radius: 4px;
    --page-background: #ffffff;
    --page-color: #333333;
    --page-hover-background: #f5f5f5;
    --page-hover-color: #2196F3;
    --page-active-background: #2196F3;
    --page-active-color: #ffffff;
    --page-disabled-background: #f5f5f5;
    --page-disabled-color: #999999;
    
    --selector-width: 80px;
    --selector-height: 32px;
    --selector-padding: 0 8px;
    --selector-border: 1px solid #e0e0e0;
    --selector-border-radius: 4px;
    --selector-background: #ffffff;
    --selector-color: #333333;
    
    --info-color: #666666;
    --info-font-size: 14px;
    --info-margin: 0 16px;
    
    --transition: all 0.2s ease;
}
```

## Accessibilité

### Attributs ARIA
- `aria-label` sur les boutons de navigation
- `aria-current="page"` sur la page active
- `aria-disabled="true"` sur les boutons désactivés
- `aria-live="polite"` sur les informations de pagination

### Navigation au clavier
- Flèche gauche : Page précédente
- Flèche droite : Page suivante
- Home : Première page
- End : Dernière page
- Tab : Navigation entre les éléments
- Entrée : Sélection de la page

## Responsive

### Points de rupture
- Desktop : > 768px
- Tablet : 768px - 480px
- Mobile : < 480px

### Adaptations
- Réduction de la taille des boutons
- Masquage des éléments non essentiels
- Ajustement des marges et du padding
- Modification de la taille de police

## Intégration

### Avec le plugin Filter
```javascript
table.hooks.register('afterFilter', () => {
    table.plugins.pagination.goToPage(1);
});
```

### Avec le plugin Sort
```javascript
table.hooks.register('afterSort', () => {
    table.plugins.pagination.goToPage(1);
});
```

## Exemples

### Pagination simple
```javascript
const table = new TableFlow({
    plugins: {
        pagination: {
            defaultPage: 1,
            defaultSize: 10
        }
    }
});
```

### Pagination avancée
```javascript
const table = new TableFlow({
    plugins: {
        pagination: {
            defaultPage: 1,
            defaultSize: 20,
            sizes: [10, 20, 50, 100],
            showFirstLast: true,
            showInfo: true,
            maxVisiblePages: 7,
            style: {
                pageActiveBackground: '#ff0000',
                pageActiveColor: '#ffffff'
            }
        }
    }
});
```

### Personnalisation des informations
```javascript
table.hooks.register('afterPageChange', ({ page, size, total }) => {
    const info = `Page ${page} sur ${total} (${size} éléments par page)`;
    document.querySelector('.tableflow-pagination-info').textContent = info;
});
```

## Dépannage

### Problèmes courants

1. **La pagination ne s'affiche pas**
   - Vérifier que le plugin est correctement initialisé
   - Vérifier que les données sont chargées
   - Vérifier la console pour les erreurs

2. **Les boutons ne fonctionnent pas**
   - Vérifier les événements click
   - Vérifier que les hooks ne bloquent pas la navigation
   - Vérifier la console pour les erreurs

3. **Les styles ne s'appliquent pas**
   - Vérifier que le CSS est chargé
   - Vérifier les conflits de classes
   - Vérifier les variables CSS

### Solutions

1. **Réinitialiser la pagination**
```javascript
table.plugins.pagination.destroy();
table.plugins.pagination.init();
```

2. **Forcer une mise à jour**
```javascript
table.plugins.pagination.updateInfo();
table.plugins.pagination.render();
```

3. **Déboguer les hooks**
```javascript
table.hooks.register('beforePageChange', (data) => {
    console.log('Before page change:', data);
    return true;
});
``` 