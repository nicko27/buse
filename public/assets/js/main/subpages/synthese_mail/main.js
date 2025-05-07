function downloadMail(id) {
    const destUrl = window.WEB_PAGES + '/main/subpages/synthese_mail/mail.php';
    fd = new FormData();
    fd.append("id", id);

    ajaxFct(null, destUrl, 0).then((resultat) => {
        console.log("Résultat reçu :", resultat);

        if (resultat.erreur === 0) {
            console.log("Succès détecté");
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