import { config } from './config.js';

export class EditPlugin {
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.config = { ...config, ...options };
        this.logger = tableFlow.logger;
        this.metrics = tableFlow.metrics;
        this.errorHandler = tableFlow.errorHandler;
        this.currentEdit = null;
        this.undoStack = [];
        this.redoStack = [];
    }

    init() {
        this.logger.info('Initializing Edit plugin');
        this.setupEventListeners();
        this.registerHooks();
        this.metrics.increment('plugin_edit_init');
    }

    setupEventListeners() {
        this.tableFlow.on('cellClick', this.handleCellClick.bind(this));
        this.tableFlow.on('keydown', this.handleKeydown.bind(this));
        this.tableFlow.on('blur', this.handleBlur.bind(this));
    }

    registerHooks() {
        this.tableFlow.hooks.register('beforeEdit', this.beforeEdit.bind(this));
        this.tableFlow.hooks.register('afterEdit', this.afterEdit.bind(this));
        this.tableFlow.hooks.register('beforeSave', this.beforeSave.bind(this));
        this.tableFlow.hooks.register('afterSave', this.afterSave.bind(this));
    }

    handleCellClick(event) {
        const cell = event.target.closest('td');
        if (!cell || !cell.classList.contains(this.config.editClass)) return;

        this.startEdit(cell);
    }

    handleKeydown(event) {
        if (!this.currentEdit) return;

        switch (event.key) {
            case 'Enter':
                this.saveEdit();
                break;
            case 'Escape':
                this.cancelEdit();
                break;
            case 'z':
                if (event.ctrlKey || event.metaKey) {
                    event.shiftKey ? this.redo() : this.undo();
                }
                break;
        }
    }

    handleBlur(event) {
        if (this.currentEdit && !event.relatedTarget?.closest('td')) {
            this.saveEdit();
        }
    }

    async startEdit(cell) {
        try {
            const beforeEditResult = await this.tableFlow.hooks.trigger('beforeEdit', { cell });
            if (beforeEditResult === false) return;

            this.currentEdit = {
                cell,
                originalValue: cell.textContent,
                input: this.createInput(cell)
            };

            cell.classList.add(this.config.editingClass);
            cell.innerHTML = '';
            cell.appendChild(this.currentEdit.input);
            this.currentEdit.input.focus();

            this.tableFlow.emit('editStart', { cell });
            this.metrics.increment('edit_start');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_start');
        }
    }

    createInput(cell) {
        const input = document.createElement('input');
        input.className = 'tableflow-input';
        input.type = this.getInputType(cell);
        input.value = cell.textContent.trim();

        if (this.config.autoSelect) {
            input.select();
        }

        return input;
    }

    getInputType(cell) {
        const type = cell.getAttribute('data-type') || 'text';
        return this.config.inputTypes[type] || 'text';
    }

    async saveEdit() {
        if (!this.currentEdit) return;

        try {
            const { cell, input } = this.currentEdit;
            const newValue = input.value;

            const beforeSaveResult = await this.tableFlow.hooks.trigger('beforeSave', {
                cell,
                oldValue: this.currentEdit.originalValue,
                newValue
            });

            if (beforeSaveResult === false) {
                this.cancelEdit();
                return;
            }

            this.undoStack.push({
                cell,
                oldValue: this.currentEdit.originalValue,
                newValue
            });

            cell.textContent = newValue;
            this.cleanupEdit();

            await this.tableFlow.hooks.trigger('afterSave', {
                cell,
                oldValue: this.currentEdit.originalValue,
                newValue
            });

            this.tableFlow.emit('editComplete', { cell, newValue });
            this.metrics.increment('edit_save');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_save');
        }
    }

    cancelEdit() {
        if (!this.currentEdit) return;

        try {
            const { cell, originalValue } = this.currentEdit;
            cell.textContent = originalValue;
            this.cleanupEdit();

            this.tableFlow.emit('editCancel', { cell });
            this.metrics.increment('edit_cancel');
        } catch (error) {
            this.errorHandler.handle(error, 'edit_cancel');
        }
    }

    cleanupEdit() {
        if (this.currentEdit) {
            this.currentEdit.cell.classList.remove(this.config.editingClass);
            this.currentEdit = null;
        }
    }

    undo() {
        if (this.undoStack.length === 0) return;

        const action = this.undoStack.pop();
        this.redoStack.push({
            cell: action.cell,
            oldValue: action.newValue,
            newValue: action.oldValue
        });

        action.cell.textContent = action.oldValue;
        this.metrics.increment('edit_undo');
    }

    redo() {
        if (this.redoStack.length === 0) return;

        const action = this.redoStack.pop();
        this.undoStack.push({
            cell: action.cell,
            oldValue: action.newValue,
            newValue: action.oldValue
        });

        action.cell.textContent = action.oldValue;
        this.metrics.increment('edit_redo');
    }

    beforeEdit({ cell }) {
        // Hook pour validation pré-édition
        return true;
    }

    afterEdit({ cell }) {
        // Hook pour post-traitement après édition
    }

    beforeSave({ cell, oldValue, newValue }) {
        // Hook pour validation avant sauvegarde
        return true;
    }

    afterSave({ cell, oldValue, newValue }) {
        // Hook pour post-traitement après sauvegarde
    }

    destroy() {
        this.tableFlow.off('cellClick', this.handleCellClick);
        this.tableFlow.off('keydown', this.handleKeydown);
        this.tableFlow.off('blur', this.handleBlur);
        this.cleanupEdit();
        this.metrics.increment('plugin_edit_destroy');
    }
}