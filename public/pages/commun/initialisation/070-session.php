<?php
/**
 * 070-session.php
 * Initialisation de la session et du système CSRF
 */

use Commun\Security\CsrfManager;

$sessionStats = [
    'started' => false,
    'session_id' => null,
    'csrf_initialized' => false,
    'csrf_token' => null,
    'session_config' => [],
    'error' => null,
];

try {
    // Configuration de la session avant démarrage
    $sessionConfig = [
        'cookie_lifetime' => 0, // Session jusqu'à fermeture du navigateur
        'cookie_path' => '/',
        'cookie_domain' => '',
        'cookie_secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
        'use_cookies' => true,
        'use_only_cookies' => true,
        'cache_limiter' => 'nocache',
    ];
    
    // Application de la configuration
    foreach ($sessionConfig as $option => $value) {
        if (is_bool($value)) {
            ini_set("session.$option", $value ? '1' : '0');
        } else {
            ini_set("session.$option", (string)$value);
        }
    }
    
    $sessionStats['session_config'] = $sessionConfig;
    
    // Démarrage de la session si pas déjà démarrée
    if (session_status() === PHP_SESSION_NONE) {
        if (!session_start()) {
            throw new \Exception("Impossible de démarrer la session");
        }
    }
    
    $sessionStats['started'] = true;
    $sessionStats['session_id'] = session_id();
    
    // Régénération de l'ID de session pour la sécurité (pas à chaque requête)
    if (!isset($_SESSION['session_regenerated'])) {
        session_regenerate_id(true);
        $_SESSION['session_regenerated'] = time();
        $sessionStats['session_id'] = session_id(); // Nouveau ID
    }
    
    // Vérification de l'expiration de session (optionnel)
    $sessionTimeout = 3600; // 1 heure par défaut
    if (isset($_SESSION['last_activity'])) {
        if (time() - $_SESSION['last_activity'] > $sessionTimeout) {
            session_unset();
            session_destroy();
            session_start();
            $sessionStats['session_expired'] = true;
        }
    }
    $_SESSION['last_activity'] = time();
    
    // Initialisation du gestionnaire CSRF
    $csrfManager = CsrfManager::getInstance();
    $csrfToken = $csrfManager->getToken();
    
    // Stockage du token CSRF en session
    $_SESSION['CSRF_TOKEN'] = $csrfToken;
    
    $sessionStats['csrf_initialized'] = true;
    $sessionStats['csrf_token'] = $csrfToken;
    
    // Variables de session utiles
    if (!isset($_SESSION['app_start_time'])) {
        $_SESSION['app_start_time'] = time();
    }
    
    if (!isset($_SESSION['user_ip'])) {
        $_SESSION['user_ip'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }
    
    // Vérification de la cohérence IP (sécurité basique)
    if (isset($_SESSION['user_ip']) && $_SESSION['user_ip'] !== ($_SERVER['REMOTE_ADDR'] ?? 'unknown')) {
        if ($logger) {
            $logger->warning("Changement d'adresse IP détecté", [
                'old_ip' => $_SESSION['user_ip'],
                'new_ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                'session_id' => session_id(),
            ]);
        }
        $_SESSION['user_ip'] = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

} catch (\Exception $e) {
    $sessionStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->error("Erreur d'initialisation de la session", [
            'error' => $e->getMessage(),
            'session_status' => session_status(),
            'headers_sent' => headers_sent(),
        ]);
    }
    
    // Tentative de fallback sans session (très limitée)
    $csrfManager = null;
    $_SESSION = []; // Tableau vide pour éviter les erreurs
}

// Statistiques supplémentaires si session OK
if ($sessionStats['started']) {
    $sessionStats['session_size'] = strlen(serialize($_SESSION));
    $sessionStats['user_authenticated'] = isset($_SESSION['user']) && !empty($_SESSION['user']);
    $sessionStats['session_age'] = isset($_SESSION['app_start_time']) ? time() - $_SESSION['app_start_time'] : 0;
}

// Log des informations de session
if ($logger) {
    $logData = $sessionStats;
    // Ne pas logger le token CSRF complet pour la sécurité
    if (isset($logData['csrf_token'])) {
        $logData['csrf_token'] = substr($logData['csrf_token'], 0, 8) . '...';
    }
    
    $logger->info("Session initialisée", $logData);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['session'] = $sessionStats;

// Vérification critique : si pas de session ET pas de CSRF, arrêter pour les pages sensibles
if (!$sessionStats['started'] || !$sessionStats['csrf_initialized']) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');
    
    $sensiblePages = ['main', 'admin', 'import', 'rights'];
    foreach ($sensiblePages as $sensiblePage) {
        if (str_starts_with($currentPath, $sensiblePage)) {
            die("Erreur critique : Session ou CSRF non disponible pour cette page sécurisée.\nErreur : " . ($sessionStats['error'] ?? 'Inconnue'));
        }
    }
}