<?php
/**
 * init.php - Orchestrateur principal de l'initialisation
 *
 * Ce fichier charge séquentiellement tous les composants de l'application
 * dans un ordre logique et avec une gestion d'erreur robuste.
 */

// Enregistrement du temps de début pour les statistiques
$_SERVER['REQUEST_TIME_FLOAT'] = $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true);

try {
                                                                  // ===== PHASE 1 : DEPENDENCIES & CORE =====
    require_once __DIR__ . '/initialisation/010-autoload.php';    // Composer autoload
    require_once __DIR__ . '/initialisation/020-classes.php';     // Classes communes
    require_once __DIR__ . '/initialisation/030-config.php';      // Configuration
    require_once __DIR__ . '/initialisation/040-database.php';    // Base de données
    require_once __DIR__ . '/initialisation/050-logger.php';      // Logger
    require_once __DIR__ . '/initialisation/060-directories.php'; // Répertoires

                                                              // ===== PHASE 2 : SECURITY & SERVICES =====
    require_once __DIR__ . '/initialisation/070-session.php'; // Session & CSRF
    require_once __DIR__ . '/initialisation/080-rights.php';  // Droits & Auth
    require_once __DIR__ . '/initialisation/090-ldap.php';    // LDAP

                                                                      // ===== PHASE 3 : TEMPLATING =====
    require_once __DIR__ . '/initialisation/100-twig-base.php';       // Twig base
    require_once __DIR__ . '/initialisation/110-twig-extensions.php'; // Extensions Twig

                                                                    // ===== PHASE 4 : ROUTING & RENDERING =====
    require_once __DIR__ . '/initialisation/120-router.php';        // Router
    require_once __DIR__ . '/initialisation/130-routing.php';       // Résolution route
    require_once __DIR__ . '/initialisation/135-twig-router.php';   // Ajout données routeur à Twig
    require_once __DIR__ . '/initialisation/140-access.php';        // Vérification accès
    require_once __DIR__ . '/initialisation/150-php-execution.php'; // Exécution PHP
    require_once __DIR__ . '/initialisation/160-render.php';        // Rendu final

                                                            // ===== PHASE 5 : FINALIZATION =====
    require_once __DIR__ . '/initialisation/170-stats.php'; // Statistiques

} catch (\Throwable $e) {
    // Gestion d'erreur globale pour les erreurs fatales

    // Tentative de log si le logger est disponible
    if (isset($logger)) {
        $logger->critical("Erreur fatale lors de l'initialisation", [
            'error' => $e->getMessage(),
            'file'  => $e->getFile(),
            'line'  => $e->getLine(),
            'trace' => $e->getTraceAsString(),
        ]);
    } else {
        error_log("Erreur fatale d'initialisation : " . $e->getMessage());
    }

    // Page d'erreur minimale
    http_response_code(500);

    $isDebug = (isset($config) && $config->get('TWIG_DEBUG', false)) ||
        (isset($_SERVER['SERVER_ADDR']) && $_SERVER['SERVER_ADDR'] === '127.0.0.1');

    echo "<!DOCTYPE html><html><head><title>Erreur serveur</title>";
    echo "<style>body{font-family:sans-serif;margin:40px;} .error{background:#ffebee;border:1px solid #f44336;padding:20px;border-radius:4px;} .debug{background:#e3f2fd;border:1px solid #2196f3;padding:15px;border-radius:4px;margin-top:20px;} pre{overflow:auto;}</style>";
    echo "</head><body>";
    echo "<h1>Erreur d'initialisation de l'application</h1>";
    echo "<div class='error'>";
    echo "<p><strong>Une erreur critique s'est produite lors du démarrage de l'application.</strong></p>";

    if ($isDebug) {
        echo "<p><strong>Erreur :</strong> " . htmlspecialchars($e->getMessage()) . "</p>";
        echo "<p><strong>Fichier :</strong> " . htmlspecialchars($e->getFile()) . " ligne " . $e->getLine() . "</p>";
    } else {
        echo "<p>Veuillez contacter l'administrateur système.</p>";
    }
    echo "</div>";

    if ($isDebug) {
        echo "<div class='debug'>";
        echo "<h3>Informations de debug</h3>";
        echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";

        if (isset($GLOBALS['app_init_stats'])) {
            echo "<h4>Étapes d'initialisation :</h4>";
            echo "<pre>" . htmlspecialchars(json_encode($GLOBALS['app_init_stats'], JSON_PRETTY_PRINT)) . "</pre>";
        }
        echo "</div>";
    }

    echo "</body></html>";
    exit;
}
