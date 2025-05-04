export const config = {
    name: 'selection',
    version: '1.0.0',
    dependencies: ['contextMenu'],
    options: {
        // Classes CSS
        selectionClass: 'tableflow-selection',
        selectedRowClass: 'tableflow-row-selected',
        selectedCellClass: 'tableflow-cell-selected',
        multiSelectClass: 'tableflow-multi-select',
        rangeSelectClass: 'tableflow-range-select',
        
        // Configuration par défaut
        enableRowSelection: true,
        enableCellSelection: true,
        enableMultiSelect: true,
        enableRangeSelect: true,
        enableKeyboardNavigation: true,
        enableClipboard: true,
        maxSelections: 1000,
        
        // Modes de sélection
        selectionMode: 'row', // 'row' | 'cell' | 'both'
        multiSelectMode: 'ctrl', // 'ctrl' | 'shift' | 'both'
        
        // Raccourcis clavier
        keyboard: {
            enabled: true,
            selectAll: 'ctrl+a',
            copy: 'ctrl+c',
            cut: 'ctrl+x',
            paste: 'ctrl+v',
            delete: 'delete',
            moveUp: 'arrowup',
            moveDown: 'arrowdown',
            moveLeft: 'arrowleft',
            moveRight: 'arrowright',
            extendUp: 'shift+arrowup',
            extendDown: 'shift+arrowdown',
            extendLeft: 'shift+arrowleft',
            extendRight: 'shift+arrowright'
        },
        
        // Styles
        style: {
            // Sélection de ligne
            rowSelectedBackground: 'rgba(33, 150, 243, 0.1)',
            rowSelectedBorder: '1px solid rgba(33, 150, 243, 0.2)',
            rowSelectedColor: 'inherit',
            
            // Sélection de cellule
            cellSelectedBackground: 'rgba(33, 150, 243, 0.1)',
            cellSelectedBorder: '1px solid rgba(33, 150, 243, 0.2)',
            cellSelectedColor: 'inherit',
            
            // Sélection multiple
            multiSelectBackground: 'rgba(33, 150, 243, 0.15)',
            multiSelectBorder: '1px solid rgba(33, 150, 243, 0.3)',
            
            // Sélection par plage
            rangeSelectBackground: 'rgba(33, 150, 243, 0.05)',
            rangeSelectBorder: '1px dashed rgba(33, 150, 243, 0.3)',
            
            // Focus
            focusOutline: '2px solid rgba(33, 150, 243, 0.5)',
            focusOutlineOffset: '-2px',
            
            // Transitions
            transition: 'all 0.2s ease',
            
            // Responsive
            mobileSelectionColor: 'rgba(33, 150, 243, 0.2)',
            mobileFocusOutline: '3px solid rgba(33, 150, 243, 0.5)'
        },
        
        // Messages
        messages: {
            copySuccess: 'Sélection copiée',
            copyError: 'Erreur lors de la copie',
            pasteSuccess: 'Contenu collé',
            pasteError: 'Erreur lors du collage',
            deleteSuccess: 'Sélection supprimée',
            deleteError: 'Erreur lors de la suppression',
            maxSelectionsReached: 'Nombre maximum de sélections atteint',
            noSelection: 'Aucune sélection'
        },
        
        // Intégration avec le presse-papiers
        clipboard: {
            enabled: true,
            separator: '\t',
            formatHeaders: true,
            includeHeaders: true,
            formatData: true
        }
    }
}; 