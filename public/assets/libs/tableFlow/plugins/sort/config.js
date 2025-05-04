export const config = {
    name: 'sort',
    version: '1.0.0',
    dependencies: ['contextMenu'],
    options: {
        sortClass: 'tableflow-sort',
        sortAscClass: 'tableflow-sort-asc',
        sortDescClass: 'tableflow-sort-desc',
        sortableClass: 'tableflow-sortable',
        headerClass: 'tableflow-sort-header',
        iconClass: 'tableflow-sort-icon',
        animationDuration: 200,
        defaultSort: {
            column: null,
            direction: 'asc' // 'asc' | 'desc'
        },
        keyboard: {
            enabled: true,
            sortOnEnter: true
        },
        style: {
            iconSize: '16px',
            iconColor: '#666666',
            iconColorActive: '#2196F3',
            headerBackground: '#f5f5f5',
            headerBackgroundHover: '#e0e0e0',
            headerBackgroundActive: '#e3f2fd',
            transition: 'all 0.2s ease'
        }
    }
}; 