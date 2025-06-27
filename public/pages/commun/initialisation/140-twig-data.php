<?php
/**
 * 160-twig-data.php
 * Injection finale des données spécifiques à la page dans Twig
 * Toutes les données du routage, de l'authentification, etc. sont maintenant disponibles
 */

$twigDataStats = [
    'page_data_injected'  => false,
    'templates_processed' => 0,
    'zones_available'     => [],
    'page_specific_vars'  => [],
    'error'               => null,
];

try {
    // Vérifier que Twig est disponible
    if (! isset($twig) || ! $twig instanceof \Twig\Environment) {
        throw new \Exception("Environnement Twig non disponible");
    }

    // Vérifier qu'on a une route courante
    if (! isset($currentRoute) || ! $currentRoute) {
        throw new \Exception("Aucune route courante pour l'injection de données");
    }

    $page      = $currentRoute['page'];
    $templates = $currentRoute['templates'] ?? [];

    // ===== TRAITEMENT DES TEMPLATES PAR ZONE =====

    $processedTemplates = [];
    $zonesAvailable     = [];
    $templatesCount     = 0;

    foreach ($templates as $zoneName => $zoneTemplates) {
        if (! empty($zoneTemplates)) {
            $zonesAvailable[]              = $zoneName;
            $processedTemplates[$zoneName] = [];

            foreach ($zoneTemplates as $template) {
                $templateData = [
                    'id'            => $template['id'] ?? null,
                    'template_name' => $template['template_name'] ?? $template['name'] ?? 'unknown',
                    'priority'      => $template['priority'] ?? 0,
                    'enabled'       => $template['enabled'] ?? true,
                    'variables'     => json_decode($template['variables'] ?? '{}', true),
                    'content'       => $template['content'] ?? '',
                ];

                $processedTemplates[$zoneName][] = $templateData;
                $templatesCount++;
            }

            // Trier par priorité
            usort($processedTemplates[$zoneName], function ($a, $b) {
                return ($a['priority'] ?? 0) <=> ($b['priority'] ?? 0);
            });
        }
    }

    $twigDataStats['templates_processed'] = $templatesCount;
    $twigDataStats['zones_available']     = $zonesAvailable;

    // ===== INJECTION DES DONNÉES DE LA PAGE =====

    // Templates traités par zone
    $twig->addGlobal('page_templates_processed', $processedTemplates);
    $twigDataStats['page_specific_vars'][] = 'page_templates_processed';

    // Informations détaillées de la page
    $pageData = [
        'id'              => $page['id'],
        'slug'            => $page['slug'],
        'title'           => $page['title'],
        'description'     => $page['description'] ?? '',
        'rights'          => $page['rights'] ?? 0,
        'active'          => $page['active'] ?? true,
        'redirect_to'     => $page['redirect_to'] ?? null,
        'zones_count'     => count($zonesAvailable),
        'templates_count' => $templatesCount,
    ];

    $twig->addGlobal('page_data', $pageData);
    $twigDataStats['page_specific_vars'][] = 'page_data';

    // ===== VARIABLES SPÉCIFIQUES AU ROUTAGE =====

    if (isset($router) && $router) {
        // Informations sur la route courante
        $routeInfo = [
            'current_slug'  => $page['slug'],
            'method'        => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'params'        => array_merge($_GET, $_POST),
            'has_post_data' => ! empty($_POST),
            'is_ajax'       => ! empty($_SERVER['HTTP_X_REQUESTED_WITH']) &&
            strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest',
        ];

        $twig->addGlobal('route_info', $routeInfo);
        $twigDataStats['page_specific_vars'][] = 'route_info';

        // Droits requis vs droits utilisateur
        if (isset($rightsManager) && $rightsManager) {
            $accessInfo = [
                'page_rights_required' => $page['rights'] ?? 0,
                'user_rights'          => $rightsManager->getBinaryRights(),
                'access_granted'       => true, // On est déjà passé par la vérification d'accès
                'user_can_admin'       => $rightsManager->isAdmin(),
                'user_can_import'      => $rightsManager->canImport(),
            ];

            $twig->addGlobal('access_info', $accessInfo);
            $twigDataStats['page_specific_vars'][] = 'access_info';
        }
    }

    // ===== VARIABLES DE NAVIGATION =====

    if (isset($router) && $router) {
        try {
            $allRoutes  = $router->getAllRoutes();
            $navigation = [];

            foreach ($allRoutes as $slug => $routeData) {
                $routePage = $routeData['page'];

                // Ne pas inclure les pages nécessitant des droits que l'utilisateur n'a pas
                $pageRights    = (int) ($routePage['rights'] ?? 0);
                $userCanAccess = true;

                if ($pageRights > 0 && isset($rightsManager) && $rightsManager) {
                    if (! $rightsManager->isAuthenticated()) {
                        $userCanAccess = false;
                    } else {
                        $userRights    = $rightsManager->getBinaryRights();
                        $userCanAccess = ($userRights & $pageRights) > 0;
                    }
                }

                if ($userCanAccess && ($routePage['active'] ?? true)) {
                    $navigation[] = [
                        'slug'            => $slug,
                        'title'           => $routePage['title'],
                        'description'     => $routePage['description'] ?? '',
                        'is_current'      => $slug === $page['slug'],
                        'rights_required' => $pageRights,
                    ];
                }
            }

            $twig->addGlobal('navigation', $navigation);
            $twigDataStats['page_specific_vars'][] = 'navigation';

        } catch (\Exception $e) {
            if ($logger) {
                $logger->debug("Impossible de générer la navigation", ['error' => $e->getMessage()]);
            }
        }
    }

    // ===== VARIABLES DE DEBUG =====

    if ($config->get('TWIG_DEBUG', false)) {
        $debugInfo = [
            'init_time'            => isset($_SERVER['REQUEST_TIME_FLOAT']) ?
            round((microtime(true) - $_SERVER['REQUEST_TIME_FLOAT']) * 1000, 2) : 0,
            'memory_usage'         => round(memory_get_usage(true) / 1024 / 1024, 2),
            'peak_memory'          => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
            'included_files_count' => count(get_included_files()),
            'zones_with_templates' => $zonesAvailable,
            'templates_by_zone'    => array_map('count', $processedTemplates),
            'request_uri'          => $_SERVER['REQUEST_URI'] ?? '/',
            'session_id'           => session_id(),
        ];

        // Informations sur l'initialisation si disponibles
        if (isset($GLOBALS['app_init_stats'])) {
            $debugInfo['init_steps']        = array_keys($GLOBALS['app_init_stats']);
            $debugInfo['steps_with_errors'] = [];

            foreach ($GLOBALS['app_init_stats'] as $step => $stats) {
                if (isset($stats['error']) && $stats['error']) {
                    $debugInfo['steps_with_errors'][] = $step;
                }
            }
        }

        $twig->addGlobal('debug_info', $debugInfo);
        $twigDataStats['page_specific_vars'][] = 'debug_info';
    }

    // ===== VARIABLES DE BREADCRUMB =====

    // Génération automatique du breadcrumb basé sur le slug
    $slugParts   = explode('/', $page['slug']);
    $breadcrumb  = [];
    $currentPath = '';

    foreach ($slugParts as $part) {
        $currentPath .= ($currentPath ? '/' : '') . $part;

                                           // Essayer de trouver la page correspondante
        $breadcrumbTitle = ucfirst($part); // Titre par défaut

        if (isset($router) && $router) {
            try {
                $allRoutes = $router->getAllRoutes();
                if (isset($allRoutes[$currentPath])) {
                    $breadcrumbTitle = $allRoutes[$currentPath]['page']['title'];
                }
            } catch (\Exception $e) {
                // Ignorer les erreurs, utiliser le titre par défaut
            }
        }

        $breadcrumb[] = [
            'title'      => $breadcrumbTitle,
            'slug'       => $currentPath,
            'is_current' => $currentPath === $page['slug'],
        ];
    }

    $twig->addGlobal('breadcrumb', $breadcrumb);
    $twigDataStats['page_specific_vars'][] = 'breadcrumb';

    $twigDataStats['page_data_injected'] = true;

} catch (\Exception $e) {
    $twigDataStats['error'] = $e->getMessage();

    if ($logger) {
        $logger->error("Erreur lors de l'injection des données Twig", [
            'error' => $e->getMessage(),
            'page'  => isset($page) ? $page['slug'] : 'unknown',
        ]);
    }
}

// Log des données injectées
if ($logger) {
    $logger->info("Données spécifiques injectées dans Twig", $twigDataStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['twig_data'] = $twigDataStats;
