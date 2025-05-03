/**
 * Plugin LineToggle pour TableFlow
 * Permet de changer dynamiquement les classes CSS d'une ligne <tr>
 * en fonction de la valeur d'une cellule <td> dans une colonne spécifique.
 * Utile pour mettre en évidence des lignes basées sur des statuts, priorités, etc.
 *
 * @class LineTogglePlugin
 */
export default class LineTogglePlugin {
    /**
     * Crée une instance de LineTogglePlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'lineToggle';
        this.version = '1.0.1'; // Version mise à jour
        this.type = 'display'; // Type de plugin: modifie l'affichage
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (aucunes directes, mais réagit à 'cell:change') */
        this.dependencies = [];

        // Configuration par défaut fusionnée avec celle fournie
        this.config = {
            lineToggleAttribute: 'th-linetoggle', // Attribut HTML sur <th> pour activer/configurer
            applyOnInit: true,          // Appliquer les règles au chargement initial
            applyOnChange: true,         // Appliquer les règles lors d'un 'cell:change'
            debug: false,               // Activer les logs de débogage
            rules: {},                  // Règles définies via JS { columnId: [rule1, rule2...] }
            ...config
        };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[LineToggle ${this.table?.tableId}]`, ...args) ?? console.debug('[LineToggle]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Lier les méthodes pour préserver le contexte 'this' dans les listeners
        this._handleCellChange = this.handleCellChange.bind(this);
        this._handleRowAdded = this.handleRowAdded.bind(this);
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('LineTogglePlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin LineToggle avec la configuration:', this.config);

        // Configurer les colonnes et appliquer les règles initiales si nécessaire
        this.setupLineToggleColumns();

        // Attacher les écouteurs d'événements système
        this.setupEventListeners();

        this.debug('Plugin LineToggle initialisé.');
    }

    /**
     * Identifie les colonnes configurées pour LineToggle et applique les règles initiales si `applyOnInit` est true.
     */
    setupLineToggleColumns() {
        if (!this.table?.element) return;
        this.debug("Recherche et configuration des colonnes LineToggle...");

        const headerCells = this.table.element.querySelectorAll(`thead th[${this.config.lineToggleAttribute}]`);
        this.debug(`Trouvé ${headerCells.length} colonne(s) avec l'attribut [${this.config.lineToggleAttribute}]`);

