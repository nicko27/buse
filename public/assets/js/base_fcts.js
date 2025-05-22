// Fonction pour charger le debug avec un paramètre reset et un identifiant
function loadDebug(reset, id) {
    const params = new URLSearchParams(window.location.search);
    let paramsObj = {};

    for (let [key, value] of params.entries()) {
        paramsObj[key] = value;
    }
    if (reset == 1) paramsObj['debug'] = 0;
    paramsObj['id'] = id;

    let newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${new URLSearchParams(paramsObj)}`;
    window.location.href = newUrl;
}

// Fonction pour obtenir l'URL actuelle avec les paramètres de recherche
function getUrl() {
    const params = new URLSearchParams(window.location.search);
    let paramsObj = {};

    for (let [key, value] of params.entries()) {
        paramsObj[key] = value;
    }

    let newUrl = `${window.location.protocol}//${window.location.host}${window.location.pathname}?${new URLSearchParams(paramsObj)}`;
    return newUrl;
}

/**
 * Nettoie le contenu d'un textarea en retirant les caractères indésirables
 * @param {HTMLTextAreaElement} textarea - L'élément textarea à nettoyer
 * @param {Object} options - Options de nettoyage
 * @param {boolean} [options.removeQuotes=true] - Retirer les guillemets simples et doubles
 * @param {boolean} [options.trimSpaces=true] - Retirer les espaces multiples
 * @param {boolean} [options.preventScript=true] - Retirer les balises <script> et autres caractères dangereux
 */
