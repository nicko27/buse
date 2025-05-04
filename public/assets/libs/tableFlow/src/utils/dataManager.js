import { Logger } from './logger.js';

export class DataManager {
    constructor(config = {}) {
        this.logger = new Logger('DataManager');
        this.config = {
            dateFormat: 'YYYY-MM-DD',
            numberFormat: {
                decimalSeparator: '.',
                thousandsSeparator: ','
            },
            ...config
        };
    }

    /**
     * Exporte les données du tableau au format CSV
     * @param {Array} data - Données à exporter
     * @param {Array} headers - En-têtes des colonnes
     * @returns {string} - Données au format CSV
     */
    exportToCSV(data, headers) {
        const csvContent = [];
        
        // Ajouter les en-têtes
        const headerRow = headers.map(h => this.escapeCSV(h.textContent));
        csvContent.push(headerRow.join(','));

        // Ajouter les données
        data.forEach(row => {
            const rowData = headers.map(header => {
                const value = row[header.id];
                return this.escapeCSV(this.formatValue(value));
            });
            csvContent.push(rowData.join(','));
        });

        return csvContent.join('\n');
    }

    /**
     * Exporte les données du tableau au format JSON
     * @param {Array} data - Données à exporter
     * @returns {string} - Données au format JSON
     */
    exportToJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    /**
     * Importe des données depuis un fichier CSV
     * @param {string} csv - Contenu CSV
     * @param {Array} headers - En-têtes des colonnes
     * @returns {Array} - Données importées
     */
    importFromCSV(csv, headers) {
        const lines = csv.split('\n');
        const data = [];

        // Vérifier les en-têtes
        const csvHeaders = lines[0].split(',').map(h => this.unescapeCSV(h));
        if (!this.validateHeaders(csvHeaders, headers)) {
            throw new Error('Les en-têtes CSV ne correspondent pas aux colonnes du tableau');
        }

        // Parser les données
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => this.unescapeCSV(v));
            const rowData = {};
            
            headers.forEach((header, index) => {
                rowData[header.id] = this.parseValue(values[index]);
            });

            data.push(rowData);
        }

        return data;
    }

    /**
     * Importe des données depuis un fichier JSON
     * @param {string} json - Contenu JSON
     * @returns {Array} - Données importées
     */
    importFromJSON(json) {
        return JSON.parse(json);
    }

    escapeCSV(value) {
        if (value === null || value === undefined) return '';
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
    }

    unescapeCSV(value) {
        if (value.startsWith('"') && value.endsWith('"')) {
            return value.slice(1, -1).replace(/""/g, '"');
        }
        return value;
    }

    formatValue(value) {
        if (value === null || value === undefined) return '';
        if (value instanceof Date) {
            return this.formatDate(value);
        }
        if (typeof value === 'number') {
            return this.formatNumber(value);
        }
        return String(value);
    }

    parseValue(value) {
        if (value === '') return null;
        if (!isNaN(value)) return Number(value);
        if (value === 'true') return true;
        if (value === 'false') return false;
        return value;
    }

    formatDate(date) {
        // Implémentation simple, à améliorer avec une librairie de formatage de dates
        return date.toISOString().split('T')[0];
    }

    formatNumber(number) {
        return number.toString().replace(
            /\B(?=(\d{3})+(?!\d))/g,
            this.config.numberFormat.thousandsSeparator
        );
    }

    validateHeaders(csvHeaders, tableHeaders) {
        return csvHeaders.length === tableHeaders.length &&
               csvHeaders.every((h, i) => h === tableHeaders[i].textContent);
    }
} 