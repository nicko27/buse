<?php
/**
 * 020-classes.php
 * Chargement de toutes les classes communes de l'application
 * Inclut le nouveau système de logging avancé
 */

// Classes principales par ordre de dépendance
$requiredClasses = [
    // Configuration et base
    __DIR__ . "/../classes/Config/Config.php",

    // Base de données
    __DIR__ . "/../classes/Database/BDDManager.php",
    __DIR__ . "/../classes/Database/SqlManager.php",
    __DIR__ . "/../classes/Database/SqlAdapter.php",

                                                            // Logging - Ordre d'héritage important
    __DIR__ . "/../classes/Logger/Logger.php",              // Logger de base (existant)
    __DIR__ . "/../classes/Logger/BufferedLogger.php",      // Optimisations performances
    __DIR__ . "/../classes/Logger/EnhancedLogger.php",      // Métadonnées enrichies
    __DIR__ . "/../classes/Logger/DeduplicatedLogger.php",  // Déduplication (classe principale)
    __DIR__ . "/../classes/Logger/LoggerConfigManager.php", // Configuration intelligente
    __DIR__ . "/../classes/Logger/LogSearchEngine.php",     // Moteur de recherche
    __DIR__ . "/../classes/Logger/LogViewerController.php", // Interface web
    __DIR__ . "/../classes/Logger/LogViewerAuth.php",       // Authentification visualiseur

    // Sécurité
    __DIR__ . "/../classes/Security/CsrfManager.php",
    __DIR__ . "/../classes/Security/RightsManager.php",
    __DIR__ . "/../classes/Security/DummySSO.php",
    __DIR__ . "/../classes/Security/SSOlocal.php",

    // Routage
    __DIR__ . "/../classes/Router/RouterConfig.php",
    __DIR__ . "/../classes/Router/Router.php",

    // Templates
    __DIR__ . "/../classes/Template/TwigExtensions.php",

    // Utilitaires
    __DIR__ . "/../classes/Utils/FileUtils.php",
    __DIR__ . "/../classes/Utils/DateUtils.php",
    __DIR__ . "/../classes/Utils/StringUtils.php",
    __DIR__ . "/../classes/Utils/TphUtils.php",
    __DIR__ . "/../classes/Utils/ExcelProcessor.php",
    __DIR__ . "/../classes/Utils/UploadManager.php",
    __DIR__ . "/../classes/Utils/FileListUtils.php",

    // Services externes
    __DIR__ . "/../classes/Ldap/LdapManager.php",
    __DIR__ . "/../classes/Mail/EMLGenerator.php",
];

// Classes de logging avancé (nouvelles)
$advancedLoggingClasses = [
    'BufferedLogger.php',
    'EnhancedLogger.php',
    'DeduplicatedLogger.php',
    'LoggerConfigManager.php',
    'LogSearchEngine.php',
    'LogViewerController.php',
    'LogViewerAuth.php',
];

// Chargement avec vérification d'existence et gestion d'erreurs détaillée
$loadedClasses  = 0;
$missingClasses = [];
$loadingErrors  = [];

foreach ($requiredClasses as $classFile) {
    try {
        if (file_exists($classFile)) {
            require_once $classFile;
            $loadedClasses++;

            // Log de debug pour les nouvelles classes de logging
            $fileName = basename($classFile);
            error_log("Logging avancé: Classe chargée - {$fileName}");
        } else {
            $missingClasses[] = $classFile;
        }
    } catch (ParseError $e) {
        $loadingErrors[] = [
            'file'  => $classFile,
            'error' => 'Erreur de syntaxe: ' . $e->getMessage(),
            'line'  => $e->getLine(),
        ];
    } catch (Error $e) {
        $loadingErrors[] = [
            'file'  => $classFile,
            'error' => 'Erreur fatale: ' . $e->getMessage(),
            'line'  => $e->getLine(),
        ];
    } catch (Exception $e) {
        $loadingErrors[] = [
            'file'  => $classFile,
            'error' => 'Exception: ' . $e->getMessage(),
            'line'  => $e->getLine(),
        ];
    }
}

// Gestion des erreurs de chargement
if (! empty($loadingErrors)) {
    $errorMessages = [];
    foreach ($loadingErrors as $error) {
        $errorMessages[] = basename($error['file']) . ": " . $error['error'] . " (ligne " . $error['line'] . ")";
    }
    die("Erreurs de chargement des classes :\n" . implode("\n", $errorMessages));
}

