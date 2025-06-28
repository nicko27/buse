<?php
/**
 * 100-router.php - Initialisation du routeur sécurisé et optimisé
 *
 * NOUVEAU : Utilise le routeur corrigé avec toutes les améliorations de sécurité
 */

use Commun\Router\Router;
use Commun\Router\RouterConfig;

$routerStats = [
    'initialized'          => false,
    'database_required'    => true,
    'routes_loaded'        => false,
    'routes_count'         => 0,
    'template_types_count' => 0,
    'configuration'        => [],
    'health_status'        => 'unknown',
    'security_enabled'     => false,
    'cache_valid'          => false,
    'error'                => null,
];

// Variable globale pour s'assurer que $router est disponible dans les autres fichiers
$router = null;

try {
    // ===== VÉRIFICATIONS PRÉALABLES =====

    // Vérifier que la base de données est disponible (le routeur en a besoin)
    if (! isset($sqlAdapter) || ! $sqlAdapter) {
        throw new \Exception("Base de données non disponible - requis pour le routeur sécurisé");
    }

    // Test de connectivité renforcé
    if (! $sqlAdapter->testConnection()) {
        throw new \Exception("Test de connexion SqlAdapter échoué - vérifiez la connectivité BDD");
    }

    // Vérifier que les nouvelles classes sont disponibles
    if (! class_exists('Commun\Router\RouterConfig')) {
        throw new \Exception("RouterConfig non trouvé - vérifiez que le nouveau fichier a été ajouté");
    }

    // ===== CONFIGURATION SÉCURISÉE =====

    // Configuration utilisateur avec validation
    $userConfig = [
        'max_routes_cache' => (int) $config->get('ROUTER_MAX_ROUTES', 1000),
        'cache_ttl'        => (int) $config->get('ROUTER_CACHE_TTL', 3600),
        'db_timeout'       => (int) $config->get('ROUTER_DB_TIMEOUT', 10),
        'thread_safe_mode' => filter_var($config->get('ROUTER_THREAD_SAFE', 'true'), FILTER_VALIDATE_BOOLEAN),
    ];

    // Fusion avec les valeurs par défaut et validation
    try {
        $routerConfig                 = RouterConfig::mergeConfig($userConfig);
        $routerStats['configuration'] = $routerConfig;
    } catch (\InvalidArgumentException $e) {
        // Fallback vers configuration par défaut en cas d'erreur
        if ($logger) {
            $logger->warning("Configuration routeur invalide, utilisation des valeurs par défaut", [
                'error'       => $e->getMessage(),
                'user_config' => $userConfig,
            ]);
        }
        $routerConfig                 = RouterConfig::getDefaultConfig();
        $routerStats['configuration'] = $routerConfig;
    }

    // ===== INITIALISATION SÉCURISÉE DU ROUTEUR =====

    // Réinitialisation pour éviter les états corrompus
    Router::resetInstance();

    // Initialisation avec gestion d'erreur renforcée
    $router                          = Router::getInstance($sqlAdapter);
    $routerStats['initialized']      = true;
    $routerStats['security_enabled'] = true;

    // ===== CONFIGURATION DU ROUTEUR =====

    // Configuration de base
    $baseConfig = [
        'web_directory'       => $config->get('WEB_DIR', ''),
        'default_route'       => $config->get('DEFAULT_ROUTE', 'index'),
        'access_denied_route' => $config->get('ACCESS_DENIED_ROUTE', 'login'),
    ];

    // Application de la configuration avec validation
    try {
        $router->setWebDirectory($baseConfig['web_directory']);
        $router->setDefaultRoute($baseConfig['default_route']);
        $router->setAccessDeniedRoute($baseConfig['access_denied_route']);
    } catch (\InvalidArgumentException $e) {
        throw new \Exception("Configuration routeur invalide : " . $e->getMessage());
    }

    // Configuration avancée depuis RouterConfig
    $router->setMaxRoutesInCache($routerConfig['max_routes_cache']);
    $router->setCacheTtl($routerConfig['cache_ttl']);
    $router->setDbTimeout($routerConfig['db_timeout']);

    // ===== CONFIGURATION DE SÉCURITÉ =====

    // Domaines autorisés pour les redirections
    $allowedDomains = $config->get('ALLOWED_REDIRECT_DOMAINS', '');
    if (! empty($allowedDomains)) {
        $domains = array_map('trim', explode(',', $allowedDomains));
        foreach ($domains as $domain) {
            if (! empty($domain)) {
                try {
                    $router->addAllowedRedirectDomain($domain);
                } catch (\InvalidArgumentException $e) {
                    if ($logger) {
                        $logger->warning("Domaine invalide ignoré", [
                            'domain' => $domain,
                            'error'  => $e->getMessage(),
                        ]);
                    }
                }
            }
        }
    }

    // Domaine actuel toujours autorisé
    $currentHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
    try {
        $router->addAllowedRedirectDomain($currentHost);
    } catch (\InvalidArgumentException $e) {
        // Ignore si déjà ajouté ou invalide
    }

    // ===== LIAISON DES SERVICES =====

    // Liaison du gestionnaire de droits au routeur (si disponible)
    if (isset($rightsManager) && $rightsManager) {
        $router->setRightsManager($rightsManager);
        if ($logger) {
            $logger->debug("RightsManager lié au routeur sécurisé");
        }
    } else {
        if ($logger) {
            $logger->warning("RightsManager non disponible pour le routeur - droits d'accès désactivés");
        }
    }

    // ===== CHARGEMENT DES ROUTES =====

    try {
        // Chargement avec retry en cas d'échec temporaire
        $maxRetries   = 3;
        $retryCount   = 0;
        $routesLoaded = false;

        while ($retryCount < $maxRetries && ! $routesLoaded) {
            try {
                $router->loadRoutes();
                $routesLoaded                 = true;
                $routerStats['routes_loaded'] = true;
            } catch (\Exception $e) {
                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    throw $e;
                }

                if ($logger) {
                    $logger->warning("Échec chargement routes, retry $retryCount/$maxRetries", [
                        'error' => $e->getMessage(),
                    ]);
                }

                                // Attendre avant retry
                usleep(100000); // 100ms
            }
        }

        // Collecte des statistiques
        $allRoutes                   = $router->getAllRoutes();
        $routerStats['routes_count'] = count($allRoutes);

        $templateTypes                       = $router->getTemplateTypes();
        $routerStats['template_types_count'] = count($templateTypes);

        // Vérification de la validité du cache
        $stats                      = $router->getStats();
        $routerStats['cache_valid'] = $stats['cache_valid'] ?? false;

        // Health check complet
        $health                       = $router->healthCheck();
        $routerStats['health_status'] = $health['status'];

        // Log détaillé en mode debug
        if ($config->get('DEBUG_MODE', false) && $logger) {
            $routesList = array_keys($allRoutes);
            $logger->debug("Routes chargées par le routeur sécurisé", [
                'routes_count'         => count($routesList),
                'template_types_count' => count($templateTypes),
                'cache_valid'          => $routerStats['cache_valid'],
                'health_status'        => $routerStats['health_status'],
                'memory_usage_mb'      => round(memory_get_usage(true) / 1024 / 1024, 2),
            ]);

            // Log des routes uniquement si peu nombreuses
            if (count($routesList) <= 20) {
                $logger->debug("Routes disponibles", [
                    'routes'         => $routesList,
                    'template_types' => array_values(array_column($templateTypes, 'name')),
                ]);
            }
        }

        // Vérification critique : route par défaut existe
        $defaultRoute = $baseConfig['default_route'];
        if (! isset($allRoutes[$defaultRoute])) {
            $availableRoutes = array_keys($allRoutes);
            $fallbackRoutes  = ['index', 'home', 'main'];

            // Chercher une route de fallback
            $foundFallback = false;
            foreach ($fallbackRoutes as $fallback) {
                if (isset($allRoutes[$fallback])) {
                    $router->setDefaultRoute($fallback);
                    $foundFallback = true;
                    if ($logger) {
                        $logger->warning("Route par défaut '$defaultRoute' non trouvée, utilisation de '$fallback'", [
                            'available_routes' => $availableRoutes,
                        ]);
                    }
                    break;
                }
            }

            if (! $foundFallback) {
                throw new \Exception("Route par défaut '$defaultRoute' non trouvée et aucune route de fallback disponible. Routes disponibles: " . implode(', ', array_slice($availableRoutes, 0, 10)));
            }
        }

        // Vérification de la route d'accès refusé
        $accessDeniedRoute = $baseConfig['access_denied_route'];
        if (! isset($allRoutes[$accessDeniedRoute])) {
            if ($logger) {
                $logger->warning("Route d'accès refusé '$accessDeniedRoute' non trouvée", [
                    'available_routes' => array_keys($allRoutes),
                ]);
            }
        }

    } catch (\Exception $e) {
        $routerStats['routes_loaded'] = false;
        throw new \Exception("Erreur critique lors du chargement des routes : " . $e->getMessage());
    }

    // ===== STOCKAGE SÉCURISÉ DES DONNÉES POUR TWIG =====

    $GLOBALS['router_data_for_twig'] = [
        'router'         => $router,
        'template_types' => $router->getTemplateTypes(),
        'router_config'  => [
            'web_directory'       => $baseConfig['web_directory'],
            'default_route'       => $baseConfig['default_route'],
            'access_denied_route' => $baseConfig['access_denied_route'],
            'security_enabled'    => true,
            'cache_ttl'           => $routerConfig['cache_ttl'],
            'max_routes'          => $routerConfig['max_routes_cache'],
        ],
        'all_routes'     => $allRoutes,
        'routes_count'   => count($allRoutes),
        'health_status'  => $routerStats['health_status'],
        'security_info'  => [
            'thread_safe'         => $routerConfig['thread_safe_mode'],
            'cache_validation'    => 'enabled',
            'input_sanitization'  => 'enabled',
            'redirect_protection' => 'enabled',
        ],
    ];

    // Log de succès
    if ($logger) {
        $logger->info("Routeur sécurisé initialisé avec succès", [
            'routes_count'      => $routerStats['routes_count'],
            'health_status'     => $routerStats['health_status'],
            'cache_valid'       => $routerStats['cache_valid'],
            'security_features' => [
                'input_validation',
                'cache_integrity',
                'redirect_protection',
                'thread_safety',
                'sql_optimization',
            ],
        ]);
    }

} catch (\Exception $e) {
    $routerStats['error']       = $e->getMessage();
    $routerStats['initialized'] = false;

    if ($logger) {
        $logger->error("Erreur critique d'initialisation du routeur sécurisé", [
            'error'                   => $e->getMessage(),
            'file'                    => $e->getFile(),
            'line'                    => $e->getLine(),
            'database_available'      => isset($sqlAdapter) && $sqlAdapter !== null,
            'database_test'           => isset($sqlAdapter) ? $sqlAdapter->testConnection() : false,
            'router_config_available' => class_exists('Commun\Router\RouterConfig'),
        ]);
    }

    // Nettoyage en cas d'erreur
    $router = null;
    Router::resetInstance();

    // Données d'erreur sécurisées pour Twig
    $GLOBALS['router_data_for_twig'] = [
        'router'         => null,
        'template_types' => [],
        'router_config'  => [
            'web_directory'       => '',
            'default_route'       => 'index',
            'access_denied_route' => 'login',
            'security_enabled'    => false,
        ],
        'all_routes'     => [],
        'routes_count'   => 0,
        'health_status'  => 'unhealthy',
        'error'          => $e->getMessage(),
        'error_type'     => 'router_initialization_failed',
    ];
}

