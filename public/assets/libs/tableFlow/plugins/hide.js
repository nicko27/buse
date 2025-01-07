class HidePlugin {
    constructor(config = {}) {
        this.config = {
            hiddenClass: 'hidden-column',
            togglerClass: 'column-toggler',
            togglerContainerClass: 'column-toggler-container',
            persistKey: 'tableflow-hidden-columns',
            showToggler: true,
            defaultHidden: [],
            onToggle: null,
            ...config
        };
        
        this.context = null;
        this.hiddenColumns = new Set();
        this.togglerContainer = null;
    }

    async init(context) {
        this.context = context;
        
        // Charger l'état persisté
        this.loadPersistedState();
        
        // Cacher les colonnes par défaut
        this.config.defaultHidden.forEach(columnId => {
            this.hideColumn(columnId);
        });
        
        // Créer le toggler si nécessaire
        if (this.config.showToggler) {
            this.createToggler();
        }
        
        // Appliquer l'état initial
        this.applyHiddenState();
    }

    loadPersistedState() {
        if (!this.config.persistKey) return;
        
        try {
            const stored = localStorage.getItem(this.config.persistKey);
            if (stored) {
                const hiddenColumns = JSON.parse(stored);
                this.hiddenColumns = new Set(hiddenColumns);
            }
        } catch (error) {
            console.error('Erreur lors du chargement de l\'état persisté:', error);
        }
    }

    saveState() {
        if (!this.config.persistKey) return;
        
        try {
            localStorage.setItem(
                this.config.persistKey,
                JSON.stringify(Array.from(this.hiddenColumns))
            );
        } catch (error) {
            console.error('Erreur lors de la sauvegarde de l\'état:', error);
        }
    }

    createToggler() {
        // Créer le conteneur
        this.togglerContainer = document.createElement('div');
        this.togglerContainer.className = this.config.togglerContainerClass;
        
        // Ajouter les boutons pour chaque colonne
        const headers = this.context.getHeaders();
        headers.forEach(header => {
            if (!header.id) return;
            
            const button = document.createElement('button');
            button.className = this.config.togglerClass;
            button.dataset.column = header.id;
            button.title = `Afficher/Masquer ${header.textContent}`;
            
            // Ajouter l'icône et le label
            const icon = document.createElement('span');
            icon.className = 'toggler-icon';
            icon.textContent = '👁️';
            
            const label = document.createElement('span');
            label.className = 'toggler-label';
            label.textContent = header.textContent;
            
            button.appendChild(icon);
            button.appendChild(label);
            
            // Mettre à jour l'état initial
            if (this.isColumnHidden(header.id)) {
                button.classList.add('toggled');
            }
            
            // Ajouter l'écouteur de clic
            button.addEventListener('click', () => {
                this.toggleColumn(header.id);
            });
            
            this.togglerContainer.appendChild(button);
        });
        
        // Ajouter le conteneur au tableau
        this.context.container.insertBefore(
            this.togglerContainer,
            this.context.table
        );
    }

    isColumnHidden(columnId) {
        return this.hiddenColumns.has(columnId);
    }

    hideColumn(columnId) {
        if (this.isColumnHidden(columnId)) return;
        
        this.hiddenColumns.add(columnId);
        this.applyHiddenState();
        this.saveState();
        
        if (typeof this.config.onToggle === 'function') {
            this.config.onToggle({
                columnId,
                hidden: true,
                hiddenColumns: Array.from(this.hiddenColumns)
            });
        }
    }

    showColumn(columnId) {
        if (!this.isColumnHidden(columnId)) return;
        
        this.hiddenColumns.delete(columnId);
        this.applyHiddenState();
        this.saveState();
        
        if (typeof this.config.onToggle === 'function') {
            this.config.onToggle({
                columnId,
                hidden: false,
                hiddenColumns: Array.from(this.hiddenColumns)
            });
        }
    }

    toggleColumn(columnId) {
        if (this.isColumnHidden(columnId)) {
            this.showColumn(columnId);
        } else {
            this.hideColumn(columnId);
        }
    }

    applyHiddenState() {
        const headers = this.context.getHeaders();
        const columnMap = new Map();
        
        // Créer un mapping des colonnes
        headers.forEach((header, index) => {
            if (header.id) {
                columnMap.set(header.id, index);
            }
        });
        
        // Appliquer les classes aux cellules
        const rows = [
            ...this.context.getHeaders(),
            ...this.context.getRows()
        ];
        
        rows.forEach(row => {
            Array.from(row.cells).forEach((cell, index) => {
                const header = headers[index];
                if (header && header.id) {
                    if (this.isColumnHidden(header.id)) {
                        cell.classList.add(this.config.hiddenClass);
                    } else {
                        cell.classList.remove(this.config.hiddenClass);
                    }
                }
            });
        });
        
        // Mettre à jour les boutons du toggler
        if (this.togglerContainer) {
            const buttons = this.togglerContainer.querySelectorAll(`.${this.config.togglerClass}`);
            buttons.forEach(button => {
                const columnId = button.dataset.column;
                if (columnId) {
                    button.classList.toggle('toggled', this.isColumnHidden(columnId));
                }
            });
        }
    }

    getHiddenColumns() {
        return Array.from(this.hiddenColumns);
    }

    setHiddenColumns(columns) {
        this.hiddenColumns = new Set(columns);
        this.applyHiddenState();
        this.saveState();
    }

    showAllColumns() {
        this.hiddenColumns.clear();
        this.applyHiddenState();
        this.saveState();
    }

    refresh() {
        this.applyHiddenState();
    }

    destroy() {
        // Supprimer le toggler
        if (this.togglerContainer) {
            this.togglerContainer.remove();
            this.togglerContainer = null;
        }
        
        // Afficher toutes les colonnes
        this.showAllColumns();
        
        this.context = null;
    }
}

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.HidePlugin = HidePlugin;
}
