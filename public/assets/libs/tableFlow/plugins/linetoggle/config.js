export const config = {
    name: 'linetoggle',
    version: '2.0.0',
    type: 'display',
    dependencies: ['Edit'], // EditPlugin pour la détection des changements

    // Options générales
    enabled: true,
    debug: false,

    // Attribut HTML pour activer le plugin sur une colonne
    toggleAttribute: 'th-linetoggle',

    // Application des règles
    apply: {
        onInit: true,      // Appliquer à l'initialisation
        onChange: true,    // Appliquer lors des changements
        onAdd: true,       // Appliquer sur les nouvelles lignes
        onEdit: true      // Appliquer pendant l'édition
    },

    // Règles par défaut (peuvent être étendues par l'attribut HTML)
    rules: {
        // Exemple de configuration pour une colonne 'status'
        // status: [
        //     { value: 'active', addClass: 'row-active', removeClass: 'row-inactive' },
        //     { values: ['pending', 'waiting'], addClass: 'row-pending' },
        //     { pattern: '^error-.*$', addClass: 'row-error' }
        // ]
    },

    // Classes CSS par défaut
    classNames: {
        active: 'tf-row-active',
        inactive: 'tf-row-inactive',
        pending: 'tf-row-pending',
        error: 'tf-row-error',
        warning: 'tf-row-warning',
        success: 'tf-row-success'
    },

    // Messages et textes
    messages: {
        ruleApplied: 'Règle appliquée à la ligne {rowId}',
        ruleError: 'Erreur lors de l\'application de la règle: {error}',
        invalidRule: 'Règle invalide pour la colonne {columnId}',
        noRules: 'Aucune règle définie pour la colonne {columnId}'
    },

    // Hooks pour personnalisation
    hooks: {
        // Avant l'application d'une règle
        beforeApply: null,
        // Après l'application d'une règle
        afterApply: null,
        // Avant la suppression d'une classe
        beforeRemove: null,
        // Après la suppression d'une classe
        afterRemove: null,
        // Pour la validation des règles
        validateRule: null
    },

    // Options de performance
    performance: {
        debounceDelay: 250,    // Délai pour le debounce des changements
        batchUpdates: true,    // Grouper les mises à jour
        cacheRules: true      // Mettre en cache les règles parsées
    },

    // Options d'interface
    ui: {
        showIndicators: true,  // Afficher des indicateurs visuels
        animate: true,         // Animer les changements de classe
        transitions: {
            duration: '0.3s',
            timing: 'ease'
        }
    },

    // Options d'accessibilité
    accessibility: {
        announceChanges: true,         // Annoncer les changements aux lecteurs d'écran
        ariaAttributes: true,          // Ajouter des attributs ARIA
        keyboardNavigation: true      // Support de la navigation au clavier
    },

    // Support du thème sombre
    darkMode: {
        enabled: true,
        classPrefix: 'dark-',
        autoDetect: true
    },

    // Persistance des règles
    storage: {
        enabled: false,
        key: 'tableflow-linetoggle-rules',
        type: 'localStorage' // 'localStorage' | 'sessionStorage'
    }
}; 