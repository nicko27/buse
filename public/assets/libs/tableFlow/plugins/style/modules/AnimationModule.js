/**
 * Module d'animations pour le plugin Style
 */
export class AnimationModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.animations = new Map();
    }

    /**
     * Initialise le module
     * @returns {Promise<void>}
     */
    async init() {
        this.loadDefaultAnimations();
    }

    /**
     * Charge les animations par défaut
     */
    loadDefaultAnimations() {
        // Animation de fade
        this.addAnimation('fade', {
            keyframes: {
                from: { opacity: 0 },
                to: { opacity: 1 }
            },
            options: {
                duration: 300,
                easing: 'ease-in-out'
            }
        });

        // Animation de slide
        this.addAnimation('slide', {
            keyframes: {
                from: { transform: 'translateY(-20px)', opacity: 0 },
                to: { transform: 'translateY(0)', opacity: 1 }
            },
            options: {
                duration: 300,
                easing: 'ease-out'
            }
        });

        // Animation de scale
        this.addAnimation('scale', {
            keyframes: {
                from: { transform: 'scale(0.95)', opacity: 0 },
                to: { transform: 'scale(1)', opacity: 1 }
            },
            options: {
                duration: 300,
                easing: 'ease-out'
            }
        });
    }

    /**
     * Ajoute une animation
     * @param {string} name - Nom de l'animation
     * @param {Object} animation - Configuration de l'animation
     */
    addAnimation(name, animation) {
        this.animations.set(name, animation);
        this.registerAnimation(name, animation);
    }

    /**
     * Enregistre une animation dans le DOM
     * @param {string} name - Nom de l'animation
     * @param {Object} animation - Configuration de l'animation
     */
    registerAnimation(name, animation) {
        const style = document.createElement('style');
        const keyframes = Object.entries(animation.keyframes)
            .map(([key, value]) => {
                const properties = Object.entries(value)
                    .map(([prop, val]) => `${prop}: ${val}`)
                    .join('; ');
                return `${key} { ${properties} }`;
            })
            .join('\n');

        style.textContent = `
            @keyframes tableflow-${name} {
                ${keyframes}
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * Applique une animation à un élément
     * @param {HTMLElement} element - Élément à animer
     * @param {string} name - Nom de l'animation
     * @param {Object} [options] - Options supplémentaires
     */
    animate(element, name, options = {}) {
        if (!this.animations.has(name)) {
            throw new Error(`Animation "${name}" not found`);
        }

        const animation = this.animations.get(name);
        const mergedOptions = {
            ...animation.options,
            ...options
        };

        element.style.animation = `tableflow-${name} ${mergedOptions.duration}ms ${mergedOptions.easing}`;
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.animations.clear();
    }
} 