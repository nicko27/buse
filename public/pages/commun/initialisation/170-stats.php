<?php
/**
 * 170-stats.php
 * Collecte et logging des statistiques finales d'initialisation
 */

$finalStats = [
    'total_init_time'     => 0,
    'total_memory_usage'  => 0,
    'peak_memory_usage'   => 0,
    'steps_completed'     => 0,
    'steps_with_errors'   => 0,
    'critical_errors'     => [],
    'warnings'            => [],
    'performance_metrics' => [],
    'application_ready'   => false,
];

try {
    // Calcul du temps total d'initialisation
    $initStartTime                 = $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true);
    $initEndTime                   = microtime(true);
    $finalStats['total_init_time'] = round(($initEndTime - $initStartTime) * 1000, 2); // en ms

                                                                                             // Métriques mémoire
    $finalStats['total_memory_usage'] = round(memory_get_usage(true) / 1024 / 1024, 2);      // en MB
    $finalStats['peak_memory_usage']  = round(memory_get_peak_usage(true) / 1024 / 1024, 2); // en MB

    // Analyse des statistiques collectées
    $allStats        = $GLOBALS['app_init_stats'] ?? [];
    $stepsCompleted  = 0;
    $stepsWithErrors = 0;
    $criticalErrors  = [];
    $warnings        = [];

    foreach ($allStats as $stepName => $stepStats) {
        $stepsCompleted++;

        // Vérifier les erreurs dans cette étape
        if (isset($stepStats['error']) && $stepStats['error']) {
            $stepsWithErrors++;

            // Déterminer si l'erreur est critique
            $criticalSteps = ['config', 'database', 'logger', 'router', 'routing', 'access'];
            if (in_array($stepName, $criticalSteps)) {
                $criticalErrors[] = [
                    'step'  => $stepName,
                    'error' => $stepStats['error'],
                ];
            } else {
                $warnings[] = [
                    'step'  => $stepName,
                    'error' => $stepStats['error'],
                ];
            }
        }

        // Collecter les métriques de performance
        if (isset($stepStats['render_time'])) {
            $finalStats['performance_metrics'][] = [
                'step'    => $stepName,
                'time_ms' => $stepStats['render_time'],
            ];
        }

        if (isset($stepStats['execution_time'])) {
            $finalStats['performance_metrics'][] = [
                'step'    => $stepName . '_execution',
                'time_ms' => $stepStats['execution_time'],
            ];
        }
    }

    $finalStats['steps_completed']   = $stepsCompleted;
    $finalStats['steps_with_errors'] = $stepsWithErrors;
    $finalStats['critical_errors']   = $criticalErrors;
    $finalStats['warnings']          = $warnings;

    // Déterminer si l'application est prête
    $finalStats['application_ready'] = empty($criticalErrors) &&
    isset($allStats['render']) &&
        ($allStats['render']['render_successful'] ?? false);

    // Métriques détaillées en mode debug
    if ($config->get('TWIG_DEBUG', false)) {
        $detailedMetrics = [
            'config_vars_loaded' => $allStats['config']['env_vars_loaded'] ?? 0,
            'database_connected' => $allStats['database']['initialized'] ?? false,
            'routes_loaded'      => $allStats['router']['routes_count'] ?? 0,
            'template_types'     => $allStats['router']['template_types_count'] ?? 0,
            'twig_filters'       => count($allStats['twig_extensions']['filters_added'] ?? []),
            'user_authenticated' => $allStats['rights']['user_authenticated'] ?? false,
            'ldap_available'     => $allStats['ldap']['available'] ?? false,
            'templates_rendered' => $allStats['render']['templates_rendered'] ?? 0,
            'zones_populated'    => count($allStats['render']['zones_populated'] ?? []),
        ];

        $finalStats['detailed_metrics'] = $detailedMetrics;
    }

    // Log des statistiques finales
    if (isset($logger) && $logger) {
        $logLevel = $finalStats['application_ready'] ? 'info' : 'error';

        $logger->log($logLevel, "Initialisation de l'application terminée", [
            'total_time_ms'         => $finalStats['total_init_time'],
            'memory_usage_mb'       => $finalStats['total_memory_usage'],
            'peak_memory_mb'        => $finalStats['peak_memory_usage'],
            'steps_completed'       => $finalStats['steps_completed'],
            'steps_with_errors'     => $finalStats['steps_with_errors'],
            'application_ready'     => $finalStats['application_ready'],
            'critical_errors_count' => count($finalStats['critical_errors']),
            'warnings_count'        => count($finalStats['warnings']),
        ]);

        // Log des erreurs critiques
        foreach ($finalStats['critical_errors'] as $error) {
            $logger->critical("Erreur critique lors de l'initialisation", $error);
        }

        // Log des avertissements
        foreach ($finalStats['warnings'] as $warning) {
            $logger->warning("Avertissement lors de l'initialisation", $warning);
        }

        // Log des métriques de performance en mode debug
        if ($config->get('TWIG_DEBUG', false) && ! empty($finalStats['performance_metrics'])) {
            $logger->debug("Métriques de performance", [
                'performance_steps' => $finalStats['performance_metrics'],
                'detailed_metrics'  => $finalStats['detailed_metrics'] ?? [],
            ]);
        }

        // Logging spécial pour les pages lentes
        if ($finalStats['total_init_time'] > 1000) {
            // Plus d'1 seconde
            // ✅ CORRECTION : Remplacer array_sort par usort
            $slowestSteps = $finalStats['performance_metrics'];
            usort($slowestSteps, function ($a, $b) {
                return ($b['time_ms'] ?? 0) <=> ($a['time_ms'] ?? 0);
            });

            $logger->warning("Page lente détectée", [
                'init_time_ms'  => $finalStats['total_init_time'],
                'page'          => isset($currentRoute) ? $currentRoute['page']['slug'] : 'unknown',
                'slowest_steps' => array_slice($slowestSteps, 0, 3),
            ]);
        }

        // Log de la requête complétée
        $requestInfo = [
            'uri'        => $_SERVER['REQUEST_URI'] ?? '/',
            'method'     => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'ip'         => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
            'referer'    => $_SERVER['HTTP_REFERER'] ?? '',
        ];

        if (isset($rightsManager) && $rightsManager->isAuthenticated()) {
            $requestInfo['user_id'] = $rightsManager->getUserId();
            $requestInfo['user_cu'] = $rightsManager->getUserCu();
        }

        $logger->info("Requête complétée", array_merge($requestInfo, [
            'response_time_ms' => $finalStats['total_init_time'],
            'memory_mb'        => $finalStats['total_memory_usage'],
            'success'          => $finalStats['application_ready'],
        ]));
    }

    // Debug HTML en mode développement
    if ($config->get('TWIG_DEBUG', false) &&
        $config->get('ENV', 'production') === 'dev' &&
        ! empty($_GET['debug_stats'])) {

        echo "\n<!-- DEBUG STATS -->\n";
        echo "<div id='debug-stats' style='position: fixed; bottom: 10px; right: 10px; background: #333; color: #fff; padding: 10px; border-radius: 5px; font-size: 12px; max-width: 300px; z-index: 9999;'>";
        echo "<strong>Stats d'initialisation</strong><br>";
        echo "Temps: {$finalStats['total_init_time']}ms<br>";
        echo "Mémoire: {$finalStats['total_memory_usage']}MB<br>";
        echo "Étapes: {$finalStats['steps_completed']}<br>";

        if (! empty($finalStats['critical_errors'])) {
            echo "<span style='color: #ff6b6b;'>Erreurs: " . count($finalStats['critical_errors']) . "</span><br>";
        }

        if (! empty($finalStats['warnings'])) {
            echo "<span style='color: #ffd93d;'>Avertissements: " . count($finalStats['warnings']) . "</span><br>";
        }

        echo "<small>Ready: " . ($finalStats['application_ready'] ? 'Oui' : 'Non') . "</small>";
        echo "</div>\n";
        echo "<!-- /DEBUG STATS -->\n";
    }

} catch (\Exception $e) {
    // Même les stats peuvent échouer, ne pas planter l'application
    if (isset($logger)) {
        $logger->error("Erreur lors de la collecte des statistiques finales", [
            'error' => $e->getMessage(),
        ]);
    } else {
        error_log("Erreur stats finales : " . $e->getMessage());
    }
}

// Nettoyage final
if (isset($GLOBALS['app_init_stats'])) {
    unset($GLOBALS['app_init_stats']);
}
