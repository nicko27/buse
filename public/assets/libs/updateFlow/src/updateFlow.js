/**
 * UpdateFlow - Gestionnaire moderne de mises à jour Git
 */
class UpdateFlow {
    #config;
    #notifier;
    #currentVersion;
    #pendingRequests;
    #eventHandlers;
    #messages;
    #defaultNotificationDuration = 5000;

    /**
     * @param {Object} config - Configuration de UpdateFlow
     * @param {Object} notifier - Objet contenant les fonctions de notification
     */
    constructor(config, notifier) {
        this.#validateConfig(config);
        this.#validateNotifier(notifier);

        this.#config = this.#initConfig(config);
        this.#notifier = notifier;
        this.#currentVersion = null;
        this.#pendingRequests = new Set();
        this.#eventHandlers = new Map();
        this.#messages = this.#initMessages(config.messages);

        this.#initEventHandlers();
        this.#fetchCurrentVersion();
    }

    /**
     * Initialise les messages avec les valeurs par défaut ou personnalisées
     * @private
     */
    #initMessages(customMessages = {}) {
        const defaultMessages = {
            pull: {
                start: 'Récupération des modifications en cours...',
                success: 'Les modifications ont été récupérées avec succès',
                error: 'Erreur lors du git pull'
            },
            push: {
                start: 'Envoi des modifications en cours...',
                success: 'Les modifications ont été envoyées avec succès',
                error: 'Erreur lors du git push'
            },
            rebase: {
                start: 'Rebase en cours...',
                success: 'Le rebase a été effectué avec succès',
                error: 'Erreur lors du git rebase'
            },
            merge: {
                start: 'Fusion en cours...',
                success: 'La fusion a été effectuée avec succès',
                error: 'Erreur lors du git merge'
            },
            reset: {
                start: 'Reset en cours...',
                success: 'Le reset a été effectué avec succès',
                error: 'Erreur lors du git reset'
            },
            titles: {
                pull: 'Git Pull',
                push: 'Git Push',
                rebase: 'Git Rebase',
                merge: 'Git Merge',
                reset: 'Git Reset',
                error: 'Erreur'
            }
        };

