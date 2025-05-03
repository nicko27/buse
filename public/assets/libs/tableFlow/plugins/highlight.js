/**
 * Plugin Highlight pour TableFlow
 * Permet de surligner dynamiquement des portions de texte dans les cellules éditables
 * en fonction de règles basées sur des expressions régulières et des groupes de style.
 * S'intègre avec EditPlugin pour le rendu et l'édition, et avec ContextMenuPlugin
 * pour des actions contextuelles.
 *
 * @class HighlightPlugin
 * @depends EditPlugin - Requis pour le rendu et l'édition dans les cellules.
 * @depends ContextMenuPlugin - Optionnel, pour l'intégration du menu contextuel.
 */
export default class HighlightPlugin {
    /**
     * Crée une instance de HighlightPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'highlight';
        this.version = '2.0.1'; // Version mise à jour
        this.type = 'display'; // Type de plugin: modifie l'affichage
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {object|null} Référence à l'instance du plugin Edit */
        this.editPlugin = null;
        /** @type {object|null} Référence à l'instance du plugin ContextMenu */
        this.contextMenuPlugin = null;
        /** @type {string[]} Dépendances requises et optionnelles */
        this.dependencies = ['Edit', 'ContextMenu']; // Edit est requis, ContextMenu est optionnel mais listé

        // Configuration par défaut fusionnée avec celle fournie
        // Utilisation d'une fonction pour éviter la mutation de l'objet par défaut
        this.config = this._mergeConfigs(this.getDefaultConfig(), config);

        // Fonction de debug conditionnelle (sera pleinement fonctionnelle après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[Highlight ${this.table?.tableId}]`, ...args) ?? console.debug('[Highlight]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Charger les règles sauvegardées si la persistance est activée
        if (this.config.storageKey) {
            this.loadRules(); // Fait avant l'init pour que les règles soient prêtes
        }

        // Cache pour les performances
        this.cache = {
            highlightedTexts: new Map(), // Cache pour le rendu surligné (clé: cellId:value)
            compiledRegexes: new Map()   // Cache pour les regex compilées (clé: pattern:flags)
        };

        // État interne du plugin
        this.state = {
            isHighlighting: false, // Pour éviter la récursion dans highlightText
            modalOpen: false       // Indicateur si la modale de gestion est ouverte
        };

