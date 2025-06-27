<?php
/**
 * 100-twig-base.php
 * Configuration de base de Twig (environnement et loader)
 */

$twigStats = [
    'initialized' => false,
    'views_directory' => null,
    'cache_enabled' => false,
    'debug_enabled' => false,
    'loader_type' => null,
    'extensions_loaded' => [],
    'error' => null,
];

try {
    // Détermination du répertoire des vues
    $viewsDir = $config->get('VIEWS_DIR');
    if (!$viewsDir) {
        $viewsDir = dirname(__DIR__, 2) . '/views';
    }
    
    $twigStats['views_directory'] = $viewsDir;
    
    // Vérification de l'existence du répertoire des vues
    if (!is_dir($viewsDir)) {
        throw new \Exception("Le dossier des vues n'existe pas : $viewsDir");
    }
    
    if (!is_readable($viewsDir)) {
        throw new \Exception("Le dossier des vues n'est pas lisible : $viewsDir");
    }
    
    // Vérification de templates critiques
    $criticalTemplates = [
        'layouts/default.twig',
        'errors/404.twig',
    ];
    
    $missingTemplates = [];
    foreach ($criticalTemplates as $template) {
        $templatePath = $viewsDir . '/' . $template;
        if (!file_exists($templatePath)) {
            $missingTemplates[] = $template;
        }
    }
    
    if (!empty($missingTemplates)) {
        if ($logger) {
            $logger->warning("Templates critiques manquants", [
                'missing' => $missingTemplates,
                'views_dir' => $viewsDir,
            ]);
        }
    }
    
    // Création du loader Twig
    $loader = new \Twig\Loader\FilesystemLoader($viewsDir);
    $twigStats['loader_type'] = 'FilesystemLoader';
    
    // Ajout de chemins supplémentaires si configurés
    $additionalPaths = $config->get('TWIG_ADDITIONAL_PATHS');
    if ($additionalPaths && is_array($additionalPaths)) {
        foreach ($additionalPaths as $namespace => $path) {
            if (is_dir($path)) {
                if (is_string($namespace)) {
                    $loader->addPath($path, $namespace);
                } else {
                    $loader->addPath($path);
                }
            }
        }
    }
    
    // Configuration de l'environnement Twig
    $twigOptions = [
        'cache' => $config->get('TWIG_CACHE', false),
        'debug' => $config->get('TWIG_DEBUG', $config->get('ENV') === 'dev'),
        'strict_variables' => $config->get('TWIG_STRICT_VARIABLES', $config->get('ENV') === 'dev'),
        'autoescape' => $config->get('TWIG_AUTOESCAPE', 'html'),
        'optimizations' => $config->get('TWIG_OPTIMIZATIONS', -1),
    ];
    
    $twigStats['cache_enabled'] = $twigOptions['cache'] !== false;
    $twigStats['debug_enabled'] = $twigOptions['debug'];
    
    // Gestion du cache Twig
    if ($twigOptions['cache']) {
        $cacheDir = is_string($twigOptions['cache']) ? $twigOptions['cache'] : $config->get('TWIG_CACHE_DIR', dirname(__DIR__, 3) . '/cache/twig');
        
        if (!is_dir($cacheDir)) {
            if (!mkdir($cacheDir, 0755, true)) {
                if ($logger) {
                    $logger->warning("Impossible de créer le répertoire de cache Twig", [
                        'cache_dir' => $cacheDir,
                    ]);
                }
                $twigOptions['cache'] = false;
                $twigStats['cache_enabled'] = false;
            }
        }
        
        if (is_dir($cacheDir) && !is_writable($cacheDir)) {
            if ($logger) {
                $logger->warning("Répertoire de cache Twig non accessible en écriture", [
                    'cache_dir' => $cacheDir,
                ]);
            }
            $twigOptions['cache'] = false;
            $twigStats['cache_enabled'] = false;
        }
        
        if ($twigOptions['cache']) {
            $twigOptions['cache'] = $cacheDir;
        }
    }
    
    // Création de l'environnement Twig
    $twig = new \Twig\Environment($loader, $twigOptions);
    $twigStats['initialized'] = true;
    
    // Ajout des extensions de base
    if ($twigOptions['debug']) {
        $twig->addExtension(new \Twig\Extension\DebugExtension());
        $twigStats['extensions_loaded'][] = 'DebugExtension';
    }
    
    // Configuration des globals de base
    $baseGlobals = [
        'app' => [
            'name' => $config->get('SITE', 'Application'),
            'version' => $config->get('APP_VERSION', '1.0.0'),
            'environment' => $config->get('ENV', 'production'),
            'debug' => $twigOptions['debug'],
        ],
        'request' => [
            'uri' => $_SERVER['REQUEST_URI'] ?? '/',
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'is_https' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
        ],
    ];
    
    foreach ($baseGlobals as $name => $value) {
        $twig->addGlobal($name, $value);
    }

} catch (\Exception $e) {
    $twigStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->error("Erreur d'initialisation de Twig", [
            'error' => $e->getMessage(),
            'views_directory' => $twigStats['views_directory'],
        ]);
    }
    
    // Tentative de création d'un environnement Twig minimal pour éviter les erreurs fatales
    try {
        $loader = new \Twig\Loader\ArrayLoader([
            'error.twig' => '<h1>Erreur de template</h1><p>{{ message }}</p>',
            'minimal.twig' => '{{ content|raw }}',
        ]);
        $twig = new \Twig\Environment($loader, ['debug' => false]);
        
        if ($logger) {
            $logger->info("Twig initialisé en mode minimal de secours");
        }
    } catch (\Exception $fallbackError) {
        $twig = null;
        if ($logger) {
            $logger->critical("Impossible d'initialiser Twig même en mode minimal", [
                'original_error' => $e->getMessage(),
                'fallback_error' => $fallbackError->getMessage(),
            ]);
        }
    }
}

// Log des statistiques Twig
if ($logger) {
    $logger->info("Configuration de base Twig terminée", $twigStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['twig_base'] = $twigStats;

// Vérification critique pour les pages nécessitant Twig
if (!$twigStats['initialized']) {
    $currentPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $currentPath = trim($currentPath, '/');
    
    // La plupart des pages nécessitent Twig, sauf peut-être les API
    $apiPages = ['api', 'webhook', 'cron'];
    $isApiPage = false;
    
    foreach ($apiPages as $apiPage) {
        if (str_starts_with($currentPath, $apiPage)) {
            $isApiPage = true;
            break;
        }
    }
    
    if (!$isApiPage) {
        die("Erreur critique : Twig non disponible pour le rendu des templates.\nErreur : " . ($twigStats['error'] ?? 'Inconnue'));
    }
}