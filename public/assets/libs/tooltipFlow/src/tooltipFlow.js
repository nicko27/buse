// JavaScript code for tooltipFlow library
// This will handle tooltips by attribute and ID with a common initialization

class TooltipFlow {
    constructor(options = {}) {
        this.tooltips = new Map();
        this.activeTooltip = null;
        this.showTimeout = null;
        this.hideTimeout = null;
        this.defaultPosition = options.defaultPosition || 'top';
        this.margin = options.margin || 8;
        this.debug = options.debug || false;
        this.showDelay = options.showDelay || 0;
        this.hideDelay = options.hideDelay || 0;
        this.interactive = options.interactive || false;
        this.triggerMode = options.triggerMode || 'hover'; // 'hover', 'click', 'dblclick'
        this.log('TooltipFlow initialized with options:', options);
        this.attachEvents();
    }

    static init(options = {}) {
        if (!window.tooltipFlowInstance) {
            window.tooltipFlowInstance = new TooltipFlow(options);
        }
        return window.tooltipFlowInstance;
    }

    log(...args) {
        if (this.debug) {
            console.log('[TooltipFlow]', ...args);
        }
    }

    error(...args) {
        console.error('[TooltipFlow]', ...args);
    }

    createTooltipElement(content, theme, options = {}) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip';
        
        if (theme) {
            tooltip.setAttribute('data-theme', theme);
        }

        if (options.hideArrow) {
            tooltip.setAttribute('data-hide-arrow', 'true');
        }

        const innerContainer = document.createElement('div');
        innerContainer.className = 'tooltip-content';
        innerContainer.innerHTML = content;
        tooltip.appendChild(innerContainer);

        // Ajout temporaire au DOM pour calculer la largeur optimale
        tooltip.style.visibility = 'hidden';
        tooltip.style.position = 'fixed';
        tooltip.style.left = '-9999px';
        document.body.appendChild(tooltip);

        // Calcul de la largeur optimale
        const maxWidth = Math.min(400, window.innerWidth - 2 * this.margin); // Maximum 400px ou largeur de fenêtre - marges
        const minWidth = 60; // Largeur minimale pour les petits contenus
        
        // Reset de la largeur pour mesurer la largeur naturelle
        tooltip.style.width = 'auto';
        const naturalWidth = tooltip.offsetWidth;
        
        // Définition de la largeur finale
        const finalWidth = Math.max(minWidth, Math.min(naturalWidth, maxWidth));
        tooltip.style.width = `${finalWidth}px`;
        
        // Réinitialisation des styles temporaires
        tooltip.style.visibility = '';
        tooltip.style.position = '';
        tooltip.style.left = '';

