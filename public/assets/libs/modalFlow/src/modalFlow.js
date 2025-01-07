class ModalFlow {
    constructor(config = {}) {
        // Configuration par défaut
        this.config = {
            theme: 'light',
            animation: true,
            closeOnEscape: true,
            closeOnOverlayClick: true,
            showCloseButton: true,
            maxWidth: '800px',
            width: '90%',
            height: 'auto',
            position: 'center',
            overlayOpacity: 0.5,
            zIndex: 1000,
            // Options de drag
            draggable: false,
            dragHandle: '.modal-flow-header',
            // Options de resize
            resizable: false,
            minWidth: 200,
            minHeight: 150,
            handles: ['se', 'sw', 'ne', 'nw'],
            keepAspectRatio: false,
            // Options de validation
            validateLive: true,
            validateErrorClass: 'invalid',
            validateErrorPlacement: 'after',
            ...config
        };

        // État interne
        this.activeModals = new Set();
        this.modalCounter = 0;
        this.eventListeners = new Map();
        this.dragState = null;
        this.resizeState = null;
        
        // Créer le conteneur d'overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'modal-flow-overlay';
        document.body.appendChild(this.overlay);

        // Configurer les gestionnaires d'événements globaux
        this._setupGlobalEvents();
    }

    // Méthodes principales
    create(options = {}) {
        const modalId = `modal-${++this.modalCounter}`;
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = `modal-flow ${this.config.theme}`;

        // Appliquer les options spécifiques à cette modal
        const modalConfig = {
            ...this.config,
            ...options
        };

        // Stocker la configuration spécifique à cette modal
        modal.dataset.config = JSON.stringify({
            closeOnOverlayClick: modalConfig.closeOnOverlayClick,
            closeOnEscape: modalConfig.closeOnEscape
        });

        // Structure de base
        modal.innerHTML = `
            <div class="modal-flow-header">
                <h2>${options.title || ''}</h2>
                ${modalConfig.showCloseButton ? '<button class="modal-flow-close">&times;</button>' : ''}
            </div>
            <div class="modal-flow-content">${options.content || ''}</div>
            ${options.footer ? `<div class="modal-flow-footer">${options.footer}</div>` : ''}
        `;

        // Ajouter le gestionnaire pour le bouton de fermeture
        const closeButton = modal.querySelector('.modal-flow-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => this.close(modalId));
        }

        // Appliquer les options de drag et resize
        if (options.draggable || this.config.draggable) {
            modal.classList.add('draggable');
            this._setupDrag(modal);
        }

        if (options.resizable || this.config.resizable) {
            modal.classList.add('resizable');
            this._setupResize(modal);
        }

        // Gérer la validation si nécessaire
        if (options.validate) {
            this._setupValidation(modal);
        }

        document.body.appendChild(modal);
        this.activeModals.add(modalId);
        this._emit('create', { modalId, element: modal });

        return modalId;
    }

    // Méthodes de drag
    _setupDrag(modal) {
        const handle = modal.querySelector(this.config.dragHandle);
        if (!handle) return;

        let isDragging = false;
        let startX, startY, initialX, initialY;

        const startDrag = (e) => {
            if (e.target.closest('.modal-flow-close')) return;
            
            isDragging = true;
            startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
            startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
            initialX = modal.offsetLeft;
            initialY = modal.offsetTop;

            this._emit('dragStart', { 
                modalId: modal.id, 
                x: initialX, 
                y: initialY 
            });
        };

        const doDrag = (e) => {
            if (!isDragging) return;

            e.preventDefault();
            const currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
            const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
            
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            const newX = Math.max(0, Math.min(initialX + deltaX, window.innerWidth - modal.offsetWidth));
            const newY = Math.max(0, Math.min(initialY + deltaY, window.innerHeight - modal.offsetHeight));

            modal.style.left = `${newX}px`;
            modal.style.top = `${newY}px`;

            this._emit('drag', { 
                modalId: modal.id, 
                x: newX, 
                y: newY 
            });
        };

        const endDrag = () => {
            if (!isDragging) return;
            isDragging = false;

            this._emit('dragEnd', { 
                modalId: modal.id,
                x: modal.offsetLeft,
                y: modal.offsetTop
            });
        };

        handle.addEventListener('mousedown', startDrag);
        handle.addEventListener('touchstart', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('touchmove', doDrag);
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }

    // Méthodes de resize
    _setupResize(modal) {
        const createHandle = (position) => {
            const handle = document.createElement('div');
            handle.className = `resize-handle ${position}`;
            modal.appendChild(handle);
            return handle;
        };

        this.config.handles.forEach(position => {
            const handle = createHandle(position);
            let isResizing = false;
            let startX, startY, startWidth, startHeight;

            const startResize = (e) => {
                isResizing = true;
                startX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
                startY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
                startWidth = modal.offsetWidth;
                startHeight = modal.offsetHeight;

                this._emit('resizeStart', {
                    modalId: modal.id,
                    width: startWidth,
                    height: startHeight
                });
            };

            const doResize = (e) => {
                if (!isResizing) return;

                e.preventDefault();
                const currentX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
                const currentY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
                
                let newWidth = startWidth;
                let newHeight = startHeight;

                if (position.includes('e')) {
                    newWidth = Math.max(this.config.minWidth, startWidth + (currentX - startX));
                } else if (position.includes('w')) {
                    newWidth = Math.max(this.config.minWidth, startWidth - (currentX - startX));
                }

                if (position.includes('s')) {
                    newHeight = Math.max(this.config.minHeight, startHeight + (currentY - startY));
                } else if (position.includes('n')) {
                    newHeight = Math.max(this.config.minHeight, startHeight - (currentY - startY));
                }

                if (this.config.keepAspectRatio) {
                    const ratio = startWidth / startHeight;
                    if (newWidth / newHeight > ratio) {
                        newWidth = newHeight * ratio;
                    } else {
                        newHeight = newWidth / ratio;
                    }
                }

                modal.style.width = `${newWidth}px`;
                modal.style.height = `${newHeight}px`;

                this._emit('resize', {
                    modalId: modal.id,
                    width: newWidth,
                    height: newHeight
                });
            };

            const endResize = () => {
                if (!isResizing) return;
                isResizing = false;

                this._emit('resizeEnd', {
                    modalId: modal.id,
                    width: modal.offsetWidth,
                    height: modal.offsetHeight
                });
            };

            handle.addEventListener('mousedown', startResize);
            handle.addEventListener('touchstart', startResize);
            document.addEventListener('mousemove', doResize);
            document.addEventListener('touchmove', doResize);
            document.addEventListener('mouseup', endResize);
            document.addEventListener('touchend', endResize);
        });
    }

    // Méthodes de validation
    _setupValidation(modal) {
        const form = modal.querySelector('form');
        if (!form) return;

        const validateField = (field) => {
            const rules = field.dataset.validate?.split('|') || [];
            const errors = [];

            rules.forEach(rule => {
                const [ruleName, ruleValue] = rule.split(':');
                
                switch (ruleName) {
                    case 'required':
                        if (!field.value.trim()) {
                            errors.push('Ce champ est requis');
                        }
                        break;
                    case 'email':
                        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value)) {
                            errors.push('Email invalide');
                        }
                        break;
                    case 'min':
                        if (parseFloat(field.value) < parseFloat(ruleValue)) {
                            errors.push(`Minimum ${ruleValue}`);
                        }
                        break;
                    case 'max':
                        if (parseFloat(field.value) > parseFloat(ruleValue)) {
                            errors.push(`Maximum ${ruleValue}`);
                        }
                        break;
                    case 'minLength':
                        if (field.value.length < parseInt(ruleValue)) {
                            errors.push(`Minimum ${ruleValue} caractères`);
                        }
                        break;
                    case 'maxLength':
                        if (field.value.length > parseInt(ruleValue)) {
                            errors.push(`Maximum ${ruleValue} caractères`);
                        }
                        break;
                    case 'pattern':
                        if (!new RegExp(ruleValue).test(field.value)) {
                            errors.push('Format invalide');
                        }
                        break;
                    case 'match':
                        const matchField = form.querySelector(`[name="${ruleValue}"]`);
                        if (matchField && field.value !== matchField.value) {
                            errors.push('Les valeurs ne correspondent pas');
                        }
                        break;
                }
            });

            // Afficher les erreurs
            const errorContainer = field.nextElementSibling;
            if (errors.length > 0) {
                field.classList.add(this.config.validateErrorClass);
                if (!errorContainer || !errorContainer.classList.contains('error-message')) {
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'error-message';
                    errorDiv.textContent = errors[0];
                    field.parentNode.insertBefore(errorDiv, field.nextSibling);
                } else {
                    errorContainer.textContent = errors[0];
                }
                return false;
            } else {
                field.classList.remove(this.config.validateErrorClass);
                if (errorContainer && errorContainer.classList.contains('error-message')) {
                    errorContainer.remove();
                }
                return true;
            }
        };

        // Validation en temps réel
        if (this.config.validateLive) {
            form.addEventListener('input', (e) => {
                if (e.target.dataset.validate) {
                    validateField(e.target);
                }
            });
        }

        // Validation à la soumission
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            let isValid = true;

            form.querySelectorAll('[data-validate]').forEach(field => {
                if (!validateField(field)) {
                    isValid = false;
                }
            });

            if (isValid) {
                this._emit('formValid', {
                    modalId: modal.id,
                    form: form,
                    data: Object.fromEntries(new FormData(form))
                });
            } else {
                this._emit('formInvalid', {
                    modalId: modal.id,
                    form: form
                });
            }
        });
    }

    // Méthodes utilitaires
    _setupGlobalEvents() {
        // Gestionnaire pour la touche Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const lastModalId = Array.from(this.activeModals).pop();
                if (lastModalId) {
                    const modal = document.getElementById(lastModalId);
                    const modalConfig = JSON.parse(modal.dataset.config || '{}');
                    if (modalConfig.closeOnEscape) {
                        this.close(lastModalId);
                    }
                }
            }
        });

        // Gestionnaire pour le clic sur l'overlay
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                const lastModalId = Array.from(this.activeModals).pop();
                if (lastModalId) {
                    const modal = document.getElementById(lastModalId);
                    const modalConfig = JSON.parse(modal.dataset.config || '{}');
                    if (modalConfig.closeOnOverlayClick) {
                        this.close(lastModalId);
                    }
                }
            }
        });
    }

    closeModal(modalId, force = false) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        // Si force est true, on ferme la modal sans vérifier la configuration
        if (force) {
            this.close(modalId);
            return true;
        }

        // Sinon, on vérifie la configuration de la modal
        const modalConfig = JSON.parse(modal.dataset.config || '{}');
        if (modalConfig.preventClose) {
            return false;
        }

        this.close(modalId);
        return true;
    }

    _emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => callback(data));
        }
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }

    off(event, callback) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }

    open(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        this.overlay.style.display = 'block';
        modal.style.display = 'block';
        
        // Ajouter un petit délai pour permettre la transition
        setTimeout(() => {
            this.overlay.classList.add('visible');
            modal.classList.add('visible');
        }, 10);

        this._emit('open', { modalId, element: modal });
        return true;
    }

    close(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        // Retirer la classe visible d'abord pour la transition
        this.overlay.classList.remove('visible');
        modal.classList.remove('visible');

        // Attendre la fin de la transition avant de cacher
        setTimeout(() => {
            if (this.activeModals.size === 1) {
                this.overlay.style.display = 'none';
            }
            modal.style.display = 'none';
            this.activeModals.delete(modalId);
            this._emit('close', { modalId, element: modal });
        }, 300); // Correspond à la durée de transition dans le CSS

        return true;
    }

    update(modalId, options = {}) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        if (options.title) {
            const title = modal.querySelector('.modal-flow-header h2');
            if (title) title.textContent = options.title;
        }

        if (options.content) {
            const content = modal.querySelector('.modal-flow-content');
            if (content) content.innerHTML = options.content;
        }

        if (options.footer) {
            let footer = modal.querySelector('.modal-flow-footer');
            if (!footer) {
                footer = document.createElement('div');
                footer.className = 'modal-flow-footer';
                modal.appendChild(footer);
            }
            footer.innerHTML = options.footer;
        }

        this._emit('update', { modalId, element: modal, options });
        return true;
    }

    destroy(modalId) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;

        modal.remove();
        this.activeModals.delete(modalId);
        
        if (this.activeModals.size === 0) {
            this.overlay.style.display = 'none';
        }

        this._emit('destroy', { modalId });
        return true;
    }
}

// Export pour les modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalFlow;
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return ModalFlow; });
} else {
    window.ModalFlow = ModalFlow;
}
