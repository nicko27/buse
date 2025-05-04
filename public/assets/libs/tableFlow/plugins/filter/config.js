export const config = {
    name: 'filter',
    version: '1.0.0',
    type: 'filter',
    dependencies: [],
    options: {
        // Classes CSS
        classes: {
            container: 'tableflow-filter-container',
            filterInput: 'tableflow-filter-input'
        },

        // Messages
        messages: {
            filterPlaceholder: 'Filtrer...'
        },

        // Configuration du filtrage
        filter: {
            caseSensitive: false,
            debounceTime: 300,
            operators: {
                contains: 'Contient',
                equals: 'Égal à',
                startsWith: 'Commence par',
                endsWith: 'Termine par',
                greaterThan: 'Supérieur à',
                lessThan: 'Inférieur à'
            }
        },

        // Hooks
        hooks: {
            beforeFilter: null,
            afterFilter: null
        }
    }
}; 