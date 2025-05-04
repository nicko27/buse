export const config = {
    name: 'edit',
    version: '1.0.0',
    type: 'edit',
    dependencies: [],
    options: {
        // Classes CSS
        classes: {
            editing: 'tableflow-editing',
            editInput: 'tableflow-edit-input',
            readOnly: 'tableflow-read-only'
        },

        // Messages
        messages: {
            editPlaceholder: 'Éditer...',
            saveTooltip: 'Sauvegarder (Entrée)',
            cancelTooltip: 'Annuler (Échap)'
        },

        // Configuration de l'édition
        edit: {
            autoSelect: true,
            validateOnBlur: true,
            validateOnEnter: true,
            inputTypes: {
                text: 'text',
                number: 'number',
                date: 'date',
                email: 'email',
                url: 'url'
            }
        },

        // Validation
        validation: {
            required: false,
            minLength: 0,
            maxLength: null,
            pattern: null,
            custom: null
        },

        // Hooks
        hooks: {
            beforeEdit: null,
            afterEdit: null,
            beforeSave: null,
            afterSave: null
        }
    }
}; 