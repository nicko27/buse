<?php
/**
 * 080-rights.php
 * Initialisation du gestionnaire de droits et authentification
 */

use Commun\Security\RightsManager;

$rightsStats = [
    'manager_initialized' => false,
    'user_authenticated' => false,
    'debug_mode' => false,
    'debug_user' => null,
    'authentication_method' => null,
    'user_info' => [],
    'binary_rights' => 0,
    'error' => null,
];

try {
    // Initialisation du gestionnaire de droits
    $rightsManager = RightsManager::getInstance();
    $rightsStats['manager_initialized'] = true;
    
    // Détection du mode debug
    $debug = 0;
    $serverAddr = $_SERVER['SERVER_ADDR'] ?? '127.0.0.1';
    
    // Debug sur localhost ou environnement de développement
    if ($serverAddr === "127.0.0.1" || $config->get("ENV") === "dev") {
        $debug = (int) $config->get("DEBUG", 0);
    }
    
    // Override debug par paramètre GET (seulement en dev)
    if (isset($_GET['debug']) && ($serverAddr === "127.0.0.1" || $config->get("ENV") === "dev")) {
        $debug = (int) $_GET['debug'];
    }
    
    $rightsStats['debug_mode'] = ($debug === (int)$config->get("DEBUG"));
    
    // Authentification selon le mode
    if ($rightsStats['debug_mode']) {
        // ===== MODE DEBUG =====
        $rightsStats['authentication_method'] = 'debug';
        
        $nigend = $_GET['nigend'] ?? 224286;
        $rightsStats['debug_user'] = $nigend;
        
        $personsInfo = [];
        
        // Tentative de récupération via LDAP si disponible
        if (isset($ldapAvailable) && $ldapAvailable) {
            try {
                $ldapManager = \Commun\Ldap\LdapManager::getInstance();
                $personsAttributes = ["employeenumber", "title", "sn", "givenname", "mail", "codeunite", "ou"];
                $person = sprintf("employeenumber=%s", $nigend);
                $ldapResult = $ldapManager->searchPersons($person, $personsAttributes, 10);
                $personsInfo = $ldapResult[0] ?? null;
                
                if ($personsInfo) {
                    $rightsStats['user_info']['source'] = 'ldap';
                }
            } catch (\Exception $e) {
                if ($logger) {
                    $logger->warning("Échec récupération LDAP en mode debug", [
                        'nigend' => $nigend,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        }
        
        // Fallback pour l'utilisateur de test si pas trouvé dans LDAP
        if (!$personsInfo && $nigend == 224286) {
            $personsInfo = [
                "employeenumber" => "224286",
                "title" => "ADJ",
                "sn" => "VOIRIN", 
                "givenname" => "Nicolas",
                "mail" => "nicolas.voirin@gendarmerie.interieur.gouv.fr",
                "ou" => "SOLC BDRIJ GGD27",
                "codeunite" => "12027",
            ];
            $rightsStats['user_info']['source'] = 'fallback';
        }
        
        // Initialisation avec les données de debug
        $rightsManager->initialize(1, $personsInfo ?: []);
        
    } else {
        // ===== MODE PRODUCTION (SSO) =====
        $rightsStats['authentication_method'] = 'sso';
        
        // Vérification que le fichier SSO est disponible
        $ssoFile = __DIR__ . "/../Security/SSOlocal.php";
        if (!file_exists($ssoFile)) {
            throw new \Exception("Fichier SSO manquant : $ssoFile");
        }
        
        require_once $ssoFile;
        
        // Initialisation normale avec SSO
        $rightsManager->initialize(0, []);
    }
    
    // Collecte des informations utilisateur
    $rightsStats['user_authenticated'] = $rightsManager->isAuthenticated();
    
    if ($rightsStats['user_authenticated']) {
        $rightsStats['user_info'] = array_merge($rightsStats['user_info'], [
            'id' => $rightsManager->getUserId(),
            'name' => $rightsManager->getUserName(),
            'email' => $rightsManager->getUserMail(),
            'unit' => $rightsManager->getUserUnit(),
            'cu' => $rightsManager->getUserCu(),
            'short_name' => $rightsManager->getUserShortName(),
        ]);
        
        $rightsStats['binary_rights'] = $rightsManager->getBinaryRights();
        
        // Détail des droits pour le debug
        if ($config->get('TWIG_DEBUG', false)) {
            $rightsStats['rights_detail'] = [
                'timeline' => $rightsManager->canReadTimeline(),
                'permanences' => $rightsManager->canReadPermanences(),
                'import' => $rightsManager->canImport(),
                'synthesis_level' => $rightsManager->getSynthesisViewLevel(),
                'admin' => $rightsManager->isAdmin(),
                'super_admin' => $rightsManager->isSuperAdmin(),
            ];
        }
    }

} catch (\Exception $e) {
    $rightsStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->error("Erreur d'initialisation du gestionnaire de droits", [
            'error' => $e->getMessage(),
            'debug_mode' => $rightsStats['debug_mode'],
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
        $email = $logData['user_info']['email'];
        $logData['user_info']['email'] = substr($email, 0, 3) . '***@' . substr($email, strpos($email, '@') + 1);
    }
    
    $logger->info("Gestionnaire de droits initialisé", $logData);
    
    if ($rightsStats['user_authenticated']) {
        $logger->info("Utilisateur authentifié", [
            'user_id' => $rightsManager->getUserId(),
            'cu' => $rightsManager->getUserCu(),
            'binary_rights' => $rightsManager->getBinaryRights(),
            'method' => $rightsStats['authentication_method'],
        ]);
    }
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['rights'] = $rightsStats;

// Vérification critique : si pas de gestionnaire de droits pour pages protégées
if (!$rightsStats['manager_initialized']) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');
    
    $protectedPages = ['main', 'admin', 'show'];
    foreach ($protectedPages as $protectedPage) {
        if (str_starts_with($currentPath, $protectedPage)) {
            die("Erreur critique : Gestionnaire de droits non disponible pour cette page protégée.\nErreur : " . ($rightsStats['error'] ?? 'Inconnue'));
        }
    }
}