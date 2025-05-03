import { DOMSanitizer } from '../src/domSanitizer.js';

/**
 * ActionsPlugin - Gestion des actions pour TableFlow
 * 
 * Ce plugin ajoute des boutons d'action dans les cellules du tableau.
 * 
 * Attributs HTML supportés :
 * - th-actions : Liste des actions à afficher (séparées par des virgules)
 * - th-sql-exclude : Exclut la colonne des données SQL/exports
 * 
 * @version 1.2.0
 */
export default class ActionsPlugin {
    constructor(config = {}) {
        this.name = 'actions';
        this.version = '1.2.0';
        this.type = 'action';
        this.table = null;
        this.dependencies = [];
        
        // Configuration par défaut
        this.config = { 
            ...this.getDefaultConfig(), 
            ...config 
        };
        
        // Fonction de debug conditionnelle
        this.debug = this.config.debug === true ?
            (...args) => console.log('[ActionsPlugin]', ...args) :
            () => { };

        // Système amélioré de gestion des événements déjà traités
        this._processedEvents = new Map();
        this._cleanupInterval = null;
        this._maxProcessedEvents = 100;
        this._cleanupIntervalTime = 60000; // 1 minute

        // Lier les méthodes pour préserver le contexte
        this.handleCellChange = this.handleCellChange.bind(this);
        this.handleRowSaved = this.handleRowSaved.bind(this);
        this.handleRowAdded = this.handleRowAdded.bind(this);
        this.cleanupProcessedEvents = this.cleanupProcessedEvents.bind(this);
    }

    getDefaultConfig() {
        return {
            // Attributs HTML personnalisés
            actionAttribute: 'th-actions',       // Attribut pour définir les actions
            sqlExcludeAttribute: 'th-sql-exclude', // Attribut pour exclure des données SQL
            
            // Classes CSS
            cellClass: 'td-actions',             // Classe pour les cellules d'action
            modifiedClass: 'modified',           // Classe pour les lignes modifiées
            
            // Configuration des actions
            useIcons: true,                      // Utiliser des icônes
            showOnChange: [],                    // Actions à afficher lors des changements
            autoSave: false,                     // Sauvegarde automatique
            
            // Actions disponibles
            actions: {},                         // Configuration des actions
            icons: {},                           // Icônes des actions
            confirmMessages: {},                 // Messages de confirmation
            
            // Debug
            debug: false
        };
    }

    init(tableHandler) {
        this.table = tableHandler;
        this.debug('Initialisation du plugin avec la configuration:', this.config);

        if (!this.table?.table) {
            this.debug('ERREUR: Table non trouvée');
            return;
        }

        this.setupEventListeners();
        
        // Configuration du nettoyage automatique des événements traités
        this.startCleanupInterval();

        const hasActions = this.hasActionColumns();
        this.debug('Colonnes d\'actions détectées:', hasActions);

        if (hasActions) {
            this.setupActionColumns();
        }
    }

    /**
     * Démarre l'intervalle de nettoyage des événements traités
     */
    startCleanupInterval() {
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
        
        this._cleanupInterval = setInterval(
            this.cleanupProcessedEvents, 
            this._cleanupIntervalTime
        );
    }

    /**
     * Nettoie les événements traités pour éviter les fuites mémoire
     */
    cleanupProcessedEvents() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        // Supprimer les événements plus anciens que maxAge
        for (const [eventId, timestamp] of this._processedEvents.entries()) {
            if (now - timestamp > maxAge) {
                this._processedEvents.delete(eventId);
            }
        }
        
        // Si encore trop d'événements, garder seulement les plus récents
        if (this._processedEvents.size > this._maxProcessedEvents) {
            const sortedEvents = Array.from(this._processedEvents.entries())
                .sort((a, b) => b[1] - a[1]) // Trier par timestamp décroissant
                .slice(0, this._maxProcessedEvents);
            
            this._processedEvents.clear();
            for (const [eventId, timestamp] of sortedEvents) {
                this._processedEvents.set(eventId, timestamp);
            }
        }
        
