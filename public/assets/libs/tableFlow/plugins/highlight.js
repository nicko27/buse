export default class HighlightPlugin {
    constructor(config = {}) {
        this.name = 'highlight';
        this.version = '1.0.0';
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
                inputClass: 'tf-highlight-input'
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
        
        // Trouver les plugins nécessaires
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
    }
    
    registerWithEditPlugin() {
        // S'abonner au hook de rendu pour personnaliser l'affichage
        this.editPlugin.addHook('onRender', this.handleRender.bind(this));
        
        // S'abonner au hook de création de champ d'édition pour gérer l'édition avec surlignage
        if (this.config.highlightDuringEdit) {
            this.editPlugin.addHook('afterEdit', this.setupHighlightedEditing.bind(this));
        }
    }
    
    // Hook de rendu pour surligner le texte
    handleRender(cell, value) {
        // Si le surlignage est désactivé ou la cellule n'est pas gérable, ne rien faire
        if (!this.config.highlightEnabled || !this.isCellHighlightable(cell)) {
            return true;
        }
        
        // Appliquer le surlignage
        const highlightedText = this.highlightText(value);
        
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
    
    // Surlignage du texte avec les groupes
    highlightText(text) {
        if (!text || typeof text !== 'string' || !this.config.highlightEnabled) {
            return text;
        }
        
        // Préparation des règles d'exclusion
        const exclusionPatterns = this.config.rules
            .filter(rule => {
                const group = this.getGroupById(rule.group);
                return group && group.isExclusion;
            })
            .map(rule => rule.regex);
        
        // Collecter toutes les correspondances
        let matches = [];
        
        for (const rule of this.config.rules) {
            // Récupérer le groupe associé à cette règle
            const group = this.getGroupById(rule.group);
            if (!group) continue; // Ignorer les règles sans groupe valide
            
            // Ignorer les règles d'exclusion dans cette étape
            if (group.isExclusion) continue;
            
            try {
                const regex = new RegExp(rule.regex, 'g');
                let match;
                
                while ((match = regex.exec(text)) !== null) {
                    const matchText = match[0];
                    
                    // Vérifier si ce match doit être ignoré (par les exclusions)
                    let excluded = false;
                    
                    // Vérifier les exclusions globales
                    for (const exclusion of exclusionPatterns) {
                        try {
                            const exclusionRegex = new RegExp(exclusion);
                            if (exclusionRegex.test(matchText)) {
                                excluded = true;
                                break;
                            }
                        } catch (e) {
                            // Ignorer les regex invalides
                        }
                    }
                    
                    // Si le match a ses propres exclusions, les vérifier aussi
                    if (!excluded && rule.exclusions && Array.isArray(rule.exclusions)) {
                        for (const exclusion of rule.exclusions) {
                            try {
                                const exclusionRegex = new RegExp(exclusion);
                                if (exclusionRegex.test(matchText)) {
                                    excluded = true;
                                    break;
                                }
                            } catch (e) {
                                // Ignorer les regex invalides
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
            } catch (error) {
                console.error(`Invalid regex in highlight rule:`, rule, error);
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
                            matchText + 
                            '</span>' + 
                            afterMatch;
        }
        
        return highlightedText;
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
        
        // Si AJAX est activé, envoyer la règle au serveur
        if (this.config.ruleCreation.useAjax) {
            return this.sendRuleToServer(rule);
        }
        
        // Sinon, procéder à l'ajout local
        this.config.rules.push(rule);
        this.saveRules();
        this.highlightAllCells();
        
        return rule;
    }
    
    // Envoi d'une règle au serveur via AJAX
    sendRuleToServer(rule) {
        const { ajaxUrl, ajaxMethod, ajaxHeaders, ajaxCallback } = this.config.ruleCreation;
        
        return fetch(ajaxUrl, {
            method: ajaxMethod,
            headers: {
                'Content-Type': 'application/json',
                ...ajaxHeaders
            },
            body: JSON.stringify(rule)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            // Si le serveur a répondu avec une règle mise à jour, l'utiliser
            const serverRule = data.rule || rule;
            
            // Ajouter la règle localement
            this.config.rules.push(serverRule);
            this.saveRules();
            this.highlightAllCells();
            
            // Appeler le callback si fourni
            if (typeof ajaxCallback === 'function') {
                ajaxCallback(serverRule, data);
            }
            
            return serverRule;
        })
        .catch(error => {
            console.error('Error sending rule to server:', error);
            return null;
        });
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
        this.highlightAllCells();
        
        return true;
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
            icon: this.config.highlightEnabled ? '👁️' : '👁️‍🗨️'
        });
        
        // Options pour ajouter une règle selon le groupe
        if (this.config.ruleCreation.enabled) {
            const selection = window.getSelection();
            const hasSelection = selection && !selection.isCollapsed && selection.toString().trim() !== '';
            
            if (hasSelection) {
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
                            label: `Sélection en ${group.name}`,
                            icon: '✓'
                        });
                    });
                
                // Option pour ajouter à 'Ignoré'
                const ignoredGroup = this.config.groups.find(g => g.isExclusion);
                if (ignoredGroup) {
                    items.push({
                        id: `addRuleToGroup:${ignoredGroup.id}`,
                        label: `Ignorer cette sélection`,
                        icon: '✗'
                    });
                }
            }
        }
        
        // Option pour gérer les règles (ouvre une modale)
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
        
        // Créer la nouvelle règle
        const newRule = {
            id: 'rule_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            group: groupId,
            regex: escapedText,
            exclusions: []
        };
        
        // Ajouter la règle
        const addedRule = this.addRule(newRule);
        
        if (addedRule) {
            // Notification succès
            alert(`Règle ajoutée avec succès au groupe '${group.name}'`);
        }
    }
    
    // Interface graphique pour la gestion des règles
    showRulesManager() {
        const { modalClass, buttonClass, formClass } = this.config.ui;
        
        // Créer une boîte de dialogue modale pour gérer les règles
        const modal = document.createElement('div');
        modal.className = modalClass;
        modal.style.position = 'fixed';
        modal.style.top = '50%';
        modal.style.left = '50%';
        modal.style.transform = 'translate(-50%, -50%)';
        modal.style.width = '600px';
        modal.style.maxWidth = '90%';
        modal.style.maxHeight = '80vh';
        modal.style.backgroundColor = 'white';
        modal.style.border = '1px solid #ccc';
        modal.style.borderRadius = '5px';
        modal.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
        modal.style.padding = '20px';
        modal.style.zIndex = '2000';
        modal.style.overflow = 'auto';
        
        // Contenu du modal
        modal.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <h3 style="margin: 0;">Règles de surlignage</h3>
                <button class="tf-modal-close" style="background: none; border: none; font-size: 20px; cursor: pointer;">&times;</button>
            </div>
            <div class="tf-rules-container" style="margin-bottom: 20px; max-height: 300px; overflow-y: auto;"></div>
            <div style="display: flex; justify-content: space-between;">
                <button class="tf-add-rule-btn ${buttonClass}" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Ajouter une règle
                </button>
                <div>
                    ${this.config.ui.allowExport ? `
                        <button class="tf-export-btn ${buttonClass}" style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; margin-right: 8px;">
                            Exporter
                        </button>
                    ` : ''}
                    ${this.config.ui.allowImport ? `
                        <button class="tf-import-btn ${buttonClass}" style="padding: 8px 16px; background: #FF9800; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            Importer
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Fermer le modal
        const closeModal = () => {
            document.body.removeChild(modal);
            document.body.removeChild(overlay);
        };
        
        // Fond semi-transparent
        const overlay = document.createElement('div');
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1999';
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // Fermer avec le bouton X
        modal.querySelector('.tf-modal-close').addEventListener('click', closeModal);
        
        // Fermer avec Échap
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // Afficher les règles existantes
        this.renderRulesList(modal.querySelector('.tf-rules-container'));
        
        // Bouton Ajouter
        modal.querySelector('.tf-add-rule-btn').addEventListener('click', () => {
            this.showAddRuleForm(modal, () => {
                this.renderRulesList(modal.querySelector('.tf-rules-container'));
            });
        });
        
        // Bouton Exporter si présent
        const exportBtn = modal.querySelector('.tf-export-btn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportRules();
            });
        }
        
        // Bouton Importer si présent
        const importBtn = modal.querySelector('.tf-import-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importRules(() => {
                    this.renderRulesList(modal.querySelector('.tf-rules-container'));
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
    
    // Option pour grouper par couleur
    let rules = [...this.config.rules];
    
    if (this.config.ui.groupByColor) {
        // Grouper les règles par groupe
        const groupedRules = {};
        
        // Créer les sections de groupe
        this.config.groups.forEach(group => {
            groupedRules[group.id] = {
                group: group,
                rules: []
            };
        });
        
        // Ajouter chaque règle à son groupe correspondant
        rules.forEach(rule => {
            if (groupedRules[rule.group]) {
                groupedRules[rule.group].rules.push(rule);
            }
        });
        
        // Générer le HTML pour chaque groupe qui a des règles
        Object.values(groupedRules).forEach(groupData => {
            if (groupData.rules.length === 0) return;
            
            // En-tête du groupe si activé
            if (this.config.ui.showGroupHeaders) {
                const groupHeader = document.createElement('div');
                groupHeader.style.padding = '5px 10px';
                groupHeader.style.background = '#f8f8f8';
                groupHeader.style.borderBottom = '1px solid #ddd';
                groupHeader.style.fontWeight = 'bold';
                groupHeader.style.marginBottom = '8px';
                
                // Prévisualisation de la couleur
                const colorPreview = document.createElement('span');
                colorPreview.style.display = 'inline-block';
                colorPreview.style.width = '15px';
                colorPreview.style.height = '15px';
                colorPreview.style.borderRadius = '50%';
                colorPreview.style.marginRight = '5px';
                colorPreview.style.verticalAlign = 'middle';
                colorPreview.style.backgroundColor = groupData.group.backgroundColor || 'transparent';
                colorPreview.style.border = '1px solid #ccc';
                
                if (groupData.group.color && groupData.group.color !== 'inherit') {
                    colorPreview.style.color = groupData.group.color;
                    colorPreview.innerHTML = 'A';
                }
                
                groupHeader.appendChild(colorPreview);
                groupHeader.appendChild(document.createTextNode(groupData.group.name));
                container.appendChild(groupHeader);
            }
            
            // Afficher les règles de ce groupe
            groupData.rules.forEach(rule => {
                this.renderRuleItem(container, rule, groupData.group);
            });
        });
    } else {
        // Affichage plat de toutes les règles
        rules.forEach(rule => {
            const group = this.getGroupById(rule.group);
            if (group) {
                this.renderRuleItem(container, rule, group);
            }
        });
    }
}

// Rendu d'un élément de règle
renderRuleItem(container, rule, group) {
    const ruleItem = document.createElement('div');
    ruleItem.style.display = 'flex';
    ruleItem.style.alignItems = 'center';
    ruleItem.style.padding = '10px';
    ruleItem.style.borderBottom = '1px solid #eee';
    ruleItem.style.marginBottom = '8px';
    
    // Expression régulière
    const regexDiv = document.createElement('div');
    regexDiv.style.flex = '1';
    regexDiv.style.fontFamily = 'monospace';
    regexDiv.style.fontSize = '0.9em';
    regexDiv.textContent = rule.regex;
    ruleItem.appendChild(regexDiv);
    
    // Case à cocher pour activer/désactiver
    const enabledCheckbox = document.createElement('input');
    enabledCheckbox.type = 'checkbox';
    enabledCheckbox.checked = rule.enabled !== false;
    enabledCheckbox.addEventListener('change', () => {
        this.updateRule(rule.id, { enabled: enabledCheckbox.checked });
    });
    ruleItem.appendChild(enabledCheckbox);
    
    // Boutons d'action
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '5px';
    actions.style.marginLeft = '10px';
    
    // Bouton Modifier
    const editButton = document.createElement('button');
    editButton.innerHTML = '✏️';
    editButton.title = 'Modifier';
    editButton.style.background = 'none';
    editButton.style.border = '1px solid #ddd';
    editButton.style.borderRadius = '3px';
    editButton.style.padding = '3px 8px';
    editButton.style.cursor = 'pointer';
    editButton.addEventListener('click', () => {
        this.showEditRuleForm(rule, () => {
            this.renderRulesList(container);
        });
    });
    actions.appendChild(editButton);
    
    // Bouton Supprimer
    const deleteButton = document.createElement('button');
    deleteButton.innerHTML = '🗑️';
    deleteButton.title = 'Supprimer';
    deleteButton.style.background = 'none';
    deleteButton.style.border = '1px solid #ddd';
    deleteButton.style.borderRadius = '3px';
    deleteButton.style.padding = '3px 8px';
    deleteButton.style.cursor = 'pointer';
    deleteButton.addEventListener('click', () => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer cette règle ?`)) {
            this.deleteRule(rule.id);
            this.renderRulesList(container);
        }
    });
    actions.appendChild(deleteButton);
    
    ruleItem.appendChild(actions);
    container.appendChild(ruleItem);
}

