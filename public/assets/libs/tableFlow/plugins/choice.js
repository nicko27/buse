/**
 * Plugin Choice pour NvTblHandler
 * Permet de gérer des cellules avec des choix prédéfinis par simple clic
 * Support des valeurs complexes avec labels HTML et valeurs en lecture seule
 */
class ChoicePlugin {
    constructor(config = {}) {
        this.config = {
            choiceAttribute: 'data-choices',
            choiceClass: 'choice-cell',
            dropdownClass: 'choice-dropdown',
            selectedClass: 'choice-selected',
            customChoices: {},
            onChange: null,
            ...config
        };
        
        this.context = null;
        this.activeDropdown = null;
    }

    async init(context) {
        this.context = context;
        this.setupChoiceCells();
        this.setupEventListeners();
    }

    setupChoiceCells() {
        const cells = this.getChoiceCells();
        cells.forEach(cell => this.setupChoiceCell(cell));
    }

    getChoiceCells() {
        return Array.from(this.context.table.querySelectorAll(`[${this.config.choiceAttribute}]`));
    }

    setupChoiceCell(cell) {
        // Ajouter la classe de style
        cell.classList.add(this.config.choiceClass);
        
        // Obtenir les choix pour cette cellule
        const choices = this.getChoicesForCell(cell);
        if (!choices || !choices.length) return;
        
        // Créer l'élément d'affichage
        const display = document.createElement('div');
        display.className = 'choice-display';
        display.textContent = cell.textContent || choices[0];
        
        // Stocker la valeur actuelle
        cell.setAttribute('data-value', display.textContent);
        
        // Vider la cellule et ajouter l'affichage
        cell.textContent = '';
        cell.appendChild(display);
        
        // Ajouter l'écouteur de clic
        display.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showDropdown(cell, choices);
        });
    }

    getChoicesForCell(cell) {
        const columnId = this.getColumnId(cell);
        
        // Vérifier d'abord les choix personnalisés
        if (this.config.customChoices[columnId]) {
            return this.config.customChoices[columnId];
        }
        
        // Sinon, utiliser les choix définis dans l'attribut
        const choicesAttr = cell.getAttribute(this.config.choiceAttribute);
        return choicesAttr ? choicesAttr.split(',').map(c => c.trim()) : null;
    }

    getColumnId(cell) {
        const columnIndex = cell.cellIndex;
        const headers = this.context.getHeaders();
        return headers[columnIndex]?.id;
    }

    showDropdown(cell, choices) {
        // Fermer le dropdown actif s'il existe
        this.hideDropdown();
        
        // Créer le nouveau dropdown
        const dropdown = document.createElement('div');
        dropdown.className = this.config.dropdownClass;
        
        // Ajouter les options
        choices.forEach(choice => {
            const option = document.createElement('div');
            option.className = 'choice-option';
            option.textContent = choice;
            
            if (choice === cell.getAttribute('data-value')) {
                option.classList.add(this.config.selectedClass);
            }
            
            option.addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectChoice(cell, choice);
                this.hideDropdown();
            });
            
            dropdown.appendChild(option);
        });
        
        // Positionner et afficher le dropdown
        const rect = cell.getBoundingClientRect();
        dropdown.style.position = 'absolute';
        dropdown.style.top = `${rect.bottom}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.minWidth = `${rect.width}px`;
        
        document.body.appendChild(dropdown);
        this.activeDropdown = dropdown;
    }

    hideDropdown() {
        if (this.activeDropdown) {
            this.activeDropdown.remove();
            this.activeDropdown = null;
        }
    }

    selectChoice(cell, choice) {
        const oldValue = cell.getAttribute('data-value');
        if (oldValue === choice) return;
        
        // Mettre à jour l'affichage
        const display = cell.querySelector('.choice-display');
        if (display) {
            display.textContent = choice;
        }
        
        // Mettre à jour la valeur
        cell.setAttribute('data-value', choice);
        
        // Déclencher l'événement de changement
        if (typeof this.config.onChange === 'function') {
            this.config.onChange({
                cell,
                oldValue,
                newValue: choice,
                columnId: this.getColumnId(cell)
            });
        }
        
        // Émettre l'événement cell:change
        const event = new CustomEvent('cell:change', {
            detail: {
                cell,
                oldValue,
                newValue: choice,
                columnId: this.getColumnId(cell)
            },
            bubbles: true
        });
        cell.dispatchEvent(event);
    }

    setupEventListeners() {
        // Fermer le dropdown lors d'un clic en dehors
        document.addEventListener('click', () => {
            this.hideDropdown();
        });
        
        // Fermer le dropdown lors du défilement
        document.addEventListener('scroll', () => {
            this.hideDropdown();
        }, true);
    }

    setChoices(columnId, choices) {
        this.config.customChoices[columnId] = choices;
        
        // Mettre à jour les cellules existantes
        const cells = Array.from(this.context.table.querySelectorAll(`td[data-column="${columnId}"]`));
        cells.forEach(cell => {
            if (cell.classList.contains(this.config.choiceClass)) {
                this.setupChoiceCell(cell);
            }
        });
    }

    getValue(cell) {
        return cell.getAttribute('data-value');
    }

    setValue(cell, value) {
        const choices = this.getChoicesForCell(cell);
        if (choices && choices.includes(value)) {
            this.selectChoice(cell, value);
        }
    }

    refresh() {
        this.setupChoiceCells();
    }

    destroy() {
        // Nettoyer les écouteurs d'événements
        document.removeEventListener('click', this.hideDropdown);
        document.removeEventListener('scroll', this.hideDropdown);
        
        // Supprimer le dropdown actif
        this.hideDropdown();
        
        // Nettoyer les cellules
        const cells = this.getChoiceCells();
        cells.forEach(cell => {
            cell.classList.remove(this.config.choiceClass);
            const display = cell.querySelector('.choice-display');
            if (display) {
                cell.textContent = cell.getAttribute('data-value') || '';
            }
        });
        
        this.context = null;
    }
}

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.ChoicePlugin = ChoicePlugin;
}
