/**
 * Plugin Color pour TableFlow
 * Permet de gérer des cellules avec sélection de couleur via un picker externe (ColorFlow).
 * Affiche un aperçu de la couleur et un input avec la valeur hexadécimale.
 *
 * @class ColorPlugin
 * @version 1.0.2 - Intégration TableInstance, vérification ColorFlow, nettoyage
 * @requires ColorFlow - Bibliothèque externe pour le sélecteur de couleur (doit être chargée globalement).
 */
export default class ColorPlugin {
    /**
     * Crée une instance de ColorPlugin.
     * @param {object} [config={}] - Configuration du plugin.
     */
    constructor(config = {}) {
        this.name = 'color';
        this.version = '1.0.2';
        this.type = 'edit'; // Ce plugin modifie la valeur des cellules
        /** @type {TableInstance|null} Référence à l'instance TableInstance */
        this.table = null;
        /** @type {string[]} Dépendances (aucunes directes dans TableFlow) */
        this.dependencies = [];
        /** @type {object|null} Instance de la bibliothèque ColorFlow */
        this.colorHandler = null;
        /** @type {Map<HTMLInputElement, Function>} Stocke les listeners 'change' ajoutés aux inputs */
        this.inputListeners = new Map();

        // Fusion de la configuration par défaut et fournie
        this.config = { ...this.getDefaultConfig(), ...config };

        // Configuration du logger (sera pleinement fonctionnel après init)
        this.debug = this.config.debug === true ?
            (...args) => this.table?.logger?.debug(`[ColorPlugin ${this.table?.tableId}]`, ...args) ?? console.debug('[ColorPlugin]', ...args) :
            () => { };
        this.logger = this.table?.logger || console;

        // Lier les méthodes pour préserver le contexte 'this' dans les listeners
        this._handleCellSaved = this._handleCellSaved.bind(this);
        this._handleRowSaved = this._handleRowSaved.bind(this);
        this._handleRowAdded = this._handleRowAdded.bind(this);
    }

    /**
     * Retourne la configuration par défaut du plugin.
     * @returns {object} Configuration par défaut.
     */
    getDefaultConfig() {
        return {
            colorAttribute: 'th-color',     // Attribut HTML sur <th> pour activer
            cellClass: 'td-color',          // Classe CSS pour les cellules <td> gérées
            readOnlyClass: 'readonly',      // Classe CSS standard pour cellules non modifiables
            modifiedClass: 'modified',      // Classe CSS pour les lignes modifiées
            wrapperClass: 'tf-color-wrapper', // Classe pour le conteneur interne (preview + input)
            inputClass: 'tf-color-input',   // Classe pour l'input hexadécimal
            previewClass: 'tf-color-preview', // Classe attendue pour l'aperçu de couleur (généré par ColorFlow)
            debug: false,                   // Active les logs de débogage
            colorFlowConfig: {}             // Options à passer au constructeur de ColorFlow
        };
    }

    /**
     * Initialise le plugin pour une instance de table.
     * @param {TableInstance} tableHandler - L'instance TableInstance gérant la table.
     * @throws {Error} Si tableHandler ou tableHandler.element n'est pas valide.
     * @throws {Error} Si la bibliothèque ColorFlow n'est pas trouvée globalement.
     */
    init(tableHandler) {
        if (!tableHandler || !tableHandler.element) {
            throw new Error('ColorPlugin: Instance TableHandler ou tableHandler.element invalide.');
        }
        this.table = tableHandler;
        this.logger = this.table.logger || this.logger; // Assigner le logger définitif
        this.debug('Initialisation du plugin Color avec la configuration:', this.config);

        // --- Vérification de la dépendance externe ColorFlow ---
        // ColorFlow doit être chargé et disponible dans le scope global (window)
        if (typeof window.ColorFlow === 'undefined') {
            const errorMsg = "La bibliothèque externe 'ColorFlow' est requise par ColorPlugin mais n'a pas été trouvée (window.ColorFlow est undefined). Assurez-vous de l'inclure dans votre page HTML avant d'initialiser TableFlow.";
            this.logger.error(errorMsg);
            throw new Error(errorMsg); // Arrêter l'initialisation si la dépendance manque
        }
        this.debug("Bibliothèque externe 'ColorFlow' trouvée.");

        // --- Instanciation de ColorFlow ---
        // On crée une seule instance de ColorFlow pour cette instance de ColorPlugin
        try {
            // Passer la configuration spécifique à ColorFlow si fournie
            const cfConfig = { ...(this.config.colorFlowConfig || {}) };
            // Ajouter la classe de preview attendue si non fournie dans la config
            // Note: ColorFlow devrait idéalement utiliser cette classe pour l'aperçu qu'il crée.
            cfConfig.previewClass = cfConfig.previewClass || this.config.previewClass;
            // Ajouter potentiellement d'autres options par défaut nécessaires pour l'intégration
            this.colorHandler = new window.ColorFlow(cfConfig);
            this.debug('Instance de ColorFlow créée avec la config:', cfConfig);
        } catch (error) {
            this.logger.error(`Échec de l'instanciation de ColorFlow: ${error.message}`, error);
            // Propage l'erreur car le plugin ne peut pas fonctionner sans ColorFlow
            throw new Error(`Échec de l'instanciation de ColorFlow: ${error.message}`);
        }

        // Configurer les cellules couleur existantes
        this.setupColorCells();
        // Attacher les écouteurs d'événements système
        this.setupEventListeners();

        this.debug('Plugin Color initialisé.');
    }

