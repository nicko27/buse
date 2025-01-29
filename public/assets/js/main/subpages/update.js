/**
 * Configuration de UpdateFlow pour la gestion des mises à jour Git
 */

// Récupération du CSRF token
const metaTag = document.querySelector('meta[name="csrf-token"]');
const csrfToken = metaTag ? metaTag.getAttribute('content') : '';
console.log('CSRF Token:', csrfToken); // Debug

// Messages personnalisés pour UpdateFlow
const updateFlowMessages = {
    pull: {
        start: 'Téléchargement des modifications...',
        success: 'Les modifications ont été téléchargées avec succès',
        error: 'Erreur lors du téléchargement des modifications'
    },
    push: {
        start: 'Envoi de la version...',
        success: 'La version a été envoyée avec succès',
        error: 'Erreur lors de l\'envoi de la version'
    },
    rebase: {
        start: 'Réorganisation des commits...',
        success: 'Les commits ont été réorganisés avec succès',
        error: 'Erreur lors de la réorganisation des commits'
    },
    merge: {
        start: 'Fusion des branches...',
        success: 'Les branches ont été fusionnées avec succès',
        error: 'Erreur lors de la fusion des branches'
    },
    reset: {
        start: 'Réinitialisation en cours...',
        success: 'La réinitialisation a été effectuée avec succès',
        error: 'Erreur lors de la réinitialisation'
    },
    titles: {
        pull: 'Téléchargement',
        push: 'Envoi',
        rebase: 'Réorganisation',
        merge: 'Fusion',
        reset: 'Réinitialisation',
        error: 'Erreur'
    }
};

// Configuration de base
const updateFlowConfig = {
    apiEndpoints: {
        base: WEB_PAGES + '/main/subpages/update',
        pull: WEB_PAGES + '/main/subpages/update/pull.php',
        push: WEB_PAGES + '/main/subpages/update/push.php',
        rebase: WEB_PAGES + '/main/subpages/update/rebase.php',
        merge: WEB_PAGES + '/main/subpages/update/merge.php',
        reset: WEB_PAGES + '/main/subpages/update/reset.php',
        attachHead: WEB_PAGES + '/main/subpages/update/attachHead.php'
    },
    versionEndpoint: WEB_PAGES + '/main/subpages/update/version.php',
    autoReload: false,
    retryAttempts: 3,
    retryDelay: 1000,
    timeout: 30000,
    debug: true,
    headers: {
        'X-CSRF-TOKEN': csrfToken
    },
    messages: updateFlowMessages,

    // Fonction pour obtenir les actions spécifiques liées aux boutons
    getActionsForFunction: function (functionName) {
        const actions = {
            gitPull: {
                success: function (title, message) {
                    notifyFlow.success(message, title, {
                        duration: 5000,
                        customClass: 'notice__ok',
                        progress: true,
                        icon: '<i class="fa fa-check-circle"></i>',
                        dismissible: false
                    });
                },
                error: function (title, message, error) {
                    let errorMessage = message;
                    if (error) {
                        if (typeof error === 'object') {
                            const details = [];
                            if (error.file) details.push(`Fichier: ${error.file}`);
                            if (error.line) details.push(`Ligne: ${error.line}`);
                            if (error.message) details.push(`Détail: ${error.message}`);
                            errorMessage += '\n' + details.join('\n');
                        } else {
                            errorMessage += `\nDétail: ${error}`;
                        }
                    }
                    notifyFlow.error(errorMessage, title, {
                        duration: 8000,
                        customClass: 'notice__error',
                        progress: true,
                        icon: '<i class="fa fa-xmark"></i>',
                        dismissible: true,
                        onClose: () => {
                            console.error('Erreur UpdateFlow:', { title, message, error });
                        }
                    });
                },
                info: function (title, message) {
                    notifyFlow.info(message, title, {
                        duration: 5000,
                        customClass: 'notice__info',
                        progress: true,
                        icon: '<i class="fa fa-circle-info"></i>',
                        dismissible: false
                    });
                }
            },
            gitPush: {
                success: function (title, message) {
                    notifyFlow.success(message, title, {
                        duration: 5000,
                        customClass: 'notice__ok',
                        progress: true,
                        icon: '<i class="fa fa-check-circle"></i>',
                        dismissible: false
                    });
                    notifyFlow.info("Mise à jour de la version", "Pensez à recharger la page", 5000);
                },
                error: function (title, message, error) {
                    let errorMessage = message;
                    if (error) {
                        if (typeof error === 'object') {
                            const details = [];
                            if (error.file) details.push(`Fichier: ${error.file}`);
                            if (error.line) details.push(`Ligne: ${error.line}`);
                            if (error.message) details.push(`Détail: ${error.message}`);
                            errorMessage += '\n' + details.join('\n');
                        } else {
                            errorMessage += `\nDétail: ${error}`;
                        }
                    }
                    notifyFlow.error(errorMessage, title, {
                        duration: 8000,
                        customClass: 'notice__error',
                        progress: true,
                        icon: '<i class="fa fa-xmark"></i>',
                        dismissible: true,
                        onClose: () => {
                            console.error('Erreur UpdateFlow:', { title, message, error });
                        }
                    });
                },
                info: function (title, message) {
                    notifyFlow.info(message, title, {
                        duration: 5000,
                        customClass: 'notice__info',
                        progress: true,
                        icon: '<i class="fa fa-circle-info"></i>',
                        dismissible: false
                    });
                }
            }
        };

        return actions[functionName] || {
            success: function (title, message) {
                notifyFlow.success(message, title, {
                    duration: 5000,
                    customClass: 'notice__ok',
                    progress: true,
                    icon: '<i class="fa fa-check-circle"></i>',
                    dismissible: false
                });
            },
            error: function (title, message, error) {
                let errorMessage = message;
                if (error) {
                    if (typeof error === 'object') {
                        const details = [];
                        if (error.file) details.push(`Fichier: ${error.file}`);
                        if (error.line) details.push(`Ligne: ${error.line}`);
                        if (error.message) details.push(`Détail: ${error.message}`);
                        errorMessage += '\n' + details.join('\n');
                    } else {
                        errorMessage += `\nDétail: ${error}`;
                    }
                }
                notifyFlow.error(errorMessage, title, {
                    duration: 8000,
                    customClass: 'notice__error',
                    progress: true,
                    icon: '<i class="fa fa-xmark"></i>',
                    dismissible: true,
                    onClose: () => {
                        console.error('Erreur UpdateFlow:', { title, message, error });
                    }
                });
            },
            info: function (title, message) {
                notifyFlow.info(message, title, {
                    duration: 5000,
                    customClass: 'notice__info',
                    progress: true,
                    icon: '<i class="fa fa-circle-info"></i>',
                    dismissible: false
                });
            }
        };
    }
};