// Log des classes manquantes (si elles ne sont pas critiques)
if (! empty($missingClasses)) {
    $nonCriticalClasses = [
        'LdapManager.php',    // Optionnel si pas de LDAP
        'EMLGenerator.php',   // Optionnel si pas d'emails
        'ExcelProcessor.php', // Optionnel si pas de traitement Excel
        'DummySSO.php',       // Optionnel selon la config SSO
        'SSOlocal.php',       // Optionnel selon la config SSO

                                   // Classes de logging avancé - optionnelles en cas de problème
        'BufferedLogger.php',      // Fallback vers Logger de base
        'EnhancedLogger.php',      // Fallback vers BufferedLogger
        'DeduplicatedLogger.php',  // Fallback vers EnhancedLogger
        'LoggerConfigManager.php', // Configuration manuelle possible
        'LogSearchEngine.php',     // Recherche désactivée
        'LogViewerController.php', // Interface web désactivée
        'LogViewerAuth.php',       // Pas d'interface web
    ];

    $criticalMissing = [];
    $loggingMissing  = [];

    foreach ($missingClasses as $missing) {
        $fileName   = basename($missing);
        $isCritical = true;
        $isLogging  = false;

        foreach ($nonCriticalClasses as $nonCritical) {
            if (str_contains($missing, $nonCritical)) {
                $isCritical = false;
                if (in_array($fileName, $advancedLoggingClasses)) {
                    $isLogging = true;
                }
                break;
            }
        }

        if ($isCritical) {
            $criticalMissing[] = $missing;
        } elseif ($isLogging) {
            $loggingMissing[] = $fileName;
        }
    }

    // Erreur fatale pour les classes critiques
    if (! empty($criticalMissing)) {
        die("Erreur critique : Classes manquantes :\n" . implode("\n", $criticalMissing));
    }

    // Warning pour les classes de logging manquantes
    if (! empty($loggingMissing)) {
        error_log("Warning: Classes de logging avancé manquantes - fonctionnalités réduites: " . implode(', ', $loggingMissing));
    }
}

// Vérification que les classes principales sont chargées
$coreClasses = [
    'Commun\Config\Config',
    'Commun\Database\SqlManager',
    'Commun\Database\SqlAdapter',
    'Commun\Logger\Logger', // Logger de base obligatoire
    'Commun\Router\Router',
    'Commun\Security\RightsManager',
    'Commun\Security\CsrfManager',
];

// Vérification des classes de logging avancé (optionnelles)
$advancedLoggingClassesMap = [
    'Commun\Logger\BufferedLogger'      => 'BufferedLogger.php',
    'Commun\Logger\EnhancedLogger'      => 'EnhancedLogger.php',
    'Commun\Logger\DeduplicatedLogger'  => 'DeduplicatedLogger.php',
    'Commun\Logger\LoggerConfigManager' => 'LoggerConfigManager.php',
    'Commun\Logger\LogSearchEngine'     => 'LogSearchEngine.php',
    'Commun\Logger\LogViewerController' => 'LogViewerController.php',
    'Commun\Logger\LogViewerAuth'       => 'LogViewerAuth.php',
];

// Vérification des classes critiques
foreach ($coreClasses as $coreClass) {
    if (! class_exists($coreClass)) {
        die("Erreur critique : Classe principale non trouvée : $coreClass");
    }
}

// Vérification et état des classes de logging avancé
$loggingStatus = [
    'core_available'     => class_exists('Commun\Logger\Logger'),
    'advanced_available' => false,
    'components'         => [],
];

foreach ($advancedLoggingClassesMap as $className => $fileName) {
    $available                              = class_exists($className);
    $loggingStatus['components'][$fileName] = $available;

    if ($className === 'Commun\Logger\DeduplicatedLogger' && $available) {
        $loggingStatus['advanced_available'] = true;
    }
}

// Stocker l'état pour l'initialisation du logger
$GLOBALS['logging_status'] = $loggingStatus;

// Log de résumé du chargement
$totalClasses   = count($requiredClasses);
$loadedAdvanced = count(array_filter($loggingStatus['components']));
$totalAdvanced  = count($loggingStatus['components']);

error_log("Classes chargées: {$loadedClasses}/{$totalClasses} total, {$loadedAdvanced}/{$totalAdvanced} logging avancé");

// Détection du mode de logging disponible
if ($loggingStatus['advanced_available']) {
    $GLOBALS['logging_mode'] = 'advanced';
    error_log("Mode de logging: AVANCÉ (DeduplicatedLogger disponible)");
} elseif (class_exists('Commun\Logger\BufferedLogger')) {
    $GLOBALS['logging_mode'] = 'optimized';
    error_log("Mode de logging: OPTIMISÉ (BufferedLogger disponible)");
} elseif ($loggingStatus['core_available']) {
    $GLOBALS['logging_mode'] = 'basic';
    error_log("Mode de logging: BASIQUE (Logger standard)");
} else {
    $GLOBALS['logging_mode'] = 'none';
    error_log("Mode de logging: AUCUN (fallback vers error_log)");
}

// Validation des dépendances pour le logging avancé
if ($loggingStatus['advanced_available']) {
    $dependencyIssues = [];

    // Vérifier Monolog
    if (! class_exists('Monolog\Logger')) {
        $dependencyIssues[] = "Monolog non installé (composer install requis)";
    }

    // Vérifier les extensions PHP
    if (! extension_loaded('json')) {
        $dependencyIssues[] = "Extension PHP json requise";
    }

    if (! extension_loaded('mbstring')) {
        $dependencyIssues[] = "Extension PHP mbstring recommandée";
    }

    if (! empty($dependencyIssues)) {
        error_log("Dépendances manquantes pour le logging avancé: " . implode(', ', $dependencyIssues));
        $GLOBALS['logging_mode'] = 'basic';
    }
}

// Statistiques de chargement pour le debugging
$GLOBALS['class_loading_stats'] = [
    'total_classes'               => $totalClasses,
    'loaded_classes'              => $loadedClasses,
    'missing_classes'             => count($missingClasses),
    'loading_errors'              => count($loadingErrors),
    'logging_mode'                => $GLOBALS['logging_mode'],
    'advanced_logging_components' => $loggingStatus['components'],
];
