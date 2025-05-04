import { Logger } from '../utils/logger.js';
import { EventBus } from '../utils/eventBus.js';

/**
 * Gestionnaire de métriques pour TableFlow
 * 
 * Métriques disponibles :
 * 
 * Compteurs :
 * - 'rows_added' : Nombre de lignes ajoutées
 * - 'rows_removed' : Nombre de lignes supprimées
 * - 'cells_modified' : Nombre de cellules modifiées
 * - 'validation_errors' : Nombre d'erreurs de validation
 * - 'cache_hits' : Nombre de succès de cache
 * - 'cache_misses' : Nombre d'échecs de cache
 * - 'plugin_load_error' : Nombre d'erreurs de chargement de plugins
 * 
 * Timers :
 * - 'add_row' : Temps d'ajout d'une ligne
 * - 'remove_row' : Temps de suppression d'une ligne
 * - 'validate_row' : Temps de validation d'une ligne
 * - 'plugin_load_*' : Temps de chargement de chaque plugin
 * - 'cache_get' : Temps d'accès au cache
 * - 'cache_set' : Temps d'écriture dans le cache
 */
export class MetricsManager {
    constructor(config = {}) {
        this.logger = new Logger('MetricsManager');
        this.eventBus = new EventBus();
        this.config = {
            enabled: true,
            sampleRate: 1.0, // 1.0 = 100% des mesures
            maxMetrics: 1000,
            flushInterval: 60000, // 1 minute
            monitorFPS: true,
            monitorMemory: true,
            monitorDOM: true,
            fpsThreshold: 16, // 60 FPS
            ...config
        };

        this.metrics = new Map();
        this.timers = new Map();
        this.counters = new Map();
        this.gauges = new Map();
        this.histograms = new Map();
        this.performanceEntries = new Map();
        this.lastFrameTime = 0;
        this.frameCount = 0;

        // Initialiser les monitors
        if (this.config.enabled) {
            if (this.config.monitorFPS) this.startFPSMonitoring();
            if (this.config.monitorMemory) this.startMemoryMonitoring();
            if (this.config.monitorDOM) this.startDOMMonitoring();
            if (this.config.flushInterval > 0) {
                this.flushInterval = setInterval(() => this.flush(), this.config.flushInterval);
            }
        }

        this.logger.info('MetricsManager initialisé');
    }

    // Monitoring FPS
    startFPSMonitoring() {
        this.lastFrameTime = performance.now();
        this.monitoringInterval = setInterval(() => {
            const currentTime = performance.now();
            const deltaTime = currentTime - this.lastFrameTime;
            const fps = Math.round(1000 / deltaTime);
            this.lastFrameTime = currentTime;

            this.gauge('fps', fps);
            if (fps < this.config.fpsThreshold) {
                this.logger.warn('FPS bas détecté:', fps);
                this.eventBus.emit('metrics:fps:low', { fps });
            }
        }, 1000);
    }

    // Monitoring mémoire
    startMemoryMonitoring() {
        if (performance.memory) {
            setInterval(() => {
                const memory = performance.memory.usedJSHeapSize;
                this.gauge('memory', memory);
                if (memory > 100 * 1024 * 1024) { // 100MB
                    this.logger.warn('Utilisation mémoire élevée:', memory);
                    this.eventBus.emit('metrics:memory:high', { memory });
                }
            }, 1000);
        }
    }

