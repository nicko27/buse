class EditPlugin {
    constructor(config = {}) {
        this.config = {
            editableClass: 'editable',
            editingClass: 'editing',
            modifiedClass: 'modified',
            editableSelector: '[data-editable="true"]',
            onEdit: null,
            ...config
        };
        this.context = null;
        this.editingCell = null;
    }

    async init(context) {
        this.context = context;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const { table } = this.context;
        
        // Écouter les clics sur le tableau
        table.addEventListener('click', this.handleClick.bind(this));
        
        // Écouter les touches sur le tableau
        table.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Écouter le focus out sur le tableau
        table.addEventListener('focusout', this.handleFocusOut.bind(this));
    }

    handleClick(event) {
        const cell = event.target.closest('td');
        if (!cell || !this.isCellEditable(cell)) return;

        event.stopPropagation();
        this.startEditing(cell);
    }

    handleKeyDown(event) {
        if (!this.editingCell) return;

        switch (event.key) {
            case 'Enter':
                if (!event.shiftKey) {
                    event.preventDefault();
                    this.finishEditing();
                }
                break;
            case 'Escape':
                event.preventDefault();
                this.cancelEditing();
                break;
            case 'Tab':
                event.preventDefault();
                this.moveToNextCell(event.shiftKey);
                break;
        }
    }

    handleFocusOut(event) {
        if (!this.editingCell) return;

        // Vérifier si le focus est sorti du tableau
        const { table } = this.context;
        if (!table.contains(event.relatedTarget)) {
            this.finishEditing();
        }
    }

    isCellEditable(cell) {
        return cell.matches(this.config.editableSelector) || 
               cell.classList.contains(this.config.editableClass);
    }

    startEditing(cell) {
        if (this.editingCell === cell) return;
        
        // Finir l'édition précédente si elle existe
        if (this.editingCell) {
            this.finishEditing();
        }

        // Marquer la cellule comme en cours d'édition
        this.editingCell = cell;
        cell.classList.add(this.config.editingClass);

        // Sauvegarder la valeur initiale
        const wrapper = cell.querySelector('.cell-wrapper');
        const initialValue = wrapper.textContent.trim();
        cell.dataset.initialValue = initialValue;

        // Rendre la cellule éditable
        wrapper.contentEditable = true;
        wrapper.focus();

        // Placer le curseur à la fin du texte
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(wrapper);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    async finishEditing() {
        if (!this.editingCell) return;

        const cell = this.editingCell;
        const wrapper = cell.querySelector('.cell-wrapper');
        const newValue = wrapper.textContent.trim();
        const initialValue = cell.dataset.initialValue;

        // Nettoyer l'édition
        wrapper.contentEditable = false;
        cell.classList.remove(this.config.editingClass);
        this.editingCell = null;

        // Si la valeur a changé
        if (newValue !== initialValue) {
            const row = cell.closest('tr');
            const columnId = this.context.getColumnById(cell.cellIndex)?.id;

            if (columnId) {
                // Marquer comme modifié
                cell.classList.add(this.config.modifiedClass);
                row.classList.add(this.config.modifiedClass);

                // Notifier le changement
                if (typeof this.config.onEdit === 'function') {
                    try {
                        await this.config.onEdit({
                            row: row.id,
                            column: columnId,
                            oldValue: initialValue,
                            newValue: newValue,
                            element: cell
                        });
                    } catch (error) {
                        this.context.notify('error', `Failed to save edit: ${error.message}`);
                        // Restaurer l'ancienne valeur en cas d'erreur
                        wrapper.textContent = initialValue;
                        cell.classList.remove(this.config.modifiedClass);
                        return;
                    }
                }
            }
        }
    }

    cancelEditing() {
        if (!this.editingCell) return;

        const cell = this.editingCell;
        const wrapper = cell.querySelector('.cell-wrapper');
        
        // Restaurer la valeur initiale
        wrapper.textContent = cell.dataset.initialValue;
        
        // Nettoyer l'édition
        wrapper.contentEditable = false;
        cell.classList.remove(this.config.editingClass);
        this.editingCell = null;
    }

    moveToNextCell(reverse = false) {
        if (!this.editingCell) return;

        // Finir l'édition actuelle
        this.finishEditing();

        const currentCell = this.editingCell;
        const row = currentCell.closest('tr');
        const cells = Array.from(row.cells);
        let nextCell = null;

        // Trouver la prochaine cellule éditable
        let currentIndex = cells.indexOf(currentCell);
        let direction = reverse ? -1 : 1;
        let index = currentIndex;

        do {
            index += direction;
            if (index >= cells.length) {
                // Passer à la première cellule de la ligne suivante
                const nextRow = row.nextElementSibling;
                if (nextRow) {
                    index = 0;
                    cells = Array.from(nextRow.cells);
                } else {
                    break;
                }
            } else if (index < 0) {
                // Passer à la dernière cellule de la ligne précédente
                const prevRow = row.previousElementSibling;
                if (prevRow) {
                    cells = Array.from(prevRow.cells);
                    index = cells.length - 1;
                } else {
                    break;
                }
            }

            if (this.isCellEditable(cells[index])) {
                nextCell = cells[index];
                break;
            }
        } while (index >= 0 && index < cells.length);

        // Commencer l'édition de la nouvelle cellule
        if (nextCell) {
            this.startEditing(nextCell);
        }
    }

    refresh() {
        // Réinitialiser les écouteurs d'événements
        this.setupEventListeners();
    }

    destroy() {
        const { table } = this.context;
        
        // Nettoyer les écouteurs d'événements
        table.removeEventListener('click', this.handleClick);
        table.removeEventListener('keydown', this.handleKeyDown);
        table.removeEventListener('focusout', this.handleFocusOut);
        
        // Finir l'édition en cours si elle existe
        if (this.editingCell) {
            this.finishEditing();
        }
        
        this.context = null;
    }
}

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.EditPlugin = EditPlugin;
}
