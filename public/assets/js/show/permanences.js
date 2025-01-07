async function showAddMemo(web_pages) {
    const formData = new FormData();
    const destUrl = `${web_pages}/show/showAddMemo.php`;

    try {
        const resultat = await ajaxFct(formData, destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal").innerHTML = resultat.html;
            document.getElementById("modal-overlay").classList.remove("hidden");
            document.getElementById("modal").classList.remove("hidden");
            textAreaAdjust(document.querySelector("textarea"));
            new AirDatepicker('#start-date', { inline: true, selectedDates: [new Date(resultat.startDate)] });
            new AirDatepicker('#end-date', { inline: true, selectedDates: [new Date(resultat.endDate)] });
        }
    } catch (error) {
        errorNotice("Erreur dans l'ajout");
    }
}

async function showUpdateMemo(web_pages, memoId) {
    const formData = new FormData();
    formData.set('memoId', memoId);
    const destUrl = `${web_pages}/show/showUpdateMemo.php`;

    try {
        const resultat = await ajaxFct(formData, destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal").innerHTML = resultat.html;
            document.getElementById("modal-overlay").classList.remove("hidden");
            document.getElementById("modal").classList.remove("hidden");
            textAreaAdjust(document.querySelector("textarea"));
            new AirDatepicker('#start-date', { inline: true, selectedDates: [new Date(resultat.startDate)] });
            new AirDatepicker('#end-date', { inline: true, selectedDates: [new Date(resultat.endDate)] });
        }
    } catch (error) {
        errorNotice("Erreur dans la mise à jour du mémo");
    }
}

async function updateMemo(web_pages) {
    const destUrl = `${web_pages}/show/updateMemo.php`;

    try {
        const form = document.querySelector("form#modal-form");
        const resultat = await ajaxFct(new FormData(form), destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal-overlay").classList.add("hidden");
            document.getElementById("modal").classList.add("hidden");
            successNotice("Modification du mémo effectué avec succès", 1000);
            window.location.reload();
        }
    } catch (error) {
        errorNotice("Erreur dans l'ajout");
    }
}

async function addMemo(web_pages) {
    const destUrl = `${web_pages}/show/addMemo.php`;

    try {
        const form = document.querySelector("form#modal-form");
        const resultat = await ajaxFct(new FormData(form), destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal-overlay").classList.add("hidden");
            document.getElementById("modal").classList.add("hidden");
            successNotice("Ajout du mémo effectué avec succès", 1000);
            window.location.reload();
        }
    } catch (error) {
        errorNotice("Erreur dans l'ajout");
    }
}

async function deleteMemo(web_pages, id) {
    const destUrl = `${web_pages}/show/deleteMemo.php`;
    const formData = new FormData();
    formData.set('memoId', id);

    try {
        const resultat = await ajaxFct(formData, destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal-overlay").classList.add("hidden");
            document.getElementById("modal").classList.add("hidden");
            successNotice("Suppression du mémo effectué avec succès", 1000);
            window.location.reload();
        }
    } catch (error) {
        errorNotice("Erreur dans l'ajout");
    }
}

async function showAddSite(web_pages) {
    const formData = new FormData();
    const destUrl = `${web_pages}/show/showAddSite.php`;

    try {
        const resultat = await ajaxFct(formData, destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal").innerHTML = resultat.html;
            document.getElementById("modal-overlay").classList.remove("hidden");
            document.getElementById("modal").classList.remove("hidden");
        }
    } catch (error) {
        errorNotice("Erreur dans l'ajout");
    }
}

async function showUpdateSite(web_pages, siteId) {
    const formData = new FormData();
    formData.set('siteId', siteId);
    const destUrl = `${web_pages}/show/showUpdateSite.php`;

    try {
        const resultat = await ajaxFct(formData, destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal").innerHTML = resultat.html;
            document.getElementById("modal-overlay").classList.remove("hidden");
            document.getElementById("modal").classList.remove("hidden");
        }
    } catch (error) {
        errorNotice("Erreur dans la mise à jour du lien du site");
    }
}

async function updateSite(web_pages) {
    const destUrl = `${web_pages}/show/updateSite.php`;

    try {
        const form = document.querySelector("form#modal-form");
        const resultat = await ajaxFct(new FormData(form), destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal-overlay").classList.add("hidden");
            document.getElementById("modal").classList.add("hidden");
            successNotice("Modification du lien du site effectué avec succès", 1000);
            window.location.reload();
        }
    } catch (error) {
        errorNotice("Erreur dans l'ajout");
    }
}

async function addSite(web_pages) {
    const destUrl = `${web_pages}/show/addSite.php`;

    try {
        const form = document.querySelector("form#modal-form");
        const resultat = await ajaxFct(new FormData(form), destUrl);
        if (resultat.erreur === 0) {
            document.getElementById("modal-overlay").classList.add("hidden");
            document.getElementById("modal").classList.add("hidden");
            successNotice("Ajout du lien du site effectué avec succès", 1000);
            window.location.reload();
        }
    } catch (error) {
        errorNotice("Erreur dans l'ajout");
    }
}
