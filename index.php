<?php
/**
 * index.php - Point d'entrée principal de l'application
 *
 * Ce fichier est le point d'entrée unique de l'application.
 * Il délègue toute l'initialisation au système d'initialisation modulaire
 * et gère seulement le flux principal et les erreurs globales.
 */

// Mesure du temps de début pour les statistiques
$_SERVER['REQUEST_TIME_FLOAT'] = $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true);

// Configuration des erreurs PHP en fonction de l'environnement
$isLocalDev = ($_SERVER['SERVER_ADDR'] ?? '127.0.0.1') === '127.0.0.1';
if ($isLocalDev) {
    ini_set('display_errors', 1);
    ini_set('display_startup_errors', 1);
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', 0);
    ini_set('log_errors', 1);
    error_reporting(E_ALL);
}

// Gestion de la session (nettoyage si nécessaire)
if (session_status() === PHP_SESSION_ACTIVE) {
    // Ne détruire la session que si explicitement demandé
    if (isset($_GET['reset_session'])) {
        session_unset();
        session_destroy();
        // Redirection pour éviter le paramètre dans l'URL
        $redirectUrl = strtok($_SERVER['REQUEST_URI'], '?');
        header("Location: $redirectUrl", true, 302);
        exit;
    }
}

try {
    // ===== INITIALISATION COMPLÈTE =====
    // Le système d'initialisation gère tout :
    // - Autoload, classes, configuration
    // - Base de données, logger, répertoires
    // - Session, CSRF, authentification, LDAP
    // - Twig, router, résolution de route
    // - Vérification d'accès, exécution PHP
    // - Rendu final et statistiques

    require_once __DIR__ . "/public/pages/commun/init.php";

    // À ce stade, si nous arrivons ici sans exception,
    // la page a été entièrement rendue par le système d'initialisation

} catch (\Throwable $e) {
    // Cette gestion d'erreur ne devrait jamais être atteinte car
    // init.php gère déjà toutes les erreurs, mais on la garde
    // comme filet de sécurité ultime

    $isDebug = $isLocalDev || (isset($_GET['debug']) && $_GET['debug'] === '1');

    // Log d'urgence
    error_log("ERREUR FATALE INDEX.PHP : " . $e->getMessage() . " dans " . $e->getFile() . ":" . $e->getLine());

    // Headers HTTP d'erreur
    if (! headers_sent()) {
        http_response_code(500);
        header('Content-Type: text/html; charset=UTF-8');
    }

    // Page d'erreur minimale
    echo "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n";
    echo "<meta charset=\"UTF-8\">\n";
    echo "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n";
    echo "<title>Erreur serveur</title>\n";
    echo "<style>\n";
    echo "body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; background: #f5f5f5; }\n";
    echo ".container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }\n";
    echo ".error { background: #ffebee; border-left: 4px solid #f44336; padding: 20px; margin: 20px 0; }\n";
    echo ".debug { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; }\n";
    echo ".code { background: #f5f5f5; border: 1px solid #ddd; padding: 15px; font-family: 'Courier New', monospace; font-size: 14px; overflow-x: auto; white-space: pre-wrap; }\n";
    echo "h1 { color: #d32f2f; margin: 0 0 20px 0; }\n";
    echo "h2 { color: #1976d2; margin: 20px 0 10px 0; font-size: 18px; }\n";
    echo "h3 { color: #388e3c; margin: 15px 0 10px 0; font-size: 16px; }\n";
    echo ".timestamp { color: #666; font-size: 12px; margin-top: 20px; }\n";
    echo "</style>\n";
    echo "</head>\n<body>\n";

    echo "<div class=\"container\">\n";
    echo "<h1>🚨 Erreur critique du serveur</h1>\n";

    echo "<div class=\"error\">\n";
    echo "<h2>Une erreur fatale s'est produite</h2>\n";
    echo "<p>L'application n'a pas pu se charger correctement. Cette erreur a été automatiquement signalée aux administrateurs.</p>\n";

    if ($isDebug) {
        echo "<h3>Détails de l'erreur (mode debug) :</h3>\n";
        echo "<div class=\"code\">";
        echo "<strong>Message :</strong> " . htmlspecialchars($e->getMessage()) . "\n\n";
        echo "<strong>Fichier :</strong> " . htmlspecialchars($e->getFile()) . "\n";
        echo "<strong>Ligne :</strong> " . $e->getLine() . "\n\n";
        echo "<strong>Type :</strong> " . get_class($e) . "\n";
        echo "</div>\n";

        echo "<h3>Stack trace :</h3>\n";
        echo "<div class=\"code\">" . htmlspecialchars($e->getTraceAsString()) . "</div>\n";

        // Informations sur l'environnement
        echo "<h3>Informations système :</h3>\n";
        echo "<div class=\"code\">";
        echo "PHP Version: " . PHP_VERSION . "\n";
        echo "Server Software: " . ($_SERVER['SERVER_SOFTWARE'] ?? 'Unknown') . "\n";
        echo "Document Root: " . ($_SERVER['DOCUMENT_ROOT'] ?? 'Unknown') . "\n";
        echo "Request URI: " . ($_SERVER['REQUEST_URI'] ?? 'Unknown') . "\n";
        echo "Request Method: " . ($_SERVER['REQUEST_METHOD'] ?? 'Unknown') . "\n";
        echo "User Agent: " . substr($_SERVER['HTTP_USER_AGENT'] ?? 'Unknown', 0, 100) . "\n";
        echo "Memory Usage: " . round(memory_get_usage(true) / 1024 / 1024, 2) . " MB\n";
        echo "Memory Peak: " . round(memory_get_peak_usage(true) / 1024 / 1024, 2) . " MB\n";
        echo "</div>\n";

        // Vérifications de base
        echo "<h3>Vérifications :</h3>\n";
        echo "<div class=\"code\">";
        echo "Autoload Composer: " . (file_exists(__DIR__ . '/vendor/autoload.php') ? '✅ Trouvé' : '❌ Manquant') . "\n";
        echo "Fichier .env: " . (file_exists(__DIR__ . '/.env') ? '✅ Trouvé' : '❌ Manquant') . "\n";
        echo "Init.php: " . (file_exists(__DIR__ . '/public/pages/commun/init.php') ? '✅ Trouvé' : '❌ Manquant') . "\n";
        echo "Extension LDAP: " . (extension_loaded('ldap') ? '✅ Disponible' : '⚠️ Non disponible') . "\n";
        echo "Extension PDO: " . (extension_loaded('pdo') ? '✅ Disponible' : '❌ Manquant') . "\n";
        echo "Extension PDO MySQL: " . (extension_loaded('pdo_mysql') ? '✅ Disponible' : '❌ Manquant') . "\n";
        echo "</div>\n";

    } else {
        echo "<p><strong>Code d'erreur :</strong> " . substr(md5($e->getMessage() . $e->getFile() . $e->getLine()), 0, 8) . "</p>\n";
        echo "<p>Veuillez contacter l'administrateur système avec ce code d'erreur.</p>\n";
    }

    echo "</div>\n"; // fin .error

    echo "<div class=\"debug\">\n";
    echo "<h2>🛠️ Actions recommandées</h2>\n";
    echo "<ul>\n";
    echo "<li>Vérifiez que tous les fichiers de l'application sont présents</li>\n";
    echo "<li>Vérifiez la configuration de la base de données</li>\n";
    echo "<li>Consultez les logs du serveur pour plus de détails</li>\n";
    echo "<li>Contactez l'équipe de développement si le problème persiste</li>\n";
    echo "</ul>\n";
    echo "</div>\n";

    echo "<div class=\"timestamp\">Erreur survenue le " . date('d/m/Y à H:i:s') . "</div>\n";
    echo "</div>\n"; // fin .container
    echo "</body>\n</html>";

    exit;
}

// NOTE IMPORTANTE :
// Ce code ne devrait jamais être atteint car init.php gère le rendu complet.
// Si nous arrivons ici, c'est qu'il y a un problème dans init.php
// ou que la page a été rendue mais que le script continue.

// Vérification de sécurité : s'assurer qu'une réponse a été envoyée
if (! headers_sent() && ob_get_length() === false) {
    // Aucune sortie n'a été générée, ce qui est anormal
    error_log("AVERTISSEMENT : index.php atteint la fin sans sortie générée");

    http_response_code(500);
    echo "<!DOCTYPE html><html><head><title>Erreur système</title></head>";
    echo "<body><h1>Erreur système</h1>";
    echo "<p>L'application n'a pas généré de réponse. Consultez les logs du serveur.</p>";
    echo "</body></html>";
}
