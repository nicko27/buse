# ModalFlow

ModalFlow est une bibliothèque JavaScript moderne et flexible pour la gestion des fenêtres modales dans les applications web.

## Caractéristiques

- 🎨 Thèmes personnalisables
- 🔌 Architecture extensible avec plugins
- 📱 Design responsive
- ⌨️ Accessibilité intégrée
- 🎭 Animations fluides
- 🔄 Gestion d'état avancée

## Installation

1. Incluez les fichiers nécessaires :

```html
<link rel="stylesheet" href="path/to/modalFlow/src/modalFlow.css">
<script src="path/to/modalFlow/src/modalFlow.js"></script>
```

2. Pour utiliser des plugins, incluez-les après le fichier principal :

```html
<script src="path/to/modalFlow/plugins/form.js"></script>
```

## Utilisation de base

```javascript
// Créer une instance
const modal = new ModalFlow({
    theme: 'default',
    animation: true,
    closeOnEscape: true
});

// Créer et ouvrir une modal
const modalId = modal.create({
    title: 'Ma Modal',
    content: 'Contenu de la modal',
    footer: '<button onclick="modal.close()">Fermer</button>'
});
modal.open(modalId);
```

## Configuration

```javascript
const config = {
    theme: 'default',          // 'default' ou 'dark'
    animation: true,           // Activer/désactiver les animations
    closeOnEscape: true,       // Fermer avec la touche Escape
    closeOnOverlayClick: true, // Fermer en cliquant sur l'overlay
    showCloseButton: true,     // Afficher le bouton de fermeture
    maxWidth: '800px',         // Largeur maximale
    position: 'center',        // 'center', 'top', 'bottom'
    overlayOpacity: 0.5,       // Opacité de l'overlay
    zIndex: 1000              // Z-index de base
};
```

## Plugins

### Plugin de formulaire

```javascript
// Initialiser le plugin
const formPlugin = new ModalFlowFormPlugin({
    validateOnSubmit: true,
    showErrorMessages: true
});
modal.registerPlugin('form', formPlugin);

// Créer une modal avec un formulaire
const modalId = modal.create({
    title: 'Formulaire',
    content: `
        <form>
            <input type="text" name="name" required>
            <button type="submit">Envoyer</button>
        </form>
    `
});

// Écouter les soumissions de formulaire
modal.on('form:submit', ({ modalId, form, data }) => {
    console.log('Données du formulaire:', data);
});
```

## Événements

```javascript
modal.on('open', ({ modalId, element }) => {
    console.log('Modal ouverte:', modalId);
});

modal.on('close', ({ modalId, element }) => {
    console.log('Modal fermée:', modalId);
});

modal.on('update', ({ modalId, element, options }) => {
    console.log('Modal mise à jour:', modalId);
});
```

## API

### Méthodes principales

- `create(options)`: Crée une nouvelle modal
- `open(modalId)`: Ouvre une modal
- `close(modalId)`: Ferme une modal
- `update(modalId, options)`: Met à jour une modal
- `destroy()`: Détruit l'instance et nettoie les ressources

### Gestion des plugins

- `registerPlugin(name, plugin)`: Enregistre un nouveau plugin
- `unregisterPlugin(name)`: Supprime un plugin
- `getPlugin(name)`: Récupère un plugin

### Gestion des événements

- `on(event, callback)`: Ajoute un écouteur d'événement
- `off(event, callback)`: Supprime un écouteur d'événement
- `trigger(event, data)`: Déclenche un événement

## Personnalisation

### CSS

Vous pouvez surcharger les styles par défaut en ciblant les classes CSS :

```css
.modal-flow {
    /* Styles personnalisés */
}

.modal-flow-header {
    /* Styles d'en-tête personnalisés */
}

.modal-flow-content {
    /* Styles de contenu personnalisés */
}

.modal-flow-footer {
    /* Styles de pied de page personnalisés */
}
```

### Thèmes

Créez votre propre thème en étendant les styles de base :

```css
.modal-flow.custom-theme {
    /* Styles de thème personnalisés */
}
```

## Développement

### Structure du projet

```
modalFlow/
├── src/
│   ├── modalFlow.js
│   └── modalFlow.css
├── plugins/
│   ├── form.js
│   └── ...
├── themes/
│   └── ...
└── README.md
```

## Licence

MIT