// Formulaire d'ajout de règle
showAddRuleForm(modal, callback) {
    const formContainer = document.createElement('div');
    formContainer.style.position = 'fixed';
    formContainer.style.top = '50%';
    formContainer.style.left = '50%';
    formContainer.style.transform = 'translate(-50%, -50%)';
    formContainer.style.zIndex = '2001';
    formContainer.style.backgroundColor = 'white';
    formContainer.style.padding = '20px';
    formContainer.style.borderRadius = '5px';
    formContainer.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
    formContainer.style.width = '500px';
    formContainer.style.maxWidth = '90%';
    
    // Générer les options de groupe
    const groupOptions = this.config.groups.map(group => 
        `<option value="${group.id}">${group.name}</option>`
    ).join('');
    
    formContainer.innerHTML = `
        <h3 style="margin-top: 0;">Ajouter une règle</h3>
        <form id="add-rule-form">
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Groupe</label>
                <select id="rule-group" style="width: 100%; padding: 8px; box-sizing: border-box;" required>
                    ${groupOptions}
                </select>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Expression régulière</label>
                <input type="text" id="rule-regex" style="width: 100%; padding: 8px; box-sizing: border-box;" required>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Exclusions (séparées par des sauts de ligne)</label>
                <textarea id="rule-exclusions" style="width: 100%; padding: 8px; box-sizing: border-box; height: 80px;"></textarea>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="rule-enabled" checked>
                    <span style="margin-left: 5px;">Activer cette règle</span>
                </label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button type="button" id="cancel-rule" style="padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">
                    Annuler
                </button>
                <button type="submit" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Ajouter
                </button>
            </div>
        </form>
    `;
    
    document.body.appendChild(formContainer);
    
    // Fermer le formulaire
    const closeForm = () => {
        document.body.removeChild(formContainer);
    };
    
    // Gérer l'annulation
    formContainer.querySelector('#cancel-rule').addEventListener('click', closeForm);
    
    // Gérer la soumission
    formContainer.querySelector('#add-rule-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const group = formContainer.querySelector('#rule-group').value;
        const regex = formContainer.querySelector('#rule-regex').value;
        const exclusionsText = formContainer.querySelector('#rule-exclusions').value;
        const enabled = formContainer.querySelector('#rule-enabled').checked;
        
        // Traitement des exclusions
        const exclusions = exclusionsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');
        
        try {
            // Vérifier que la regex est valide
            new RegExp(regex);
            
            // Créer la règle
            const newRule = {
                id: 'rule_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
                group,
                regex,
                exclusions,
                enabled
            };
            
            // Ajouter la règle
            this.addRule(newRule);
            
            // Fermer le formulaire
            closeForm();
            
            // Rappeler le callback
            if (typeof callback === 'function') {
                callback();
            }
        } catch (error) {
            alert('Expression régulière invalide: ' + error.message);
        }
    });
}

