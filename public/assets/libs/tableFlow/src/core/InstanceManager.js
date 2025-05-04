import { TableInstance } from './TableInstance.js';
import { Logger } from '../utils/logger.js';

export class InstanceManager {
    constructor(config = {}) {
        this.instances = new Map();
        this.config = {
            debug: false,
            ...config
        };
        this.logger = new Logger('InstanceManager');

        this.debug = this.config.debug ? 
            (...args) => this.logger.debug(...args) : 
            () => {};

        // Handlers liés
        this._boundResizeHandler = this.handleResize.bind(this);
        this._boundKeydownHandler = this.handleKeydown.bind(this);
    }

    init() {
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', this._boundResizeHandler);
            document.addEventListener('keydown', this._boundKeydownHandler);
        }
    }

    handleResize() {
        this.instances.forEach(instance => {
            if (typeof instance.handleResize === 'function') {
                instance.handleResize();
            }
        });
    }

    handleKeydown(e) {
        this.instances.forEach(instance => {
            if (typeof instance.handleKeydown === 'function') {
                instance.handleKeydown(e);
            }
        });
    }

    createInstance(id, config) {
        if (!id) {
            throw new Error('ID requis pour créer une instance');
        }

        if (this.instances.has(id)) {
            throw new Error(`Une instance avec l'ID ${id} existe déjà`);
        }

        const instance = new TableInstance(id, config);
        this.instances.set(id, instance);
        this.logger.info(`Instance créée avec l'ID: ${id}`);
        return instance;
    }

    getInstance(id) {
        return this.instances.get(id);
    }

    removeInstance(id) {
        const instance = this.instances.get(id);
        if (instance) {
            instance.destroy();
            this.instances.delete(id);
            this.logger.info(`Instance supprimée avec l'ID: ${id}`);
        }
    }

    refreshAll() {
        this.instances.forEach(instance => {
            if (typeof instance.refresh === 'function') {
                instance.refresh();
            }
        });
    }

    destroy() {
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', this._boundResizeHandler);
            document.removeEventListener('keydown', this._boundKeydownHandler);
        }

        this.instances.forEach(instance => {
            instance.destroy();
        });
        this.instances.clear();
        this.logger.info('InstanceManager détruit');
    }
}

// Export de l'instance par défaut
export const instanceManager = new InstanceManager(); 