/**
 * Affiche le modal pour ajouter un mémo.
 */
function showAddMemo() {
    console.log('showAddMemo called');
    modalFlow.createAndOpen({
        url: `${window.WEB_PAGES}/show/modal/memo/showAddMemo.php`,
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

/**
 * Affiche le modal pour mettre à jour un mémo.
 * @param {number} memoId - ID du mémo à mettre à jour
 */
function showUpdateMemo(memoId) {
    console.log('showUpdateMemo called');
    modalFlow.createAndOpen({
        url: `${window.WEB_PAGES}/show/modal/memo/showUpdateMemo.php`,
        showCloseButton: false,
        params: { id: memoId },
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
 * Met à jour un mémo existant.
 */
function updateMemo() {
    const form = document.getElementById('modal-form-memo');
    if (!form) {
        console.error('Form not found: modal-form-memo');
        return;
    }

    const formData = new FormData(form);
    const destUrl = `${window.WEB_PAGES}/show/modal/memo/updateMemo.php`;

    console.log('Submitting form...');
    ajaxFct(formData, destUrl)
        .then(resultat => {
            console.log('Form submission result:', resultat);
            if (resultat.erreur === false) {
                // Mettre à jour l'affichage des blocs
                modalFlow.close(); // Fermer la modale
                successNotice("Mémo mis à jour avec succès");
                window.location.reload();
            } else {
                errorNotice(resultat.msgError || "Erreur lors de la mise à jour du mémo");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorNotice("Erreur lors de la mise à jour du mémo");
        });
}

/**
 * Ajoute un nouveau mémo.
 */
function addMemo() {
    console.log('addMemo called');
    const form = document.getElementById('modal-form-memo');
    if (!form) {
        console.error('Form not found: modal-form-memo');
        return;
    }

    const formData = new FormData(form);
    const destUrl = `${window.WEB_PAGES}/show/modal/memo/addMemo.php`;

    console.log('Submitting form...');
    ajaxFct(formData, destUrl)
        .then(resultat => {
            console.log('Form submission result:', resultat);
            if (resultat.erreur === false) {
                // Mettre à jour l'affichage des blocs
                modalFlow.close(); // Fermer la modale
                successNotice("Mémo ajouté avec succès");
                window.location.reload();
            } else {
                errorNotice(resultat.msgError || "Erreur lors de l'ajout du mémo");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorNotice("Erreur lors de l'ajout du mémo");
        });
}

/**
 * Supprime un mémo.
 * @param {number} id - ID du mémo à supprimer
 */
function deleteMemo() {
    const form = document.getElementById('modal-form-memo');
    if (!form) {
        console.error('Form not found: modal-form-memo');
        return;
    }

    const formData = new FormData(form);
    const destUrl = `${window.WEB_PAGES}/show/modal/memo/deleteMemo.php`;

    console.log('Submitting form...');
    ajaxFct(formData, destUrl)
        .then(resultat => {
            console.log('Form submission result:', resultat);
            if (resultat.erreur === false) {
                // Mettre à jour l'affichage des blocs
                modalFlow.close(); // Fermer la modale
                successNotice("Mémo supprimé avec succès");
                window.location.reload();
            } else {
                errorNotice(resultat.msgError || "Erreur lors de la suppression du mémo");
            }
        })
        .catch(error => {
            console.error('Error:', error);
            errorNotice("Erreur lors de la suppression du mémo");
        });
}