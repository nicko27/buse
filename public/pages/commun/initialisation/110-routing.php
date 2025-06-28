<?php
/**
 * 110-routing.php - Résolution sécurisée de la route courante
 *
 * NOUVEAU : Utilise le routeur corrigé avec toutes les vérifications de sécurité
 */

$routingStats = [
    'route_resolved'      => false,
    'route_found'         => false,
    'current_route'       => null,
    'uri'                 => null,
    'path'                => null,
    'method'              => null,
    'templates_count'     => 0,
    'router_available'    => false,
    'router_health'       => 'unknown',
    'security_checks'     => [],
    'performance_metrics' => [],
    'cache_hit'           => false,
    'error'               => null,
];

// Mesure de performance
$routingStartTime = microtime(true);

try {
    // ===== VÉRIFICATIONS CRITIQUES RENFORCÉES =====

    // Vérifier que le routeur sécurisé est disponible
    if (! isset($router) || ! $router) {
        throw new \Exception("Routeur sécurisé non disponible - Variable \$router non définie");
    }

    // Vérifier que c'est bien une instance du routeur corrigé
    if (! ($router instanceof \Commun\Router\Router)) {
        throw new \Exception("Instance de routeur invalide - Type: " . (is_object($router) ? get_class($router) : gettype($router)));
    }

    // Test de santé du routeur
    try {
        $routerHealth                     = $router->healthCheck();
        $routingStats['router_health']    = $routerHealth['status'];
        $routingStats['router_available'] = ($routerHealth['status'] !== 'unhealthy');

        if ($routerHealth['status'] === 'unhealthy') {
            throw new \Exception("Routeur en état critique - Health check: " . json_encode($routerHealth['checks']));
        }
    } catch (\Exception $e) {
        throw new \Exception("Échec du health check du routeur: " . $e->getMessage());
    }

    $routingStats['router_available'] = true;

    // ===== RÉCUPÉRATION ET VALIDATION DES INFORMATIONS DE REQUÊTE =====

    $requestUri    = $_SERVER['REQUEST_URI'] ?? '/';
    $requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    // Validation de sécurité de l'URI
    if (strlen($requestUri) > 2000) {
        throw new \Exception("URI trop longue (" . strlen($requestUri) . " caractères) - Possible attaque");
    }

    // Détection d'attaques communes dans l'URI
    $dangerousPatterns = [
        '/\.\.[\/\\\\]/',                                               // Directory traversal
        '/[<>"\'\x00-\x08\x0B\x0C\x0E-\x1F]/',                          // Caractères de contrôle
        '/(?:union|select|insert|update|delete|drop|create|alter)\s/i', // SQL keywords
        '/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/i',         // Script tags
    ];

    foreach ($dangerousPatterns as $pattern) {
        if (preg_match($pattern, $requestUri)) {
            if ($logger) {
                $logger->warning("URI suspecte détectée", [
                    'uri'     => $requestUri,
                    'pattern' => $pattern,
                    'ip'      => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
                ]);
            }
            throw new \Exception("URI contient des caractères ou patterns suspects");
        }
    }

    $routingStats['uri']               = $requestUri;
    $routingStats['method']            = $requestMethod;
    $routingStats['security_checks'][] = 'uri_validation_passed';

    // Extraction sécurisée du chemin
    $path = parse_url($requestUri, PHP_URL_PATH);
    if ($path === false || $path === null) {
        throw new \Exception("Format d'URI invalide - Impossible d'extraire le chemin");
    }

    $routingStats['path']              = $path;
    $routingStats['security_checks'][] = 'path_extraction_ok';

    // Log de debug sécurisé des informations de requête
    if ($config->get('DEBUG_MODE', false) && $logger) {
        $logger->debug("Début de résolution sécurisée de route", [
            'uri'           => substr($requestUri, 0, 200), // Limitation pour les logs
            'path'          => $path,
            'method'        => $requestMethod,
            'router_health' => $routingStats['router_health'],
            'client_ip'     => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ]);
    }

    // ===== TENTATIVE DE RÉSOLUTION SÉCURISÉE DE LA ROUTE =====

    $cacheHit     = false;
    $currentRoute = null;

    try {
        // Tentative de résolution avec l'URI fournie
        $matchStartTime = microtime(true);
        $currentRoute   = $router->matchFromUri($requestUri);
        $matchDuration  = microtime(true) - $matchStartTime;

        $routingStats['performance_metrics']['match_time_ms'] = round($matchDuration * 1000, 2);

        // Vérifier si c'est un cache hit en regardant les stats du routeur
        $routerStats               = $router->getStats();
        $cacheHit                  = $routerStats['cache_valid'] ?? false;
        $routingStats['cache_hit'] = $cacheHit;

    } catch (\Exception $e) {
        if ($logger) {
            $logger->error("Erreur lors de la correspondance d'URI", [
                'uri'   => $requestUri,
                'error' => $e->getMessage(),
            ]);
        }
        $currentRoute = null;
    }

    // Fallback vers la route par défaut si aucune correspondance
    if (! $currentRoute) {
        try {
            $defaultRoute = $config->get('DEFAULT_ROUTE', 'index');
            $currentRoute = $router->match($defaultRoute);

            if ($currentRoute && $logger) {
                $logger->info("Utilisation de la route par défaut", [
                    'requested_uri' => $requestUri,
                    'default_route' => $defaultRoute,
                ]);
            }
        } catch (\Exception $e) {
            if ($logger) {
                $logger->error("Échec de fallback vers route par défaut", [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    // ===== TRAITEMENT DU RÉSULTAT =====

    if ($currentRoute) {
        $routingStats['route_found']       = true;
        $routingStats['current_route']     = $currentRoute['page']['slug'];
        $routingStats['templates_count']   = array_sum(array_map('count', $currentRoute['templates'] ?? []));
        $routingStats['security_checks'][] = 'route_found';

        // Validation de sécurité de la route trouvée
        $page = $currentRoute['page'];

        // Vérifier l'intégrité des données de la page
        if (! isset($page['slug']) || ! isset($page['title'])) {
            throw new \Exception("Données de page corrompues - Champs obligatoires manquants");
        }

        // Validation des droits (format et plage)
        $rights = $page['rights'] ?? 0;
        if (! is_numeric($rights) || $rights < 0 || $rights > 2147483647) {
            if ($logger) {
                $logger->warning("Droits de page invalides corrigés", [
                    'page'           => $page['slug'],
                    'invalid_rights' => $rights,
                ]);
            }
            $currentRoute['page']['rights'] = 0;
        }

        $routingStats['security_checks'][] = 'page_data_validated';

        // Validation des redirections si présentes
        if (! empty($page['redirect_to'])) {
            // La validation de sécurité des redirections a déjà été faite par le routeur corrigé
            $routingStats['security_checks'][] = 'redirect_validated';
        }

        // Log détaillé en mode debug avec données sécurisées
        if ($config->get('DEBUG_MODE', false) && $logger) {
            $debugData = [
                'slug'                   => $page['slug'],
                'title'                  => $page['title'],
                'method'                 => $requestMethod,
                'templates_by_zone'      => array_map('count', $currentRoute['templates'] ?? []),
                'page_rights'            => $page['rights'] ?? 0,
                'cache_hit'              => $cacheHit,
                'match_time_ms'          => $routingStats['performance_metrics']['match_time_ms'] ?? 0,
                'security_checks_passed' => count($routingStats['security_checks'])
            ];

            // Ne pas logger les données sensibles
            if (isset($page['redirect_to'])) {
                $debugData['has_redirect'] = true;
            }

            $logger->debug("Route sécurisée résolue avec succès", $debugData);
        }

    } else {
        // ===== GESTION SÉCURISÉE DE L'ABSENCE DE ROUTE =====

        $routingStats['route_found']       = false;
        $routingStats['security_checks'][] = 'no_route_found';

        if ($logger) {
            // Informations de diagnostic sécurisées
            try {
                $allRoutes       = $router->getAllRoutes();
                $availableRoutes = array_keys($allRoutes);

                $logger->info("Aucune route trouvée - analyse diagnostique", [
                    'uri'                    => substr($requestUri, 0, 200),
                    'path'                   => $path,
                    'method'                 => $requestMethod,
                    'available_routes_count' => count($availableRoutes),
                    'web_directory'          => $config->get('WEB_DIR', ''),
                    'default_route'          => $config->get('DEFAULT_ROUTE', 'index'),
                    'router_health'          => $routingStats['router_health'],
                    'cache_valid'            => $routerStats['cache_valid'] ?? false,
                ]);

                // Log des routes disponibles seulement en mode debug et si peu nombreuses
                if ($config->get('DEBUG_MODE', false) && count($availableRoutes) <= 10) {
                    $logger->debug("Routes disponibles", [
                        'routes' => $availableRoutes,
                    ]);
                }
            } catch (\Exception $e) {
                $logger->error("Erreur lors de la collecte d'informations diagnostiques", [
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    // Calcul des métriques de performance
    $routingEndTime                                         = microtime(true);
    $routingStats['performance_metrics']['total_time_ms']   = round(($routingEndTime - $routingStartTime) * 1000, 2);
    $routingStats['performance_metrics']['memory_usage_mb'] = round(memory_get_usage(true) / 1024 / 1024, 2);

    $routingStats['route_resolved']    = true;
    $routingStats['security_checks'][] = 'resolution_completed';

} catch (\Exception $e) {
    $routingStats['error']          = $e->getMessage();
    $routingStats['route_resolved'] = false;

    // Calcul du temps même en cas d'erreur
    $routingEndTime                                       = microtime(true);
    $routingStats['performance_metrics']['total_time_ms'] = round(($routingEndTime - $routingStartTime) * 1000, 2);

    if ($logger) {
        $logger->error("Erreur critique lors de la résolution sécurisée de route", [
            'error'                  => $e->getMessage(),
            'file'                   => $e->getFile(),
            'line'                   => $e->getLine(),
            'uri'                    => $requestUri ?? 'unknown',
            'method'                 => $requestMethod ?? 'unknown',
            'router_available'       => $routingStats['router_available'],
            'router_health'          => $routingStats['router_health'],
            'security_checks_passed' => $routingStats['security_checks'],
            'performance_metrics'    => $routingStats['performance_metrics'],
        ]);
    }

    $currentRoute = null;
}

// Log des statistiques finales de routage
if ($logger) {
    $logLevel = $routingStats['route_found'] ? 'info' : 'warning';
    $logger->log($logLevel, "Résolution sécurisée de route terminée", [
        'route_found'           => $routingStats['route_found'],
        'route_resolved'        => $routingStats['route_resolved'],
        'current_route'         => $routingStats['current_route'],
        'router_health'         => $routingStats['router_health'],
        'cache_hit'             => $routingStats['cache_hit'],
        'security_checks_count' => count($routingStats['security_checks']),
        'performance'           => $routingStats['performance_metrics'],
    ]);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['routing'] = $routingStats;

// ===== GESTION SÉCURISÉE DE LA 404 =====
if (! $routingStats['route_found']) {
    http_response_code(404);

    // Headers de sécurité
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('X-XSS-Protection: 1; mode=block');

    try {
        if (isset($twig) && $twig) {
            // Collecte d'informations sécurisées pour la page 404
            $availableRoutes = [];
            $routerInfo      = [
                'available' => $routingStats['router_available'],
                'health'    => $routingStats['router_health'],
                'error'     => $routingStats['error'],
            ];

            if ($routingStats['router_available'] && $router) {
                try {
                    $allRoutes = $router->getAllRoutes();
                    // Limiter le nombre de routes affichées pour éviter la divulgation d'information
                    $availableRoutes = array_slice(array_keys($allRoutes), 0, 20);
                } catch (\Exception $e) {
                    $routerInfo['routes_error'] = $e->getMessage();
                }
            }

            // Données sécurisées pour le template 404
            $templateData = [
                'requested_uri'    => htmlspecialchars(substr($requestUri ?? '/', 0, 200)),
                'available_routes' => $availableRoutes,
                'is_debug'         => $config->get('DEBUG_MODE', false),
                'error_code'       => 404,
                'error_message'    => 'Page non trouvée',
                'router_info'      => $routerInfo,
                'security_info'    => [
                    'checks_passed'      => count($routingStats['security_checks']),
                    'cache_status'       => $routingStats['cache_hit'] ? 'hit' : 'miss',
                    'resolution_time_ms' => $routingStats['performance_metrics']['total_time_ms'] ?? 0,
                ],
                'timestamp'        => time(),
                'request_id'       => uniqid('req_', true),
            ];

            echo $twig->render('errors/404.twig', $templateData);

        } else {
            // Fallback HTML sécurisé si Twig non disponible
            $safeUri = htmlspecialchars(substr($requestUri ?? '/', 0, 200));
            $isDebug = $config->get('DEBUG_MODE', false);

            echo "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n";
            echo "<meta charset=\"UTF-8\">\n";
            echo "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n";
            echo "<title>404 - Page non trouvée</title>\n";
            echo "<style>\n";
            echo "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:40px;background:#f5f5f5;color:#333;}\n";
            echo ".container{max-width:600px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}\n";
            echo ".error{background:#ffebee;border-left:4px solid #f44336;padding:20px;margin:20px 0;border-radius:4px;}\n";
            echo ".debug{background:#e3f2fd;border-left:4px solid #2196f3;padding:15px;margin:20px 0;border-radius:4px;font-size:14px;}\n";
            echo "h1{color:#d32f2f;margin-top:0;} .btn{display:inline-block;padding:10px 20px;background:#1976d2;color:#fff;text-decoration:none;border-radius:4px;margin:5px;}\n";
            echo ".btn:hover{background:#1565c0;} ul{margin:10px 0;} li{margin:5px 0;}\n";
            echo "</style>\n";
            echo "</head>\n<body>\n";
            echo "<div class=\"container\">\n";
            echo "<h1>🚫 404 - Page non trouvée</h1>\n";
            echo "<div class=\"error\">\n";
            echo "<p><strong>La page demandée n'existe pas :</strong></p>\n";
            echo "<p><code>$safeUri</code></p>\n";
            echo "</div>\n";

            if ($routingStats['error']) {
                echo "<div class=\"error\">\n";
                echo "<p><strong>Erreur technique :</strong> " . htmlspecialchars($routingStats['error']) . "</p>\n";
                echo "</div>\n";
            }

            if ($isDebug && $routingStats['router_available'] && $router) {
                echo "<div class=\"debug\">\n";
                echo "<h3>🔧 Informations de debug</h3>\n";
                echo "<ul>\n";
                echo "<li><strong>Routeur :</strong> " . ($routingStats['router_available'] ? '✅ Disponible' : '❌ Indisponible') . "</li>\n";
                echo "<li><strong>Santé :</strong> " . htmlspecialchars($routingStats['router_health']) . "</li>\n";
                echo "<li><strong>Cache :</strong> " . ($routingStats['cache_hit'] ? '✅ Hit' : '❌ Miss') . "</li>\n";
                echo "<li><strong>Contrôles sécurité :</strong> " . count($routingStats['security_checks']) . " passés</li>\n";
                echo "<li><strong>Temps résolution :</strong> " . ($routingStats['performance_metrics']['total_time_ms'] ?? 0) . "ms</li>\n";
                echo "</ul>\n";

                // Afficher quelques routes disponibles
                try {
                    $allRoutes  = $router->getAllRoutes();
                    $routesList = array_slice(array_keys($allRoutes), 0, 10);

                    if (! empty($routesList)) {
                        echo "<h4>Routes disponibles (échantillon) :</h4>\n<ul>\n";
                        foreach ($routesList as $route) {
                            $safeRoute = htmlspecialchars($route);
                            echo "<li><a href=\"/$safeRoute\">$safeRoute</a></li>\n";
                        }
                        if (count($allRoutes) > 10) {
                            echo "<li><em>... et " . (count($allRoutes) - 10) . " autres</em></li>\n";
                        }
                        echo "</ul>\n";
                    }
                } catch (\Exception $e) {
                    echo "<p><em>Erreur de récupération des routes : " . htmlspecialchars($e->getMessage()) . "</em></p>\n";
                }
                echo "</div>\n";
            }

            echo "<p>\n";
            echo "<a href=\"/\" class=\"btn\">🏠 Retour à l'accueil</a>\n";
            if ($isDebug) {
                echo "<a href=\"?refresh=1\" class=\"btn\">🔄 Recharger</a>\n";
            }
            echo "</p>\n";

            echo "<p style=\"color:#666;font-size:12px;margin-top:30px;\">\n";
            echo "ID requête : " . uniqid('req_', true) . " | ";
            echo "Timestamp : " . date('Y-m-d H:i:s') . "\n";
            echo "</p>\n";

            echo "</div>\n</body>\n</html>";
        }
    } catch (\Exception $e) {
        // Dernière chance : message d'erreur minimal et sécurisé
        if ($logger) {
            $logger->error("Erreur lors du rendu sécurisé de la page 404", [
                'error'        => $e->getMessage(),
                'original_uri' => $requestUri ?? 'unknown',
            ]);
        }

        header('Content-Type: text/html; charset=UTF-8');
        echo "<!DOCTYPE html>\n<html>\n<head>\n<title>404</title>\n</head>\n<body>\n";
        echo "<h1>🚫 Erreur 404 : Page non trouvée</h1>\n";
        echo "<p>URI demandée : " . htmlspecialchars(substr($requestUri ?? '/', 0, 100)) . "</p>\n";
        if ($routingStats['error']) {
            echo "<p>Erreur : " . htmlspecialchars($routingStats['error']) . "</p>\n";
        }
        echo "<p><a href=\"/\">🏠 Retour à l'accueil</a></p>\n";
        echo "<p style=\"font-size:12px;color:#666;\">Timestamp : " . date('Y-m-d H:i:s') . "</p>\n";
        echo "</body>\n</html>";
    }

    // Arrêter l'exécution ici pour les 404
    exit;
}

// ===== SUCCÈS : ROUTE TROUVÉE =====
// Si on arrive ici, une route a été trouvée et validée - continuer l'initialisation

// ===== ENRICHISSEMENT SÉCURISÉ DES VARIABLES TWIG =====
if (isset($twig) && $twig && $currentRoute) {
    try {
        // Variables principales de la route (données déjà validées par le routeur)
        $twig->addGlobal('current_route', $currentRoute);
        $twig->addGlobal('page_templates', $currentRoute['templates'] ?? []);

        // Informations de requête sécurisées
        if ($routingStats['router_available'] && $router) {
            try {
                $requestInfo = $router->getRequestInfo();
                // Ajouter des informations de sécurité supplémentaires
                $requestInfo['security'] = [
                    'checks_passed'      => $routingStats['security_checks'],
                    'cache_hit'          => $routingStats['cache_hit'],
                    'router_health'      => $routingStats['router_health'],
                    'resolution_time_ms' => $routingStats['performance_metrics']['total_time_ms'] ?? 0,
                ];
                $twig->addGlobal('request_info', $requestInfo);
            } catch (\Exception $e) {
                if ($logger) {
                    $logger->warning("Erreur lors de la récupération des infos de requête", [
                        'error' => $e->getMessage(),
                    ]);
                }
                // Fallback avec données minimales sécurisées
                $twig->addGlobal('request_info', [
                    'method'    => $requestMethod,
                    'timestamp' => time(),
                    'security'  => ['status' => 'partial'],
                ]);
            }
        }

        // Variables sécurisées de la page courante
        $twig->addGlobal('current_page', [
            'slug'           => $currentRoute['page']['slug'],
            'title'          => $currentRoute['page']['title'],
            'description'    => $currentRoute['page']['description'] ?? '',
            'rights'         => (int) ($currentRoute['page']['rights'] ?? 0),
            'has_redirect'   => ! empty($currentRoute['page']['redirect_to']),
            'template_zones' => array_keys($currentRoute['templates'] ?? [])
        ]);

        // Variables de performance et sécurité pour le debug
        if ($config->get('DEBUG_MODE', false)) {
            $twig->addGlobal('routing_debug', [
                'performance'     => $routingStats['performance_metrics'],
                'security_checks' => $routingStats['security_checks'],
                'cache_hit'       => $routingStats['cache_hit'],
                'router_health'   => $routingStats['router_health'],
                'templates_count' => $routingStats['templates_count'],
            ]);
        }

        // Log de succès en mode debug
        if ($logger && $config->get('DEBUG_MODE', false)) {
            $logger->debug("Variables Twig sécurisées ajoutées pour la route", [
                'slug'            => $currentRoute['page']['slug'],
                'templates_zones' => array_keys($currentRoute['templates'] ?? []),
                'variables_added' => ['current_route', 'page_templates', 'request_info', 'current_page'],
                'security_status' => 'validated'
            ]);
        }

    } catch (\Exception $e) {
        if ($logger) {
            $logger->error("Erreur lors de l'ajout des variables Twig sécurisées", [
                'error' => $e->getMessage(),
                'page'  => $currentRoute['page']['slug'] ?? 'unknown',
            ]);
        }

        // En cas d'erreur, ajouter au moins les variables de base
        try {
            $twig->addGlobal('current_route', $currentRoute);
            $twig->addGlobal('current_page', [
                'slug'   => $currentRoute['page']['slug'] ?? 'unknown',
                'title'  => $currentRoute['page']['title'] ?? 'Page',
                'rights' => 0,
            ]);
        } catch (\Exception $fallbackError) {
            if ($logger) {
                $logger->critical("Impossible d'ajouter même les variables Twig de base", [
                    'error' => $fallbackError->getMessage(),
                ]);
            }
        }
    }
}

// ===== LOG FINAL DE SUCCÈS =====
if ($logger && $routingStats['route_found']) {
    $logger->info("Route sécurisée résolue et configurée avec succès", [
        'page'                   => $currentRoute['page']['slug'],
        'total_time_ms'          => $routingStats['performance_metrics']['total_time_ms'] ?? 0,
        'security_checks_passed' => count($routingStats['security_checks']),
        'cache_hit'              => $routingStats['cache_hit'],
        'router_health'          => $routingStats['router_health'],
        'templates_available'    => $routingStats['templates_count'],
        'memory_usage_mb'        => $routingStats['performance_metrics']['memory_usage_mb'] ?? 0,
    ]);
}
