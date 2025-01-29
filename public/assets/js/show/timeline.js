/**
 * Met à jour la barre rouge verticale sur la grille de la timeline.
 *
 * @param {number} nb_quart_heure - Nombre de quarts d'heure à considérer.
 * @param {number} case_pos_now - Position actuelle de la case (1 pour la première case, etc.).
 * @param {number} interval - Intervalle en minutes entre les cases.
 * @param {string} debug_hour - Heure choisie en debug, formatée en "HH:MM" ou 0 si non utilisée.
 */
function updateTimelineRedBar(nb_quart_heure, case_pos_now, interval, debug_hour = 0) {
    document.querySelectorAll('.overlay.timeline__redbar').forEach(bar => bar.remove());

    // Calculer le pourcentage une seule fois car il est le même pour toutes les grilles
    const expectedWidthPercentage = getPercentageOfCurrentTime(case_pos_now, interval, nb_quart_heure, debug_hour);

    document.querySelectorAll('.cie__content').forEach(content => {
        // Trouver la grille visible la plus à gauche dans ce contenu
        const visibleGrids = Array.from(content.querySelectorAll('.grid__unit')).filter(grid => {
            let parent = grid.parentElement;
            while (parent && parent !== content) {
                if (parent.style.display === 'none') return false;
                parent = parent.parentElement;
            }
            return true;
        });

        const firstVisibleGrid = visibleGrids[0];
        if (!firstVisibleGrid) return;

        const contentRect = content.getBoundingClientRect();
        const gridRect = firstVisibleGrid.getBoundingClientRect();

        // Calculer l'offset spécifique pour cette grille
        const offset = firstVisibleGrid.offsetWidth * (expectedWidthPercentage / 100);

        const overlay = document.createElement('div');
        overlay.className = "overlay timeline__redbar";
        overlay.style.top = `${contentRect.top + window.scrollY}px`;
        overlay.style.left = `${gridRect.left + window.scrollX + offset}px`;
        overlay.style.height = `${contentRect.height}px`;

        document.body.appendChild(overlay);
    });
}

/**
 * Calcule le pourcentage de la largeur de la grille correspondant à l'heure actuelle.
 */
function getPercentageOfCurrentTime(case_pos_now, interval, nb_quart_heure, debug_hour) {
    const first_case_time = getFirstCaseTime(case_pos_now, interval, debug_hour);
    const last_case_time = getLastCaseTime(case_pos_now, interval, nb_quart_heure + 1, debug_hour);

    const current_time = new Date();
    if (debug_hour !== 0 && /^\d{2}:\d{2}$/.test(debug_hour)) {
        const [hour, minute] = debug_hour.split(':').map(Number);
        current_time.setHours(hour, minute, 0, 0);
    }
    const total_time_minutes = (last_case_time - first_case_time) / 60000;
    const elapsed_time_minutes = (current_time - first_case_time) / 60000;
    const percentage = (elapsed_time_minutes / total_time_minutes) * 100;

    return Math.max(0, Math.min(percentage, 100));
}

/**
 * Obtient l'heure de la première case.
 */
function getFirstCaseTime(case_pos_now, interval, debug_hour) {
    let current_time = new Date();
    if (debug_hour !== 0 && /^\d{2}:\d{2}$/.test(debug_hour)) {
        const [hour, minute] = debug_hour.split(':').map(Number);
        current_time.setHours(hour, minute, 0, 0);
    }

    const rounded_minute = Math.floor(current_time.getMinutes() / interval) * interval;
    current_time.setMinutes(rounded_minute, 0, 0);

    const first_case_minute_offset = (case_pos_now - 1) * interval;
    const first_case_time = new Date(current_time.getTime());
    first_case_time.setMinutes(current_time.getMinutes() - first_case_minute_offset);

    return first_case_time;
}

/**
 * Obtient l'heure de la dernière case.
 */