    // Monitoring DOM
    startDOMMonitoring() {
        const observer = new MutationObserver(() => {
            const domNodes = document.getElementsByTagName('*').length;
            this.gauge('dom_nodes', domNodes);
            this.increment('dom_reflows');
            
            if (domNodes > 10000) {
                this.logger.warn('Nombre élevé de nœuds DOM:', domNodes);
                this.eventBus.emit('metrics:dom:large', { nodes: domNodes });
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true
        });
    }

    // Métriques de base
    increment(name, value = 1, tags = {}) {
        if (!this.shouldRecord()) return;

        if (!this.counters.has(name)) {
            this.counters.set(name, 0);
        }
        this.counters.set(name, this.counters.get(name) + value);
        this.recordMetric('counter', name, value, tags);
    }

    decrement(name, value = 1, tags = {}) {
        this.increment(name, -value, tags);
    }

    gauge(name, value, tags = {}) {
        if (!this.shouldRecord()) return;

        this.gauges.set(name, value);
        this.recordMetric('gauge', name, value, tags);
    }

    histogram(name, value, tags = {}) {
        if (!this.shouldRecord()) return;

        if (!this.histograms.has(name)) {
            this.histograms.set(name, []);
        }
        this.histograms.get(name).push(value);
        this.recordMetric('histogram', name, value, tags);
    }

    // Mesure de temps
    startTimer(name, tags = {}) {
        if (!this.shouldRecord()) return;

        const timer = {
            start: performance.now(),
            tags
        };
        this.timers.set(name, timer);
        return name;
    }

    stopTimer(name) {
        if (!this.timers.has(name)) return;

        const timer = this.timers.get(name);
        const duration = performance.now() - timer.start;
        this.recordMetric('timer', name, duration, timer.tags);
        this.timers.delete(name);
        return duration;
    }

    // Mesure de performance
    async measure(name, fn, tags = {}) {
        const timerName = this.startTimer(name, tags);
        try {
            const result = await fn();
            const duration = this.stopTimer(timerName);
            this.performanceEntries.set(name, {
                duration,
                timestamp: Date.now(),
                count: (this.performanceEntries.get(name)?.count || 0) + 1
            });
            return result;
        } catch (error) {
            this.stopTimer(timerName);
            throw error;
        }
    }

    // Optimisation
    optimize(fn) {
        return (...args) => {
            return this.measure(fn.name, () => fn(...args));
        };
    }

    // Enregistrement des métriques
    recordMetric(type, name, value, tags = {}) {
        const metric = {
            type,
            name,
            value,
            tags,
            timestamp: Date.now()
        };

        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const metrics = this.metrics.get(name);
        metrics.push(metric);

        // Limiter le nombre de métriques stockées
        if (metrics.length > this.config.maxMetrics) {
            metrics.shift();
        }

        this.eventBus.emit('metric:recorded', metric);
    }

    // Calcul de statistiques
    getStats(name) {
        const metrics = this.metrics.get(name) || [];
        if (metrics.length === 0) return null;

        const values = metrics.map(m => m.value);
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const sorted = [...values].sort((a, b) => a - b);
        const min = sorted[0];
        const max = sorted[sorted.length - 1];
        const median = sorted[Math.floor(sorted.length / 2)];

        return {
            count: values.length,
            sum,
            avg,
            min,
            max,
            median
        };
    }

    // Gestion des métriques
    getMetrics(name) {
        if (name) {
            return this.metrics.get(name) || [];
        }
        return Array.from(this.metrics.values()).flat();
    }

    clearMetrics(name) {
        if (name) {
            this.metrics.delete(name);
        } else {
            this.metrics.clear();
        }
    }

    // Échantillonnage
    shouldRecord() {
        return this.config.enabled && Math.random() < this.config.sampleRate;
    }

    // Export et persistance
    flush() {
        const metrics = this.getMetrics();
        if (metrics.length === 0) return;

        this.eventBus.emit('metrics:flush', metrics);
        this.clearMetrics();
    }

    // Abonnement aux événements
    onMetric(callback) {
        return this.eventBus.on('metric:recorded', callback);
    }

    onFlush(callback) {
        return this.eventBus.on('metrics:flush', callback);
    }

    // Nettoyage
    destroy() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.flushInterval) {
            clearInterval(this.flushInterval);
        }
        this.flush();
        this.metrics.clear();
        this.timers.clear();
        this.counters.clear();
        this.gauges.clear();
        this.histograms.clear();
        this.performanceEntries.clear();
        this.eventBus.removeAllListeners();
        this.logger.info('MetricsManager détruit');
    }
} 