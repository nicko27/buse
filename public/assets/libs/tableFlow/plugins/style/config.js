export const config = {
    name: 'style',
    version: '1.0.0',
    type: 'style',
    dependencies: [],
    options: {
        // Configuration des modules
        modules: {
            highlight: {
                enabled: true,
                backgroundColor: 'rgba(33, 150, 243, 0.1)',
                transition: 'background-color 0.2s ease'
            },
            conditional: {
                enabled: true
            },
            theme: {
                enabled: true,
                defaultTheme: 'light'
            },
            animation: {
                enabled: true,
                defaultAnimation: 'fade'
            }
        },

        // Classes CSS
        classes: {
            container: 'tableflow-style-container',
            toolbar: 'tableflow-style-toolbar',
            menu: 'tableflow-style-menu',
            button: 'tableflow-style-button',
            menuItem: 'tableflow-style-menu-item'
        },

        // Messages
        messages: {
            highlight: 'Surbrillance',
            conditional: 'Styles conditionnels',
            theme: 'Thème',
            animation: 'Animation'
        },

        // Configuration des thèmes
        themes: {
            light: {
                backgroundColor: '#ffffff',
                textColor: '#333333',
                borderColor: '#e0e0e0',
                headerBackground: '#f5f5f5',
                headerTextColor: '#333333',
                hoverBackground: '#f0f0f0',
                selectedBackground: '#e3f2fd',
                selectedTextColor: '#1976d2'
            },
            dark: {
                backgroundColor: '#1a1a1a',
                textColor: '#ffffff',
                borderColor: '#333333',
                headerBackground: '#2d2d2d',
                headerTextColor: '#ffffff',
                hoverBackground: '#333333',
                selectedBackground: '#0d47a1',
                selectedTextColor: '#ffffff'
            }
        },

        // Configuration des animations
        animations: {
            fade: {
                duration: 300,
                easing: 'ease-in-out'
            },
            slide: {
                duration: 300,
                easing: 'ease-out'
            },
            scale: {
                duration: 300,
                easing: 'ease-out'
            }
        },

        // Hooks
        hooks: {
            beforeStyleApply: null,
            afterStyleApply: null,
            beforeThemeChange: null,
            afterThemeChange: null,
            beforeAnimation: null,
            afterAnimation: null
        }
    }
}; 