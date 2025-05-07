let refreshInterval;

async function fillFilesList() {
    const filesListElement = document.getElementById("files__list");
    const destUrl = window.WEB_PAGES + '/main/subpages/import/listFiles.php';

    // Ajouter l'indicateur de chargement
    filesListElement.classList.add('loading');
    filesListElement.innerHTML = '<div class="spinner">Chargement...</div>';

    try {
        const resultat = await ajaxFct(null, destUrl);
        if (resultat.erreur === 0) {
            // Ajouter une animation de fondu
            filesListElement.style.opacity = '0';
            setTimeout(() => {
                filesListElement.innerHTML = resultat.html;
                filesListElement.style.opacity = '1';
            }, 200);
        } else {
            throw new Error(resultat.message || "Erreur lors de la récupération des fichiers");
        }
    } catch (error) {
        console.error("Erreur dans fillFilesList:", error);
        errorNotice("Erreur dans la mise à jour: " + error.message, 3000);
        filesListElement.innerHTML = '<div class="error-message">Impossible de charger la liste des fichiers</div>';
    } finally {
        filesListElement.classList.remove('loading');
    }
}

// Fonction pour démarrer le rafraîchissement automatique
function startAutoRefresh(intervalMs = 30000) {
    stopAutoRefresh(); // Arrêter l'intervalle existant si présent
    refreshInterval = setInterval(fillFilesList, intervalMs);
}

// Fonction pour arrêter le rafraîchissement automatique
function stopAutoRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}

// Démarrer le rafraîchissement automatique au chargement
document.addEventListener('DOMContentLoaded', () => {
    fillFilesList();
    startAutoRefresh();
});

// Arrêter le rafraîchissement quand la page est masquée
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        stopAutoRefresh();
    } else {
        fillFilesList(); // Rafraîchir immédiatement
        startAutoRefresh();
    }
});

function updateSynthesis() {
    const destUrl = window.WEB_PAGES + '/main/subpages/import/updateSynthesis.php';
    const progressContainer = document.getElementById('maj__text-update');
    const progressBar = progressContainer.querySelector('.progress-bar');
    const normalIcon = document.getElementById('maj__text-normal');

    // Afficher la barre de progression
    progressContainer.classList.remove('hidden');
    progressBar.classList.add('indeterminate');
    normalIcon.classList.add('fa-spin');

    // Ajout de logs de débogage
    console.log("Début de updateSynthesis");
    infoNotice("Mise à jour", "Chargement des nouvelles synthèses en cours", 10000);

    ajaxFct(null, destUrl, 0).then((resultat) => {
        console.log("Résultat reçu :", resultat);

        if (resultat.erreur === 0) {
            console.log("Succès détecté");
            successNotice("Mise à jour", "Chargement des nouvelles synthèses effectué avec succès", 10000);
        } else {
            console.log("Erreur détectée");
            errorNotice("Mise à jour", "Echec du chargement des nouvelles synthèses", 10000);
            console.dir(resultat);
        }
    }).catch((error) => {
        console.error("Erreur lors de l'appel :", error);
        errorNotice("Erreur", "Erreur technique", 10000);
    }).finally(() => {
        // Cacher la barre de progression après un court délai
        setTimeout(() => {
            progressBar.classList.remove('indeterminate');
            progressContainer.classList.add('hidden');
            normalIcon.classList.remove('fa-spin');
        }, 500);
    });
}

function updatePatrolsPerms() {
    const destUrl = window.WEB_PAGES + '/main/subpages/import/updatePatrolsPerms.php';
    const progressContainer = document.getElementById('maj__text-update');
    const progressBar = progressContainer.querySelector('.progress-bar');
    const normalIcon = document.getElementById('maj__text-normal');

    // Afficher la barre de progression
    progressContainer.classList.remove('hidden');
    progressBar.classList.add('indeterminate');
    normalIcon.classList.add('fa-spin');

    // Ajout de logs de débogage
    console.log("Début de updatePatrolsPerms");
    infoNotice("Mise à jour", "Chargement des services et des permanences en cours", 10000);

    ajaxFct(null, destUrl, 0).then((resultat) => {
        console.log("Résultat reçu :", resultat);

        if (resultat.erreur === 0) {
            console.log("Succès détecté");
            successNotice("Mise à jour", "Chargement des services et des permanences effectuée avec succès", 10000);
        } else {
            console.log("Erreur détectée");
            errorNotice("Mise à jour", "Echec du chargement des services et des permanences", 10000);
            console.dir(resultat);
        }
    }).catch((error) => {
        console.error("Erreur lors de l'appel :", error);
        errorNotice("Erreur", "Erreur technique", 10000);
    }).finally(() => {
        // Cacher la barre de progression après un court délai
        setTimeout(() => {
            progressBar.classList.remove('indeterminate');
            progressContainer.classList.add('hidden');
            normalIcon.classList.remove('fa-spin');
        }, 500);
    });
}