import { Logger } from '../utils/logger.js';

export class DataManager {
    constructor(options = {}) {
        this.logger = new Logger('DataManager');
        this.options = {
            maxFileSize: options.maxFileSize || 10 * 1024 * 1024, // 10MB par défaut
            allowedTypes: options.allowedTypes || ['string', 'number', 'boolean', 'null'],
            sanitizeInput: options.sanitizeInput !== false
        };
    }

    validateData(data, headers) {
        if (!Array.isArray(data)) {
            throw new Error('Les données doivent être un tableau');
        }

        if (!Array.isArray(headers)) {
            throw new Error('Les en-têtes doivent être un tableau');
        }

        for (const row of data) {
            if (typeof row !== 'object' || row === null) {
                throw new Error('Chaque ligne doit être un objet');
            }

            for (const [key, value] of Object.entries(row)) {
                if (!this.options.allowedTypes.includes(typeof value)) {
                    throw new Error(`Type de données non autorisé pour ${key}: ${typeof value}`);
                }
            }
        }
    }

    sanitizeValue(value) {
        if (!this.options.sanitizeInput) return value;

        if (typeof value === 'string') {
            // Échapper les caractères HTML
            return value
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }
        return value;
    }

    importFromCSV(csv, headers) {
        try {
            if (typeof csv !== 'string') {
                throw new Error('Le contenu CSV doit être une chaîne de caractères');
            }

            if (csv.length > this.options.maxFileSize) {
                throw new Error(`Le fichier CSV est trop volumineux (max: ${this.options.maxFileSize} bytes)`);
            }

            const lines = csv.split('\n');
            const data = [];

            // Vérifier les en-têtes
            const csvHeaders = lines[0].split(',').map(h => h.trim());
            if (!headers.every(h => csvHeaders.includes(h))) {
                throw new Error('Les en-têtes CSV ne correspondent pas aux en-têtes attendus');
            }

            // Parser les données
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;

                const values = line.split(',');
                const row = {};

                headers.forEach((header, index) => {
                    let value = values[index]?.trim();
                    
                    // Conversion de type
                    if (value === '') {
                        value = null;
                    } else if (!isNaN(value)) {
                        value = Number(value);
                    } else if (value === 'true' || value === 'false') {
                        value = value === 'true';
                    }

                    row[header] = this.sanitizeValue(value);
                });

                data.push(row);
            }

            this.validateData(data, headers);
            return data;
        } catch (error) {
            this.logger.error(`Erreur lors de l'import CSV: ${error.message}`);
            throw error;
        }
    }

    importFromJSON(json) {
        try {
            if (typeof json !== 'string') {
                throw new Error('Le contenu JSON doit être une chaîne de caractères');
            }

            if (json.length > this.options.maxFileSize) {
                throw new Error(`Le fichier JSON est trop volumineux (max: ${this.options.maxFileSize} bytes)`);
            }

            const data = JSON.parse(json);
            this.validateData(data, Object.keys(data[0] || {}));
            return data;
        } catch (error) {
            this.logger.error(`Erreur lors de l'import JSON: ${error.message}`);
            throw error;
        }
    }

    exportToCSV(data, headers) {
        try {
            this.validateData(data, headers);
            
            const csvRows = [];
            csvRows.push(headers.join(','));

            for (const row of data) {
                const values = headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    return typeof value === 'string' ? `"${value}"` : value;
                });
                csvRows.push(values.join(','));
            }

            return csvRows.join('\n');
        } catch (error) {
            this.logger.error(`Erreur lors de l'export CSV: ${error.message}`);
            throw error;
        }
    }

    exportToJSON(data) {
        try {
            this.validateData(data, Object.keys(data[0] || {}));
            return JSON.stringify(data, null, 2);
        } catch (error) {
            this.logger.error(`Erreur lors de l'export JSON: ${error.message}`);
            throw error;
        }
    }
} 