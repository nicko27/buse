(function() {
    if (typeof window.hidePlugin === 'undefined') {
        window.hidePlugin = class hideplugin {
            constructor(config = {}) {
                this.name = 'hide';
                this.version = '1.0.0';
                this.table = null;
                this.config = {
                    hideAttribute: 'th-hide',
                    ...config
                };
            }

            init(tableHandler) {
                if (!tableHandler) {
                    throw new Error('TableHandler instance is required');
                }
                this.table = tableHandler;
                this.hideColumns();
                this.setupEventListeners();
                this.debug('Plugin initialisé');
            }

            setupEventListeners() {
                if (!this.table || !this.table.table) return;

                this.table.table.addEventListener('row:added', () => {
                    this.hideColumns();
                });
            }

            hideColumns() {
                if (!this.table || !this.table.table) return;

                const tableId = this.table.table.id;
                const headers = this.table.table.querySelectorAll('th');
                headers.forEach((header, index) => {
                    if (header.hasAttribute(this.config.hideAttribute)) {
                        // Cache le header
                        header.style.display = 'none';
                        
                        // Cache les cellules correspondantes
                        const rows = this.table.table.querySelectorAll('tbody tr');
                        rows.forEach(row => {
                            const cell = row.cells[index];
                            if (cell) {
                                cell.style.display = 'none';
                            }
                        });
                    }
                });

                this.debug('Colonnes masquées');
            }

            destroy() {
                if (!this.table || !this.table.table) return;

                // Réaffiche toutes les colonnes cachées
                const headers = this.table.table.querySelectorAll('th[style*="display: none"]');
                headers.forEach((header, index) => {
                    header.style.display = '';
                    const rows = this.table.table.querySelectorAll('tbody tr');
                    rows.forEach(row => {
                        const cell = row.cells[index];
                        if (cell) {
                            cell.style.display = '';
                        }
                    });
                });

                this.table = null;
                this.debug('Plugin détruit');
            }

            debug(message, data = null) {
                if (this.table?.options?.debug) {
                    console.log(`[${this.name}] ${message}`, data || '');
                }
            }
        }
    }
})();
