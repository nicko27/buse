/**
 * Plugin LineToggle pour TableFlow
 * Permet de changer la classe d'une ligne en fonction de la valeur d'un champ
 */
export default class LineTogglePlugin {
    constructor(config = {}) {
        this.name = 'lineToggle';
        this.version = '1.0.0';
        this.type = 'display';
        this.table = null;
        this.dependencies = [];

        // Configuration par défaut
        this.config = {
            // Attribut pour activer le plugin sur une colonne
            lineToggleAttribute: 'th-linetoggle',

            // Appliquer les classes à l'initialisation
            applyOnInit: true,

            // Appliquer les classes lors des changements
            applyOnChange: true,

            // Mode de debug
            debug: false,

            // Règles de changement de classe par colonne
            // Exemple: { 'columnId': [{ value: '1', addClass: 'highlight', removeClass: 'dim' }] }
            rules: {},

            // Configuration supplémentaire fournie lors de l'initialisation
            ...config
        };

        // Configuration du debug
        this.debug = this.config.debug ?
            (...args) => console.log('[LineTogglePlugin]', ...args) :
            () => { };
    }

    init(tableHandler) {
        if (!tableHandler) {
            throw new Error('TableHandler instance is required');
        }

        this.table = tableHandler;
        this.debug('Initialisation du plugin LineToggle');

        // Initialisation des colonnes avec l'attribut lineToggle
        this.setupLineToggleColumns();

        // Configuration des écouteurs d'événements
        this.setupEventListeners();
    }

    setupLineToggleColumns() {
        if (!this.table?.table) {
            this.debug('Table non trouvée');
            return;
        }

        // Récupérer les en-têtes avec l'attribut lineToggle
        const headerCells = this.table.table.querySelectorAll(`th[${this.config.lineToggleAttribute}]`);
        this.debug(`Trouvé ${headerCells.length} colonne(s) avec l'attribut lineToggle`);

        // Pour chaque colonne avec l'attribut lineToggle
        headerCells.forEach(header => {
            const columnId = header.id;
            const columnIndex = Array.from(header.parentElement.children).indexOf(header);

            // Récupérer les règles configurées pour cette colonne
            const configRules = this.config.rules[columnId] || [];

            // Récupérer les règles définies dans l'attribut (format JSON)
            let attrRules = [];
            try {
                const attrValue = header.getAttribute(this.config.lineToggleAttribute);
                if (attrValue && attrValue !== 'true') {
                    attrRules = JSON.parse(attrValue);
                }
            } catch (error) {
                this.debug(`Erreur dans le parsing des règles pour ${columnId}:`, error);
            }

            // Fusionner les règles de l'attribut et de la configuration
            const rules = [...configRules, ...attrRules];

            if (rules.length === 0) {
                this.debug(`Aucune règle définie pour la colonne ${columnId}`);
                return;
            }

            this.debug(`Colonne ${columnId} configurée avec ${rules.length} règle(s)`, rules);

            // Si on doit appliquer les classes à l'initialisation
            if (this.config.applyOnInit) {
                this.applyRulesToColumn(columnId, columnIndex, rules);
            }
        });
    }

    setupEventListeners() {
        if (!this.table?.table) return;

        // Écouter les changements de cellule
        this.table.table.addEventListener('cell:change', this.handleCellChange.bind(this));

        // Écouter l'ajout de nouvelles lignes
        this.table.table.addEventListener('row:added', this.handleRowAdded.bind(this));
    }

    handleCellChange(event) {
        if (!this.config.applyOnChange) return;

        // Vérifier que l'événement vient de notre table
        if (event.detail?.tableId && event.detail.tableId !== this.table.table.id) {
            return;
        }

        const columnId = event.detail?.columnId;
        if (!columnId) return;

        // Vérifier si la colonne a l'attribut lineToggle
        const header = this.table.table.querySelector(`th#${columnId}[${this.config.lineToggleAttribute}]`);
        if (!header) return;

        const columnIndex = Array.from(header.parentElement.children).indexOf(header);

        // Récupérer les règles configurées pour cette colonne
        const configRules = this.config.rules[columnId] || [];

        // Récupérer les règles définies dans l'attribut (format JSON)
        let attrRules = [];
        try {
            const attrValue = header.getAttribute(this.config.lineToggleAttribute);
            if (attrValue && attrValue !== 'true') {
                attrRules = JSON.parse(attrValue);
            }
        } catch (error) {
            this.debug(`Erreur dans le parsing des règles pour ${columnId}:`, error);
        }

        // Fusionner les règles
        const rules = [...configRules, ...attrRules];

        if (rules.length === 0) return;

        // Récupérer la ligne concernée
        const rowId = event.detail.rowId;
        if (!rowId) return;

        const row = this.table.table.querySelector(`tr[id="${rowId}"]`);
        if (!row) return;

        // Appliquer les règles à cette ligne
        this.applyRulesToRow(row, columnId, columnIndex, rules);
    }