function getLastCaseTime(case_pos_now, interval, nb_quart_heure, debug_hour) {
    const first_case_time = getFirstCaseTime(case_pos_now, interval, debug_hour);
    const total_minutes = nb_quart_heure * interval;
    const last_case_time = new Date(first_case_time.getTime());
    last_case_time.setMinutes(first_case_time.getMinutes() + total_minutes);

    return last_case_time;
}

/**
 * Met à jour les heures sur la grille.
 */
function updateHours(nb_quart_heure, case_pos_now, interval, debug_hour) {
    const grids = document.querySelectorAll('.grid__cie');

    // Supprimer les anciens overlays
    document.querySelectorAll('.overlay.grid_hours').forEach(overlay => overlay.remove());

    const first_case_time = getFirstCaseTime(case_pos_now, interval, debug_hour);

    // Créer les nouveaux overlays pour chaque quart d'heure
    for (let i = 0; i < nb_quart_heure; i++) {
        const case_time = new Date(first_case_time.getTime() + i * interval * 60000);
        const case_hour = case_time.getHours();
        const case_minute = case_time.getMinutes();

        // Pour chaque grille, créer un overlay
        grids.forEach(grid => {
            const overlay = document.createElement('div');
            overlay.className = `overlay grid_hours gpc-${i + 1}`;
            overlay.textContent = case_minute === 0 ? `${case_hour}h` : '';
            grid.appendChild(overlay);
        });
    }
}

/**
 * Envoie une requête AJAX pour récupérer les informations PAM
 * @returns {Promise} Une promesse résolue quand tous les PAM sont mis à jour
 */
function getPAM(debug_date = 0, debug_hour = 0) {
    const promises = [];

    document.querySelectorAll('.pam__tph-input').forEach(input => {
        if (!input.classList.contains("noupdate")) {
            const formData = new FormData();
            formData.set("cu", input.value);
            formData.set("debug_hour", debug_hour);
            formData.set("debug_date", debug_date);

            const destUrl = `${window.WEB_PAGES}/show/PAM/getPAM.php`;
            const promise = ajaxFct(formData, destUrl)
                .then(resultat => {
                    const elt = document.querySelector(`#pam_tph_${resultat.cu}`);
                    if (elt !== null) {
                        if (resultat.erreur === 0) {
                            elt.classList.add('pam__present');
                            elt.querySelector('.pam__tph-name').innerHTML = resultat.nom || '';
                            elt.querySelector('.pam__tph-value').innerHTML = resultat.tph || '';
                        } else {
                            elt.classList.remove('pam__present');
                            elt.querySelector('.pam__tph-name').innerHTML = '';
                            elt.querySelector('.pam__tph-value').innerHTML = '';
                        }
                    }
                })
                .catch(error => {
                    console.error('Erreur lors de la récupération des PAM:', error);
                });
            promises.push(promise);
        }
    });

    return Promise.all(promises);
}

/**
 * Met à jour les blocs de la timeline.
 */
async function updateTimelineBlock(nb_quart_heure, case_pos_now, interval, debug_date, debug_hour) {
    const formData = new FormData();
    formData.set('nb_quart_heure', nb_quart_heure);
    formData.set('case_pos_now', case_pos_now);
    formData.set('interval', interval);
    formData.set('debug_hour', debug_hour);
    formData.set('debug_date', debug_date);

    const destUrl = `${window.WEB_PAGES}/show/blocks/getTimelineBlocks.php`;

    try {
        const resultat = await ajaxFct(formData, destUrl);
        if (resultat.erreur === 0) {
            updateTimelineBlockOverlay(resultat);
        }
    } catch (error) {
        errorNotice("Erreur dans la mise à jour", 1000);
    }
}

/**
 * Met à jour les overlays des blocs de la timeline.
 */