    /**
     * Configure les cellules <td> pour les colonnes de type 'color'.
     * @param {HTMLTableRowElement} [specificRow=null] - Si fourni, configure uniquement cette ligne.
     */
    setupColorCells(specificRow = null) {
        if (!this.table?.element) return;
        this.debug(`Configuration des cellules 'color' pour ${specificRow ? `la ligne ${specificRow.id}` : 'toutes les lignes'}...`);

        const headerCells = this.table.element.querySelectorAll(`thead th[${this.config.colorAttribute}]`);
        if (!headerCells.length) {
            this.debug("Aucune colonne 'color' trouvée.");
            return;
        }

        const rowsToProcess = specificRow ? [specificRow] : this.table.getAllRows(); // Utilise la méthode de l'instance

        headerCells.forEach(headerCell => {
            const columnIndex = headerCell.cellIndex;
            if (columnIndex === -1) {
                 this.logger.warn(`Index de colonne invalide pour l'en-tête color ${headerCell.id || 'inconnu'}`);
                 return;
            }
            const columnId = headerCell.id; // Récupérer l'ID de la colonne

            rowsToProcess.forEach(row => {
                const cell = row.cells[columnIndex];
                if (!cell) {
                    this.logger.warn(`Cellule manquante à l'index ${columnIndex} pour la ligne ${row.id}`);
                    return;
                }

                // Ne pas réinitialiser si déjà géré par un autre plugin
                const existingPlugin = cell.getAttribute('data-plugin');
                if (existingPlugin && existingPlugin !== 'color') {
                    this.debug(`Cellule ${cell.id} déjà gérée par le plugin '${existingPlugin}', saut.`);
                    return;
                }

                // Vérifier si déjà initialisé pour éviter doublons
                if (!cell.hasAttribute('data-color-initialized')) {
                    this.setupColorCell(cell, columnId);
                    cell.setAttribute('data-color-initialized', 'true');
                } else {
                    this.debug(`Cellule ${cell.id} déjà initialisée pour ColorPlugin.`);
                    // Mettre à jour l'affichage si la valeur a pu changer autrement
                    this.updateCellDisplay(cell);
                }
            });
        });
        this.debug("Configuration des cellules 'color' terminée.");
    }

