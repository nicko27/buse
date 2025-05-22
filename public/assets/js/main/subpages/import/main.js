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

/*
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
            notifyFlow.notify({
                title: 'Envoi de mails',
                message: 'Le mail informant les unités va être envoyé automatiquement dans 10s, sauf si vous cliquez sur "Annuler"',
                type: 'info',
                duration: 0, // Ne pas fermer automatiquement
                dismissible: true,
                actions: [
                    {
                        id: 'confirm',
                        text: 'Confirmer maintenant',
                        class: 'primary',
                        callback: () => {
                            sendMail();
                        }
                    },
                    {
                        id: 'cancel',
                        text: 'Annuler',
                        callback: () => {
                            infoNotice('Action annulée', "Annulation de l'envoi du mail");
                        }
                    }
                ],
                autoAction: 'confirm', // L'ID de l'action à exécuter automatiquement
                autoActionDelay: 10000 // 10 secondes
            });
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
*/

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
    infoProgressIndeterminateNotice("updatePatrolsPerms", "Mise à jour", "Chargement des services et des permanences en cours",
        function () {
            // Fonction exécutée quand l'utilisateur clique sur la croix
            console.log("Opération annulée par l'utilisateur");

            // Annuler la requête en cours si possible
            if (abortController && abortController.abort) {
                abortController.abort();
            }

            // Annuler toute autre opération en cours
            if (ajaxRequest && ajaxRequest.cancelable) {
                ajaxRequest.cancel();
            }

            // Affichage d'une notification d'information
            infoNotice("Mise à jour", "Opération annulée par l'utilisateur", 3000);
        }
    );


    ajaxFct(null, destUrl).then((resultat) => {
        console.log("Résultat reçu :", resultat);

        if (resultat.erreur === 0) {
            console.log("Succès détecté");
            successProgressIndeterminateNotice("updatePatrolsPerms", "Mise à jour", "Chargement des services et des permanences effectuée avec succès", 3000);
        } else {
            console.log("Erreur détectée");
            errorProgressIndeterminateNotice("updatePatrolsPerms", "Mise à jour", "Echec du chargement des services et des permanences", 3000);
            console.dir(resultat);
        }
    }).catch((error) => {
        console.error("Erreur lors de l'appel :", error);
        errorProgressIndeterminateNotice("updatePatrolsPerms", "Erreur", "Erreur technique", 3000);
    }).finally(() => {
        // Cacher la barre de progression après un court délai
        setTimeout(() => {
            progressBar.classList.remove('indeterminate');
            progressContainer.classList.add('hidden');
            normalIcon.classList.remove('fa-spin');
        }, 500);
    });
}
/*
function sendMail() {
    const destUrl = window.WEB_PAGES + '/main/subpages/synthese_mail/sendMailNotificationSynthesis.php';
    // Ajout de logs de débogage
    console.log("Envoi du mail");
    infoNotice("Envoi du mail", "Envoi du mail en cours", 10000);

    ajaxFct(null, destUrl, 0).then((resultat) => {
        console.log("Résultat reçu :", resultat);

        if (resultat.success == true) {
            console.log("Succès détecté");
            successNotice("Envoi du mail", "Envoi du mail effectué avec succès", 10000);
        } else {
            console.log("Erreur détectée");
            errorNotice("Envoi du mail", "Echec dans l'envoi du mail", 10000);
            console.dir(resultat);
        }
    }).catch((error) => {
        console.error("Erreur lors de l'appel :", error);
        errorNotice("Erreur", "Erreur technique", 10000);
    });
}*/

function updateSynthesis() {
    const destUrl = window.WEB_PAGES + '/main/subpages/import/updateSynthesis.php';

    // Afficher notification indéterminée
    infoProgressIndeterminateNotice("updateSynthesis", "Mise à jour", "Chargement des nouvelles synthèses en cours",
        function () {
            // Fonction exécutée quand l'utilisateur clique sur la croix
            console.log("Opération annulée par l'utilisateur");

            // Annuler la requête en cours si possible
            if (abortController && abortController.abort) {
                abortController.abort();
            }

            // Annuler toute autre opération en cours
            if (ajaxRequest && ajaxRequest.cancelable) {
                ajaxRequest.cancel();
            }

            // Affichage d'une notification d'information
            infoNotice("Mise à jour", "Opération annulée par l'utilisateur", 3000);
        }
    );

    // Si ajaxFct attend (formdata, destUrl, options)
    const formData = new FormData(); // Créer un FormData vide si besoin

    // Adapter l'appel selon la signature de votre ajaxFct
    ajaxFct(formData, destUrl, {
        // Ajouter des options si nécessaire
        onUploadProgress: (progress) => {
            console.log('Upload progress:', progress.percent + '%');
        }
    }).then((resultat) => {
        console.log("Résultat reçu :", resultat);
        if (resultat.erreur === 0) {
            console.log("Succès détecté");
            successProgressIndeterminateNotice("updateSynthesis", "Mise à jour", "Chargement des nouvelles synthèses effectué avec succès", 3000);
            mailPrepare();
        } else {
            console.log("Erreur détectée");
            errorProgressIndeterminateNotice("updateSynthesis", "Erreur", "Echec du chargement des nouvelles synthèses", 3000);
            console.dir(resultat);
        }
    }).catch((error) => {
        console.error("Erreur lors de l'appel :", error);
        errorProgressIndeterminateNotice("updateSynthesis", "Erreur", "Erreur technique:" + error, 3000);
    });
}