        return tooltip;
    }

    calculateOptimalPosition(tooltip, target) {
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Calcul du centre de l'élément parent
        const targetCenter = targetRect.left + (targetRect.width / 2);

        // Positions possibles
        const positions = {
            top: {
                top: targetRect.top + scrollTop - tooltipRect.height - this.margin,
                left: targetCenter - (tooltipRect.width / 2)
            },
            bottom: {
                top: targetRect.top + targetRect.height + scrollTop + this.margin,
                left: targetCenter - (tooltipRect.width / 2)
            },
            left: {
                top: targetRect.top + scrollTop + (targetRect.height - tooltipRect.height) / 2,
                left: targetRect.left + scrollLeft - tooltipRect.width - this.margin
            },
            right: {
                top: targetRect.top + scrollTop + (targetRect.height - tooltipRect.height) / 2,
                left: targetRect.right + scrollLeft + this.margin
            }
        };

        // Calcul des scores
        const scores = {};
        Object.keys(positions).forEach(pos => {
            const coords = positions[pos];
            scores[pos] = 0;

            // Bonus pour la position par défaut
            if (pos === this.defaultPosition) {
                scores[pos] += 50;
            }

            // Vérification des débordements
            const overflow = {
                top: coords.top < scrollTop,
                bottom: coords.top + tooltipRect.height > scrollTop + windowHeight,
                left: coords.left < this.margin,
                right: coords.left + tooltipRect.width > windowWidth - this.margin
            };

            // Pénalités pour les débordements
            if (overflow.top) scores[pos] -= 120;
            if (overflow.bottom) scores[pos] -= 120;
            if (overflow.left) scores[pos] -= 100;
            if (overflow.right) scores[pos] -= 100;

            // Bonus pour le centrage parfait
            if (pos === 'top' || pos === 'bottom') {
                const centerOffset = Math.abs(targetCenter - (coords.left + tooltipRect.width / 2));
                scores[pos] -= centerOffset;
            }

            // Bonus pour la visibilité complète
            if (!overflow.top && !overflow.bottom && !overflow.left && !overflow.right) {
                scores[pos] += 75;
            }
        });

        // Sélection de la meilleure position
        let bestPosition = this.defaultPosition;
        let bestScore = scores[this.defaultPosition];
        Object.entries(scores).forEach(([pos, score]) => {
            if (score > bestScore) {
                bestScore = score;
                bestPosition = pos;
            }
        });

        // Ajustements finaux
        let finalCoords = {...positions[bestPosition]};

        // Ajustement horizontal avec contraintes de fenêtre
        finalCoords.left = Math.max(
            this.margin,
            Math.min(finalCoords.left, windowWidth - tooltipRect.width - this.margin)
        );

        // Calcul de l'offset de la flèche pour les positions top/bottom
        if (bestPosition === 'top' || bestPosition === 'bottom') {
            const idealCenter = targetCenter - scrollLeft;
            const actualCenter = finalCoords.left + (tooltipRect.width / 2);
            const arrowOffset = idealCenter - actualCenter;
            
            // Limiter l'offset de la flèche pour qu'elle reste dans les limites du tooltip
            const maxOffset = (tooltipRect.width / 2) - 20; // 20px de marge pour la flèche
            const limitedOffset = Math.max(-maxOffset, Math.min(maxOffset, arrowOffset));
            
            tooltip.style.setProperty('--arrow-offset', `${limitedOffset}px`);
        }

        // Ajustement vertical
        finalCoords.top = Math.max(
            scrollTop + this.margin,
            Math.min(finalCoords.top, scrollTop + windowHeight - tooltipRect.height - this.margin)
        );

        return { position: bestPosition, coordinates: finalCoords };
    }

    showTooltip(target, content, options = {}) {
        clearTimeout(this.hideTimeout);
        clearTimeout(this.showTimeout);

        const show = () => {
            if (this.activeTooltip) {
                this.hideTooltip(this.activeTooltip);
            }

            let tooltip = this.tooltips.get(target);
            
            if (!tooltip) {
                tooltip = this.createTooltipElement(content, options.theme, options);
                document.body.appendChild(tooltip);
                this.tooltips.set(target, tooltip);
                
                // Gestionnaires d'événements pour le tooltip
                if (this.interactive) {
                    tooltip.addEventListener('mouseenter', () => {
                        clearTimeout(this.hideTimeout);
                    });
                    
                    tooltip.addEventListener('mouseleave', () => {
                        this.hideTooltip(target);
                    });
                }
            }

            const { position, coordinates } = this.calculateOptimalPosition(tooltip, target);
            tooltip.style.top = `${coordinates.top}px`;
            tooltip.style.left = `${coordinates.left}px`;
            tooltip.setAttribute('data-position', position);
            tooltip.classList.add('visible');
            
            this.activeTooltip = target;
            this.log('Tooltip shown:', tooltip);
        };

        if (this.showDelay > 0) {
            this.showTimeout = setTimeout(show, this.showDelay);
        } else {
            show();
        }
    }

    hideTooltip(target) {
        clearTimeout(this.hideTimeout);
        clearTimeout(this.showTimeout);

        const hide = () => {
            const tooltip = this.tooltips.get(target);
            if (tooltip) {
                tooltip.classList.remove('visible');
                if (this.activeTooltip === target) {
                    this.activeTooltip = null;
                }
                this.log('Tooltip hidden:', tooltip);
            }
        };

        if (this.hideDelay > 0) {
            this.hideTimeout = setTimeout(hide, this.hideDelay);
        } else {
            hide();
        }
    }

    attachEvents() {
        document.addEventListener('mouseover', (e) => {
            if (this.triggerMode !== 'hover') return;
            
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                const content = target.getAttribute('data-tooltip');
                const theme = target.getAttribute('data-tooltip-theme');
                this.showTooltip(target, content, { theme });
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (this.triggerMode !== 'hover') return;
            
            const target = e.target.closest('[data-tooltip]');
            if (target && !this.interactive) {
                this.hideTooltip(target);
            }
        });

        document.addEventListener('click', (e) => {
            if (this.triggerMode !== 'click') return;
            
            const target = e.target.closest('[data-tooltip]');
            if (target) {
                const content = target.getAttribute('data-tooltip');
                const theme = target.getAttribute('data-tooltip-theme');
                
                if (this.activeTooltip === target) {
                    this.hideTooltip(target);
                } else {
                    this.showTooltip(target, content, { theme });
                }
            } else if (this.activeTooltip && !e.target.closest('.tooltip')) {
                this.hideTooltip(this.activeTooltip);
            }
        });
    }
}

// Création d'un namespace global
window.TooltipFlow = {
    init: function(options) {
        return TooltipFlow.init(options);
    }
};
