export const config = {
    name: 'contextMenu',
    version: '1.0.0',
    dependencies: [],
    options: {
        menuClass: 'tableflow-contextmenu',
        itemClass: 'tableflow-contextmenu-item',
        separatorClass: 'tableflow-contextmenu-separator',
        headerClass: 'tableflow-contextmenu-header',
        submenuClass: 'tableflow-contextmenu-submenu',
        activeClass: 'active',
        animationDuration: 200,
        position: {
            offsetX: 0,
            offsetY: 0,
            align: 'right' // 'left' | 'right'
        },
        keyboard: {
            enabled: true,
            closeOnEscape: true,
            navigateWithArrows: true
        },
        style: {
            minWidth: '200px',
            maxWidth: '300px',
            zIndex: 1000,
            backgroundColor: '#ffffff',
            borderColor: '#e0e0e0',
            textColor: '#333333',
            hoverColor: '#f5f5f5',
            activeColor: '#e3f2fd'
        }
    }
}; 