# Plugin Validation

Ce plugin permet de gérer la validation des données dans TableFlow.

## Fonctionnalités

- Validation en temps réel
- Messages d'erreur personnalisables
- Règles de validation configurables
- Support des expressions régulières
- Validation conditionnelle

## Configuration

```javascript
{
    strictMode: true,
    validateOnChange: true,
    validateOnBlur: true,
    validateOnSubmit: true,
    errorClass: 'validation-error',
    successClass: 'validation-success',
    errorMessages: {
        required: 'Ce champ est requis',
        email: 'Adresse email invalide',
        number: 'Valeur numérique requise',
        min: 'La valeur doit être supérieure à {min}',
        max: 'La valeur doit être inférieure à {max}',
        pattern: 'Format invalide'
    }
}
```

## Utilisation

```javascript
const table = new TableFlow({
    plugins: {
        validation: {
            strictMode: true,
            validateOnChange: true
        }
    }
});
```

## Hooks

- `beforeValidation`: Avant la validation
- `afterValidation`: Après la validation
- `onValidationError`: En cas d'erreur de validation

## Événements

- `validation:start`: Début de la validation
- `validation:complete`: Fin de la validation
- `validation:error`: Erreur de validation 