        // Lier les méthodes pour les hooks et les listeners
        this._bindMethods();
    }

    /** Retourne la configuration par défaut. */
    getDefaultConfig() {
        // Retourne un nouvel objet à chaque fois
        return {
            // Options générales
            highlightEnabled: true,
            highlightDuringEdit: true, // Maintenir surlignage pendant l'édition?
            // highlightClass: 'tf-highlight', // Peu utilisé, le style est sur le span
            spanClass: 'tf-highlight-span', // Classe pour les <span> de surlignage

            // Persistance
            storageKey: 'tableflow-highlight-rules', // Clé localStorage pour groupes/règles

            // Groupes de surlignage par défaut
            groups: [
                { id: 'red', name: 'Rouge', color: '#FF0000', backgroundColor: 'transparent', priority: 0 },
                { id: 'yellow', name: 'Jaune', color: '#000000', backgroundColor: '#FFFF00', priority: 1 },
                { id: 'green', name: 'Vert', color: '#FFFFFF', backgroundColor: '#008000', priority: 2 },
                { id: 'blue', name: 'Bleu', color: '#FFFFFF', backgroundColor: '#0000FF', priority: 3 },
                { id: 'ignored', name: 'Ignoré', isExclusion: true, priority: 10 }
            ],

            // Règles par défaut (sera écrasé par localStorage si présent)
            rules: [],

            // Options Menu Contextuel
            menuEnabled: true,
            menuSection: 'Surlignage',

            // Options Création de Règles
            ruleCreation: {
                enabled: true,
                useAjax: false,
                ajaxUrl: '/api/rules',
                ajaxMethod: 'POST',
                ajaxHeaders: {},
                ajaxCallback: null,
            },

            // Options Interface Utilisateur (Modale)
            ui: {
                showGroupHeaders: true,
                groupByColor: true,
                allowExport: true,
                allowImport: true,
                modalClass: 'tf-highlight-modal',
                buttonClass: 'tf-highlight-button', // Classe de base pour les boutons
                formClass: 'tf-highlight-form',
                inputClass: 'tf-highlight-input',
                showPreview: true, // Afficher la prévisualisation dans le formulaire de règle
                // allowCustomColors: true // Option pour permettre la définition de couleurs perso? (Non implémenté)
            },

            debug: false
        };
    }

    /** Lie les méthodes utilisées comme gestionnaires ou callbacks. @private */
    _bindMethods() {
        // Pour les hooks Edit
        this.handleRender = this.handleRender.bind(this);
        this.setupHighlightedEditing = this.setupHighlightedEditing.bind(this);
        // Pour l'interface ContextMenu
        this.getMenuItems = this.getMenuItems.bind(this);
        this.executeAction = this.executeAction.bind(this);
        // Pour les listeners de la modale (seront liés lors de la création)
    }

    /**
     * Fusionne récursivement deux objets de configuration.
     * @param {object} baseConfig - Configuration de base.
     * @param {object} userConfig - Configuration utilisateur à fusionner.
     * @returns {object} L'objet de configuration fusionné.
     * @private
     */
    _mergeConfigs(baseConfig, userConfig) {
        const merged = { ...baseConfig };
        for (const key in userConfig) {
            if (Object.prototype.hasOwnProperty.call(userConfig, key)) {
                const userValue = userConfig[key];
                const baseValue = baseConfig[key];

                if (userValue === null || userValue === undefined) continue; // Ignorer null/undefined

                // Fusionner les objets récursivement, mais pas les tableaux (remplacer les tableaux)
                if (typeof userValue === 'object' && !Array.isArray(userValue) &&
                    typeof baseValue === 'object' && !Array.isArray(baseValue)) {
                    merged[key] = this._mergeConfigs(baseValue, userValue);
                } else {
                    // Remplacer les valeurs primitives ou les tableaux
                    merged[key] = userValue;
                }
            }
        }
        return merged;
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou le plugin Edit requis n'est pas valide/trouvé.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('HighlightPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Highlight...');

        // 1. Obtenir les dépendances (Edit est requis, ContextMenu est optionnel)
        try {
            this.editPlugin = this.table.getPlugin('Edit');
        } catch (error) {
            this.logger.error("Le plugin 'Edit' est requis par HighlightPlugin mais n'a pas pu être récupéré.", error);
            throw new Error("Le plugin 'Edit' est requis par HighlightPlugin.");
        }
        // Vérifier si Edit expose les hooks nécessaires
        if (typeof this.editPlugin.addHook !== 'function' || typeof this.editPlugin.removeHook !== 'function') {
             throw new Error("L'instance du plugin 'Edit' ne supporte pas les hooks requis par HighlightPlugin.");
        }
        this.debug("Plugin 'Edit' trouvé et compatible.");

        // Essayer d'obtenir ContextMenu
        try {
            this.contextMenuPlugin = this.table.getPlugin('ContextMenu');
            if (this.contextMenuPlugin && this.config.menuEnabled) {
                // Enregistrer comme fournisseur si trouvé et activé dans la config
                 if (typeof this.contextMenuPlugin.registerProvider === 'function') {
                    this.contextMenuPlugin.registerProvider(this);
                    this.debug("Enregistré comme fournisseur auprès de ContextMenuPlugin.");
                 } else {
                     this.logger.warn("ContextMenuPlugin trouvé mais n'expose pas registerProvider(). Menu contextuel Highlight désactivé.");
                     this.config.menuEnabled = false;
                 }
            } else if (this.config.menuEnabled) {
                 this.debug("ContextMenuPlugin non trouvé ou désactivé dans la config, menu contextuel Highlight désactivé.");
                 this.config.menuEnabled = false;
            }
        } catch (error) {
             // ContextMenu non trouvé (getPlugin a levé une erreur)
             if (this.config.menuEnabled) {
                 this.debug("ContextMenuPlugin non trouvé, menu contextuel Highlight désactivé.");
                 this.config.menuEnabled = false;
             }
        }

        // 2. S'enregistrer aux hooks du plugin Edit
        this.registerWithEditPlugin();

        // 3. Injecter les styles CSS (une seule fois par page)
        this.injectStyles();

        // 4. Appliquer le surlignage initial aux cellules existantes
        if (this.config.highlightEnabled) {
            this.highlightAllCells();
        }

        this.debug('Plugin Highlight initialisé.');
    }

    /** S'enregistre aux hooks nécessaires du plugin Edit. */
    registerWithEditPlugin() {
        if (!this.editPlugin) return;
        this.debug("Enregistrement aux hooks du plugin Edit ('onRender', 'afterEdit').");

        // Hook pour personnaliser le rendu de la cellule (affichage normal)
        this.editPlugin.addHook('onRender', this.handleRender, 'Highlight');

        // Hook après la création de l'input pour gérer l'édition surlignée
        if (this.config.highlightDuringEdit) {
            this.editPlugin.addHook('afterEdit', this.setupHighlightedEditing, 'Highlight');
        }
    }

    /**
     * Hook appelé par EditPlugin lors du rendu du contenu d'une cellule.
     * Applique le surlignage et met à jour le contenu du wrapper.
     * @param {HTMLTableCellElement} cell - La cellule en cours de rendu.
     * @param {string} value - La valeur textuelle à rendre.
     * @returns {boolean} `false` pour indiquer à EditPlugin que le rendu a été géré ici.
     */
    handleRender(cell, value) {
        // Ne rien faire si le surlignage est désactivé ou si la cellule n'est pas gérée par Edit
        if (!this.config.highlightEnabled || !this.editPlugin || !cell.classList.contains(this.editPlugin.config.cellClass)) {
            return true; // Laisser EditPlugin gérer le rendu par défaut
        }

        // Utiliser le cache pour les performances
        const cacheKey = `${cell.id}:${value}`; // Clé de cache simple
        let highlightedHtml;

        if (this.cache.highlightedTexts.has(cacheKey)) {
            highlightedHtml = this.cache.highlightedTexts.get(cacheKey);
            this.debug(`Utilisation du cache pour le rendu de ${cell.id}`);
        } else {
            // Appliquer le surlignage
            highlightedHtml = this.highlightText(value);
            // Mettre en cache le résultat
            this.cache.highlightedTexts.set(cacheKey, highlightedHtml);
            // Limiter la taille du cache (exemple simple: vider si trop grand)
            if (this.cache.highlightedTexts.size > 500) { // Seuil arbitraire
                 this.cache.highlightedTexts.clear();
                 this.debug("Cache de surlignage vidé (taille limite atteinte).");
            }
        }

        // Mettre à jour le contenu du wrapper de la cellule
        const wrapperClass = this.table.config?.wrapCellClass || 'cell-wrapper';
        const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;

        // Utiliser le sanitizer pour insérer le HTML surligné
        if (this.table?.sanitizer) {
            // Considérer le HTML généré par highlightText comme sûr (car basé sur du texte et nos spans)
            // mais utiliser setHTML pour une insertion propre.
            this.table.sanitizer.setHTML(wrapper, highlightedHtml);
        } else {
            wrapper.innerHTML = highlightedHtml; // Fallback
        }

        // Indiquer à EditPlugin que nous avons géré le rendu
        return false;
    }

    /**
     * Hook appelé par EditPlugin après la création de l'input d'édition.
     * Met en place la structure pour l'édition avec surlignage visible.
     * @param {HTMLTableCellElement} cell - La cellule en cours d'édition.
     * @param {HTMLInputElement} input - L'élément input créé par EditPlugin.
     * @param {string} currentValue - La valeur initiale dans l'input.
     */
    setupHighlightedEditing(cell, input, currentValue) {
        // Si highlightDuringEdit est désactivé, ne rien faire
        if (!this.config.highlightDuringEdit) {
            return; // Laisser l'input standard
        }
        this.debug(`Configuration de l'édition surlignée pour ${cell.id}`);

        // Créer le conteneur principal pour l'overlay et l'input
        const container = document.createElement('div');
        container.className = 'tf-highlight-edit-container'; // Classe pour le style CSS

        // Créer la couche de superposition pour afficher le texte surligné
        const overlay = document.createElement('div');
        overlay.className = 'tf-highlight-edit-overlay'; // Classe pour le style CSS
        overlay.setAttribute('aria-hidden', 'true'); // Cacher aux lecteurs d'écran

        // Cloner l'input original pour le mettre DANS le conteneur
        const inputClone = /** @type {HTMLInputElement} */ (input.cloneNode(true));
        // Appliquer les styles pour le rendre transparent et le positionner sur l'overlay
        inputClone.classList.add('tf-highlight-edit-input'); // Classe pour le style CSS

        // Appliquer le surlignage initial à l'overlay
        overlay.innerHTML = this.highlightText(currentValue); // Utiliser innerHTML car highlightText retourne du HTML

        // Mettre à jour l'overlay en temps réel pendant la saisie
        const updateOverlay = () => {
            overlay.innerHTML = this.highlightText(inputClone.value);
            // Synchroniser la hauteur si l'input est un textarea (non géré ici)
            // Synchroniser le scroll si nécessaire
        };
        inputClone.addEventListener('input', updateOverlay);
        inputClone.addEventListener('scroll', () => { // Synchroniser le scroll
             overlay.scrollTop = inputClone.scrollTop;
             overlay.scrollLeft = inputClone.scrollLeft;
        });

        // Remplacer l'input original (qui est hors du wrapper) par notre conteneur
        const wrapperClass = this.table.config?.wrapCellClass || 'cell-wrapper';
        const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;
        wrapper.innerHTML = ''; // Vider le wrapper
        container.appendChild(overlay); // Ajouter l'overlay d'abord (dessous)
        container.appendChild(inputClone); // Ajouter l'input transparent (dessus)
        wrapper.appendChild(container);

        // Refaire le focus sur le nouvel input
        inputClone.focus();
        // Sélectionner le texte (peut échouer selon le navigateur/timing)
        try { inputClone.select(); } catch (e) { /* Ignorer l'erreur de select */ }

        // Nettoyer l'input original (qui n'est plus dans le DOM)
        this.editPlugin?.removeInputListeners?.(input); // Appeler le nettoyage d'Edit si possible

        // Stocker une référence au listener pour le nettoyage futur
        inputClone._highlightUpdateListener = updateOverlay;

    }

    /**
     * Récupère la configuration d'un groupe par son ID.
     * @param {string} groupId - L'ID du groupe.
     * @returns {object | undefined} L'objet de configuration du groupe ou undefined.
     */
    getGroupById(groupId) {
        return this.config.groups.find(group => group.id === groupId);
    }

    /**
     * Compile (ou récupère depuis le cache) une expression régulière.
     * @param {string} pattern - Le motif de l'expression régulière.
     * @param {string} [flags='g'] - Les flags (ex: 'gi'). 'g' est ajouté par défaut.
     * @returns {RegExp | null} L'objet RegExp compilé ou null si invalide.
     */
    getCompiledRegex(pattern, flags = '') {
        // Ajouter 'g' par défaut s'il n'y est pas, car on utilise exec() en boucle
        const finalFlags = flags.includes('g') ? flags : flags + 'g';
        const cacheKey = `${pattern}:${finalFlags}`;

        if (this.cache.compiledRegexes.has(cacheKey)) {
            return this.cache.compiledRegexes.get(cacheKey);
        }

        try {
            const regex = new RegExp(pattern, finalFlags);
            this.cache.compiledRegexes.set(cacheKey, regex);
            // Limiter la taille du cache regex
             if (this.cache.compiledRegexes.size > 100) {
                 const firstKey = this.cache.compiledRegexes.keys().next().value;
                 this.cache.compiledRegexes.delete(firstKey);
             }
            return regex;
        } catch (error) {
            this.logger.error(`Expression régulière invalide: pattern='${pattern}', flags='${finalFlags}'`, error);
            return null;
        }
    }

    /**
     * Applique les règles de surlignage à une chaîne de texte.
     * @param {string} text - Le texte brut à surligner.
     * @returns {string} Le texte avec des balises <span> ajoutées pour le surlignage.
     */
    highlightText(text) {
        // Vérifications initiales
        if (!text || typeof text !== 'string' || !this.config.highlightEnabled) {
            return text; // Retourne le texte original si invalide ou surlignage désactivé
        }

        // Éviter la récursion infinie (si highlightText est appelé depuis un endroit inattendu)
        if (this.state.isHighlighting) {
            this.logger.warn("Appel récursif détecté dans highlightText. Retour du texte original.");
            return text;
        }
        this.state.isHighlighting = true;

        try {
            // 1. Préparer les règles d'exclusion globales
            const exclusionRules = this.config.rules.filter(rule => {
                const group = this.getGroupById(rule.group);
                // Règle active, groupe trouvé, et groupe marqué comme exclusion
                return rule.enabled !== false && group && group.isExclusion === true;
            });

            // 2. Collecter toutes les correspondances valides des règles de surlignage
            let matches = [];
            for (const rule of this.config.rules) {
                // Ignorer règles désactivées ou règles d'exclusion ici
                if (rule.enabled === false) continue;
                const group = this.getGroupById(rule.group);
                if (!group || group.isExclusion === true) continue;

                const regex = this.getCompiledRegex(rule.regex, rule.flags); // Utiliser flags si défini
                if (!regex) continue; // Ignorer si regex invalide

                let match;
                // Utiliser regex.exec pour trouver toutes les correspondances
                while ((match = regex.exec(text)) !== null) {
                    const matchText = match[0];
                    const startIndex = match.index;
                    const endIndex = startIndex + matchText.length;

                    // Ignorer les correspondances vides
                    if (startIndex === endIndex) continue;

                    // 3. Vérifier si cette correspondance est exclue
                    let isExcluded = false;
                    // 3a. Vérifier les règles d'exclusion globales
                    for (const exclusionRule of exclusionRules) {
                        const exclusionRegex = this.getCompiledRegex(exclusionRule.regex, exclusionRule.flags);
                        if (exclusionRegex && exclusionRegex.test(matchText)) {
                            // Réinitialiser lastIndex pour le prochain test sur la même regex
                            exclusionRegex.lastIndex = 0;
                            isExcluded = true;
                            break;
                        }
                    }
                    if (isExcluded) continue; // Passer à la correspondance suivante si exclu globalement

                    // 3b. Vérifier les exclusions spécifiques à la règle
                    if (rule.exclusions && Array.isArray(rule.exclusions)) {
                        for (const exclusionPattern of rule.exclusions) {
                            const exclusionRegex = this.getCompiledRegex(exclusionPattern); // Flags par défaut 'g'
                            if (exclusionRegex && exclusionRegex.test(matchText)) {
                                exclusionRegex.lastIndex = 0;
                                isExcluded = true;
                                break;
                            }
                        }
                    }
                    if (isExcluded) continue; // Passer si exclu spécifiquement

                    // 4. Ajouter la correspondance valide
                    matches.push({
                        start: startIndex,
                        end: endIndex,
                        group: group,
                        priority: group.priority ?? 0 // Utiliser 0 si non défini
                    });
                }
                 // Important: Réinitialiser lastIndex pour la prochaine règle si la même regex est réutilisée
                 if (regex.global) regex.lastIndex = 0;
            }

            // Si aucune correspondance trouvée, retourner le texte original
            if (matches.length === 0) {
                return text;
            }

            // 5. Résoudre les chevauchements en fonction de la priorité
            const finalMatches = this.resolveOverlaps(matches);

            // 6. Construire le HTML surligné
            let resultHtml = '';
            let lastIndex = 0;
            // Trier par position de début pour construire la chaîne
            finalMatches.sort((a, b) => a.start - b.start);

            for (const match of finalMatches) {
                // Ajouter le texte non surligné avant ce match
                if (match.start > lastIndex) {
                    resultHtml += this.escapeHtml(text.substring(lastIndex, match.start));
                }
                // Ajouter le texte surligné
                const matchText = text.substring(match.start, match.end);
                const group = match.group;
                const style = `background-color: ${group.backgroundColor || 'transparent'}; color: ${group.color || 'inherit'};`;
                resultHtml += `<span class="${this.config.spanClass}" style="${style}" data-group="${group.id}">`
                           + this.escapeHtml(matchText)
                           + '</span>';
                lastIndex = match.end;
            }

            // Ajouter le reste du texte non surligné après le dernier match
            if (lastIndex < text.length) {
                resultHtml += this.escapeHtml(text.substring(lastIndex));
            }

            return resultHtml;

        } catch (error) {
             this.logger.error("Erreur inattendue dans highlightText:", error);
             return text; // Retourner le texte original en cas d'erreur
        } finally {
            this.state.isHighlighting = false; // Assurer la réinitialisation du flag
        }
    }

    /**
     * Échappe les caractères HTML spéciaux dans une chaîne.
     * @param {string} text - Le texte à échapper.
     * @returns {string} Le texte échappé.
     */
    escapeHtml(text) {
        // Utiliser le sanitizer global si disponible
        if (this.table?.sanitizer && typeof this.table.sanitizer.escapeHTML === 'function') {
             return this.table.sanitizer.escapeHTML(text);
        }
        // Fallback simple
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Résout les chevauchements entre les correspondances trouvées.
     * Si plusieurs règles matchent le même segment de texte, seule celle
     * du groupe avec la plus haute priorité (valeur la plus basse) est conservée.
     * @param {Array<object>} matches - Tableau des correspondances [{ start, end, group, priority }].
     * @returns {Array<object>} Tableau des correspondances sans chevauchement, priorisées.
     */
    resolveOverlaps(matches) {
        if (matches.length <= 1) {
            return matches; // Pas de chevauchement possible
        }

        // Créer une structure pour marquer les segments de texte couverts et par quelle priorité
        // Utiliser un tableau où l'index représente la position dans la chaîne originale
        let maxEnd = 0;
        matches.forEach(m => maxEnd = Math.max(maxEnd, m.end));
        const coverage = new Array(maxEnd).fill(null).map(() => ({ covered: false, priority: Infinity, match: null }));

        // Trier les matches par priorité (plus basse = plus haute), puis par longueur (plus long d'abord)
        matches.sort((a, b) => {
            const priorityDiff = a.priority - b.priority;
            if (priorityDiff !== 0) return priorityDiff;
            return (b.end - b.start) - (a.end - a.start); // Le plus long en premier à priorité égale
        });

        const finalMatches = [];
        for (const match of matches) {
            let canAdd = true;
            // Vérifier si une partie de ce match est déjà couverte par une priorité plus haute
            for (let i = match.start; i < match.end; i++) {
                if (coverage[i].covered && coverage[i].priority < match.priority) {
                    canAdd = false;
                    break;
                }
            }

            if (canAdd) {
                // Ce match est valide (ou a une priorité égale/supérieure aux chevauchements)
                finalMatches.push(match);
                // Marquer les segments comme couverts par ce match
                for (let i = match.start; i < match.end; i++) {
                    // Ne mettre à jour que si ce match a une priorité strictement supérieure
                    // ou si le segment n'était pas couvert
                    if (!coverage[i].covered || match.priority < coverage[i].priority) {
                        coverage[i] = { covered: true, priority: match.priority, match: match };
                    }
                }
            }
        }

         // Optionnel : On pourrait vouloir re-filtrer finalMatches pour ne garder que les segments
         // qui n'ont pas été écrasés par un match ultérieur de priorité égale mais plus court.
         // Cependant, la construction HTML gère cela en traitant les matches par ordre de début.

        return finalMatches;
    }

    /** Applique le surlignage à toutes les cellules éditables visibles. */
    highlightAllCells() {
        if (!this.table?.element || !this.config.highlightEnabled || !this.editPlugin) {
            this.debug("Surlignage global ignoré (désactivé, table ou EditPlugin manquant).");
            return;
        }
        this.debug("Application du surlignage à toutes les cellules éditables...");

        const editCells = this.table.element.querySelectorAll(`td.${this.editPlugin.config.cellClass}`);
        let count = 0;
        editCells.forEach(cell => {
            // Ne pas modifier les cellules en cours d'édition via l'overlay
            if (cell.querySelector('.tf-highlight-edit-container')) {
                return;
            }
            // Récupérer la valeur sémantique
            const value = cell.getAttribute('data-value') ?? cell.textContent?.trim() ?? '';
            if (value) {
                // Appeler le hook onRender (qui utilise highlightText)
                this.executeHook('onRender', cell, value);
                count++;
            }
        });
        this.debug(`${count} cellule(s) surlignée(s).`);
    }

    /** Charge les groupes et règles depuis localStorage. */
    loadRules() {
        if (!this.config.storageKey || typeof localStorage === 'undefined') return;
        this.debug(`Chargement de la configuration depuis localStorage (clé: ${this.config.storageKey})...`);
        try {
            const savedData = localStorage.getItem(this.config.storageKey);
            if (savedData) {
                const data = JSON.parse(savedData);
                // Valider et charger les groupes et règles
                if (data.groups && Array.isArray(data.groups)) {
                    // Valider la structure de chaque groupe? Pour l'instant, on fait confiance.
                    this.config.groups = data.groups;
                    this.debug(`${this.config.groups.length} groupe(s) chargé(s).`);
                }
                if (data.rules && Array.isArray(data.rules)) {
                    // Valider la structure de chaque règle?
                    this.config.rules = data.rules;
                     this.debug(`${this.config.rules.length} règle(s) chargée(s).`);
                }
                // Invalider les caches après chargement
                this.clearCache();
            } else {
                 this.debug("Aucune configuration trouvée dans localStorage.");
            }
        } catch (error) {
            this.logger.error(`Erreur lors du chargement de la configuration Highlight depuis localStorage: ${error.message}`, error);
            // Optionnel: Supprimer la clé invalide?
            // localStorage.removeItem(this.config.storageKey);
        }
    }

    /** Sauvegarde les groupes et règles actuels dans localStorage. */
    saveRules() {
        if (!this.config.storageKey || typeof localStorage === 'undefined') return;
        this.debug(`Sauvegarde de la configuration dans localStorage (clé: ${this.config.storageKey})...`);
        try {
            const dataToSave = {
                groups: this.config.groups, // Sauvegarder aussi les groupes (si modifiables?)
                rules: this.config.rules,
                timestamp: Date.now() // Ajouter un timestamp
            };
            localStorage.setItem(this.config.storageKey, JSON.stringify(dataToSave));
            this.debug('Configuration Highlight sauvegardée.');
        } catch (error) {
            this.logger.error(`Erreur lors de la sauvegarde de la configuration Highlight dans localStorage: ${error.message}`, error);
            // Gérer l'erreur (ex: quota dépassé)
            this.table?.notify('error', 'Erreur lors de la sauvegarde des règles de surlignage.');
        }
    }

    /**
     * Ajoute une nouvelle règle de surlignage.
     * @param {object} rule - L'objet règle { group, regex, exclusions?, enabled?, description? }.
     * @returns {Promise<object|null> | object | null} La règle ajoutée (avec ID généré si absent), ou null si invalide/échoué. Retourne une promesse si useAjax=true.
     */
    addRule(rule) {
        if (!this.config.ruleCreation.enabled) {
            this.debug('Ajout de règle désactivé par la configuration.');
            return null;
        }
        // Validation minimale de la règle
        if (!rule || typeof rule !== 'object' || !rule.group || !rule.regex) {
            this.logger.error("Tentative d'ajout d'une règle invalide (manque group ou regex).", rule);
            return null;
        }
        // Vérifier que le groupe existe
        if (!this.getGroupById(rule.group)) {
            this.logger.error(`Groupe '${rule.group}' non trouvé pour la nouvelle règle.`);
            return null;
        }
         // Vérifier la validité de la regex
         if (this.getCompiledRegex(rule.regex, rule.flags) === null) {
             this.logger.error(`Regex invalide fournie pour la nouvelle règle: ${rule.regex}`);
             // Optionnel: Notifier l'utilisateur
             this.table?.notify('error', `L'expression régulière fournie est invalide: ${rule.regex}`);
             return null;
         }


        // Préparer la règle complète
        const newRule = {
            id: rule.id || `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, // Générer ID unique
            group: rule.group,
            regex: rule.regex,
            flags: rule.flags || '', // Stocker les flags
            exclusions: Array.isArray(rule.exclusions) ? rule.exclusions : [],
            enabled: rule.enabled !== false, // Actif par défaut
            description: rule.description || '' // Description optionnelle
        };
        this.debug("Ajout de la règle:", newRule);

        // Si AJAX est activé, envoyer au serveur d'abord
        if (this.config.ruleCreation.useAjax) {
            return this.sendRuleToServer(newRule); // Retourne une promesse
        } else {
            // Ajouter localement
            this.config.rules.push(newRule);
            this.saveRules(); // Persister
            this.clearCache(); // Invalider le cache
            this.highlightAllCells(); // Réappliquer le surlignage
            this.debug("Règle ajoutée localement.");
            return newRule; // Retourner la règle ajoutée
        }
    }

    /**
     * Envoie une nouvelle règle au serveur via AJAX.
     * @param {object} rule - La règle à envoyer.
     * @returns {Promise<object|null>} Promesse résolue avec la règle ajoutée (potentiellement modifiée par le serveur) ou null en cas d'erreur.
     * @private
     */
    async sendRuleToServer(rule) {
        const { ajaxUrl, ajaxMethod, ajaxHeaders, ajaxCallback } = this.config.ruleCreation;
        this.debug(`Envoi de la règle au serveur: ${ajaxMethod} ${ajaxUrl}`, rule);

        try {
            const response = await fetch(ajaxUrl, {
                method: ajaxMethod,
                headers: {
                    'Content-Type': 'application/json',
                    ...ajaxHeaders
                },
                body: JSON.stringify(rule)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Erreur serveur (${response.status}): ${errorText || response.statusText}`);
            }

            const serverResponse = await response.json();
            this.debug("Réponse du serveur reçue:", serverResponse);

            // Supposer que le serveur retourne la règle ajoutée (peut-être avec un ID serveur)
            const addedRule = { ...rule, ...(serverResponse.rule || serverResponse) }; // Fusionner avec la réponse

            // Ajouter localement APRÈS succès serveur
            this.config.rules.push(addedRule);
            this.saveRules();
            this.clearCache();
            this.highlightAllCells();

            // Appeler le callback AJAX si défini
            if (typeof ajaxCallback === 'function') {
                ajaxCallback(addedRule, serverResponse);
            }

            this.table?.notify('success', 'Règle ajoutée et synchronisée avec le serveur.');
            return addedRule;

        } catch (error) {
            this.logger.error(`Échec de l'envoi de la règle au serveur: ${error.message}`, error);
            this.table?.notify('error', `Impossible d'ajouter la règle sur le serveur: ${error.message}`);
            return null; // Échec de l'ajout
        }
    }


    /**
     * Met à jour une règle existante par son ID.
     * @param {string} ruleId - L'ID de la règle à mettre à jour.
     * @param {object} updates - Objet contenant les propriétés à mettre à jour.
     * @returns {boolean} True si la mise à jour a réussi, false sinon.
     */
    updateRule(ruleId, updates) {
        const ruleIndex = this.config.rules.findIndex(r => r.id === ruleId);
        if (ruleIndex === -1) {
            this.logger.warn(`Impossible de mettre à jour: règle avec ID '${ruleId}' non trouvée.`);
            return false;
        }

        // Valider les mises à jour (ex: regex valide, groupe existant)
        if (updates.regex && this.getCompiledRegex(updates.regex, updates.flags ?? this.config.rules[ruleIndex].flags) === null) {
             this.logger.error(`Regex invalide fournie pour la mise à jour de la règle ${ruleId}: ${updates.regex}`);
             this.table?.notify('error', `L'expression régulière fournie est invalide: ${updates.regex}`);
             return false;
        }
         if (updates.group && !this.getGroupById(updates.group)) {
             this.logger.error(`Groupe '${updates.group}' non trouvé pour la mise à jour de la règle ${ruleId}.`);
             return false;
         }


        // Appliquer les mises à jour
        this.config.rules[ruleIndex] = {
            ...this.config.rules[ruleIndex], // Garder les anciennes valeurs
            ...updates // Appliquer les nouvelles
        };
        this.debug(`Règle ${ruleId} mise à jour:`, this.config.rules[ruleIndex]);

        // TODO: Gérer la mise à jour AJAX si useAjax=true (nécessite un endpoint PUT/PATCH)

        this.saveRules();
        this.clearCache();
        this.highlightAllCells();
        return true;
    }

    /**
     * Supprime une règle par son ID.
     * @param {string} ruleId - L'ID de la règle à supprimer.
     * @returns {boolean} True si la suppression a réussi, false sinon.
     */
    deleteRule(ruleId) {
        const initialLength = this.config.rules.length;
        this.config.rules = this.config.rules.filter(r => r.id !== ruleId);

        if (this.config.rules.length < initialLength) {
            this.debug(`Règle ${ruleId} supprimée.`);
            // TODO: Gérer la suppression AJAX si useAjax=true (nécessite un endpoint DELETE)
            this.saveRules();
            this.clearCache();
            this.highlightAllCells();
            return true;
        } else {
            this.logger.warn(`Impossible de supprimer: règle avec ID '${ruleId}' non trouvée.`);
            return false;
        }
    }

    /** Efface les caches internes (texte surligné, regex compilées). */
    clearCache() {
        this.cache.highlightedTexts.clear();
        this.cache.compiledRegexes.clear();
        this.debug("Caches Highlight effacés.");
    }

    /**
     * Active ou désactive globalement le surlignage.
     * @param {boolean} [enabled] - Nouvel état. Si omis, bascule l'état actuel.
     * @returns {boolean} Le nouvel état d'activation.
     */
    toggleHighlighting(enabled) {
        const newState = enabled !== undefined ? enabled : !this.config.highlightEnabled;
        if (newState === this.config.highlightEnabled) return newState; // Pas de changement

        this.config.highlightEnabled = newState;
        this.debug(`Surlignage ${newState ? 'activé' : 'désactivé'}.`);

        if (newState) {
            // Si activé, réappliquer le surlignage
            this.highlightAllCells();
        } else {
            // Si désactivé, restaurer le texte original
            this.clearCache(); // Effacer le cache pour forcer le rendu normal
            const editCells = this.table?.element?.querySelectorAll(`td.${this.editPlugin?.config?.cellClass || 'td-edit'}`);
            editCells?.forEach(cell => {
                // Appeler onRender pour restaurer (qui retournera true car highlightEnabled=false)
                const value = cell.getAttribute('data-value') ?? cell.textContent?.trim() ?? '';
                 if (this.editPlugin && typeof this.editPlugin.executeHook === 'function') {
                     const renderHookResult = this.editPlugin.executeHook('onRender', cell, value);
                     // Si onRender n'a pas été géré par un autre hook, forcer le textContent
                     if (renderHookResult !== false) {
                          const wrapperClass = this.table.config?.wrapCellClass || 'cell-wrapper';
                          const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;
                          if (this.table?.sanitizer) {
                              this.table.sanitizer.setTextContent(wrapper, value);
                          } else {
                              wrapper.textContent = value;
                          }
                     }
                 } else {
                      // Fallback si EditPlugin ou hooks non dispo
                      const wrapperClass = this.table.config?.wrapCellClass || 'cell-wrapper';
                      const wrapper = cell.querySelector(`.${wrapperClass}`) || cell;
                      wrapper.textContent = value;
                 }
            });
        }
        return newState;
    }

    /** Injecte les styles CSS nécessaires (une seule fois). */
    injectStyles() {
        const styleId = 'tableflow-highlight-styles';
        if (document.getElementById(styleId)) return;

        const style = document.createElement('style');
        style.id = styleId;
        // Styles de base pour les spans et l'édition surlignée
        // Utilise les classes configurées et les variables CSS globales
        style.textContent = `
            /* Span de surlignage */
            .${this.config.spanClass} {
                border-radius: 3px;
                padding: 0.1em 0;
                box-decoration-break: clone;
                -webkit-box-decoration-break: clone;
            }
            /* Conteneur pour l'édition surlignée */
            .tf-highlight-edit-container {
                position: relative;
                width: 100%;
                min-height: calc(1.5em + 2 * var(--tf-input-padding, 4px)); /* Hauteur basée sur input */
                padding: var(--tf-input-padding, 4px 6px); /* Simuler padding input */
                box-sizing: border-box;
                cursor: text;
            }
            /* Input réel transparent */
            .tf-highlight-edit-input {
                position: absolute; top: 0; left: 0;
                width: 100%; height: 100%;
                background: transparent !important;
                color: transparent !important;
                caret-color: var(--tf-highlight-edit-caret-color, black) !important;
                border: none !important; outline: none !important;
                padding: var(--tf-input-padding, 4px 6px) !important;
                margin: 0 !important;
                font: inherit !important; line-height: inherit !important;
                box-sizing: border-box !important;
                z-index: 1;
                white-space: pre-wrap; resize: none;
            }
            /* Overlay avec texte surligné */
            .tf-highlight-edit-overlay {
                position: absolute; top: 0; left: 0; right: 0; bottom: 0;
                pointer-events: none;
                white-space: pre-wrap; word-break: break-word;
                overflow: hidden;
                padding: var(--tf-input-padding, 4px 6px);
                box-sizing: border-box;
                font: inherit; line-height: inherit;
                color: var(--tf-text-muted-color, #666);
                z-index: 0;
            }
            /* Styles Modale (si non définis globalement dans tableFlow.css) */
            /* ... (Copier les styles de la modale depuis la doc ou tableFlow.css si nécessaire) ... */
        `;
        document.head.appendChild(style);
        this.debug("Styles CSS pour Highlight injectés.");
    }

    // -------------------------------------------------------------------------
    // Implémentation Interface Fournisseur pour ContextMenuPlugin
    // -------------------------------------------------------------------------

    /**
     * Retourne les items de menu pour le ContextMenuPlugin.
     * @param {HTMLTableCellElement} cell - La cellule ciblée.
     * @returns {Array<object>} Tableau d'items de menu.
     */
    getMenuItems(cell) {
        if (!this.config.menuEnabled) return []; // Ne rien ajouter si désactivé

        // Vérifier si la cellule est éditable (gérée par EditPlugin)
        if (!this.editPlugin || !cell.classList.contains(this.editPlugin.config.cellClass)) {
            return []; // Ne s'applique qu'aux cellules éditables
        }

        const items = [];
        // Ajouter l'en-tête de section
        if (this.config.menuSection) {
            items.push({ type: 'header', label: this.config.menuSection });
        }

        // Option Activer/Désactiver
        items.push({
            id: 'toggleHighlighting',
            label: this.config.highlightEnabled ? 'Désactiver Surlignage' : 'Activer Surlignage',
            icon: this.config.highlightEnabled ? '🎨' : '⚪' // Ou utiliser des classes FontAwesome
        });

        // Options pour ajouter une règle depuis la sélection
        if (this.config.ruleCreation.enabled && typeof window.getSelection === 'function') {
            const selection = window.getSelection();
            const selectedText = selection?.toString().trim();

            if (selectedText) { // Si du texte est sélectionné DANS LA PAGE (pas forcément la cellule)
                 // Vérifier si la sélection provient bien de la cellule cible? Difficile.
                 // On propose l'option si une sélection existe.
                 items.push({ type: 'separator' });
                 items.push({ type: 'header', label: `Ajouter règle pour "${selectedText.substring(0, 20)}..."` });

                 // Ajouter une option pour chaque groupe non-exclusion
                 this.config.groups.filter(g => !g.isExclusion).forEach(group => {
                     items.push({
                         id: `addRuleToGroup:${group.id}:${selectedText}`, // Passer le texte dans l'ID
                         label: `Surligner en ${group.name}`,
                         icon: '🖍️' // Ou une icône plus spécifique
                     });
                 });
                 // Option pour ajouter aux exclusions
                 const ignoredGroup = this.config.groups.find(g => g.isExclusion);
                 if (ignoredGroup) {
                     items.push({
                         id: `addRuleToGroup:${ignoredGroup.id}:${selectedText}`,
                         label: `Ne jamais surligner ce texte`,
                         icon: '🚫'
                     });
                 }
            }
        }

        // Option pour gérer les règles
        items.push({ type: 'separator' });
        items.push({
            id: 'manageRules',
            label: 'Gérer les règles...',
            icon: '⚙️'
        });

        return items;
    }

    /**
     * Exécute une action demandée depuis le menu contextuel.
     * @param {string} actionId - L'ID de l'action (ex: 'toggleHighlighting', 'addRuleToGroup:ID:TEXT').
     * @param {HTMLTableCellElement} cell - La cellule ciblée lors de l'ouverture du menu.
     */
    executeAction(actionId, cell) {
        this.debug(`Exécution de l'action ContextMenu: ${actionId}`);

        if (actionId === 'toggleHighlighting') {
            this.toggleHighlighting();
            return;
        }

        if (actionId === 'manageRules') {
            this.showRulesManager(); // Ouvre la modale de gestion
            return;
        }

        // Gérer l'ajout de règle depuis la sélection
        if (actionId.startsWith('addRuleToGroup:')) {
            const parts = actionId.split(':');
            if (parts.length >= 3) {
                 const groupId = parts[1];
                 // Rejoindre le reste au cas où le texte contenait ':'
                 const selectedText = parts.slice(2).join(':');
                 this.createRuleFromSelection(selectedText, groupId);
            } else {
                 this.logger.warn(`Format d'action invalide pour addRuleToGroup: ${actionId}`);
            }
            return;
        }

        this.logger.warn(`Action ContextMenu non reconnue: ${actionId}`);
    }

    /**
     * Crée une nouvelle règle basée sur un texte sélectionné et un groupe choisi.
     * @param {string} selectedText - Le texte sélectionné.
     * @param {string} groupId - L'ID du groupe cible.
     */
    createRuleFromSelection(selectedText, groupId) {
        if (!selectedText || !groupId) return;
        this.debug(`Création d'une règle pour "${selectedText}" dans le groupe ${groupId}`);

        const group = this.getGroupById(groupId);
        if (!group) {
            this.logger.error(`Groupe ${groupId} introuvable pour la création de règle.`);
            this.table?.notify('error', `Groupe ${groupId} introuvable.`);
            return;
        }

        // Échapper les caractères spéciaux pour la regex
        const escapedText = selectedText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Optionnel: Ajouter des limites de mot \b ?
        const regexPattern = `\\b${escapedText}\\b`;

        // Demander confirmation ou options (ex: sensible à la casse?) - Simplifié ici
        const ruleDescription = `Règle créée depuis sélection pour "${selectedText}"`;

        // Créer et ajouter la règle
        const newRule = {
            group: groupId,
            regex: regexPattern,
            description: ruleDescription,
            enabled: true
        };
        const added = this.addRule(newRule); // addRule gère la sauvegarde et le refresh

        if (added) {
            this.table?.notify('success', `Règle ajoutée pour "${selectedText}" dans le groupe ${group.name}.`);
        } else {
             this.table?.notify('error', `Impossible d'ajouter la règle pour "${selectedText}".`);
        }
    }

    // -------------------------------------------------------------------------
    // Interface Utilisateur (Modale de gestion des règles) - Simplifié
    // Le code complet pour la modale est assez long et dépend fortement du HTML/CSS.
    // Les fonctions showRulesManager, renderRulesList, showRuleForm, etc.
    // devraient être implémentées ici si une UI intégrée est souhaitée.
    // Pour l'instant, on met juste un placeholder.
    // -------------------------------------------------------------------------

    /** Affiche la modale de gestion des règles (implémentation à faire). */
    showRulesManager() {
        this.debug("Affichage de la modale de gestion des règles (non implémenté dans cette version).");
        alert("Fonctionnalité 'Gérer les règles' non implémentée dans cet exemple.");
        // Ici, il faudrait créer dynamiquement le HTML de la modale,
        // afficher les groupes et les règles, ajouter les boutons
        // (Ajouter, Modifier, Supprimer, Exporter, Importer),
        // et gérer les interactions utilisateur.
        // Voir le code original pour une implémentation possible.
    }

    // --- Méthodes pour l'export/import (simplifié) ---

    /** Exporte la configuration (groupes et règles) en JSON. */
    exportRules() {
        if (!this.config.ui.allowExport) return;
        this.debug("Exportation des règles...");
        try {
            const dataToExport = {
                groups: this.config.groups,
                rules: this.config.rules,
                version: this.version, // Ajouter la version du plugin
                exportDate: new Date().toISOString()
            };
            const dataStr = JSON.stringify(dataToExport, null, 2); // Indenté pour lisibilité
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tableflow-highlight-config-${this.table?.tableId || 'export'}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            this.table?.notify('success', 'Configuration exportée avec succès.');
        } catch (error) {
            this.logger.error("Erreur lors de l'exportation des règles:", error);
            this.table?.notify('error', `Erreur lors de l'exportation: ${error.message}`);
        }
    }

    /** Importe une configuration (groupes et règles) depuis un fichier JSON. */
    importRules(callback) {
        if (!this.config.ui.allowImport) return;
        this.debug("Importation des règles...");

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';

        input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(/** @type {string} */ (event.target?.result));
                    // Validation basique du fichier importé
                    if (!data || !Array.isArray(data.groups) || !Array.isArray(data.rules)) {
                        throw new Error("Format de fichier invalide. 'groups' et 'rules' (tableaux) attendus.");
                    }
                    // TODO: Ajouter une validation plus poussée de la structure des groupes/règles

                    this.debug(`Importation de ${data.groups.length} groupes et ${data.rules.length} règles.`);
                    // Remplacer la configuration actuelle
                    this.config.groups = data.groups;
                    this.config.rules = data.rules;

                    // Mettre à jour et sauvegarder
                    this.saveRules();
                    this.clearCache();
                    this.highlightAllCells();

                    this.table?.notify('success', 'Configuration importée avec succès.');
                    if (typeof callback === 'function') {
                        callback(); // Appeler le callback si fourni (ex: pour rafraîchir l'UI)
                    }
                } catch (error) {
                    this.logger.error("Erreur lors de l'importation des règles:", error);
                    this.table?.notify('error', `Erreur d'importation: ${error.message}`);
                }
            };
            reader.onerror = () => {
                 this.logger.error("Erreur de lecture du fichier pour l'importation.");
                 this.table?.notify('error', 'Erreur lors de la lecture du fichier.');
            };
            reader.readAsText(file);
        };
        input.click(); // Ouvre la boîte de dialogue de sélection de fichier
    }


    // -------------------------------------------------------------------------
    // Cycle de vie
    // -------------------------------------------------------------------------

    /** Rafraîchit l'état du plugin (réapplique le surlignage). */
    refresh() {
        this.debug('Rafraîchissement du plugin Highlight...');
        if (this.config.highlightEnabled) {
            this.clearCache(); // Effacer le cache avant de réappliquer
            this.highlightAllCells();
        }
        this.debug('Rafraîchissement Highlight terminé.');
    }

    /** Nettoie les ressources utilisées par le plugin. */
    destroy() {
        this.debug('Destruction du plugin Highlight...');
        // Se désenregistrer des hooks du plugin Edit
        if (this.editPlugin && typeof this.editPlugin.removeHook === 'function') {
            this.editPlugin.removeHook('onRender', 'Highlight');
            if (this.config.highlightDuringEdit) {
                this.editPlugin.removeHook('afterEdit', 'Highlight');
            }
            this.debug("Désenregistrement des hooks du plugin Edit.");
        }

        // Se désenregistrer du plugin ContextMenu
        if (this.contextMenuPlugin && typeof this.contextMenuPlugin.unregisterProvider === 'function') {
            this.contextMenuPlugin.unregisterProvider(this);
            this.debug("Désenregistrement de ContextMenuPlugin.");
        }

        // Nettoyer les caches
        this.clearCache();

        // Supprimer les styles injectés (optionnel)
        // const style = document.getElementById('tableflow-highlight-styles');
        // if (style) style.remove();

        // Nettoyer les références
        this.table = null;
        this.editPlugin = null;
        this.contextMenuPlugin = null;
        this.providers = []; // Si ce plugin était lui-même un registre

        this.debug('Plugin Highlight détruit.');
    }
}
