<?php
/**
 * 120-twig.php
 * Initialisation complète de Twig via TwigManager
 *
 * REMPLACE les anciens fichiers :
 * - 120-twig-base.php
 * - 130-twig-extensions.php
 * - 140-twig-data.php
 *
 * Centralise toute la logique Twig dans TwigManager
 */

use Commun\Template\TwigManager;

$twigStats = [
    'manager_initialized' => false,
    'environment_created' => false,
    'variables_logged'    => false,
    'error'               => null,
];

try {
    // Vérifier que TwigManager est disponible
    if (! class_exists('Commun\Template\TwigManager')) {
        throw new \Exception("Classe TwigManager non trouvée - vérifiez 020-classes.php");
    }

    // Récupérer l'instance singleton de TwigManager
    $twigManager = TwigManager::getInstance();

    // Préparer le logger : utiliser le logger Monolog s'il est disponible
    $loggerForTwig = null;
    if (isset($logger) && $logger) {
        $loggerForTwig = $logger; // Passer directement le logger Monolog
    }

    // Initialiser TwigManager avec les services disponibles
    $twigManager->initialize(
        $config,                // Toujours disponible à cette étape
        $router ?? null,        // Peut ne pas être disponible
        $rightsManager ?? null, // Peut ne pas être disponible
        $loggerForTwig          // Logger compatible (Monolog ou null)
    );

    $twigStats['manager_initialized'] = true;

    // Récupérer l'environnement Twig configuré
    $twig                             = $twigManager->getEnvironment();
    $twigStats['environment_created'] = true;

    // Debug logging des variables si activé
    if ($config->get('DEBUG_MODE', false)) {
        $twigManager->debugLogVariables();
        $twigStats['variables_logged'] = true;
    }

    // Log du succès d'initialisation
    if (isset($logger) && $logger) {
        $logger->info("TwigManager initialisé avec succès via 120-twig.php", [
            'manager_class'    => get_class($twigManager),
            'twig_class'       => get_class($twig),
            'debug_mode'       => $config->get('DEBUG_MODE', false),
            'variables_logged' => $twigStats['variables_logged'],
        ]);
    }

} catch (\Exception $e) {
    $twigStats['error'] = $e->getMessage();

    // Log de l'erreur
    if (isset($logger) && $logger) {
        $logger->error("Erreur d'initialisation TwigManager", [
            'error'            => $e->getMessage(),
            'file'             => $e->getFile(),
            'line'             => $e->getLine(),
            'config_available' => isset($config),
            'router_available' => isset($router),
            'rights_available' => isset($rightsManager),
        ]);
    }

    // Fallback : essayer de créer un environnement Twig minimal
    try {
        if (isset($logger) && $logger) {
            $logger->warning("Tentative de création d'un environnement Twig minimal de secours");
        }

        // Templates de fallback
        $fallbackTemplates = [
            'error.twig'           => '<!DOCTYPE html>
<html><head><title>Erreur</title></head>
<body>
    <h1>Erreur de template</h1>
    <p>{{ message|default("Une erreur s\'est produite") }}</p>
    <p><a href="/">Retour à l\'accueil</a></p>
</body></html>',

            'layouts/default.twig' => '<!DOCTYPE html>
<html><head><title>{% block title %}Application{% endblock %}</title></head>
<body>
    <header><h1>Application</h1></header>
    <main>{% block content %}Contenu par défaut{% endblock %}</main>
</body></html>',
        ];

        $loader = new \Twig\Loader\ArrayLoader($fallbackTemplates);
        $twig   = new \Twig\Environment($loader, [
            'debug'            => false,
            'cache'            => false,
            'strict_variables' => false,
        ]);

        // Variables minimales
        $twig->addGlobal('app', [
            'name'        => $config->get('SITE', 'Application'),
            'version'     => $config->get('APP_VERSION', '1.0.0'),
            'environment' => 'fallback',
        ]);

        $twigStats['environment_created'] = true;
        $twigManager                      = null; // Pas de TwigManager en mode fallback

        if (isset($logger) && $logger) {
            $logger->warning("Environnement Twig minimal créé en mode fallback");
        }

    } catch (\Exception $fallbackError) {
        $twig               = null;
        $twigManager        = null;
        $twigStats['error'] = $e->getMessage() . ' | Fallback: ' . $fallbackError->getMessage();

        if (isset($logger) && $logger) {
            $logger->critical("Impossible d'initialiser Twig même en mode minimal", [
                'original_error' => $e->getMessage(),
                'fallback_error' => $fallbackError->getMessage(),
            ]);
        }
    }
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['twig'] = $twigStats;

// Vérification critique : la plupart des pages nécessitent Twig
if (! $twigStats['environment_created']) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');

    // Pages qui peuvent fonctionner sans Twig (API, webhooks, etc.)
    $apiPages  = ['api', 'webhook', 'cron', 'health', 'ping'];
    $isApiPage = false;

    foreach ($apiPages as $apiPage) {
        if (str_starts_with($currentPath, $apiPage)) {
            $isApiPage = true;
            break;
        }
    }

    if (! $isApiPage) {
        $errorDetails = $twigStats['error'] ?? 'Erreur inconnue';

        // Page d'erreur HTML simple si Twig indisponible
        http_response_code(500);
        header('Content-Type: text/html; charset=UTF-8');

        echo "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n";
        echo "<meta charset=\"UTF-8\">\n";
        echo "<title>Erreur TwigManager</title>\n";
        echo "<style>body{font-family:sans-serif;margin:40px;background:#f5f5f5;} .container{max-width:800px;margin:0 auto;background:white;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);} .error{background:#ffebee;border-left:4px solid #f44336;padding:20px;margin:20px 0;} .info{background:#e3f2fd;border-left:4px solid #2196f3;padding:20px;margin:20px 0;}</style>\n";
        echo "</head>\n<body>\n";
        echo "<div class=\"container\">\n";
        echo "<h1>🚨 Erreur TwigManager</h1>\n";
        echo "<div class=\"error\">\n";
        echo "<h2>Problème détecté</h2>\n";
        echo "<p>Le TwigManager n'a pas pu être initialisé correctement.</p>\n";
        echo "<p><strong>Erreur :</strong> " . htmlspecialchars($errorDetails) . "</p>\n";
        echo "</div>\n";
        echo "<div class=\"info\">\n";
        echo "<h2>Solutions recommandées</h2>\n";
        echo "<ol>\n";
        echo "<li>Vérifiez que les nouvelles classes TwigManager ont été créées</li>\n";
        echo "<li>Vérifiez que le fichier 020-classes.php a été modifié</li>\n";
        echo "<li>Vérifiez que le répertoire views/ existe et est accessible</li>\n";
        echo "<li>Consultez les logs d'erreur pour plus de détails</li>\n";
        echo "</ol>\n";
        echo "</div>\n";
        echo "<p><a href=\"/\">🏠 Retour à l'accueil</a></p>\n";
        echo "</div>\n</body>\n</html>";

        exit;
    }
}

// Variables globales pour compatibilité avec l'ancien système
if (isset($twigManager) && $twigManager) {
    // TwigManager disponible - mode normal
    $GLOBALS['twig_manager_available'] = true;
} else {
    // Mode fallback
    $GLOBALS['twig_manager_available'] = false;

    if (isset($logger) && $logger) {
        $logger->warning("Application fonctionnant en mode fallback sans TwigManager");
    }
}

// Log final de l'étape d'initialisation Twig
if (isset($logger) && $logger) {
    $logger->info("Étape 120-twig.php terminée", [
        'twig_manager_available'   => $GLOBALS['twig_manager_available'] ?? false,
        'twig_environment_created' => isset($twig) && $twig !== null,
        'fallback_mode'            => ! ($twigStats['manager_initialized'] ?? false),
        'debug_variables_logged'   => $twigStats['variables_logged'] ?? false,
    ]);
}
