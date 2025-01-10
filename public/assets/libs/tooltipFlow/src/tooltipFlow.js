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

        document.body.appendChild(tooltip);
        return tooltip;
    }

    calculateOptimalPosition(tooltip, target) {
        const targetRect = target.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        const windowWidth = window.innerWidth;
        const windowHeight = window.innerHeight;
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

        // Positions possibles
        const positions = {
            top: {
                top: targetRect.top + scrollTop - tooltipRect.height - this.margin,
                left: targetRect.left + scrollLeft + (targetRect.width - tooltipRect.width) / 2
            },
            bottom: {
                top: targetRect.bottom + scrollTop + this.margin,
                left: targetRect.left + scrollLeft + (targetRect.width - tooltipRect.width) / 2
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

            // Score de base pour la position par défaut
            if (pos === this.defaultPosition) {
                scores[pos] += 50;
            }

            // Vérification des débordements
            const overflow = {
                top: coords.top < scrollTop,
                bottom: coords.top + tooltipRect.height > scrollTop + windowHeight,
                left: coords.left < 0,
                right: coords.left + tooltipRect.width > windowWidth
            };

            // Pénalités pour les débordements
            if (overflow.top) scores[pos] -= 100;
            if (overflow.bottom) scores[pos] -= 100;
            if (overflow.left) scores[pos] -= 100;
            if (overflow.right) scores[pos] -= 100;

            // Bonus pour la visibilité complète
            if (!overflow.top && !overflow.bottom && !overflow.left && !overflow.right) {
                scores[pos] += 75;
            }

            // Bonus pour la proximité du centre de l'écran
            const centerX = windowWidth / 2;
            const centerY = (windowHeight / 2) + scrollTop;
            const distanceToCenter = Math.sqrt(
                Math.pow(coords.left + (tooltipRect.width / 2) - centerX, 2) +
                Math.pow(coords.top + (tooltipRect.height / 2) - centerY, 2)
            );
            scores[pos] -= distanceToCenter * 0.1;
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

        // Ajustement horizontal
        finalCoords.left = Math.max(
            this.margin,
            Math.min(finalCoords.left, windowWidth - tooltipRect.width - this.margin)
        );

        // Ajustement vertical
        finalCoords.top = Math.max(
            scrollTop + this.margin,
            Math.min(finalCoords.top, scrollTop + windowHeight - tooltipRect.height - this.margin)
        );

        return { position: bestPosition, coordinates: finalCoords };
    }

    showTooltip(target) {
        // Annuler tous les timeouts en cours
        if (this.showTimeout) clearTimeout(this.showTimeout);
        if (this.hideTimeout) clearTimeout(this.hideTimeout);

        // Masquer immédiatement le tooltip actif s'il existe
        if (this.activeTooltip && this.activeTooltip !== this.tooltips.get(target)) {
            this.activeTooltip.classList.remove('visible');
            this.activeTooltip = null;
        }

        this.showTimeout = setTimeout(() => {
            // Vérifier si un autre tooltip n'a pas été déclenché entre temps
            if (this.activeTooltip && this.activeTooltip !== this.tooltips.get(target)) {
                return;
            }

            let tooltipContent;
            const tooltipId = target.getAttribute('data-tooltip-id');
            const hideArrow = target.getAttribute('data-tooltip-hide-arrow') === 'true';
            
            if (tooltipId) {
                const tooltipElement = document.getElementById(tooltipId);
                if (tooltipElement) {
                    tooltipContent = tooltipElement.innerHTML;
                } else {
                    this.error(`Tooltip element with id "${tooltipId}" not found`);
                    return;
                }
            } else {
                tooltipContent = target.getAttribute('data-tooltip');
                if (!tooltipContent) {
                    this.error('No tooltip content found');
                    return;
                }
            }

            let tooltip = this.tooltips.get(target);
            if (!tooltip) {
                tooltip = this.createTooltipElement(tooltipContent, target.getAttribute('data-theme'), {
                    hideArrow: hideArrow
                });
                this.tooltips.set(target, tooltip);
            }

            const { position, coordinates } = this.calculateOptimalPosition(tooltip, target);
            
            tooltip.style.top = `${coordinates.top}px`;
            tooltip.style.left = `${coordinates.left}px`;
            tooltip.setAttribute('data-position', position);

            tooltip.classList.add('visible');
            this.activeTooltip = tooltip;

            this.log('Showing tooltip:', { target, position, coordinates });
        }, this.showDelay);
    }

    hideTooltip(target) {
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }

        this.hideTimeout = setTimeout(() => {
            const tooltip = target instanceof Element ? this.tooltips.get(target) : target;
            
            if (tooltip) {
                tooltip.classList.remove('visible');
                if (tooltip === this.activeTooltip) {
                    this.activeTooltip = null;
                }
            }
        }, this.hideDelay);
    }

    attachEvents() {
        document.addEventListener('mouseover', (e) => {
            const target = e.target.closest('[data-tooltip], [data-tooltip-id]');
            if (!target) return;

            const triggerMode = target.getAttribute('data-tooltip-trigger') || this.triggerMode;
            if (triggerMode === 'hover') {
                this.showTooltip(target);
            }
        });

        document.addEventListener('mouseout', (e) => {
            const target = e.target.closest('[data-tooltip], [data-tooltip-id]');
            if (!target) return;

            const triggerMode = target.getAttribute('data-tooltip-trigger') || this.triggerMode;
            if (triggerMode === 'hover') {
                const tooltip = this.tooltips.get(target);
                if (tooltip) {
                    // Vérifier si la souris est sortie de l'élément et du tooltip
                    const relatedTarget = e.relatedTarget;
                    if (!target.contains(relatedTarget) && (!tooltip.contains(relatedTarget) || !this.interactive)) {
                        this.hideTooltip(target);
                    }
                }
            }
        });

        // Gestionnaire global pour les mouvements de souris
        document.addEventListener('mousemove', (e) => {
            if (this.activeTooltip && this.triggerMode === 'hover') {
                const target = Array.from(this.tooltips.entries())
                    .find(([_, tooltip]) => tooltip === this.activeTooltip)?.[0];
                
                if (target) {
                    const tooltipRect = this.activeTooltip.getBoundingClientRect();
                    const targetRect = target.getBoundingClientRect();
                    
                    // Vérifier si la souris est en dehors de la zone du tooltip et de la cible
                    const isOutsideTooltip = e.clientX < tooltipRect.left || e.clientX > tooltipRect.right ||
                                           e.clientY < tooltipRect.top || e.clientY > tooltipRect.bottom;
                    const isOutsideTarget = e.clientX < targetRect.left || e.clientX > targetRect.right ||
                                          e.clientY < targetRect.top || e.clientY > targetRect.bottom;
                    
                    if (isOutsideTooltip && isOutsideTarget) {
                        this.hideTooltip(target);
                    }
                }
            }
        }, { passive: true });

        document.addEventListener('click', (e) => {
            const target = e.target.closest('[data-tooltip], [data-tooltip-id]');
            if (!target) {
                // Clic en dehors d'un tooltip, on ferme le tooltip actif
                if (this.activeTooltip) {
                    this.hideTooltip();
                }
                return;
            }

            const triggerMode = target.getAttribute('data-tooltip-trigger') || this.triggerMode;
            if (triggerMode === 'click') {
                if (this.activeTooltip === this.tooltips.get(target)) {
                    this.hideTooltip(target);
                } else {
                    this.showTooltip(target);
                }
            }
        });

        document.addEventListener('dblclick', (e) => {
            const target = e.target.closest('[data-tooltip], [data-tooltip-id]');
            if (!target) return;

            const triggerMode = target.getAttribute('data-tooltip-trigger') || this.triggerMode;
            if (triggerMode === 'dblclick') {
                if (this.activeTooltip === this.tooltips.get(target)) {
                    this.hideTooltip(target);
                } else {
                    this.showTooltip(target);
                }
            }
        });

        // Masquer le tooltip actif lors du scroll
        document.addEventListener('scroll', () => {
            if (this.activeTooltip) {
                this.hideTooltip(this.activeTooltip);
            }
        }, { passive: true });

        // Masquer le tooltip actif lors du redimensionnement
        window.addEventListener('resize', () => {
            if (this.activeTooltip) {
                this.hideTooltip(this.activeTooltip);
            }
        });

        // Masquer le tooltip actif lors du clic en dehors
        document.addEventListener('click', (e) => {
            if (this.activeTooltip && !this.activeTooltip.contains(e.target)) {
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
