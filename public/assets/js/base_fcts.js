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
 * @param {number} [options.minHeight=60] - Hauteur minimum en pixels
 * @param {number} [options.maxHeight=300] - Hauteur maximum en pixels
 * @param {number} [options.padding=5] - Padding supplémentaire en pixels
 */
function textAreaAdjust(element, options = {}) {
    if (!element || !(element instanceof HTMLTextAreaElement)) {
        console.error('Invalid textarea element');
        return;
    }

    const {
        minHeight = 60,
        maxHeight = 300,
        padding = 5
    } = options;

    // Sauvegarder la position du curseur
    const cursorPosition = element.selectionStart;

    // Réinitialiser la hauteur
    element.style.height = 'auto';

    // Calculer la nouvelle hauteur
    const scrollHeight = element.scrollHeight + padding;
    const newHeight = Math.max(
        minHeight,
        Math.min(scrollHeight, maxHeight)
    );

    // Appliquer la nouvelle hauteur
    element.style.height = `${newHeight}px`;

    // Ajouter/retirer la classe scrollable si nécessaire
    if (scrollHeight > maxHeight) {
        element.classList.add('scrollable');
    } else {
        element.classList.remove('scrollable');
    }

    // Restaurer la position du curseur
    element.setSelectionRange(cursorPosition, cursorPosition);

    // Déclencher un événement personnalisé
    element.dispatchEvent(new CustomEvent('heightAdjusted', {
        detail: {
            height: newHeight,
            scrollHeight: scrollHeight,
            isScrollable: scrollHeight > maxHeight
        },
        bubbles: true
    }));
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

// Fonction pour effectuer une requête Ajax
function ajaxFct(formdata, destUrl) {
    return fetch(destUrl, {
        method: "POST",
        body: formdata,
        credentials: "include"
    })
        .then(response => {
            // Vérifie que la réponse est correcte
            return response.text().then(rawText => {
                try {
                    const jsonResponse = JSON.parse(rawText);
                    console.log("Réponse JSON du serveur :", jsonResponse);

                    // Vérifie si le serveur retourne une erreur
                    if (jsonResponse.error === 1) {
                        console.error("Erreur du serveur :", jsonResponse.msgError);
                    }

                    return jsonResponse; // Retourne la réponse JSON si tout va bien
                } catch (error) {
                    console.error("Erreur de parsing JSON :", error.message, "- Réponse brute :", rawText);
                }
            });
        })
        .catch(error => {
            console.error("AJAX Error:", error);
            throw error; // Relance l'erreur pour la gérer au niveau supérieur
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
        dismissible: false
    });
}

function errorNotice(title = "", msg = "", duration = 5000, customClass = "notice__error") {
    notifyFlow.error(msg, title, {
        duration: duration,
        customClass: customClass,
        progress: true,
        icon: '<i class="fa fa-xmark"></i>',
        dismissible: false
    });
}

function infoNotice(title = "", msg = "", duration = 5000, customClass = "notice__info") {
    notifyFlow.info(msg, title, {
        duration: duration,
        customClass: customClass,
        progress: true,
        icon: '<i class="fa fa-circle-info"></i>',
        dismissible: false
    });
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
