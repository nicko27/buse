<?php
// ===== 160-php-execution.php =====
/**
 * 180-php-execution.php
 * Exécution du fichier PHP spécifique à la page courante
 * APRÈS Twig et vérification d'accès
 */

$phpExecutionStats = [
    'php_file_found'    => false,
    'php_file_executed' => false,
    'php_file_path'     => null,
    'execution_method'  => null,
    'page_slug'         => null,
    'execution_time'    => 0,
    'error'             => null,
];

try {
    // Vérifier que nous avons une route courante
    if (! isset($currentRoute) || ! $currentRoute) {
        throw new \Exception("Aucune route courante pour l'exécution PHP");
    }

    $page                           = $currentRoute['page'];
    $pageSlug                       = $page['slug'];
    $phpExecutionStats['page_slug'] = $pageSlug;

    // ===== NOUVEAU : Utilisation du champ 'php' de la BDD =====

    $pagesDir        = $config->get('PAGES_DIR', dirname(__DIR__));
    $phpFile         = null;
    $executionMethod = null;

    // Vérifier si la page a un fichier PHP défini
    if (! empty($page['php'])) {
        $phpFile         = $pagesDir . '/' . ltrim($page['php'], '/');
        $executionMethod = 'database_field';

        if ($logger) {
            $logger->debug("Fichier PHP défini dans la BDD", [
                'slug'          => $pageSlug,
                'php_field'     => $page['php'],
                'resolved_path' => $phpFile,
            ]);
        }
    } else {
        // Fallback : déduction par convention si pas de champ php
        $slugParts = explode('/', $pageSlug);

        if (count($slugParts) === 1) {
            // Page principale (ex: 'index', 'show', 'main')
            $phpFile         = $pagesDir . '/' . $pageSlug . '/' . $pageSlug . '.php';
            $executionMethod = 'convention_main_page';

        } elseif (count($slugParts) === 2) {
            // Sous-page (ex: 'main/import', 'main/categories')
            $phpFile         = $pagesDir . '/' . $slugParts[0] . '/subpages/' . $slugParts[1] . '/main.php';
            $executionMethod = 'convention_subpage';

        } elseif (count($slugParts) > 2) {
            // Sous-sous-page ou plus complexe
            $mainSection     = $slugParts[0];
            $subPath         = implode('/', array_slice($slugParts, 1));
            $phpFile         = $pagesDir . '/' . $mainSection . '/subpages/' . $subPath . '/main.php';
            $executionMethod = 'convention_deep_subpage';
        }

        if ($logger) {
            $logger->debug("Fichier PHP déduit par convention (pas de champ php dans la BDD)", [
                'slug'         => $pageSlug,
                'deduced_path' => $phpFile,
                'method'       => $executionMethod,
            ]);
        }
    }

    $phpExecutionStats['php_file_path']    = $phpFile;
    $phpExecutionStats['execution_method'] = $executionMethod;

    // Vérifier si le fichier PHP existe
    if ($phpFile && file_exists($phpFile)) {
        $phpExecutionStats['php_file_found'] = true;

        // Vérifier que le fichier est lisible
        if (! is_readable($phpFile)) {
            throw new \Exception("Fichier PHP non lisible : $phpFile");
        }

        // Log de l'exécution
        if ($logger) {
            $logger->debug("Exécution du fichier PHP de la page", [
                'file'           => $phpFile,
                'slug'           => $pageSlug,
                'method'         => $executionMethod,
                'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            ]);
        }

        // Mesure du temps d'exécution
        $startTime = microtime(true);

        // Variables disponibles dans le fichier inclus :
        // $router, $twig, $config, $logger, $rightsManager, $currentRoute, $page, etc.

        // Inclusion du fichier PHP
        ob_start();
        $includeResult = include $phpFile;
        $phpOutput     = ob_get_clean();

        $endTime                                = microtime(true);
        $phpExecutionStats['execution_time']    = round(($endTime - $startTime) * 1000, 2); // en ms
        $phpExecutionStats['php_file_executed'] = true;

        // Si le fichier PHP a produit une sortie, la stocker
        if (! empty($phpOutput)) {
            if ($logger) {
                $logger->debug("Sortie produite par le fichier PHP", [
                    'file'          => $phpFile,
                    'output_length' => strlen($phpOutput),
                ]);
            }
            // Note: Dans ce contexte, on ne fait rien de spécial avec la sortie
            // Le fichier PHP peut avoir modifié des variables ou effectué des actions
        }

        // Si le fichier PHP retourne false, considérer comme une erreur
        if ($includeResult === false) {
            if ($logger) {
                $logger->warning("Le fichier PHP a retourné false", [
                    'file' => $phpFile,
                ]);
            }
        }

    } else {
        // Aucun fichier PHP spécifique trouvé - ce n'est pas forcément une erreur
        $phpExecutionStats['php_file_found'] = false;

        if ($logger) {
            $logger->debug("Aucun fichier PHP spécifique trouvé pour la page", [
                'attempted_file' => $phpFile,
                'slug'           => $pageSlug,
                'method'         => $executionMethod,
            ]);
        }
    }

} catch (\Exception $e) {
    $phpExecutionStats['error'] = $e->getMessage();

    if ($logger) {
        $logger->error("Erreur lors de l'exécution du fichier PHP", [
            'error' => $e->getMessage(),
            'file'  => $phpExecutionStats['php_file_path'],
            'slug'  => $phpExecutionStats['page_slug'],
        ]);
    }

    // L'erreur d'exécution PHP n'est pas forcément fatale
    // La page peut quand même être rendue avec les templates
}

// Log des statistiques d'exécution PHP
if ($logger) {
    $logger->info("Exécution PHP terminée", $phpExecutionStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['php_execution'] = $phpExecutionStats;

// Gestion des erreurs critiques d'exécution PHP
if ($phpExecutionStats['error'] && $phpExecutionStats['php_file_found']) {
    // Si un fichier PHP existe mais a une erreur, c'est plus problématique
    if ($logger) {
        $logger->error("Erreur critique dans le fichier PHP de la page", [
            'page'  => $phpExecutionStats['page_slug'],
            'file'  => $phpExecutionStats['php_file_path'],
            'error' => $phpExecutionStats['error'],
        ]);
    }

    // En mode debug, afficher l'erreur
    if ($config->get('TWIG_DEBUG', false)) {
        echo "<div style='background: #ffebee; border: 1px solid #f44336; padding: 10px; margin: 10px; border-radius: 4px;'>";
        echo "<h3 style='color: #d32f2f; margin: 0 0 10px 0;'>Erreur PHP dans la page</h3>";
        echo "<p><strong>Fichier :</strong> " . htmlspecialchars($phpExecutionStats['php_file_path']) . "</p>";
        echo "<p><strong>Erreur :</strong> " . htmlspecialchars($phpExecutionStats['error']) . "</p>";
        echo "</div>";
    }
}