        this.debug(`Événements traités après nettoyage: ${this._processedEvents.size}`);
    }

    hasActionColumns() {
        if (!this.table?.table) return false;
        const actionColumns = this.table.table.querySelectorAll(`thead th[${this.config.actionAttribute}]`);
        const count = actionColumns.length;
        this.debug(`${count} colonne(s) d'actions trouvée(s)`);
        return count > 0;
    }

    setupEventListeners() {
        if (!this.table?.table) {
            this.debug('ERREUR: Impossible d\'attacher les événements - table non trouvée');
            return;
        }

        this.debug('Configuration des écouteurs d\'événements');
        this.table.table.addEventListener('cell:change', this.handleCellChange);
        this.table.table.addEventListener('row:saved', this.handleRowSaved);
        this.table.table.addEventListener('row:added', this.handleRowAdded);
    }

    handleCellChange(event) {
        // Vérifier que l'événement vient de notre table
        if (event.detail && event.detail.tableId && event.detail.tableId !== this.table.table.id) {
            this.debug('Événement ignoré car il vient d\'une autre table:', event.detail.tableId);
            return;
        }

        // Vérifier si cet événement a déjà été traité
        if (event.detail && event.detail.eventId) {
            const eventId = event.detail.eventId;
            
            // Si l'événement a déjà été traité, l'ignorer
            if (this._processedEvents.has(eventId)) {
                this.debug('Événement ignoré car déjà traité:', eventId);
                return;
            }
            
            // Marquer l'événement comme traité avec timestamp
            this._processedEvents.set(eventId, Date.now());
        }

        const row = event.detail.rowId ?
            this.table.table.querySelector(`tr[id="${event.detail.rowId}"]`) :
            event.target?.closest('tr');

        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans handleCellChange');
            return;
        }

        const cell = event.detail.cell || event.target?.closest('td');
        this.debug('Gestion du changement de cellule:', {
            rowId: row.id,
            cellId: cell?.id,
            eventType: event.type,
            eventSource: event.detail ? 'custom' : 'dom',
            tableId: this.table.table.id
        });

        // Vérification de la modification
        const modifiedCells = Array.from(row.cells)
            .filter(cell => {
                if (!cell.hasAttribute('data-initial-value')) {
                    return false;
                }

                const currentValue = cell.getAttribute('data-value');
                const initialValue = cell.getAttribute('data-initial-value');
                const isModified = currentValue !== initialValue;

                if (isModified) {
                    this.debug('Cellule modifiée:', {
                        cellId: cell.id,
                        initialValue,
                        currentValue
                    });
                }

                return isModified;
            });

        const isModified = modifiedCells.length > 0;
        this.debug('État de modification de la ligne:', {
            rowId: row.id,
            isModified,
            modifiedCellCount: modifiedCells.length
        });

        if (isModified) {
            row.classList.add(this.config.modifiedClass);

            if (this.hasActionColumns()) {
                this.updateActionButtons(row, { showOnModified: true });
            }

            // Gestion de l'autoSave
            if (this.config.autoSave) {
                const saveAction = Object.entries(this.config.actions).find(([name]) => name === 'save');
                if (saveAction) {
                    this.debug('Déclenchement de l\'autoSave');
                    this.executeAction('save', cell, {
                        skipConfirm: true,
                        source: 'autoSave'
                    });
                }
            }
        } else {
            row.classList.remove(this.config.modifiedClass);
            if (this.hasActionColumns()) {
                this.updateActionButtons(row, { showOnModified: false });
            }
        }
    }

    setupActionColumns() {
        const headerCells = this.table.table.querySelectorAll(`thead th[${this.config.actionAttribute}]`);
        this.debug(`Configuration de ${headerCells.length} colonne(s) d'actions`);

        headerCells.forEach((cell, index) => {
            if (!cell) {
                this.debug(`ERREUR: Cellule d'en-tête ${index} non trouvée`);
                return;
            }

            const columnIndex = cell.cellIndex;
            if (columnIndex === -1) {
                this.debug(`ERREUR: Index de colonne invalide pour l'en-tête ${index}`);
                return;
            }

            const actionsStr = cell.getAttribute(this.config.actionAttribute);
            if (!actionsStr) {
                this.debug(`ERREUR: Attribut ${this.config.actionAttribute} manquant sur l'en-tête ${index}`);
                return;
            }

            const actions = actionsStr.split(',').map(a => a.trim()).filter(Boolean);
            if (actions.length === 0) {
                this.debug(`ATTENTION: Aucune action définie pour la colonne ${index}`);
                return;
            }

            this.debug(`Colonne ${index + 1}: actions configurées:`, actions);

            const tbody = this.table.table.querySelector('tbody');
            if (!tbody) {
                this.debug('ERREUR: tbody non trouvé');
                return;
            }

            const cells = Array.from(tbody.rows).map(row => row.cells[columnIndex]).filter(Boolean);
            if (cells.length === 0) {
                this.debug(`ATTENTION: Aucune cellule trouvée pour la colonne ${index + 1}`);
                return;
            }

            cells.forEach((cell, cellIndex) => {
                if (!cell) {
                    this.debug(`ERREUR: Cellule ${cellIndex} manquante dans la colonne ${index + 1}`);
                    return;
                }
                this.setupActionCell(cell, actions);
            });
        });
    }

    setupActionCell(cell, actions) {
        if (!cell) {
            this.debug('ERREUR: Cellule non trouvée dans setupActionCell');
            return;
        }

        cell.classList.add(this.config.cellClass);
        const wrapper = cell.querySelector('.cell-wrapper') || cell;
        wrapper.innerHTML = '';

        actions.forEach(actionName => {
            const actionConfig = this.config.actions[actionName];
            if (!actionConfig) {
                this.debug(`ERREUR: Action "${actionName}" non trouvée dans la configuration`);
                return;
            }

            const icon = this.config.icons[actionName] || actionConfig.icon;
            if (!icon) {
                this.debug(`ERREUR: Pas d'icône définie pour l'action "${actionName}"`);
                return;
            }

            // Utiliser DOMSanitizer pour insérer l'icône de manière sécurisée
            DOMSanitizer.insertAdjacentHTML(wrapper, 'beforeend', icon, { 
                isTrustedIcon: true 
            });
            
            const actionElement = wrapper.lastElementChild;

            if (!actionElement) {
                this.debug(`ERREUR: Échec de l'insertion de l'icône pour l'action "${actionName}"`);
                return;
            }

            actionElement.setAttribute('data-action', actionName);
            const computedStyle = window.getComputedStyle(actionElement);
            const originalDisplay = computedStyle.display || 'inline-block';
            actionElement.setAttribute('data-original-display', originalDisplay);

            if (this.shouldShowOnChange(actionName)) {
                actionElement.style.display = 'none';
            }

            actionElement.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.executeAction(actionName, e.target.closest('td'));
            });
        });
    }

    /**
     * Récupère les données d'une ligne avec support pour th-sql-exclude
     * 
     * L'attribut th-sql-exclude permet d'exclure certaines colonnes des données
     * exportées, utile pour les colonnes d'action ou d'affichage uniquement.
     * 
     * @param {HTMLTableRowElement} row - La ligne dont on veut extraire les données
     * @returns {Object} Les données de la ligne, excluant les colonnes marquées
     */
    getRowData(row) {
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans getRowData');
            return {};
        }

        const data = {};
        const excludedColumns = new Set();
        const thead = this.table.table.querySelector('thead');
        if (!thead) {
            this.debug('ERREUR: thead non trouvé');
            return data;
        }

        // Collecte des colonnes exclues (marquées avec th-sql-exclude)
        Array.from(thead.querySelectorAll('th')).forEach(header => {
            if (header.hasAttribute(this.config.sqlExcludeAttribute)) {
                excludedColumns.add(header.id);
                this.debug(`Colonne exclue: ${header.id}`);
            }
        });

        if (row.id) {
            data.id = row.id;
        }

        Array.from(row.cells).forEach((cell, i) => {
            const header = thead.querySelector(`tr:first-child th:nth-child(${i + 1})`);
            if (!header?.id || cell.classList.contains(this.config.cellClass)) {
                return;
            }

            // Ignorer les colonnes exclues
            if (excludedColumns.has(header.id)) {
                this.debug(`Colonne ignorée (exclue): ${header.id}`);
                return;
            }

            let value = cell.getAttribute('data-value');
            if (value === null) {
                const wrapper = cell.querySelector('.cell-wrapper');
                value = wrapper ? wrapper.textContent.trim() : cell.textContent.trim();
            }

            // Conversion des types
            let convertedValue = value;
            if (!isNaN(value) && value !== '') {
                convertedValue = Number(value);
            } else if (value === 'true' || value === 'false') {
                convertedValue = value === 'true';
            }

            data[header.id] = convertedValue;
        });

        return data;
    }

    shouldShowOnChange(actionName) {
        const actionConfig = this.config.actions[actionName] || {};
        const showOnChange = actionConfig.showOnChange === true ||
            (actionConfig.showOnChange !== false &&
                (this.config.showOnChange === true ||
                    (Array.isArray(this.config.showOnChange) &&
                        this.config.showOnChange.includes(actionName))));
        
        return showOnChange;
    }

    shouldAutoSave(actionName) {
        const actionConfig = this.config.actions[actionName] || {};
        const autoSave = actionConfig.autoSave === true ||
            (actionConfig.autoSave !== false && this.config.autoSave === true);
        
        return autoSave;
    }

    executeAction(actionName, cell, options = {}) {
        const row = cell?.closest('tr');
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans executeAction');
            return;
        }

        const actionConfig = this.config.actions[actionName];
        if (!actionConfig) {
            this.debug(`ERREUR: Configuration non trouvée pour l'action "${actionName}"`);
            return;
        }

        if (this.config.confirmMessages[actionName] && !options.skipConfirm) {
            const message = this.config.confirmMessages[actionName];
            if (!confirm(message)) {
                this.debug('Action annulée par l\'utilisateur');
                return;
            }
        }

        const data = this.getRowData(row);
        
        const context = {
            row,
            cell,
            tableHandler: this.table,
            data,
            source: options.source || 'manual'
        };

        try {
            if (typeof actionConfig.handler === 'function') {
                actionConfig.handler(context);
            } else {
                this.debug(`ERREUR: Pas de handler défini pour l'action "${actionName}"`);
            }
        } catch (error) {
            this.debug(`ERREUR lors de l'exécution de l'action "${actionName}":`, error);
            console.error(`Erreur lors de l'exécution de l'action "${actionName}":`, error);
        }
    }

    handleRowSaved(event) {
        const row = event.detail.row;
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans handleRowSaved');
            return;
        }

        row.classList.remove(this.config.modifiedClass);

        if (this.hasActionColumns()) {
            this.updateActionButtons(row, { showOnModified: false });
        }
    }

    handleRowAdded(event) {
        const row = event.detail.row;
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans handleRowAdded');
            return;
        }

        if (this.hasActionColumns()) {
            this.setupActionColumns();
            this.updateActionButtons(row, { showOnModified: false });
        }

        if (typeof this.table.refreshPlugins === 'function') {
            this.table.refreshPlugins();
        }
    }

    updateActionButtons(row, options = {}) {
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans updateActionButtons');
            return;
        }

        const {
            showOnModified = false,
            hideSpecificAction = null
        } = options;

        const actionCells = Array.from(row.cells).filter(cell =>
            cell.classList.contains(this.config.cellClass)
        );

        actionCells.forEach(cell => {
            const buttons = cell.querySelectorAll('[data-action]');
            buttons.forEach(button => {
                const actionName = button.getAttribute('data-action');
                const originalDisplay = button.getAttribute('data-original-display') || 'inline-block';

                let shouldShow = true;

                if (hideSpecificAction && actionName === hideSpecificAction) {
                    shouldShow = false;
                }
                else if (this.shouldShowOnChange(actionName)) {
                    shouldShow = showOnModified;
                }

                button.style.display = shouldShow ? originalDisplay : 'none';
            });
        });
    }

    markRowAsSaved(row, options = {}) {
        if (!row) {
            this.debug('ERREUR: Ligne non trouvée dans markRowAsSaved');
            return;
        }

        const pluginOptions = Object.entries(options).find(
            ([key]) => key.toLowerCase() === 'actions'
        )?.[1] || {};

        // Mise à jour des valeurs initiales
        Array.from(row.cells).forEach(cell => {
            if (cell.classList.contains(this.config.cellClass)) return;

            const currentValue = cell.getAttribute('data-value');
            if (currentValue !== null) {
                cell.setAttribute('data-initial-value', currentValue);
            }
        });

        row.classList.remove(this.config.modifiedClass);
        
        if (this.hasActionColumns()) {
            this.updateActionButtons(row, {
                showOnModified: false,
                hideSpecificAction: pluginOptions.hideAction
            });
        }
    }

    refresh() {
        this.debug('Rafraîchissement du plugin');
        if (this.hasActionColumns()) {
            this.setupActionColumns();
        }
    }

    destroy() {
        this.debug('Destruction du plugin');
        
        // Arrêter le nettoyage automatique
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
            this._cleanupInterval = null;
        }
        
        // Nettoyer les événements traités
        this._processedEvents.clear();
        
        // Retirer les écouteurs d'événements
        if (this.table?.table) {
            this.table.table.removeEventListener('cell:change', this.handleCellChange);
            this.table.table.removeEventListener('row:saved', this.handleRowSaved);
            this.table.table.removeEventListener('row:added', this.handleRowAdded);
        }
    }
}