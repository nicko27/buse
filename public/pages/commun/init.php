<?php
/**
 * init.php - Orchestrateur principal de l'initialisation
 *
 * Ce fichier charge automatiquement tous les fichiers d'initialisation
 * dans l'ordre numérique (XXX-*.php) pour faciliter l'ajout de nouvelles étapes.
 */

// Enregistrement du temps de début pour les statistiques
$_SERVER['REQUEST_TIME_FLOAT'] = $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true);

try {
    // ===== CHARGEMENT AUTOMATIQUE DES FICHIERS D'INITIALISATION =====

    $initDir = __DIR__ . '/initialisation';

    // Vérifier que le répertoire d'initialisation existe
    if (! is_dir($initDir)) {
        throw new \Exception("Répertoire d'initialisation introuvable : $initDir");
    }

    // Scanner le répertoire pour les fichiers d'initialisation
    $initFiles = [];
    $handle    = opendir($initDir);

    if ($handle) {
        while (($file = readdir($handle)) !== false) {
            // Chercher les fichiers qui matchent le pattern XXX-*.php
            if (preg_match('/^(\d{3})-(.+)\.php$/', $file, $matches)) {
                $order = (int) $matches[1]; // Numéro d'ordre
                $name  = $matches[2];       // Nom du fichier

                // Utiliser une clé composite pour gérer l'ordre alpha à numéro identique
                $sortKey = sprintf('%03d_%s', $order, $name);

                $initFiles[$sortKey] = [
                    'file'     => $file,
                    'path'     => $initDir . '/' . $file,
                    'name'     => $name,
                    'order'    => $order,
                    'sort_key' => $sortKey,
                ];
            }
        }
        closedir($handle);
    } else {
        throw new \Exception("Impossible d'ouvrir le répertoire d'initialisation : $initDir");
    }

    // Trier par clé composite (numérique puis alphabétique)
    ksort($initFiles);

    // Vérifier qu'on a au moins quelques fichiers critiques
    if (empty($initFiles)) {
        throw new \Exception("Aucun fichier d'initialisation trouvé dans : $initDir");
    }

    // Variables pour tracker les statistiques d'initialisation
    $GLOBALS['app_init_stats']        = [];
    $GLOBALS['app_init_files_loaded'] = [];

    // Charger chaque fichier dans l'ordre
    foreach ($initFiles as $sortKey => $fileInfo) {
        $filePath = $fileInfo['path'];
        $fileName = $fileInfo['file'];
        $stepName = $fileInfo['name'];
        $order    = $fileInfo['order'];

        // Log du début de l'étape (si logger disponible)
        if (isset($logger)) {
            $logger->debug("Chargement de l'étape d'initialisation", [
                'step'     => $stepName,
                'order'    => $order,
                'file'     => $fileName,
                'sort_key' => $sortKey,
            ]);
        }

        // Mesure du temps de chargement
        $stepStartTime = microtime(true);

        try {
            // Inclusion du fichier
            require_once $filePath;

            $stepEndTime  = microtime(true);
            $stepDuration = round(($stepEndTime - $stepStartTime) * 1000, 2); // en ms

            // Enregistrer le succès
            $GLOBALS['app_init_files_loaded'][] = [
                'order'       => $order,
                'name'        => $stepName,
                'file'        => $fileName,
                'sort_key'    => $sortKey,
                'duration_ms' => $stepDuration,
                'success'     => true,
            ];

            // Log du succès (si logger disponible)
            if (isset($logger)) {
                $logger->debug("Étape d'initialisation terminée", [
                    'step'        => $stepName,
                    'order'       => $order,
                    'duration_ms' => $stepDuration,
                ]);
            }

        } catch (\Throwable $stepError) {
            $stepEndTime  = microtime(true);
            $stepDuration = round(($stepEndTime - $stepStartTime) * 1000, 2);

            // Enregistrer l'erreur
            $GLOBALS['app_init_files_loaded'][] = [
                'order'       => $order,
                'name'        => $stepName,
                'file'        => $fileName,
                'sort_key'    => $sortKey,
                'duration_ms' => $stepDuration,
                'success'     => false,
                'error'       => $stepError->getMessage(),
            ];

            // Log de l'erreur (si logger disponible)
            if (isset($logger)) {
                $logger->error("Erreur dans l'étape d'initialisation", [
                    'step'        => $stepName,
                    'order'       => $order,
                    'file'        => $fileName,
                    'error'       => $stepError->getMessage(),
                    'duration_ms' => $stepDuration,
                ]);
            }

            // Déterminer si l'erreur est critique (< 200 = critique, >= 200 = optionnel)
            if ($order < 200) {
                throw new \Exception("Erreur critique dans l'étape '$stepName' ($fileName) : " . $stepError->getMessage(), 0, $stepError);
            } else {
                // Pour les étapes optionnelles (>= 200), log l'erreur mais continue
                if (isset($logger)) {
                    $logger->warning("Étape optionnelle échouée, poursuite de l'initialisation", [
                        'step'  => $stepName,
                        'order' => $order,
                        'error' => $stepError->getMessage(),
                    ]);
                }
            }
        }
    }

    // Log final du chargement
    $totalFiles      = count($initFiles);
    $successfulFiles = count(array_filter($GLOBALS['app_init_files_loaded'], fn($f) => $f['success']));
    $failedFiles     = $totalFiles - $successfulFiles;

    if (isset($logger)) {
        $logger->info("Chargement des fichiers d'initialisation terminé", [
            'total_files'  => $totalFiles,
            'successful'   => $successfulFiles,
            'failed'       => $failedFiles,
            'files_loaded' => array_column($GLOBALS['app_init_files_loaded'], 'name'),
        ]);
    }

    // Si on arrive ici, l'initialisation de base est réussie
    // Les étapes suivantes sont gérées par les fichiers individuels

} catch (\Throwable $e) {
    // Gestion d'erreur globale pour les erreurs fatales

    // Tentative de log si le logger est disponible
    if (isset($logger)) {
        $logger->critical("Erreur fatale lors de l'initialisation automatique", [
            'error'        => $e->getMessage(),
            'file'         => $e->getFile(),
            'line'         => $e->getLine(),
            'trace'        => $e->getTraceAsString(),
            'files_loaded' => $GLOBALS['app_init_files_loaded'] ?? [],
        ]);
    } else {
        error_log("Erreur fatale d'initialisation automatique : " . $e->getMessage());
    }

    // Page d'erreur minimale avec informations sur les fichiers chargés
    http_response_code(500);

    $isDebug = (isset($config) && $config->get('TWIG_DEBUG', false)) ||
        (isset($_SERVER['SERVER_ADDR']) && $_SERVER['SERVER_ADDR'] === '127.0.0.1');

    echo "<!DOCTYPE html><html><head><title>Erreur serveur</title>";
    echo "<style>body{font-family:sans-serif;margin:40px;} .error{background:#ffebee;border:1px solid #f44336;padding:20px;border-radius:4px;} .debug{background:#e3f2fd;border:1px solid #2196f3;padding:15px;border-radius:4px;margin-top:20px;} .success{background:#e8f5e8;border:1px solid #4caf50;padding:10px;margin:5px 0;} .failed{background:#ffebee;border:1px solid #f44336;padding:10px;margin:5px 0;} pre{overflow:auto;} .file-list{font-family:monospace;font-size:12px;}</style>";
    echo "</head><body>";
    echo "<h1>Erreur d'initialisation de l'application</h1>";
    echo "<div class='error'>";
    echo "<p><strong>Une erreur critique s'est produite lors du démarrage automatique de l'application.</strong></p>";

    if ($isDebug) {
        echo "<p><strong>Erreur :</strong> " . htmlspecialchars($e->getMessage()) . "</p>";
        echo "<p><strong>Fichier :</strong> " . htmlspecialchars($e->getFile()) . " ligne " . $e->getLine() . "</p>";
    } else {
        echo "<p>Veuillez contacter l'administrateur système.</p>";
    }
    echo "</div>";

    if ($isDebug) {
        echo "<div class='debug'>";
        echo "<h3>Informations de debug</h3>";
        echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";

        // Afficher les fichiers chargés
        if (isset($GLOBALS['app_init_files_loaded']) && ! empty($GLOBALS['app_init_files_loaded'])) {
            echo "<h4>Fichiers d'initialisation chargés :</h4>";
            echo "<div class='file-list'>";
            foreach ($GLOBALS['app_init_files_loaded'] as $fileInfo) {
                $class      = $fileInfo['success'] ? 'success' : 'failed';
                $status     = $fileInfo['success'] ? '✅' : '❌';
                $duration   = $fileInfo['duration_ms'];
                $isOptional = $fileInfo['order'] >= 200 ? ' (optionnel)' : '';
                echo "<div class='$class'>";
                echo $status . " ";                                 // ✅ ou ❌ + espace
                echo sprintf('%03d', $fileInfo['order']) . "-";     // 010-
                echo htmlspecialchars($fileInfo['name']) . ".php "; // autoload.php
                echo "(" . $duration . "ms)";                       // (15.2ms)
                echo $isOptional;                                   // (optionnel) ou vide
                if (! $fileInfo['success']) {
                    echo " - <strong>Erreur:</strong> " . htmlspecialchars($fileInfo['error']);
                }
                echo "</div>";
            }
            echo "</div>";
        }

        if (isset($GLOBALS['app_init_stats'])) {
            echo "<h4>Statistiques d'initialisation :</h4>";
            echo "<pre>" . htmlspecialchars(json_encode($GLOBALS['app_init_stats'], JSON_PRETTY_PRINT)) . "</pre>";
        }
        echo "</div>";
    }

    echo "</body></html>";
    exit;
}
