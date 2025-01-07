class ModalManager {
    /**
     * Initialise le gestionnaire de modal.
     * @param {string} modalSelector - Sélecteur CSS pour le modal.
     * @param {string} overlaySelector - Sélecteur CSS pour l'overlay du modal.
     */
    constructor(modalSelector, overlaySelector) {
        this.modalSelector = modalSelector;
        this.overlaySelector = overlaySelector;
    }


    /**
     * Affiche le modal avec le contenu chargé via une requête AJAX, en passant des données de formulaire si nécessaire.
     * @param {Object} options - Options pour configurer l'affichage du modal.
     * @param {string} options.url - URL pour charger le contenu via AJAX.
     * @param {Object|null} [options.formDataObj=null] - Objet contenant les données du formulaire à envoyer.
     * @param {string} [options.method='POST'] - Méthode HTTP pour la requête (GET ou POST).
     * @param {string} [options.animation='fadeIn'] - Type d'animation pour afficher le modal.
     * @param {number} [options.duration=1000] - Durée de l'animation en millisecondes.
     * @param {Function|null} [options.onSuccess=null] - Callback exécuté en cas de succès de la requête AJAX.
     * @param {Function} [options.onError=(error) => console.error('Error:', error)] - Callback exécuté en cas d'erreur.
     * @param {Function|null} [options.initialize=null] - Fonction pour initialiser des fonctionnalités après affichage du modal.
     */
    async show({
        url,
        formDataObj = null,
        method = 'POST',
        animation = 'fadeIn',
        duration = 1000,
        onSuccess = null,
        onError = (error) => console.error('Error:', error),
        initialize = null
    }) {
        try {
            let overlay = "";
            let modal = "";
            // Sélectionne les éléments modal et overlay au moment de l'affichage
            modal = document.querySelector(this.modalSelector);
            overlay = document.querySelector(this.overlaySelector);

            let formData = null;
            if (formDataObj) {
                formData = this.convertToFormData(formDataObj); // Convertit l'objet en FormData
            }

            // Effectue la requête AJAX pour charger le contenu du modal
            const response = await this.ajaxRequest(url, formData, method);
            modal.innerHTML = response.html; // Insère le contenu HTML dans le modal
            overlay.classList.remove("hidden"); // Affiche l'overlay
            modal.classList.remove("hidden"); // Affiche le modal

            // Gère l'animation d'apparition du modal
            this.handleAnimation(modal, animation, duration, 'in');

            // Initialise des fonctionnalités spécifiques si la fonction est définie
            if (initialize) {
                initialize();
            }

        } catch (error) {
            // Appelle le callback onError en cas d'erreur
            onError(error);
        }
    }

    /**
     * Cache le modal avec une animation.
     * @param {Object} [options={}] - Options pour configurer le masquage du modal.
     * @param {string} [options.animation='fadeOut'] - Type d'animation pour cacher le modal.
     * @param {number} [options.duration=1000] - Durée de l'animation en millisecondes.
     * @param {Function|null} [options.onComplete=null] - Callback exécuté une fois le modal caché.
     */
    hide({
        animation = 'fadeOut',
        duration = 1000,
        onComplete = null
    } = {}) {
        let overlay = "";
        let modal = "";
        // Sélectionne les éléments modal et overlay au moment de l'affichage
        modal = document.querySelector(this.modalSelector);
        overlay = document.querySelector(this.overlaySelector);

        // Gère l'animation pour masquer le modal et appelle onComplete après
        this.handleAnimation(modal, animation, duration, 'out', () => {
            this.cleanup(); // Nettoie le contenu du modal
            if (onComplete) onComplete(); // Appelle le callback onComplete si défini
        });
    }

    /**
     * Nettoie le contenu du modal et cache l'overlay.
     */
    cleanup() {
        // Sélectionne les éléments modal et overlay au moment de l'affichage
        modal = document.querySelector(this.modalSelector);
        overlay = document.querySelector(this.overlaySelector);
        overlay.classList.add("hidden"); // Cache l'overlay
        modal.classList.add("hidden"); // Cache le modal
        modal.innerHTML = "";  // Vide le contenu du modal
    }

    /**
     * Soumet un formulaire via AJAX et cache le modal après succès.
     * @param {Object} options - Options pour configurer la soumission du formulaire.
     * @param {string} options.url - URL pour envoyer les données du formulaire via AJAX.
     * @param {Object} options.formDataObj - Objet contenant les données du formulaire.
     * @param {string} [options.method='POST'] - Méthode HTTP pour la requête (POST par défaut).
     * @param {string} [options.animation='fadeOut'] - Type d'animation pour cacher le modal après soumission.
     * @param {number} [options.duration=1000] - Durée de l'animation en millisecondes.
     * @param {Function|null} [options.onSuccess=null] - Callback exécuté en cas de succès de la requête AJAX.
     * @param {Function} [options.onError=(error) => console.error('Error:', error)] - Callback exécuté en cas d'erreur.
     */
    async submitForm({
        url,
        formDataObj,
        method = 'POST',
        animation = 'fadeOut',
        duration = 1000,
        onSuccess = null,
        onError = (error) => console.error('Error:', error)
    }) {
        const formData = this.convertToFormData(formDataObj); // Convertit l'objet en FormData
        try {
            // Effectue la requête AJAX pour soumettre le formulaire
            const response = await this.ajaxRequest(url, formData, method);
            if (onSuccess) {
                onSuccess(response); // Appelle le callback onSuccess si défini
            } else {
                this.handleSuccess(response); // Par défaut, gère le succès
            }
            this.hide({ animation, duration }); // Cache le modal après succès
        } catch (error) {
            onError(error); // Appelle le callback onError en cas d'erreur
        }
    }

    /**
     * Effectue une requête AJAX.
     * @param {string} url - URL pour envoyer la requête.
     * @param {FormData|null} formData - Données du formulaire à envoyer avec la requête.
     * @param {string} method - Méthode HTTP pour la requête (GET ou POST).
     * @returns {Promise<Object>} - Résultat de la requête sous forme d'objet JSON.
     * @throws {Error} - Lance une erreur si la requête échoue.
     */
    async ajaxRequest(url, formData = null, method = 'POST') {
        const options = {
            method: method,
            body: formData,
            headers: {
                'Accept': 'application/json'
            }
        };

        const response = await fetch(url, formData ? options : undefined);
        if (!response.ok) {
            throw new Error('Erreur réseau'); // Lance une erreur si la requête échoue
        }
        return await response.json(); // Retourne le résultat sous forme d'objet JSON
    }

    /**
     * Convertit un objet en FormData.
     * @param {Object} dataObj - Objet contenant les données à convertir.
     * @returns {FormData} - Objet FormData contenant les données.
     */
    convertToFormData(dataObj) {
        const formData = new FormData();
        for (const key in dataObj) {
            if (dataObj.hasOwnProperty(key)) {
                formData.append(key, dataObj[key]); // Ajoute chaque paire clé/valeur dans FormData
            }
        }
        return formData;
    }

    /**
     * Gère les animations d'affichage et de masquage du modal.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {string} animation - Type d'animation ('fadeIn', 'fadeOut', 'slideDown', etc.).
     * @param {number} duration - Durée de l'animation en millisecondes.
     * @param {string} direction - Direction de l'animation ('in' pour afficher, 'out' pour masquer).
     * @param {Function|null} [callback=null] - Callback exécuté après la fin de l'animation.
     */
    handleAnimation(element, animation, duration, direction, callback = null) {
        // Sélectionne la bonne animation en fonction du type et de la direction
        if (animation === 'slideDown' && direction === 'in') {
            this.slideDown(element, duration);
        } else if (animation === 'slideDown' && direction === 'out') {
            this.slideUp(element, duration, callback);
        } else if (animation === 'zoomIn' && direction === 'in') {
            this.zoomIn(element, duration);
        } else if (animation === 'zoomIn' && direction === 'out') {
            this.zoomOut(element, duration, callback);
        } else if (animation === 'slideFromLeft' && direction === 'in') {
            this.slideFromLeft(element, duration);
        } else if (animation === 'slideFromLeft' && direction === 'out') {
            this.slideToLeft(element, duration, callback);
        } else if (animation === 'fadeAndSlide' && direction === 'in') {
            this.fadeAndSlide(element, duration);
        } else if (animation === 'fadeAndSlide' && direction === 'out') {
            this.fadeAndSlideOut(element, duration, callback);
        } else if (direction === 'in') {
            this.fadeIn(element, duration);
        } else {
            this.fadeOut(element, duration, callback);
        }
    }

    /**
     * Affiche un élément avec une animation de fondu en entrée.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     */
    fadeIn(element, duration) {
        element.style.opacity = 0;
        element.style.display = "block";
        let last = +new Date();
        const tick = () => {
            element.style.opacity = +element.style.opacity + (new Date() - last) / duration;
            last = +new Date();

            if (+element.style.opacity < 1) {
                (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
            }
        };
        tick();
    }

    /**
     * Cache un élément avec une animation de fondu en sortie.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     * @param {Function|null} [callback=null] - Callback exécuté après la fin de l'animation.
     */
    fadeOut(element, duration, callback) {
        element.style.opacity = 1;
        let last = +new Date();
        const tick = () => {
            element.style.opacity = +element.style.opacity - (new Date() - last) / duration;
            last = +new Date();

            if (+element.style.opacity > 0) {
                (window.requestAnimationFrame && requestAnimationFrame(tick)) || setTimeout(tick, 16);
            } else {
                element.style.display = "none";
                if (callback) callback();
            }
        };
        tick();
    }

    /**
     * Affiche un élément en le faisant glisser du haut vers le bas.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     */
    slideDown(element, duration) {
        element.style.display = "block";
        element.style.transition = `transform ${duration}ms ease-out`;
        element.style.transform = "translateY(-100%)";
        setTimeout(() => {
            element.style.transform = "translateY(0)";
        }, 10);
    }

    /**
     * Cache un élément en le faisant glisser du bas vers le haut.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     * @param {Function|null} [callback=null] - Callback exécuté après la fin de l'animation.
     */
    slideUp(element, duration, callback) {
        element.style.transition = `transform ${duration}ms ease-out`;
        element.style.transform = "translateY(-100%)";
        setTimeout(() => {
            element.style.display = "none";
            if (callback) callback();
        }, duration);
    }

    /**
     * Affiche un élément avec un effet de zoom avant.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     */
    zoomIn(element, duration) {
        element.style.transform = "scale(0)";
        element.style.display = "block";
        element.style.transition = `transform ${duration}ms ease-out`;
        setTimeout(() => {
            element.style.transform = "scale(1)";
        }, 10);
    }

    /**
     * Cache un élément avec un effet de zoom arrière.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     * @param {Function|null} [callback=null] - Callback exécuté après la fin de l'animation.
     */
    zoomOut(element, duration, callback) {
        element.style.transition = `transform ${duration}ms ease-out`;
        element.style.transform = "scale(0)";
        setTimeout(() => {
            element.style.display = "none";
            if (callback) callback();
        }, duration);
    }

    /**
     * Affiche un élément en le faisant glisser depuis la gauche.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     */
    slideFromLeft(element, duration) {
        element.style.transform = "translateX(-100%)";
        element.style.display = "block";
        element.style.transition = `transform ${duration}ms ease-out`;
        setTimeout(() => {
            element.style.transform = "translateX(0)";
        }, 10);
    }

    /**
     * Cache un élément en le faisant glisser vers la gauche.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     * @param {Function|null} [callback=null] - Callback exécuté après la fin de l'animation.
     */
    slideToLeft(element, duration, callback) {
        element.style.transition = `transform ${duration}ms ease-out`;
        element.style.transform = "translateX(-100%)";
        setTimeout(() => {
            element.style.display = "none";
            if (callback) callback();
        }, duration);
    }

    /**
     * Affiche un élément avec un effet de fondu et de glissement du haut.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     */
    fadeAndSlide(element, duration) {
        element.style.opacity = 0;
        element.style.transform = "translateY(-100%)";
        element.style.display = "block";
        element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
        setTimeout(() => {
            element.style.opacity = 1;
            element.style.transform = "translateY(0)";
        }, 10);
    }

    /**
     * Cache un élément avec un effet de fondu et de glissement vers le haut.
     * @param {HTMLElement} element - Élément HTML à animer.
     * @param {number} duration - Durée de l'animation en millisecondes.
     * @param {Function|null} [callback=null] - Callback exécuté après la fin de l'animation.
     */
    fadeAndSlideOut(element, duration, callback) {
        element.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
        element.style.opacity = 0;
        element.style.transform = "translateY(-100%)";
        setTimeout(() => {
            element.style.display = "none";
            if (callback) callback();
        }, duration);
    }

    /**
     * Gère les actions en cas de succès par défaut (peut être surchargé).
     * @param {Object} response - Réponse de la requête AJAX.
     */
    handleSuccess(response) {
        successNotice("Action réussie", 1000); // Affiche une notification de succès
    }

    /**
     * Gère les erreurs par défaut (peut être surchargé).
     * @param {string} errorMessage - Message d'erreur à afficher.
     */
    handleError(errorMessage) {
        errorNotice(errorMessage, 1000); // Affiche une notification d'erreur
    }
}

// Attacher la classe ModalManager à l'objet global pour être accessible dans d'autres scripts
window.ModalManager = ModalManager;