function updateTimelineBlockOverlay(data) {
    document.querySelectorAll('.timeline__block').forEach(block => block.remove());

    if (data.parCu && typeof data.parCu === 'object') {
        for (const cu in data.parCu) {
            if (Array.isArray(data.parCu[cu])) {
                data.parCu[cu].forEach(entry => {
                    if (entry.start_line > 0) {
                        const block = document.createElement('div');
                        block.className = `timeline__block  gcs-${entry.start_column} gce-${entry.end_column}`;
                        block.innerHTML = entry.divContent;
                        block.style.backgroundColor = entry.suColor || entry.sColor || '';

                        const gridElement = document.querySelector(`.grid_${cu}`);
                        if (gridElement) {
                            gridElement.appendChild(block);
                        } else {
                            console.warn(`Grid element .grid_${cu} not found`);
                        }
                    }
                });
            } else {
                console.warn(`data.parCu[${cu}] is not an array`);
            }
        }
    } else {
        console.warn("Invalid data.parCu:", data.parCu);
    }
}

/**
 * Affiche le modal pour ajouter un bloc.
 */
function showAddBlock() {
    console.log('showAddBlock called');
    modalFlow.createAndOpen({
        url: `${window.WEB_PAGES}/show/modal/block/showAddBlock.php`,
        showCloseButton: false,
        onContentLoaded: () => {
            console.log('Modal content loaded, initializing components...');
            window.dateFlow = new DateFlow();
        },
        onError: (error) => {
            console.error('Modal error:', error);
            if (error.msgError) {
                errorNotice(error.msgError);
            }
        }
    });
}

function showUpdateBlock(id) {
    console.log('showUpdateBlock called');
    modalFlow.createAndOpen({
        url: `${window.WEB_PAGES}/show/modal/block/showUpdateBlock.php`,
        showCloseButton: false,
        params: { id: id },
        onContentLoaded: () => {
            console.log('Modal content loaded, initializing components...');
            window.dateFlow = new DateFlow();
        },
        onError: (error) => {
            console.error('Modal error:', error);
            if (error.msgError) {
                errorNotice(error.msgError);
            }
        }
    });
}


/**
 * Affiche le modal pour mettre à jour les PAM d'une journée.
 * @param {string} cu - Code unité
 */
function showUpdatePAM(cu) {
    modalFlow.createAndOpen({
        url: `${window.WEB_PAGES}/show/modal/PAM/showUpdatePAM.php`,
        params: { cu: cu },
        showCloseButton: false,
        onError: (error) => {
            if (error.msgError) {
                errorNotice(error.msgError);
            }
        }
    });
}

/**
 * Met à jour un PAM.
 */
