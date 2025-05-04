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
        
        // Configuration du réordonnancement
        reorder: {
            // Options par défaut
            enabled: true,
            handle: true,
            animation: true,
            animationDuration: 200,
            constrainToContainer: true,
            constrainToWindow: true,
            
            // Limites
            minWidth: 50,
            maxWidth: 500,
            
            // Messages
            messages: {
                start: 'Déplacez la colonne',
                end: 'Colonne déplacée',
                error: 'Impossible de déplacer la colonne'
            }
        },
        
        // Configuration de l'interface
        interface: {
            // Position
            handlePosition: 'left', // 'left' | 'right'
            handleSize: 8,
            
            // Affichage
            showHandle: true,
            showPlaceholder: true,
            showGhost: true,
            
            // Accessibilité
            ariaLabels: true,
            keyboardNavigation: true
        },
        
        // Styles
        style: {
            // Handle
            handleBackground: '#e0e0e0',
            handleHoverBackground: '#2196F3',
            handleActiveBackground: '#1976D2',
            handleBorder: '1px solid #bdbdbd',
            handleBorderRadius: '2px',
            
            // Placeholder
            placeholderBackground: 'rgba(33, 150, 243, 0.1)',
            placeholderBorder: '2px dashed #2196F3',
            
            // Ghost
            ghostOpacity: 0.5,
            ghostBackground: '#ffffff',
            ghostBorder: '1px solid #e0e0e0',
            ghostShadow: '0 2px 5px rgba(0,0,0,0.1)',
            
            // Transitions
            transition: 'all 0.2s ease'
        },
        
        // Hooks
        hooks: {
            // Avant le début du glissement
            beforeStart: null,
            // Après le début du glissement
            afterStart: null,
            // Avant la fin du glissement
            beforeEnd: null,
            // Après la fin du glissement
            afterEnd: null,
            // Avant la mise à jour de l'ordre
            beforeUpdate: null,
            // Après la mise à jour de l'ordre
            afterUpdate: null
        }
    }
}; 