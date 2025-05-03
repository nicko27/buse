export default class TextEditorPlugin {
    constructor(config = {}) {
        this.name = 'textEditor';
        this.version = '1.0.0';
        this.type = 'extension';
        this.table = null;
        this.editPlugin = null;
        this.contextMenuPlugin = null;
        
        // Configuration par défaut
        this.config = {
            // Actions prédéfinies
            actions: {
                deleteSentence: {
                    label: 'Supprimer cette phrase',
                    icon: '✂️',
                    handler: this.deleteSentence.bind(this)
                },
                deleteRegexMatch: {
                    label: 'Supprimer texte contenant...',
                    icon: '🔍',
                    handler: this.deleteRegexMatch.bind(this)
                },
                capitalizeSentence: {
                    label: 'Mettre en majuscules',
                    icon: 'Aa',
                    handler: this.capitalizeSentence.bind(this)
                }
            },
            
            // Raccourcis clavier
            shortcutsEnabled: true,
            shortcuts: {
                'Ctrl+Delete': 'deleteSentence'
            },
            
            // Section dans le menu contextuel
            menuSection: 'Texte',
            
            debug: false
        };
        
        // Fusion avec la configuration fournie
        Object.assign(this.config, config);
        
        this.debug = this.config.debug ? 
            (...args) => console.log('[TextEditorPlugin]', ...args) : 
            () => {};
    }
    
    init(tableHandler) {
        this.table = tableHandler;
        
        // Trouver les plugins nécessaires
        this.editPlugin = this.table.getPlugin('edit');
        if (!this.editPlugin) {
            console.error('TextEditorPlugin: Edit plugin is required but not found');
            return;
        }
        
        this.contextMenuPlugin = this.table.getPlugin('contextMenu');
        if (this.contextMenuPlugin) {
            // S'enregistrer comme fournisseur de menu
            this.contextMenuPlugin.registerProvider(this);
        } else {
            this.debug('ContextMenu plugin not found, context menu will be disabled');
        }
        
        // S'enregistrer aux hooks du plugin Edit
        this.registerWithEditPlugin();
    }
    
    registerWithEditPlugin() {
        // Écouter les événements clavier si activés
        if (this.config.shortcutsEnabled) {
            this.editPlugin.addHook('onKeydown', this.handleKeydown.bind(this));
        }
    }
    
    // Méthode pour fournir des éléments de menu au ContextMenuPlugin
    getMenuItems(cell) {
        // Ne fournir des éléments que pour les cellules éditables
        if (!cell || !cell.classList.contains(this.editPlugin.config.cellClass)) {
            return [];
        }
        
        const items = [];
        
        // Ajouter un en-tête de section si configuré
        if (this.config.menuSection) {
            items.push({
                type: 'header',
                label: this.config.menuSection
            });
        }
        
        // Ajouter chaque action configurée
        Object.entries(this.config.actions).forEach(([id, action]) => {
            items.push({
                id,
                label: action.label,
                icon: action.icon
            });
        });
        
        return items;
    }
    
    // Exécuter une action demandée via le menu contextuel
    executeAction(actionId, cell) {
        const action = this.config.actions[actionId];
        if (!action || typeof action.handler !== 'function') {
            this.debug(`Action non trouvée: ${actionId}`);
            return;
        }
        
        // Récupérer la valeur actuelle
        const currentValue = cell.getAttribute('data-value') || cell.textContent.trim();
        
        // Exécuter le handler
        action.handler(cell, currentValue);
    }
    
    // Action: Supprimer la phrase sous le curseur
    deleteSentence(cell, text) {
        if (!text) return;
        
        // Détection de la position du clic dans le texte
        // Comme on n'a pas cette information, on peut supprimer la première phrase
        // Dans une implémentation réelle, il faudrait détecter la phrase sous le curseur
        
        // Séparer le texte en phrases
        const sentences = this.splitIntoSentences(text);
        if (sentences.length <= 1) {
            this.debug('Impossible de supprimer la seule phrase');
            return;
        }
        
        // Supprimer la première phrase pour cet exemple
        sentences.shift();
        
        // Reconstruire le texte
        const newText = sentences.join(' ');
        
        // Mettre à jour la cellule
        this.updateCellValue(cell, newText);
    }
    
    // Action: Supprimer le texte correspondant à une regex
    deleteRegexMatch(cell, text) {
        if (!text) return;
        
        // Demander à l'utilisateur de saisir une expression régulière
        const pattern = prompt('Entrez le texte ou le motif à rechercher:');
        if (!pattern) return;
        
        try {
            // Créer la regex - recherche insensible à la casse
            const regex = new RegExp(pattern, 'gi');
            
            // Remplacer les correspondances par une chaîne vide
            const newText = text.replace(regex, '');
            
            // Mettre à jour la cellule
            this.updateCellValue(cell, newText);
        } catch (error) {
            alert('Expression régulière invalide');
            console.error('Erreur de regex:', error);
        }
    }
    
    // Action: Mettre en majuscules la phrase sous le curseur
    capitalizeSentence(cell, text) {
        if (!text) return;
        
        // Détection de la position du clic dans le texte
        // Comme pour deleteSentence, on utilise la première phrase
        
        // Séparer le texte en phrases
        const sentences = this.splitIntoSentences(text);
        if (sentences.length === 0) return;
        
        // Mettre en majuscules la première phrase
        sentences[0] = sentences[0].toUpperCase();
        
        // Reconstruire le texte
        const newText = sentences.join(' ');
        
        // Mettre à jour la cellule
        this.updateCellValue(cell, newText);
    }
    
    // Utilitaire: Séparation en phrases
    splitIntoSentences(text) {
        // Regex simplifiée pour séparer en phrases
        // Dans une implémentation réelle, cette regex devrait être plus sophistiquée
        return text.split(/(?<=[.!?])\s+/);
    }
    
    // Utilitaire: Mise à jour de la valeur de la cellule
    updateCellValue(cell, newValue) {
        const oldValue = cell.getAttribute('data-value');
        
        // Mettre à jour la valeur
        cell.setAttribute('data-value', newValue);
        
        // Mettre à jour l'affichage
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        wrapper.innerHTML = newValue;
        
        // Marquer la ligne comme modifiée
        const row = cell.closest('tr');
        if (row) {
            row.classList.add(this.editPlugin.config.modifiedClass);
        }
        
        // Déclencher l'événement de changement
        const changeEvent = new CustomEvent('cell:change', {
            detail: {
                cellId: cell.id,
                columnId: cell.id.split('_')[0],
                rowId: row ? row.id : null,
                value: newValue,
                oldValue: oldValue,
                cell: cell,
                source: 'textEditor',
                tableId: this.table.table.id
            },
            bubbles: false
        });
        
        this.table.table.dispatchEvent(changeEvent);
    }
    
    // Gestion des raccourcis clavier
    handleKeydown(event, cell, input) {
        // Si aucun raccourci n'est défini, on ne fait rien
        if (!this.config.shortcuts) return true;
        
        // Construire l'identificateur de la touche
        let key = '';
        if (event.ctrlKey) key += 'Ctrl+';
        if (event.altKey) key += 'Alt+';
        if (event.shiftKey) key += 'Shift+';
        key += event.key;
        
        // Vérifier si un raccourci correspond
        const actionId = this.config.shortcuts[key];
        if (actionId && this.config.actions[actionId]) {
            // Exécuter l'action
            this.executeAction(actionId, cell);
            event.preventDefault();
            return false; // Empêcher le traitement par le plugin Edit
        }
        
        // Laisser le plugin Edit gérer l'événement
        return true;
    }
    
    refresh() {
        // Rien à rafraîchir spécifiquement
    }
    
    destroy() {
        // Se désabonner du hook onKeydown
        if (this.editPlugin) {
            // Idéalement, il faudrait une méthode removeHook dans EditPlugin
            // Pour l'instant, nous ne pouvons pas nettoyer proprement
        }
    }
}