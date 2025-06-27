<?php
/**
 * 130-routing.php (CORRIGÉ)
 * Résolution de la route courante avec vérifications renforcées
 */

$routingStats = [
    'route_resolved'   => false,
    'route_found'      => false,
    'current_route'    => null,
    'uri'              => null,
    'path'             => null,
    'method'           => null,
    'templates_count'  => 0,
    'router_available' => false,
    'error'            => null,
];

try {
    // ===== VÉRIFICATION CRITIQUE DU ROUTEUR =====

    // Vérifier que le routeur est disponible
    if (! isset($router) || ! $router) {
        throw new \Exception("Routeur non disponible pour la résolution de route - Variable \$router non définie");
    }

    // Vérifier que le routeur est correctement initialisé
    if (! ($router instanceof \Commun\Router\Router)) {
        throw new \Exception("Variable \$router n'est pas une instance de Router valide");
    }

    $routingStats['router_available'] = true;

    // ===== RÉCUPÉRATION DES INFORMATIONS DE REQUÊTE =====

    $requestUri    = $_SERVER['REQUEST_URI'] ?? '/';
    $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    $routingStats['uri']    = $requestUri;
    $routingStats['method'] = $requestMethod;

    // Extraction du chemin sans query string
    $path                 = parse_url($requestUri, PHP_URL_PATH);
    $routingStats['path'] = $path;

    // Log de debug des informations de requête
    if ($config->get('TWIG_DEBUG', false) && $logger) {
        $logger->debug("Début de résolution de route", [
            'uri'    => $requestUri,
            'path'   => $path,
            'method' => $requestMethod,
        ]);
    }

    // ===== TENTATIVE DE RÉSOLUTION DE LA ROUTE =====

    $currentRoute = $router->matchFromUri($requestUri);
    if (! $currentRoute) {
        $currentRoute = $router->matchFromUri($config->get('DEFAULT_ROUTE', 'index'));
    }

    if ($currentRoute) {
        $routingStats['route_found']     = true;
        $routingStats['current_route']   = $currentRoute['page']['slug'];
        $routingStats['templates_count'] = array_sum(array_map('count', $currentRoute['templates'] ?? []));

        // Log détaillé en mode debug
        if ($config->get('TWIG_DEBUG', false) && $logger) {
            $logger->debug("Route résolue avec succès", [
                'slug'              => $currentRoute['page']['slug'],
                'title'             => $currentRoute['page']['title'],
                'method'            => $requestMethod,
                'templates_by_zone' => array_map('count', $currentRoute['templates'] ?? []),
                'page_rights'       => $currentRoute['page']['rights'] ?? 0,
            ]);
        }

    } else {
        // ===== GESTION DE L'ABSENCE DE ROUTE =====

        $routingStats['route_found'] = false;

        if ($logger) {
            // Informations de debug pour diagnostiquer le problème
            $allRoutes = $router->getAllRoutes();
            $logger->info("Aucune route trouvée", [
                'uri'              => $requestUri,
                'path'             => $path,
                'method'           => $requestMethod,
                'available_routes' => array_keys($allRoutes),
                'web_directory'    => $config->get('WEB_DIR', ''),
                'default_route'    => $config->get('DEFAULT_ROUTE', 'index'),
            ]);
        }
    }

    $routingStats['route_resolved'] = true;

} catch (\Exception $e) {
    $routingStats['error'] = $e->getMessage();

    if ($logger) {
        $logger->error("Erreur lors de la résolution de route", [
            'error'            => $e->getMessage(),
            'uri'              => $requestUri ?? 'unknown',
            'method'           => $requestMethod ?? 'unknown',
            'router_available' => $routingStats['router_available'],
            'router_type'      => isset($router) ? get_class($router) : 'undefined',
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

// ===== GESTION DE LA 404 =====
if (! $routingStats['route_found']) {
    http_response_code(404);

    try {
        if (isset($twig) && $twig) {
            // Collecte d'informations pour la page 404
            $availableRoutes = [];
            if ($routingStats['router_available'] && $router) {
                try {
                    $allRoutes       = $router->getAllRoutes();
                    $availableRoutes = array_keys($allRoutes);
                } catch (\Exception $e) {
                    // Ignore les erreurs de récupération des routes
                }
            }

            echo $twig->render('errors/404.twig', [
                'requested_uri'    => $requestUri ?? '/',
                'available_routes' => $availableRoutes,
                'is_debug'         => $config->get('TWIG_DEBUG', false),
                'error_code'       => 404,
                'error_message'    => 'Page non trouvée',
                'routing_error'    => $routingStats['error'] ?? null,
                'router_available' => $routingStats['router_available'],
            ]);
        } else {
            // Fallback HTML simple si Twig non disponible
            echo "<!DOCTYPE html><html><head><title>404 - Page non trouvée</title>";
            echo "<style>body{font-family:sans-serif;margin:40px;} .error{background:#ffebee;border:1px solid #f44336;padding:20px;border-radius:4px;}</style>";
            echo "</head><body>";
            echo "<h1>404 - Page non trouvée</h1>";
            echo "<div class=\"error\">";
            echo "<p>La page demandée n'existe pas : " . htmlspecialchars($requestUri ?? '/') . "</p>";

            if ($routingStats['error']) {
                echo "<p><strong>Erreur technique :</strong> " . htmlspecialchars($routingStats['error']) . "</p>";
            }

            if ($config->get('TWIG_DEBUG', false) && $routingStats['router_available'] && $router) {
                echo "<h2>Debug - Routes disponibles :</h2><ul>";
                try {
                    foreach (array_keys($router->getAllRoutes()) as $route) {
                        echo "<li><a href=\"/" . htmlspecialchars($route) . "\">" . htmlspecialchars($route) . "</a></li>";
                    }
                } catch (\Exception $e) {
                    echo "<li>Erreur de récupération des routes: " . htmlspecialchars($e->getMessage()) . "</li>";
                }
                echo "</ul>";
            }

            echo "</div>";
            echo "<p><a href=\"/\">🏠 Retour à l'accueil</a></p>";
            echo "</body></html>";
        }
    } catch (\Exception $e) {
        // Dernière chance : message d'erreur très simple
        if ($logger) {
            $logger->error("Erreur lors du rendu de la page 404", [
                'error' => $e->getMessage(),
            ]);
        }

        echo "<!DOCTYPE html><html><head><title>404</title></head><body>";
        echo "<h1>Erreur 404 : Page non trouvée</h1>";
        echo "<p>URI demandée : " . htmlspecialchars($requestUri ?? '/') . "</p>";
        if ($routingStats['error']) {
            echo "<p>Erreur : " . htmlspecialchars($routingStats['error']) . "</p>";
        }
        echo "<p><a href=\"/\">Retour</a></p>";
        echo "</body></html>";
    }

    // Arrêter l'exécution ici pour les 404
    exit;
}

// ===== SUCCÈS : ROUTE TROUVÉE =====
// Si on arrive ici, une route a été trouvée - continuer l'initialisation

// Ajouter les variables Twig liées à la route courante
if (isset($twig) && $twig && $currentRoute) {
    $twig->addGlobal('current_route', $currentRoute);
    $twig->addGlobal('page_templates', $currentRoute['templates'] ?? []);

    // Informations de requête pour Twig
    if ($routingStats['router_available'] && $router) {
        try {
            $twig->addGlobal('request_info', $router->getRequestInfo());
        } catch (\Exception $e) {
            // Ignore les erreurs de récupération d'infos
        }
    }

    // Variables de la page courante
    $twig->addGlobal('current_page', [
        'slug'        => $currentRoute['page']['slug'],
        'title'       => $currentRoute['page']['title'],
        'description' => $currentRoute['page']['description'] ?? '',
        'rights'      => $currentRoute['page']['rights'] ?? 0,
    ]);

    if ($logger && $config->get('TWIG_DEBUG', false)) {
        $logger->debug("Variables Twig ajoutées pour la route", [
            'slug'            => $currentRoute['page']['slug'],
            'templates_zones' => array_keys($currentRoute['templates'] ?? []),
        ]);
    }
}