function textAreaWithoutQuote(textarea, options = {}) {
    if (!textarea || !(textarea instanceof HTMLTextAreaElement)) {
        console.error('Invalid textarea element');
        return;
    }

    const {
        removeQuotes = true,
        trimSpaces = false,
        preventScript = true
    } = options;

    let value = textarea.value;

    // Retirer les guillemets
    if (removeQuotes) {
        value = value.replace(/['"]/g, ' ');
    }

    // Prévention XSS
    if (preventScript) {
        value = value
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/[<>]/g, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+=/gi, '');
    }

    textarea.value = value;

    // Déclencher un événement pour notifier du changement
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Ajuste automatiquement la hauteur d'un textarea en fonction de son contenu
 * @param {HTMLTextAreaElement} element - L'élément textarea à ajuster
 * @param {Object} options - Options d'ajustement
 * @param {number} [options.maxHeight=300] - Hauteur maximum en pixels
 */
function textAreaAdjust(element, options = {}) {
    if (!element || !(element instanceof HTMLTextAreaElement)) {
        console.error('Invalid textarea element');
        return;
    }

    const { maxHeight = 300 } = options;

    // Récupérer la hauteur minimale depuis le CSS
    const computedStyle = window.getComputedStyle(element);
    const minHeight = parseInt(computedStyle.minHeight) || parseInt(computedStyle.height) || 60;

    // Sauvegarder la hauteur actuelle
    const currentHeight = element.offsetHeight;

    // Vérifier si le contenu nécessite un défilement vertical
    const hasVerticalScroll = element.scrollHeight > currentHeight;

    // Ne rien faire si le contenu tient dans la hauteur actuelle
    if (!hasVerticalScroll && currentHeight >= minHeight) {
        return;
    }

    // Si le contenu dépasse la hauteur maximale
    if (element.scrollHeight > maxHeight) {
        element.style.height = `${maxHeight}px`;
        element.style.overflowY = 'auto';
        return;
    }

    // Ajuster la hauteur uniquement si nécessaire
    element.style.height = `${Math.max(minHeight, element.scrollHeight)}px`;
    element.style.overflowY = 'hidden';
}

// Fonction pour afficher ou masquer un élément avec un id donné
function showHide(id) {
    const element = document.getElementById(id);
    if (element) element.classList.toggle("hidden");
}

// Fonction pour désactiver un élément avec un id donné
function disable(id) {
    const element = document.getElementById(id);
    if (element) element.classList.add("disabled");
}

// Fonction pour activer un élément avec un id donné
function enable(id) {
    const element = document.getElementById(id);
    if (element) element.classList.remove("disabled");
}

// Fonction pour basculer l'attribut "data-parsley-excluded" d'un élément
function toggleParsleyExcluded(id) {
    const elements = document.querySelectorAll(id);
    elements.forEach((element) => {
        if (element.hasAttribute("data-parsley-excluded")) {
            element.removeAttribute("data-parsley-excluded");
        } else {
            element.setAttribute("data-parsley-excluded", "");
        }
    });
}

// Fonction pour uploader un fichier avec conversion en Base64 et calcul du MD5
function fileUpload(destUrl, inputFile, destDir = "", fileType, keepFileName = 0, progress = "") {
    return new Promise((resolve, reject) => {
        const fileInput = document.querySelector(inputFile);
        if (!fileInput || !fileInput.files.length) {
            reject("Aucun fichier sélectionné");
            return;
        }
        const file = fileInput.files[0];
        const fileName = file.name;
        const chunkSize = 1024 * 1024;
        const totalChunks = Math.ceil(file.size / chunkSize);
        const timestamp = Date.now();
        const progressElement = document.querySelector(progress);
        if (progressElement) progressElement.max = totalChunks;
        let currentChunk = 0;
        const reader = new FileReader();

        function uploadNextChunk() {
            const start = currentChunk * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);

            reader.onload = function () {
                const base64Chunk = reader.result.split(',')[1];
                const formData = new FormData();
                formData.append('chunk', base64Chunk);
                formData.append('totalChunks', totalChunks);
                formData.append('currentChunk', currentChunk);
                formData.append('destination', `${destDir}/`);
                formData.append('fileType', fileType);
                formData.append('keepFileName', keepFileName);
                formData.append('fileName', fileName);
                formData.append('timestamp', timestamp);

                const md5Chunk = CryptoJS.MD5(CryptoJS.enc.Latin1.parse(base64Chunk)).toString(CryptoJS.enc.Hex);
                formData.append('md5', md5Chunk);

                ajaxFct(formData, destUrl)
                    .then(resultat => {
                        if (resultat.erreur == 0) {
                            currentChunk++;
                            if (progressElement) progressElement.value = currentChunk;
                            if (currentChunk == totalChunks) resolve(resultat);
                            else uploadNextChunk();
                        } else {
                            reject(resultat.msg);
                        }
                    })
                    .catch(() => reject("Une ou plusieurs tranches ont échoué"));
            };
            reader.readAsDataURL(chunk);
        }
        uploadNextChunk();
    });
}

// Fonction pour mettre à jour un paramètre dans une URL
function updateQueryParam(url, key, value) {
    const urlObj = new URL(url);
    urlObj.searchParams.set(key, value);
    return urlObj.toString();
}

// Fonction pour basculer la visibilité des éléments par classe
function toggleElementByClassAndName(className, elt = "", hiddenClass = "hidden") {
    document.querySelectorAll(className).forEach(element => {
        element.classList.add(hiddenClass);
    });

    if (elt) document.querySelector(elt).classList.remove(hiddenClass);
}

// Fonctions de notification
function successNotice(title = "", msg = "", duration = 5000, customClass = "notice__ok") {
    notifyFlow.success(msg, title, {
        duration: duration,
        customClass: customClass,
        progress: true,
        icon: '<i class="fa fa-check-circle"></i>',
        dismissible: false,
        html: true
    });
}


function errorNotice(title = "", msg = "", duration = 5000, customClass = "notice__error") {
    notifyFlow.error(msg, title, {
        duration: duration,
        customClass: customClass,
        progress: true,
        icon: '<i class="fa fa-xmark"></i>',
        dismissible: false,
        html: true
    });
}



function infoNotice(title = "", msg = "", duration = 5000, customClass = "notice__info") {
    notifyFlow.info(msg, title, {
        duration: duration,
        customClass: customClass,
        progress: true,
        icon: '<i class="fa fa-circle-info"></i>',
        dismissible: false,
        html: true
    });
}

/**
 * Affiche une notification d'information avec barre de progression indéterminée et support d'annulation
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {string} title - Titre de la notification
 * @param {string} msg - Message de la notification
 * @param {Function} onCancel - Fonction à exécuter en cas d'annulation via la croix (X)
 */
function infoProgressIndeterminateNotice(taskId, title = "", msg = "", onCancel = null) {
    notifyFlow.indeterminateProgress({
        id: taskId,
        title: title,
        message: msg,
        type: 'info',
        dismissible: true,
        onCancel: onCancel
    });
}

/**
 * Termine une notification de progression indéterminée avec succès
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {string} title - Titre de la notification
 * @param {string} msg - Message de la notification
 * @param {number} duration - Durée d'affichage en ms
 */
function successProgressIndeterminateNotice(taskId, title = "", msg = "", duration = 5000) {
    notifyFlow.completeIndeterminateProgress(taskId, {
        title: title,
        message: msg,
        type: 'success',
        duration: duration
    });
}

/**
 * Termine une notification de progression indéterminée avec erreur
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {string} title - Titre de la notification
 * @param {string} msg - Message de la notification
 * @param {number} duration - Durée d'affichage en ms
 */
function errorProgressIndeterminateNotice(taskId, title = "", msg = "", duration = 5000) {
    notifyFlow.completeIndeterminateProgress(taskId, {
        title: title,
        message: msg,
        type: 'error',
        duration: duration
    });
}

/**
 * Crée une notification de progression déterminée (avec pourcentage)
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {string} title - Titre de la notification
 * @param {string} msg - Message de la notification
 * @param {number} percent - Pourcentage de progression (0-100)
 * @param {Function} onCancel - Fonction à exécuter en cas d'annulation via la croix (X)
 * @param {Object} options - Options supplémentaires
 * @returns {HTMLElement} L'élément de notification créé
 */
function infoProgressNotice(taskId, title = "", msg = "", percent = 0, onCancel = null, options = {}) {
    return notifyFlow.progress({
        id: taskId,
        title: title,
        message: msg,
        percent: percent,
        type: 'info',
        showPercentage: true,
        dismissible: true,
        onCancel: onCancel,
        ...options
    });
}

/**
 * Met à jour une notification de progression existante
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {string} title - Titre de la notification (optionnel)
 * @param {string} msg - Message de la notification (optionnel)
 * @param {number} percent - Pourcentage de progression (0-100)
 * @param {string} type - Type de notification ('info', 'success', 'warning', 'error')
 * @returns {HTMLElement} L'élément de notification mis à jour
 */
function updateProgressNotice(taskId, title, msg, percent, type = 'info') {
    return notifyFlow.updateProgress(taskId, {
        title: title,
        message: msg,
        percent: percent,
        type: type
    });
}

/**
 * Termine une notification de progression avec succès
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {string} title - Titre de la notification
 * @param {string} msg - Message de la notification
 * @param {number} duration - Durée d'affichage en ms
 * @returns {HTMLElement} L'élément de notification mis à jour
 */
function successProgressNotice(taskId, title = "Succès", msg = "Opération terminée avec succès", duration = 3000) {
    return notifyFlow.updateProgress(taskId, {
        title: title,
        message: msg,
        percent: 100,
        type: 'success',
        completeDuration: duration
    });
}

/**
 * Termine une notification de progression avec erreur
 * @param {string} taskId - Identifiant unique de la tâche
 * @param {string} title - Titre de la notification
 * @param {string} msg - Message de la notification
 * @param {number} percent - Pourcentage atteint avant l'erreur
 * @param {number} duration - Durée d'affichage en ms
 * @returns {HTMLElement} L'élément de notification mis à jour
 */
function errorProgressNotice(taskId, title = "Erreur", msg = "Une erreur est survenue", percent = 0, duration = 3000) {
    return notifyFlow.updateProgress(taskId, {
        title: title,
        message: msg,
        percent: percent,
        type: 'error',
        completeDuration: duration
    });
}

/**
 * Supprime manuellement une notification par son ID
 * @param {string} taskId - Identifiant unique de la notification
 */
function removeNotice(taskId) {
    notifyFlow.removeById(taskId);
}

/**
 * Charge dynamiquement un fichier JavaScript s'il est disponible.
 * @param {string} src - Le chemin du fichier JavaScript à charger.
 * @returns {Promise<void>} - Promesse résolue si le fichier est chargé, rejetée sinon.
 */
function loadScriptIfExists(src) {
    return fetch(src, { method: 'HEAD' }) // Vérifie si le fichier existe
        .then((response) => {
            if (response.ok) { // Si le fichier est accessible
                return new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = src;
                    script.onload = resolve; // Le script est chargé avec succès
                    script.onerror = reject; // Erreur lors du chargement
                    document.head.appendChild(script);
                });
            }
        });
}


