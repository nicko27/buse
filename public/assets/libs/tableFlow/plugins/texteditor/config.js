export const config = {
    name: 'texteditor',
    version: '1.0.0',
    dependencies: [],
    options: {
        // Classes CSS
        editorClass: 'tableflow-texteditor',
        activeClass: 'active',
        toolbarClass: 'tableflow-toolbar',
        buttonClass: 'tableflow-toolbar-button',
        dropdownClass: 'tableflow-toolbar-dropdown',
        separatorClass: 'tableflow-toolbar-separator',
        contentClass: 'tableflow-editor-content',
        placeholderClass: 'tableflow-editor-placeholder',
        
        // Configuration de l'éditeur
        placeholder: 'Saisissez votre texte...',
        spellcheck: true,
        autofocus: true,
        maxLength: 1000,
        minHeight: '100px',
        maxHeight: '300px',
        
        // Options d'auto-sauvegarde
        autoSave: true,
        autoSaveInterval: 5000,
        
        // Barre d'outils
        toolbar: {
            position: 'top', // 'top' | 'bottom' | 'left' | 'right'
            sticky: true,
            buttons: {
                // Formatage de texte
                bold: {
                    icon: '𝐁',
                    title: 'Gras',
                    command: 'bold'
                },
                italic: {
                    icon: '𝑰',
                    title: 'Italique',
                    command: 'italic'
                },
                underline: {
                    icon: '̲U̲',
                    title: 'Souligné',
                    command: 'underline'
                },
                strikethrough: {
                    icon: '𝐒',
                    title: 'Barré',
                    command: 'strikethrough'
                },
                
                // Alignement
                alignment: {
                    type: 'dropdown',
                    icon: '⫏',
                    title: 'Alignement',
                    options: [
                        { value: 'left', label: 'Gauche', icon: '⫏' },
                        { value: 'center', label: 'Centre', icon: '⚌' },
                        { value: 'right', label: 'Droite', icon: '⫐' },
                        { value: 'justify', label: 'Justifié', icon: '☰' }
                    ]
                },
                
                // Listes
                list: {
                    type: 'dropdown',
                    icon: '•',
                    title: 'Listes',
                    options: [
                        { value: 'bullet', label: 'Liste à puces', icon: '•' },
                        { value: 'number', label: 'Liste numérotée', icon: '1.' }
                    ]
                },
                
                // Liens
                link: {
                    icon: '🔗',
                    title: 'Insérer un lien',
                    command: 'createLink'
                },
                unlink: {
                    icon: '🔓',
                    title: 'Supprimer le lien',
                    command: 'unlink'
                },
                
                // Couleurs
                textColor: {
                    type: 'color',
                    icon: 'A',
                    title: 'Couleur du texte',
                    colors: [
                        '#000000', '#333333', '#666666', '#999999',
                        '#FF0000', '#00FF00', '#0000FF', '#FFFF00',
                        '#FF00FF', '#00FFFF', '#800000', '#008000',
                        '#000080', '#808000', '#800080', '#008080'
                    ]
                },
                backgroundColor: {
                    type: 'color',
                    icon: '▣',
                    title: 'Couleur de fond',
                    colors: [
                        '#FFFFFF', '#CCCCCC', '#999999', '#666666',
                        '#FFCCCC', '#CCFFCC', '#CCCCFF', '#FFFFCC',
                        '#FFCCFF', '#CCFFFF', '#FFE5E5', '#E5FFE5',
                        '#E5E5FF', '#FFFAE5', '#FFE5FF', '#E5FFFF'
                    ]
                }
            }
        },
        
        // Raccourcis clavier
        shortcuts: {
            'mod+b': 'bold',
            'mod+i': 'italic',
            'mod+u': 'underline',
            'mod+k': 'link',
            'mod+z': 'undo',
            'mod+y': 'redo',
            'mod+shift+z': 'redo'
        },
        
        // Styles par défaut
        style: {
            // Éditeur
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontSize: '14px',
            lineHeight: '1.5',
            color: '#333333',
            background: '#ffffff',
            padding: '8px',
            borderRadius: '4px',
            border: '1px solid #e0e0e0',
            
            // Barre d'outils
            toolbarBackground: '#ffffff',
            toolbarBorder: '1px solid #e0e0e0',
            toolbarBorderRadius: '4px',
            toolbarPadding: '4px',
            toolbarMargin: '0 0 8px 0',
            toolbarShadow: '0 1px 3px rgba(0,0,0,0.1)',
            
            // Boutons
            buttonSize: '32px',
            buttonPadding: '4px',
            buttonMargin: '0 2px',
            buttonBorderRadius: '4px',
            buttonBackground: 'transparent',
            buttonColor: '#666666',
            buttonHoverBackground: '#f5f5f5',
            buttonHoverColor: '#333333',
            buttonActiveBackground: '#e3f2fd',
            buttonActiveColor: '#2196F3',
            
            // Séparateurs
            separatorColor: '#e0e0e0',
            separatorMargin: '0 8px',
            
            // Dropdowns
            dropdownBackground: '#ffffff',
            dropdownBorder: '1px solid #e0e0e0',
            dropdownBorderRadius: '4px',
            dropdownShadow: '0 2px 5px rgba(0,0,0,0.1)',
            dropdownPadding: '4px 0',
            
            // Options des dropdowns
            optionPadding: '8px 12px',
            optionHoverBackground: '#f5f5f5',
            optionActiveBackground: '#e3f2fd',
            
            // Palette de couleurs
            colorSize: '24px',
            colorMargin: '2px',
            colorBorderRadius: '4px',
            colorBorder: '1px solid #e0e0e0',
            colorHoverBorder: '1px solid #2196F3',
            colorActiveBorder: '2px solid #2196F3',
            
            // Transitions
            transition: 'all 0.2s ease'
        },
        
        // Messages
        messages: {
            placeholder: 'Saisissez votre texte...',
            linkPrompt: 'Entrez l\'URL du lien :',
            saved: 'Modifications enregistrées',
            error: 'Erreur lors de l\'enregistrement'
        }
    }
}; 