    /**
     * Configure une cellule <td> individuelle pour la sélection de couleur.
     * @param {HTMLTableCellElement} cell - La cellule <td>.
     * @param {string} columnId - L'ID de la colonne parente.
     */
    setupColorCell(cell, columnId) {
        cell.classList.add(this.config.cellClass);
        cell.setAttribute('data-plugin', 'color'); // Indique que ce plugin gère la cellule

        // Récupérer la valeur actuelle et la convertir en hexadécimal
        let rawValue = cell.hasAttribute('data-value')
            ? cell.getAttribute('data-value')
            : cell.textContent?.trim() ?? '';
        let hexValue = this.toHexColor(rawValue) || '#000000'; // Défaut noir si conversion échoue

        // Mettre à jour data-value avec la valeur hex normalisée
        cell.setAttribute('data-value', hexValue);
        // Définir la valeur initiale si elle n'existe pas
        if (!cell.hasAttribute('data-initial-value')) {
            cell.setAttribute('data-initial-value', hexValue);
        }

        // Utiliser le wrapper existant ou le créer si nécessaire
        const wrapperClass = this.table?.config?.wrapCellClass || 'cell-wrapper';
        let wrapper = cell.querySelector(`.${wrapperClass}`);
        if (!wrapper) {
             this.debug(`Wrapper .${wrapperClass} manquant pour ${cell.id}, création...`);
             wrapper = document.createElement('div');
             wrapper.className = wrapperClass;
             cell.textContent = ''; // Vider avant d'ajouter le wrapper
             cell.appendChild(wrapper);
        }
        wrapper.innerHTML = ''; // Vider le contenu du wrapper
        wrapper.classList.add(this.config.wrapperClass); // Ajouter la classe spécifique au plugin Color

        // Créer l'input pour la valeur hexadécimale
        const input = document.createElement('input');
        input.type = 'text'; // ColorFlow le transformera
        input.className = this.config.inputClass;
        input.value = hexValue;
        input.setAttribute('cf-format', 'hex'); // Indique à ColorFlow le format attendu
        input.setAttribute('aria-label', `Couleur pour ${columnId || 'colonne ' + cell.cellIndex}`); // Accessibilité

        // Ajouter l'input au wrapper
        // ColorFlow ajoutera l'aperçu (preview) à côté de cet input
        wrapper.appendChild(input);

        // Attendre que le DOM soit prêt pour initialiser ColorFlow sur l'input
        requestAnimationFrame(() => {
            // Vérifier si le handler et la méthode existent toujours (sécurité async)
            if (this.colorHandler && typeof this.colorHandler.setupInput === 'function') {
                try {
                    // Nettoyer un éventuel listener précédent sur cet input (sécurité pour refresh)
                    if (this.inputListeners.has(input)) {
                        input.removeEventListener('change', this.inputListeners.get(input));
                        this.inputListeners.delete(input);
                    }

                    this.colorHandler.setupInput(input); // Attache le picker ColorFlow
                    this.debug(`ColorFlow initialisé pour l'input de ${cell.id}`);

                    // --- Fonction de mise à jour de la valeur ---
                    const updateValueHandler = () => {
                        const oldValue = cell.getAttribute('data-value');
                        // Lire la valeur de l'input (qui est mise à jour par ColorFlow)
                        const newValue = input.value.toUpperCase(); // Normaliser en majuscules

                        // Ne rien faire si la valeur n'a pas changé
                        if (oldValue === newValue) return;

                        this.debug(`Changement de couleur détecté pour ${cell.id}: ${oldValue} -> ${newValue}`);
                        // Mettre à jour la valeur data-value de la cellule
                        cell.setAttribute('data-value', newValue);

                        // Mettre à jour l'aperçu (si ColorFlow l'a créé avec la classe attendue)
                        const preview = input.previousElementSibling; // ColorFlow ajoute souvent le preview avant
                        if (preview && preview.classList.contains(this.config.previewClass)) {
                            preview.style.backgroundColor = newValue;
                        }

                        // Déclencher l'événement cell:change
                        this.dispatchChangeEvent(cell, newValue, oldValue, columnId);
                    };

                    // Écouter l'événement 'change' déclenché par ColorFlow
                    input.addEventListener('change', updateValueHandler);
                    // Stocker la référence au listener pour pouvoir le supprimer dans destroy
                    this.inputListeners.set(input, updateValueHandler);

                } catch (error) {
                    this.logger.error(`Erreur lors de l'appel à colorHandler.setupInput pour ${cell.id}: ${error.message}`, error);
                }
            } else {
                this.logger.error(`Instance ColorFlow (this.colorHandler) ou méthode setupInput non disponible pour ${cell.id}.`);
            }
        });
    }

     /**
      * Met à jour l'affichage d'une cellule couleur (input et preview).
      * @param {HTMLTableCellElement} cell
      */
     updateCellDisplay(cell) {
         if (!this.isManagedCell(cell)) return;

         const hexValue = cell.getAttribute('data-value') || '#000000';
         const input = cell.querySelector(`.${this.config.inputClass}`);
         // L'aperçu est généralement ajouté par ColorFlow avant l'input
         const preview = input?.previousElementSibling;

         if (input && input.value !== hexValue) {
             input.value = hexValue;
             this.debug(`Input de ${cell.id} mis à jour avec ${hexValue}`);
         }
         // Vérifier si l'aperçu existe et a la bonne classe
         if (preview && preview.classList.contains(this.config.previewClass)) {
             preview.style.backgroundColor = hexValue;
             this.debug(`Preview de ${cell.id} mis à jour avec ${hexValue}`);
         }
     }

