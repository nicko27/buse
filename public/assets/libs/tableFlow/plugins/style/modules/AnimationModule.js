/**
 * Module d'animations pour le plugin Style
 * Gère les animations et transitions du tableau
 */
export class AnimationModule {
    constructor(plugin) {
        this.plugin = plugin;
        this.isInitialized = false;
        
        // État local
        this.state = {
            animations: new Map(),
            activeAnimations: new Map(),
            isProcessing: false,
            lastAnimation: null
        };
        
        // Cache pour les performances
        this.cache = {
            animationTimeout: null,
            lastAnimationTime: 0,
            styleSheets: new Map(),
            computedStyles: new Map()
        };
        
        // Lier les méthodes
        this._boundAnimationStartHandler = this.handleAnimationStart.bind(this);
        this._boundAnimationEndHandler = this.handleAnimationEnd.bind(this);
        this._boundReducedMotionHandler = this.handleReducedMotion.bind(this);
        
        // Media query pour les préférences de mouvement réduit
        this.reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    }

    async init() {
        if (this.isInitialized) {
            this.plugin.logger.warn('Module Animation déjà initialisé');
            return;
        }

        try {
            this.plugin.logger.info('Initialisation du module Animation');
            
            // Configurer les écouteurs d'événements
            this.setupEventListeners();
            
            // Charger les animations par défaut
            await this.loadDefaultAnimations();
            
            this.isInitialized = true;
            this.plugin.metrics.increment('animation_module_init');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_init');
            throw error;
        }
    }

    setupEventListeners() {
        try {
            // Événements d'animation
            const table = this.plugin.tableFlow.table;
            table.addEventListener('animationstart', this._boundAnimationStartHandler);
            table.addEventListener('animationend', this._boundAnimationEndHandler);
            
            // Écouter les préférences de mouvement réduit
            this.reducedMotionQuery.addEventListener('change', this._boundReducedMotionHandler);
            
            // Ajouter les attributs ARIA
            table.setAttribute('data-animated', 'false');
            
            this.plugin.metrics.increment('animation_event_listeners_setup');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_setup_listeners');
        }
    }

    async loadDefaultAnimations() {
        try {
            // Animation de fade
            const fadeAnimation = {
                name: 'fade',
                label: 'Fondu',
                keyframes: {
                    from: { opacity: 0 },
                    to: { opacity: 1 }
                },
                options: {
                    duration: 300,
                    easing: 'ease-in-out',
                    fillMode: 'forwards'
                },
                reducedMotion: {
                    duration: 0
                }
            };
            
            // Animation de slide
            const slideAnimation = {
                name: 'slide',
                label: 'Glissement',
                keyframes: {
                    from: { transform: 'translateY(-20px)', opacity: 0 },
                    to: { transform: 'translateY(0)', opacity: 1 }
                },
                options: {
                    duration: 300,
                    easing: 'ease-out',
                    fillMode: 'forwards'
                },
                reducedMotion: {
                    transform: 'none',
                    duration: 0
                }
            };
            
            // Animation de scale
            const scaleAnimation = {
                name: 'scale',
                label: 'Échelle',
                keyframes: {
                    from: { transform: 'scale(0.95)', opacity: 0 },
                    to: { transform: 'scale(1)', opacity: 1 }
                },
                options: {
                    duration: 300,
                    easing: 'ease-out',
                    fillMode: 'forwards'
                },
                reducedMotion: {
                    transform: 'none',
                    duration: 0
                }
            };
            
            // Animation de highlight
            const highlightAnimation = {
                name: 'highlight',
                label: 'Surbrillance',
                keyframes: {
                    '0%': { backgroundColor: 'transparent' },
                    '50%': { backgroundColor: 'rgba(33, 150, 243, 0.2)' },
                    '100%': { backgroundColor: 'transparent' }
                },
                options: {
                    duration: 1000,
                    easing: 'ease-in-out',
                    fillMode: 'forwards'
                },
                reducedMotion: {
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    duration: 0
                }
            };
            
            // Ajouter les animations
            await this.addAnimation(fadeAnimation);
            await this.addAnimation(slideAnimation);
            await this.addAnimation(scaleAnimation);
            await this.addAnimation(highlightAnimation);
            
            this.plugin.metrics.increment('animation_default_animations_loaded');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_load_default_animations');
        }
    }

    async handleAnimationStart(event) {
        if (!this.isInitialized) return;

        try {
            const { animationName, target } = event;
            const name = animationName.replace('tableflow-', '');
            
            // Déclencher le hook beforeAnimationStart
            const beforeResult = await this.plugin.tableFlow.hooks.trigger('beforeAnimationStart', {
                element: target,
                animation: name,
                event
            });
            
            if (beforeResult === false) return;
            
            // Mettre à jour l'état
            this.state.activeAnimations.set(target, name);
            target.setAttribute('data-animated', 'true');
            
            this.plugin.metrics.increment('animation_started');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_handle_start');
        }
    }

    async handleAnimationEnd(event) {
        if (!this.isInitialized) return;

        try {
            const { animationName, target } = event;
            const name = animationName.replace('tableflow-', '');
            
            // Déclencher le hook afterAnimationEnd
            await this.plugin.tableFlow.hooks.trigger('afterAnimationEnd', {
                element: target,
                animation: name,
                event
            });
            
            // Mettre à jour l'état
            this.state.activeAnimations.delete(target);
            target.setAttribute('data-animated', 'false');
            
            this.plugin.metrics.increment('animation_ended');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_handle_end');
        }
    }