    handleRowAdded(event) {
        if (!this.config.applyOnInit) return;

        const row = event.detail.row;
        if (!row) return;

        // Pour chaque colonne avec l'attribut lineToggle
        const headerCells = this.table.table.querySelectorAll(`th[${this.config.lineToggleAttribute}]`);

        headerCells.forEach(header => {
            const columnId = header.id;
            const columnIndex = Array.from(header.parentElement.children).indexOf(header);

            // Récupérer les règles configurées pour cette colonne
            const configRules = this.config.rules[columnId] || [];

            // Récupérer les règles définies dans l'attribut (format JSON)
            let attrRules = [];
            try {
                const attrValue = header.getAttribute(this.config.lineToggleAttribute);
                if (attrValue && attrValue !== 'true') {
                    attrRules = JSON.parse(attrValue);
                }
            } catch (error) {
                this.debug(`Erreur dans le parsing des règles pour ${columnId}:`, error);
            }

            // Fusionner les règles
            const rules = [...configRules, ...attrRules];

            if (rules.length === 0) return;

            // Appliquer les règles à cette ligne
            this.applyRulesToRow(row, columnId, columnIndex, rules);
        });
    }

    applyRulesToColumn(columnId, columnIndex, rules) {
        const rows = this.table.getAllRows();
        this.debug(`Application des règles à ${rows.length} ligne(s) pour la colonne ${columnId}`);

        rows.forEach(row => {
            this.applyRulesToRow(row, columnId, columnIndex, rules);
        });
    }

    applyRulesToRow(row, columnId, columnIndex, rules) {
        // Récupérer la cellule de la colonne pour cette ligne
        const cell = row.cells[columnIndex];
        if (!cell) return;

        // Récupérer la valeur de la cellule
        const value = cell.getAttribute('data-value') || cell.textContent.trim();

        this.debug(`Vérification des règles pour la ligne ${row.id}, colonne ${columnId}, valeur: ${value}`);

        // Appliquer chaque règle qui correspond à la valeur
        rules.forEach(rule => {
            // Vérifier si la règle s'applique
            if (this.ruleApplies(rule, value)) {
                this.debug(`Règle appliquée:`, rule);

                // Ajouter les classes spécifiées
                if (rule.addClass) {
                    const classesToAdd = Array.isArray(rule.addClass) ? rule.addClass : [rule.addClass];
                    classesToAdd.forEach(cls => {
                        if (cls) row.classList.add(cls);
                    });
                }

                // Retirer les classes spécifiées
                if (rule.removeClass) {
                    const classesToRemove = Array.isArray(rule.removeClass) ? rule.removeClass : [rule.removeClass];
                    classesToRemove.forEach(cls => {
                        if (cls) row.classList.remove(cls);
                    });
                }
            }
        });
    }

    ruleApplies(rule, value) {
        // Si la règle a une valeur simple
        if (rule.value !== undefined) {
            return String(rule.value) === String(value);
        }

        // Si la règle a une liste de valeurs
        if (rule.values && Array.isArray(rule.values)) {
            return rule.values.map(String).includes(String(value));
        }

        // Si la règle a une expression régulière
        if (rule.regex) {
            try {
                const regex = new RegExp(rule.regex);
                return regex.test(value);
            } catch (e) {
                this.debug('Erreur dans l\'expression régulière:', e);
                return false;
            }
        }

        // Si la règle a une fonction (pour les cas avancés)
        if (rule.test && typeof rule.test === 'function') {
            try {
                return rule.test(value);
            } catch (e) {
                this.debug('Erreur dans l\'exécution de la fonction de test:', e);
                return false;
            }
        }

        // Si la règle a une condition
        if (rule.condition) {
            try {
                switch (rule.condition) {
                    case 'equals': return String(value) === String(rule.compareValue);
                    case 'notEquals': return String(value) !== String(rule.compareValue);
                    case 'contains': return String(value).includes(String(rule.compareValue));
                    case 'startsWith': return String(value).startsWith(String(rule.compareValue));
                    case 'endsWith': return String(value).endsWith(String(rule.compareValue));
                    case 'greater': return Number(value) > Number(rule.compareValue);
                    case 'less': return Number(value) < Number(rule.compareValue);
                    case 'greaterOrEqual': return Number(value) >= Number(rule.compareValue);
                    case 'lessOrEqual': return Number(value) <= Number(rule.compareValue);
                    case 'empty': return !value || value.length === 0;
                    case 'notEmpty': return value && value.length > 0;
                    default: return false;
                }
            } catch (e) {
                this.debug('Erreur dans l\'évaluation de la condition:', e);
                return false;
            }
        }

        return false;
    }

    refresh() {
        this.debug('Rafraîchissement du plugin LineToggle');
        if (this.config.applyOnInit) {
            this.setupLineToggleColumns();
        }
    }

    destroy() {
        this.debug('Destruction du plugin LineToggle');
        if (this.table?.table) {
            // Suppression des écouteurs d'événements
            this.table.table.removeEventListener('cell:change', this.handleCellChange);
            this.table.table.removeEventListener('row:added', this.handleRowAdded);
        }
    }
}