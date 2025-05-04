export class StyleManager {
    constructor(options = {}) {
        this.options = {
            useCSSVariables: true,
            batchUpdates: true,
            animationFrame: true,
            ...options
        };

        this.styles = new Map();
        this.styleSheet = null;
        this.batchQueue = new Map();
        this.animationFrame = null;
        this.cssVariables = new Map();
    }

    /**
     * Initialise le gestionnaire de styles
     */
    init() {
        // Créer une feuille de style
        this.styleSheet = document.createElement('style');
        document.head.appendChild(this.styleSheet);

        // Initialiser les variables CSS
        if (this.options.useCSSVariables) {
            this.initCSSVariables();
        }
    }

    /**
     * Initialise les variables CSS
     */
    initCSSVariables() {
        const root = document.documentElement;
        this.cssVariables.forEach((value, name) => {
            root.style.setProperty(`--${name}`, value);
        });
    }

    /**
     * Définit une variable CSS
     * @param {string} name - Nom de la variable
     * @param {string} value - Valeur de la variable
     */
    setVariable(name, value) {
        this.cssVariables.set(name, value);
        if (this.options.useCSSVariables) {
            document.documentElement.style.setProperty(`--${name}`, value);
        }
    }

    /**
     * Récupère une variable CSS
     * @param {string} name - Nom de la variable
     * @returns {string} Valeur de la variable
     */
    getVariable(name) {
        return this.cssVariables.get(name);
    }

    /**
     * Applique des styles à un élément
     * @param {Element} element - Élément à styliser
     * @param {Object} styles - Styles à appliquer
     * @param {Object} options - Options d'application
     * @param {boolean} [options.transition] - Activer la transition
     * @param {number} [options.duration] - Durée de la transition
     */
    apply(element, styles, options = {}) {
        if (this.options.batchUpdates) {
            this.queueUpdate(element, styles, options);
        } else {
            this.applyImmediate(element, styles, options);
        }
    }

    /**
     * Met en file d'attente une mise à jour de style
     * @param {Element} element - Élément à styliser
     * @param {Object} styles - Styles à appliquer
     * @param {Object} options - Options d'application
     */
    queueUpdate(element, styles, options) {
        if (!this.batchQueue.has(element)) {
            this.batchQueue.set(element, { styles: {}, options: {} });
        }

        const update = this.batchQueue.get(element);
        Object.assign(update.styles, styles);
        Object.assign(update.options, options);

        this.scheduleBatchUpdate();
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
        for (const [element, { styles, options }] of this.batchQueue) {
            this.applyImmediate(element, styles, options);
        }
        this.batchQueue.clear();
        this.animationFrame = null;
    }

    /**
     * Applique immédiatement des styles
     * @param {Element} element - Élément à styliser
     * @param {Object} styles - Styles à appliquer
     * @param {Object} options - Options d'application
     */
    applyImmediate(element, styles, options) {
        if (options.transition) {
            this.setupTransition(element, options);
        }

        Object.assign(element.style, styles);
    }

    /**
     * Configure une transition
     * @param {Element} element - Élément à animer
     * @param {Object} options - Options de transition
     */
    setupTransition(element, options) {
        const duration = options.duration || 300;
        element.style.transition = `all ${duration}ms ease-in-out`;
    }

    /**
     * Crée une animation
     * @param {string} name - Nom de l'animation
     * @param {Object} keyframes - Keyframes de l'animation
     * @param {Object} options - Options de l'animation
     */
    createAnimation(name, keyframes, options = {}) {
        const animation = `@keyframes ${name} { ${this.formatKeyframes(keyframes)} }`;
        this.styleSheet.textContent += animation;
    }

    /**
     * Formate les keyframes
     * @param {Object} keyframes - Keyframes à formater
     * @returns {string} Keyframes formatés
     */
    formatKeyframes(keyframes) {
        return Object.entries(keyframes)
            .map(([key, value]) => `${key} { ${this.formatStyles(value)} }`)
            .join(' ');
    }

    /**
     * Formate les styles
     * @param {Object} styles - Styles à formater
     * @returns {string} Styles formatés
     */
    formatStyles(styles) {
        return Object.entries(styles)
            .map(([key, value]) => `${this.camelToKebab(key)}: ${value};`)
            .join(' ');
    }

    /**
     * Convertit un nom en camelCase en kebab-case
     * @param {string} str - Chaîne à convertir
     * @returns {string} Chaîne convertie
     */
    camelToKebab(str) {
        return str.replace(/([A-Z])/g, '-$1').toLowerCase();
    }

    /**
     * Nettoie le gestionnaire de styles
     */
    destroy() {
        if (this.styleSheet) {
            document.head.removeChild(this.styleSheet);
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        this.styles.clear();
        this.batchQueue.clear();
        this.cssVariables.clear();
    }
} 