    handleReducedMotion(event) {
        if (!this.isInitialized) return;

        try {
            const prefersReducedMotion = event.matches;
            
            // Mettre à jour toutes les animations actives
            this.state.activeAnimations.forEach((name, element) => {
                const animation = this.state.animations.get(name);
                if (animation && animation.reducedMotion) {
                    this.animate(element, name, {
                        ...animation.reducedMotion,
                        immediate: true
                    });
                }
            });
            
            this.plugin.metrics.increment('animation_reduced_motion_handled');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_handle_reduced_motion');
        }
    }

    async addAnimation(animation) {
        try {
            // Valider l'animation
            if (!this.isValidAnimation(animation)) {
                throw new Error(`Animation invalide : ${animation.name}`);
            }
            
            // Compiler les keyframes
            const styleSheet = this.compileKeyframes(animation);
            
            // Mettre en cache
            this.cache.styleSheets.set(animation.name, styleSheet);
            
            // Ajouter l'animation
            this.state.animations.set(animation.name, animation);
            
            // Enregistrer dans le DOM
            await this.registerAnimation(animation.name, styleSheet);
            
            this.plugin.metrics.increment('animation_added');
            return animation.name;
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_add_animation');
            return null;
        }
    }

    async registerAnimation(name, styleSheet) {
        try {
            const style = document.createElement('style');
            style.textContent = styleSheet;
            style.setAttribute('data-animation', name);
            document.head.appendChild(style);
            
            this.plugin.metrics.increment('animation_registered');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_register_animation');
        }
    }

    compileKeyframes(animation) {
        const keyframes = Object.entries(animation.keyframes)
            .map(([key, value]) => {
                const properties = Object.entries(value)
                    .map(([prop, val]) => `${prop}: ${val}`)
                    .join('; ');
                return `${key} { ${properties} }`;
            })
            .join('\n');

        return `
            @keyframes tableflow-${animation.name} {
                ${keyframes}
            }
        `;
    }

    isValidAnimation(animation) {
        return (
            animation &&
            typeof animation === 'object' &&
            typeof animation.name === 'string' &&
            typeof animation.label === 'string' &&
            animation.keyframes &&
            typeof animation.keyframes === 'object' &&
            animation.options &&
            typeof animation.options === 'object'
        );
    }

    async animate(element, name, options = {}) {
        if (!this.isInitialized || this.state.isProcessing) return;

        try {
            if (!this.state.animations.has(name)) {
                throw new Error(`Animation non trouvée : ${name}`);
            }
            
            const startTime = performance.now();
            this.state.isProcessing = true;
            
            // Vérifier les préférences de mouvement réduit
            const prefersReducedMotion = this.reducedMotionQuery.matches;
            const animation = this.state.animations.get(name);
            
            // Déclencher le hook beforeAnimate
            const beforeResult = await this.plugin.tableFlow.hooks.trigger('beforeAnimate', {
                element,
                animation: name,
                options
            });
            
            if (beforeResult === false) return;
            
            // Fusionner les options
            const mergedOptions = {
                ...animation.options,
                ...(prefersReducedMotion ? animation.reducedMotion : {}),
                ...options
            };
            
            // Appliquer l'animation
            element.style.animation = `tableflow-${name} ${mergedOptions.duration}ms ${mergedOptions.easing}`;
            element.style.animationFillMode = mergedOptions.fillMode || 'none';
            
            // Mettre à jour l'état
            this.state.lastAnimation = {
                element,
                name,
                options: mergedOptions,
                timestamp: Date.now()
            };
            
            // Déclencher le hook afterAnimate
            await this.plugin.tableFlow.hooks.trigger('afterAnimate', {
                element,
                animation: name,
                options: mergedOptions,
                performance: {
                    duration: performance.now() - startTime
                }
            });
            
            this.plugin.metrics.increment('animation_applied');
            this.plugin.metrics.record('animation_duration', performance.now() - startTime);
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_animate');
        } finally {
            this.state.isProcessing = false;
        }
    }

    getAnimation(name) {
        return this.state.animations.get(name) || null;
    }

    getActiveAnimations() {
        return new Map(this.state.activeAnimations);
    }

    async destroy() {
        if (!this.isInitialized) return;

        try {
            const table = this.plugin.tableFlow.table;
            
            // Supprimer les écouteurs d'événements
            table.removeEventListener('animationstart', this._boundAnimationStartHandler);
            table.removeEventListener('animationend', this._boundAnimationEndHandler);
            this.reducedMotionQuery.removeEventListener('change', this._boundReducedMotionHandler);
            
            // Supprimer les styles
            this.cache.styleSheets.forEach((_, name) => {
                const style = document.querySelector(`style[data-animation="${name}"]`);
                if (style) {
                    style.remove();
                }
            });
            
            // Nettoyer les animations en cours
            this.state.activeAnimations.forEach((name, element) => {
                element.style.animation = '';
                element.style.animationFillMode = '';
                element.setAttribute('data-animated', 'false');
            });
            
            // Nettoyer les attributs ARIA
            table.removeAttribute('data-animated');
            
            // Nettoyer l'état et le cache
            this.state.animations.clear();
            this.state.activeAnimations.clear();
            this.cache.styleSheets.clear();
            this.cache.computedStyles.clear();
            
            this.isInitialized = false;
            this.plugin.logger.info('Module Animation détruit');
            this.plugin.metrics.increment('animation_module_destroyed');
        } catch (error) {
            this.plugin.errorHandler.handle(error, 'animation_destroy');
        }
    }
} 