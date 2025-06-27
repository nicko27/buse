<?php
/**
 * 120-router.php (CORRIGÉ - SANS AJOUT TWIG)
 * Initialisation du routeur sans modification de Twig
 */

$routerStats = [
    'initialized'          => false,
    'database_required'    => true,
    'routes_loaded'        => false,
    'routes_count'         => 0,
    'template_types_count' => 0,
    'configuration'        => [],
    'error'                => null,
];

// Variable globale pour s'assurer que $router est disponible dans les autres fichiers
$router = null;

try {
    // Vérifier que la base de données est disponible (le routeur en a besoin)
    if (! isset($sqlAdapter) || ! $sqlAdapter) {
        throw new \Exception("Base de données non disponible - requis pour le routeur");
    }

    // Vérifier que SqlAdapter fonctionne
    if (! $sqlAdapter->testConnection()) {
        throw new \Exception("Test de connexion SqlAdapter échoué");
    }

    // Initialisation du routeur
    $router                     = \Commun\Router\Router::getInstance($sqlAdapter);
    $routerStats['initialized'] = true;

    // Configuration du routeur
    $routerConfig = [
        'web_directory'       => $config->get('WEB_DIR', ''),
        'default_route'       => $config->get('DEFAULT_ROUTE', 'index'),
        'access_denied_route' => $config->get('ACCESS_DENIED_ROUTE', 'login'),
    ];

    $router->setWebDirectory($routerConfig['web_directory']);
    $router->setDefaultRoute($routerConfig['default_route']);
    $router->setAccessDeniedRoute($routerConfig['access_denied_route']);

    $routerStats['configuration'] = $routerConfig;

    // Liaison du gestionnaire de droits au routeur (si disponible)
    if (isset($rightsManager) && $rightsManager) {
        $router->setRightsManager($rightsManager);
    } else {
        if ($logger) {
            $logger->warning("RightsManager non disponible pour le routeur");
        }
    }

    // Chargement des routes depuis la base de données
    try {
        $router->loadRoutes();
        $routerStats['routes_loaded'] = true;

        // Statistiques du chargement
        $allRoutes                   = $router->getAllRoutes();
        $routerStats['routes_count'] = count($allRoutes);

        $templateTypes                       = $router->getTemplateTypes();
        $routerStats['template_types_count'] = count($templateTypes);

        // Log des routes chargées en mode debug
        if ($config->get('TWIG_DEBUG', false) && $logger) {
            $routesList = array_keys($allRoutes);
            $logger->debug("Routes chargées par le routeur", [
                'routes'         => $routesList,
                'template_types' => array_values(array_column($templateTypes, 'name')),
            ]);
        }

        // Vérification que la route par défaut existe
        $defaultRoute = $routerConfig['default_route'];
        if (! isset($allRoutes[$defaultRoute])) {
            $availableRoutes = array_keys($allRoutes);
            throw new \Exception("Route par défaut '$defaultRoute' non trouvée. Routes disponibles: " . implode(', ', $availableRoutes));
        }

    } catch (\Exception $e) {
        throw new \Exception("Erreur lors du chargement des routes : " . $e->getMessage());
    }

    // ===== STOCKAGE DES DONNÉES POUR TWIG (SANS AJOUT DIRECT) =====
    // On stocke les données dans des variables globales que Twig récupérera plus tard

    $GLOBALS['router_data_for_twig'] = [
        'router'         => $router,
        'template_types' => $router->getTemplateTypes(),
        'router_config'  => [
            'web_directory' => $routerConfig['web_directory'],
            'default_route' => $routerConfig['default_route'],
        ],
        'all_routes'     => $allRoutes,
        'routes_count'   => count($allRoutes),
    ];

} catch (\Exception $e) {
    $routerStats['error'] = $e->getMessage();

    if ($logger) {
        $logger->error("Erreur d'initialisation du routeur", [
            'error'              => $e->getMessage(),
            'database_available' => isset($sqlAdapter) && $sqlAdapter !== null,
            'database_test'      => isset($sqlAdapter) ? $sqlAdapter->testConnection() : false,
        ]);
    }

    // Le routeur est critique pour la plupart des pages
    $router = null;

    // Même en cas d'erreur, on stocke ce qu'on peut pour Twig
    $GLOBALS['router_data_for_twig'] = [
        'router'         => null,
        'template_types' => [],
        'router_config'  => [
            'web_directory' => '',
            'default_route' => 'index',
        ],
        'all_routes'     => [],
        'routes_count'   => 0,
        'error'          => $e->getMessage(),
    ];
}

// Log des statistiques du routeur
if ($logger) {
    $logger->info("Routeur initialisé", $routerStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['router'] = $routerStats;

// Vérification critique : la plupart des pages nécessitent le routeur
if (! $routerStats['initialized'] || ! $router) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');

    // Pages qui peuvent fonctionner sans routeur (très rares)
    $staticPages  = ['ping', 'health', 'status'];
    $isStaticPage = false;

    foreach ($staticPages as $staticPage) {
        if ($currentPath === $staticPage) {
            $isStaticPage = true;
            break;
        }
    }

    if (! $isStaticPage) {
        // Affichage d'une page d'erreur détaillée
        http_response_code(500);
        header('Content-Type: text/html; charset=UTF-8');

        echo "<!DOCTYPE html>\n<html>\n<head>\n<title>Erreur de routeur</title>\n";
        echo "<style>body{font-family:sans-serif;margin:40px;background:#f5f5f5;} .error{background:#ffebee;border:1px solid #f44336;padding:20px;margin:20px 0;border-radius:4px;} .debug{background:#e3f2fd;border:1px solid #2196f3;padding:15px;margin:20px 0;border-radius:4px;}</style>\n";
        echo "</head>\n<body>\n";
        echo "<h1>🚨 Erreur du routeur</h1>\n";
        echo "<div class=\"error\">\n";
        echo "<p><strong>Le routeur n'a pas pu être initialisé.</strong></p>\n";
        echo "<p><strong>Erreur :</strong> " . htmlspecialchars($routerStats['error'] ?? 'Erreur inconnue') . "</p>\n";
        echo "</div>\n";

        if ($config->get('TWIG_DEBUG', false)) {
            echo "<div class=\"debug\">\n";
            echo "<h3>Informations de debug</h3>\n";
            echo "<ul>\n";
            echo "<li><strong>Base de données disponible :</strong> " . (isset($sqlAdapter) ? 'Oui' : 'Non') . "</li>\n";
            echo "<li><strong>Test BDD :</strong> " . (isset($sqlAdapter) && $sqlAdapter->testConnection() ? 'OK' : 'Échec') . "</li>\n";
            echo "<li><strong>Configuration :</strong> " . json_encode($routerStats['configuration']) . "</li>\n";
            echo "<li><strong>Routes chargées :</strong> " . ($routerStats['routes_loaded'] ? 'Oui' : 'Non') . "</li>\n";
            echo "</ul>\n";
            echo "</div>\n";
        }

        echo "<p><a href=\"/index.php\">🔧 Test direct de index.php</a></p>\n";
        echo "</body>\n</html>";
        exit;
    }
}

// Vérification que les routes ont été chargées
if ($routerStats['initialized'] && ! $routerStats['routes_loaded']) {
    if ($logger) {
        $logger->warning("Routeur initialisé mais aucune route chargée", [
            'routes_count' => $routerStats['routes_count'],
            'error'        => $routerStats['error'],
        ]);
    }
}

// S'assurer que $router est bien défini pour les fichiers suivants
if (! $router) {
    if ($logger) {
        $logger->critical("Variable \$router non définie à la fin de 120-router.php");
    }
}