/**
 * Fonction pour effectuer une requête Ajax avec support de progression
 * @param {FormData|Object} formdata - Les données à envoyer
 * @param {string} destUrl - L'URL de destination
 * @param {Object} options - Options supplémentaires (optionnel)
 * @param {function} options.onUploadProgress - Callback pour la progression de l'upload (reçoit un objet event)
 * @param {function} options.onDownloadProgress - Callback pour la progression du téléchargement (reçoit un objet event)
 * @param {Object} options.headers - En-têtes HTTP supplémentaires
 * @param {number} options.timeout - Délai d'expiration en ms (par défaut: 30000)
 * @returns {Promise} Une promesse qui résout avec la réponse JSON
 */
function ajaxFct(formdata, destUrl, options = {}) {
    // Valeurs par défaut des options
    const {
        onUploadProgress,
        onDownloadProgress,
        headers = {},
        timeout = 30000,
        withCredentials = true  // Nouvelle option avec true par défaut
    } = options;

    // Si aucun callback de progression n'est fourni, utiliser fetch pour compatibilité
    if (!onUploadProgress && !onDownloadProgress) {
        return fetch(destUrl, {
            method: "POST",
            body: formdata,
            credentials: withCredentials ? "include" : "same-origin", // Contrôle dynamique des credentials
            headers: headers
        })
            .then(response => {
                // Vérifie que la réponse est correcte
                if (!response.ok) {
                    // Gestion spécifique des erreurs CORS et d'authentification
                    if (response.status === 0) {
                        throw new Error("Erreur CORS ou réseau - Vérifiez que le serveur autorise les credentials");
                    } else if (response.status === 401 || response.status === 403) {
                        throw new Error(`Erreur d'authentification (${response.status}): Problème de session ou de credentials`);
                    }
                    throw new Error(`Erreur HTTP ${response.status}: ${response.statusText}`);
                }

                return response.text().then(rawText => {
                    try {
                        // Vérifier si la réponse est vide
                        if (!rawText.trim()) {
                            console.warn("Réponse vide du serveur");
                            return { success: false, message: "Réponse vide du serveur" };
                        }

                        const jsonResponse = JSON.parse(rawText);
                        // Vérifie si le serveur retourne une erreur
                        if (jsonResponse.error === 1) {
                            console.error("Erreur du serveur :", jsonResponse.msgError);
                        }
                        return jsonResponse; // Retourne la réponse JSON si tout va bien
                    } catch (error) {
                        console.error("Erreur de parsing JSON :", error.message, "- Réponse brute :", rawText);
                        throw new Error("Erreur de parsing JSON");
                    }
                });
            })
            .catch(error => {
                // Journalisation détaillée des erreurs
                console.error("AJAX Error:", error);
                // Ajouter des détails spécifiques aux problèmes de session si nécessaire
                if (error.message.includes("authentication") || error.message.includes("CORS")) {
                    console.error("Possible problème de session ou de CORS. Assurez-vous que le serveur accepte les credentials.");
                }
                throw error; // Relance l'erreur pour la gérer au niveau supérieur
            });
    }

    // Si des callbacks de progression sont fournis, utiliser XMLHttpRequest
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        // Configuration du timeout
        xhr.timeout = timeout;

        // Événements de progression
        if (onUploadProgress) {
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onUploadProgress({
                        loaded: event.loaded,
                        total: event.total,
                        percent: percentComplete
                    });
                }
            });
        }

        if (onDownloadProgress) {
            xhr.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percentComplete = Math.round((event.loaded / event.total) * 100);
                    onDownloadProgress({
                        loaded: event.loaded,
                        total: event.total,
                        percent: percentComplete
                    });
                }
            });
        }

        // Événement de fin de chargement
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                // Vérifier si la réponse est vide
                if (!xhr.responseText.trim()) {
                    console.warn("Réponse vide du serveur");
                    resolve({ success: false, message: "Réponse vide du serveur" });
                    return;
                }

                let jsonResponse;
                try {
                    jsonResponse = JSON.parse(xhr.responseText);
                    if (jsonResponse.error === 1) {
                        console.error("Erreur du serveur :", jsonResponse.msgError);
                    }
                    resolve(jsonResponse);
                } catch (error) {
                    console.error("Erreur de parsing JSON :", error.message, "- Réponse brute :", xhr.responseText);
                    reject(new Error("Erreur de parsing JSON"));
                }
            } else if (xhr.status === 0) {
                // Erreur spécifique liée aux CORS ou au réseau
                console.error("Erreur CORS ou réseau - Vérifiez que le serveur autorise les credentials");
                reject(new Error("Erreur CORS ou réseau - Vérifiez que le serveur autorise les credentials"));
            } else if (xhr.status === 401 || xhr.status === 403) {
                // Erreur d'authentification
                console.error(`Erreur d'authentification (${xhr.status}): Problème de session ou de credentials`);
                reject(new Error(`Erreur d'authentification (${xhr.status}): Problème de session ou de credentials`));
            } else {
                reject(new Error(`Erreur HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        });

        // Gestion des erreurs
        xhr.addEventListener('error', () => {
            console.error("AJAX Error: Une erreur réseau s'est produite. Vérifiez les règles CORS et les credentials.");
            reject(new Error("Erreur réseau - Possible problème de CORS ou de credentials"));
        });

        xhr.addEventListener('timeout', () => {
            console.error("AJAX Error: Timeout dépassé");
            reject(new Error("Timeout dépassé"));
        });

        // Ouverture et envoi de la requête
        xhr.open('POST', destUrl, true);

        // Configuration des credentials AVANT l'envoi
        xhr.withCredentials = withCredentials;

        // Ajout des en-têtes personnalisés
        Object.keys(headers).forEach(key => {
            xhr.setRequestHeader(key, headers[key]);
        });

        // Envoi des données
        xhr.send(formdata);
    });
}