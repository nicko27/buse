export const config = {
    name: 'sort',
    version: '1.0.0',
    type: 'sort',
    dependencies: [],
    options: {
        // Classes CSS
        classes: {
            sortable: 'sortable',
            sortAsc: 'sort-asc',
            sortDesc: 'sort-desc'
        },

        // Messages
        messages: {
            sortAsc: 'Trier par ordre croissant',
            sortDesc: 'Trier par ordre décroissant'
        },

        // Configuration du tri
        sort: {
            defaultDirection: 'asc',
            multiSort: false,
            caseSensitive: false,
            numericSort: false
        },

        // Hooks
        hooks: {
            beforeSort: null,
            afterSort: null
        }
    }
}; 