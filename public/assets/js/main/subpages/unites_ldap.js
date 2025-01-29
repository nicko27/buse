function getUnits() {
    const formData = new FormData();
    formData.append("fill", 1);
    const url = window.WEB_PAGES + `/main/subpages/unites/unitsHandler.php`;
    infoNotice("Chargement des unités", "Chargement en cours");
    // Appelle la fonction ajaxFct pour envoyer la requête
    document.getElementById("maj__text-update").classList.remove("hidden");
    ajaxFct(formData, url)
        .then((response) => {
            document.getElementById("maj__text-update").classList.add("hidden");
            console.dir(response);
            if (response && response.error === 0) {
                successNotice("Chargement des unités", "Chargement effectué avec succès, Veuillez recharger la page", 5000);
            } else {
                errorNotice("Chargement des unités", "Une erreur a eu lieu lors de la mise à jour des unités");
            }
        })
        .catch((error) => {
            console.log("rejectcatch:" + error);
            errorNotice("Une erreur a eu lieu lors de la mise à jour des unités");
        });

}
