<?php
/**
 * 130-routing.php
 * Résolution de la route courante et matching avec l'URI
 */

$routingStats = [
    'route_resolved' => false,
    'route_found' => false,
    'current_route' => null,
    'uri' => null,
    'path' => null,
    'method' => null,
    'templates_count' => 0,
    'error' => null,
];

try {
    // Vérifier que le routeur est disponible
    if (!isset($router) || !$router) {
        throw new \Exception("Routeur non disponible pour la résolution de route");
    }
    
    // Récupération des informations de la requête
    $requestUri = $_SERVER['REQUEST_URI'] ?? '/';
    $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    
    $routingStats['uri'] = $requestUri;
    $routingStats['method'] = $requestMethod;
    
    // Extraction du chemin sans query string
    $path = parse_url($requestUri, PHP_URL_PATH);
    $routingStats['path'] = $path;
    
    // Tentative de résolution de la route
    $currentRoute = $router->matchFromUri($requestUri);
    
    if ($currentRoute) {
        $routingStats['route_found'] = true;
        $routingStats['current_route'] = $currentRoute['page']['slug'];
        $routingStats['templates_count'] = array_sum(array_map('count', $currentRoute['templates'] ?? []));
        
        // Log détaillé en mode debug
        if ($config->get('TWIG_DEBUG', false) && $logger) {
            $logger->debug("Route résolue avec succès", [
                'slug' => $currentRoute['page']['slug'],
                'title' => $currentRoute['page']['title'],
                'method' => $requestMethod,
                'templates_by_zone' => array_map('count', $currentRoute['templates'] ?? []),
                'page_rights' => $currentRoute['page']['rights'] ?? 0,
            ]);
        }
        
    } else {
        // Aucune route trouvée - préparer la 404
        $routingStats['route_found'] = false;
        
        if ($logger) {
            $logger->info("Aucune route trouvée", [
                'uri' => $requestUri,
                'path' => $path,
                'method' => $requestMethod,
                'available_routes' => array_keys($router->getAllRoutes()),
            ]);
        }
    }
    
    $routingStats['route_resolved'] = true;

} catch (\Exception $e) {
    $routingStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->error("Erreur lors de la résolution de route", [
            'error' => $e->getMessage(),
            'uri' => $requestUri ?? 'unknown',
            'method' => $requestMethod ?? 'unknown',
        ]);
    }
    
    $currentRoute = null;
}

// Log des statistiques de routage
if ($logger) {
    $logger->info("Résolution de route terminée", $routingStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['routing'] = $routingStats;

// Gestion de la 404 si aucune route trouvée
if (!$routingStats['route_found']) {
    http_response_code(404);
    
    try {
        if (isset($twig) && $twig) {
            echo $twig->render('errors/404.twig', [
                'requested_uri' => $requestUri ?? '/',
                'available_routes' => isset($router) ? array_keys($router->getAllRoutes()) : [],
                'is_debug' => $config->get('TWIG_DEBUG', false),
                'error_code' => 404,
                'error_message' => 'Page non trouvée',
            ]);
        } else {
            // Fallback HTML simple si Twig non disponible
            echo "<!DOCTYPE html><html><head><title>404 - Page non trouvée</title></head>";
            echo "<body><h1>404 - Page non trouvée</h1>";
            echo "<p>La page demandée n'existe pas : " . htmlspecialchars($requestUri ?? '/') . "</p>";
            if ($config->get('TWIG_DEBUG', false) && isset($router)) {
                echo "<h2>Routes disponibles :</h2><ul>";
                foreach (array_keys($router->getAllRoutes()) as $route) {
                    echo "<li>" . htmlspecialchars($route) . "</li>";
                }
                echo "</ul>";
            }
            echo "</body></html>";
        }
    } catch (\Exception $e) {
        // Dernière chance : message d'erreur très simple
        if ($logger) {
            $logger->error("Erreur lors du rendu de la page 404", [
                'error' => $e->getMessage(),
            ]);
        }
        die("Erreur 404 : Page non trouvée");
    }
    
    // Arrêter l'exécution ici pour les 404
    exit;
}

// Si on arrive ici, une route a été trouvée - continuer l'initialisation
// Ajouter les variables Twig liées à la route courante
if (isset($twig) && $twig && $currentRoute) {
    $twig->addGlobal('current_route', $currentRoute);
    $twig->addGlobal('page_templates', $currentRoute['templates'] ?? []);
    $twig->addGlobal('request_info', $router->getRequestInfo());
    
    // Variables de la page courante
    $twig->addGlobal('current_page', [
        'slug' => $currentRoute['page']['slug'],
        'title' => $currentRoute['page']['title'],
        'description' => $currentRoute['page']['description'] ?? '',
        'rights' => $currentRoute['page']['rights'] ?? 0,
    ]);
}