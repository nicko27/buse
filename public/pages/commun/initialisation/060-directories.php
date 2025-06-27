<?php
/**
 * 060-directories.php
 * Création et vérification des répertoires nécessaires à l'application
 */

$directoriesStats = [
    'created' => [],
    'verified' => [],
    'errors' => [],
    'permissions_fixed' => [],
];

// Liste des répertoires nécessaires avec leurs permissions
$requiredDirectories = [
    $config->get('LOG_DIR', dirname(__DIR__, 3) . '/logs') => 0755,
    $config->get('UPLOAD_DIR', dirname(__DIR__, 3) . '/files') => 0755,
    $config->get('VIEWS_DIR', dirname(__DIR__, 2) . '/views') => 0755,
];

// Répertoires optionnels (ne pas échouer si ils n'existent pas)
$optionalDirectories = [
    dirname(__DIR__, 3) . '/cache' => 0755,
    dirname(__DIR__, 3) . '/tmp' => 0777,
    dirname(__DIR__, 3) . '/exports' => 0755,
];

// Fonction pour créer/vérifier un répertoire
function ensureDirectory(string $dir, int $permissions, bool $required = true): array {
    $result = [
        'path' => $dir,
        'exists' => false,
        'created' => false,
        'writable' => false,
        'permissions_fixed' => false,
        'error' => null,
    ];
    
    try {
        // Vérifier si le répertoire existe
        if (is_dir($dir)) {
            $result['exists'] = true;
            $directoriesStats['verified'][] = $dir;
        } else {
            // Tentative de création
            if (mkdir($dir, $permissions, true)) {
                $result['created'] = true;
                $result['exists'] = true;
                $directoriesStats['created'][] = $dir;
            } else {
                throw new \Exception("Impossible de créer le répertoire");
            }
        }
        
        // Vérifier les permissions d'écriture
        if ($result['exists']) {
            $result['writable'] = is_writable($dir);
            
            // Tenter de corriger les permissions si nécessaire
            if (!$result['writable']) {
                if (chmod($dir, $permissions)) {
                    $result['permissions_fixed'] = true;
                    $result['writable'] = is_writable($dir);
                    $directoriesStats['permissions_fixed'][] = $dir;
                }
            }
        }
        
    } catch (\Exception $e) {
        $result['error'] = $e->getMessage();
        $directoriesStats['errors'][] = [
            'path' => $dir,
            'error' => $e->getMessage(),
            'required' => $required,
        ];
    }
    
    return $result;
}

// Traitement des répertoires requis
$criticalErrors = [];
foreach ($requiredDirectories as $dir => $permissions) {
    $result = ensureDirectory($dir, $permissions, true);
    
    if (!$result['exists'] || !$result['writable']) {
        $criticalErrors[] = sprintf(
            "Répertoire critique inaccessible : %s (existe: %s, écriture: %s)%s",
            $dir,
            $result['exists'] ? 'oui' : 'non',
            $result['writable'] ? 'oui' : 'non',
            $result['error'] ? ' - Erreur: ' . $result['error'] : ''
        );
    }
}

// Traitement des répertoires optionnels
foreach ($optionalDirectories as $dir => $permissions) {
    ensureDirectory($dir, $permissions, false);
}

// Vérifications supplémentaires pour les répertoires critiques
$viewsDir = $config->get('VIEWS_DIR', dirname(__DIR__, 2) . '/views');
if (!is_dir($viewsDir)) {
    $criticalErrors[] = "Répertoire des vues manquant : $viewsDir";
} else {
    // Vérifier la présence de templates essentiels
    $essentialTemplates = [
        'layouts/default.twig',
        'errors/404.twig',
    ];
    
    foreach ($essentialTemplates as $template) {
        $templatePath = $viewsDir . '/' . $template;
        if (!file_exists($templatePath)) {
            if ($logger) {
                $logger->warning("Template essentiel manquant", [
                    'template' => $template,
                    'path' => $templatePath,
                ]);
            }
        }
    }
}

// Log des statistiques des répertoires
if ($logger) {
    $logger->info("Vérification des répertoires terminée", $directoriesStats);
    
    if (!empty($criticalErrors)) {
        $logger->error("Erreurs critiques de répertoires", [
            'errors' => $criticalErrors,
        ]);
    }
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['directories'] = $directoriesStats;

// Arrêter l'exécution si erreurs critiques
if (!empty($criticalErrors)) {
    $errorMessage = "Erreurs critiques de répertoires :\n" . implode("\n", $criticalErrors);
    
    if ($logger) {
        $logger->critical("Arrêt de l'application pour erreurs de répertoires", [
            'errors' => $criticalErrors,
        ]);
    }
    
    die($errorMessage);
}

// Nettoyage de la fonction helper
unset($requiredDirectories, $optionalDirectories);