class ExamplePlugin {
    constructor(config) {
        this.config = {
            highlightColor: '#ffeb3b',
            ...config
        };
        this.context = null;
    }

    async init(context) {
        this.context = context;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Utiliser le contexte du tableau pour les événements
        const { table } = this.context;
        
        // Ajouter les écouteurs d'événements sur le tableau
        table.addEventListener('click', this.handleClick.bind(this));
        
        // Ajouter des écouteurs sur les cellules
        this.context.getCells().forEach(cell => {
            cell.addEventListener('mouseover', this.handleMouseOver.bind(this));
            cell.addEventListener('mouseout', this.handleMouseOut.bind(this));
        });
    }

    handleClick(event) {
        const cell = event.target.closest('td');
        if (!cell) return;

        const row = cell.parentElement;
        const columnId = this.context.getColumnById(cell.cellIndex);
        
        if (columnId) {
            const initialValue = this.context.getCellValue(row.id, columnId.id);
            this.context.notify('info', `Initial value: ${initialValue}`);
        }
    }

    handleMouseOver(event) {
        const cell = event.target.closest('td');
        if (cell) {
            this.context.attachToElement(cell);
            cell.style.backgroundColor = this.config.highlightColor;
        }
    }

    handleMouseOut(event) {
        const cell = event.target.closest('td');
        if (cell) {
            cell.style.backgroundColor = '';
        }
    }

    refresh(context) {
        // Mettre à jour le contexte si nécessaire
        this.context = context;
        
        // Rafraîchir les écouteurs d'événements
        this.setupEventListeners();
    }

    destroy() {
        // Nettoyer les écouteurs d'événements
        const { table } = this.context;
        table.removeEventListener('click', this.handleClick);
        
        this.context.getCells().forEach(cell => {
            cell.removeEventListener('mouseover', this.handleMouseOver);
            cell.removeEventListener('mouseout', this.handleMouseOut);
            cell.style.backgroundColor = '';
        });
        
        this.context = null;
    }
}

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.ExamplePlugin = ExamplePlugin;
}
