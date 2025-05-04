import { config } from './config.js';

export class TextEditorPlugin {
    constructor(tableFlow, options = {}) {
        this.tableFlow = tableFlow;
        this.config = { ...config, ...options };
        this.logger = tableFlow.logger;
        this.metrics = tableFlow.metrics;
        this.errorHandler = tableFlow.errorHandler;
        this.currentEditor = null;
        this.autoSaveTimer = null;
    }

    init() {
        this.logger.info('Initializing TextEditor plugin');
        this.setupEventListeners();
        this.registerHooks();
        this.metrics.increment('plugin_texteditor_init');
    }

    setupEventListeners() {
        this.tableFlow.on('cellClick', this.handleCellClick.bind(this));
        this.tableFlow.on('blur', this.handleBlur.bind(this));
    }

    registerHooks() {
        this.tableFlow.hooks.register('beforeEdit', this.beforeEdit.bind(this));
        this.tableFlow.hooks.register('afterEdit', this.afterEdit.bind(this));
        this.tableFlow.hooks.register('beforeSave', this.beforeSave.bind(this));
        this.tableFlow.hooks.register('afterSave', this.afterSave.bind(this));
        this.tableFlow.hooks.register('onChange', this.onChange.bind(this));
    }

    handleCellClick(event) {
        const cell = event.target.closest('td');
        if (!cell || !cell.classList.contains(this.config.editorClass)) return;

        this.startEdit(cell);
    }

    handleBlur(event) {
        if (this.currentEditor && !event.relatedTarget?.closest(`.${this.config.editorClass}`)) {
            this.saveEdit();
        }
    }

    async startEdit(cell) {
        try {
            const beforeEditResult = await this.tableFlow.hooks.trigger('beforeEdit', { cell });
            if (beforeEditResult === false) return;

            this.currentEditor = {
                cell,
                originalValue: cell.innerHTML,
                editor: this.createEditor(cell),
                toolbar: this.createToolbar()
            };

            cell.innerHTML = '';
            cell.appendChild(this.currentEditor.toolbar);
            cell.appendChild(this.currentEditor.editor);
            this.currentEditor.editor.focus();

            if (this.config.autoSave) {
                this.startAutoSave();
            }

            this.tableFlow.emit('texteditor:open', { cell });
            this.metrics.increment('texteditor_open');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_start');
        }
    }

    createEditor(cell) {
        const editor = document.createElement('div');
        editor.className = this.config.editorClass;
        editor.contentEditable = true;
        editor.innerHTML = cell.innerHTML;
        editor.style.fontSize = this.config.defaultFontSize;
        editor.style.fontFamily = this.config.defaultFontFamily;

        editor.addEventListener('input', () => {
            this.tableFlow.hooks.trigger('onChange', {
                editor,
                content: editor.innerHTML
            });
            this.tableFlow.emit('texteditor:change', { content: editor.innerHTML });
        });

        return editor;
    }

    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = this.config.toolbarClass;

        if (this.config.buttons.bold) {
            toolbar.appendChild(this.createButton('bold', 'B', 'bold'));
        }
        if (this.config.buttons.italic) {
            toolbar.appendChild(this.createButton('italic', 'I', 'italic'));
        }
        if (this.config.buttons.underline) {
            toolbar.appendChild(this.createButton('underline', 'U', 'underline'));
        }
        if (this.config.buttons.strikethrough) {
            toolbar.appendChild(this.createButton('strikethrough', 'S', 'strikethrough'));
        }

        toolbar.appendChild(this.createSeparator());

        if (this.config.buttons.link) {
            toolbar.appendChild(this.createButton('link', '🔗', 'createLink'));
        }
        if (this.config.buttons.list) {
            toolbar.appendChild(this.createButton('unorderedList', '•', 'insertUnorderedList'));
            toolbar.appendChild(this.createButton('orderedList', '1.', 'insertOrderedList'));
        }
        if (this.config.buttons.align) {
            toolbar.appendChild(this.createButton('alignLeft', '←', 'justifyLeft'));
            toolbar.appendChild(this.createButton('alignCenter', '↔', 'justifyCenter'));
            toolbar.appendChild(this.createButton('alignRight', '→', 'justifyRight'));
        }
        if (this.config.buttons.color) {
            toolbar.appendChild(this.createColorPicker());
        }

        return toolbar;
    }

    createButton(id, text, command) {
        const button = document.createElement('button');
        button.id = id;
        button.textContent = text;
        button.addEventListener('click', () => {
            document.execCommand(command, false, null);
            this.updateButtonStates();
        });
        return button;
    }

    createSeparator() {
        const separator = document.createElement('div');
        separator.className = 'separator';
        return separator;
    }

    createColorPicker() {
        const container = document.createElement('div');
        container.className = 'color-picker';

        const button = this.createButton('color', '🎨', null);
        button.addEventListener('click', () => {
            const palette = container.querySelector('.color-palette');
            if (palette) {
                palette.remove();
            } else {
                container.appendChild(this.createColorPalette());
            }
        });

        container.appendChild(button);
        return container;
    }

    createColorPalette() {
        const palette = document.createElement('div');
        palette.className = 'color-palette';

        this.config.colors.forEach(color => {
            const option = document.createElement('div');
            option.className = 'color-option';
            option.style.backgroundColor = color;
            option.addEventListener('click', () => {
                document.execCommand('foreColor', false, color);
                palette.remove();
            });
            palette.appendChild(option);
        });

        return palette;
    }

    updateButtonStates() {
        const buttons = this.currentEditor.toolbar.querySelectorAll('button');
        buttons.forEach(button => {
            const command = button.getAttribute('data-command');
            if (command) {
                button.classList.toggle('active', document.queryCommandState(command));
            }
        });
    }

    startAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
        }

        this.autoSaveTimer = setInterval(() => {
            this.saveEdit();
        }, this.config.autoSaveInterval);
    }

    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    async saveEdit() {
        if (!this.currentEditor) return;

        try {
            const { cell, editor } = this.currentEditor;
            const newValue = editor.innerHTML;

            const beforeSaveResult = await this.tableFlow.hooks.trigger('beforeSave', {
                cell,
                oldValue: this.currentEditor.originalValue,
                newValue
            });

            if (beforeSaveResult === false) {
                this.cancelEdit();
            return;
        }
        
            cell.innerHTML = newValue;
            this.cleanupEdit();

            await this.tableFlow.hooks.trigger('afterSave', {
                cell,
                oldValue: this.currentEditor.originalValue,
                newValue
            });

            this.tableFlow.emit('texteditor:save', { cell, content: newValue });
            this.metrics.increment('texteditor_save');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_save');
        }
    }

    cancelEdit() {
        if (!this.currentEditor) return;

        try {
            const { cell, originalValue } = this.currentEditor;
            cell.innerHTML = originalValue;
            this.cleanupEdit();

            this.tableFlow.emit('texteditor:close', { cell });
            this.metrics.increment('texteditor_cancel');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_cancel');
        }
    }

    cleanupEdit() {
        if (this.currentEditor) {
            this.stopAutoSave();
            this.currentEditor = null;
        }
    }

    beforeEdit({ cell }) {
        return true;
    }

    afterEdit({ cell }) {
    }

    beforeSave({ cell, oldValue, newValue }) {
        return true;
    }
    
    afterSave({ cell, oldValue, newValue }) {
    }

    onChange({ editor, content }) {
    }
    
    destroy() {
        this.tableFlow.off('cellClick', this.handleCellClick);
        this.tableFlow.off('blur', this.handleBlur);
        this.cleanupEdit();
        this.metrics.increment('plugin_texteditor_destroy');
    }
}