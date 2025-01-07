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
    document.querySelectorAll('.grid_hours').forEach(hour => hour.remove());
    const first_case_time = getFirstCaseTime(case_pos_now, interval, debug_hour);

    for (let i = 0; i < nb_quart_heure; i++) {
        const case_time = new Date(first_case_time.getTime() + i * interval * 60000);
        const case_hour = case_time.getHours();
        const case_minute = case_time.getMinutes();

        const overlay = document.createElement('div');
        overlay.className = `overlay grid_hours gpc-${i + 1}`;
        overlay.textContent = case_minute === 0 ? `${case_hour}h` : '';

        document.querySelector('.grid__cie').appendChild(overlay);
    }
}

/**
 * Envoie une requête AJAX pour récupérer les informations PAM.
 */
function getPAM(debug_date, debug_hour) {
    document.querySelectorAll('.pam__tph-input').forEach(input => {
        if (!input.classList.contains("noupdate")) {
            const formData = new FormData();
            formData.set("cu", input.value);
            formData.set("debug_hour", debug_hour);
            formData.set("debug_date", debug_date);

            const destUrl = `${window.WEB_PAGES}/show/getPAM.php`;
            ajaxFct(formData, destUrl).then(resultat => {
                if (resultat.erreur === 0) {
                    document.querySelector(`#pam_tph_${resultat.cu} .pam__tph-name`).innerHTML = resultat.nom;
                    document.querySelector(`#pam_tph_${resultat.cu} .pam__tph-value`).innerHTML = resultat.tph;
                }
            }).catch(() => errorNotice("Erreur dans la mise à jour"));
        }
    });
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

    const destUrl = `${window.WEB_PAGES}/show/getTimelineBlocks.php`;

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
 * Initialise les tooltips pour les blocs de la timeline.
 */
function initializeTippy() {
    document.querySelectorAll('.timeline__block-content').forEach(element => {
        const id = element.id;
        if (id && id.startsWith('timeline__block-')) {
            const extractedId = id.substring('timeline__block-'.length);
            const content = document.getElementById(`tooltip__content-${extractedId}`);
            if (content) {
                tippy(`#timeline__block-${extractedId}`, {
                    content: content.innerHTML,
                    allowHTML: true,
                });
            }
        }
    });
}

/**
 * Affiche le modal pour ajouter un bloc.
 */
function showAddBlock(cu, prd) {
    modalFlow.open({
        url: `${window.WEB_PAGES}/show/modal/addBlock.php?cu=${cu}&prd=${prd}`,
        title: 'Ajouter un bloc',
        onConfirm: () => {
            addBlock();
        }
    });
}

/**
 * Affiche le modal pour mettre à jour un bloc.
 */
function showUpdateBlock(id) {
    modalFlow.open({
        url: `${window.WEB_PAGES}/show/modal/updateBlock.php?id=${id}`,
        title: 'Modifier le bloc',
        onConfirm: () => {
            updateBlock();
        }
    });
}

/**
 * Affiche le modal pour mettre à jour les PAM d'une journée.
 */
function showUpdatePAM(cu) {
    modalFlow.open({
        url: `${window.WEB_PAGES}/show/modal/updatePAM.php?cu=${cu}`,
        title: 'Modifier les PAM',
        onConfirm: () => {
            updatePAM();
        }
    });
}

/**
 * Met à jour un bloc.
 */
async function updateBlock() {
    const formData = new FormData(document.getElementById("modal-form"));
    const destUrl = `${window.WEB_PAGES}/show/updateBlock.php`;

    try {
        const response = await ajaxFct(formData, destUrl);
        if (response.erreur === 0) {
            successNotice("Modification du service effectuée avec succès", 1000);
            window.location.reload();
        } else {
            errorNotice(response.message || "Erreur dans la modification du service");
        }
    } catch (error) {
        errorNotice("Erreur dans la mise à jour");
    }
}

/**
 * Met à jour un PAM.
 */
async function updatePAM() {
    const formData = new FormData(document.getElementById("modal-form"));
    const destUrl = `${window.WEB_PAGES}/show/updatePAM.php`;

    try {
        const response = await ajaxFct(formData, destUrl);
        if (response.erreur === 0) {
            successNotice("Modification du PAM effectuée avec succès", 1000);
            window.location.reload();
        } else {
            errorNotice(response.message || "Erreur dans la modification du PAM");
        }
    } catch (error) {
        errorNotice("Erreur dans la mise à jour");
    }
}

/**
 * Ajoute un bloc.
 */
async function addBlock() {
    const formData = new FormData(document.getElementById("modal-form"));
    const destUrl = `${window.WEB_PAGES}/show/addBlock.php`;

    try {
        const response = await ajaxFct(formData, destUrl);
        if (response.erreur === 0) {
            successNotice("Ajout du service effectué avec succès", 1000);
            window.location.reload();
        } else {
            errorNotice(response.message || "Erreur dans l'ajout du service");
        }
    } catch (error) {
        errorNotice("Erreur dans la mise à jour");
    }
}

/**
 * Supprime un bloc.
 */
async function deleteBlock(id) {
    modalFlow.confirm({
        title: 'Confirmation',
        content: 'Voulez-vous vraiment supprimer ce bloc ?',
        onConfirm: () => {
            $.ajax({
                url: `${window.WEB_PAGES}/show/modal/deleteBlock.php`,
                method: 'POST',
                data: { id: id },
                success: function (response) {
                    if (response.status === 'success') {
                        modalFlow.close();
                        notifyFlow.success('Le bloc a été supprimé avec succès');
                        updateTimelineBlock();
                    } else {
                        notifyFlow.error('Erreur lors de la suppression du bloc');
                    }
                },
                error: function () {
                    notifyFlow.error('Erreur lors de la suppression du bloc');
                }
            });
        }
    });
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


function showFcts(nb_quart_heure, case_pos_now, interval, debug_date, debug_hour) {
    updateHours(nb_quart_heure, case_pos_now, interval, debug_hour);
    updateTimelineRedBar(nb_quart_heure, case_pos_now, interval, debug_hour);
    getPAM(debug_date, debug_hour);
    updateTimelineBlock(nb_quart_heure, case_pos_now, interval, debug_date, debug_hour);
}