// Formulaire de modification de règle
showEditRuleForm(rule, callback) {
    const formContainer = document.createElement('div');
    formContainer.style.position = 'fixed';
    formContainer.style.top = '50%';
    formContainer.style.left = '50%';
    formContainer.style.transform = 'translate(-50%, -50%)';
    formContainer.style.zIndex = '2001';
    formContainer.style.backgroundColor = 'white';
    formContainer.style.padding = '20px';
    formContainer.style.borderRadius = '5px';
    formContainer.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
    formContainer.style.width = '500px';
    formContainer.style.maxWidth = '90%';
    
    // Générer les options de groupe
    const groupOptions = this.config.groups.map(group => 
        `<option value="${group.id}" ${rule.group === group.id ? 'selected' : ''}>${group.name}</option>`
    ).join('');
    
    // Exclusions comme texte
    const exclusionsText = rule.exclusions && Array.isArray(rule.exclusions) ? 
        rule.exclusions.join('\n') : '';
    
    formContainer.innerHTML = `
        <h3 style="margin-top: 0;">Modifier la règle</h3>
        <form id="edit-rule-form">
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Groupe</label>
                <select id="rule-group" style="width: 100%; padding: 8px; box-sizing: border-box;" required>
                    ${groupOptions}
                </select>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Expression régulière</label>
                <input type="text" id="rule-regex" style="width: 100%; padding: 8px; box-sizing: border-box;" required value="${rule.regex || ''}">
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: block; margin-bottom: 5px;">Exclusions (séparées par des sauts de ligne)</label>
                <textarea id="rule-exclusions" style="width: 100%; padding: 8px; box-sizing: border-box; height: 80px;">${exclusionsText}</textarea>
            </div>
            <div style="margin-bottom: 10px;">
                <label style="display: flex; align-items: center;">
                    <input type="checkbox" id="rule-enabled" ${rule.enabled !== false ? 'checked' : ''}>
                    <span style="margin-left: 5px;">Activer cette règle</span>
                </label>
            </div>
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px;">
                <button type="button" id="cancel-rule" style="padding: 8px 16px; background: #ccc; border: none; border-radius: 4px; cursor: pointer;">
                    Annuler
                </button>
                <button type="submit" style="padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Mettre à jour
                </button>
            </div>
        </form>
    `;
    
    document.body.appendChild(formContainer);
    
    // Fermer le formulaire
    const closeForm = () => {
        document.body.removeChild(formContainer);
    };
    
    // Gérer l'annulation
    formContainer.querySelector('#cancel-rule').addEventListener('click', closeForm);
    
    // Gérer la soumission
    formContainer.querySelector('#edit-rule-form').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const group = formContainer.querySelector('#rule-group').value;
        const regex = formContainer.querySelector('#rule-regex').value;
        const exclusionsText = formContainer.querySelector('#rule-exclusions').value;
        const enabled = formContainer.querySelector('#rule-enabled').checked;
        
        // Traitement des exclusions
        const exclusions = exclusionsText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line !== '');
        
        try {
            // Vérifier que la regex est valide
            new RegExp(regex);
            
            // Mettre à jour la règle
            this.updateRule(rule.id, {
                group,
                regex,
                exclusions,
                enabled
            });
            
            // Fermer le formulaire
            closeForm();
            
            // Rappeler le callback
            if (typeof callback === 'function') {
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
            rules: this.config.rules
        };
        
        const dataStr = "data:text/json;charset=utf-8," + 
                      encodeURIComponent(JSON.stringify(dataToExport, null, 2));
        
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "highlight-rules.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        
        alert('Configuration exportée avec succès !');
    } catch (error) {
        console.error('Error exporting configuration:', error);
        alert('Erreur lors de l\'export de la configuration: ' + error.message);
    }
}

