/**
 * Plugin Choice pour NvTblHandler
 * Permet de gérer des cellules avec des choix prédéfinis par simple clic
 * Support des valeurs complexes avec labels HTML et valeurs en lecture seule
 */
(function() {
    if (typeof window.choicePlugin === 'undefined') {
        window.choicePlugin = class choiceplugin {
            constructor(options = {}) {
                this.name = 'choice';
                this.version = '1.0.0';
                this.type = 'edit';
                this.table = null;
                this.config = { ...this.getDefaultConfig(), ...options };
                this.debug('Plugin créé avec la config:', this.config);
            }

            getDefaultConfig() {
                return {
                    choiceAttribute: 'th-choice',
                    cellClass: 'td-choice',
                    readOnlyClass: 'readonly',
                    modifiedClass: 'modified',
                    debug: false,
                    choices: {}
                };
            }

            debug(message, data = null) {
                if (this.config.debug) {
                    if (data) {
                        console.log('[ChoicePlugin]', message, data);
                    } else {
                        console.log('[ChoicePlugin]', message);
                    }
                }
            }

            init(tableHandler) {
                if (!tableHandler) {
                    throw new Error('TableHandler instance is required');
                }
                this.table = tableHandler;
                this.debug('Initializing choice plugin');

                this.setupChoiceCells();
                this.setupEventListeners();
            }

            setupChoiceCells() {
                if (!this.table || !this.table.table) return;

                const headerCells = this.table.table.querySelectorAll('th');
                const choiceColumns = Array.from(headerCells)
                    .filter(header => header.hasAttribute(this.config.choiceAttribute))
                    .map(header => ({
                        id: header.id,
                        index: Array.from(headerCells).indexOf(header)
                    }));

                if (!choiceColumns.length) return;

                const rows = this.table.table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    choiceColumns.forEach(({id: columnId, index}) => {
                        const cell = row.cells[index];
                        if (!cell) return;

                        if (cell.getAttribute('data-plugin') && cell.getAttribute('data-plugin') !== 'choice') {
                            return;
                        }

                        this.setupChoiceCell(cell, columnId);
                    });
                });
            }

            setupChoiceCell(cell, columnId) {
                cell.classList.add(this.config.cellClass);
                cell.setAttribute('data-plugin', 'choice');

                const choices = this.config.choices[columnId];
                if (!choices || !choices.length) return;

                let currentValue = cell.getAttribute('data-value');
                if (!currentValue) {
                    currentValue = cell.textContent.trim();
                    cell.setAttribute('data-value', currentValue);
                }

                if (!cell.hasAttribute('data-initial-value')) {
                    cell.setAttribute('data-initial-value', currentValue);
                }

                // Trouver le choix correspondant à la valeur actuelle
                const currentChoice = choices.find(c => 
                    (typeof c === 'object' ? c.value : c) === currentValue
                );

                // Vérifier si la valeur actuelle est en lecture seule
                const isReadOnly = currentChoice && typeof currentChoice === 'object' && currentChoice.readOnly;
                if (isReadOnly) {
                    cell.classList.add(this.config.readOnlyClass);
                }

                // Mettre à jour le contenu de la cellule avec le label HTML
                if (currentChoice) {
                    const label = typeof currentChoice === 'object' ? currentChoice.label : currentChoice;
                    const wrapper = document.createElement('div');
                    wrapper.className = 'cell-wrapper';
                    wrapper.innerHTML = label;
                    cell.textContent = '';
                    cell.appendChild(wrapper);
                }
            }

            setupEventListeners() {
                if (!this.table || !this.table.table) return;

                this.table.table.addEventListener('click', (event) => {
                    this.handleClick(event);
                });

                // Écouter l'événement cell:saved
                this.table.table.addEventListener('cell:saved', (event) => {
                    const cell = event.detail.cell;
                    if (!cell || !this.isManagedCell(cell)) return;

                    const currentValue = cell.getAttribute('data-value');
                    cell.setAttribute('data-initial-value', currentValue);

                    // Mettre à jour le label si nécessaire
                    const columnId = cell.id.split('_')[0];
                    const choices = this.config.choices[columnId];
                    if (choices) {
                        const currentChoice = choices.find(c => 
                            (typeof c === 'object' ? c.value : c) === currentValue
                        );
                        if (currentChoice) {
                            const label = typeof currentChoice === 'object' ? currentChoice.label : currentChoice;
                            const wrapper = cell.querySelector('.cell-wrapper');
                            if (wrapper) {
                                wrapper.innerHTML = label;
                            }
                        }
                    }
                });

                // Écouter l'événement row:saved
                this.table.table.addEventListener('row:saved', (event) => {
                    const row = event.detail.row;
                    if (!row) return;

                    Array.from(row.cells).forEach(cell => {
                        if (!this.isManagedCell(cell)) return;

                        const currentValue = cell.getAttribute('data-value');
                        cell.setAttribute('data-initial-value', currentValue);
                    });

                    row.classList.remove(this.config.modifiedClass);
                });

                // Écouter l'ajout de nouvelles lignes
                this.table.table.addEventListener('row:added', () => {
                    this.debug('row:added event received');
                    this.setupChoiceCells();
                });
            }

            handleClick(event) {
                const cell = event.target.closest('td');
                if (!cell || !cell.classList.contains(this.config.cellClass)) {
                    return;
                }

                // Vérifier si la cellule est bien gérée par ce plugin
                if (cell.getAttribute('data-plugin') !== 'choice') {
                    return;
                }

                // Vérifier si la cellule est en lecture seule
                if (cell.classList.contains(this.config.readOnlyClass)) {
                    return;
                }

                const columnIndex = Array.from(cell.parentElement.children).indexOf(cell);
                const header = this.table.table.querySelectorAll('th')[columnIndex];
                const columnId = header.id;
                if (!columnId || !this.config.choices[columnId]) {
                    return;
                }

                // Filtrer les choix pour exclure ceux en readOnly
                const choices = this.config.choices[columnId].filter(choice => 
                    !(typeof choice === 'object' && choice.readOnly === true)
                );
                
                if (!choices || !choices.length) {
                    return;
                }

                // Récupérer la valeur actuelle
                const currentValue = cell.getAttribute('data-value');
                let nextValue;
                let nextChoiceIndex = -1;

                // Trouver l'index du choix actuel dans la liste filtrée
                const currentIndex = choices.findIndex(choice => 
                    (typeof choice === 'object' ? choice.value : choice) === currentValue
                );

                // Si la valeur actuelle n'est pas dans les choix disponibles (car en readOnly)
                // ou si on est au dernier choix, prendre le premier choix disponible
                if (currentIndex === -1 || currentIndex === choices.length - 1) {
                    nextChoiceIndex = 0;
                } else {
                    nextChoiceIndex = currentIndex + 1;
                }

                const nextChoice = choices[nextChoiceIndex];
                nextValue = typeof nextChoice === 'object' ? nextChoice.value : nextChoice;

                // Mettre à jour la valeur
                cell.setAttribute('data-value', nextValue);

                // Mettre à jour le label
                const label = typeof nextChoice === 'object' ? nextChoice.label : nextChoice;
                const wrapper = cell.querySelector('.cell-wrapper');
                if (wrapper) {
                    wrapper.innerHTML = label;
                }

                // Marquer la ligne comme modifiée si la valeur a changé
                const row = cell.closest('tr');
                if (row && nextValue !== cell.getAttribute('data-initial-value')) {
                    row.classList.add(this.config.modifiedClass);
                }

                // Déclencher l'événement de changement
                const changeEvent = new CustomEvent('cell:change', {
                    detail: {
                        cellId: cell.id,
                        columnId,
                        rowId: row.id,
                        oldValue: currentValue,
                        newValue: nextValue,
                        cell: cell
                    },
                    bubbles: true
                });
                cell.dispatchEvent(changeEvent);
            }

            isManagedCell(cell) {
                return cell && cell.getAttribute('data-plugin') === 'choice';
            }

            refresh() {
                this.setupChoiceCells();
            }

            destroy() {
                // Clean up code here
            }
        };
    }
})();

// Export pour ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = choiceplugin;
} else if (typeof exports !== 'undefined') {
    exports.choiceplugin = choiceplugin;
}