function mailPrepare() {
    const destUrl = window.WEB_PAGES + '/main/subpages/mailSynthesis/prepare.php';

    // Ajout de logs de débogage
    console.log("Début de updateSynthesis");
    infoProgressIndeterminateNotice("mailPrepare", "Mise à jour", "Génération des fichiers pour les unités",
        function () {
            // Fonction exécutée quand l'utilisateur clique sur la croix
            console.log("Opération annulée par l'utilisateur");

            // Annuler la requête en cours si possible
            if (abortController && abortController.abort) {
                abortController.abort();
            }

            // Annuler toute autre opération en cours
            if (ajaxRequest && ajaxRequest.cancelable) {
                ajaxRequest.cancel();
            }

            // Affichage d'une notification d'information
            infoNotice("Mise à jour", "Opération annulée par l'utilisateur", 3000);
        }
    );

    ajaxFct(null, destUrl, 0).then((resultat) => {
        console.log("Résultat reçu :", resultat);

        if (resultat.success === true) {
            console.log("Succès détecté");
            successProgressIndeterminateNotice("mailPrepare", "Mise à jour", "Génération des fichiers pour les unités effectué avec succès", 3000);
            notifyFlow.notify({
                title: 'Envoi de mails',
                message: 'Le mail informant les unités va être envoyé automatiquement dans 10s, sauf si vous cliquez sur "Annuler"',
                type: 'info',
                duration: 0, // Ne pas fermer automatiquement
                dismissible: true,
                actions: [
                    {
                        id: 'confirm',
                        text: 'Confirmer maintenant',
                        class: 'primary',
                        callback: () => {
                            const options = {
                                batchSize: 5, // 10 emails par lot
                                delay: 15000   // 30 secondes entre chaque lot
                            }
                            sendBatchedEmails(resultat.data.emails, options);
                        }
                    },
                    {
                        id: 'cancel',
                        text: 'Annuler',
                        callback: () => {
                            infoNotice('Action annulée', "Annulation de l'envoi du mail");
                        }
                    }
                ],
                autoAction: 'confirm', // L'ID de l'action à exécuter automatiquement
                autoActionDelay: 10000 // 10 secondes
            });
        } else {
            console.log("Erreur détectée");
            errorProgressIndeterminateNotice("mailPrepare", "Mise à jour", "Echec du chargement des nouvelles synthèses", 3000);
            console.dir(resultat);
        }
    }).catch((error) => {
        console.error("Erreur lors de l'appel :", error);
        errorProgressIndeterminateNotice("mailPrepare", "Mise à jour", "Erreur technique:" + error, 3000);
    });
}

/**
 * Fonction d'envoi des mails HTML par lots avec délai et notification de progression
 * Avec support d'annulation lors du clic sur la croix (X)
 *
 * @param {Array} emails - Liste des fichiers HTML à envoyer
 * @param {Object} options - Options d'envoi (batchSize et delay)
 * @returns {Promise} Promise résolue quand tous les emails sont envoyés
 */