        headerCells.forEach(header => {
            const columnId = header.id;
            const columnIndex = header.cellIndex;

            if (!columnId) {
                 this.logger.warn(`Colonne LineToggle à l'index ${columnIndex} n'a pas d'ID. Les règles JS pour cette colonne ne fonctionneront pas.`);
                 // Continuer quand même pour les règles HTML potentielles
            }
            if (columnIndex === -1) {
                this.logger.warn(`Impossible de déterminer l'index pour l'en-tête LineToggle:`, header);
                return; // Passer à la suivante
            }

            // Récupérer les règles (fusion de JS et HTML)
            const rules = this.getRulesForColumn(header, columnId);

            if (rules.length === 0) {
                this.debug(`Aucune règle valide trouvée pour la colonne ${columnIndex} (${columnId || 'sans ID'}).`);
                return;
            }

            this.debug(`Colonne ${columnIndex} (${columnId || 'sans ID'}) configurée avec ${rules.length} règle(s).`);

            // Appliquer les règles à toutes les lignes existantes si configuré
            if (this.config.applyOnInit) {
                this.applyRulesToColumn(columnId, columnIndex, rules);
            }
        });
        this.debug("Configuration des colonnes LineToggle terminée.");
    }

    /**
     * Récupère et fusionne les règles définies en JS et dans l'attribut HTML pour une colonne.
     * @param {HTMLTableCellElement} header - L'élément <th> de la colonne.
     * @param {string} columnId - L'ID de la colonne.
     * @returns {Array<object>} Le tableau des règles fusionnées.
     */
    getRulesForColumn(header, columnId) {
        // Règles de la configuration JS (si columnId existe)
        const configRules = columnId ? (this.config.rules[columnId] || []) : [];
        if (!Array.isArray(configRules)) {
             this.logger.warn(`Les règles JS pour la colonne '${columnId}' ne sont pas un tableau. Ignoré.`);
             configRules = [];
        }


        // Règles de l'attribut HTML
        let attrRules = [];
        const attrValue = header.getAttribute(this.config.lineToggleAttribute);
        if (attrValue && attrValue.trim() !== '' && attrValue !== 'true') {
            try {
                const parsedAttr = JSON.parse(attrValue);
                // S'assurer que c'est un tableau
                if (Array.isArray(parsedAttr)) {
                    attrRules = parsedAttr;
                } else {
                     this.logger.warn(`La valeur JSON dans [${this.config.lineToggleAttribute}] pour la colonne ${columnId || header.cellIndex} n'est pas un tableau. Ignoré.`);
                }
            } catch (error) {
                this.logger.error(`Erreur lors du parsing des règles JSON de l'attribut [${this.config.lineToggleAttribute}] pour la colonne ${columnId || header.cellIndex}: ${error.message}. Valeur: "${attrValue}"`);
            }
        }

        // Fusionner les règles (celles de l'attribut peuvent s'ajouter à celles de la config JS)
        const allRules = [...configRules, ...attrRules];
        this.debug(`Règles fusionnées pour colonne ${columnId || header.cellIndex}: ${allRules.length} au total (JS: ${configRules.length}, HTML: ${attrRules.length})`);
        return allRules;
    }


    /**
     * Attache les écouteurs d'événements système de TableFlow.
     */
    setupEventListeners() {
        if (!this.table?.element) return;
        this.debug("Configuration des écouteurs d'événements système pour LineToggle...");

        // Écouter les changements de cellule pour réappliquer les règles si applyOnChange=true
        if (this.config.applyOnChange) {
            this.table.element.addEventListener('cell:change', this._handleCellChange);
            this.debug("Écouteur 'cell:change' ajouté.");
        }

        // Écouter l'ajout de nouvelles lignes pour appliquer les règles si applyOnInit=true
        if (this.config.applyOnInit) {
            this.table.element.addEventListener('row:added', this._handleRowAdded);
             this.debug("Écouteur 'row:added' ajouté.");
        }
    }

    /**
     * Gestionnaire pour l'événement 'cell:change'.
     * Réapplique les règles à la ligne modifiée si la colonne fait partie des colonnes surveillées.
     * @param {CustomEvent} event - L'événement 'cell:change'.
     */
    handleCellChange(event) {
        // Ignorer si applyOnChange est false
        if (!this.config.applyOnChange) return;

        // Vérifier que l'événement vient de notre table (si tableId est fourni)
        if (event.detail?.tableId && event.detail.tableId !== this.table?.tableId) {
            this.debug('Événement cell:change ignoré (autre table):', event.detail.tableId);
            return;
        }

        const columnId = event.detail?.columnId;
        const rowId = event.detail?.rowId;
        const row = event.detail?.row || (rowId ? this.table?.element?.querySelector(`tbody tr#${CSS.escape(rowId)}`) : null);
        const cell = event.detail?.cell || event.target?.closest('td'); // Fallback sur event.target

        if (!columnId || !row || !cell) {
            this.logger.warn("Événement cell:change incomplet reçu, impossible de traiter LineToggle.", event.detail);
            return;
        }
        this.debug(`Gestion de cell:change pour ${cell.id} (colonne ${columnId})`);

        // Trouver l'en-tête correspondant pour vérifier s'il est surveillé
        const header = this.table?.element?.querySelector(`thead th#${CSS.escape(columnId)}`);
        if (!header || !header.hasAttribute(this.config.lineToggleAttribute)) {
            this.debug(`La colonne modifiée '${columnId}' n'est pas surveillée par LineToggle.`);
            return; // La colonne modifiée n'est pas surveillée
        }

        const columnIndex = header.cellIndex;
        if (columnIndex === -1) return; // Ne devrait pas arriver

        // Récupérer les règles pour cette colonne
        const rules = this.getRulesForColumn(header, columnId);
        if (rules.length === 0) return; // Pas de règles à appliquer

        // Appliquer les règles à cette ligne spécifique
        this.debug(`Réapplication des règles à la ligne ${row.id} suite au changement dans la colonne ${columnId}.`);
        this.applyRulesToRow(row, columnId, columnIndex, rules);
    }

    /**
     * Gestionnaire pour l'événement 'row:added'.
     * Applique les règles à la nouvelle ligne pour toutes les colonnes surveillées.
     * @param {CustomEvent} event - L'événement 'row:added'.
     */
    handleRowAdded(event) {
        // Ignorer si applyOnInit est false (car on applique seulement à l'init ou au change)
        if (!this.config.applyOnInit) return;

        const row = event.detail?.row;
        if (!row) {
            this.logger.warn("Événement row:added reçu sans élément de ligne valide.");
            return;
        }
        this.debug(`Gestion de row:added pour la nouvelle ligne ${row.id}. Application des règles LineToggle...`);

        // Parcourir toutes les colonnes configurées avec LineToggle
        const headerCells = this.table?.element?.querySelectorAll(`thead th[${this.config.lineToggleAttribute}]`);
        headerCells?.forEach(header => {
            const columnId = header.id;
            const columnIndex = header.cellIndex;
            if (columnIndex === -1) return;

            const rules = this.getRulesForColumn(header, columnId);
            if (rules.length > 0) {
                this.debug(`Application des règles de la colonne ${columnId || columnIndex} à la nouvelle ligne ${row.id}.`);
                this.applyRulesToRow(row, columnId, columnIndex, rules);
            }
        });
    }

    /**
     * Applique les règles d'une colonne à toutes les lignes du tableau.
     * @param {string} columnId - L'ID de la colonne.
     * @param {number} columnIndex - L'index de la colonne.
     * @param {Array<object>} rules - Les règles à appliquer.
     */
    applyRulesToColumn(columnId, columnIndex, rules) {
        const rows = this.table?.getAllRows() ?? []; // Utilise la méthode de l'instance
        this.debug(`Application des règles à ${rows.length} ligne(s) pour la colonne ${columnId || columnIndex}`);

        rows.forEach(row => {
            this.applyRulesToRow(row, columnId, columnIndex, rules);
        });
    }

    /**
     * Applique un ensemble de règles à une ligne spécifique, basé sur la valeur de la cellule
     * à l'index de colonne donné.
     * @param {HTMLTableRowElement} row - La ligne <tr> à modifier.
     * @param {string} columnId - L'ID de la colonne dont on lit la valeur.
     * @param {number} columnIndex - L'index de la colonne dont on lit la valeur.
     * @param {Array<object>} rules - Les règles à tester et appliquer.
     */
    applyRulesToRow(row, columnId, columnIndex, rules) {
        if (!row || !rules || rules.length === 0) return;

        // Récupérer la cellule correspondante dans la ligne
        const cell = row.cells[columnIndex];
        if (!cell) {
            this.logger.warn(`Cellule non trouvée à l'index ${columnIndex} pour la ligne ${row.id}.`);
            return;
        }

        // Récupérer la valeur de la cellule (priorité à data-value)
        const value = cell.hasAttribute('data-value')
            ? cell.getAttribute('data-value') ?? '' // Utiliser '' si l'attribut est vide
            : cell.textContent?.trim() ?? ''; // Fallback sur textContent

        this.debug(`Vérification des règles pour Ligne:${row.id}, Colonne:${columnId || columnIndex}, Valeur:"${value}"`);

        // Appliquer chaque règle qui correspond à la valeur
        rules.forEach((rule, index) => {
            // Vérifier si la condition de la règle est remplie
            if (this.ruleApplies(rule, value)) {
                this.debug(` -> Règle #${index} appliquée pour Ligne:${row.id}:`, rule);

                // Ajouter les classes spécifiées
                if (rule.addClass) {
                    const classesToAdd = Array.isArray(rule.addClass) ? rule.addClass : [rule.addClass];
                    classesToAdd.forEach(cls => {
                        if (cls && typeof cls === 'string') row.classList.add(cls);
                    });
                }

                // Retirer les classes spécifiées
                if (rule.removeClass) {
                    const classesToRemove = Array.isArray(rule.removeClass) ? rule.removeClass : [rule.removeClass];
                    classesToRemove.forEach(cls => {
                        if (cls && typeof cls === 'string') row.classList.remove(cls);
                    });
                }
            }
        });
    }

    /**
     * Vérifie si une règle spécifique s'applique à une valeur donnée.
     * @param {object} rule - L'objet règle contenant la condition.
     * @param {string} value - La valeur de la cellule à tester.
     * @returns {boolean} True si la règle s'applique, false sinon.
     */
    ruleApplies(rule, value) {
        // Convertir la valeur de la cellule en chaîne pour les comparaisons string
        const stringValue = String(value);

        try {
            // 1. Condition 'value' (égalité stricte après conversion en chaîne)
            if (rule.value !== undefined) {
                return String(rule.value) === stringValue;
            }

            // 2. Condition 'values' (présence dans un tableau)
            if (rule.values && Array.isArray(rule.values)) {
                // Convertir toutes les valeurs du tableau en chaîne pour la comparaison
                return rule.values.map(String).includes(stringValue);
            }

            // 3. Condition 'regex'
            if (rule.regex && typeof rule.regex === 'string') {
                // Utiliser le cache de regex compilées
                const regex = this.getCompiledRegex(rule.regex, rule.flags || ''); // Utilise les flags si fournis
                if (regex) {
                    const result = regex.test(stringValue);
                    regex.lastIndex = 0; // Réinitialiser pour les utilisations futures (flag 'g')
                    return result;
                } else {
                    return false; // Regex invalide
                }
            }

            // 4. Condition 'test' (fonction personnalisée)
            if (rule.test && typeof rule.test === 'function') {
                // Passer la valeur brute (non convertie en chaîne) à la fonction test
                return !!rule.test(value); // Assurer un retour booléen
            }

            // 5. Conditions prédéfinies ('condition' et 'compareValue')
            if (rule.condition && rule.compareValue !== undefined) {
                const compareValue = rule.compareValue;
                const stringCompareValue = String(compareValue);
                const numberValue = Number(value); // Pour comparaisons numériques
                const numberCompareValue = Number(compareValue);

                switch (rule.condition) {
                    case 'equals': return stringValue === stringCompareValue;
                    case 'notEquals': return stringValue !== stringCompareValue;
                    case 'contains': return stringValue.includes(stringCompareValue);
                    case 'startsWith': return stringValue.startsWith(stringCompareValue);
                    case 'endsWith': return stringValue.endsWith(stringCompareValue);
                    // Comparaisons numériques (seulement si les deux sont des nombres valides)
                    case 'greater': return !isNaN(numberValue) && !isNaN(numberCompareValue) && numberValue > numberCompareValue;
                    case 'less': return !isNaN(numberValue) && !isNaN(numberCompareValue) && numberValue < numberCompareValue;
                    case 'greaterOrEqual': return !isNaN(numberValue) && !isNaN(numberCompareValue) && numberValue >= numberCompareValue;
                    case 'lessOrEqual': return !isNaN(numberValue) && !isNaN(numberCompareValue) && numberValue <= numberCompareValue;
                    default:
                         this.logger.warn(`Condition inconnue '${rule.condition}' dans la règle.`);
                         return false;
                }
            }
             // Conditions sans compareValue
             if (rule.condition === 'empty') {
                 return stringValue === '';
             }
             if (rule.condition === 'notEmpty') {
                 return stringValue !== '';
             }


        } catch (error) {
            this.logger.error(`Erreur lors de l'évaluation de la règle: ${error.message}`, { rule, value });
            return false;
        }

        // Si aucune condition valide n'est trouvée dans la règle
        // this.logger.warn("Règle invalide ou sans condition applicable:", rule);
        return false;
    }

     /**
      * Compile (ou récupère depuis le cache) une expression régulière.
      * Partagé avec HighlightPlugin - pourrait être mis dans un utilitaire commun.
      * @param {string} pattern - Le motif de l'expression régulière.
      * @param {string} [flags=''] - Les flags (ex: 'gi').
      * @returns {RegExp | null} L'objet RegExp compilé ou null si invalide.
      * @private
      */
     getCompiledRegex(pattern, flags = '') {
         // Utiliser le cache partagé de l'instance TableFlow si disponible
         const cache = this.table?.regexCache || new Map(); // Fallback sur un cache local simple
         const cacheKey = `${pattern}:${flags}`;

         if (cache.has(cacheKey)) {
             return cache.get(cacheKey);
         }

         try {
             const regex = new RegExp(pattern, flags);
             cache.set(cacheKey, regex);
             // Limiter la taille du cache (si c'est un cache local)
             if (!this.table?.regexCache && cache.size > 100) {
                  const firstKey = cache.keys().next().value;
                  cache.delete(firstKey);
             }
             return regex;
         } catch (error) {
             this.logger.error(`Expression régulière invalide: pattern='${pattern}', flags='${flags}'`, error);
             return null;
         }
     }

    /**
     * Rafraîchit l'état du plugin. Ré-applique les règles si `applyOnInit` est true.
     */
    refresh() {
        this.debug('Rafraîchissement du plugin LineToggle...');
        if (this.config.applyOnInit) {
            // Ré-analyser les colonnes et ré-appliquer les règles à toutes les lignes
            this.setupLineToggleColumns();
        }
        this.debug('Rafraîchissement LineToggle terminé.');
    }

    /**
     * Nettoie les ressources utilisées par le plugin (écouteurs d'événements).
     */
    destroy() {
        this.debug('Destruction du plugin LineToggle...');
        if (this.table?.element) {
            // Supprimer les écouteurs d'événements ajoutés par ce plugin
            if (this._handleCellChange) {
                this.table.element.removeEventListener('cell:change', this._handleCellChange);
                this.debug("Écouteur 'cell:change' retiré.");
            }
            if (this._handleRowAdded) {
                this.table.element.removeEventListener('row:added', this._handleRowAdded);
                this.debug("Écouteur 'row:added' retiré.");
            }
        }
        // Effacer la référence à l'instance
        this.table = null;
        this.debug('Plugin LineToggle détruit.');
    }
}
