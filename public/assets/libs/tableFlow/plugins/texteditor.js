export default class TextEditorPlugin {
    constructor(config = {}) {
        this.name = 'textEditor';
        this.version = '2.0.0';
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
                    handler: this.deleteSentence.bind(this),
                    shortcut: 'Ctrl+Delete'
                },
                deleteWord: {
                    label: 'Supprimer ce mot',
                    icon: '🔤',
                    handler: this.deleteWord.bind(this),
                    shortcut: 'Ctrl+Backspace'
                },
                deleteRegexMatch: {
                    label: 'Supprimer texte contenant...',
                    icon: '🔍',
                    handler: this.deleteRegexMatch.bind(this)
                },
                capitalizeSentence: {
                    label: 'Mettre la phrase en majuscules',
                    icon: 'Aa',
                    handler: this.capitalizeSentence.bind(this)
                },
                capitalizeWord: {
                    label: 'Mettre le mot en majuscules',
                    icon: 'A',
                    handler: this.capitalizeWord.bind(this),
                    shortcut: 'Ctrl+Shift+U'
                },
                lowercaseText: {
                    label: 'Mettre en minuscules',
                    icon: 'a',
                    handler: this.lowercaseText.bind(this),
                    shortcut: 'Ctrl+Shift+L'
                },
                trimSpaces: {
                    label: 'Supprimer les espaces superflus',
                    icon: '⌫',
                    handler: this.trimSpaces.bind(this)
                },
                wrapQuotes: {
                    label: 'Entourer de guillemets',
                    icon: '"',
                    handler: this.wrapQuotes.bind(this),
                    shortcut: 'Ctrl+Shift+Quote'
                },
                findReplace: {
                    label: 'Rechercher et remplacer...',
                    icon: '🔄',
                    handler: this.findReplace.bind(this),
                    shortcut: 'Ctrl+H'
                }
            },
            
            // Raccourcis clavier
            shortcutsEnabled: true,
            
            // Section dans le menu contextuel
            menuSection: 'Édition de texte',
            
            // Options avancées
            sentenceDetection: 'smart', // 'simple' ou 'smart'
            preserveFormatting: true,
            undoEnabled: true,
            maxUndoSteps: 10,
            
            // Personnalisation
            customActions: {},
            
            debug: false
        };
        
        // Fusion avec la configuration fournie
        this.config = this.mergeConfig(this.config, config);
        
        // Historique pour undo/redo
        this.history = new Map(); // cellId -> [states]
        this.historyIndex = new Map(); // cellId -> currentIndex
        
        // Détection du curseur
        this.cursorTracker = {
            cell: null,
            position: 0,
            selection: null
        };
        
        // Logger
        this.debug = this.config.debug ? 
            (...args) => console.log('[TextEditorPlugin]', ...args) : 
            () => {};
    }
    
    /**
     * Fusionne les configurations en profondeur
     */
    mergeConfig(defaultConfig, userConfig) {
        const merged = { ...defaultConfig };
        
        for (const key in userConfig) {
            if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key])) {
                merged[key] = this.mergeConfig(defaultConfig[key] || {}, userConfig[key]);
            } else {
                merged[key] = userConfig[key];
            }
        }
        
        // Ajouter les actions personnalisées
        if (userConfig.customActions) {
            merged.actions = { ...merged.actions, ...userConfig.customActions };
        }
        
        return merged;
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
            this.contextMenuPlugin.registerProvider(this);
        }
        
        // S'enregistrer aux hooks du plugin Edit
        this.registerWithEditPlugin();
        
        // Ajouter des écouteurs pour le tracking du curseur
        this.setupCursorTracking();
    }
    
    registerWithEditPlugin() {
        // Écouter les événements clavier
        if (this.config.shortcutsEnabled) {
            this.editPlugin.addHook('onKeydown', this.handleKeydown.bind(this), 'textEditor');
        }
        
        // Écouter le début de l'édition pour initialiser l'historique
        this.editPlugin.addHook('afterEdit', this.initializeHistory.bind(this), 'textEditor');
        
        // Écouter les changements pour l'historique
        this.editPlugin.addHook('beforeSave', this.saveToHistory.bind(this), 'textEditor');
    }
    
    setupCursorTracking() {
        // Écouter les événements de sélection
        document.addEventListener('selectionchange', () => {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            const container = range.commonAncestorContainer;
            
            // Trouver la cellule parente
            const cell = container.nodeType === Node.TEXT_NODE ? 
                container.parentElement.closest('td') : 
                container.closest('td');
                
            if (cell && cell.classList.contains(this.editPlugin.config.cellClass)) {
                this.cursorTracker.cell = cell;
                this.cursorTracker.position = range.startOffset;
                this.cursorTracker.selection = {
                    start: range.startOffset,
                    end: range.endOffset,
                    text: selection.toString()
                };
            }
        });
    }
    
    /**
     * Initialise l'historique pour une cellule
     */
    initializeHistory(cell, input, currentValue) {
        const cellId = cell.id;
        
        if (!this.history.has(cellId)) {
            this.history.set(cellId, [currentValue]);
            this.historyIndex.set(cellId, 0);
        }
    }
    
    /**
     * Sauvegarde dans l'historique
     */
    saveToHistory(cell, newValue, oldValue) {
        if (!this.config.undoEnabled) return true;
        
        const cellId = cell.id;
        
        if (this.history.has(cellId)) {
            const history = this.history.get(cellId);
            const currentIndex = this.historyIndex.get(cellId);
            
            // Supprimer les états après l'index actuel
            history.splice(currentIndex + 1);
            
            // Ajouter le nouvel état
            history.push(newValue);
            
            // Limiter la taille de l'historique
            if (history.length > this.config.maxUndoSteps) {
                history.shift();
            } else {
                this.historyIndex.set(cellId, history.length - 1);
            }
        }
        
        return true;
    }
    
    /**
     * Annule la dernière action
     */
    undo(cell) {
        const cellId = cell.id;
        
        if (!this.history.has(cellId)) return;
        
        const history = this.history.get(cellId);
        const currentIndex = this.historyIndex.get(cellId);
        
        if (currentIndex > 0) {
            const newIndex = currentIndex - 1;
            const previousValue = history[newIndex];
            
            this.historyIndex.set(cellId, newIndex);
            this.updateCellValue(cell, previousValue, false); // false = pas d'ajout à l'historique
        }
    }
    
    /**
     * Rétablit la dernière action annulée
     */
    redo(cell) {
        const cellId = cell.id;
        
        if (!this.history.has(cellId)) return;
        
        const history = this.history.get(cellId);
        const currentIndex = this.historyIndex.get(cellId);
        
        if (currentIndex < history.length - 1) {
            const newIndex = currentIndex + 1;
            const nextValue = history[newIndex];
            
            this.historyIndex.set(cellId, newIndex);
            this.updateCellValue(cell, nextValue, false);
        }
    }
    
    // Méthode pour fournir des éléments de menu au ContextMenuPlugin
    getMenuItems(cell) {
        if (!cell || !cell.classList.contains(this.editPlugin.config.cellClass)) {
            return [];
        }
        
        const items = [];
        
        // En-tête de section
        if (this.config.menuSection) {
            items.push({
                type: 'header',
                label: this.config.menuSection
            });
        }
        
        // Ajouter chaque action configurée
        Object.entries(this.config.actions).forEach(([id, action]) => {
            const menuItem = {
                id,
                label: action.label,
                icon: action.icon
            };
            
            // Ajouter le raccourci dans le label si disponible
            if (action.shortcut) {
                menuItem.label += ` (${action.shortcut})`;
            }
            
            items.push(menuItem);
        });
        
        // Ajouter un séparateur puis undo/redo si activé
        if (this.config.undoEnabled) {
            items.push({ type: 'separator' });
            items.push({
                id: 'undo',
                label: 'Annuler (Ctrl+Z)',
                icon: '↩️'
            });
            items.push({
                id: 'redo',
                label: 'Rétablir (Ctrl+Y)',
                icon: '↪️'
            });
        }
        
        return items;
    }
    
    // Exécuter une action demandée via le menu contextuel
    executeAction(actionId, cell) {
        if (actionId === 'undo') {
            this.undo(cell);
            return;
        }
        
        if (actionId === 'redo') {
            this.redo(cell);
            return;
        }
        
        const action = this.config.actions[actionId];
        if (!action || typeof action.handler !== 'function') {
            this.debug(`Action non trouvée: ${actionId}`);
            return;
        }
        
        // Récupérer la valeur actuelle et la position du curseur
        const currentValue = cell.getAttribute('data-value') || cell.textContent.trim();
        const context = {
            cell,
            value: currentValue,
            cursor: this.cursorTracker,
            selection: this.getSelectionContext(cell)
        };
        
        // Exécuter le handler
        action.handler(context);
    }
    
    /**
     * Récupère le contexte de sélection
     */
    getSelectionContext(cell) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return null;
        
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Vérifier si la sélection est dans cette cellule
        const isInCell = container.nodeType === Node.TEXT_NODE ? 
            container.parentElement.closest('td') === cell : 
            container.closest('td') === cell;
            
        if (!isInCell) return null;
        
        return {
            start: range.startOffset,
            end: range.endOffset,
            text: selection.toString()
        };
    }
    
    /**
     * Actions de manipulation de texte
     */
    
    // Supprimer la phrase courante
    deleteSentence(context) {
        const { value, cursor } = context;
        if (!value) return;
        
        const sentences = this.splitIntoSentences(value);
        if (sentences.length <= 1) {
            this.debug('Impossible de supprimer la seule phrase');
            return;
        }
        
        // Trouver la phrase sous le curseur
        let currentPos = 0;
        let sentenceIndex = 0;
        
        for (let i = 0; i < sentences.length; i++) {
            const sentenceLength = sentences[i].length;
            if (cursor.position >= currentPos && cursor.position <= currentPos + sentenceLength) {
                sentenceIndex = i;
                break;
            }
            currentPos += sentenceLength + 1; // +1 pour l'espace entre phrases
        }
        
        // Supprimer la phrase
        sentences.splice(sentenceIndex, 1);
        const newText = sentences.join(' ').trim();
        
        this.updateCellValue(context.cell, newText);
    }
    
    // Supprimer le mot courant
    deleteWord(context) {
        const { value, cursor } = context;
        if (!value) return;
        
        const words = this.splitIntoWords(value);
        if (words.length <= 1) return;
        
        // Trouver le mot sous le curseur
        let currentPos = 0;
        let wordIndex = 0;
        
        for (let i = 0; i < words.length; i++) {
            const wordLength = words[i].length;
            if (cursor.position >= currentPos && cursor.position <= currentPos + wordLength) {
                wordIndex = i;
                break;
            }
            currentPos += wordLength + 1; // +1 pour l'espace
        }
        
        // Supprimer le mot
        words.splice(wordIndex, 1);
        const newText = words.join(' ').trim();
        
        this.updateCellValue(context.cell, newText);
    }
    
    // Supprimer le texte correspondant à une regex
    deleteRegexMatch(context) {
        const { value } = context;
        if (!value) return;
        
        const pattern = prompt('Entrez le texte ou le motif à rechercher:');
        if (!pattern) return;
        
        try {
            const regex = new RegExp(pattern, 'gi');
            const newText = value.replace(regex, '').replace(/\s+/g, ' ').trim();
            
            if (newText === value) {
                alert('Aucune correspondance trouvée');
                return;
            }
            
            this.updateCellValue(context.cell, newText);
        } catch (error) {
            alert('Expression régulière invalide');
            console.error('Erreur de regex:', error);
        }
    }
    
    // Mettre en majuscules la phrase courante
    capitalizeSentence(context) {
        const { value, cursor } = context;
        if (!value) return;
        
        const sentences = this.splitIntoSentences(value);
        
        // Trouver la phrase sous le curseur
        let currentPos = 0;
        let sentenceIndex = 0;
        
        for (let i = 0; i < sentences.length; i++) {
            const sentenceLength = sentences[i].length;
            if (cursor.position >= currentPos && cursor.position <= currentPos + sentenceLength) {
                sentenceIndex = i;
                break;
            }
            currentPos += sentenceLength + 1;
        }
        
        // Capitaliser la phrase
        sentences[sentenceIndex] = sentences[sentenceIndex].toUpperCase();
        const newText = sentences.join(' ');
        
        this.updateCellValue(context.cell, newText);
    }
    
    // Mettre en majuscules le mot courant
    capitalizeWord(context) {
        const { value, cursor } = context;
        if (!value) return;
        
        const words = this.splitIntoWords(value);
        
        // Trouver le mot sous le curseur
        let currentPos = 0;
        let wordIndex = 0;
        
        for (let i = 0; i < words.length; i++) {
            const wordLength = words[i].length;
            if (cursor.position >= currentPos && cursor.position <= currentPos + wordLength) {
                wordIndex = i;
                break;
            }
            currentPos += wordLength + 1;
        }
        
        // Capitaliser le mot
        words[wordIndex] = words[wordIndex].toUpperCase();
        const newText = words.join(' ');
        
        this.updateCellValue(context.cell, newText);
    }
    
    // Mettre en minuscules
    lowercaseText(context) {
        const { value, selection } = context;
        if (!value) return;
        
        let newText;
        if (selection && selection.text) {
            // Appliquer uniquement à la sélection
            const before = value.substring(0, selection.start);
            const selected = selection.text.toLowerCase();
            const after = value.substring(selection.end);
            newText = before + selected + after;
        } else {
            // Appliquer à tout le texte
            newText = value.toLowerCase();
        }
        
        this.updateCellValue(context.cell, newText);
    }
    
    // Supprimer les espaces superflus
    trimSpaces(context) {
        const { value } = context;
        if (!value) return;
        
        // Supprimer les espaces multiples et trim
        const newText = value.replace(/\s+/g, ' ').trim();
        
        this.updateCellValue(context.cell, newText);
    }
    
    // Entourer de guillemets
    wrapQuotes(context) {
        const { value, selection } = context;
        if (!value) return;
        
        let newText;
        if (selection && selection.text) {
            // Entourer la sélection
            const before = value.substring(0, selection.start);
            const selected = `"${selection.text}"`;
            const after = value.substring(selection.end);
            newText = before + selected + after;
        } else {
            // Entourer tout le texte
            newText = `"${value}"`;
        }
        
        this.updateCellValue(context.cell, newText);
    }
    
    // Rechercher et remplacer
    findReplace(context) {
        const { value } = context;
        if (!value) return;
        
        const find = prompt('Rechercher:');
        if (!find) return;
        
        const replace = prompt('Remplacer par:');
        if (replace === null) return; // null = annulé, "" = remplacer par vide
        
        // Demander si sensible à la casse
        const caseSensitive = confirm('Sensible à la casse ?');
        
        // Demander si utiliser regex
        const useRegex = confirm('Utiliser une expression régulière ?');
        
        try {
            let newText;
            if (useRegex) {
                const flags = caseSensitive ? 'g' : 'gi';
                const regex = new RegExp(find, flags);
                newText = value.replace(regex, replace);
            } else {
                // Remplacement simple
                if (caseSensitive) {
                    newText = value.split(find).join(replace);
                } else {
                    const regex = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
                    newText = value.replace(regex, replace);
                }
            }
            
            if (newText === value) {
                alert('Aucune correspondance trouvée');
                return;
            }
            
            this.updateCellValue(context.cell, newText);
        } catch (error) {
            alert('Erreur: ' + error.message);
        }
    }
    
    /**
     * Utilitaires de manipulation de texte
     */
    
    // Séparer en phrases (version améliorée)
    splitIntoSentences(text) {
        if (this.config.sentenceDetection === 'simple') {
            return text.split(/(?<=[.!?])\s+/);
        }
        
        // Détection intelligente des phrases
        // Gère les abréviations, nombres décimaux, etc.
        const abbreviations = ['Dr', 'Mr', 'Mrs', 'Ms', 'vs', 'etc', 'Inc', 'Ltd', 'Jr', 'Sr', 'Ph.D'];
        const pattern = new RegExp(
            `(?<!\\b(?:${abbreviations.join('|')}))(?<![0-9])\\. |[!?] `, 
            'g'
        );
        
        const sentences = [];
        let lastIndex = 0;
        let match;
        
        while ((match = pattern.exec(text)) !== null) {
            sentences.push(text.substring(lastIndex, match.index + 1).trim());
            lastIndex = match.index + match[0].length;
        }
        
        if (lastIndex < text.length) {
            sentences.push(text.substring(lastIndex).trim());
        }
        
        return sentences.filter(s => s.length > 0);
    }
    
    // Séparer en mots
    splitIntoWords(text) {
        return text.split(/\s+/).filter(word => word.length > 0);
    }
    
    // Mise à jour de la valeur de la cellule
    updateCellValue(cell, newValue, addToHistory = true) {
        const oldValue = cell.getAttribute('data-value');
        
        // Sauvegarder dans l'historique si demandé
        if (addToHistory && this.config.undoEnabled) {
            this.saveToHistory(cell, newValue, oldValue);
        }
        
        // Mettre à jour la valeur
        cell.setAttribute('data-value', newValue);
        
        // Mettre à jour l'affichage
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        wrapper.textContent = newValue;
        
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
        // Construire l'identificateur de la touche
        let key = '';
        if (event.ctrlKey || event.metaKey) key += 'Ctrl+';
        if (event.altKey) key += 'Alt+';
        if (event.shiftKey) key += 'Shift+';
        key += event.key;
        
        // Normaliser certaines touches
        const normalizedKey = key
            .replace('Control', 'Ctrl')
            .replace('Delete', 'Delete')
            .replace('Backspace', 'Backspace')
            .replace('"', 'Quote')
            .replace("'", 'Quote');
        
        // Gérer Undo/Redo
        if (normalizedKey === 'Ctrl+z') {
            this.undo(cell);
            event.preventDefault();
            return false;
        }
        
        if (normalizedKey === 'Ctrl+y' || normalizedKey === 'Ctrl+Shift+z') {
            this.redo(cell);
            event.preventDefault();
            return false;
        }
        
        // Vérifier si un raccourci correspond
        for (const [actionId, action] of Object.entries(this.config.actions)) {
            if (action.shortcut === normalizedKey) {
                const context = {
                    cell,
                    value: input.value,
                    cursor: {
                        position: input.selectionStart,
                        cell: cell
                    },
                    selection: {
                        start: input.selectionStart,
                        end: input.selectionEnd,
                        text: input.value.substring(input.selectionStart, input.selectionEnd)
                    }
                };
                
                action.handler(context);
                event.preventDefault();
                return false;
            }
        }
        
        return true;
    }
    
    refresh() {
        // Réinitialiser si nécessaire
    }
    
    destroy() {
        // Nettoyer les hooks
        if (this.editPlugin) {
            this.editPlugin.removeHooksByNamespace('textEditor');
        }
        
        // Nettoyer l'historique
        this.history.clear();
        this.historyIndex.clear();
    }
}