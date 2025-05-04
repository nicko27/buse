# StylePlugin pour TableFlow

## 📋 Description
Le StylePlugin est un plugin avancé pour TableFlow qui fournit une gestion complète et centralisée des styles pour vos tableaux. Il intègre plusieurs modules spécialisés pour le surlignage, les styles conditionnels, les thèmes et les animations.

## ✨ Fonctionnalités

### 🎨 Module Highlight
- Surlignage interactif des cellules, lignes et colonnes
- Palette de couleurs personnalisable
- Sélecteur de couleur intégré
- Persistance des surlignages
- Mode de sélection multiple

### 🔄 Module Conditionnel
- Application de styles basée sur des conditions
- Règles personnalisables
- Opérateurs multiples (equals, contains, greater, less, etc.)
- Prévisualisation en temps réel
- Interface de construction de règles

### 🌓 Module Thème
- Thèmes prédéfinis (clair/sombre)
- Thèmes personnalisables
- Changement de thème dynamique
- Variables CSS personnalisées
- Persistance des préférences

### ✨ Module Animation
- Animations fluides
- Effets personnalisables
- Durées configurables
- Support des transitions
- Optimisation des performances

## 🚀 Installation

1. Ajoutez les fichiers du plugin dans votre projet :
```bash
plugins/
  style/
    index.js
    config.js
    StyleManager.js
    RuleEngine.js
    StateManager.js
    modules/
      HighlightModule.js
      ConditionalModule.js
      ThemeModule.js
      AnimationModule.js
```

2. Activez le plugin dans votre configuration TableFlow :
```javascript
const table = new TableFlow({
    plugins: {
        style: {
            enabled: true,
            // Options spécifiques...
        }
    }
});
```

## ⚙️ Configuration

### Configuration Globale
```javascript
{
    enabled: true,
    debug: false,
    storageKey: 'tableflow-style-rules',
    
    modules: {
        // Configuration des modules...
    },
    
    style: {
        // Styles par défaut...
    },
    
    classes: {
        // Classes CSS...
    }
}
```

### Module Highlight
```javascript
highlight: {
    enabled: true,
    mode: 'cell', // 'cell', 'row', 'column'
    colors: [
        { id: 'red', name: 'Rouge', value: '#FF0000', textColor: '#FFFFFF' },
        // Autres couleurs...
    ],
    interface: {
        buttonIcon: '🎨',
        buttonText: 'Styles',
        showColorPicker: true,
        // Autres options...
    }
}
```

### Module Conditionnel
```javascript
conditional: {
    enabled: true,
    maxRules: 100,
    defaultOperators: ['equals', 'contains', 'greater', 'less', 'between', 'empty'],
    interface: {
        showRuleBuilder: true,
        showPreview: true
    }
}
```

### Module Thème
```javascript
theme: {
    enabled: true,
    defaultTheme: 'light',
    themes: {
        light: {
            background: '#FFFFFF',
            text: '#000000',
            border: '#DDDDDD'
        },
        dark: {
            background: '#222222',
            text: '#FFFFFF',
            border: '#444444'
        }
    }
}
```

### Module Animation
```javascript
animation: {
    enabled: true,
    duration: 300,
    easing: 'ease-in-out',
    effects: ['fade', 'slide']
}
```

## 🔧 API

### StylePlugin
```javascript
// Application de styles
table.plugins.style.applyStyle(elements, style);
table.plugins.style.removeStyle(elements, styleId);

// Gestion des règles
table.plugins.style.addRule(condition, style);

// Gestion des thèmes
table.plugins.style.setTheme(themeName);
```

### Modules
Chaque module expose sa propre API :

#### HighlightModule
```javascript
const highlight = table.plugins.style.modules.get('highlight');
highlight.applyHighlight(elements, color);
highlight.clearHighlights();
```

#### ConditionalModule
```javascript
const conditional = table.plugins.style.modules.get('conditional');
conditional.addRule(condition, style);
conditional.removeRule(ruleId);
```

#### ThemeModule
```javascript
const theme = table.plugins.style.modules.get('theme');
theme.setTheme('dark');
theme.addTheme(name, styles);
```

#### AnimationModule
```javascript
const animation = table.plugins.style.modules.get('animation');
animation.animate(elements, effect, options);
```

## 🎨 Personnalisation CSS

### Variables CSS
```css
.tf-style-container {
    --tf-primary-color: #007bff;
    --tf-secondary-color: #6c757d;
    --tf-border-color: #dee2e6;
    --tf-hover-color: #f8f9fa;
    /* ... autres variables ... */
}
```

### Classes Personnalisables
- `tf-style-container` : Conteneur principal
- `tf-style-button` : Boutons d'action
- `tf-style-menu` : Menus déroulants
- `tf-style-menu-item` : Éléments de menu
- `tf-style-highlight` : Éléments surlignés
- `tf-style-conditional` : Styles conditionnels
- `tf-style-theme` : Thèmes
- `tf-style-animation` : Animations

## 📊 Exemples

### Surlignage Simple
```javascript
// Surligneur basique
table.plugins.style.modules.get('highlight').applyHighlight(
    document.querySelector('td'),
    '#FF0000'
);
```

### Style Conditionnel
```javascript
// Règle conditionnelle
table.plugins.style.addRule(
    'value > 1000',
    { color: '#FF0000', fontWeight: 'bold' }
);
```

### Changement de Thème
```javascript
// Basculer en mode sombre
table.plugins.style.setTheme('dark');
```

### Animation
```javascript
// Animer des cellules
table.plugins.style.modules.get('animation').animate(
    cells,
    'fade',
    { duration: 300 }
);
```

## 🔍 Débogage

Le plugin inclut des outils de débogage complets :

```javascript
// Activer le mode debug
table.plugins.style.config.debug = true;

// Obtenir l'état actuel
const state = await table.plugins.style.stateManager.getState();
console.log(state);
```

## ⚡ Performance

Le plugin est optimisé pour les performances :
- Cache des styles
- Debounce des opérations coûteuses
- Utilisation de requestAnimationFrame
- Gestion optimisée du DOM
- Lazy loading des modules

## 🔒 Sécurité

- Validation des entrées utilisateur
- Échappement des valeurs CSS
- Protection XSS
- Validation des couleurs
- Sanitization des styles

## 🤝 Contribution

Les contributions sont les bienvenues ! Voir [CONTRIBUTING.md](../../CONTRIBUTING.md) pour les détails.

## 📄 Licence

Ce plugin est sous licence MIT. Voir [LICENSE](../../LICENSE) pour plus de détails.

## 🐛 Résolution des Problèmes

### Problèmes Courants
1. **Les styles ne s'appliquent pas**
   - Vérifier que le plugin est correctement initialisé
   - Vérifier les sélecteurs CSS
   - Consulter la console pour les erreurs

2. **Les thèmes ne changent pas**
   - Vérifier la configuration des thèmes
   - S'assurer que les variables CSS sont correctes
   - Vérifier les conflits de style

3. **Les animations ne fonctionnent pas**
   - Vérifier le support du navigateur
   - Vérifier les propriétés CSS
   - Consulter les performances

## 📚 Ressources

- [Documentation TableFlow](https://docs.tableflow.js)
- [Guide des Styles](https://docs.tableflow.js/styles)
- [API Reference](https://docs.tableflow.js/api/style)
- [Exemples](https://docs.tableflow.js/examples/style)

---

Développé avec ❤️ par l'équipe TableFlow 