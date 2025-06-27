<?php
/**
 * 120-router.php
 * Initialisation du routeur et des services de routage
 */

use Commun\Router\Router;

$routerStats = [
    'initialized' => false,
    'database_required' => true,
    'routes_loaded' => false,
    'routes_count' => 0,
    'template_types_count' => 0,
    'configuration' => [],
    'error' => null,
];

try {
    // Vérifier que la base de données est disponible (le routeur en a besoin)
    if (!isset($sqlAdapter) || !$sqlAdapter) {
        throw new \Exception("Base de données non disponible - requis pour le routeur");
    }
    
    // Initialisation du routeur
    $router = Router::getInstance($sqlAdapter);
    $routerStats['initialized'] = true;
    
    // Configuration du routeur
    $routerConfig = [
        'web_directory' => $config->get('WEB_DIR', ''),
        'default_route' => $config->get('DEFAULT_ROUTE', 'index'),
        'access_denied_route' => $config->get('ACCESS_DENIED_ROUTE', 'login'),
    ];
    
    $router->setWebDirectory($routerConfig['web_directory']);
    $router->setDefaultRoute($routerConfig['default_route']);
    $router->setAccessDeniedRoute($routerConfig['access_denied_route']);
    
    $routerStats['configuration'] = $routerConfig;
    
    // Liaison du gestionnaire de droits au routeur
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
        $allRoutes = $router->getAllRoutes();
        $routerStats['routes_count'] = count($allRoutes);
        
        $templateTypes = $router->getTemplateTypes();
        $routerStats['template_types_count'] = count($templateTypes);
        
        // Log des routes chargées en mode debug
        if ($config->get('TWIG_DEBUG', false) && $logger) {
            $routesList = array_keys($allRoutes);
            $logger->debug("Routes chargées par le routeur", [
                'routes' => $routesList,
                'template_types' => array_values(array_column($templateTypes, 'name')),
            ]);
        }
        
    } catch (\Exception $e) {
        throw new \Exception("Erreur lors du chargement des routes : " . $e->getMessage());
    }
    
    // Ajout des variables globales Twig liées au routeur
    if (isset($twig) && $twig) {
        $twig->addGlobal('router', $router);
        
        // Template types disponibles
        $twig->addGlobal('template_types', $router->getTemplateTypes());
        
        // Configuration du routeur pour Twig
        $twig->addGlobal('router_config', [
            'web_directory' => $routerConfig['web_directory'],
            'default_route' => $routerConfig['default_route'],
        ]);
    }

} catch (\Exception $e) {
    $routerStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->error("Erreur d'initialisation du routeur", [
            'error' => $e->getMessage(),
            'database_available' => isset($sqlAdapter) && $sqlAdapter !== null,
        ]);
    }
    
    // Le routeur est critique pour la plupart des pages
    $router = null;
}

// Log des statistiques du routeur
if ($logger) {
    $logger->info("Routeur initialisé", $routerStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['router'] = $routerStats;

// Vérification critique : la plupart des pages nécessitent le routeur
if (!$routerStats['initialized']) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');
    
    // Pages qui peuvent fonctionner sans routeur (très rares)
    $staticPages = ['ping', 'health', 'status'];
    $isStaticPage = false;
    
    foreach ($staticPages as $staticPage) {
        if ($currentPath === $staticPage) {
            $isStaticPage = true;
            break;
        }
    }
    
    if (!$isStaticPage) {
        die("Erreur critique : Routeur non disponible.\nErreur : " . ($routerStats['error'] ?? 'Inconnue'));
    }
}

// Vérification que les routes ont été chargées
if ($routerStats['initialized'] && !$routerStats['routes_loaded']) {
    if ($logger) {
        $logger->warning("Routeur initialisé mais aucune route chargée", [
            'routes_count' => $routerStats['routes_count'],
            'error' => $routerStats['error'],
        ]);
    }
}