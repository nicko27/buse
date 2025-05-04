export const EVENTS = {
    // Événements globaux
    GLOBAL: {
        ERROR: 'error',
        WARNING: 'warning',
        INFO: 'info',
        DEBUG: 'debug'
    },

    // Événements de table
    TABLE: {
        INIT: 'init',
        DESTROY: 'destroy',
        REFRESH: 'refresh',
        RESIZE: 'resize',
        SCROLL: 'scroll'
    },

    // Événements de données
    DATA: {
        LOAD: 'load',
        UPDATE: 'update',
        DELETE: 'delete',
        INSERT: 'insert',
        VALIDATE: 'validate'
    },

    // Événements de plugins
    PLUGIN: {
        LOAD: 'load',
        UNLOAD: 'unload',
        ENABLE: 'enable',
        DISABLE: 'disable',
        ERROR: 'error'
    },

    // Événements de cache
    CACHE: {
        HIT: 'hit',
        MISS: 'miss',
        UPDATE: 'update',
        CLEAR: 'clear'
    },

    // Événements de validation
    VALIDATION: {
        START: 'start',
        COMPLETE: 'complete',
        ERROR: 'error'
    },

    // Événements de métriques
    METRICS: {
        COLLECT: 'collect',
        REPORT: 'report'
    }
};

export const CHANNELS = {
    GLOBAL: 'global',
    TABLE: 'table',
    DATA: 'data',
    PLUGIN: 'plugin',
    CACHE: 'cache',
    VALIDATION: 'validation',
    METRICS: 'metrics'
}; 