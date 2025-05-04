export const config = {
    name: 'choice',
    version: '1.0.0',
    dependencies: [],
    options: {
        // Classes CSS
        choiceClass: 'tableflow-choice',
        selectClass: 'tableflow-select',
        optionClass: 'tableflow-option',
        selectedClass: 'tableflow-selected',
        multipleClass: 'tableflow-multiple',
        searchClass: 'tableflow-search',
        clearClass: 'tableflow-clear',
        dropdownClass: 'tableflow-dropdown',
        placeholderClass: 'tableflow-placeholder',
        loadingClass: 'tableflow-loading',
        
        // Configuration des sélections
        select: {
            // Options par défaut
            multiple: false,
            searchable: true,
            clearable: true,
            placeholder: 'Sélectionner...',
            noOptionsText: 'Aucune option',
            noResultsText: 'Aucun résultat',
            selectAllText: 'Tout sélectionner',
            selectedText: '{count} sélectionné(s)',
            
            // Limites
            maxItems: null,
            minItems: null,
            
            // Comportement
            closeOnSelect: true,
            openOnFocus: true,
            autoClose: true,
            
            // Recherche
            searchDelay: 300,
            minSearch: 2,
            searchPlaceholder: 'Rechercher...',
            fuzzySearch: true,
            
            // Format des options
            optionFormat: {
                text: 'text',
                value: 'value',
                disabled: 'disabled',
                selected: 'selected',
                description: 'description',
                icon: 'icon'
            },
            
            // Validation
            required: false,
            validateOnChange: true
        },
        
        // Configuration de l'interface
        interface: {
            // Position du menu
            position: 'bottom', // 'top' | 'bottom' | 'auto'
            alignment: 'left', // 'left' | 'right' | 'center'
            
            // Affichage
            showIcons: true,
            showClear: true,
            showSearch: true,
            showSelectAll: true,
            showSelected: true,
            
            // Animation
            animation: true,
            animationDuration: 200,
            
            // Taille
            maxHeight: '300px',
            minWidth: '200px',
            
            // Accessibilité
            ariaLabels: true,
            keyboardNavigation: true
        },
        
        // Styles
        style: {
            // Conteneur principal
            containerBackground: '#ffffff',
            containerBorder: '1px solid #e0e0e0',
            containerBorderRadius: '4px',
            containerPadding: '8px',
            
            // Sélection
            selectBackground: '#ffffff',
            selectBorder: '1px solid #e0e0e0',
            selectBorderRadius: '4px',
            selectPadding: '8px 12px',
            selectColor: '#333333',
            selectPlaceholderColor: '#999999',
            
            // Options
            optionPadding: '8px 12px',
            optionBackground: 'transparent',
            optionColor: '#333333',
            optionHoverBackground: '#f5f5f5',
            optionSelectedBackground: '#e3f2fd',
            optionDisabledColor: '#cccccc',
            
            // Recherche
            searchBackground: '#ffffff',
            searchBorder: '1px solid #e0e0e0',
            searchBorderRadius: '4px',
            searchPadding: '8px',
            searchColor: '#333333',
            
            // Icônes
            iconSize: '16px',
            iconColor: '#666666',
            
            // Menu déroulant
            dropdownBackground: '#ffffff',
            dropdownBorder: '1px solid #e0e0e0',
            dropdownBorderRadius: '4px',
            dropdownShadow: '0 2px 5px rgba(0,0,0,0.1)',
            dropdownPadding: '4px 0',
            
            // États
            focusBorderColor: '#2196F3',
            errorBorderColor: '#f44336',
            disabledOpacity: 0.6,
            
            // Transitions
            transition: 'all 0.2s ease'
        },
        
        // Messages
        messages: {
            noOptions: 'Aucune option disponible',
            noResults: 'Aucun résultat trouvé',
            selectAll: 'Tout sélectionner',
            clear: 'Effacer la sélection',
            selected: '{count} élément(s) sélectionné(s)',
            maxItems: 'Vous ne pouvez pas sélectionner plus de {max} éléments',
            minItems: 'Vous devez sélectionner au moins {min} éléments',
            required: 'Ce champ est requis',
            loading: 'Chargement...',
            error: 'Une erreur est survenue'
        },
        
        // Hooks
        hooks: {
            // Avant la sélection
            beforeSelect: null,
            // Après la sélection
            afterSelect: null,
            // Avant l'ouverture du menu
            beforeOpen: null,
            // Après l'ouverture du menu
            afterOpen: null,
            // Avant la fermeture du menu
            beforeClose: null,
            // Après la fermeture du menu
            afterClose: null,
            // Pendant la recherche
            onSearch: null,
            // Lors de la validation
            onValidate: null
        }
    }
}; 