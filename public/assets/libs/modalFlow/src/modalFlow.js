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
        // Fusionner les options par défaut avec celles fournies
        const modalConfig = {
            title: '',
            content: '',
            width: '500px',
            height: 'auto',
            draggable: false,
            resizable: false,
            closeOnEscape: true,
            closeOnOverlayClick: true,
            showCloseButton: true,
            validateLive: true,
            ...options
        };

        const modalId = `modal-${Date.now()}`;
        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-flow';
        
        // Structure de base sans header
        modal.innerHTML = `
            <div class="modal-flow-content">
                ${modalConfig.content || '<div class="modal-flow-loading"><div class="modal-flow-spinner"></div><p>Chargement...</p></div>'}
            </div>
        `;

        // Gérer le header
        let headerExists = false;
        const contentElement = modal.querySelector('.modal-flow-content');
        if (contentElement) {
            const loadedContent = contentElement.innerHTML;
            // Vérifier si un header existe déjà dans le contenu chargé
            headerExists = loadedContent.includes('modal-flow-header');
        }

        if (!headerExists && (modalConfig.title || modalConfig.showCloseButton)) {
            // Créer le header par défaut seulement s'il n'y en a pas déjà un
            const defaultHeader = document.createElement('div');
            defaultHeader.className = 'modal-flow-header';
            if (modalConfig.title) {
                const title = document.createElement('h2');
                title.textContent = modalConfig.title;
                defaultHeader.appendChild(title);
            }
            if (modalConfig.showCloseButton) {
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'modal-flow-close';
                closeButton.innerHTML = '&times;';
                closeButton.addEventListener('click', () => this.close(modalId));
                defaultHeader.appendChild(closeButton);
            }
            modal.insertBefore(defaultHeader, modal.firstChild);
        } else if (headerExists && modalConfig.showCloseButton) {
            // Si header personnalisé et showCloseButton, ajouter le bouton au header existant
            const customHeader = modal.querySelector('.modal-flow-header');
            if (customHeader) {
                const closeButton = document.createElement('button');
                closeButton.type = 'button';
                closeButton.className = 'modal-flow-close';
                closeButton.innerHTML = '&times;';
                closeButton.addEventListener('click', () => this.close(modalId));
                customHeader.appendChild(closeButton);
            }
        }

        // Gérer le footer avec les boutons
        const footer = this._createFooter(modal, modalConfig);
        if (footer) {
            modal.appendChild(footer);
        }

        // Appliquer les options spécifiques à cette modal
        const modalConfigFinal = {
            ...this.config,
            ...modalConfig
        };

        // Stocker la configuration spécifique à cette modal
        modal.dataset.config = JSON.stringify({
            closeOnOverlayClick: modalConfigFinal.closeOnOverlayClick,
            closeOnEscape: modalConfigFinal.closeOnEscape,
            onConfirm: !!modalConfigFinal.onConfirm
        });

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

        // Charger le contenu via AJAX si une URL est fournie
        if (options.url) {
            console.log('ModalFlow: Loading content from URL:', options.url);
            const fetchOptions = {
                method: 'POST'
            };

            // Ajouter les paramètres POST si présents
            if (options.params) {
                const formData = new FormData();
                for (const [key, value] of Object.entries(options.params)) {
                    formData.append(key, value);
                }
                fetchOptions.body = formData;
            }

            fetch(options.url, fetchOptions)
                .then(response => {
                    console.log('ModalFlow: Content loaded, status:', response.status);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.text();
                })
                .then(html => {
                    console.log('ModalFlow: Setting content');
                    const contentDiv = modal.querySelector('.modal-flow-content');
                    if (!contentDiv) {
                        console.error('ModalFlow: Content div not found');
                        return;
                    }
                    // Ajouter le nouveau contenu
                    contentDiv.innerHTML = html;
                    if (options.onContentLoaded) {
                        console.log('ModalFlow: Calling onContentLoaded callback');
                        options.onContentLoaded();
                    }
                })
                .catch(error => {
                    console.error('ModalFlow: Content load error:', error);
                    const contentDiv = modal.querySelector('.modal-flow-content');
                    if (contentDiv) {
                        contentDiv.innerHTML = `<div class="modal-flow-error">Erreur lors du chargement : ${error.message}</div>`;
                    }
                    if (options.onError) {
                        options.onError(error);
                    }
                });
        }

        return modalId;
    }

    _createFooter(modal, options) {
        const footer = document.createElement('div');
        footer.className = 'modal-flow-footer';
        
        // Si des boutons sont définis via l'option buttons, on les utilise
        if (options.buttons && options.buttons.length > 0) {
            options.buttons.forEach(button => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = button.text;
                btn.className = button.class || 'btn';
                btn.onclick = () => {
                    const shouldClose = button.onClick ? button.onClick() : true;
                    if (shouldClose) {
                        this.close(modal.id);
                    }
                };
                footer.appendChild(btn);
            });
            return footer;
        }
        
        // Sinon on cherche les boutons dans le contenu
        const buttonsContainer = modal.querySelector('.modal__buttons');
        if (buttonsContainer) {
            const buttons = buttonsContainer.getElementsByTagName('button');
            for (let i = 0; i < buttons.length; i++) {
                const button = buttons[i];
                const originalOnClick = button.getAttribute('onclick');
                if (originalOnClick && originalOnClick.includes('modalFlow.close()')) {
                    button.onclick = () => this.close();
                }
            }
            footer.innerHTML = buttonsContainer.innerHTML;
            buttonsContainer.remove();
            return footer;
        }
        
        return null;
    }

    // Méthode combinée pour créer et ouvrir une modale
    createAndOpen(options = {}) {
        console.log('ModalFlow: createAndOpen called with options:', options);
        const modalId = this.create(options);
        this.open(modalId);
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

    _cleanupModal(modal) {
        if (!modal) return;

        // Supprimer les gestionnaires d'événements
        const closeButton = modal.querySelector('.modal-flow-close');
        if (closeButton) {
            closeButton.removeEventListener('click', () => this.close(modal.id));
        }

        // Supprimer les gestionnaires de drag & resize
        if (modal.classList.contains('draggable')) {
            const header = modal.querySelector(this.config.dragHandle);
            if (header) {
                header.removeEventListener('mousedown', this.startDrag);
                header.removeEventListener('touchstart', this.startDrag);
            }
        }

        if (modal.classList.contains('resizable')) {
            const handles = modal.querySelectorAll('.modal-flow-resize-handle');
            handles.forEach(handle => {
                handle.removeEventListener('mousedown', this.startResize);
                handle.removeEventListener('touchstart', this.startResize);
            });
        }

        // Supprimer les validateurs si présents
        const forms = modal.querySelectorAll('form');
        forms.forEach(form => {
            form.removeEventListener('submit', this.validateForm);
            const inputs = form.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                input.removeEventListener('input', this.validateField);
                input.removeEventListener('change', this.validateField);
            });
        });

        // Nettoyer les références
        this.activeModals.delete(modal.id);
        
        // Supprimer l'élément du DOM
        modal.remove();
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

    close(modalId = null) {
        console.log('ModalFlow: Closing modal', modalId);
        
        if (modalId) {
            // Fermer un modal spécifique
            const modal = document.getElementById(modalId);
            if (modal) {
                // Animation de fermeture
                modal.classList.add('modal-flow-closing');
                
                // Attendre la fin de l'animation avant de nettoyer
                setTimeout(() => {
                    this._cleanupModal(modal);
                    
                    // Si c'était le dernier modal, cacher l'overlay
                    if (this.activeModals.size === 0) {
                        this.overlay.style.display = 'none';
                    }
                    
                    this._emit('close', { modalId });
                }, 300); // Durée de l'animation
            }
        } else {
            // Fermer tous les modals
            const modals = document.querySelectorAll('.modal-flow');
            modals.forEach(modal => {
                modal.classList.add('modal-flow-closing');
            });
            
            setTimeout(() => {
                modals.forEach(modal => {
                    this._cleanupModal(modal);
                });
                this.overlay.style.display = 'none';
                this._emit('closeAll');
            }, 300);
        }
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
