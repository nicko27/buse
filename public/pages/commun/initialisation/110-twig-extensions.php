<?php
/**
 * 110-twig-extensions.php
 * Ajout des extensions, filtres et fonctions Twig personnalisés
 */

use Commun\Template\TwigExtensions;

$twigExtensionsStats = [
    'custom_extensions_loaded' => [],
    'filters_added' => [],
    'functions_added' => [],
    'globals_added' => [],
    'config_vars_injected' => 0,
    'error' => null,
];

try {
    // Vérifier que Twig est disponible
    if (!isset($twig) || !$twig instanceof \Twig\Environment) {
        throw new \Exception("Environnement Twig non disponible");
    }
    
    // ===== EXTENSIONS PERSONNALISÉES =====
    
    // Extension personnalisée de l'application
    if (class_exists('Commun\Template\TwigExtensions')) {
        $twig->addExtension(new TwigExtensions());
        $twigExtensionsStats['custom_extensions_loaded'][] = 'TwigExtensions';
    }
    
    // ===== FILTRES UTILES =====
    
    // Filtre pour trier un tableau par propriété
    $twig->addFilter(new \Twig\TwigFilter('sort_by', function ($array, $property) {
        if (!is_array($array)) {
            return $array;
        }

        usort($array, function ($a, $b) use ($property) {
            $aVal = is_array($a) ? ($a[$property] ?? 0) : (isset($a->$property) ? $a->$property : 0);
            $bVal = is_array($b) ? ($b[$property] ?? 0) : (isset($b->$property) ? $b->$property : 0);
            return $aVal <=> $bVal;
        });

        return $array;
    }));
    $twigExtensionsStats['filters_added'][] = 'sort_by';
    
    // Filtre pour filtrer un tableau par propriété
    $twig->addFilter(new \Twig\TwigFilter('filter_by', function ($array, $property, $value) {
        if (!is_array($array)) {
            return [];
        }

        return array_filter($array, function ($item) use ($property, $value) {
            $itemVal = is_array($item) ? ($item[$property] ?? null) : (isset($item->$property) ? $item->$property : null);
            return $itemVal === $value;
        });
    }));
    $twigExtensionsStats['filters_added'][] = 'filter_by';
    
    // Filtre pour formater une taille de fichier
    $twig->addFilter(new \Twig\TwigFilter('filesize', function ($bytes) {
        if ($bytes <= 0) return '0 B';
        
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];
        $base = log($bytes, 1024);
        return round(pow(1024, $base - floor($base)), 2) . ' ' . $units[floor($base)];
    }));
    $twigExtensionsStats['filters_added'][] = 'filesize';
    
    // Filtre pour formater une durée en secondes
    $twig->addFilter(new \Twig\TwigFilter('duration', function ($seconds) {
        if ($seconds < 60) return $seconds . 's';
        if ($seconds < 3600) return floor($seconds / 60) . 'min ' . ($seconds % 60) . 's';
        return floor($seconds / 3600) . 'h ' . floor(($seconds % 3600) / 60) . 'min';
    }));
    $twigExtensionsStats['filters_added'][] = 'duration';
    
    // Filtre pour JSON pretty print
    $twig->addFilter(new \Twig\TwigFilter('json_pretty', function ($value) {
        return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }));
    $twigExtensionsStats['filters_added'][] = 'json_pretty';
    
    // ===== FONCTIONS UTILES =====
    
    // Fonction pour générer une URL
    $twig->addFunction(new \Twig\TwigFunction('url', function ($route, $params = []) use ($config) {
        $webDir = $config->get('WEB_DIR', '');
        $url = $webDir . '/' . trim($route, '/');
        
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }
        
        return $url;
    }));
    $twigExtensionsStats['functions_added'][] = 'url';
    
    // Fonction pour vérifier un droit utilisateur
    $twig->addFunction(new \Twig\TwigFunction('has_right', function ($right) use ($rightsManager) {
        if (!$rightsManager || !$rightsManager->isAuthenticated()) {
            return false;
        }
        
        switch ($right) {
            case 'timeline':
                return $rightsManager->canReadTimeline();
            case 'permanences':
                return $rightsManager->canReadPermanences();
            case 'import':
                return $rightsManager->canImport();
            case 'admin':
                return $rightsManager->isAdmin();
            case 'super_admin':
                return $rightsManager->isSuperAdmin();
            default:
                return $rightsManager->hasRight($right);
        }
    }));
    $twigExtensionsStats['functions_added'][] = 'has_right';
    
    // Fonction pour obtenir la configuration
    $twig->addFunction(new \Twig\TwigFunction('config', function ($key, $default = null) use ($config) {
        return $config->get($key, $default);
    }));
    $twigExtensionsStats['functions_added'][] = 'config';
    
    // ===== VARIABLES GLOBALES =====
    
    // Variables de configuration pour Twig
    $twigVars = $config->getTwigVars();
    foreach ($twigVars as $key => $value) {
        $twig->addGlobal($key, $value);
        $twigExtensionsStats['config_vars_injected']++;
    }
    
    // Variables utilisateur si disponible
    if (isset($rightsManager) && $rightsManager && $rightsManager->isAuthenticated()) {
        $userGlobals = [
            'debug' => $config->get('DEBUG', 0),
            'authenticated' => true,
            'id' => $rightsManager->getUserId(),
            'name' => $rightsManager->getUserName(),
            'email' => $rightsManager->getUserMail(),
            'unit' => $rightsManager->getUserUnit(),
            'cu' => $rightsManager->getUserCu(),
            'timeline' => $rightsManager->canReadTimeline(),
            'permanences' => $rightsManager->canReadPermanences(),
            'import' => $rightsManager->canImport(),
            'synthesisLevel' => $rightsManager->getSynthesisViewLevel(),
            'admin' => $rightsManager->isAdmin(),
            'superAdmin' => $rightsManager->isSuperAdmin(),
            'binaryRights' => $rightsManager->getBinaryRights(),
        ];
        
        $twig->addGlobal('user', $userGlobals);
        $twigExtensionsStats['globals_added'][] = 'user';
    } else {
        $twig->addGlobal('user', [
            'authenticated' => false,
            'binaryRights' => 0,
        ]);
        $twigExtensionsStats['globals_added'][] = 'user (non authentifié)';
    }
    
    // Variables système
    $twig->addGlobal('ldap_available', $ldapAvailable ?? false);
    $twigExtensionsStats['globals_added'][] = 'ldap_available';
    
    // Variables de session CSRF
    if (isset($csrfManager) && $csrfManager) {
        $twig->addGlobal('csrf_token', $csrfManager->getToken());
        $twigExtensionsStats['globals_added'][] = 'csrf_token';
    }

} catch (\Exception $e) {
    $twigExtensionsStats['error'] = $e->getMessage();
    
    if ($logger) {
        $logger->error("Erreur lors de l'ajout des extensions Twig", [
            'error' => $e->getMessage(),
        ]);
    }
}

// Log des extensions ajoutées
if ($logger) {
    $logger->info("Extensions Twig ajoutées", $twigExtensionsStats);
}

// Ajouter aux stats globales
$GLOBALS['app_init_stats']['twig_extensions'] = $twigExtensionsStats;