/**
 * Plugin Color pour NvTblHandler
 * Permet de gérer des cellules avec sélection de couleur
 */
(function() {
    if (typeof window.colorPlugin === 'undefined') {
        window.colorPlugin = class ColorPlugin {
            constructor(config = {}) {
                this.config = {
                    colorAttribute: 'data-color',
                    backgroundAttribute: 'data-background',
                    colorRules: [],
                    backgroundRules: [],
                    ...config
                };
                
                this.context = null;
            }

            async init(context) {
                this.context = context;
                this.applyColors();
            }

            applyColors() {
                const rows = this.context.getRows();
                rows.forEach(row => this.applyColorToRow(row));
            }

            applyColorToRow(row) {
                const cells = Array.from(row.cells);
                const rowData = this.getRowData(row);

                cells.forEach(cell => {
                    // Appliquer les règles de couleur de texte
                    const textColor = this.evaluateRules(this.config.colorRules, rowData, cell);
                    if (textColor) {
                        cell.style.color = textColor;
                        cell.setAttribute(this.config.colorAttribute, textColor);
                    }

                    // Appliquer les règles de couleur de fond
                    const backgroundColor = this.evaluateRules(this.config.backgroundRules, rowData, cell);
                    if (backgroundColor) {
                        cell.style.backgroundColor = backgroundColor;
                        cell.setAttribute(this.config.backgroundAttribute, backgroundColor);
                    }
                });
            }

            evaluateRules(rules, rowData, cell) {
                for (const rule of rules) {
                    try {
                        if (this.evaluateCondition(rule.condition, rowData, cell)) {
                            return typeof rule.color === 'function' ? 
                                   rule.color(rowData, cell) : 
                                   rule.color;
                        }
                    } catch (error) {
                        console.error('Erreur lors de l\'évaluation de la règle de couleur:', error);
                    }
                }
                return null;
            }

            evaluateCondition(condition, rowData, cell) {
                if (typeof condition === 'function') {
                    return condition(rowData, cell);
                }
                return false;
            }

            getRowData(row) {
                const data = {};
                const headers = this.context.getHeaders();
                
                Array.from(row.cells).forEach((cell, index) => {
                    const header = headers[index];
                    if (header && header.id) {
                        data[header.id] = this.getCellValue(cell);
                    }
                });
                
                return data;
            }

            getCellValue(cell) {
                return cell.getAttribute('data-value') || cell.textContent.trim();
            }

            addColorRule(rule) {
                this.config.colorRules.push(rule);
                this.applyColors();
            }

            addBackgroundRule(rule) {
                this.config.backgroundRules.push(rule);
                this.applyColors();
            }

            removeColorRule(index) {
                if (index >= 0 && index < this.config.colorRules.length) {
                    this.config.colorRules.splice(index, 1);
                    this.applyColors();
                }
            }

            removeBackgroundRule(index) {
                if (index >= 0 && index < this.config.backgroundRules.length) {
                    this.config.backgroundRules.splice(index, 1);
                    this.applyColors();
                }
            }

            clearColors() {
                const rows = this.context.getRows();
                rows.forEach(row => {
                    Array.from(row.cells).forEach(cell => {
                        cell.style.color = '';
                        cell.style.backgroundColor = '';
                        cell.removeAttribute(this.config.colorAttribute);
                        cell.removeAttribute(this.config.backgroundAttribute);
                    });
                });
            }

            refresh() {
                this.applyColors();
            }

            destroy() {
                this.clearColors();
                this.context = null;
            }
        };
    }
})();

// Enregistrer le plugin
if (typeof window !== 'undefined') {
    window.ColorPlugin = window.colorPlugin;
}
