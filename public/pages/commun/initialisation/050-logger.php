<?php
/**
 * 050-logger.php
 * Initialisation du système de logging avancé
 */

use Commun\Logger\DeduplicatedLogger;
use Commun\Logger\LoggerConfigManager;
use Commun\Logger\LogSearchEngine;
use Commun\Logger\LogViewerAuth;

$loggerInitialized        = false;
$loggerError              = null;
$configManagerInitialized = false;
$searchEngineInitialized  = false;
$authInitialized          = false;

try {
    // Configuration de base
    $loggerName = $config->get('LOGGER_NAME', $config->get('SITE', 'app'));
    $logDir     = $config->get('LOG_DIR', dirname(__DIR__, 3) . '/logs');

    // Vérification/création du répertoire de logs
    if (! is_dir($logDir)) {
        if (! mkdir($logDir, 0755, true)) {
            throw new \Exception("Impossible de créer le répertoire de logs : $logDir");
        }
    }

    // Vérification des permissions d'écriture
    if (! is_writable($logDir)) {
        throw new \Exception("Répertoire de logs non accessible en écriture : $logDir");
    }

    // === ÉTAPE 1: Initialisation du gestionnaire de configuration intelligent ===
    try {
        $configManager            = new LoggerConfigManager($config, $logDir);
        $loggerConfig             = $configManager->getConfiguration();
        $environment              = $configManager->getEnvironment();
        $configManagerInitialized = true;

        // Log de la détection d'environnement via error_log temporaire
        error_log("LoggerConfigManager: Environment detected as '{$environment}'");

    } catch (\Exception $e) {
        // Fallback vers configuration manuelle
        $loggerConfig = [
            'log_level'             => $config->get('LOG_LEVEL', 'info'),
            'buffer_size'           => (int) $config->get('LOG_BUFFER_SIZE', 50),
            'flush_interval'        => (int) $config->get('LOG_FLUSH_INTERVAL', 15),
            'compression_enabled'   => filter_var($config->get('LOG_COMPRESSION', 'true'), FILTER_VALIDATE_BOOLEAN),
            'deduplication_enabled' => filter_var($config->get('LOG_DEDUPLICATION', 'true'), FILTER_VALIDATE_BOOLEAN),
        ];
        $environment = $config->get('ENV', 'production');

        error_log("LoggerConfigManager failed, using fallback config: " . $e->getMessage());
    }

    // === ÉTAPE 2: Initialisation du logger avancé ===
    $logger = new DeduplicatedLogger($loggerName, $logDir);

    // Configuration du logger selon les paramètres détectés
    $logger->setBufferSize($loggerConfig['buffer_size']);
    $logger->setFlushInterval($loggerConfig['flush_interval']);
    $logger->setCompressionEnabled($loggerConfig['compression_enabled']);
    $logger->setDeduplicationEnabled($loggerConfig['deduplication_enabled']);

    // Associer le gestionnaire de configuration au logger pour les événements
    if ($configManagerInitialized) {
        $configManager->setLogger($logger);
    }

    // Test d'écriture initial
    $logger->info("Système de logging avancé initialisé", [
        'logger_name'    => $loggerName,
        'log_directory'  => $logDir,
        'environment'    => $environment,
        'config_manager' => $configManagerInitialized,
        'configuration'  => $loggerConfig,
        'php_version'    => PHP_VERSION,
        'timestamp'      => date('Y-m-d H:i:s'),
    ]);

    $loggerInitialized = true;

    // === ÉTAPE 3: Initialisation du moteur de recherche ===
    try {
        $searchEngine = new LogSearchEngine($logDir);

        // Mettre à jour l'index en arrière-plan si nécessaire
        $indexStats = $searchEngine->getIndexStats();
        if (! $indexStats['last_update'] || time() - $indexStats['last_update'] > 3600) {
            // Index trop ancien, programmer une mise à jour
            register_shutdown_function(function () use ($searchEngine, $logger) {
                try {
                    $searchEngine->updateSearchIndex();
                    $logger->debug("Index de recherche mis à jour automatiquement");
                } catch (\Exception $e) {
                    $logger->warning("Échec de mise à jour de l'index de recherche", [
                        'error' => $e->getMessage(),
                    ]);
                }
            });
        }

        $searchEngineInitialized = true;

        $logger->info("Moteur de recherche de logs initialisé", [
            'indexed_files' => $indexStats['indexed_files'],
            'total_terms'   => $indexStats['total_terms'],
            'last_update'   => $indexStats['last_update'] ? date('Y-m-d H:i:s', $indexStats['last_update']) : 'never',
        ]);

    } catch (\Exception $e) {
        $logger->warning("Échec d'initialisation du moteur de recherche", [
            'error' => $e->getMessage(),
        ]);
    }

    // === ÉTAPE 4: Initialisation de l'authentification (si RightsManager disponible) ===
    try {
        if (isset($rightsManager) && $rightsManager instanceof \Commun\Security\RightsManager) {
            $logViewerAuth = new LogViewerAuth($rightsManager, [
                'csrf_secret' => $config->get('CSRF_SECRET', bin2hex(random_bytes(32))),
            ]);
            $logViewerAuth->setAuditLogger($logger);
            $authInitialized = true;

            $logger->info("Authentification du visualiseur de logs initialisée", [
                'security_model' => 'superadmin_only',
                'csrf_enabled'   => true,
            ]);

        } else {
            $logger->warning("RightsManager non disponible, authentification du visualiseur désactivée");
        }
    } catch (\Exception $e) {
        $logger->error("Échec d'initialisation de l'authentification", [
            'error' => $e->getMessage(),
        ]);
    }

    // === ÉTAPE 5: Enregistrement du logger pour début/fin de requête ===
    $logger->logRequestStart();

    // Enregistrer le logger pour la fin de requête
    register_shutdown_function(function () use ($logger) {
        if ($logger) {
            $logger->logRequestEnd();
            $logger->forceFlush(); // S'assurer que tout est écrit
        }
    });

} catch (\Exception $e) {
    $loggerInitialized = false;
    $loggerError       = $e->getMessage();

    // Fallback : utiliser error_log PHP natif
    error_log("Erreur d'initialisation du système de logging avancé : " . $loggerError);

    // Créer un logger de fallback pour éviter les erreurs fatales
    $logger = new \Psr\Log\NullLogger();
}

