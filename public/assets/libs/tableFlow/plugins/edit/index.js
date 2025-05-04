/**
 * Plugin d'édition pour TableFlow
 * Gère l'édition des cellules du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { config } from './config.js';

export class EditPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = config.type;
        this.dependencies = config.dependencies;

        this.editingCell = null;
        this.originalValue = null;
        this.editInput = null;
    }

    /**
     * Initialise le plugin
     * @returns {Promise<void>}
     */
    async init() {
        if (!this.tableFlow) {
            throw new Error('TableFlow instance is required');
        }

        this.setupEventListeners();
        this.initialized = true;
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        this.tableFlow.table.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('click', this.handleDocumentClick.bind(this));
    }

    /**
     * Gère le double-clic sur une cellule
     * @param {MouseEvent} event
     */
    handleDoubleClick(event) {
        const cell = event.target.closest('td');
        if (!cell || cell.classList.contains(this.config.classes.readOnly)) return;

        this.startEditing(cell);
    }

    /**
     * Gère les touches du clavier
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (!this.editingCell) return;

        switch (event.key) {
            case 'Enter':
                this.finishEditing();
                break;
            case 'Escape':
                this.cancelEditing();
                break;
        }
    }

    /**
     * Gère le clic en dehors de la cellule en édition
     * @param {MouseEvent} event
     */
    handleDocumentClick(event) {
        if (!this.editingCell) return;

        const isClickInside = this.editingCell.contains(event.target);
        if (!isClickInside) {
            this.finishEditing();
        }
    }

    /**
     * Démarre l'édition d'une cellule
     * @param {HTMLTableCellElement} cell - Cellule à éditer
     */
    startEditing(cell) {
        // Sauvegarder la valeur originale
        this.originalValue = cell.textContent;
        this.editingCell = cell;

        // Créer l'input d'édition
        this.editInput = document.createElement('input');
        this.editInput.type = 'text';
        this.editInput.className = this.config.classes.editInput;
        this.editInput.value = this.originalValue;

        // Remplacer le contenu de la cellule
        cell.textContent = '';
        cell.appendChild(this.editInput);
        cell.classList.add(this.config.classes.editing);

        // Focus sur l'input
        this.editInput.focus();
        this.editInput.select();

        // Émettre l'événement
        this.tableFlow.emit('edit:started', {
            cell,
            value: this.originalValue
        });
    }

    /**
     * Termine l'édition de la cellule
     */
    finishEditing() {
        if (!this.editingCell || !this.editInput) return;

        const newValue = this.editInput.value;
        const cell = this.editingCell;

        // Restaurer la cellule
        cell.textContent = newValue;
        cell.classList.remove(this.config.classes.editing);

        // Nettoyer
        this.editInput.remove();
        this.editInput = null;
        this.editingCell = null;

        // Émettre l'événement
        this.tableFlow.emit('edit:finished', {
            cell,
            oldValue: this.originalValue,
            newValue
        });

        this.originalValue = null;
    }

    /**
     * Annule l'édition de la cellule
     */
    cancelEditing() {
        if (!this.editingCell || !this.editInput) return;

        const cell = this.editingCell;

        // Restaurer la valeur originale
        cell.textContent = this.originalValue;
        cell.classList.remove(this.config.classes.editing);

        // Nettoyer
        this.editInput.remove();
        this.editInput = null;
        this.editingCell = null;

        // Émettre l'événement
        this.tableFlow.emit('edit:cancelled', {
            cell,
            value: this.originalValue
        });

        this.originalValue = null;
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        super.destroy();
        if (this.editingCell) {
            this.cancelEditing();
        }
    }
}