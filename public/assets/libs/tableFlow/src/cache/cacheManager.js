import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';

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
    }

    // Méthodes principales
    set(key, value, options = {}) {
        const ttl = options.ttl || this.config.ttl;
        const metadata = {
            timestamp: Date.now(),
            expires: ttl > 0 ? Date.now() + ttl : Infinity,
            accessCount: 0,
            lastAccess: Date.now()
        };

        // Vérifier la taille du cache
        if (this.cache.size >= this.config.maxSize) {
            this.evict();
        }

        this.cache.set(key, value);
        this.metadata.set(key, metadata);
        this.eventBus.emit('cache:set', { key, value, metadata });
    }

    get(key) {
        const value = this.cache.get(key);
        const metadata = this.metadata.get(key);

        if (!value || !metadata) {
            this.misses++;
            this.eventBus.emit('cache:miss', { key });
            return null;
        }

        // Vérifier l'expiration
        if (Date.now() > metadata.expires) {
            this.delete(key);
            this.misses++;
            this.eventBus.emit('cache:expire', { key });
            return null;
        }

        // Mettre à jour les métadonnées
        metadata.accessCount++;
        metadata.lastAccess = Date.now();
        this.hits++;
        this.eventBus.emit('cache:hit', { key, value });

        return value;
    }

    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.metadata.delete(key);
            this.eventBus.emit('cache:delete', { key });
        }
        return deleted;
    }

    has(key) {
        return this.cache.has(key) && !this.isExpired(key);
    }

    // Gestion de l'expiration
    isExpired(key) {
        const metadata = this.metadata.get(key);
        return metadata && Date.now() > metadata.expires;
    }

    cleanup() {
        const now = Date.now();
        for (const [key, metadata] of this.metadata.entries()) {
            if (now > metadata.expires) {
                this.delete(key);
            }
        }
    }

    // Stratégies d'éviction
    evict() {
        switch (this.config.strategy) {
            case 'lru':
                this.evictLRU();
                break;
            case 'lfu':
                this.evictLFU();
                break;
            case 'fifo':
                this.evictFIFO();
                break;
            default:
                this.evictLRU();
        }
    }

    evictLRU() {
        let oldestAccess = Infinity;
        let keyToEvict = null;

        for (const [key, metadata] of this.metadata.entries()) {
            if (metadata.lastAccess < oldestAccess) {
                oldestAccess = metadata.lastAccess;
                keyToEvict = key;
            }
        }

        if (keyToEvict) {
            this.delete(keyToEvict);
        }
    }

    evictLFU() {
        let lowestCount = Infinity;
        let keyToEvict = null;

        for (const [key, metadata] of this.metadata.entries()) {
            if (metadata.accessCount < lowestCount) {
                lowestCount = metadata.accessCount;
                keyToEvict = key;
            }
        }

        if (keyToEvict) {
            this.delete(keyToEvict);
        }
    }

    evictFIFO() {
        let oldestTimestamp = Infinity;
        let keyToEvict = null;

        for (const [key, metadata] of this.metadata.entries()) {
            if (metadata.timestamp < oldestTimestamp) {
                oldestTimestamp = metadata.timestamp;
                keyToEvict = key;
            }
        }

        if (keyToEvict) {
            this.delete(keyToEvict);
        }
    }

    // Méthodes utilitaires
    clear() {
        this.cache.clear();
        this.metadata.clear();
        this.hits = 0;
        this.misses = 0;
        this.eventBus.emit('cache:clear');
    }

    getStats() {
        const total = this.hits + this.misses;
        return {
            size: this.cache.size,
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            keys: Array.from(this.cache.keys())
        };
    }

    // Méthodes avancées
    async getOrSet(key, valueFunction, options = {}) {
        let value = this.get(key);
        if (value === null) {
            value = await Promise.resolve(valueFunction());
            this.set(key, value, options);
        }
        return value;
    }

    mget(keys) {
        return keys.map(key => ({
            key,
            value: this.get(key)
        }));
    }

    mset(entries, options = {}) {
        entries.forEach(({ key, value }) => {
            this.set(key, value, options);
        });
    }

    // Événements
    onSet(callback) {
        return this.eventBus.on('cache:set', callback);
    }

    onDelete(callback) {
        return this.eventBus.on('cache:delete', callback);
    }

    onHit(callback) {
        return this.eventBus.on('cache:hit', callback);
    }

    onMiss(callback) {
        return this.eventBus.on('cache:miss', callback);
    }

    onExpire(callback) {
        return this.eventBus.on('cache:expire', callback);
    }

    onClear(callback) {
        return this.eventBus.on('cache:clear', callback);
    }

    // Nettoyage
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
        this.eventBus.removeAllListeners();
    }
} 