    /**
     * Attache les écouteurs d'événements système de TableFlow.
     */
    setupEventListeners() {
        if (!this.table?.element) return;
        this.debug('Configuration des écouteurs d\'événements pour Color...');

        // Nettoyer les anciens listeners avant d'ajouter (sécurité pour refresh)
        this.table.element.removeEventListener('cell:saved', this._handleCellSaved);
        this.table.element.removeEventListener('row:saved', this._handleRowSaved);
        this.table.element.removeEventListener('row:added', this._handleRowAdded);

        // Ajouter les nouveaux listeners
        this.table.element.addEventListener('cell:saved', this._handleCellSaved);
        this.table.element.addEventListener('row:saved', this._handleRowSaved);
        this.table.element.addEventListener('row:added', this._handleRowAdded);

        this.debug('Écouteurs d\'événements Color configurés.');
    }

    /** Handler pour 'cell:saved'. @param {CustomEvent} event @private */
    _handleCellSaved(event) {
        const cell = event.detail?.cell;
        if (!cell || !this.isManagedCell(cell)) return;
        const currentValue = cell.getAttribute('data-value');
        cell.setAttribute('data-initial-value', currentValue);
        this.debug(`Valeur initiale mise à jour pour ${cell.id}: ${currentValue}`);
        this.updateCellDisplay(cell); // Assurer synchro affichage
    }

    /** Handler pour 'row:saved'. @param {CustomEvent} event @private */
    _handleRowSaved(event) {
        const row = event.detail?.row;
        if (!row) return;
        this.debug(`Gestion de row:saved pour les cellules Color de la ligne ${row.id}`);
        Array.from(row.cells).forEach(cell => {
            if (this.isManagedCell(cell)) {
                const currentValue = cell.getAttribute('data-value');
                cell.setAttribute('data-initial-value', currentValue);
                this.updateCellDisplay(cell);
            }
        });
    }

    /** Handler pour 'row:added'. @param {CustomEvent} event @private */
    _handleRowAdded(event) {
        const row = event.detail?.row;
        if (!row) return;
        this.debug(`Gestion de row:added pour la nouvelle ligne Color ${row.id}`);
        this.setupColorCells(row); // Configure uniquement la nouvelle ligne
    }


    /**
     * Vérifie si une cellule est gérée par ce plugin.
     * @param {HTMLTableCellElement | null} cell - L'élément <td>.
     * @returns {boolean}
     */
    isManagedCell(cell) {
        // Vérifie la classe et l'attribut data-plugin
        return cell?.classList.contains(this.config.cellClass) && cell.getAttribute('data-plugin') === 'color';
    }

    /**
     * Tente de convertir une chaîne de couleur en format hexadécimal (#RRGGBB).
     * @param {string | null} color - La chaîne de couleur à convertir.
     * @returns {string | null} La couleur hexadécimale en majuscules ou null si invalide.
     */
    toHexColor(color) {
        if (color == null || color === '') return null;
        const strColor = String(color).trim();

        // 1. Déjà Hex?
        if (strColor.startsWith('#')) {
            const hex = strColor.substring(1).toUpperCase();
            if (/^[0-9A-F]{3}$/.test(hex)) return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
            if (/^[0-9A-F]{6}$/.test(hex)) return `#${hex}`;
            if (/^[0-9A-F]{8}$/.test(hex)) return `#${hex.substring(0, 6)}`; // Ignore alpha
            this.logger.warn(`Format hex invalide ignoré: ${strColor}`);
            return null;
        }

        // 2. Utiliser l'astuce DOM
        if (typeof document === 'undefined') {
            this.logger.warn("Conversion de couleur non-hex nécessite l'API DOM.");
            return null;
        }
        let hexResult = null;
        try {
            const temp = document.createElement('div');
            temp.style.color = strColor; temp.style.display = 'none';
            document.body.appendChild(temp);
            const computedColor = window.getComputedStyle(temp).color;
            document.body.removeChild(temp);
            const rgbMatch = computedColor.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
            if (rgbMatch) {
                hexResult = '#' + rgbMatch.slice(1, 4).map(x => parseInt(x, 10).toString(16).padStart(2, '0')).join('');
                this.debug(`Couleur '${strColor}' convertie en hex ${hexResult.toUpperCase()}`);
            } else {
                 this.logger.warn(`Impossible de convertir '${strColor}' (calculé: ${computedColor}) en RGB.`);
            }
        } catch (error) {
            this.logger.error(`Erreur conversion couleur '${strColor}': ${error.message}`, error);
        }
        return hexResult ? hexResult.toUpperCase() : null;
    }

