/**
 * TooltipFlow - Gestionnaire moderne de tooltips
 * @author Codeium
 * @version 1.1.1
 */
class TooltipFlow {
    constructor(config = {}) {
        this.config = {
            defaultPosition: config.defaultPosition || 'top',
            theme: config.theme || 'light',
            animation: config.animation || 'fade',
            showDelay: config.showDelay || 200,
            hideDelay: config.hideDelay || 200,
            offset: config.offset || 8,
            maxWidth: config.maxWidth || 300,
            interactive: config.interactive || false,
            allowHTML: config.allowHTML || false,
            zIndex: config.zIndex || 9999,
            className: config.className || '',
            appendTo: config.appendTo || document.body,
            debug: config.debug || false
        };

        this.activeTooltips = new Map();
        this.eventListeners = new WeakMap();
        this.observer = null;
        
        if (this.config.debug) {
            console.log('TooltipFlow initialized with config:', this.config);
        }
        
        this.init();
    }

    /**
     * Log de debug
     * @private
     */
    debugLog(message, ...args) {
        if (this.config.debug) {
            console.log(`[TooltipFlow] ${message}`, ...args);
        }
    }

    /**
     * Initialise le gestionnaire de tooltips
     * @private
     */
    init() {
        this.debugLog('Initializing TooltipFlow');
        
        // Initialise l'observateur pour gérer les éléments dynamiques
        this.observer = new MutationObserver(this.handleDomChanges.bind(this));
        this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['data-tooltip', 'tf-tooltip', 'data-tooltip-content', 'tf-tooltip-content']
        });

        this.debugLog('MutationObserver initialized');

        // Initialise les tooltips existants
        this.initializeTooltips();

        // Gestion du thème système
        if (this.config.theme === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            this.handleThemeChange(mediaQuery);
            mediaQuery.addListener(this.handleThemeChange.bind(this));
            this.debugLog('Theme auto-detection enabled');
        }
    }

    /**
     * Récupère la valeur d'un attribut en vérifiant les deux préfixes
     * @private
     */
    getAttribute(element, name, withoutPrefix = false) {
        const prefixes = withoutPrefix ? [''] : ['data-tooltip-', 'tf-'];
        for (const prefix of prefixes) {
            const value = element.getAttribute(prefix + name);
            if (value !== null) {
                this.debugLog(`Found attribute ${prefix}${name} with value:`, value);
                return value;
            }
        }
        this.debugLog(`No attribute found for ${name}`);
        return null;
    }

    /**
     * Vérifie si un élément a un attribut tooltip
     * @private
     */
    hasTooltipAttribute(element) {
        const hasAttribute = element.hasAttribute('data-tooltip') || 
                           element.hasAttribute('tf-tooltip') ||
                           element.hasAttribute('data-tooltip-content') ||
                           element.hasAttribute('tf-tooltip-content');
        
        if (hasAttribute) {
            this.debugLog('Found tooltip attribute on element:', element);
        }
        
        return hasAttribute;
    }

    /**
     * Initialise les tooltips sur les éléments existants
     * @private
     */
    initializeTooltips() {
        const selectors = [
            '[data-tooltip]',
            '[tf-tooltip]',
            '[data-tooltip-content]',
            '[tf-tooltip-content]'
        ];
        const elements = document.querySelectorAll(selectors.join(','));
        this.debugLog(`Found ${elements.length} elements with tooltip attributes`);
        
        elements.forEach(element => this.bindTooltipEvents(element));
    }

    /**
     * Attache les événements à un élément
     * @private
     */
    bindTooltipEvents(element) {
        if (this.eventListeners.has(element)) {
            this.debugLog('Events already bound for element:', element);
            return;
        }

        this.debugLog('Binding events for element:', element);

        const listeners = {
            mouseenter: () => this.show(element),
            mouseleave: () => this.hide(element),
            focus: () => this.show(element),
            blur: () => this.hide(element),
            click: () => {
                if (this.getAttribute(element, 'toggle', true) !== null) {
                    this.toggle(element);
                }
            }
        };

        Object.entries(listeners).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
            this.debugLog(`Added ${event} listener`);
        });

        this.eventListeners.set(element, listeners);
    }

    /**
     * Récupère le contenu du tooltip
     * @private
     */
    getTooltipContent(element) {
        // Vérifie d'abord le contenu HTML référencé
        const contentId = this.getAttribute(element, 'content');
        if (contentId) {
            const contentElement = document.querySelector(contentId);
            if (contentElement) {
                this.debugLog('Using HTML content from element:', contentId);
                return contentElement.innerHTML;
            }
        }

        // Sinon utilise l'attribut tooltip direct
        const content = element.getAttribute('data-tooltip') || 
                       element.getAttribute('tf-tooltip') || 
                       this.getAttribute(element, 'tooltip', true) || '';
        
        if (content) {
            this.debugLog('Using direct tooltip content:', content);
        } else {
            this.debugLog('No tooltip content found');
        }
        
        return content;
    }

    /**
     * Crée l'élément tooltip
     * @private
     */
    createTooltipElement(content, theme, element) {
        const tooltip = document.createElement('div');
        tooltip.className = `tooltip-flow ${theme} ${this.config.className}`;
        tooltip.setAttribute('role', 'tooltip');
        tooltip.style.zIndex = this.config.zIndex;
        tooltip.style.maxWidth = `${this.config.maxWidth}px`;

        const arrow = document.createElement('div');
        arrow.className = 'tooltip-flow-arrow';
        tooltip.appendChild(arrow);

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'tooltip-flow-content';
        
        if (this.config.allowHTML || this.getAttribute(element, 'content')) {
            contentWrapper.innerHTML = content;
        } else {
            contentWrapper.textContent = content;
        }
        
        tooltip.appendChild(contentWrapper);

        return tooltip;
    }

    /**
     * Positionne le tooltip
     * @private
     */
    positionTooltip(element, tooltip, position) {
        const elementRect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const arrow = tooltip.querySelector('.tooltip-flow-arrow');

        let { top, left } = this.calculatePosition(elementRect, tooltipRect, position);

        // Ajuste la position si le tooltip dépasse de l'écran
        const overflow = this.checkOverflow(top, left, tooltipRect);
        if (overflow.any) {
            const newPosition = this.findBestPosition(elementRect, tooltipRect);
            ({ top, left } = this.calculatePosition(elementRect, tooltipRect, newPosition));
            position = newPosition;
        }

        // Positionne le tooltip
        tooltip.style.top = `${top + window.scrollY}px`;
        tooltip.style.left = `${left + window.scrollX}px`;

        // Positionne la flèche
        this.positionArrow(arrow, position, elementRect, tooltipRect);

        // Applique la classe de position
        tooltip.setAttribute('data-position', position);
    }

    /**
     * Calcule la position initiale du tooltip
     * @private
     */
    calculatePosition(elementRect, tooltipRect, position) {
        const offset = this.config.offset;
        let top, left;

        switch (position) {
            case 'top':
                top = elementRect.top - tooltipRect.height - offset;
                left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'bottom':
                top = elementRect.bottom + offset;
                left = elementRect.left + (elementRect.width / 2) - (tooltipRect.width / 2);
                break;
            case 'left':
                top = elementRect.top + (elementRect.height / 2) - (tooltipRect.height / 2);
                left = elementRect.left - tooltipRect.width - offset;
                break;
            case 'right':
                top = elementRect.top + (elementRect.height / 2) - (tooltipRect.height / 2);
                left = elementRect.right + offset;
                break;
        }

        return { top, left };
    }

    /**
     * Vérifie si le tooltip dépasse de l'écran
     * @private
     */
    checkOverflow(top, left, tooltipRect) {
        const overflow = {
            top: top < 0,
            bottom: top + tooltipRect.height > window.innerHeight,
            left: left < 0,
            right: left + tooltipRect.width > window.innerWidth,
            any: false
        };
        overflow.any = overflow.top || overflow.bottom || overflow.left || overflow.right;
        return overflow;
    }

    /**
     * Trouve la meilleure position pour le tooltip
     * @private
     */
    findBestPosition(elementRect, tooltipRect) {
        const positions = ['top', 'bottom', 'left', 'right'];
        const scores = positions.map(position => {
            const { top, left } = this.calculatePosition(elementRect, tooltipRect, position);
            const overflow = this.checkOverflow(top, left, tooltipRect);
            return {
                position,
                score: Object.values(overflow).filter(Boolean).length
            };
        });

        return scores.sort((a, b) => a.score - b.score)[0].position;
    }

    /**
     * Positionne la flèche du tooltip
     * @private
     */
    positionArrow(arrow, position, elementRect, tooltipRect) {
        const arrowSize = 8;
        switch (position) {
            case 'top':
                arrow.style.bottom = `-${arrowSize}px`;
                arrow.style.left = '50%';
                break;
            case 'bottom':
                arrow.style.top = `-${arrowSize}px`;
                arrow.style.left = '50%';
                break;
            case 'left':
                arrow.style.right = `-${arrowSize}px`;
                arrow.style.top = '50%';
                break;
            case 'right':
                arrow.style.left = `-${arrowSize}px`;
                arrow.style.top = '50%';
                break;
        }
    }

    /**
     * Affiche le tooltip
     * @public
     */
    show(element) {
        // Cacher tous les tooltips actifs avant d'en afficher un nouveau
        this.activeTooltips.forEach((tooltip, el) => {
            if (el !== element) {
                this.hide(el);
            }
        });

        if (this.activeTooltips.has(element)) {
            this.debugLog('Tooltip already active for element:', element);
            return;
        }

        const content = this.getTooltipContent(element);
        if (!content) {
            this.debugLog('No content to show for tooltip');
            return;
        }

        this.debugLog('Showing tooltip for element:', element);

        const showTooltip = () => {
            const position = this.getAttribute(element, 'position') || this.config.defaultPosition;
            const theme = this.getAttribute(element, 'theme') || this.config.theme;

            this.debugLog(`Creating tooltip with position: ${position}, theme: ${theme}`);

            const tooltip = this.createTooltipElement(content, theme, element);
            this.config.appendTo.appendChild(tooltip);

            // Positionne le tooltip
            this.positionTooltip(element, tooltip, position);

            // Ajoute la classe d'animation
            requestAnimationFrame(() => {
                tooltip.classList.add('tooltip-flow-visible');
                tooltip.classList.add(`tooltip-flow-${this.config.animation}`);
                this.debugLog('Tooltip animation started');
            });

            this.activeTooltips.set(element, tooltip);

            // Gestion interactive
            if (this.config.interactive) {
                this.debugLog('Adding interactive handlers');
                tooltip.addEventListener('mouseenter', () => {
                    if (this.activeTooltips.has(element)) {
                        clearTimeout(this.activeTooltips.get(element).hideTimeout);
                        this.debugLog('Cleared hide timeout (interactive)');
                    }
                });

                tooltip.addEventListener('mouseleave', () => {
                    this.hide(element);
                });
            }
        };

        // Applique le délai d'affichage
        if (this.config.showDelay > 0) {
            this.debugLog(`Showing tooltip with delay: ${this.config.showDelay}ms`);
            setTimeout(showTooltip, this.config.showDelay);
        } else {
            showTooltip();
        }
    }

    /**
     * Cache le tooltip
     * @public
     */
    hide(element) {
        const tooltip = this.activeTooltips.get(element);
        if (!tooltip) {
            this.debugLog('No active tooltip to hide');
            return;
        }

        this.debugLog('Hiding tooltip for element:', element);

        const hideTooltip = () => {
            tooltip.classList.remove('tooltip-flow-visible');
            tooltip.addEventListener('transitionend', () => {
                if (tooltip.parentNode) {
                    tooltip.remove();
                    this.debugLog('Tooltip removed from DOM');
                }
                this.activeTooltips.delete(element);
            }, { once: true });
        };

        // Applique le délai de masquage
        if (this.config.hideDelay > 0) {
            this.debugLog(`Hiding tooltip with delay: ${this.config.hideDelay}ms`);
            tooltip.hideTimeout = setTimeout(hideTooltip, this.config.hideDelay);
        } else {
            hideTooltip();
        }
    }

    /**
     * Bascule l'affichage du tooltip
     * @public
     */
    toggle(element) {
        if (this.activeTooltips.has(element)) {
            this.hide(element);
        } else {
            this.show(element);
        }
    }

    /**
     * Met à jour le contenu d'un tooltip
     * @public
     */
    updateContent(element, content) {
        element.setAttribute('data-tooltip', content);
        if (this.activeTooltips.has(element)) {
            const tooltip = this.activeTooltips.get(element);
            const contentWrapper = tooltip.querySelector('.tooltip-flow-content');
            if (this.config.allowHTML) {
                contentWrapper.innerHTML = content;
            } else {
                contentWrapper.textContent = content;
            }
            this.positionTooltip(element, tooltip, tooltip.getAttribute('data-position'));
        }
    }

    /**
     * Gère les changements dans le DOM
     * @private
     */
    handleDomChanges(mutations) {
        mutations.forEach(mutation => {
            // Nouveaux éléments
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1 && this.hasTooltipAttribute(node)) {
                    this.bindTooltipEvents(node);
                }
            });

            // Éléments supprimés
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === 1 && this.activeTooltips.has(node)) {
                    this.hide(node);
                }
            });

            // Attributs modifiés
            if (mutation.type === 'attributes' && (mutation.attributeName === 'data-tooltip' || mutation.attributeName === 'tf-tooltip')) {
                const element = mutation.target;
                if (this.hasTooltipAttribute(element)) {
                    this.bindTooltipEvents(element);
                } else if (this.activeTooltips.has(element)) {
                    this.hide(element);
                }
            }
        });
    }

    /**
     * Gère le changement de thème système
     * @private
     */
    handleThemeChange(e) {
        document.querySelectorAll('.tooltip-flow').forEach(tooltip => {
            tooltip.classList.toggle('dark', e.matches);
            tooltip.classList.toggle('light', !e.matches);
        });
    }

    /**
     * Détruit une instance de tooltip
     * @public
     */
    destroy(element) {
        if (this.eventListeners.has(element)) {
            const listeners = this.eventListeners.get(element);
            Object.entries(listeners).forEach(([event, handler]) => {
                element.removeEventListener(event, handler);
            });
            this.eventListeners.delete(element);
        }

        if (this.activeTooltips.has(element)) {
            this.hide(element);
        }
    }

    /**
     * Détruit toutes les instances de tooltip
     * @public
     */
    destroyAll() {
        document.querySelectorAll('[data-tooltip], [tf-tooltip]').forEach(element => {
            this.destroy(element);
        });
        this.observer.disconnect();
    }
}

// Export pour différents environnements
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TooltipFlow;
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return TooltipFlow; });
} else {
    window.TooltipFlow = TooltipFlow;
}
