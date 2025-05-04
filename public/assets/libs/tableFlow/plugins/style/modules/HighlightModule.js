export class HighlightModule {
    constructor(stylePlugin) {
        this.stylePlugin = stylePlugin;
        this.tableFlow = stylePlugin.tableFlow;
        this.config = stylePlugin.config.modules.highlight;
        
        this.highlights = new Map();
        this.selectedColor = this.config.colors[0].value;
        this.selectedElements = new Set();
        
        // Interface
        this.button = null;
        this.menu = null;
        this.isMenuOpen = false;
    }

    async init() {
        this.createButton();
        this.createMenu();
        this.setupEventListeners();
        await this.loadState();
    }

    createButton() {
        this.button = document.createElement('button');
        this.button.className = this.stylePlugin.config.classes.button;
        this.button.innerHTML = `
            ${this.config.interface.buttonIcon}
            <span>${this.config.interface.buttonText}</span>
        `;
        
        this.button.setAttribute('aria-label', this.config.interface.buttonText);
        this.button.setAttribute('aria-haspopup', 'true');
        this.button.setAttribute('aria-expanded', 'false');
        
        this.stylePlugin.toolbar.appendChild(this.button);
    }

    createMenu() {
        this.menu = document.createElement('div');
        this.menu.className = this.stylePlugin.config.classes.menu;
        this.menu.setAttribute('role', 'menu');
        this.menu.style.display = 'none';
        
        // Couleurs prédéfinies
        this.config.colors.forEach(color => {
            const item = this.createMenuItem(color);
            this.menu.appendChild(item);
        });
        
        // Sélecteur de couleur personnalisé
        if (this.config.interface.showColorPicker) {
            const colorPicker = this.createColorPicker();
            this.menu.appendChild(colorPicker);
        }
        
        // Option pour effacer
        const clearItem = document.createElement('div');
        clearItem.className = this.stylePlugin.config.classes.menuItem;
        clearItem.textContent = 'Effacer';
        clearItem.addEventListener('click', () => this.clearHighlights());
        this.menu.appendChild(clearItem);
        
        this.stylePlugin.container.appendChild(this.menu);
    }

    createMenuItem(color) {
        const item = document.createElement('div');
        item.className = this.stylePlugin.config.classes.menuItem;
        item.setAttribute('role', 'menuitem');
        item.setAttribute('data-color', color.value);
        
        const preview = document.createElement('div');
        preview.className = 'tf-style-color-preview';
        preview.style.backgroundColor = color.value;
        
        if (this.config.interface.showLabels) {
            const label = document.createElement('span');
            label.textContent = color.name;
            item.appendChild(label);
        }
        
        item.appendChild(preview);
        item.addEventListener('click', () => this.handleColorSelect(color));
        
        return item;
    }

    createColorPicker() {
        const container = document.createElement('div');
        container.className = 'tf-style-color-picker';
        
        const input = document.createElement('input');
        input.type = 'color';
        input.value = this.selectedColor;
        input.addEventListener('change', (e) => {
            this.selectedColor = e.target.value;
            this.applyHighlight();
        });
        
        container.appendChild(input);
        return container;
    }

    handleColorSelect(color) {
        this.selectedColor = color.value;
        this.applyHighlight();
        
        if (this.config.interface.closeOnSelect) {
            this.closeMenu();
        }
    }

    applyHighlight() {
        if (this.selectedElements.size === 0) return;

        const style = {
            backgroundColor: this.selectedColor,
            color: this.getContrastColor(this.selectedColor)
        };

        this.selectedElements.forEach(element => {
            const styleId = this.stylePlugin.styleManager.applyStyle(element, style);
            this.highlights.set(element, styleId);
        });

        // Sauvegarder l'état
        this.saveState();
    }

    clearHighlights() {
        this.highlights.forEach((styleId, element) => {
            this.stylePlugin.styleManager.removeStyle(element, styleId);
        });
        this.highlights.clear();
        this.saveState();
    }

    handleSelectionStart(event) {
        if (!event.target.matches('td, th')) return;
        
        this.selectedElements.clear();
        this.addToSelection(event.target);
        event.preventDefault();
    }

    handleSelectionMove(event) {
        if (!event.buttons || !event.target.matches('td, th')) return;
        this.addToSelection(event.target);
    }

    handleSelectionEnd() {
        if (this.selectedElements.size > 0) {
            this.openMenu();
        }
    }

    addToSelection(element) {
        switch (this.config.mode) {
            case 'cell':
                this.selectedElements.add(element);
                break;
                
            case 'row':
                const row = element.parentElement;
                Array.from(row.cells).forEach(cell => 
                    this.selectedElements.add(cell)
                );
                break;
                
            case 'column':
                const columnIndex = element.cellIndex;
                Array.from(this.tableFlow.table.rows).forEach(row => 
                    this.selectedElements.add(row.cells[columnIndex])
                );
                break;
        }
    }

    openMenu() {
        const buttonRect = this.button.getBoundingClientRect();
        
        this.menu.style.display = 'block';
        this.menu.style.top = `${buttonRect.bottom + 5}px`;
        this.menu.style.left = `${buttonRect.left}px`;
        
        this.isMenuOpen = true;
        this.button.setAttribute('aria-expanded', 'true');
    }

    closeMenu() {
        this.menu.style.display = 'none';
        this.isMenuOpen = false;
        this.button.setAttribute('aria-expanded', 'false');
    }

    getContrastColor(hexcolor) {
        const r = parseInt(hexcolor.slice(1, 3), 16);
        const g = parseInt(hexcolor.slice(3, 5), 16);
        const b = parseInt(hexcolor.slice(5, 7), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? '#000000' : '#FFFFFF';
    }

    async saveState() {
        const state = {
            highlights: Array.from(this.highlights.entries()).map(([element, styleId]) => ({
                elementId: element.id || this.generateElementId(element),
                styleId
            }))
        };
        
        await this.stylePlugin.stateManager.setModuleState('highlight', state);
    }

    async loadState() {
        const state = await this.stylePlugin.stateManager.getModuleState('highlight');
        if (!state) return;

        state.highlights.forEach(({ elementId, styleId }) => {
            const element = document.getElementById(elementId);
            if (element) {
                this.highlights.set(element, styleId);
            }
        });
    }

    generateElementId(element) {
        const id = `tf-el-${Math.random().toString(36).substr(2, 9)}`;
        element.id = id;
        return id;
    }

    destroy() {
        // Supprimer les éléments d'interface
        if (this.button && this.button.parentNode) {
            this.button.parentNode.removeChild(this.button);
        }
        if (this.menu && this.menu.parentNode) {
            this.menu.parentNode.removeChild(this.menu);
        }

        // Sauvegarder l'état final
        this.saveState();
        
        // Nettoyer les données
        this.highlights.clear();
        this.selectedElements.clear();
    }
} 