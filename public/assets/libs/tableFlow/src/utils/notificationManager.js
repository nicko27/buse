import { Logger } from './logger.js';

export class NotificationManager {
    constructor(config = {}) {
        this.logger = new Logger('NotificationManager');
        this.config = {
            position: 'top-right',
            duration: 5000,
            maxNotifications: 5,
            ...config
        };
        this.notifications = new Map();
        this.container = null;
        this.setupContainer();
    }

    setupContainer() {
        this.container = document.createElement('div');
        this.container.className = 'tableflow-notifications';
        this.container.style.cssText = `
            position: fixed;
            ${this.config.position.split('-')[0]}: 20px;
            ${this.config.position.split('-')[1]}: 20px;
            z-index: 9999;
            max-width: 350px;
        `;
        document.body.appendChild(this.container);
    }

    show(message, type = 'info', options = {}) {
        const id = Date.now().toString();
        const notification = document.createElement('div');
        notification.className = `tableflow-notification tableflow-notification-${type}`;
        notification.style.cssText = `
            background: ${this.getBackgroundColor(type)};
            color: white;
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 4px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
        `;

        const content = document.createElement('div');
        content.textContent = message;
        notification.appendChild(content);

        if (options.duration !== 0) {
            setTimeout(() => this.remove(id), options.duration || this.config.duration);
        }

        this.notifications.set(id, notification);
        this.container.appendChild(notification);

        // Limiter le nombre de notifications
        while (this.notifications.size > this.config.maxNotifications) {
            const oldestId = this.notifications.keys().next().value;
            this.remove(oldestId);
        }

        return id;
    }

    remove(id) {
        const notification = this.notifications.get(id);
        if (notification) {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                notification.remove();
                this.notifications.delete(id);
            }, 300);
        }
    }

    getBackgroundColor(type) {
        const colors = {
            info: '#2196F3',
            success: '#4CAF50',
            warning: '#FFC107',
            error: '#F44336'
        };
        return colors[type] || colors.info;
    }

    destroy() {
        this.notifications.forEach((_, id) => this.remove(id));
        this.container.remove();
    }
} 