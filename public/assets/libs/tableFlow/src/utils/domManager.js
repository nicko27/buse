import { Logger } from './logger.js';
import { EventBus } from './eventBus.js';

export class VirtualDomManager {
    constructor(options = {}) {
        this.logger = new Logger('VirtualDomManager');
        this.eventBus = new EventBus();
        this.options = {
            batchUpdates: true,
            mutationObservation: true,
            virtualScrolling: true,
            ...options
        };

        this.virtualNodes = new Map();
        this.batchQueue = new Map();
        this.observer = null;
        this.animationFrame = null;

        if (this.options.mutationObservation) {
            this.init();
        }

        this.logger.info('VirtualDomManager initialisé');
    }

    /**
     * Initialise le gestionnaire de DOM
     */
    init() {
        if (this.options.mutationObservation) {
            this.observer = new MutationObserver(this.handleMutations.bind(this));
            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'style']
            });
        }
    }

    /**
     * Gère les mutations du DOM
     * @param {Array<MutationRecord>} mutations - Liste des mutations
     */
    handleMutations(mutations) {
        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                this.handleChildListMutation(mutation);
            } else if (mutation.type === 'attributes') {
                this.handleAttributeMutation(mutation);
            }
        }
    }

    /**
     * Gère les mutations de la liste des enfants
     * @param {MutationRecord} mutation - Mutation à traiter
     */
    handleChildListMutation(mutation) {
        for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                this.virtualNodes.set(node, this.createVirtualNode(node));
            }
        }

        for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                this.virtualNodes.delete(node);
                this.renderedNodes.delete(node);
            }
        }
    }

    /**
     * Gère les mutations d'attributs
     * @param {MutationRecord} mutation - Mutation à traiter
     */
    handleAttributeMutation(mutation) {
        const node = mutation.target;
        if (this.virtualNodes.has(node)) {
            const virtualNode = this.virtualNodes.get(node);
            virtualNode.attributes[mutation.attributeName] = node.getAttribute(mutation.attributeName);
        }
    }

    /**
     * Crée un nœud virtuel
     * @param {Element} element - Élément à virtualiser
     * @returns {Object} Nœud virtuel
     */
    createVirtualNode(element) {
        return {
            type: element.tagName.toLowerCase(),
            attributes: this.getAttributes(element),
            children: Array.from(element.children).map(child => this.createVirtualNode(child)),
            text: element.textContent
        };
    }

    /**
     * Récupère les attributs d'un élément
     * @param {Element} element - Élément à analyser
     * @returns {Object} Attributs de l'élément
     */
    getAttributes(element) {
        const attributes = {};
        for (const attr of element.attributes) {
            attributes[attr.name] = attr.value;
        }
        return attributes;
    }

    /**
     * Met à jour le DOM de manière optimisée
     * @param {Element} element - Élément à mettre à jour
     * @param {Object} updates - Mises à jour à appliquer
     */
    update(element, updates) {
        if (this.options.batchUpdates) {
            this.batchQueue.push({ element, updates });
            this.scheduleBatchUpdate();
        } else {
            this.applyUpdates(element, updates);
        }
    }

    /**
     * Planifie une mise à jour par lots
     */
    scheduleBatchUpdate() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.animationFrame = requestAnimationFrame(() => {
            this.processBatchQueue();
        });
    }

    /**
     * Traite la file d'attente des mises à jour
     */
    processBatchQueue() {
        const updates = new Map();
        
        // Regrouper les mises à jour par élément
        for (const { element, updates: elementUpdates } of this.batchQueue) {
            if (!updates.has(element)) {
                updates.set(element, {});
            }
            Object.assign(updates.get(element), elementUpdates);
        }

        // Appliquer les mises à jour
        for (const [element, elementUpdates] of updates) {
            this.applyUpdates(element, elementUpdates);
        }

        this.batchQueue = new Map();
        this.animationFrame = null;
    }

    /**
     * Applique les mises à jour à un élément
     * @param {Element} element - Élément à mettre à jour
     * @param {Object} updates - Mises à jour à appliquer
     */
    applyUpdates(element, updates) {
        for (const [key, value] of Object.entries(updates)) {
            if (key === 'style') {
                Object.assign(element.style, value);
            } else if (key === 'class') {
                element.className = value;
            } else if (key === 'text') {
                element.textContent = value;
            } else {
                element.setAttribute(key, value);
            }
        }
    }

    /**
     * Nettoie le gestionnaire de DOM
     */
    destroy() {
        if (this.observer) {
            this.observer.disconnect();
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.virtualNodes.clear();
        this.renderedNodes.clear();
    }
} 