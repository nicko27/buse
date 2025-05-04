export const config = {
    name: 'filter',
    version: '1.0.0',
    dependencies: ['contextMenu'],
    options: {
        filterClass: 'tableflow-filter',
        filterInputClass: 'tableflow-filter-input',
        filterButtonClass: 'tableflow-filter-button',
        filterActiveClass: 'tableflow-filter-active',
        filterIconClass: 'tableflow-filter-icon',
        filterDropdownClass: 'tableflow-filter-dropdown',
        filterOptionClass: 'tableflow-filter-option',
        animationDuration: 200,
        defaultFilter: {
            column: null,
            value: '',
            operator: 'contains' // 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan'
        },
        keyboard: {
            enabled: true,
            filterOnEnter: true,
            closeOnEscape: true
        },
        style: {
            inputWidth: '200px',
            inputHeight: '32px',
            inputPadding: '8px',
            inputBorderColor: '#e0e0e0',
            inputBorderColorFocus: '#2196F3',
            inputBackground: '#ffffff',
            inputTextColor: '#333333',
            dropdownWidth: '200px',
            dropdownBackground: '#ffffff',
            dropdownBorderColor: '#e0e0e0',
            dropdownShadow: '0 2px 5px rgba(0,0,0,0.1)',
            optionHoverColor: '#f5f5f5',
            optionActiveColor: '#e3f2fd',
            iconColor: '#666666',
            iconColorActive: '#2196F3',
            transition: 'all 0.2s ease'
        }
    }
}; 