function sendBatchedEmails(emails, options = {}) {
    // Configuration par défaut
    const config = {
        batchSize: options.batchSize || 10,  // Nombre d'emails par lot
        delay: options.delay || 30000        // Délai entre les lots (en ms), 30s par défaut
    };

    // Filtrage des fichiers HTML uniquement
    const htmlEmails = emails.filter(email => email.htmlFile && email.htmlFile.endsWith('.html'));

    // Vérification des données
    if (!htmlEmails || htmlEmails.length === 0) {
        console.error('Aucun mail à envoyer');
        infoNotice("Envoi de mail", "Aucun mail à envoyer");
        return Promise.reject('Aucun mail à envoyer');
    }

    // Statistiques d'envoi
    const stats = {
        total: htmlEmails.length,
        sent: 0,
        failed: 0,
        batches: 0,
        startTime: new Date()
    };

    // ID unique pour cette opération d'envoi
    const progressId = 'email-sending-' + Date.now();

    // Contrôleurs pour l'annulation
    let abortController = new AbortController();
    let abortedByUser = false;
    let delayTimeoutId = null;

    // Fonction d'annulation qui sera appelée si l'utilisateur clique sur la croix
    const cancelOperation = () => {
        console.log("Envoi d'emails annulé par l'utilisateur");
        abortedByUser = true;

        // Annuler la requête fetch en cours
        if (abortController) {
            abortController.abort();
        }

        // Annuler le délai entre les lots
        if (delayTimeoutId) {
            clearTimeout(delayTimeoutId);
        }

        // Afficher une notification d'information
        infoNotice("Envoi annulé", "L'opération d'envoi des emails a été annulée", 5000);
    };

    // Créer la notification initiale avec support d'annulation
    infoProgressNotice(
        progressId,
        'Envoi des mails',
        `Préparation de l'envoi de ${stats.total} mails...`,
        0,
        cancelOperation
    );

    console.log(`Démarrage de l'envoi de ${stats.total} mails HTML par lots de ${config.batchSize} toutes les ${config.delay / 1000} secondes`);

    // Fonction pour envoyer un lot d'emails
    function sendBatch(emailBatch, batchNumber, totalBatches) {
        return new Promise((resolve, reject) => {
            // Si l'opération a été annulée, rejeter immédiatement
            if (abortedByUser) {
                return reject(new Error("Opération annulée par l'utilisateur"));
            }

            stats.batches++;

            console.log(`Envoi du lot ${batchNumber}/${totalBatches} (${emailBatch.length} mails)`);

            // Mise à jour de la notification avec la progression actuelle
            const progressPercent = Math.min(Math.round(((batchNumber - 1) / totalBatches) * 100), 99);
            updateProgressNotice(
                progressId,
                'Envoi des mails',
                `Envoi du lot ${batchNumber}/${totalBatches}...`,
                progressPercent
            );

            // Créer un nouveau AbortController pour chaque lot
            abortController = new AbortController();

            // Préparation des données à envoyer
            const formData = new FormData();
            formData.append('emails', JSON.stringify(emailBatch));

            // Options pour ajaxFct avec progression et annulation
            const ajaxOptions = {
                signal: abortController.signal,
                onUploadProgress: (progress) => {
                    const lotProgressPercent = progress.percent;
                    console.log(`  Progression du lot ${batchNumber}: ${lotProgressPercent}%`);

                    // Calculer la progression globale (lot précédents + portion du lot actuel)
                    const globalPercent = Math.min(
                        Math.round(
                            (((batchNumber - 1) * 100) + lotProgressPercent) / totalBatches
                        ),
                        99
                    );

                    // Mettre à jour la notification
                    updateProgressNotice(
                        progressId,
                        'Envoi des mails',
                        `Lot ${batchNumber}/${totalBatches}: ${lotProgressPercent}% terminé`,
                        globalPercent
                    );
                }
            };

            // Envoi du lot avec ajaxFct
            ajaxFct(formData, window.WEB_PAGES + '/main/subpages/mailSynthesis/sendMail.php', ajaxOptions)
                .then(response => {
                    // Mise à jour des statistiques
                    if (response.data && response.data.sent) {
                        stats.sent += response.data.sent.length;
                    }

                    if (response.data && response.data.failed) {
                        stats.failed += response.data.failed.length;
                    }

                    // Affichage de la progression
                    const progress = ((stats.sent + stats.failed) / stats.total * 100).toFixed(2);
                    const elapsedTime = Math.round((new Date() - stats.startTime) / 1000);

                    console.log(`Progression: ${stats.sent + stats.failed}/${stats.total} (${progress}%) - Succès: ${stats.sent}, Échecs: ${stats.failed}`);
                    console.log(`Temps écoulé: ${elapsedTime} secondes`);

                    // Affichage des erreurs le cas échéant
                    if (response.data && response.data.failed && response.data.failed.length > 0) {
                        console.warn(`Échecs d'envoi dans le lot ${batchNumber}:`);
                        response.data.failed.forEach(failure => {
                            console.warn(`- ${failure.file}: ${failure.error}`);
                        });

                        // Notification des échecs
                        if (response.data.failed.length > 0) {
                            notifyFlow.warning(
                                `${response.data.failed.length} mails n'ont pas pu être envoyés dans ce lot.`,
                                'Attention',
                                { duration: 5000 }
                            );
                        }
                    }

                    resolve(response);
                })
                .catch(error => {
                    // Vérifier si l'erreur est due à une annulation
                    if (error.name === 'AbortError' || abortedByUser) {
                        console.log(`Requête du lot ${batchNumber} annulée`);
                        reject(new Error("Opération annulée par l'utilisateur"));
                    } else {
                        console.error(`Erreur lors de l'envoi du lot ${batchNumber}:`, error);

                        // Notification d'erreur
                        notifyFlow.error(
                            `Erreur lors de l'envoi du lot ${batchNumber}: ${error.message || 'Erreur inconnue'}`,
                            'Erreur',
                            { duration: 8000 }
                        );

                        reject(error);
                    }
                });
        });
    }

    // Découpage de la liste en lots
    const batches = [];
    for (let i = 0; i < htmlEmails.length; i += config.batchSize) {
        batches.push(htmlEmails.slice(i, i + config.batchSize));
    }

    // Nombre total de lots
    const totalBatches = batches.length;

    // Fonction pour créer un délai annulable entre les lots
    const createDelay = (ms) => {
        return new Promise((resolve, reject) => {
            if (abortedByUser) {
                return reject(new Error("Opération annulée par l'utilisateur"));
            }

            delayTimeoutId = setTimeout(() => {
                delayTimeoutId = null;
                resolve();
            }, ms);
        });
    };

    // Envoi séquentiel des lots avec délai
    return batches.reduce((promiseChain, currentBatch, index) => {
        return promiseChain
            .then(() => {
                // Si l'opération a été annulée, arrêter tout
                if (abortedByUser) {
                    throw new Error("Opération annulée par l'utilisateur");
                }

                // Pas de délai pour le premier lot
                if (index === 0) {
                    return sendBatch(currentBatch, index + 1, totalBatches);
                } else {
                    // Mise à jour de la notification pour indiquer l'attente
                    const progressPercent = Math.round((index / totalBatches) * 100);
                    updateProgressNotice(
                        progressId,
                        'Envoi des mails',
                        `Attente avant le lot ${index + 1}/${totalBatches}...`,
                        progressPercent
                    );

                    // Ajout d'un délai avant l'envoi des lots suivants
                    console.log(`Attente de ${config.delay / 1000} secondes avant le prochain lot...`);
                    return createDelay(config.delay)
                        .then(() => sendBatch(currentBatch, index + 1, totalBatches));
                }
            });
    }, Promise.resolve())
        .then(() => {
            // Résumé final
            const totalTime = Math.round((new Date() - stats.startTime) / 1000);
            console.log(`=== ENVOI TERMINÉ ===`);
            console.log(`Mails envoyés: ${stats.sent}/${stats.total}`);
            console.log(`Échecs: ${stats.failed}`);
            console.log(`Lots: ${stats.batches}`);
            console.log(`Temps total: ${totalTime} secondes`);

            // Notification finale
            successProgressNotice(
                progressId,
                'Envoi terminé',
                `${stats.sent} mails envoyés avec succès, ${stats.failed} échecs. Durée totale: ${totalTime}s`,
                8000
            );

            return {
                success: true,
                stats: {
                    sent: stats.sent,
                    failed: stats.failed,
                    total: stats.total,
                    batches: stats.batches,
                    timeElapsed: totalTime
                }
            };
        })
        .catch(error => {
            // Si l'erreur est une annulation par l'utilisateur
            if (error.message === "Opération annulée par l'utilisateur" || abortedByUser) {
                console.log("Envoi des emails annulé par l'utilisateur");

                // Mise à jour de la notification pour montrer l'annulation
                errorProgressNotice(
                    progressId,
                    'Envoi annulé',
                    `Opération annulée par l'utilisateur. ${stats.sent}/${stats.total} mails envoyés.`,
                    Math.round((stats.sent / stats.total) * 100),
                    5000
                );

                return {
                    success: false,
                    cancelled: true,
                    stats: {
                        sent: stats.sent,
                        failed: stats.failed,
                        total: stats.total,
                        batches: stats.batches
                    }
                };
            }

            // Autres erreurs
            console.error("Erreur lors du traitement des lots:", error);

            // Notification d'erreur finale
            errorProgressNotice(
                progressId,
                'Envoi interrompu',
                `Une erreur est survenue: ${error.message || 'Erreur inconnue'}. ${stats.sent}/${stats.total} mails envoyés.`,
                Math.round((stats.sent / stats.total) * 100),
                10000
            );

            return {
                success: false,
                error: error.message || "Erreur inconnue",
                stats: {
                    sent: stats.sent,
                    failed: stats.failed,
                    total: stats.total,
                    batches: stats.batches
                }
            };
        });
}