// Importer des règles
importRules(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = event => {
            try {
                const data = JSON.parse(event.target.result);
                
                // Vérifier la validité minimale
                if (!data.groups || !Array.isArray(data.groups) || 
                    !data.rules || !Array.isArray(data.rules)) {
                    throw new Error('Format invalide: la configuration doit contenir "groups" et "rules"');
                }
                
                // Vérifier les règles et les groupes
                data.groups.forEach(group => {
                    if (!group.id) {
                        throw new Error('Groupe invalide: ID manquant');
                    }
                });
                
                data.rules.forEach(rule => {
                    if (!rule.regex || !rule.group) {
                        throw new Error('Règle invalide: regex ou groupe manquant');
                    }
                    
                    // Vérifier que la regex est valide
                    new RegExp(rule.regex);
                    
                    // Ajouter un ID si absent
                    if (!rule.id) {
                        rule.id = 'rule_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                    }
                });
                
                // Remplacer la configuration actuelle
                this.config.groups = data.groups;
                this.config.rules = data.rules;
                this.saveRules();
                
                // Réappliquer le surlignage
                this.highlightAllCells();
                
                // Rappeler le callback
                if (typeof callback === 'function') {
                    callback();
                }
                
                alert('Configuration importée avec succès !');
            } catch (error) {
                console.error('Error importing configuration:', error);
                alert('Erreur lors de l\'import de la configuration: ' + error.message);
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

refresh() {
    if (this.config.highlightEnabled) {
        this.highlightAllCells();
    }
}

destroy() {
    // Se désabonner des hooks du plugin Edit
    if (this.editPlugin) {
        // Idéalement, il faudrait une méthode removeHook dans EditPlugin
    }
    
    // Se désabonner du plugin de menu contextuel
    if (this.contextMenuPlugin) {
        // Idéalement, il faudrait une méthode unregisterProvider dans ContextMenuPlugin
    }
}
}