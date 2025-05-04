export const config = {
    name: 'search',
    version: '1.0.0',
    dependencies: [],
    options: {
        // Classes CSS
        searchClass: 'tableflow-search',
        inputClass: 'tableflow-search-input',
        resultsClass: 'tableflow-search-results',
        highlightClass: 'tableflow-search-highlight',
        activeClass: 'tableflow-search-active',
        
        // Configuration de la recherche
        search: {
            // Options par défaut
            caseSensitive: false,
            wholeWord: false,
            regex: false,
            highlight: true,
            debounce: 300,
            
            // Limites
            maxResults: 100,
            minLength: 2,
            
            // Messages
            messages: {
                noResults: 'Aucun résultat trouvé',
                searching: 'Recherche en cours...',
                tooShort: 'La recherche doit contenir au moins {minLength} caractères'
            }
        },
        
        // Configuration de l'interface
        interface: {
            // Position
            position: 'top', // 'top' | 'bottom'
            alignment: 'right', // 'left' | 'right' | 'center'
            
            // Affichage
            showResults: true,
            showCount: true,
            showClear: true,
            
            // Accessibilité
            ariaLabels: true,
            keyboardNavigation: true
        },
        
        // Styles
        style: {
            // Conteneur
            containerBackground: '#ffffff',
            containerBorder: '1px solid #e0e0e0',
            containerBorderRadius: '4px',
            containerPadding: '8px',
            containerShadow: '0 2px 5px rgba(0,0,0,0.1)',
            
            // Input
            inputPadding: '8px 12px',
            inputBackground: '#ffffff',
            inputColor: '#333333',
            inputBorder: '1px solid #e0e0e0',
            inputBorderRadius: '4px',
            inputFocusBorderColor: '#2196F3',
            
            // Résultats
            resultsBackground: '#ffffff',
            resultsBorder: '1px solid #e0e0e0',
            resultsBorderRadius: '4px',
            resultsMaxHeight: '300px',
            resultsPadding: '8px',
            
            // Surbrillance
            highlightBackground: '#fff3cd',
            highlightColor: '#000000',
            
            // Transitions
            transition: 'all 0.2s ease'
        },
        
        // Hooks
        hooks: {
            // Avant la recherche
            beforeSearch: null,
            // Après la recherche
            afterSearch: null,
            // Avant la sélection d'un résultat
            beforeSelect: null,
            // Après la sélection d'un résultat
            afterSelect: null
        }
    }
}; 