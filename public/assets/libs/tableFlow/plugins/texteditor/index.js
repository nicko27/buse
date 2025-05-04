import { BasePlugin } from '../../src/BasePlugin.js';
import { PluginType } from '../../src/types.js';
import { config } from './config.js';

export class TextEditorPlugin extends BasePlugin {
    constructor(tableFlow, options = {}) {
        super(tableFlow, { ...config.options, ...options });
        this.name = config.name;
        this.version = config.version;
        this.type = PluginType.TEXTEDITOR;
        this.dependencies = config.dependencies;
        this.isInitialized = false;
        
        // État local
        this.state = {
            isEditing: false,
            currentCell: null,
            originalValue: '',
            editor: null
        };
        
        // Cache pour les performances
        this.cache = {
            editorTimeout: null,
            lastEditTime: 0,
            cellStyles: new Map()
        };
        
        // Lier les méthodes
        this._boundCellClickHandler = this.handleCellClick.bind(this);
        this._boundKeyDownHandler = this.handleKeyDown.bind(this);
        this._boundBlurHandler = this.handleBlur.bind(this);
    }
    
    async init() {
        if (this.isInitialized) {
            this.logger.warn('Plugin TextEditor déjà initialisé');
            return;
        }

        try {
            this.logger.info('Initialisation du plugin TextEditor');
            
            // Ajouter les écouteurs d'événements
            this.setupEventListeners();
            
            // Initialiser les styles
            this.initializeStyles();
            
            this.isInitialized = true;
            this.metrics.increment('plugin_texteditor_init');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_init');
            throw error;
        }
    }
    
    setupEventListeners() {
        try {
            // Événements des cellules
            const cells = this.tableFlow.table.querySelectorAll('td');
            cells.forEach(cell => {
                cell.addEventListener('click', this._boundCellClickHandler);
                cell.setAttribute('role', 'textbox');
                cell.setAttribute('aria-label', 'Cellule éditable');
            });
            
            // Événements du clavier
            document.addEventListener('keydown', this._boundKeyDownHandler);
            
            this.metrics.increment('texteditor_event_listeners_setup');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_setup_listeners');
        }
    }
    
    initializeStyles() {
        try {
            // Ajouter les styles CSS
            const style = document.createElement('style');
            style.textContent = `
                .${this.config.editorClass} {
                    position: absolute;
                    z-index: 1000;
                    background: ${this.config.editor.backgroundColor};
                    border: ${this.config.editor.border};
                    box-shadow: ${this.config.editor.boxShadow};
                    padding: ${this.config.editor.padding};
                    min-width: ${this.config.editor.minWidth};
                    max-width: ${this.config.editor.maxWidth};
                }
                .${this.config.editorClass} textarea {
                    width: 100%;
                    height: 100%;
                    resize: none;
                    border: none;
                    outline: none;
                    font-family: inherit;
                    font-size: inherit;
                    line-height: inherit;
                    background: transparent;
                }
                .${this.config.editorClass}-active {
                    background: ${this.config.editor.activeBackgroundColor};
                }
            `;
            document.head.appendChild(style);
            
            this.metrics.increment('texteditor_styles_initialized');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_initialize_styles');
        }
    }
    
    async handleCellClick(event) {
        if (!this.isInitialized || this.state.isEditing) return;

        try {
            const cell = event.target.closest('td');
            if (!cell) return;
            
            // Déclencher le hook beforeEdit
            const beforeResult = await this.tableFlow.hooks.trigger('beforeEdit', {
                cell,
                event
            });
            
            if (beforeResult === false) return;
            
            // Sauvegarder les styles originaux
            this.cache.cellStyles.set(cell, {
                width: cell.style.width,
                height: cell.style.height
            });
            
            // Créer l'éditeur
            await this.createEditor(cell);
            
            this.metrics.increment('texteditor_cell_click');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_handle_cell_click');
        }
    }
    
    async createEditor(cell) {
        try {
            // Créer l'élément éditeur
            const editor = document.createElement('div');
            editor.className = this.config.editorClass;
            
            // Créer la zone de texte
            const textarea = document.createElement('textarea');
            textarea.value = cell.textContent;
            textarea.setAttribute('aria-label', 'Éditeur de texte');
            
            // Positionner l'éditeur
            const rect = cell.getBoundingClientRect();
            editor.style.top = `${rect.top}px`;
            editor.style.left = `${rect.left}px`;
            editor.style.width = `${rect.width}px`;
            editor.style.height = `${rect.height}px`;
            
            // Ajouter la zone de texte
            editor.appendChild(textarea);
            document.body.appendChild(editor);
            
            // Mettre à jour l'état
            this.state.isEditing = true;
            this.state.currentCell = cell;
            this.state.originalValue = cell.textContent;
            this.state.editor = editor;
            
            // Focus sur la zone de texte
            textarea.focus();
            
            // Ajouter l'écouteur de perte de focus
            editor.addEventListener('blur', this._boundBlurHandler, true);
            
            this.metrics.increment('texteditor_created');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_create');
        }
    }
    