/**
 * Gère la mise à jour des versions dans les textareas
 * @param {string} newVersion - La nouvelle version
 */
function handleVersionChange(newVersion) {
    // Mise à jour du titre de la page
    document.title = document.title.replace(/v[\d.]+/, `v${newVersion}`);

    // Mise à jour des textareas avec les nouvelles versions
    const [major, minor, patch] = newVersion.split('.').map(Number);

    // Calcul des prochaines versions
    const nextPatch = `${major}.${minor}.${patch + 1}`;
    const nextMinor = `${major}.${minor + 1}.0`;
    const nextMajor = `${major + 1}.0.0`;

    // Mise à jour des textareas
    document.getElementById('commitPatch').value = nextPatch;
    document.getElementById('commitMinor').value = nextMinor;
    document.getElementById('commitMajor').value = nextMajor;

    // Ajuster la hauteur des textareas
    ['commitPatch', 'commitMinor', 'commitMajor'].forEach(id => {
        textAreaAdjust(document.getElementById(id));
    });
}

/**
 * Initialisation de UpdateFlow
 */
function initUpdateFlow() {
    // Vérification de la disponibilité de NotifyFlow
    if (typeof notifyFlow === 'undefined') {
        console.log('NotifyFlow non disponible, nouvelle tentative dans 100ms...');
        setTimeout(initUpdateFlow, 100);
        return;
    }

    // Vérification du CSRF token
    if (!csrfToken) {
        console.error('CSRF Token non trouvé dans le meta tag');
        return;
    }

    // Création de l'instance UpdateFlow
    if (!window.updateFlow) {
        try {
            window.updateFlow = new UpdateFlow(updateFlowConfig, updateFlowConfig.getActionsForFunction('gitPull'));
            console.log('UpdateFlow initialisé avec succès');

            // Ajout des gestionnaires d'événements
            window.updateFlow.on('beforeRequest', ({ url, options }) => {
                if (updateFlowConfig.debug) {
                    console.log('Requête en cours vers:', url);
                    console.log('Options:', options);
                    console.log('Headers:', options.headers); // Debug des headers
                }
            });

            window.updateFlow.on('afterRequest', ({ url, response }) => {
                if (updateFlowConfig.debug) {
                    console.log('Réponse reçue de:', url);
                }
            });

            // Ajout du gestionnaire d'événement versionChange
            window.updateFlow.on('versionChange', handleVersionChange);

        } catch (error) {
            console.error('Erreur lors de l\'initialisation d\'UpdateFlow:', error);
            setTimeout(initUpdateFlow, 100);
        }
    }
}

// Initialisation après le chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    initUpdateFlow();
});

// Gestionnaires d'événements pour les boutons
document.addEventListener('click', async (event) => {
    const target = event.target;

    // Vérification que UpdateFlow est initialisé
    if (!window.updateFlow) {
        console.error('UpdateFlow n\'est pas encore initialisé');
        return;
    }

    // Git Pull
    if (target.matches('[data-action="git-pull"]')) {
        await window.updateFlow.gitPull();
    }
    // Git Push
    else if (target.matches('[data-action="git-push"]')) {
        await window.updateFlow.gitPush();
    }
    // Git Rebase
    else if (target.matches('[data-action="git-rebase"]')) {
        await window.updateFlow.gitRebase();
    }
    // Git Merge
    else if (target.matches('[data-action="git-merge"]')) {
        await window.updateFlow.gitMerge();
    }
    // Git Reset
    else if (target.matches('[data-action="git-reset"]')) {
        await window.updateFlow.gitReset();
    }
});

// Export pour différents environnements
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { updateFlowConfig };
} else if (typeof define === 'function' && define.amd) {
    define([], function () { return { updateFlowConfig }; });
} else {
    window.updateFlowConfig = updateFlowConfig;
}