<?php
/**
 * 160-render.php
 * Rendu final de la page avec le système de templates par zones
 */

$renderStats = [
    'render_attempted' => false,
    'render_successful' => false,
    'layout_template' => null,
    'layout_source' => null,
    'templates_rendered' => 0,
    'zones_populated' => [],
    'render_time' => 0,
    'output_size' => 0,
    'error' => null,
];

try {
    // Vérifier que nous avons tout ce qu'il faut
    if (!isset($twig) || !$twig) {
        throw new \Exception("Environnement Twig non disponible pour le rendu");
    }
    
    if (!isset($currentRoute) || !$currentRoute) {
        throw new \Exception("Aucune route courante pour le rendu");
    }
    
    $page = $currentRoute['page'];
    $renderStats['render_attempted'] = true;
    
    // Détermination du layout à utiliser
    $layoutTemplate = $config->get('DEFAULT_LAYOUT', 'layouts/default.twig');
    $layoutSource = 'config_default';
    
    // Override du layout si spécifié dans la configuration pour cette page
    $pageSlug = str_replace('/', '_', $page['slug']);
    $pageLayoutKey = 'LAYOUT_' . strtoupper($pageSlug);
    $pageLayout = $config->get($pageLayoutKey);
    
    if ($pageLayout) {
        $layoutTemplate = $pageLayout;
        $layoutSource = 'config_page_specific';
    }
    
    // Override par la configuration générale si définie
    $globalLayout = $config->get('TWIG_DEFAULT_LAYOUT');
    if ($globalLayout && $layoutSource === 'config_default') {
        $layoutTemplate = $globalLayout;
        $layoutSource = 'config_global';
    }
    
    $renderStats['layout_template'] = $layoutTemplate;
    $renderStats['layout_source'] = $layoutSource;
    
    // Préparation des statistiques des templates par zone
    $templatesCount = 0;
    $zonesPopulated = [];
    
    foreach ($currentRoute['templates'] ?? [] as $zone => $templates) {
        if (!empty($templates)) {
            $zonesPopulated[] = $zone;
            $templatesCount += count($templates);
        }
    }
    
    $renderStats['templates_rendered'] = $templatesCount;
    $renderStats['zones_populated'] = $zonesPopulated;
    
    // Log du début de rendu
    if ($logger) {
        $logger->debug("Début du rendu de la page", [
            'page' => $page['slug'],
            'layout' => $layoutTemplate,
            'layout_source' => $layoutSource,
            'templates_count' => $templatesCount,
            'zones' => $zonesPopulated,
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
        ]);
    }
    
    // Mesure du temps de rendu
    $renderStartTime = microtime(true);
    
    // Variables supplémentaires pour le rendu
    $renderVars = [
        'render_time' => date('Y-m-d H:i:s'),
        'page_slug' => $page['slug'],
        'page_title' => $page['title'],
        'debug_mode' => $config->get('TWIG_DEBUG', false),
    ];
    
    // Ajouter les variables de rendu à Twig
    foreach ($renderVars as $key => $value) {
        $twig->addGlobal($key, $value);
    }
    
    // Rendu du layout principal
    ob_start();
    echo $twig->render($layoutTemplate);
    $output = ob_get_clean();
    
    $renderEndTime = microtime(true);
    $renderStats['render_time'] = round(($renderEndTime - $renderStartTime) * 1000, 2); // en ms
    $renderStats['output_size'] = strlen($output);
    $renderStats['render_successful'] = true;
    
    // Log du succès du rendu
    if ($logger) {
        $logger->info("Rendu de la page réussi", [
            'page' => $page['slug'],
            'layout' => $layoutTemplate,
            'render_time_ms' => $renderStats['render_time'],
            'output_size_bytes' => $renderStats['output_size'],
            'templates_count' => $templatesCount,
        ]);
    }
    
    // Envoi de la sortie
    echo $output;

} catch (\Twig\Error\LoaderError $e) {
    $renderStats['error'] = "Template non trouvé : " . $e->getMessage();
    
    if ($logger) {
        $logger->error("Template de layout non trouvé", [
            'layout' => $renderStats['layout_template'],
            'page' => isset($page) ? $page['slug'] : 'unknown',
            'error' => $e->getMessage(),
        ]);
    }
    
    // Fallback vers un layout par défaut
    try {
        $fallbackLayout = 'layouts/default.twig';
        if ($renderStats['layout_template'] !== $fallbackLayout) {
            if ($logger) {
                $logger->info("Tentative de fallback vers le layout par défaut");
            }
            echo $twig->render($fallbackLayout);
            $renderStats['render_successful'] = true;
            $renderStats['layout_template'] = $fallbackLayout . ' (fallback)';
        } else {
            throw new \Exception("Même le layout par défaut est introuvable");
        }
    } catch (\Exception $fallbackError) {
        // Dernière chance : page d'erreur HTML simple
        http_response_code(500);
        
        $errorHtml = "<!DOCTYPE html><html><head><title>Erreur de template</title></head>";
        $errorHtml .= "<body><h1>Erreur de template</h1>";
        $errorHtml .= "<p>Impossible de charger le layout pour cette page.</p>";
        
        if ($config->get('TWIG_DEBUG', false)) {
            $errorHtml .= "<h2>Erreur principale :</h2>";
            $errorHtml .= "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
            $errorHtml .= "<h2>Erreur de fallback :</h2>";
            $errorHtml .= "<pre>" . htmlspecialchars($fallbackError->getMessage()) . "</pre>";
            
            if (isset($router)) {
                $errorHtml .= "<h2>Debug du routeur :</h2>";
                $errorHtml .= "<pre>" . htmlspecialchars(json_encode($router->debug(), JSON_PRETTY_PRINT)) . "</pre>";
            }
        }
        
        $errorHtml .= "</body></html>";
        echo $errorHtml;
    }

} catch (\Exception $e) {
    $renderStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->error("Erreur lors du rendu de la page", [
            'page' => isset($page) ? $page['slug'] : 'unknown',
            'layout' => $renderStats['layout_template'],
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString(),
        ]);
    }
    
    // Page d'erreur de secours
    http_response_code(500);
    
    $errorHtml = "<!DOCTYPE html><html><head><title>Erreur serveur</title></head>";
    $errorHtml .= "<body><h1>Erreur serveur</h1>";
    $errorHtml .= "<p>Une erreur s'est produite lors du rendu de la page.</p>";
    
    if ($config->get('TWIG_DEBUG', false)) {
        $errorHtml .= "<h2>Détails de l'erreur :</h2>";
        $errorHtml .= "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
        $errorHtml .= "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";
        
        if (isset($currentRoute)) {
            $errorHtml .= "<h2>Variables Twig disponibles :</h2>";
            $debugInfo = [
                'page_templates' => array_keys($currentRoute['templates'] ?? []),
                'zones_with_templates' => array_map('count', $currentRoute['templates'] ?? []),
                'layout_attempted' => $renderStats['layout_template'],
            ];
            $errorHtml .= "<pre>" . htmlspecialchars(json_encode($debugInfo, JSON_PRETTY_PRINT)) . "</pre>";
        }
    }
    
    $errorHtml .= "</body></html>";
    echo $errorHtml;
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['render'] = $renderStats;