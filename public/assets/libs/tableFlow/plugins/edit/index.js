/**
 * Plugin d'édition pour TableFlow
 * Gère l'édition des cellules du tableau
 */
import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class EditPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.EDIT;
        this.dependencies = config.dependencies;
        this.isInitialized = false;

        this.editingCell = null;
        this.originalValue = null;
        this.editInput = null;
    }

    /**
     * Initialise le plugin
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin Edit déjà initialisé');
            return;
        }

        try {
            if (!this.tableFlow) {
                throw new Error('Instance de TableFlow requise');
            }

            this.setupEventListeners();
            this.isInitialized = true;
            this.logger.info('Plugin Edit initialisé avec succès');
            this.metrics.increment('plugin_edit_init');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_init');
            throw error;
        }
    }

    /**
     * Configure les écouteurs d'événements
     */
    setupEventListeners() {
        try {
            this.tableFlow.table.addEventListener('dblclick', this.handleDoubleClick.bind(this));
            document.addEventListener('keydown', this.handleKeyDown.bind(this));
            document.addEventListener('click', this.handleDocumentClick.bind(this));
            this.metrics.increment('edit_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_setup_listeners');
            this.logger.error('Erreur lors de la configuration des écouteurs d\'événements:', error);
        }
    }

    /**
     * Gère le double-clic sur une cellule
     * @param {MouseEvent} event
     */
    handleDoubleClick(event) {
        try {
            const cell = event.target.closest('td');
            if (!cell || cell.classList.contains(this.config.classes.readOnly)) return;

            const beforeResult = this.tableFlow.hooks.trigger('beforeEdit', {
                cell,
                value: cell.textContent
            });

            if (beforeResult === false) return;

            this.startEditing(cell);
            this.metrics.increment('edit_started');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_handle_double_click');
            this.logger.error('Erreur lors du double-clic:', error);
        }
    }

    /**
     * Gère les touches du clavier
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        try {
            if (!this.editingCell) return;

            switch (event.key) {
                case 'Enter':
                    this.finishEditing();
                    break;
                case 'Escape':
                    this.cancelEditing();
                    break;
            }
        } catch (error) {
            this.errorHandler.handle(error, 'edit_handle_keydown');
            this.logger.error('Erreur lors de la gestion des touches:', error);
        }
    }

    /**
     * Gère le clic en dehors de la cellule en édition
     * @param {MouseEvent} event
     */
    handleDocumentClick(event) {
        try {
            if (!this.editingCell) return;

            const isClickInside = this.editingCell.contains(event.target);
            if (!isClickInside) {
                this.finishEditing();
            }
        } catch (error) {
            this.errorHandler.handle(error, 'edit_handle_document_click');
            this.logger.error('Erreur lors du clic sur le document:', error);
        }
    }

    /**
     * Démarre l'édition d'une cellule
     * @param {HTMLTableCellElement} cell - Cellule à éditer
     */
    startEditing(cell) {
        try {
            this.originalValue = cell.textContent;
            this.editingCell = cell;

            this.editInput = document.createElement('input');
            this.editInput.type = 'text';
            this.editInput.className = this.config.classes.editInput;
            this.editInput.value = this.originalValue;
            this.editInput.setAttribute('aria-label', 'Éditer la cellule');

            cell.textContent = '';
            cell.appendChild(this.editInput);
            cell.classList.add(this.config.classes.editing);

            this.editInput.focus();
            this.editInput.select();

            this.tableFlow.emit('edit:started', {
                cell,
                value: this.originalValue
            });

            this.metrics.increment('edit_input_created');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_start');
            this.logger.error('Erreur lors du démarrage de l\'édition:', error);
        }
    }

    /**
     * Termine l'édition de la cellule
     */
    async finishEditing() {
        try {
            if (!this.editingCell || !this.editInput) return;

            const newValue = this.editInput.value;
            const cell = this.editingCell;

            const beforeResult = await this.tableFlow.hooks.trigger('beforeEditFinish', {
                cell,
                oldValue: this.originalValue,
                newValue
            });

            if (beforeResult === false) return;

            cell.textContent = newValue;
            cell.classList.remove(this.config.classes.editing);

            this.editInput.remove();
            this.editInput = null;
            this.editingCell = null;

            await this.tableFlow.hooks.trigger('afterEditFinish', {
                cell,
                oldValue: this.originalValue,
                newValue
            });

            this.tableFlow.emit('edit:finished', {
                cell,
                oldValue: this.originalValue,
                newValue
            });

            this.originalValue = null;
            this.metrics.increment('edit_finished');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_finish');
            this.logger.error('Erreur lors de la fin de l\'édition:', error);
        }
    }

    /**
     * Annule l'édition de la cellule
     */
    async cancelEditing() {
        try {
            if (!this.editingCell || !this.editInput) return;

            const cell = this.editingCell;

            const beforeResult = await this.tableFlow.hooks.trigger('beforeEditCancel', {
                cell,
                value: this.originalValue
            });

            if (beforeResult === false) return;

            cell.textContent = this.originalValue;
            cell.classList.remove(this.config.classes.editing);

            this.editInput.remove();
            this.editInput = null;
            this.editingCell = null;

            await this.tableFlow.hooks.trigger('afterEditCancel', {
                cell,
                value: this.originalValue
            });

            this.tableFlow.emit('edit:cancelled', {
                cell,
                value: this.originalValue
            });

            this.originalValue = null;
            this.metrics.increment('edit_cancelled');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_cancel');
            this.logger.error('Erreur lors de l\'annulation de l\'édition:', error);
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (!this.isInitialized) return;

        try {
            if (this.editingCell) {
                this.cancelEditing();
            }

            this.tableFlow.table.removeEventListener('dblclick', this.handleDoubleClick.bind(this));
            document.removeEventListener('keydown', this.handleKeyDown.bind(this));
            document.removeEventListener('click', this.handleDocumentClick.bind(this));

            this.isInitialized = false;
            this.logger.info('Plugin Edit détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_destroy');
        } finally {
            super.destroy();
        }
    }

    refresh() {
        if (!this.isInitialized) {
            this.logger.warn('Plugin Edit non initialisé');
            return;
        }
        this.setupEventListeners();
    }
}