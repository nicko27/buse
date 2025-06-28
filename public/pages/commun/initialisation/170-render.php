<?php
/**
 * 170-render.php
 * Rendu final de la page avec TwigManager
 */

$renderStats = [
    'render_started'     => false,
    'render_successful'  => false,
    'render_method'      => null,
    'output_generated'   => false,
    'output_size'        => 0,
    'render_time'        => 0,
    'templates_rendered' => 0,
    'zones_populated'    => [],
    'twig_manager_used'  => false,
    'fallback_used'      => false,
    'error'              => null,
];

try {
    // ===== VÉRIFICATIONS PRÉALABLES =====

    // Vérifier que nous avons une route courante
    if (! isset($currentRoute) || ! $currentRoute) {
        throw new \Exception("Aucune route courante pour le rendu");
    }

    $page                          = $currentRoute['page'];
    $renderStats['render_started'] = true;

    // Mesure du temps de rendu
    $renderStartTime = microtime(true);

    // ===== CHOIX DE LA MÉTHODE DE RENDU =====

    $output = '';

    // Méthode 1 : TwigManager (préférée)
    if (isset($twigManager) && $twigManager && $twigManager->isInitialized()) {
        $renderStats['render_method']     = 'twig_manager';
        $renderStats['twig_manager_used'] = true;

        if ($logger) {
            $logger->debug("Rendu via TwigManager", [
                'page'            => $page['slug'],
                'templates_count' => array_sum(array_map('count', $currentRoute['templates'] ?? [])),
            ]);
        }

        try {
            // Rendu de la page complète via TwigManager
            $output                          = $twigManager->renderPage($currentRoute);
            $renderStats['output_generated'] = true;

            // Récupérer les statistiques de rendu du TwigManager
            $twigRenderStats = $twigManager->getRenderStats();
            if (! empty($twigRenderStats)) {
                $lastRender                        = end($twigRenderStats);
                $renderStats['templates_rendered'] = 1; // Page complète

                if (isset($lastRender['zones_populated'])) {
                    $renderStats['zones_populated'] = $lastRender['zones_populated'];
                }
            }

        } catch (\Exception $e) {
            if ($logger) {
                $logger->error("Erreur de rendu TwigManager, passage au fallback", [
                    'error' => $e->getMessage(),
                    'page'  => $page['slug'],
                ]);
            }

            // Passer au fallback Twig direct
            $renderStats['render_method']     = 'twig_fallback';
            $renderStats['twig_manager_used'] = false;
            $renderStats['fallback_used']     = true;

            throw $e; // Re-lancer pour être attrapé par le catch principal
        }
    }

    // Méthode 2 : Twig direct (fallback)
    elseif (isset($twig) && $twig) {
        $renderStats['render_method'] = 'twig_direct';
        $renderStats['fallback_used'] = true;

        if ($logger) {
            $logger->warning("Rendu via Twig direct (fallback - TwigManager non disponible)", [
                'page' => $page['slug'],
            ]);
        }

        try {
            // Ajouter les variables nécessaires manuellement
            $twig->addGlobal('current_route', $currentRoute);
            $twig->addGlobal('page', $page);

            // Variables utilisateur si disponibles
            if (isset($rightsManager) && $rightsManager->isAuthenticated()) {
                $twig->addGlobal('user', [
                    'authenticated' => true,
                    'id'            => $rightsManager->getUserId(),
                    'name'          => $rightsManager->getUserName(),
                    'email'         => $rightsManager->getUserMail(),
                    'unit'          => $rightsManager->getUserUnit(),
                    'cu'            => $rightsManager->getUserCu(),
                    'short_name'    => $rightsManager->getUserShortName(),
                    'binaryRights'  => $rightsManager->getBinaryRights(),
                ]);
            } else {
                $twig->addGlobal('user', ['authenticated' => false]);
            }

            // Configuration de base
            $twig->addGlobal('config', [
                'site_name' => $config->get('SITE', 'Application'),
                'debug'     => $config->get('DEBUG_MODE', false),
            ]);

            // Déterminer le template de layout
            $layoutTemplate = $config->get('DEFAULT_LAYOUT', 'layouts/default.twig');

            // Rendu du template
            $output                            = $twig->render($layoutTemplate);
            $renderStats['output_generated']   = true;
            $renderStats['templates_rendered'] = 1;

        } catch (\Exception $e) {
            if ($logger) {
                $logger->error("Erreur de rendu Twig direct, passage au HTML statique", [
                    'error' => $e->getMessage(),
                    'page'  => $page['slug'],
                ]);
            }

            // Passer au fallback HTML
            $renderStats['render_method'] = 'html_fallback';
            $renderStats['fallback_used'] = true;

            throw $e; // Re-lancer pour être attrapé par le catch principal
        }
    }

    // Méthode 3 : HTML statique (fallback ultime)
    else {
        $renderStats['render_method'] = 'html_static';
        $renderStats['fallback_used'] = true;

        if ($logger) {
            $logger->critical("Rendu via HTML statique (Twig non disponible)", [
                'page' => $page['slug'],
            ]);
        }

        // Génération d'une page HTML minimale
        $siteName  = $config->get('SITE', 'Application');
        $pageTitle = $page['title'] ?? $page['slug'];
        $isDebug   = $config->get('DEBUG_MODE', false);

        $output                            = generateStaticHtmlPage($siteName, $pageTitle, $page, $isDebug, $currentRoute);
        $renderStats['output_generated']   = true;
        $renderStats['templates_rendered'] = 0; // Pas de template Twig
    }

    // ===== FINALISATION DU RENDU =====

    $renderEndTime                    = microtime(true);
    $renderStats['render_time']       = round(($renderEndTime - $renderStartTime) * 1000, 2); // en ms
    $renderStats['output_size']       = strlen($output);
    $renderStats['render_successful'] = true;

    // Log du succès de rendu
    if ($logger) {
        $logger->info("Page rendue avec succès", [
            'page'               => $page['slug'],
            'method'             => $renderStats['render_method'],
            'render_time_ms'     => $renderStats['render_time'],
            'output_size_bytes'  => $renderStats['output_size'],
            'templates_rendered' => $renderStats['templates_rendered'],
            'fallback_used'      => $renderStats['fallback_used'],
        ]);
    }

    // ===== ENVOI DE LA RÉPONSE =====

    // Headers appropriés
    header('Content-Type: text/html; charset=UTF-8');

    // Headers de cache (selon la configuration)
    $cacheEnabled = $config->get('PAGE_CACHE_ENABLED', false);
    if ($cacheEnabled && ! $config->get('DEBUG_MODE', false)) {
        $cacheTime = $config->get('PAGE_CACHE_TIME', 300); // 5 minutes par défaut
        header("Cache-Control: public, max-age=$cacheTime");
        header('Expires: ' . gmdate('D, d M Y H:i:s', time() + $cacheTime) . ' GMT');
    } else {
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');
    }

    // Header de sécurité de base
    if (! headers_sent()) {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: SAMEORIGIN');
        header('X-XSS-Protection: 1; mode=block');
    }

    // Envoi du contenu
    echo $output;

} catch (\Exception $e) {
    $renderStats['error']             = $e->getMessage();
    $renderStats['render_successful'] = false;

    if ($logger) {
        $logger->error("Erreur fatale de rendu", [
            'error'            => $e->getMessage(),
            'page'             => isset($page) ? $page['slug'] : 'unknown',
            'method_attempted' => $renderStats['render_method'],
            'file'             => $e->getFile(),
            'line'             => $e->getLine(),
        ]);
    }

    // Dernière chance : page d'erreur HTML minimale
    http_response_code(500);
    header('Content-Type: text/html; charset=UTF-8');

    $isDebug  = $config->get('DEBUG_MODE', false);
    $siteName = $config->get('SITE', 'Application');

    echo generateErrorPage($siteName, $e, $isDebug, $renderStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['render'] = $renderStats;

// ===== FONCTIONS HELPER =====

/**
 * Génère une page HTML statique quand Twig n'est pas disponible
 */
function generateStaticHtmlPage(string $siteName, string $pageTitle, array $page, bool $isDebug, array $currentRoute): string
{
    $debugInfo = '';
    if ($isDebug) {
        $debugInfo = sprintf(
            '<div style="background: #e3f2fd; border: 1px solid #2196f3; padding: 10px; margin: 20px 0; border-radius: 4px; font-size: 12px;">
                <strong>Mode Debug:</strong> Page rendue en HTML statique<br>
                <strong>Page:</strong> %s<br>
                <strong>Templates:</strong> %d zones disponibles<br>
                <strong>Droits requis:</strong> %d
            </div>',
            htmlspecialchars($page['slug']),
            count($currentRoute['templates'] ?? []),
            $page['rights'] ?? 0
        );
    }

    return sprintf('<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>%s - %s</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            margin: 0; padding: 0; background: #f5f5f5; color: #333;
        }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #1976d2; color: white; padding: 20px 0; margin-bottom: 20px; }
        .header h1 { margin: 0; text-align: center; }
        .content { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="container">
            <h1>%s</h1>
        </div>
    </div>
    <div class="container">
        <div class="content">
            <h2>%s</h2>
            <p>Cette page est actuellement en cours de développement.</p>
            <p><strong>Description:</strong> %s</p>
            %s
        </div>
    </div>
    <div class="footer">
        <div class="container">
            Propulsé par %s - Mode HTML statique
        </div>
    </div>
</body>
</html>',
        htmlspecialchars($pageTitle),
        htmlspecialchars($siteName),
        htmlspecialchars($siteName),
        htmlspecialchars($pageTitle),
        htmlspecialchars($page['description'] ?? 'Aucune description disponible.'),
        $debugInfo,
        htmlspecialchars($siteName)
    );
}

/**
 * Génère une page d'erreur HTML minimale
 */
function generateErrorPage(string $siteName, \Exception $error, bool $isDebug, array $renderStats): string
{
    $debugDetails = '';
    if ($isDebug) {
        $debugDetails = sprintf(
            '<div style="background: #ffebee; border: 1px solid #f44336; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin-top: 0; color: #d32f2f;">Détails de l\'erreur</h3>
                <p><strong>Erreur:</strong> %s</p>
                <p><strong>Fichier:</strong> %s ligne %d</p>
                <p><strong>Méthode tentée:</strong> %s</p>
                <p><strong>Fallback utilisé:</strong> %s</p>
                <details style="margin-top: 10px;">
                    <summary>Stack trace</summary>
                    <pre style="background: #f5f5f5; padding: 10px; overflow: auto; font-size: 11px;">%s</pre>
                </details>
            </div>',
            htmlspecialchars($error->getMessage()),
            htmlspecialchars($error->getFile()),
            $error->getLine(),
            htmlspecialchars($renderStats['render_method'] ?? 'unknown'),
            $renderStats['fallback_used'] ? 'Oui' : 'Non',
            htmlspecialchars($error->getTraceAsString())
        );
    }

    return sprintf('<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Erreur 500 - %s</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            margin: 0; padding: 40px; background: #f5f5f5; color: #333;
        }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .error { background: #ffebee; border-left: 4px solid #f44336; padding: 20px; margin: 20px 0; }
        h1 { color: #d32f2f; margin-top: 0; }
        .back-link { display: inline-block; margin-top: 20px; padding: 10px 20px; background: #1976d2; color: white; text-decoration: none; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚨 Erreur serveur</h1>
        <div class="error">
            <p><strong>Une erreur inattendue s\'est produite lors du rendu de la page.</strong></p>
            <p>Veuillez réessayer dans quelques instants. Si le problème persiste, contactez l\'administrateur.</p>
        </div>
        %s
        <a href="/" class="back-link">🏠 Retour à l\'accueil</a>
    </div>
</body>
</html>',
        htmlspecialchars($siteName),
        $debugDetails
    );
}
