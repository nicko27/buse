export default class HidePlugin {
    constructor(config = {}) {
        this.name = 'hide';
        this.version = '1.0.0';
        this.type = 'column';
        this.table = null;
        this.config = config;
    }

    init(tableHandler) {
        this.table = tableHandler;
        this.hideColumns();
    }

    hideColumns() {
        const headerCells = this.table.table.querySelectorAll('thead th[th-hide]');
        headerCells.forEach(cell => {
            const columnIndex = cell.cellIndex;
            this.hideColumn(columnIndex);
        });
    }

    hideColumn(columnIndex) {
        const table = this.table.table;
        const headerCell = table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        const bodyCells = table.querySelectorAll(`tbody td:nth-child(${columnIndex + 1})`);

        if (headerCell) headerCell.style.display = 'none';
        bodyCells.forEach(cell => cell.style.display = 'none');
    }

    showColumn(columnIndex) {
        const table = this.table.table;
        const headerCell = table.querySelector(`thead th:nth-child(${columnIndex + 1})`);
        const bodyCells = table.querySelectorAll(`tbody td:nth-child(${columnIndex + 1})`);

        if (headerCell) headerCell.style.display = '';
        bodyCells.forEach(cell => cell.style.display = '');
    }

    refresh() {
        this.hideColumns();
    }
}
