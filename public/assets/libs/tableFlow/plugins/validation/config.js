export const config = {
    name: 'validation',
    version: '1.0.0',
    dependencies: [],
    options: {
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
}; 