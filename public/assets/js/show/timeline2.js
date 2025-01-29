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

    document.querySelectorAll('.cie__content').forEach(content => {
        const firstGridUnit = content.querySelector('.grid__unit');

        if (firstGridUnit) {
            const contentRect = content.getBoundingClientRect();
            const gridLeft = firstGridUnit.getBoundingClientRect().left + window.scrollX + 5;
            const expectedWidthPercentage = getPercentageOfCurrentTime(case_pos_now, interval, nb_quart_heure, debug_hour);
            const finalLeft = gridLeft + (firstGridUnit.offsetWidth * (expectedWidthPercentage / 100));

            const overlay = document.createElement('div');
            overlay.className = "overlay timeline__redbar";
            overlay.style.top = `${contentRect.top + window.scrollY}px`;
            overlay.style.left = `${finalLeft}px`;
            overlay.style.height = `${contentRect.height}px`;

            document.body.appendChild(overlay);
        }
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
            lineElement.classList.toggle('hidden', hide);
        }
    });

    // Traitement des lignes BP dans les groupes
    const bpLines = cieBlock.querySelectorAll('.grp_line_grid .line_bp');
    bpLines.forEach(lineElement => {
        const hasPamPresent = lineElement.querySelector('.pam__present');
        const hasTimelineBlock = lineElement.querySelector('.timeline__block');
        const isEmpty = !hasPamPresent && !hasTimelineBlock;

        if (isEmpty) {
            lineElement.classList.toggle('hidden', hide);
        }
    });
}

/**
 * Initialise et gère les switches pour le masquage des lignes
 * @returns {Promise} Une promesse résolue quand toutes les lignes sont masquées/affichées
 */
function autoHideLines() {
    return new Promise((resolve) => {
        document.querySelectorAll('.cie-switch').forEach(switchElement => {
            const cieId = switchElement.id.replace('switch-', '');
            const cieBlock = document.getElementById(cieId);

            // Appliquer l'état aux lignes
            if (cieBlock) {
                hideEmptyLines(cieBlock, switchElement.checked);
            }

            // Ajouter l'écouteur d'événements s'il n'existe pas déjà
            if (!switchElement.hasAttribute('data-initialized')) {
                switchElement.addEventListener('change', function () {
                    if (cieBlock) {
                        hideEmptyLines(cieBlock, this.checked);
                        if (window.NB_QUART_HEURE && window.CASE_POS_NOW && window.INTERVAL) {
                            updateTimelineRedBar(window.NB_QUART_HEURE, window.CASE_POS_NOW, window.INTERVAL);
                        }
                    }
                });
                switchElement.setAttribute('data-initialized', 'true');
            }
        });
        // Utiliser requestAnimationFrame pour s'assurer que le DOM est mis à jour
        requestAnimationFrame(() => resolve());
    });
}

/**
 * Envoie une requête AJAX pour récupérer les informations PAM
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
 * Fonction principale de mise à jour
 */
const showFcts = memorizeLastCall(function (nb_quart_heure, case_pos_now, interval, debug_date = 0, debug_hour = 0) {
    if (typeof nb_quart_heure === 'undefined' || typeof case_pos_now === 'undefined' || typeof interval === 'undefined') {
        console.error('Paramètres manquants pour showFcts');
        return;
    }

    updateHours(nb_quart_heure, case_pos_now, interval, debug_hour);
    updateTimelineBlock(nb_quart_heure, case_pos_now, interval, debug_date, debug_hour);
    getPAM(debug_date, debug_hour).then(() => {
        autoHideLines().then(() => {
            updateTimelineRedBar(nb_quart_heure, case_pos_now, interval, debug_hour);
        });
    });
});

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
                        block.className = `timeline__block grs-${entry.start_line} gre-${entry.end_line + 1} gcs-${entry.start_column} gce-${entry.end_column}`;
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
                showFcts.recall();
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
                    showFcts.recall();
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
 * Définit un cookie.
 */
function setCookie(name, value) {
    const date = new Date();
    date.setTime(date.getTime() + (365 * 24 * 60 * 60 * 1000 * 100));
    document.cookie = `${name}=${value || ""}; expires=${date.toUTCString()}; path=/`;
}

/**
 * Récupère un cookie par son nom.
 */
function getCookie(name) {
    const nameEQ = `${name}=`;
    const cookiesArray = document.cookie.split(';');
    for (let cookie of cookiesArray) {
        cookie = cookie.trim();
        if (cookie.startsWith(nameEQ)) return cookie.substring(nameEQ.length);
    }
    return null;
}

// Fonction pour mémoriser les derniers arguments
function memorizeLastCall(fn) {
    let lastArgs = null;

    const wrapper = function (...args) {
        if (args.length > 0) {
            lastArgs = args;
        }
        return fn.apply(this, lastArgs || []);
    };

    wrapper.recall = function () {
        return fn.apply(this, lastArgs || []);
    };

    return wrapper;
}

/**
 * Vérifie si les variables globales nécessaires sont définies
 */
function checkTimelineVars() {
    return (
        typeof window.NB_QUART_HEURE !== 'undefined' &&
        typeof window.CASE_POS_NOW !== 'undefined' &&
        typeof window.INTERVAL !== 'undefined'
    );
}

/**
 * Met à jour la timeline complète
 */
function showFcts(nb_quart_heure, case_pos_now, interval, debug_date, debug_hour) {
    if (!checkTimelineVars()) {
        return;
    }

    updateHours(nb_quart_heure, case_pos_now, interval, debug_hour);
    updateTimelineBlock(nb_quart_heure, case_pos_now, interval, debug_date, debug_hour);
    getPAM(debug_date, debug_hour).then(() => {
        autoHideLines().then(() => {
            updateTimelineRedBar(nb_quart_heure, case_pos_now, interval, debug_hour);
        });
    });
}