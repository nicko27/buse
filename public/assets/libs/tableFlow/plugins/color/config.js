export const config = {
    name: 'color',
    version: '1.0.0',
    dependencies: [],
    options: {
        // Classes CSS
        colorClass: 'tableflow-color',
        pickerClass: 'tableflow-color-picker',
        swatchClass: 'tableflow-color-swatch',
        inputClass: 'tableflow-color-input',
        dropperClass: 'tableflow-color-dropper',
        previewClass: 'tableflow-color-preview',
        paletteClass: 'tableflow-color-palette',
        sliderClass: 'tableflow-color-slider',
        formatClass: 'tableflow-color-format',
        
        // Configuration du sélecteur de couleur
        picker: {
            // Options par défaut
            defaultColor: '#000000',
            defaultFormat: 'hex', // 'hex' | 'rgb' | 'hsl'
            showAlpha: true,
            showInput: true,
            showDropper: true,
            showPalette: true,
            showSliders: true,
            showFormat: true,
            
            // Formats supportés
            formats: ['hex', 'rgb', 'hsl'],
            
            // Palette de couleurs
            palette: [
                // Couleurs de base
                '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
                // Gris
                '#808080', '#a9a9a9', '#d3d3d3', '#dcdcdc', '#f5f5f5',
                // Couleurs web sécurisées
                '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeead',
                '#d4a4eb', '#ffad60', '#4a4e4d', '#0e9aa7', '#3da4ab'
            ],
            
            // Limites
            minAlpha: 0,
            maxAlpha: 1,
            stepAlpha: 0.01,
            
            // Validation
            validateOnChange: true,
            allowCustom: true,
            allowEmpty: false
        },
        
        // Configuration de l'interface
        interface: {
            // Position du picker
            position: 'bottom', // 'top' | 'bottom' | 'left' | 'right'
            alignment: 'left', // 'left' | 'center' | 'right'
            
            // Affichage
            showPreview: true,
            showLabels: true,
            showTooltips: true,
            showClear: true,
            
            // Animation
            animation: true,
            animationDuration: 200,
            
            // Taille
            width: '280px',
            height: 'auto',
            swatchSize: '24px',
            sliderHeight: '12px',
            
            // Accessibilité
            ariaLabels: true,
            keyboardControls: true
        },
        
        // Styles
        style: {
            // Conteneur principal
            containerBackground: '#ffffff',
            containerBorder: '1px solid #e0e0e0',
            containerBorderRadius: '4px',
            containerPadding: '12px',
            containerShadow: '0 2px 5px rgba(0,0,0,0.1)',
            
            // Swatch
            swatchBorder: '1px solid #e0e0e0',
            swatchBorderRadius: '4px',
            swatchShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
            
            // Input
            inputBackground: '#ffffff',
            inputBorder: '1px solid #e0e0e0',
            inputBorderRadius: '4px',
            inputPadding: '6px 8px',
            inputColor: '#333333',
            inputPlaceholderColor: '#999999',
            
            // Dropper
            dropperSize: '24px',
            dropperBackground: '#ffffff',
            dropperBorder: '1px solid #e0e0e0',
            dropperBorderRadius: '4px',
            dropperColor: '#666666',
            
            // Preview
            previewSize: '32px',
            previewBorder: '1px solid #e0e0e0',
            previewBorderRadius: '4px',
            
            // Palette
            paletteGap: '8px',
            paletteColumns: 5,
            
            // Sliders
            sliderTrackBackground: '#f5f5f5',
            sliderTrackBorder: '1px solid #e0e0e0',
            sliderTrackBorderRadius: '4px',
            sliderThumbSize: '16px',
            sliderThumbBorder: '2px solid #ffffff',
            sliderThumbBorderRadius: '50%',
            sliderThumbShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.2)',
            
            // Format
            formatBackground: '#ffffff',
            formatBorder: '1px solid #e0e0e0',
            formatBorderRadius: '4px',
            formatPadding: '6px 8px',
            
            // États
            focusBorderColor: '#2196F3',
            errorBorderColor: '#f44336',
            disabledOpacity: 0.6,
            
            // Transitions
            transition: 'all 0.2s ease'
        },
        
        // Messages
        messages: {
            invalidColor: 'Couleur invalide',
            copied: 'Couleur copiée',
            dropperReady: 'Cliquez pour sélectionner une couleur',
            clear: 'Effacer',
            format: 'Format',
            red: 'Rouge',
            green: 'Vert',
            blue: 'Bleu',
            hue: 'Teinte',
            saturation: 'Saturation',
            lightness: 'Luminosité',
            alpha: 'Opacité'
        },
        
        // Hooks
        hooks: {
            // Avant le changement de couleur
            beforeChange: null,
            // Après le changement de couleur
            afterChange: null,
            // Validation personnalisée
            validate: null,
            // Formatage personnalisé
            format: null,
            // Parse personnalisé
            parse: null
        },
        
        // Conversions de couleurs
        colorUtils: {
            // Formats de couleur supportés
            formats: {
                hex: {
                    regex: /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
                    parse: null, // Fonction personnalisée
                    stringify: null // Fonction personnalisée
                },
                rgb: {
                    regex: /^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d*\.?\d+))?\)$/i,
                    parse: null,
                    stringify: null
                },
                hsl: {
                    regex: /^hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*(\d*\.?\d+))?\)$/i,
                    parse: null,
                    stringify: null
                }
            },
            
            // Conversions
            convert: {
                'hex-rgb': null,
                'hex-hsl': null,
                'rgb-hex': null,
                'rgb-hsl': null,
                'hsl-hex': null,
                'hsl-rgb': null
            }
        }
    }
}; 