function updatePAM() {
    const form = document.getElementById('modal-form-pam');
    const formData = new FormData(form);

    const destUrl = `${window.WEB_PAGES}/show/modal/PAM/updatePAM.php`;

    ajaxFct(formData, destUrl)
        .then(resultat => {
            if (resultat.erreur === false) {
                // Mettre à jour l'affichage des PAM
                const cu = form.querySelector('#cu').value;
                getPAM();
                modalFlow.close(); // Fermer la modale
                successNotice("PAM mis à jour avec succès");
            } else {
                errorNotice(resultat.msgError || "Erreur lors de la mise à jour du PAM");
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            errorNotice("Erreur lors de la mise à jour du PAM");
        });
}

function updateBlock() {
    console.log('updateBlock called');
    const form = document.getElementById('modal-form-block');
    if (!form) {
        console.error('Form not found: modal-form-block');
        return;
    }

    const formData = new FormData(form);
    const destUrl = `${window.WEB_PAGES}/show/modal/block/updateBlock.php`;

    console.log('Submitting form...');
    ajaxFct(formData, destUrl)
        .then(resultat => {
            console.log('Form submission result:', resultat);
            if (resultat.erreur === false) {
                // Mettre à jour l'affichage des blocs
                window.showFcts.recall();
                modalFlow.close(); // Fermer la modale
                successNotice("Bloc mis à jour avec succès");
            } else {
                errorNotice(resultat.msgError || "Erreur lors de la mise à jour du bloc");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorNotice("Erreur lors de la mise à jour du bloc");
        });
}


/**
 * Met à jour un PAM.
 */
function updatePAM() {
    const form = document.getElementById('modal-form-pam');
    const formData = new FormData(form);

    const destUrl = `${window.WEB_PAGES}/show/modal/PAM/updatePAM.php`;

    ajaxFct(formData, destUrl)
        .then(resultat => {
            if (resultat.erreur === false) {
                // Mettre à jour l'affichage des PAM
                const cu = form.querySelector('#cu').value;
                getPAM();
                modalFlow.close(); // Fermer la modale
                successNotice("PAM mis à jour avec succès");
            } else {
                errorNotice(resultat.msgError || "Erreur lors de la mise à jour du PAM");
            }
        })
        .catch(error => {
            console.error('Erreur:', error);
            errorNotice("Erreur lors de la mise à jour du PAM");
        });
}

/**
 * Ajoute un bloc.
 */
function addBlock() {
    console.log('addBlock called');
    const form = document.getElementById('modal-form-block');
    if (!form) {
        console.error('Form not found: modal-form-block');
        return;
    }

    const formData = new FormData(form);
    const destUrl = `${window.WEB_PAGES}/show/modal/block/addBlock.php`;

    console.log('Submitting form...');
    ajaxFct(formData, destUrl)
        .then(resultat => {
            console.log('Form submission result:', resultat);
            if (resultat.erreur === false) {
                // Mettre à jour l'affichage des blocs
                window.showFcts.recall();
                modalFlow.close(); // Fermer la modale
                successNotice("Bloc ajouté avec succès");
            } else {
                errorNotice(resultat.msgError || "Erreur lors de l'ajout du bloc");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorNotice("Erreur lors de l'ajout du bloc");
        });
}

/**
 * Supprime un bloc.
 */
function deleteBlock(id) {
    if (confirm('Voulez-vous vraiment supprimer ce bloc ?')) {
        fetch(`${window.WEB_PAGES}/show/modal/block/deleteBlock.php`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id: id })
        })
            .then(response => response.json())
            .then(data => {
                if (!data.error) {
                    window.showFcts.recall();
                    modalFlow.close(); // Fermer la modale
                    notifyFlow.success(data.message || 'Le bloc a été supprimé avec succès');
                } else {
                    throw new Error(data.message || 'Erreur lors de la suppression du bloc');
                }
            })
            .catch(error => {
                console.error('Erreur:', error);
                notifyFlow.error(error.message || 'Erreur lors de la suppression du bloc');
            });
    }
}

/**
 * Initialise et gère les switches pour le masquage des lignes
 * @returns {Promise} Une promesse résolue quand toutes les lignes sont masquées/affichées
 */
function autoHideLines() {
    return new Promise((resolve) => {
        document.querySelectorAll('.cie-switch').forEach(switchElement => {
            const cieId = switchElement.dataset.cu;
            const cieBlock = document.getElementById(cieId);

            if (cieBlock) {
                // Si le switch n'est pas encore initialisé
                if (!switchElement.hasAttribute('data-initialized')) {
                    // Restaurer l'état depuis le cookie ou utiliser true par défaut
                    const savedState = getCookie(`switch_${cieId}`);
                    const initialState = savedState === null ? true : savedState === '1';

                    // Mettre à jour l'état du switch
                    switchElement.checked = initialState;

                    // Appliquer l'état visuel initial
                    hideEmptyLines(cieBlock, initialState);

                    // Ajouter l'écouteur d'événements
                    switchElement.addEventListener('change', function() {
                        // Mettre à jour l'affichage
                        hideEmptyLines(cieBlock, this.checked);

                        // Sauvegarder l'état dans un cookie
                        setCookie(`switch_${cieId}`, this.checked ? '1' : '0', 365);

                        // Attendre que le DOM soit mis à jour
                        setTimeout(() => {
                            // Mettre à jour la timeline complète
                            if (window.NB_QUART_HEURE && window.CASE_POS_NOW && window.INTERVAL) {
                                window.showFcts.recall();
                            }
                        }, 50);
                    });

                    switchElement.setAttribute('data-initialized', 'true');
                } else {
                    // S'assurer que l'état visuel correspond à l'état du switch
                    hideEmptyLines(cieBlock, switchElement.checked);
                }
            }
        });

        requestAnimationFrame(() => resolve());
    });
}

