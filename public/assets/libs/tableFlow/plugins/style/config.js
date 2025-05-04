export const config = {
    name: 'style',
    version: '1.0.0',
    type: 'display',
    dependencies: ['Edit'],

    // Options générales
    enabled: true,
    debug: false,
    storageKey: 'tableflow-style-rules',

    // Modules
    modules: {
        highlight: {
            enabled: true,
            mode: 'cell', // 'cell', 'row', 'column'
            colors: [
                { id: 'red', name: 'Rouge', value: '#FF0000', textColor: '#FFFFFF' },
                { id: 'yellow', name: 'Jaune', value: '#FFFF00', textColor: '#000000' },
                { id: 'green', name: 'Vert', value: '#008000', textColor: '#FFFFFF' },
                { id: 'blue', name: 'Bleu', value: '#0000FF', textColor: '#FFFFFF' }
            ],
            interface: {
                buttonIcon: '🎨',
                buttonText: 'Styles',
                buttonPosition: 'toolbar',
                showColorPicker: true,
                showLabels: true,
                closeOnSelect: true,
                closeOnClickOutside: true
            }
        },
        conditional: {
            enabled: true,
            maxRules: 100,
            defaultOperators: ['equals', 'contains', 'greater', 'less', 'between', 'empty'],
            interface: {
                showRuleBuilder: true,
                showPreview: true
            }
        },
        theme: {
            enabled: true,
            defaultTheme: 'light',
            themes: {
                light: {
                    background: '#FFFFFF',
                    text: '#000000',
                    border: '#DDDDDD'
                },
                dark: {
                    background: '#222222',
                    text: '#FFFFFF',
                    border: '#444444'
                }
            }
        },
        animation: {
            enabled: true,
            duration: 300,
            easing: 'ease-in-out',
            effects: ['fade', 'slide']
        }
    },

    // Style par défaut
    style: {
        // Base
        fontFamily: 'inherit',
        fontSize: 'inherit',
        transition: 'all 0.3s ease',

        // Conteneurs
        containerBackground: '#FFFFFF',
        containerBorder: '1px solid #DDD',
        containerBorderRadius: '4px',
        containerPadding: '8px',
        containerMargin: '4px',

        // Éléments d'interface
        buttonBackground: '#F5F5F5',
        buttonHoverBackground: '#E5E5E5',
        buttonActiveBackground: '#D5D5D5',
        buttonBorder: '1px solid #DDD',
        buttonBorderRadius: '4px',
        buttonPadding: '6px 12px',
        buttonMargin: '4px',

        // Menus et popups
        menuBackground: '#FFFFFF',
        menuBorder: '1px solid #DDD',
        menuBorderRadius: '4px',
        menuShadow: '0 2px 8px rgba(0,0,0,0.1)',
        menuMaxHeight: '300px',
        menuZIndex: 1000
    },

    // Classes CSS
    classes: {
        container: 'tf-style-container',
        button: 'tf-style-button',
        menu: 'tf-style-menu',
        menuItem: 'tf-style-menu-item',
        active: 'tf-style-active',
        disabled: 'tf-style-disabled',
        highlight: 'tf-style-highlight',
        conditional: 'tf-style-conditional',
        theme: 'tf-style-theme',
        animation: 'tf-style-animation'
    }
}; 