    async handleKeyDown(event) {
        if (!this.isInitialized || !this.state.isEditing) return;

        try {
            switch (event.key) {
                case 'Enter':
                    if (!event.shiftKey) {
                        event.preventDefault();
                        await this.finishEditing();
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    await this.cancelEditing();
                    break;
            }
            
            this.metrics.increment('texteditor_key_down');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_handle_key_down');
        }
    }
    
    async handleBlur(event) {
        if (!this.isInitialized || !this.state.isEditing) return;

        try {
            // Vérifier si le focus est passé à un élément externe
            if (!this.state.editor.contains(event.relatedTarget)) {
                await this.finishEditing();
            }
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_handle_blur');
        }
    }
    
    async finishEditing() {
        if (!this.isInitialized || !this.state.isEditing) return;

        try {
            const newValue = this.state.editor.querySelector('textarea').value;
            
            // Déclencher le hook beforeSave
            const beforeResult = await this.tableFlow.hooks.trigger('beforeSave', {
                cell: this.state.currentCell,
                oldValue: this.state.originalValue,
                newValue
            });
            
            if (beforeResult === false) return;
            
            // Mettre à jour la cellule
            this.state.currentCell.textContent = newValue;
            
            // Nettoyer
            await this.cleanupEditor();
            
            // Déclencher le hook afterSave
            await this.tableFlow.hooks.trigger('afterSave', {
                cell: this.state.currentCell,
                oldValue: this.state.originalValue,
                newValue
            });
            
            this.metrics.increment('texteditor_finished');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_finish');
        }
    }
    
    async cancelEditing() {
        if (!this.isInitialized || !this.state.isEditing) return;

        try {
            // Déclencher le hook beforeCancel
            const beforeResult = await this.tableFlow.hooks.trigger('beforeCancel', {
                cell: this.state.currentCell,
                value: this.state.originalValue
            });
            
            if (beforeResult === false) return;
            
            // Restaurer la valeur originale
            this.state.currentCell.textContent = this.state.originalValue;
            
            // Nettoyer
            await this.cleanupEditor();
            
            // Déclencher le hook afterCancel
            await this.tableFlow.hooks.trigger('afterCancel', {
                cell: this.state.currentCell,
                value: this.state.originalValue
            });
            
            this.metrics.increment('texteditor_cancelled');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_cancel');
        }
    }
    
    async cleanupEditor() {
        try {
            // Supprimer l'éditeur
            if (this.state.editor) {
                this.state.editor.removeEventListener('blur', this._boundBlurHandler, true);
                this.state.editor.remove();
            }
            
            // Restaurer les styles de la cellule
            if (this.state.currentCell) {
                const styles = this.cache.cellStyles.get(this.state.currentCell);
                if (styles) {
                    this.state.currentCell.style.width = styles.width;
                    this.state.currentCell.style.height = styles.height;
                }
            }
            
            // Réinitialiser l'état
            this.state.isEditing = false;
            this.state.currentCell = null;
            this.state.originalValue = '';
            this.state.editor = null;
            
            this.metrics.increment('texteditor_cleaned');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_cleanup');
        }
    }
    
    async destroy() {
        if (!this.isInitialized) return;

        try {
            // Annuler l'édition en cours
            if (this.state.isEditing) {
                await this.cancelEditing();
            }
            
            // Supprimer les écouteurs d'événements
            const cells = this.tableFlow.table.querySelectorAll('td');
            cells.forEach(cell => {
                cell.removeEventListener('click', this._boundCellClickHandler);
            });
            
            document.removeEventListener('keydown', this._boundKeyDownHandler);
            
            // Supprimer les styles
            const style = document.querySelector(`style[data-plugin="${this.name}"]`);
            if (style) {
                style.remove();
            }
            
            // Nettoyer le cache
            this.cache.cellStyles.clear();
            
            this.isInitialized = false;
            this.logger.info('Plugin TextEditor détruit');
        } catch (error) {
            this.errorHandler.handle(error, 'texteditor_destroy');
        } finally {
            super.destroy();
        }
    }
}