/**
 * Cache ou affiche les lignes vides d'un bloc spécifique
 * @param {HTMLElement} cieBlock - Le bloc de compagnie à traiter
 * @param {boolean} hide - True pour cacher, false pour afficher
 */
function hideEmptyLines(cieBlock, hide = true) {
    if (!cieBlock) return;

    // Traitement des lignes grp_line_grid.line_grid
    const mainLines = cieBlock.querySelectorAll('.grp_line_grid.line_grid');
    mainLines.forEach(lineElement => {
        const hasPamPresent = lineElement.querySelector('.pam__present');
        const hasTimelineBlock = lineElement.querySelector('.timeline__block');
        const isEmpty = !hasPamPresent && !hasTimelineBlock;

        if (isEmpty) {
            lineElement.style.display = hide ? 'none' : '';
        }
    });

    // Traitement des lignes BP dans les groupes
    const bpLines = cieBlock.querySelectorAll('.grp_line_grid .line_bp');
    bpLines.forEach(lineElement => {
        const hasPamPresent = lineElement.querySelector('.pam__present');
        const hasTimelineBlock = lineElement.querySelector('.timeline__block');
        const isEmpty = !hasPamPresent && !hasTimelineBlock;

        if (isEmpty) {
            lineElement.style.display = hide ? 'none' : '';
        }
    });
}

/**
 * Définit un cookie avec une durée de vie spécifiée
 * @param {string} name - Nom du cookie
 * @param {string} value - Valeur du cookie
 * @param {number} days - Nombre de jours avant expiration
 */
function setCookie(name, value, days = 365) {
    const d = new Date();
    d.setTime(d.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + d.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

/**
 * Récupère la valeur d'un cookie
 * @param {string} name - Nom du cookie
 * @returns {string|null} Valeur du cookie ou null si non trouvé
 */
function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

/**
 * Fonction pour mémoriser les derniers arguments d'appel
 * @param {Function} fn - Fonction à wrapper
 * @returns {Function} Fonction wrappée avec mémoire du dernier appel
 */
function memorizeLastCall(fn) {
    let lastArgs = null;

    const wrapper = function(...args) {
        if (args.length > 0) {
            lastArgs = args;
        } else if (!lastArgs) {
            console.error('Aucun argument mémorisé pour', fn.name);
            return;
        }
        return fn.apply(this, lastArgs);
    };

    wrapper.recall = function() {
        if (!lastArgs) {
            console.error('Aucun argument mémorisé pour', fn.name);
            return;
        }
        return fn.apply(this, lastArgs);
    };

    return wrapper;
}

/**
 * Vérifie si les variables globales nécessaires sont définies
 * @returns {boolean} True si toutes les variables sont définies
 */
function checkTimelineVars() {
    const requiredVars = ['NB_QUART_HEURE', 'CASE_POS_NOW', 'INTERVAL'];
    const missingVars = requiredVars.filter(varName => typeof window[varName] === 'undefined');

    if (missingVars.length > 0) {
        console.error('Variables globales manquantes:', missingVars.join(', '));
        return false;
    }
    return true;
}

// Déclaration de showFcts en tant que variable globale
window.showFcts = memorizeLastCall(function(nb_quart_heure, case_pos_now, interval, debug_date = null, debug_hour = null) {
    if (!checkTimelineVars()) {
        console.error('Variables de timeline manquantes');
        return;
    }

    // Mise à jour des heures d'abord
    updateHours(nb_quart_heure, case_pos_now, interval, debug_hour);

    // Chaîne de promesses
    return Promise.resolve()
        .then(() => getPAM(debug_date, debug_hour))
        .then(() => autoHideLines())
        .then(() => {
            updateTimelineRedBar(nb_quart_heure, case_pos_now, interval, debug_hour);
            updateTimelineBlock(nb_quart_heure, case_pos_now, interval, debug_date, debug_hour);
        })
        .catch(error => {
            console.error('Erreur lors de la mise à jour de la timeline:', error);
            errorNotice("Erreur", "Une erreur est survenue lors de la mise à jour de la timeline");
        });
});