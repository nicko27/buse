export const config = {
    name: 'pagination',
    version: '1.0.0',
    dependencies: [],
    options: {
        // Classes CSS
        paginationClass: 'tableflow-pagination',
        pageClass: 'tableflow-page',
        activePageClass: 'tableflow-page-active',
        disabledPageClass: 'tableflow-page-disabled',
        prevPageClass: 'tableflow-page-prev',
        nextPageClass: 'tableflow-page-next',
        firstPageClass: 'tableflow-page-first',
        lastPageClass: 'tableflow-page-last',
        ellipsisClass: 'tableflow-page-ellipsis',
        infoClass: 'tableflow-pagination-info',
        sizeSelectorClass: 'tableflow-size-selector',
        
        // Configuration par défaut
        defaultPage: 1,
        defaultSize: 10,
        sizes: [5, 10, 20, 50, 100],
        showFirstLast: true,
        showPrevNext: true,
        showInfo: true,
        showSizeSelector: true,
        maxVisiblePages: 5,
        
        // Navigation au clavier
        keyboard: {
            enabled: true,
            prevPageKey: 'ArrowLeft',
            nextPageKey: 'ArrowRight',
            firstPageKey: 'Home',
            lastPageKey: 'End'
        },
        
        // Styles
        style: {
            // Conteneur principal
            containerBackground: '#ffffff',
            containerBorder: '1px solid #e0e0e0',
            containerBorderRadius: '4px',
            containerPadding: '8px',
            containerMargin: '16px 0',
            
            // Pages
            pageSize: '32px',
            pagePadding: '0 12px',
            pageMargin: '0 4px',
            pageBorder: '1px solid #e0e0e0',
            pageBorderRadius: '4px',
            pageBackground: '#ffffff',
            pageColor: '#333333',
            pageHoverBackground: '#f5f5f5',
            pageHoverColor: '#2196F3',
            pageActiveBackground: '#2196F3',
            pageActiveColor: '#ffffff',
            pageDisabledBackground: '#f5f5f5',
            pageDisabledColor: '#999999',
            
            // Sélecteur de taille
            selectorWidth: '80px',
            selectorHeight: '32px',
            selectorPadding: '0 8px',
            selectorBorder: '1px solid #e0e0e0',
            selectorBorderRadius: '4px',
            selectorBackground: '#ffffff',
            selectorColor: '#333333',
            
            // Info
            infoColor: '#666666',
            infoFontSize: '14px',
            infoMargin: '0 16px',
            
            // Transitions
            transition: 'all 0.2s ease',
            
            // Responsive
            mobileBreakpoint: '768px',
            mobilePageSize: '28px',
            mobilePagePadding: '0 8px',
            mobileInfoFontSize: '12px'
        }
    }
}; 