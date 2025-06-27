<?php
/**
 * 115-twig-router.php
 * Ajout des données du routeur à Twig (APRÈS l'initialisation de base de Twig)
 */

$twigRouterStats = [
    'router_data_added' => false,
    'functions_added'   => [],
    'globals_added'     => [],
    'error'             => null,
];

try {
    // Vérifier que Twig est disponible
    if (! isset($twig) || ! $twig instanceof \Twig\Environment) {
        throw new \Exception("Environnement Twig non disponible");
    }

    // ===== AJOUT DES FONCTIONS UTILES POUR LE ROUTAGE =====

    // Fonction pour générer une URL
    $twig->addFunction(new \Twig\TwigFunction('url', function ($route, $params = []) use ($config) {
        $webDir = $config->get('WEB_DIR', '');
        $url    = $webDir . '/' . trim($route, '/');

        if (! empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        return $url;
    }));
    $twigRouterStats['functions_added'][] = 'url';

    // Fonction pour vérifier si une route existe
    $twig->addFunction(new \Twig\TwigFunction('route_exists', function ($route) {
        if (isset($GLOBALS['router_data_for_twig']['all_routes'])) {
            return isset($GLOBALS['router_data_for_twig']['all_routes'][$route]);
        }
        return false;
    }));
    $twigRouterStats['functions_added'][] = 'route_exists';

    // ===== RÉCUPÉRATION DES DONNÉES DU ROUTEUR =====

    $routerData = $GLOBALS['router_data_for_twig'] ?? [];

    if (! empty($routerData)) {
        // Ajouter les données du routeur comme variables globales

        // Template types disponibles
        $twig->addGlobal('template_types', $routerData['template_types'] ?? []);
        $twigRouterStats['globals_added'][] = 'template_types';

        // Configuration du routeur pour Twig
        $twig->addGlobal('router_config', $routerData['router_config'] ?? []);
        $twigRouterStats['globals_added'][] = 'router_config';

        // Informations sur les routes
        $twig->addGlobal('available_routes', array_keys($routerData['all_routes'] ?? []));
        $twigRouterStats['globals_added'][] = 'available_routes';

        // Statistiques du routeur
        $twig->addGlobal('router_stats', [
            'routes_count' => $routerData['routes_count'] ?? 0,
            'initialized'  => ! empty($routerData['router']),
            'error'        => $routerData['error'] ?? null,
        ]);
        $twigRouterStats['globals_added'][] = 'router_stats';

        $twigRouterStats['router_data_added'] = true;

    } else {
        throw new \Exception("Aucune donnée du routeur disponible");
    }

} catch (\Exception $e) {
    $twigRouterStats['error'] = $e->getMessage();

    if ($logger) {
        $logger->warning("Erreur lors de l'ajout des données du routeur à Twig", [
            'error' => $e->getMessage(),
        ]);
    }

    // Ajouter des valeurs par défaut pour éviter les erreurs dans les templates
    if (isset($twig)) {
        try {
            $twig->addGlobal('template_types', []);
            $twig->addGlobal('router_config', ['web_directory' => '', 'default_route' => 'index']);
            $twig->addGlobal('available_routes', []);
            $twig->addGlobal('router_stats', ['routes_count' => 0, 'initialized' => false, 'error' => $e->getMessage()]);

            // Fonction URL de secours
            $twig->addFunction(new \Twig\TwigFunction('url', function ($route, $params = []) {
                $url = '/' . trim($route, '/');
                if (! empty($params)) {
                    $url .= '?' . http_build_query($params);
                }
                return $url;
            }));

        } catch (\Exception $fallbackError) {
            if ($logger) {
                $logger->warning("Impossible d'ajouter même les valeurs par défaut à Twig", [
                    'error' => $fallbackError->getMessage(),
                ]);
            }
        }
    }
}

// Log des extensions ajoutées
if ($logger) {
    $logger->info("Données du routeur ajoutées à Twig", $twigRouterStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['twig_router'] = $twigRouterStats;
