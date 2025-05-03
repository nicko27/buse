export default class HighlightPlugin {
    constructor(config = {}) {
        this.name = 'highlight';
        this.version = '2.0.0';
        this.type = 'display';
        this.table = null;
        this.editPlugin = null;
        this.contextMenuPlugin = null;
        
        // Configuration par défaut
        const defaultConfig = {
            // Options générales
            highlightEnabled: true,
            highlightDuringEdit: true,
            highlightClass: 'tf-highlight',
            spanClass: 'tf-highlight-span',
            
            // Clé pour le stockage des règles
            storageKey: 'tableflow-highlight-rules',
            
            // Définition des groupes (entièrement configurable)
            groups: [
                {
                    id: 'red',
                    name: 'Rouge', 
                    color: '#FF0000',
                    backgroundColor: 'transparent',
                    priority: 0
                },
                {
                    id: 'yellow',
                    name: 'Jaune', 
                    color: '#000000',
                    backgroundColor: '#FFFF00',
                    priority: 1
                },
                {
                    id: 'green',
                    name: 'Vert',
                    color: '#FFFFFF',
                    backgroundColor: '#008000',
                    priority: 2
                },
                {
                    id: 'blue',
                    name: 'Bleu',
                    color: '#FFFFFF',
                    backgroundColor: '#0000FF',
                    priority: 3
                },
                {
                    id: 'ignored',
                    name: 'Ignoré',
                    isExclusion: true, // Groupe spécial pour définir des exclusions
                    priority: 10
                }
            ],
            
            // Règles par groupe
            rules: [],
            
            // Options pour le menu contextuel
            menuEnabled: true,
            menuSection: 'Surlignage',
            
            // Options pour la création de règles
            ruleCreation: {
                enabled: true,
                useAjax: false,
                ajaxUrl: '/api/rules',
                ajaxMethod: 'POST',
                ajaxHeaders: {},
                ajaxCallback: null,
            },
            
            // Options pour l'interface utilisateur
            ui: {
                showGroupHeaders: true,
                groupByColor: true,
                allowExport: true,
                allowImport: true,
                modalClass: 'tf-highlight-modal',
                buttonClass: 'tf-highlight-button',
                formClass: 'tf-highlight-form',
                inputClass: 'tf-highlight-input',
                showPreview: true,
                allowCustomColors: true
            },
            
            debug: false
        };
        
        // Fusion de la configuration par défaut avec celle fournie
        this.config = this._mergeConfigs(defaultConfig, config);
        
        // Fonction de debug conditionnelle
        this.debug = this.config.debug ? 
            (...args) => console.log('[HighlightPlugin]', ...args) : 
            () => {};
            
        // Charger les règles sauvegardées si le stockage local est activé
        if (this.config.storageKey) {
            this.loadRules();
        }
        
        // Cache pour les performances
        this.cache = {
            highlightedTexts: new Map(),
            compiledRegexes: new Map()
        };
        
        // État du plugin
        this.state = {
            isHighlighting: false,
            modalOpen: false
        };
    }
    
    // Fusion profonde des configurations
    _mergeConfigs(defaultConfig, userConfig) {
        const result = { ...defaultConfig };
        
        for (const key in userConfig) {
            if (userConfig[key] === null || userConfig[key] === undefined) {
                continue;
            }
            
            if (typeof userConfig[key] === 'object' && !Array.isArray(userConfig[key]) && 
                typeof defaultConfig[key] === 'object' && !Array.isArray(defaultConfig[key])) {
                // Fusion récursive des objets
                result[key] = this._mergeConfigs(defaultConfig[key], userConfig[key]);
            } else {
                // Remplacement direct pour les non-objets ou les tableaux
                result[key] = userConfig[key];
            }
        }
        
        return result;
    }
    
    init(tableHandler) {
        this.table = tableHandler;
        
        // Vérifier que le plugin Edit existe
        this.editPlugin = this.table.getPlugin('edit');
        if (!this.editPlugin) {
            console.error('HighlightPlugin: Edit plugin is required but not found');
            return;
        }
        
        // Rechercher le plugin de menu contextuel (optionnel)
        if (this.config.menuEnabled) {
            this.contextMenuPlugin = this.table.getPlugin('contextMenu');
            if (this.contextMenuPlugin) {
                // S'enregistrer comme fournisseur de menu
                this.contextMenuPlugin.registerProvider(this);
            } else {
                this.debug('ContextMenu plugin not found, highlight context menu will be disabled');
            }
        }
        
        // S'enregistrer aux hooks du plugin Edit
        this.registerWithEditPlugin();
        
        // Appliquer le surlignage initial
        this.highlightAllCells();
        
        // Ajouter les styles CSS
        this.injectStyles();
    }
    
    registerWithEditPlugin() {
        // S'abonner au hook de rendu pour personnaliser l'affichage
        this.editPlugin.addHook('onRender', this.handleRender.bind(this), 'highlight');
        
        // S'abonner au hook de création de champ d'édition pour gérer l'édition avec surlignage
        if (this.config.highlightDuringEdit) {
            this.editPlugin.addHook('afterEdit', this.setupHighlightedEditing.bind(this), 'highlight');
        }
    }
    
    // Hook de rendu pour surligner le texte
    handleRender(cell, value) {
        // Si le surlignage est désactivé ou la cellule n'est pas gérable, ne rien faire
        if (!this.config.highlightEnabled || !this.isCellHighlightable(cell)) {
            return true;
        }
        
        // Vérifier le cache d'abord
        const cacheKey = `${cell.id}:${value}`;
        let highlightedText;
        
        if (this.cache.highlightedTexts.has(cacheKey)) {
            highlightedText = this.cache.highlightedTexts.get(cacheKey);
        } else {
            // Appliquer le surlignage
            highlightedText = this.highlightText(value);
            this.cache.highlightedTexts.set(cacheKey, highlightedText);
        }
        
        // Mettre à jour le contenu du wrapper
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        wrapper.innerHTML = highlightedText;
        
        // Indiquer que nous avons géré le rendu
        return false;
    }
    
    // Vérifier si une cellule peut être surlignée
    isCellHighlightable(cell) {
        // Vérifier que c'est bien une cellule éditable
        return cell && cell.classList.contains(this.editPlugin.config.cellClass);
    }
    
    // Configuration de l'édition avec surlignage
    setupHighlightedEditing(cell, input, currentValue) {
        // Si le surlignage pendant l'édition est désactivé, ne rien faire
        if (!this.config.highlightDuringEdit) {
            return true;
        }
        
        // Créer la structure pour l'édition avec surlignage
        this.setupHighlightedEditField(cell, input, currentValue);
    }
    
    setupHighlightedEditField(cell, input, currentValue) {
        // Remplacer l'input standard par notre système de surlignage
        const container = document.createElement('div');
        container.className = 'tf-highlight-edit-container';
        container.style.position = 'relative';
        container.style.width = '100%';
        
        // Conserver l'input original mais le rendre transparent
        input.className += ' tf-highlight-edit-input';
        input.style.position = 'relative';
        input.style.background = 'transparent';
        input.style.color = 'transparent';
        input.style.caretColor = 'black'; // Pour voir le curseur
        input.style.width = '100%';
        input.style.zIndex = '2';
        
        // Créer la couche de surlignage (overlay)
        const overlay = document.createElement('div');
        overlay.className = 'tf-highlight-edit-overlay';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'none';
        overlay.style.whiteSpace = 'pre-wrap';
        overlay.style.overflow = 'hidden';
        overlay.style.zIndex = '1';
        
        // Appliquer le surlignage initial
        overlay.innerHTML = this.highlightText(currentValue);
        
        // Ajouter l'événement de mise à jour en temps réel
        input.addEventListener('input', () => {
            overlay.innerHTML = this.highlightText(input.value);
        });
        
        // Construire la structure DOM
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        wrapper.innerHTML = '';
        
        container.appendChild(overlay);
        container.appendChild(input);
        wrapper.appendChild(container);
        
        // Focus sur l'input
        input.focus();
    }
    
    // Récupérer un groupe par son ID
    getGroupById(groupId) {
        return this.config.groups.find(group => group.id === groupId);
    }
    
    // Compiler une regex avec cache
    getCompiledRegex(pattern, flags = 'g') {
        const key = `${pattern}:${flags}`;
        
        if (this.cache.compiledRegexes.has(key)) {
            return this.cache.compiledRegexes.get(key);
        }
        
        try {
            const regex = new RegExp(pattern, flags);
            this.cache.compiledRegexes.set(key, regex);
            return regex;
        } catch (error) {
            console.error(`Invalid regex pattern: ${pattern}`, error);
            return null;
        }
    }
    
    // Surlignage du texte avec les groupes
    highlightText(text) {
        if (!text || typeof text !== 'string' || !this.config.highlightEnabled) {
            return text;
        }
        
        if (this.state.isHighlighting) {
            // Éviter la récursion infinie
            return text;
        }
        
        this.state.isHighlighting = true;
        
        try {
            // Préparation des règles d'exclusion
            const exclusionPatterns = this.config.rules
                .filter(rule => {
                    const group = this.getGroupById(rule.group);
                    return group && group.isExclusion && rule.enabled !== false;
                })
                .map(rule => rule.regex);
            
            // Collecter toutes les correspondances
            let matches = [];
            
            for (const rule of this.config.rules) {
                // Passer les règles désactivées
                if (rule.enabled === false) continue;
                
                // Récupérer le groupe associé à cette règle
                const group = this.getGroupById(rule.group);
                if (!group) continue; // Ignorer les règles sans groupe valide
                
                // Ignorer les règles d'exclusion dans cette étape
                if (group.isExclusion) continue;
                
                const regex = this.getCompiledRegex(rule.regex);
                if (!regex) continue;
                
                let match;
                while ((match = regex.exec(text)) !== null) {
                    const matchText = match[0];
                    
                    // Vérifier si ce match doit être ignoré (par les exclusions)
                    let excluded = false;
                    
                    // Vérifier les exclusions globales
                    for (const exclusion of exclusionPatterns) {
                        const exclusionRegex = this.getCompiledRegex(exclusion);
                        if (exclusionRegex && exclusionRegex.test(matchText)) {
                            excluded = true;
                            break;
                        }
                    }
                    
                    // Si le match a ses propres exclusions, les vérifier aussi
                    if (!excluded && rule.exclusions && Array.isArray(rule.exclusions)) {
                        for (const exclusion of rule.exclusions) {
                            const exclusionRegex = this.getCompiledRegex(exclusion);
                            if (exclusionRegex && exclusionRegex.test(matchText)) {
                                excluded = true;
                                break;
                            }
                        }
                    }
                    
                    // Ajouter le match s'il n'est pas exclu
                    if (!excluded) {
                        matches.push({
                            start: match.index,
                            end: match.index + matchText.length,
                            text: matchText,
                            group: group,
                            priority: group.priority || 0
                        });
                    }
                }
            }
            
            // Si aucune correspondance, retourner le texte original
            if (matches.length === 0) {
                return text;
            }
            
            // Trier les correspondances et résoudre les chevauchements
            matches.sort((a, b) => a.start - b.start);
            const nonOverlappingMatches = this.resolveOverlaps(matches);
            
            // Construire le HTML surligné
            nonOverlappingMatches.sort((a, b) => b.end - a.end);
            
            let highlightedText = text;
            for (const match of nonOverlappingMatches) {
                const beforeMatch = highlightedText.substring(0, match.start);
                const matchText = highlightedText.substring(match.start, match.end);
                const afterMatch = highlightedText.substring(match.end);
                
                const spanStyle = `background-color: ${match.group.backgroundColor || 'transparent'}; color: ${match.group.color || 'inherit'};`;
                
                highlightedText = beforeMatch + 
                                `<span class="${this.config.spanClass}" style="${spanStyle}" data-group="${match.group.id}">` + 
                                this.escapeHtml(matchText) + 
                                '</span>' + 
                                afterMatch;
            }
            
            return highlightedText;
        } finally {
            this.state.isHighlighting = false;
        }
    }
    
    // Échapper le HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Résoudre les chevauchements entre correspondances
    resolveOverlaps(matches) {
        if (matches.length <= 1) {
            return matches;
        }
        
        // Trier par priorité du groupe (valeur numérique la plus basse = priorité la plus haute)
        matches.sort((a, b) => (a.priority || 0) - (b.priority || 0));
        
        const result = [];
        const segments = new Map(); // Map pour suivre les segments de texte déjà attribués
        
        for (const match of matches) {
            let canAdd = true;
            let start = match.start;
            let end = match.end;
            
            // Vérifier les chevauchements avec les segments existants
            for (let pos = start; pos < end; pos++) {
                if (segments.has(pos)) {
                    // Ce point est déjà couvert par un match avec priorité plus élevée
                    canAdd = false;
                    break;
                }
            }
            
            if (canAdd) {
                // Marquer tous les points de ce match comme couverts
                for (let pos = start; pos < end; pos++) {
                    segments.set(pos, match);
                }
                result.push(match);
            }
        }
        
        return result;
    }
    
    // Appliquer le surlignage à toutes les cellules
    highlightAllCells() {
        if (!this.table?.table || !this.config.highlightEnabled) {
            return;
        }
        
        const editCells = this.table.table.querySelectorAll('.' + this.editPlugin.config.cellClass);
        editCells.forEach(cell => {
            // Ne pas modifier les cellules en cours d'édition
            if (cell.querySelector('input')) {
                return;
            }
            
            const value = cell.getAttribute('data-value') || cell.textContent.trim();
            if (!value) {
                return;
            }
            
            // Appliquer le surlignage
            const wrapper = cell.querySelector('.cell-wrapper') || cell;
            wrapper.innerHTML = this.highlightText(value);
        });
        
        this.debug('Highlighting applied to all cells');
    }
    
    // Chargement des règles depuis le stockage local
    loadRules() {
        try {
            const savedData = localStorage.getItem(this.config.storageKey);
            if (savedData) {
                const data = JSON.parse(savedData);
                
                // Charger les groupes si fournis
                if (data.groups && Array.isArray(data.groups)) {
                    this.config.groups = data.groups;
                }
                
                // Charger les règles
                if (data.rules && Array.isArray(data.rules)) {
                    this.config.rules = data.rules;
                }
                
                this.debug('Loaded highlight configuration:', { groups: this.config.groups.length, rules: this.config.rules.length });
            }
        } catch (error) {
            console.error('Error loading highlight configuration:', error);
        }
    }
    
    // Sauvegarde des règles dans le stockage local
    saveRules() {
        if (!this.config.storageKey) return;
        
        try {
            const dataToSave = {
                groups: this.config.groups,
                rules: this.config.rules
            };
            
            localStorage.setItem(this.config.storageKey, JSON.stringify(dataToSave));
            this.debug('Saved highlight configuration');
        } catch (error) {
            console.error('Error saving highlight configuration:', error);
        }
    }
    
    // Ajouter une nouvelle règle
    addRule(rule) {
        // Si la création de règles est désactivée, ne rien faire
        if (!this.config.ruleCreation.enabled) {
            this.debug('Rule creation is disabled');
            return null;
        }
        
        // Vérifier la validité minimale de la règle
        if (!rule.group || !rule.regex) {
            console.error('Invalid rule: missing group or regex', rule);
            return null;
        }
        
        // Vérifier que le groupe existe
        const group = this.getGroupById(rule.group);
        if (!group) {
            console.error(`Group '${rule.group}' not found`);
            return null;
        }
        
        // Générer un ID unique si non fourni
        if (!rule.id) {
            rule.id = 'rule_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        }
        
        // Activer par défaut
        if (rule.enabled === undefined) {
            rule.enabled = true;
        }
        
        // Si AJAX est activé, envoyer la règle au serveur
        if (this.config.ruleCreation.useAjax) {
            return this.sendRuleToServer(rule);
        }
        
        // Sinon, procéder à l'ajout local
        this.config.rules.push(rule);
        this.saveRules();
        this.clearCache();
        this.highlightAllCells();
        
        return rule;
    }
    
    // Mettre à jour une règle existante
    updateRule(ruleId, updates) {
        const index = this.config.rules.findIndex(r => r.id === ruleId);
        if (index === -1) {
            return false;
        }
        
        // Mettre à jour les propriétés
        this.config.rules[index] = {
            ...this.config.rules[index],
            ...updates
        };
        
        this.saveRules();
        this.clearCache();
        this.highlightAllCells();
        
        return true;
    }
    
    // Supprimer une règle
    deleteRule(ruleId) {
        const index = this.config.rules.findIndex(r => r.id === ruleId);
        if (index === -1) {
            return false;
        }
        
        this.config.rules.splice(index, 1);
        this.saveRules();
        this.clearCache();
        this.highlightAllCells();
        
        return true;
    }
    
    // Effacer le cache
    clearCache() {
        this.cache.highlightedTexts.clear();
        this.cache.compiledRegexes.clear();
    }
    
    // Activer/désactiver le surlignage global
    toggleHighlighting(enabled) {
        this.config.highlightEnabled = enabled !== undefined ? enabled : !this.config.highlightEnabled;
        
        if (this.config.highlightEnabled) {
            this.highlightAllCells();
        } else {
            // Restaurer les textes originaux
            const editCells = this.table.table.querySelectorAll('.' + this.editPlugin.config.cellClass);
            editCells.forEach(cell => {
                const value = cell.getAttribute('data-value');
                if (value) {
                    const wrapper = cell.querySelector('.cell-wrapper') || cell;
                    wrapper.textContent = value;
                }
            });
        }
        
        return this.config.highlightEnabled;
    }
    
    // Injecter les styles CSS
    injectStyles() {
        if (document.getElementById('highlight-plugin-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'highlight-plugin-styles';
        style.textContent = `
            .${this.config.spanClass} {
                padding: 0 2px;
                border-radius: 2px;
            }
            
            .tf-highlight-edit-container {
                position: relative;
                width: 100%;
            }
            
            .tf-highlight-edit-input {
                position: relative;
                background: transparent !important;
                color: transparent !important;
                caret-color: black !important;
                z-index: 2;
                width: 100%;
                border: none;
                padding: 0;
                margin: 0;
                font: inherit;
            }
            
            .tf-highlight-edit-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                pointer-events: none;
                white-space: pre-wrap;
                word-break: break-word;
                z-index: 1;
                padding: 0;
                margin: 0;
                border: none;
                font: inherit;
            }
            
            /* Modal styles */
            .${this.config.ui.modalClass} {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                width: 600px;
                max-width: 90%;
                max-height: 80vh;
                display: flex;
                flex-direction: column;
                z-index: 1000;
            }
            
            .${this.config.ui.modalClass}-header {
                padding: 16px 20px;
                border-bottom: 1px solid #eee;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            
            .${this.config.ui.modalClass}-body {
                padding: 20px;
                overflow-y: auto;
                flex: 1;
            }
            
            .${this.config.ui.modalClass}-footer {
                padding: 16px 20px;
                border-top: 1px solid #eee;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }
            
            .${this.config.ui.modalClass}-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0,0,0,0.5);
                z-index: 999;
            }
            
            /* Button styles */
            .${this.config.ui.buttonClass} {
                padding: 8px 16px;
                border: 1px solid #ccc;
                border-radius: 4px;
                background: #fff;
                cursor: pointer;
                font-size: 14px;
            }
            
            .${this.config.ui.buttonClass}-primary {
                background: #007bff;
                color: white;
                border-color: #007bff;
            }
            
            .${this.config.ui.buttonClass}-danger {
                background: #dc3545;
                color: white;
                border-color: #dc3545;
            }
            
            /* Form styles */
            .${this.config.ui.formClass} {
                display: flex;
                flex-direction: column;
                gap: 16px;
            }
            
            .${this.config.ui.formClass}-group {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .${this.config.ui.formClass}-label {
                font-weight: 500;
            }
            
            .${this.config.ui.inputClass} {
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                font-size: 14px;
            }
            
            .${this.config.ui.inputClass}:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 2px rgba(0,123,255,0.25);
            }
            
            /* Rules list styles */
            .highlight-rules-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            
            .highlight-rule-item {
                display: flex;
                align-items: center;
                padding: 8px;
                border: 1px solid #eee;
                border-radius: 4px;
                gap: 8px;
            }
            
            .highlight-rule-item:hover {
                background: #f8f9fa;
            }
            
            .highlight-rule-color {
                width: 16px;
                height: 16px;
                border-radius: 50%;
                border: 1px solid #ccc;
            }
            
            .highlight-rule-pattern {
                font-family: monospace;
                flex: 1;
            }
            
            .highlight-rule-actions {
                display: flex;
                gap: 8px;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    /**************************************************************
     * INTERFACE MENU CONTEXTUEL
     **************************************************************/
    
    // Méthode pour fournir des éléments de menu au ContextMenuPlugin
    getMenuItems(cell) {
        // Ne fournir des éléments que pour les cellules éditables
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
        
        // Option pour activer/désactiver le surlignage
        items.push({
            id: 'toggleHighlighting',
            label: this.config.highlightEnabled ? 'Désactiver le surlignage' : 'Activer le surlignage',
            icon: this.config.highlightEnabled ? '🎨' : '⚪'
        });
        
        // Options pour ajouter une règle selon le groupe
        if (this.config.ruleCreation.enabled) {
            const selection = window.getSelection();
            const hasSelection = selection && !selection.isCollapsed && selection.toString().trim() !== '';
            
            if (hasSelection) {
                items.push({
                    type: 'separator'
                });
                
                items.push({
                    type: 'header',
                    label: 'Ajouter une règle'
                });
                
                // Ajouter une entrée pour chaque groupe non-exclusion
                this.config.groups
                    .filter(group => !group.isExclusion)
                    .forEach(group => {
                        items.push({
                            id: `addRuleToGroup:${group.id}`,
                            label: `Surligner en ${group.name}`,
                            icon: '🖍️'
                        });
                    });
                
                // Option pour ajouter aux exclusions
                const ignoredGroup = this.config.groups.find(g => g.isExclusion);
                if (ignoredGroup) {
                    items.push({
                        id: `addRuleToGroup:${ignoredGroup.id}`,
                        label: `Ne pas surligner "${selection.toString().trim()}"`,
                        icon: '🚫'
                    });
                }
            }
        }
        
        // Option pour gérer les règles
        items.push({
            type: 'separator'
        });
        
        items.push({
            id: 'manageRules',
            label: 'Gérer les règles de surlignage',
            icon: '⚙️'
        });
        
        return items;
    }
    
    // Exécuter une action demandée via le menu contextuel
    executeAction(actionId, cell) {
        if (actionId === 'toggleHighlighting') {
            this.toggleHighlighting();
            return;
        }
        
        if (actionId === 'manageRules') {
            this.showRulesManager();
            return;
        }
        
        // Gestion des actions addRuleToGroup:{groupId}
        if (actionId.startsWith('addRuleToGroup:')) {
            const groupId = actionId.split(':')[1];
            this.createRuleFromSelection(cell, groupId);
            return;
        }
    }
    
    // Créer une règle basée sur la sélection de texte
   createRuleFromSelection(cell, groupId) {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
        alert('Veuillez d\'abord sélectionner du texte dans la cellule.');
        return;
    }
    
    // Obtenir le texte sélectionné
    const selectedText = selection.toString().trim();
    if (!selectedText) {
        alert('Aucun texte sélectionné.');
        return;
    }
    
    // Vérifier que le groupe existe
    const group = this.getGroupById(groupId);
    if (!group) {
        alert(`Groupe '${groupId}' introuvable.`);
        return;
    }
    
    // Échapper les caractères spéciaux de regex
    const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Demander si la règle doit être sensible à la casse
    const caseSensitive = confirm('Rendre la règle sensible à la casse ?');
    
    // Créer la nouvelle règle
    const newRule = {
        id: 'rule_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
        group: groupId,
        regex: caseSensitive ? escapedText : '(?i)' + escapedText,
        exclusions: [],
        enabled: true,
        description: `Surligner "${selectedText}" en ${group.name}`
    };
    
    // Ajouter la règle
    const addedRule = this.addRule(newRule);
    
    if (addedRule) {
        // Notification succès
        this.notify('success', `Règle ajoutée avec succès au groupe '${group.name}'`);
    }
}

// Interface graphique pour la gestion des règles
showRulesManager() {
    // Empêcher l'ouverture multiple
    if (this.state.modalOpen) return;
    
    this.state.modalOpen = true;
    
    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.className = `${this.config.ui.modalClass}-overlay`;
    
    // Créer le modal
    const modal = document.createElement('div');
    modal.className = this.config.ui.modalClass;
    
    // En-tête
    const header = document.createElement('div');
    header.className = `${this.config.ui.modalClass}-header`;
    header.innerHTML = `
        <h3 style="margin: 0;">Gestion des règles de surlignage</h3>
        <button class="tf-modal-close ${this.config.ui.buttonClass}" style="padding: 4px 8px;">&times;</button>
    `;
    
    // Corps
    const body = document.createElement('div');
    body.className = `${this.config.ui.modalClass}-body`;
    
    // Pied de page
    const footer = document.createElement('div');
    footer.className = `${this.config.ui.modalClass}-footer`;
    footer.innerHTML = `
        <button class="tf-add-rule-btn ${this.config.ui.buttonClass} ${this.config.ui.buttonClass}-primary">
            Ajouter une règle
        </button>
        ${this.config.ui.allowExport ? `
            <button class="tf-export-btn ${this.config.ui.buttonClass}">
                Exporter
            </button>
        ` : ''}
        ${this.config.ui.allowImport ? `
            <button class="tf-import-btn ${this.config.ui.buttonClass}">
                Importer
            </button>
        ` : ''}
    `;
    
    // Assembler le modal
    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    
    // Ajouter au DOM
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
    
    // Afficher les règles
    this.renderRulesList(body);
    
    // Gestionnaires d'événements
    const closeModal = () => {
        document.body.removeChild(overlay);
        document.body.removeChild(modal);
        this.state.modalOpen = false;
    };
    
    // Fermer sur clic overlay
    overlay.addEventListener('click', closeModal);
    
    // Fermer sur clic bouton X
    header.querySelector('.tf-modal-close').addEventListener('click', closeModal);
    
    // Fermer avec Échap
    const handleKeyDown = (e) => {
        if (e.key === 'Escape' && this.state.modalOpen) {
            closeModal();
            document.removeEventListener('keydown', handleKeyDown);
        }
    };
    document.addEventListener('keydown', handleKeyDown);
    
    // Bouton Ajouter
    footer.querySelector('.tf-add-rule-btn').addEventListener('click', () => {
        this.showAddRuleForm((newRule) => {
            this.renderRulesList(body);
        });
    });
    
    // Bouton Exporter
    const exportBtn = footer.querySelector('.tf-export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            this.exportRules();
        });
    }
    
    // Bouton Importer
    const importBtn = footer.querySelector('.tf-import-btn');
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            this.importRules(() => {
                this.renderRulesList(body);
            });
        });
    }
}

// Afficher la liste des règles
renderRulesList(container) {
    container.innerHTML = '';
    
    if (this.config.rules.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #666;">Aucune règle définie</p>';
        return;
    }
    
    const list = document.createElement('div');
    list.className = 'highlight-rules-list';
    
    // Grouper les règles si nécessaire
    if (this.config.ui.groupByColor) {
        // Créer les sections pour chaque groupe
        this.config.groups.forEach(group => {
            const groupRules = this.config.rules.filter(rule => rule.group === group.id);
            if (groupRules.length === 0) return;
            
            // En-tête du groupe
            if (this.config.ui.showGroupHeaders) {
                const groupHeader = document.createElement('div');
                groupHeader.style.padding = '8px';
                groupHeader.style.background = '#f8f9fa';
                groupHeader.style.borderRadius = '4px';
                groupHeader.style.marginBottom = '8px';
                groupHeader.style.display = 'flex';
                groupHeader.style.alignItems = 'center';
                groupHeader.style.gap = '8px';
                
                // Prévisualisation de la couleur
                const colorPreview = document.createElement('span');
                colorPreview.className = 'highlight-rule-color';
                colorPreview.style.backgroundColor = group.backgroundColor || '#fff';
                colorPreview.style.color = group.color || '#000';
                colorPreview.innerHTML = 'A';
                
                groupHeader.appendChild(colorPreview);
                groupHeader.appendChild(document.createTextNode(group.name));
                list.appendChild(groupHeader);
            }
            
            // Afficher les règles du groupe
            groupRules.forEach(rule => {
                list.appendChild(this.createRuleElement(rule, group));
            });
        });
    } else {
        // Affichage plat
        this.config.rules.forEach(rule => {
            const group = this.getGroupById(rule.group);
            if (group) {
                list.appendChild(this.createRuleElement(rule, group));
            }
        });
    }
    
    container.appendChild(list);
}

// Créer un élément de règle
createRuleElement(rule, group) {
    const ruleElement = document.createElement('div');
    ruleElement.className = 'highlight-rule-item';
    
    // Case à cocher pour activer/désactiver
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = rule.enabled !== false;
    checkbox.addEventListener('change', () => {
        this.updateRule(rule.id, { enabled: checkbox.checked });
    });
    
    // Prévisualisation de la couleur
    const colorPreview = document.createElement('span');
    colorPreview.className = 'highlight-rule-color';
    colorPreview.style.backgroundColor = group.backgroundColor || '#fff';
    
    // Pattern regex
    const pattern = document.createElement('div');
    pattern.className = 'highlight-rule-pattern';
    pattern.textContent = rule.regex;
    pattern.title = rule.description || rule.regex;
    
    // Actions
    const actions = document.createElement('div');
    actions.className = 'highlight-rule-actions';
    
    // Bouton Éditer
    const editBtn = document.createElement('button');
    editBtn.className = this.config.ui.buttonClass;
    editBtn.innerHTML = '✏️';
    editBtn.title = 'Modifier';
    editBtn.addEventListener('click', () => {
        this.showEditRuleForm(rule, () => {
            this.renderRulesList(ruleElement.parentElement.parentElement);
        });
    });
    
    // Bouton Supprimer
    const deleteBtn = document.createElement('button');
    deleteBtn.className = `${this.config.ui.buttonClass} ${this.config.ui.buttonClass}-danger`;
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Supprimer';
    deleteBtn.addEventListener('click', () => {
        if (confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) {
            this.deleteRule(rule.id);
            this.renderRulesList(ruleElement.parentElement.parentElement);
        }
    });
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    
    // Assembler l'élément
    ruleElement.appendChild(checkbox);
    ruleElement.appendChild(colorPreview);
    ruleElement.appendChild(pattern);
    ruleElement.appendChild(actions);
    
    return ruleElement;
}

// Formulaire d'ajout de règle
showAddRuleForm(callback) {
    this.showRuleForm(null, callback);
}

// Formulaire d'édition de règle
showEditRuleForm(rule, callback) {
    this.showRuleForm(rule, callback);
}

// Formulaire générique pour les règles
showRuleForm(rule, callback) {
    const isEdit = !!rule;
    
    // Créer l'overlay
    const overlay = document.createElement('div');
    overlay.className = `${this.config.ui.modalClass}-overlay`;
    overlay.style.zIndex = '1001';
    
    // Créer le formulaire
    const formModal = document.createElement('div');
    formModal.className = this.config.ui.modalClass;
    formModal.style.zIndex = '1002';
    formModal.style.width = '500px';
    
    formModal.innerHTML = `
        <div class="${this.config.ui.modalClass}-header">
            <h3 style="margin: 0;">${isEdit ? 'Modifier la règle' : 'Ajouter une règle'}</h3>
            <button class="tf-form-close ${this.config.ui.buttonClass}" style="padding: 4px 8px;">&times;</button>
        </div>
        <div class="${this.config.ui.modalClass}-body">
            <form class="${this.config.ui.formClass}">
                <div class="${this.config.ui.formClass}-group">
                    <label class="${this.config.ui.formClass}-label">Groupe</label>
                    <select name="group" class="${this.config.ui.inputClass}" required>
                        ${this.config.groups.map(group => `
                            <option value="${group.id}" ${rule && rule.group === group.id ? 'selected' : ''}>
                                ${group.name}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="${this.config.ui.formClass}-group">
                    <label class="${this.config.ui.formClass}-label">Expression régulière</label>
                    <input type="text" name="regex" class="${this.config.ui.inputClass}" 
                           value="${rule ? rule.regex : ''}" required>
                    <small style="color: #666;">Utilisez (?i) au début pour ignorer la casse</small>
                </div>
                
                <div class="${this.config.ui.formClass}-group">
                    <label class="${this.config.ui.formClass}-label">Description (optionnelle)</label>
                    <input type="text" name="description" class="${this.config.ui.inputClass}" 
                           value="${rule ? rule.description || '' : ''}">
                </div>
                
                <div class="${this.config.ui.formClass}-group">
                    <label class="${this.config.ui.formClass}-label">Exclusions (une par ligne)</label>
                    <textarea name="exclusions" class="${this.config.ui.inputClass}" rows="3">${
                        rule && rule.exclusions ? rule.exclusions.join('\n') : ''
                    }</textarea>
                </div>
                
                <div class="${this.config.ui.formClass}-group">
                    <label style="display: flex; align-items: center; gap: 8px;">
                        <input type="checkbox" name="enabled" ${!rule || rule.enabled !== false ? 'checked' : ''}>
                        Activer cette règle
                    </label>
                </div>
                
                ${this.config.ui.showPreview ? `
                    <div class="${this.config.ui.formClass}-group">
                        <label class="${this.config.ui.formClass}-label">Prévisualisation</label>
                        <div class="highlight-preview" style="padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 40px;">
                            Entrez du texte pour tester...
                        </div>
                    </div>
                ` : ''}
            </form>
        </div>
        <div class="${this.config.ui.modalClass}-footer">
            <button type="button" class="tf-form-cancel ${this.config.ui.buttonClass}">Annuler</button>
            <button type="submit" class="tf-form-submit ${this.config.ui.buttonClass} ${this.config.ui.buttonClass}-primary">
                ${isEdit ? 'Mettre à jour' : 'Ajouter'}
            </button>
        </div>
    `;
    
    // Ajouter au DOM
    document.body.appendChild(overlay);
    document.body.appendChild(formModal);
    
    // Récupérer les éléments
    const form = formModal.querySelector('form');
    const closeBtn = formModal.querySelector('.tf-form-close');
    const cancelBtn = formModal.querySelector('.tf-form-cancel');
    const submitBtn = formModal.querySelector('.tf-form-submit');
    const preview = formModal.querySelector('.highlight-preview');
    
    // Gestionnaire de fermeture
    const closeForm = () => {
        document.body.removeChild(overlay);
        document.body.removeChild(formModal);
    };
    
    overlay.addEventListener('click', closeForm);
    closeBtn.addEventListener('click', closeForm);
    cancelBtn.addEventListener('click', closeForm);
    
    // Prévisualisation en temps réel
    if (preview) {
        const updatePreview = () => {
            const regex = form.elements.regex.value;
            const group = this.getGroupById(form.elements.group.value);
            
            if (!regex || !group) {
                preview.textContent = 'Entrez une expression régulière valide...';
                return;
            }
            
            try {
                const testText = 'Voici un exemple de texte pour tester votre expression régulière.';
                const tempRule = {
                    regex: regex,
                    group: group.id,
                    enabled: true
                };
                
                // Créer une copie temporaire des règles
                const originalRules = this.config.rules;
                this.config.rules = [tempRule];
                
                // Appliquer le surlignage
                const highlighted = this.highlightText(testText);
                preview.innerHTML = highlighted;
                
                // Restaurer les règles originales
                this.config.rules = originalRules;
            } catch (error) {
                preview.textContent = 'Expression régulière invalide';
                preview.style.color = 'red';
            }
        };
        
        form.elements.regex.addEventListener('input', updatePreview);
        form.elements.group.addEventListener('change', updatePreview);
        
        // Mise à jour initiale
        if (rule) {
            updatePreview();
        }
    }
    
    // Soumission du formulaire
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Récupérer les valeurs
        const formData = {
            group: form.elements.group.value,
            regex: form.elements.regex.value,
            description: form.elements.description.value,
            exclusions: form.elements.exclusions.value
                .split('\n')
                .map(line => line.trim())
                .filter(line => line !== ''),
            enabled: form.elements.enabled.checked
        };
        
        try {
            // Valider la regex
            new RegExp(formData.regex);
            
            if (isEdit) {
                // Mise à jour
                this.updateRule(rule.id, formData);
            } else {
                // Création
                this.addRule(formData);
            }
            
            closeForm();
            
            if (callback) {
                callback();
            }
        } catch (error) {
            alert('Expression régulière invalide: ' + error.message);
        }
    });
}

// Exporter les règles
exportRules() {
    try {
        const dataToExport = {
            groups: this.config.groups,
            rules: this.config.rules,
            version: this.version,
            exportDate: new Date().toISOString()
        };
        
        const dataStr = JSON.stringify(dataToExport, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `highlight-rules-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.notify('success', 'Configuration exportée avec succès');
    } catch (error) {
        console.error('Error exporting configuration:', error);
        this.notify('error', 'Erreur lors de l\'export: ' + error.message);
    }
}

// Importer des règles
importRules(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Validation de base
                if (!data.groups || !Array.isArray(data.groups) || 
                    !data.rules || !Array.isArray(data.rules)) {
                    throw new Error('Format invalide');
                }
                
                // Validation des règles
                data.rules.forEach(rule => {
                    if (!rule.regex || !rule.group) {
                        throw new Error('Règle invalide détectée');
                    }
                    
                    // Vérifier que la regex est valide
                    new RegExp(rule.regex);
                    
                    // Ajouter un ID si absent
                    if (!rule.id) {
                        rule.id = 'rule_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                    }
                });
                
                // Appliquer l'import
                this.config.groups = data.groups;
                this.config.rules = data.rules;
                this.saveRules();
                this.clearCache();
                this.highlightAllCells();
                
                this.notify('success', 'Configuration importée avec succès');
                
                if (callback) {
                    callback();
                }
            } catch (error) {
                console.error('Error importing configuration:', error);
                this.notify('error', 'Erreur lors de l\'import: ' + error.message);
            }
        };
        
        reader.onerror = () => {
            this.notify('error', 'Erreur lors de la lecture du fichier');
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Notification utilitaire
notify(type, message) {
    // Utiliser le système de notification du tableau si disponible
    if (this.table && this.table.notify) {
        this.table.notify(type, message);
    } else {
        // Fallback sur console
        console[type === 'error' ? 'error' : 'log'](`[HighlightPlugin] ${message}`);
    }
}

refresh() {
    if (this.config.highlightEnabled) {
        this.clearCache();
        this.highlightAllCells();
    }
}

destroy() {
    // Se désabonner des hooks du plugin Edit
    if (this.editPlugin) {
        this.editPlugin.removeHooksByNamespace('highlight');
    }
    
    // Se désabonner du plugin de menu contextuel
    if (this.contextMenuPlugin) {
        // TODO: Implémenter unregisterProvider dans ContextMenuPlugin
    }
    
    // Nettoyer les caches
    this.clearCache();
    
    // Nettoyer les styles
    const style = document.getElementById('highlight-plugin-styles');
    if (style) {
        style.remove();
    }
}
}