    /**
     * Déclenche l'événement 'cell:change' sur l'élément table.
     * @param {HTMLTableCellElement} cell
     * @param {string} newValue - Nouvelle valeur hexadécimale.
     * @param {string} oldValue - Ancienne valeur hexadécimale.
     * @param {string|null} columnId - ID de la colonne.
     * @private
     */
    dispatchChangeEvent(cell, newValue, oldValue, columnId) {
        const row = cell.closest('tr');
        const initialValue = cell.getAttribute('data-initial-value');
        const isModified = newValue !== initialValue;

        const changeEvent = new CustomEvent('cell:change', {
            detail: {
                cell: cell, cellId: cell.id, columnId: columnId, rowId: row?.id,
                value: newValue, oldValue: oldValue, initialValue: initialValue, isModified: isModified,
                source: 'color', tableId: this.table?.tableId
            },
            bubbles: true
        });
        this.debug(`Dispatching cell:change pour ${cell.id}`, changeEvent.detail);
        this.table?.element?.dispatchEvent(changeEvent);

        // Mettre à jour la classe 'modified' sur la ligne
        if (row) {
             let rowShouldBeModified = isModified;
             if (!isModified) { // Si revient à l'initial, vérifier les autres
                 rowShouldBeModified = Array.from(row.cells).some(c =>
                     c.getAttribute('data-value') !== c.getAttribute('data-initial-value')
                 );
             }
             row.classList.toggle(this.config.modifiedClass, rowShouldBeModified);
             this.debug(`Classe '${this.config.modifiedClass}' sur la ligne ${row.id}: ${rowShouldBeModified}`);
        }
    }


    /**
     * Rafraîchit l'état du plugin, reconfigurant les cellules couleur.
     */
    refresh() {
        this.debug('Rafraîchissement du plugin Color...');
        // Réinitialiser l'attribut pour forcer la reconfiguration
        // Nettoyer aussi les listeners associés aux anciens inputs
        this.table?.element?.querySelectorAll(`td.${this.config.cellClass}[data-color-initialized]`)
            .forEach(cell => {
                 const input = cell.querySelector(`.${this.config.inputClass}`);
                 if (input && this.inputListeners.has(input)) {
                      input.removeEventListener('change', this.inputListeners.get(input));
                      this.inputListeners.delete(input);
                 }
                 cell.removeAttribute('data-color-initialized');
            });
        this.setupColorCells(); // Reconfigure toutes les cellules
        this.debug('Rafraîchissement Color terminé.');
    }

    /**
     * Nettoie les ressources utilisées par le plugin.
     */
    destroy() {
        this.debug('Destruction du plugin Color...');
        if (this.table?.element) {
            // Supprimer les écouteurs d'événements système
            this.table.element.removeEventListener('cell:saved', this._handleCellSaved);
            this.table.element.removeEventListener('row:saved', this._handleRowSaved);
            this.table.element.removeEventListener('row:added', this._handleRowAdded);

            // Supprimer les écouteurs ajoutés aux inputs
            this.inputListeners.forEach((listener, input) => {
                input.removeEventListener('change', listener);
                // Si ColorFlow a une méthode de nettoyage par input, l'appeler ici
                if (this.colorHandler && typeof this.colorHandler.destroyInput === 'function') {
                    try { this.colorHandler.destroyInput(input); } catch(e) {
                         this.logger.warn(`Erreur lors de colorHandler.destroyInput pour ${input.closest('td')?.id}: ${e.message}`);
                    }
                }
            });
            this.inputListeners.clear();
            this.debug("Listeners des inputs couleur retirés.");
        }

        // Nettoyer l'instance ColorFlow si elle a une méthode destroy
        if (this.colorHandler && typeof this.colorHandler.destroy === 'function') {
            try {
                this.colorHandler.destroy();
                this.debug("Instance ColorFlow détruite.");
            } catch(error) {
                 this.logger.error(`Erreur lors de la destruction de ColorFlow: ${error.message}`, error);
            }
        }
        this.colorHandler = null;
        this.table = null; // Effacer la référence
        this.debug('Plugin Color détruit.');
    }
}
