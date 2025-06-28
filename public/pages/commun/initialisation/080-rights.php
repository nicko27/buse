<?php
/**
 * 080-rights.php
 * Initialisation du gestionnaire de droits et authentification
 * VERSION CORRIGÉE pour gérer correctement localhost vs SSO
 */

use Commun\Security\RightsManager;

$rightsStats = [
    'manager_initialized'   => false,
    'user_authenticated'    => false,
    'debug_mode'            => false,
    'localhost_detected'    => false,
    'debug_user'            => null,
    'authentication_method' => null,
    'user_info'             => [],
    'binary_rights'         => 0,
    'error'                 => null,
];

try {
    // Initialisation du gestionnaire de droits
    $rightsManager                      = RightsManager::getInstance();
    $rightsStats['manager_initialized'] = true;

    // CORRECTION 1: Détection améliorée de l'environnement
    $isLocalhost                       = RightsManager::isLocalhost();
    $rightsStats['localhost_detected'] = $isLocalhost;

    // Détection du mode debug depuis la configuration
    $configDebug = filter_var($config->get("DEBUG", false), FILTER_VALIDATE_BOOLEAN);
    $envDebug    = $config->get("ENV") === "dev";

    // CORRECTION 2: Mode debug basé sur l'environnement ET localhost
    $useDebugMode              = $isLocalhost || $configDebug || $envDebug;
    $rightsStats['debug_mode'] = $useDebugMode;

    // Override debug par paramètre GET (seulement si autorisé)
    if ($useDebugMode && isset($_GET['debug'])) {
        $useDebugMode              = filter_var($_GET['debug'], FILTER_VALIDATE_BOOLEAN);
        $rightsStats['debug_mode'] = $useDebugMode;
    }

    // CORRECTION 3: Préparation des données utilisateur pour le mode debug
    $debugUserData = [];

    if ($useDebugMode) {
        // Récupérer nigend depuis GET ou utiliser valeur par défaut
        $nigend                               = $_GET['nigend'] ?? $_POST['nigend'] ?? 224286;
        $rightsStats['debug_user']            = $nigend;
        $rightsStats['authentication_method'] = 'debug';

        // Données utilisateur de debug
        $debugUserData = [];

        // Tentative de récupération via LDAP si disponible ET si on n'est pas en mode localhost pur
        if (isset($ldapAvailable) && $ldapAvailable && ! $isLocalhost) {
            try {
                $ldapManager       = \Commun\Ldap\LdapManager::getInstance();
                $personsAttributes = ["employeenumber", "title", "sn", "givenname", "mail", "codeunite", "ou"];
                $person            = sprintf("employeenumber=%s", $nigend);
                $ldapResult        = $ldapManager->searchPersons($person, $personsAttributes, 10);
                $debugUserData     = $ldapResult[0] ?? [];

                if (! empty($debugUserData)) {
                    $rightsStats['user_info']['source'] = 'ldap';
                }
            } catch (\Exception $e) {
                if ($logger) {
                    $logger->warning("Échec récupération LDAP en mode debug", [
                        'nigend' => $nigend,
                        'error'  => $e->getMessage(),
                    ]);
                }
            }
        }

        // CORRECTION 4: Fallback systématique vers utilisateur de test
        if (empty($debugUserData)) {
            $debugUserData = [
                "employeenumber" => (string) $nigend,
                "title"          => "ADJ",
                "sn"             => "VOIRIN",
                "givenname"      => "Nicolas",
                "mail"           => "nicolas.voirin@gendarmerie.interieur.gouv.fr",
                "ou"             => "SOLC BDRIJ GGD27",
                "codeunite"      => "12027",
            ];
            $rightsStats['user_info']['source'] = 'fallback';
        }

        // Initialisation avec les données de debug
        $rightsManager->initialize(1, $debugUserData);

    } else {
        // ===== MODE PRODUCTION (SSO) =====
        $rightsStats['authentication_method'] = 'sso';

        // Vérification que le fichier SSO est disponible
        $ssoFile = __DIR__ . "/../classes/Security/SSOlocal.php";
        if (! file_exists($ssoFile)) {
            throw new \Exception("Fichier SSO manquant : $ssoFile");
        }

        // Initialisation normale avec SSO (pas de données debug)
        $rightsManager->initialize(0, []);
    }

    // Collecte des informations utilisateur
    $rightsStats['user_authenticated'] = $rightsManager->isAuthenticated();

    if ($rightsStats['user_authenticated']) {
        $rightsStats['user_info'] = array_merge($rightsStats['user_info'], [
            'id'         => $rightsManager->getUserId(),
            'name'       => $rightsManager->getUserName(),
            'email'      => $rightsManager->getUserMail(),
            'unit'       => $rightsManager->getUserUnit(),
            'cu'         => $rightsManager->getUserCu(),
            'short_name' => $rightsManager->getUserShortName(),
        ]);

        $rightsStats['binary_rights'] = $rightsManager->getBinaryRights();

        // Détail des droits pour le debug
        if ($config->get('TWIG_DEBUG', false)) {
            $rightsStats['rights_detail'] = [
                'timeline'        => $rightsManager->canReadTimeline(),
                'permanences'     => $rightsManager->canReadPermanences(),
                'import'          => $rightsManager->canImport(),
                'synthesis_level' => $rightsManager->getSynthesisViewLevel(),
                'admin'           => $rightsManager->isAdmin(),
                'super_admin'     => $rightsManager->isSuperAdmin(),
            ];
        }
    }

} catch (\Exception $e) {
    $rightsStats['error'] = $e->getMessage();

    if ($logger) {
        $logger->error("Erreur d'initialisation du gestionnaire de droits", [
            'error'                 => $e->getMessage(),
            'debug_mode'            => $rightsStats['debug_mode'],
            'localhost_detected'    => $rightsStats['localhost_detected'],
            'authentication_method' => $rightsStats['authentication_method'],
        ]);
    }

    // Créer un gestionnaire de droits vide pour éviter les erreurs fatales
    $rightsManager = null;
}

// Log des informations d'authentification
if ($logger) {
    $logData = $rightsStats;

    // Masquer les informations sensibles dans les logs
    if (isset($logData['user_info']['email'])) {
        $email                         = $logData['user_info']['email'];
        $logData['user_info']['email'] = substr($email, 0, 3) . '***@' . substr($email, strpos($email, '@') + 1);
    }

    $logger->info("Gestionnaire de droits initialisé", $logData);

    if ($rightsStats['user_authenticated']) {
        $logger->info("Utilisateur authentifié", [
            'user_id'       => $rightsManager->getUserId(),
            'cu'            => $rightsManager->getUserCu(),
            'binary_rights' => $rightsManager->getBinaryRights(),
            'method'        => $rightsStats['authentication_method'],
            'localhost'     => $rightsStats['localhost_detected'],
        ]);
    }
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['rights'] = $rightsStats;

// Vérification critique : si pas de gestionnaire de droits pour pages protégées
if (! $rightsStats['manager_initialized']) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');

    $protectedPages = ['main', 'admin', 'show'];
    foreach ($protectedPages as $protectedPage) {
        if (str_starts_with($currentPath, $protectedPage)) {
            die("Erreur critique : Gestionnaire de droits non disponible pour cette page protégée.\nErreur : " . ($rightsStats['error'] ?? 'Inconnue'));
        }
    }
}
