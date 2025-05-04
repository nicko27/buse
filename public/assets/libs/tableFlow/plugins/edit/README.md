# Plugin Edit

Ce plugin permet l'édition des cellules dans TableFlow.

## Fonctionnalités

- Édition en ligne des cellules
- Types d'input personnalisables
- Sauvegarde automatique
- Annulation des modifications
- Validation des données
- Support des raccourcis clavier

## Configuration

```javascript
{
    editClass: 'editable',
    editingClass: 'editing',
    saveOnBlur: true,
    saveOnEnter: true,
    cancelOnEscape: true,
    autoFocus: true,
    inputTypes: {
        text: 'text',
        number: 'number',
        email: 'email',
        date: 'date',
        time: 'time',
        datetime: 'datetime-local',
        url: 'url',
        tel: 'tel',
        password: 'password'
    },
    defaultInputType: 'text',
    inputAttributes: {
        class: 'tableflow-input',
        spellcheck: 'false'
    }
}
```

## Utilisation

```javascript
const table = new TableFlow({
    plugins: {
        edit: {
            saveOnBlur: true,
            saveOnEnter: true
        }
    }
});
```

## Hooks

- `beforeEdit`: Avant l'édition d'une cellule
- `afterEdit`: Après l'édition d'une cellule
- `beforeSave`: Avant la sauvegarde
- `afterSave`: Après la sauvegarde
- `onCancel`: Lors de l'annulation

## Événements

- `edit:start`: Début de l'édition
- `edit:complete`: Fin de l'édition
- `edit:cancel`: Annulation de l'édition
- `edit:save`: Sauvegarde des modifications 