// Statistiques complètes du système de logging
$loggerStats = [
    'initialized'        => $loggerInitialized,
    'logger_name'        => $loggerName ?? null,
    'log_directory'      => $logDir ?? null,
    'directory_writable' => isset($logDir) ? is_writable($logDir) : false,
    'environment'        => $environment ?? 'unknown',
    'config_manager'     => $configManagerInitialized,
    'search_engine'      => $searchEngineInitialized,
    'authentication'     => $authInitialized,
    'configuration'      => $loggerConfig ?? [],
    'error'              => $loggerError,
];

// Log des statistiques collectées précédemment
if ($loggerInitialized && isset($GLOBALS['app_init_stats'])) {
    $logger->info("Statistiques d'initialisation complètes", [
        'config'   => $GLOBALS['app_init_stats']['config'] ?? [],
        'database' => $GLOBALS['app_init_stats']['database'] ?? [],
        'logger'   => $loggerStats,
    ]);
}

// Ajout des stats du logger
$GLOBALS['app_init_stats']['logger'] = $loggerStats;

// Log spécifique pour les erreurs de BDD si elles existent
if (isset($databaseError) && $databaseError && $loggerInitialized) {
    $logger->error("Erreur de base de données détectée", [
        'error'           => $databaseError,
        'database_config' => [
            'host'     => $config->get('DB_HOST'),
            'database' => $config->get('DB_NAME'),
            'user'     => $config->get('DB_USER'),
            // Ne pas logger le mot de passe
        ],
        'suggestions'     => [
            'check_database_service' => 'Vérifier que le service de base de données est démarré',
            'check_credentials'      => 'Vérifier les identifiants de connexion',
            'check_network'          => 'Vérifier la connectivité réseau vers la base de données',
        ],
    ]);
}

