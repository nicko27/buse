export const config = {
    name: 'columnreorder',
    version: '1.0.0',
    type: 'order',
    dependencies: [],
    options: {
        // Classes CSS
        handleClass: 'tableflow-columnreorder-handle',
        draggingClass: 'tableflow-columnreorder-dragging',
        placeholderClass: 'tableflow-columnreorder-placeholder',
        ghostClass: 'tableflow-columnreorder-ghost',
        
        // Messages
        messages: {
            dragHandle: 'Déplacez la colonne',
            start: 'Déplacez la colonne',
            end: 'Colonne déplacée',
            error: 'Impossible de déplacer la colonne'
        },
        
        // Configuration du réordonnancement
        reorder: {
            enabled: true,
            handle: true,
            animation: true,
            animationDuration: 200,
            constrainToContainer: true,
            constrainToWindow: true,
            minWidth: 50,
            maxWidth: 500
        },
        
        // Configuration de l'interface
        interface: {
            handlePosition: 'left', // 'left' | 'right'
            handleSize: 8,
            showHandle: true,
            showPlaceholder: true,
            showGhost: true,
            ariaLabels: true,
            keyboardNavigation: true
        },
        
        // Styles
        style: {
            handleBackground: '#e0e0e0',
            handleHoverBackground: '#2196F3',
            handleActiveBackground: '#1976D2',
            handleBorder: '1px solid #bdbdbd',
            handleBorderRadius: '2px',
            placeholderBackground: 'rgba(33, 150, 243, 0.1)',
            placeholderBorder: '2px dashed #2196F3',
            ghostOpacity: 0.5,
            ghostBackground: '#ffffff',
            ghostBorder: '1px solid #e0e0e0',
            ghostShadow: '0 2px 5px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease'
        },
        
        // Hooks
        hooks: {
            beforeDrag: null,
            afterDrag: null,
            beforeStart: null,
            afterStart: null,
            beforeEnd: null,
            afterEnd: null,
            beforeUpdate: null,
            afterUpdate: null
        }
    }
}; 