import { Logger } from './logger.js';
import { EventBus } from './eventBus.js';

export class CacheManager {
    constructor(config = {}) {
        this.logger = new Logger('CacheManager');
        this.eventBus = new EventBus();
        this.config = {
            strategy: 'lru', // 'lru', 'lfu', 'fifo'
            maxSize: 1000,
            ttl: 3600000, // 1 heure en ms
            checkInterval: 60000, // 1 minute
            ...config
        };

        this.cache = new Map();
        this.metadata = new Map();
        this.hits = 0;
        this.misses = 0;

        // Démarrer le nettoyage automatique
        if (this.config.checkInterval > 0) {
            this.cleanupInterval = setInterval(() => this.cleanup(), this.config.checkInterval);
        }

        this.logger.info('CacheManager initialisé avec la stratégie:', this.config.strategy);
    }

    /**
     * Définit une valeur dans le cache
     * @param {string} key - Clé du cache
     * @param {*} value - Valeur à stocker
     * @param {Object} options - Options de cache
     * @param {number} [options.ttl] - Durée de vie en ms
     * @param {boolean} [options.immutable] - Si la valeur est immuable
     */
    set(key, value, options = {}) {
        const { ttl = this.config.ttl, immutable = false } = options;

        // Vérifier la taille du cache
        if (this.size >= this.config.maxSize) {
            this.evict();
        }

        // Stocker la valeur
        this.cache.set(key, {
            value: immutable ? Object.freeze(value) : value,
            ttl,
            timestamp: Date.now(),
            immutable
        });

        // Mettre à jour les métadonnées
        this.metadata.set(key, Date.now());
        this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);
        this.size++;
    }

    /**
     * Récupère une valeur du cache
     * @param {string} key - Clé du cache
     * @returns {*} Valeur du cache ou undefined
     */
    get(key) {
        const item = this.cache.get(key);
        if (!item) return undefined;

        // Vérifier l'expiration
        if (Date.now() - item.timestamp > item.ttl) {
            this.delete(key);
            return undefined;
        }

        // Mettre à jour les métadonnées
        this.metadata.set(key, Date.now());
        this.accessCounts.set(key, (this.accessCounts.get(key) || 0) + 1);

        return item.value;
    }

    /**
     * Supprime une valeur du cache
     * @param {string} key - Clé du cache
     */
    delete(key) {
        this.cache.delete(key);
        this.metadata.delete(key);
        this.accessCounts.delete(key);
        this.size--;
    }

    /**
     * Vide le cache
     */
    clear() {
        this.cache.clear();
        this.metadata.clear();
        this.accessCounts.clear();
        this.size = 0;
    }

    /**
     * Évince des éléments selon la stratégie
     */
    evict() {
        const keys = Array.from(this.cache.keys());
        let toEvict;

        switch (this.config.strategy) {
            case 'lru':
                toEvict = keys.sort((a, b) => 
                    this.metadata.get(a) - this.metadata.get(b)
                )[0];
                break;
            case 'lfu':
                toEvict = keys.sort((a, b) => 
                    this.accessCounts.get(a) - this.accessCounts.get(b)
                )[0];
                break;
            case 'fifo':
                toEvict = keys[0];
                break;
            default:
                toEvict = keys[0];
        }

        this.delete(toEvict);
    }

    /**
     * Vérifie si une clé existe dans le cache
     * @param {string} key - Clé du cache
     * @returns {boolean} True si la clé existe
     */
    has(key) {
        return this.cache.has(key) && !this.isExpired(key);
    }

    /**
     * Vérifie si une clé est expirée
     * @param {string} key - Clé du cache
     * @returns {boolean} True si la clé est expirée
     */
    isExpired(key) {
        const item = this.cache.get(key);
        if (!item) return true;
        return Date.now() - item.timestamp > item.ttl;
    }

    /**
     * Nettoie les éléments expirés
     */
    cleanup() {
        for (const [key] of this.cache) {
            if (this.isExpired(key)) {
                this.delete(key);
            }
        }
    }

    /**
     * Nettoie le gestionnaire de cache
     */
    destroy() {
        this.clear();
    }
} 