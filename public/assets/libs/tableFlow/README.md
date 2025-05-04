# TableFlow.js

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

TableFlow.js est une bibliothèque JavaScript moderne et performante pour la gestion avancée des tableaux HTML. Elle offre une architecture modulaire basée sur des plugins et une expérience utilisateur optimale.

## 🌟 Caractéristiques

- 🚀 **Haute Performance** : Optimisations DOM, cache intelligent, debounce automatique
- 🔌 **Architecture Modulaire** : Système de plugins extensible
- 🔄 **État Partagé** : Synchronisation automatique entre les plugins
- 📊 **Métriques Intégrées** : Suivi des performances en temps réel
- 🎨 **Thèmes Personnalisables** : Support complet des variables CSS
- ♿ **Accessibilité** : Conforme WCAG 2.1
- 🌐 **Internationalisation** : Support multilingue
- 📱 **Responsive** : Adaptation automatique aux différents écrans

## 📦 Installation

```bash
npm install tableflow.js
# ou
yarn add tableflow.js
```

## 🚀 Démarrage Rapide

```html
<!-- HTML -->
<table id="myTable">
  <thead>
    <tr>
      <th>Nom</th>
      <th>Age</th>
      <th>Ville</th>
    </tr>
  </thead>
  <tbody>
    <!-- Données du tableau -->
  </tbody>
</table>
```

```javascript
// JavaScript
import TableFlow from 'tableflow.js';

const table = new TableFlow({
  tableId: 'myTable',
  plugins: {
    filter: true,
    pagination: {
      pageSize: 10
    },
    sort: true
  }
});
```

## 🔌 Plugins Disponibles

### 📋 Filter
Filtrage avancé des données avec support des expressions régulières et des opérateurs.

```javascript
const table = new TableFlow({
  plugins: {
    filter: {
      defaultOperator: 'contains',
      caseSensitive: false,
      debounceTime: 300
    }
  }
});
```

### 📄 Pagination
Pagination flexible avec navigation clavier et tailles de page personnalisables.

```javascript
const table = new TableFlow({
  plugins: {
    pagination: {
      pageSize: 10,
      sizes: [5, 10, 20, 50],
      showInfo: true
    }
  }
});
```

### 🔄 Sort
Tri multi-colonnes avec support des types de données personnalisés.

```javascript
const table = new TableFlow({
  plugins: {
    sort: {
      multiSort: true,
      defaultSort: { column: 'name', direction: 'asc' }
    }
  }
});
```

## 🎨 Personnalisation

### Thèmes
```css
.tableflow {
  --tf-primary-color: #007bff;
  --tf-secondary-color: #6c757d;
  --tf-border-color: #dee2e6;
  --tf-hover-color: #f8f9fa;
}
```

### Hooks
```javascript
table.addHook('beforeFilter', (filterData) => {
  // Validation personnalisée
  return filterData.value.length >= 2;
});
```

## 📊 Métriques et Performance

```javascript
// Activer le monitoring
table.enableDebug({
  performance: true,
  memory: true
});

// Obtenir les statistiques
const stats = table.getPerformanceStats();
console.log(stats);
```

## 🔧 API

### TableFlow
```javascript
const table = new TableFlow(options);

// Méthodes principales
table.addRow(data);
table.removeRow(id);
table.exportToCSV();
table.importFromJSON(data);

// Gestion des événements
table.on('data:change', callback);
table.off('data:change', callback);

// État et synchronisation
await table.whenReady();
table.updateSharedState(updates);
```

### Plugins
Chaque plugin expose sa propre API :

```javascript
// Filter Plugin
table.plugins.filter.applyFilter(column, value);
table.plugins.filter.clearFilter(column);

// Pagination Plugin
table.plugins.pagination.goToPage(2);
table.plugins.pagination.setPageSize(20);

// Sort Plugin
table.plugins.sort.sortBy(column, direction);
```

## 🏗️ Architecture

TableFlow utilise une architecture moderne basée sur :
- État partagé centralisé
- Système de plugins coopératifs
- Cache intelligent
- Optimisations DOM
- Gestion asynchrone des événements

## 📈 Performance

Optimisations intégrées :
- Cache DOM
- Debounce automatique
- RequestAnimationFrame pour les rendus
- Virtualisation des données
- Lazy loading des plugins

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](CONTRIBUTING.md) pour les détails.

## 📄 Licence

TableFlow.js est sous licence MIT. Voir [LICENSE](LICENSE) pour plus de détails.

## 🙏 Remerciements

- Contributeurs
- Communauté open source
- Frameworks et bibliothèques utilisés

## 📚 Documentation

Documentation complète disponible sur [docs.tableflow.js](https://docs.tableflow.js)

---
Développé avec ❤️ par l'équipe TableFlow 