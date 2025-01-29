/**
 * NotifyFlow - Une bibliothèque moderne de notifications
 * @author Codeium
 * @version 1.0.0
 */
class NotifyFlow {
    constructor(config = {}) {
        this.config = {
            position: config.position || 'top-right',
            theme: config.theme || 'light',
            maxNotifications: config.maxNotifications || 5,
            defaultDuration: config.defaultDuration || 5000,
            containerClass: config.containerClass || 'notify-flow',
            animations: config.animations || {
                in: 'slide-in',
                out: 'fade-out'
            }
        };

        this.notifications = new Set();
        this.initialize();
    }

    /**
     * Initialise le conteneur de notifications
     * @private
     */
    initialize() {
        if (document.querySelector(`.${this.config.containerClass}`)) return;

        const container = document.createElement('div');
        container.className = `${this.config.containerClass} ${this.config.position} ${this.config.theme}`;
        document.body.appendChild(container);

        // Gestion du thème système
        if (this.config.theme === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.handleThemeChange(mediaQuery);
            mediaQuery.addListener(this.handleThemeChange.bind(this));
        }
    }

    /**
     * Gère le changement de thème système
     * @private
     */
    handleThemeChange(e) {
        const container = document.querySelector(`.${this.config.containerClass}`);
        if (container) {
            container.classList.toggle('dark', e.matches);
            container.classList.toggle('light', !e.matches);
        }
    }

    /**
     * Crée une nouvelle notification
     * @param {Object} options - Options de la notification
     */
    notify(options = {}) {
        const {
            title,
            message,
            type = 'info',
            icon,
            duration = this.config.defaultDuration,
            actions = [],
            progress = true,
            dismissible = true,
            autoAction = null,  // ID de l'action à exécuter automatiquement
            autoActionDelay = duration,  // Délai avant l'exécution automatique
            customClass = ''  // Nouvelle option pour les classes personnalisées
        } = options;

        // Limite le nombre de notifications
        if (this.notifications.size >= this.config.maxNotifications) {
            const oldestNotification = this.notifications.values().next().value;
            if (oldestNotification) this.remove(oldestNotification);
        }

        const notification = document.createElement('div');
        notification.className = `notify-flow-item ${type} ${customClass}`.trim();
        notification.setAttribute('role', 'alert');

        // Construction du contenu
        let content = '';
        
        if (icon) {
            content += `<div class="notify-flow-icon">${icon}</div>`;
        }

        content += '<div class="notify-flow-content">';
        if (title) {
            content += `<div class="notify-flow-title">${title}</div>`;
        }
        content += `<div class="notify-flow-message">${message}</div>`;

        if (actions.length > 0) {
            content += '<div class="notify-flow-actions">';
            actions.forEach(action => {
                const isAuto = autoAction === action.id;
                content += `<button class="notify-flow-btn ${action.class || ''} ${isAuto ? 'auto-action' : ''}" 
                    data-action="${action.id}">
                    ${action.text}
                    ${isAuto ? `<span class="auto-action-timer">${Math.ceil(autoActionDelay / 1000)}s</span>` : ''}
                    </button>`;
            });
            content += '</div>';
        }
        content += '</div>';

        if (dismissible) {
            content += `<button class="notify-flow-close" aria-label="Fermer">
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>
            </button>`;
        }

        notification.innerHTML = content;

        // Ajout de la barre de progression
        if (progress && (duration > 0 || (autoAction && autoActionDelay > 0))) {
            const progressBar = document.createElement('div');
            progressBar.className = 'notify-flow-progress';
            notification.appendChild(progressBar);

            // Animation de la barre de progression
            const progressDuration = autoAction ? autoActionDelay : duration;
            progressBar.style.animation = `notify-flow-progress ${progressDuration}ms linear`;
            progressBar.style.transformOrigin = 'left';
        }

        // Gestion des événements
        if (dismissible) {
            notification.querySelector('.notify-flow-close').addEventListener('click', () => {
                this.remove(notification);
            });
        }

        // Gestion des actions
        actions.forEach(action => {
            const button = notification.querySelector(`[data-action="${action.id}"]`);
            if (button && action.callback) {
                button.addEventListener('click', () => {
                    action.callback();
                    if (action.dismiss !== false) this.remove(notification);
                });
            }
        });

        // Gestion de l'action automatique
        let autoActionTimer;
        if (autoAction) {
            let remainingTime = Math.ceil(autoActionDelay / 1000);
            const timerElement = notification.querySelector('.auto-action-timer');
            
            autoActionTimer = setInterval(() => {
                remainingTime--;
                if (timerElement) timerElement.textContent = `${remainingTime}s`;
                
                if (remainingTime <= 0) {
                    clearInterval(autoActionTimer);
                    const autoButton = notification.querySelector(`[data-action="${autoAction}"]`);
                    if (autoButton) autoButton.click();
                }
            }, 1000);
        }

        // Suppression automatique
        if (duration > 0 && !autoAction) {
            setTimeout(() => this.remove(notification), duration);
        }

        // Ajout au conteneur
        const container = document.querySelector(`.${this.config.containerClass}`);
        container.appendChild(notification);
        this.notifications.add(notification);

        // Animation d'entrée
        requestAnimationFrame(() => {
            notification.classList.add(this.config.animations.in);
        });

        return notification;
    }

    /**
     * Supprime une notification
     * @param {HTMLElement} notification - L'élément de notification à supprimer
     */
    remove(notification) {
        if (!notification || !this.notifications.has(notification)) return;

        notification.classList.add(this.config.animations.out);
        
        notification.addEventListener('animationend', () => {
            notification.remove();
            this.notifications.delete(notification);
        }, { once: true });
    }

    /**
     * Supprime toutes les notifications
     */
    clearAll() {
        this.notifications.forEach(notification => this.remove(notification));
    }

    /**
     * Raccourcis pour les types de notifications courants
     */
    success(message, title = '', options = {}) {
        return this.notify({ ...options, type: 'success', message, title });
    }

    info(message, title = '', options = {}) {
        return this.notify({ ...options, type: 'info', message, title });
    }

    warning(message, title = '', options = {}) {
        return this.notify({ ...options, type: 'warning', message, title });
    }

    error(message, title = '', options = {}) {
        return this.notify({ ...options, type: 'error', message, title });
    }

    /**
     * Notification d'avertissement avec style spécial
     * @param {string} message - Message de la notification
     * @param {string} title - Titre de la notification
     * @param {Object} options - Options supplémentaires
     */
    warningNotice(message, title = '', options = {}) {
        return this.notify({
            ...options,
            type: 'warningNotice',
            message,
            title,
            icon: '⚠️',
            duration: options.duration || 8000, // Durée plus longue par défaut
            dismissible: options.dismissible !== undefined ? options.dismissible : true,
            progress: options.progress !== undefined ? options.progress : true
        });
    }
}

// Export pour différents environnements
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotifyFlow;
} else if (typeof define === 'function' && define.amd) {
    define([], function() {
        return NotifyFlow;
    });
} else {
    window.NotifyFlow = NotifyFlow;
}