// Configuration avancée selon l'environnement
if ($loggerInitialized) {
    $debugMode = $config->get('DEBUG', '0');

    if ($environment === 'development' || $debugMode === '1') {
        $logger->info("Mode debug activé", [
            'environment'        => $environment,
            'debug'              => $debugMode,
            'request_uri'        => $_SERVER['REQUEST_URI'] ?? 'N/A',
            'user_agent'         => $_SERVER['HTTP_USER_AGENT'] ?? 'N/A',
            'request_method'     => $_SERVER['REQUEST_METHOD'] ?? 'N/A',
            'memory_limit'       => ini_get('memory_limit'),
            'max_execution_time' => ini_get('max_execution_time'),
        ]);
    }

    // Log des métriques de performance si on est en production
    if ($environment === 'production' && $configManagerInitialized) {
        register_shutdown_function(function () use ($configManager, $logger) {
            $executionTime = microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true));
            $memoryPeak    = memory_get_peak_usage(true);

            // Mettre à jour les métriques de performance
            $configManager->updatePerformanceMetrics([
                'avg_log_processing_time' => $executionTime * 1000,                              // en ms
                'memory_usage_trend'      => $memoryPeak > 64 * 1024 * 1024 ? 'high' : 'normal', // 64MB
                'log_volume_per_hour'     => 1,                                                  // Sera calculé par agrégation
            ]);
        });
    }
}

// === VARIABLES GLOBALES POUR L'APPLICATION ===
// Rendre les composants disponibles globalement
if ($loggerInitialized) {
    $GLOBALS['advanced_logger'] = $logger;
}

if ($configManagerInitialized) {
    $GLOBALS['logger_config_manager'] = $configManager;
}

if ($searchEngineInitialized) {
    $GLOBALS['log_search_engine'] = $searchEngine;
}

if ($authInitialized) {
    $GLOBALS['log_viewer_auth'] = $logViewerAuth;
}

// === HELPER FUNCTIONS POUR L'APPLICATION ===
if (! function_exists('getAdvancedLogger')) {
    /**
     * Retourne l'instance du logger avancé
     */
    function getAdvancedLogger(): ?\Commun\Logger\DeduplicatedLogger
    {
        return $GLOBALS['advanced_logger'] ?? null;
    }
}

if (! function_exists('getLoggerConfigManager')) {
    /**
     * Retourne l'instance du gestionnaire de configuration
     */
    function getLoggerConfigManager(): ?\Commun\Logger\LoggerConfigManager
    {
        return $GLOBALS['logger_config_manager'] ?? null;
    }
}

if (! function_exists('getLogSearchEngine')) {
    /**
     * Retourne l'instance du moteur de recherche
     */
    function getLogSearchEngine(): ?\Commun\Logger\LogSearchEngine
    {
        return $GLOBALS['log_search_engine'] ?? null;
    }
}

if (! function_calls('getLogViewerAuth')) {
    /**
     * Retourne l'instance d'authentification du visualiseur
     */
    function getLogViewerAuth(): ?\Commun\Logger\LogViewerAuth
    {
        return $GLOBALS['log_viewer_auth'] ?? null;
    }
}

// Log de fin d'initialisation avec résumé
if ($loggerInitialized) {
    $componentsStatus = [
        'core_logger'    => $loggerInitialized,
        'config_manager' => $configManagerInitialized,
        'search_engine'  => $searchEngineInitialized,
        'authentication' => $authInitialized,
    ];

    $successCount = count(array_filter($componentsStatus));
    $totalCount   = count($componentsStatus);

    $logger->info("Initialisation du système de logging terminée", [
        'components_initialized' => "{$successCount}/{$totalCount}",
        'components_status'      => $componentsStatus,
        'total_init_time'        => round((microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true))) * 1000, 2) . 'ms',
        'environment'            => $environment,
    ]);
}