        // Fusion récursive des messages personnalisés avec les messages par défaut
        return this.#mergeDeep(defaultMessages, customMessages);
    }

    /**
     * Fusionne récursivement deux objets
     * @private
     */
    #mergeDeep(target, source) {
        const isObject = (obj) => obj && typeof obj === 'object';
        
        if (!isObject(target) || !isObject(source)) {
            return source;
        }

        Object.keys(source).forEach(key => {
            const targetValue = target[key];
            const sourceValue = source[key];

            if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
                target[key] = targetValue.concat(sourceValue);
            } else if (isObject(targetValue) && isObject(sourceValue)) {
                target[key] = this.#mergeDeep(Object.assign({}, targetValue), sourceValue);
            } else {
                target[key] = sourceValue;
            }
        });

        return target;
    }

    /**
     * Valide la configuration fournie
     * @private
     */
    #validateConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('La configuration doit être un objet');
        }

        const requiredFields = ['apiEndpoints', 'versionEndpoint'];
        const missingFields = requiredFields.filter(field => !config[field]);
        
        if (missingFields.length > 0) {
            throw new Error(`Configuration invalide. Champs manquants : ${missingFields.join(', ')}`);
        }
    }

    /**
     * Valide l'objet de notification
     * @private
     */
    #validateNotifier(notifier) {
        if (!notifier || typeof notifier !== 'object') {
            throw new Error('Le notifier doit être un objet');
        }

        const requiredMethods = ['success', 'error', 'info'];
        const missingMethods = requiredMethods.filter(method => typeof notifier[method] !== 'function');

        if (missingMethods.length > 0) {
            throw new Error(`Notifier invalide. Méthodes manquantes : ${missingMethods.join(', ')}`);
        }
    }

    /**
     * Initialise la configuration avec les valeurs par défaut
     * @private
     */
    #initConfig(config) {
        return {
            ...config,
            autoReload: config.autoReload ?? false,
            retryAttempts: config.retryAttempts ?? 3,
            retryDelay: config.retryDelay ?? 1000,
            timeout: config.timeout ?? 30000,
            debug: config.debug ?? false,
            headers: {
                'Content-Type': 'application/json',
                ...config.headers
            }
        };
    }

    /**
     * Initialise les gestionnaires d'événements par défaut
     * @private
     */
    #initEventHandlers() {
        this.#eventHandlers.set('beforeRequest', new Set());
        this.#eventHandlers.set('afterRequest', new Set());
        this.#eventHandlers.set('error', new Set());
        this.#eventHandlers.set('versionChange', new Set());
    }

    /**
     * Récupère la version actuelle
     * @private
     */
    async #fetchCurrentVersion() {
        try {
            const response = await this.#makeRequest(this.#config.versionEndpoint, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            this.#currentVersion = data.version;
            
            if (this.#config.debug) {
                console.log('Version actuelle:', this.#currentVersion);
            }
        } catch (error) {
            this.#handleError(this.#messages.titles.error, error);
        }
    }

    /**
     * Effectue une requête HTTP
     * @private
     */
    async #makeRequest(url, options = {}) {
        const requestId = Math.random().toString(36).substring(7);
        this.#pendingRequests.add(requestId);

        try {
            const defaultOptions = {
                headers: this.#config.headers
            };

            const finalOptions = {
                ...defaultOptions,
                ...options,
                headers: {
                    ...defaultOptions.headers,
                    ...options.headers
                }
            };

            await this.#triggerEvent('beforeRequest', { url, options: finalOptions });
            
            const response = await fetch(url, finalOptions);
            
            await this.#triggerEvent('afterRequest', { url, response });
            
            return response;
        } finally {
            this.#pendingRequests.delete(requestId);
        }
    }

    /**
     * Gère les erreurs de requête
     * @private
     * @param {string} defaultMessage - Message d'erreur par défaut
     * @param {Error|Response} error - Erreur à traiter
     */
    async #handleError(defaultMessage, error) {
        let errorMessage = defaultMessage;

        try {
            // Si l'erreur est une réponse HTTP
            if (error instanceof Response) {
                const data = await error.json();
                errorMessage = data.message || data.details || defaultMessage;
            } 
            // Si l'erreur est un objet Error
            else if (error instanceof Error) {
                errorMessage = error.message || defaultMessage;
            }
            // Si l'erreur est un objet avec un message
            else if (typeof error === 'object' && error.message) {
                errorMessage = error.message;
            }

            // Log de l'erreur en mode debug
            if (this.#config.debug) {
                console.error('Erreur UpdateFlow:', error);
            }

            // Notification de l'erreur
            this.#notifier.error(
                this.#messages.titles.error, 
                errorMessage, 
                this.#defaultNotificationDuration
            );

            // Déclenchement de l'événement d'erreur
            await this.#triggerEvent('error', error);

        } catch (processingError) {
            // Erreur lors du traitement de l'erreur originale
            console.error('Erreur lors du traitement de l\'erreur:', processingError);
            this.#notifier.error(
                this.#messages.titles.error, 
                defaultMessage, 
                this.#defaultNotificationDuration
            );
        } finally {
            // Suppression de la requête en cours
            const requestId = Array.from(this.#pendingRequests).pop();
            if (requestId) {
                this.#pendingRequests.delete(requestId);
            }
        }
    }

    /**
     * Déclenche les événements
     * @private
     * @param {string} eventName - Nom de l'événement
     * @param {*} data - Données de l'événement
     */
    async #triggerEvent(eventName, data) {
        const handlers = this.#eventHandlers.get(eventName);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    await handler(data);
                } catch (error) {
                    console.error(`Erreur dans le gestionnaire d'événement ${eventName}:`, error);
                }
            }
        }
    }

    /**
     * Effectue un git pull
     */
    async pull() {
        try {
            this.#notifier.info(this.#messages.titles.pull, this.#messages.pull.start);

            const response = await this.#makeRequest(this.#config.apiEndpoints.pull, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            // Mise à jour de la version et déclenchement de l'événement
            if (data.version && data.version !== this.#currentVersion) {
                this.#currentVersion = data.version;
                await this.#triggerEvent('versionChange', data.version);
            }
            
            this.#notifier.success(this.#messages.titles.pull, this.#messages.pull.success);

            if (this.#config.autoReload) {
                window.location.reload();
            }
        } catch (error) {
            this.#handleError(this.#messages.pull.error, error);
        }
    }

    /**
     * Effectue un git push
     * @param {string} message - message de commit  
     * @param {string} type - Type de version (patch, minor, major)
     */
    async push(message, type) {
        try {
            this.#notifier.info(this.#messages.titles.push, this.#messages.push.start);

            const response = await this.#makeRequest(this.#config.apiEndpoints.push, {
                method: 'POST',
                body: JSON.stringify({ message, type })
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            
            // Mise à jour de la version et déclenchement de l'événement
            if (data.version && data.version !== this.#currentVersion) {
                this.#currentVersion = data.version;
                await this.#triggerEvent('versionChange', data.version);
            }
            
            this.#notifier.success(this.#messages.titles.push, this.#messages.push.success);

            if (this.#config.autoReload) {
                window.location.reload();
            }
        } catch (error) {
            this.#handleError(this.#messages.push.error, error);
        }
    }

    /**
     * Effectue un git rebase
     */
    async rebase() {
        try {
            this.#notifier.info(this.#messages.titles.rebase, this.#messages.rebase.start);

            const response = await this.#makeRequest(this.#config.apiEndpoints.rebase, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            this.#notifier.success(this.#messages.titles.rebase, this.#messages.rebase.success);

            if (this.#config.autoReload) {
                window.location.reload();
            }
        } catch (error) {
            this.#handleError(this.#messages.rebase.error, error);
        }
    }

    /**
     * Effectue un git merge
     */
    async merge() {
        try {
            this.#notifier.info(this.#messages.titles.merge, this.#messages.merge.start);

            const response = await this.#makeRequest(this.#config.apiEndpoints.merge, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            this.#notifier.success(this.#messages.titles.merge, this.#messages.merge.success);

            if (this.#config.autoReload) {
                window.location.reload();
            }
        } catch (error) {
            this.#handleError(this.#messages.merge.error, error);
        }
    }

    /**
     * Effectue un git reset
     */
    async reset() {
        try {
            this.#notifier.info(this.#messages.titles.reset, this.#messages.reset.start);

            const response = await this.#makeRequest(this.#config.apiEndpoints.reset, {
                method: 'POST'
            });

            if (!response.ok) {
                throw new Error(`Erreur HTTP: ${response.status}`);
            }

            const data = await response.json();
            this.#notifier.success(this.#messages.titles.reset, this.#messages.reset.success);

            if (this.#config.autoReload) {
                window.location.reload();
            }
        } catch (error) {
            this.#handleError(this.#messages.reset.error, error);
        }
    }

    /**
     * Ajoute un gestionnaire d'événement
     */
    on(eventName, handler) {
        const handlers = this.#eventHandlers.get(eventName);
        if (handlers) {
            handlers.add(handler);
        }
    }

    /**
     * Supprime un gestionnaire d'événement
     */
    off(eventName, handler) {
        const handlers = this.#eventHandlers.get(eventName);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    /**
     * Vérifie s'il y a des requêtes en cours
     */
    hasPendingRequests() {
        return this.#pendingRequests.size > 0;
    }

    /**
     * Récupère la version actuelle
     */
    getCurrentVersion() {
        return this.#currentVersion;
    }
}

// Export pour différents environnements
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpdateFlow;
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return UpdateFlow; });
} else {
    window.UpdateFlow = UpdateFlow;
}