// Log des statistiques finales
if ($logger) {
    $logLevel = $routerStats['initialized'] ? 'info' : 'error';
    $logger->log($logLevel, "Initialisation routeur terminée", $routerStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['router'] = $routerStats;

// ===== VÉRIFICATION CRITIQUE ET GESTION D'ERREUR =====

if (! $routerStats['initialized'] || ! $router) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');

    // Pages qui peuvent fonctionner sans routeur (API, health checks, etc.)
    $staticPages  = ['ping', 'health', 'status', 'api', 'webhook'];
    $isStaticPage = false;

    foreach ($staticPages as $staticPage) {
        if ($currentPath === $staticPage || strpos($currentPath, $staticPage . '/') === 0) {
            $isStaticPage = true;
            break;
        }
    }

    if (! $isStaticPage) {
        // Affichage d'une page d'erreur détaillée et sécurisée
        http_response_code(500);
        header('Content-Type: text/html; charset=UTF-8');
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');

        $errorTitle   = "Erreur du routeur sécurisé";
        $errorMessage = htmlspecialchars($routerStats['error'] ?? 'Erreur inconnue');
        $isDebug      = $config->get('DEBUG_MODE', false);

        echo "<!DOCTYPE html>\n<html lang=\"fr\">\n<head>\n";
        echo "<meta charset=\"UTF-8\">\n";
        echo "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n";
        echo "<title>$errorTitle</title>\n";
        echo "<style>\n";
        echo "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:40px;background:#f5f5f5;color:#333;}\n";
        echo ".container{max-width:800px;margin:0 auto;background:#fff;padding:40px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}\n";
        echo ".error{background:#ffebee;border-left:4px solid #f44336;padding:20px;margin:20px 0;border-radius:4px;}\n";
        echo ".debug{background:#e3f2fd;border-left:4px solid #2196f3;padding:20px;margin:20px 0;border-radius:4px;}\n";
        echo ".success{background:#e8f5e8;border-left:4px solid #4caf50;padding:20px;margin:20px 0;border-radius:4px;}\n";
        echo "h1{color:#d32f2f;margin-top:0;} h2{color:#1976d2;} h3{margin-top:0;}\n";
        echo ".btn{display:inline-block;padding:10px 20px;background:#1976d2;color:#fff;text-decoration:none;border-radius:4px;margin:5px;}\n";
        echo ".btn:hover{background:#1565c0;}\n";
        echo "ul{margin:10px 0;} li{margin:5px 0;}\n";
        echo "</style>\n";
        echo "</head>\n<body>\n";
        echo "<div class=\"container\">\n";
        echo "<h1>🚨 $errorTitle</h1>\n";

        echo "<div class=\"error\">\n";
        echo "<h3>Problème détecté</h3>\n";
        echo "<p><strong>Le routeur sécurisé n'a pas pu être initialisé correctement.</strong></p>\n";
        echo "<p><strong>Erreur :</strong> $errorMessage</p>\n";
        echo "</div>\n";

        if ($isDebug) {
            echo "<div class=\"debug\">\n";
            echo "<h3>Informations de diagnostic</h3>\n";
            echo "<ul>\n";
            echo "<li><strong>Base de données disponible :</strong> " . (isset($sqlAdapter) ? '✅ Oui' : '❌ Non') . "</li>\n";
            echo "<li><strong>Test de connectivité BDD :</strong> " . (isset($sqlAdapter) && $sqlAdapter->testConnection() ? '✅ OK' : '❌ Échec') . "</li>\n";
            echo "<li><strong>RouterConfig disponible :</strong> " . (class_exists('Commun\Router\RouterConfig') ? '✅ Oui' : '❌ Non') . "</li>\n";
            echo "<li><strong>Routes chargées :</strong> " . ($routerStats['routes_loaded'] ? '✅ Oui' : '❌ Non') . "</li>\n";
            echo "<li><strong>Sécurité activée :</strong> " . ($routerStats['security_enabled'] ? '✅ Oui' : '❌ Non') . "</li>\n";
            echo "<li><strong>Status santé :</strong> " . htmlspecialchars($routerStats['health_status']) . "</li>\n";
            echo "</ul>\n";

            if (! empty($routerStats['configuration'])) {
                echo "<h4>Configuration</h4>\n";
                echo "<pre style=\"background:#f5f5f5;padding:10px;border-radius:4px;overflow:auto;\">";
                echo htmlspecialchars(json_encode($routerStats['configuration'], JSON_PRETTY_PRINT));
                echo "</pre>\n";
            }
            echo "</div>\n";
        }

        echo "<div class=\"success\">\n";
        echo "<h3>Solutions recommandées</h3>\n";
        echo "<ol>\n";
        echo "<li>Vérifiez que le fichier <code>RouterConfig.php</code> a été créé</li>\n";
        echo "<li>Vérifiez que le fichier <code>Router.php</code> a été remplacé par la version corrigée</li>\n";
        echo "<li>Vérifiez que le fichier <code>020-classes.php</code> inclut RouterConfig.php</li>\n";
        echo "<li>Vérifiez la connectivité à la base de données</li>\n";
        echo "<li>Consultez les logs d'erreur pour plus de détails</li>\n";
        echo "</ol>\n";
        echo "</div>\n";

        echo "<p>\n";
        echo "<a href=\"/\" class=\"btn\">🏠 Retour à l'accueil</a>\n";
        echo "<a href=\"/index.php\" class=\"btn\">🔧 Test direct index.php</a>\n";
        if ($isDebug) {
            echo "<a href=\"?refresh=1\" class=\"btn\">🔄 Recharger</a>\n";
        }
        echo "</p>\n";

        echo "</div>\n</body>\n</html>";
        exit;
    }
}

// ===== VÉRIFICATIONS FINALES =====

// Avertissement si routes chargées mais cache invalide
if ($routerStats['initialized'] && $routerStats['routes_loaded'] && ! $routerStats['cache_valid']) {
    if ($logger) {
        $logger->warning("Routeur initialisé avec cache invalide", [
            'routes_count'  => $routerStats['routes_count'],
            'health_status' => $routerStats['health_status'],
        ]);
    }
}

// Vérification que $router est bien défini pour les fichiers suivants
if (! $router) {
    if ($logger) {
        $logger->critical("Variable \$router non définie à la fin de 100-router.php");
    }
} else {
    // Test final de santé
    try {
        $finalHealth = $router->healthCheck();
        if ($finalHealth['status'] !== 'healthy' && $logger) {
            $logger->warning("Routeur en état dégradé à la fin de l'initialisation", [
                'health' => $finalHealth,
            ]);
        }
    } catch (\Exception $e) {
        if ($logger) {
            $logger->error("Échec du health check final", [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
