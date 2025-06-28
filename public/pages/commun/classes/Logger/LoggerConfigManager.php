<?php
namespace Commun\Logger;

use Commun\Config\Config;

/**
 * LoggerConfigManager - Gestionnaire de configuration intelligente pour le système de logs
 * 
 * Fonctionnalités:
 * - Auto-détection de l'environnement (dev/prod)
 * - Niveaux de log adaptatifs selon la charge
 * - Configuration hot-reload sans redémarrage
 * - Présets pour différents types d'applications
 * - Monitoring et ajustement automatique des performances
 */
class LoggerConfigManager
{
    /** @var Config Instance de configuration globale */
    private Config $config;
    
    /** @var array Configuration actuelle du logger */
    private array $loggerConfig = [];
    
    /** @var string Environnement détecté */
    private string $environment = 'production';
    
    /** @var array Présets de configuration par environnement */
    private array $environmentPresets = [
        'development' => [
            'log_level' => 'debug',
            'buffer_size' => 10,
            'flush_interval' => 5,
            'compression_enabled' => false,
            'deduplication_enabled' => false,
            'max_file_size' => '10MB',
            'rotation_days' => 3,
            'auto_refresh_interval' => 2000,
            'enable_live_stream' => true,
            'enable_debug_toolbar' => true
        ],
        'staging' => [
            'log_level' => 'info',
            'buffer_size' => 50,
            'flush_interval' => 15,
            'compression_enabled' => true,
            'deduplication_enabled' => true,
            'max_file_size' => '50MB',
            'rotation_days' => 7,
            'auto_refresh_interval' => 5000,
            'enable_live_stream' => true,
            'enable_debug_toolbar' => false
        ],
        'production' => [
            'log_level' => 'warning',
            'buffer_size' => 100,
            'flush_interval' => 30,
            'compression_enabled' => true,
            'deduplication_enabled' => true,
            'max_file_size' => '100MB',
            'rotation_days' => 30,
            'auto_refresh_interval' => 10000,
            'enable_live_stream' => false,
            'enable_debug_toolbar' => false
        ]
    ];
    
    /** @var array Présets par type d'application */
    private array $applicationPresets = [
        'web_application' => [
            'request_logging' => true,
            'session_tracking' => true,
            'error_pages' => true,
            'performance_monitoring' => true
        ],
        'api_service' => [
            'request_logging' => true,
            'response_time_tracking' => true,
            'rate_limiting_logs' => true,
            'api_error_tracking' => true
        ],
        'batch_processing' => [
            'progress_logging' => true,
            'memory_monitoring' => true,
            'long_running_detection' => true,
            'batch_summary_reports' => true
        ],
        'microservice' => [
            'service_discovery_logs' => true,
            'inter_service_communication' => true,
            'health_check_logging' => false,
            'distributed_tracing' => true
        ]
    ];
    
    /** @var array Métriques de performance pour ajustement automatique */
    private array $performanceMetrics = [
        'avg_log_processing_time' => 0,
        'memory_usage_trend' => 'stable',
        'error_rate' => 0,
        'log_volume_per_hour' => 0,
        'disk_usage_growth' => 0
    ];
    
    /** @var float Timestamp de la dernière vérification de performance */
    private float $lastPerformanceCheck = 0;
    
    /** @var int Intervalle de vérification des performances en secondes */
    private int $performanceCheckInterval = 300; // 5 minutes
    
    /** @var string Fichier de configuration cache */
    private string $configCacheFile;
    
    /** @var DeduplicatedLogger Logger pour les événements de configuration */
    private ?DeduplicatedLogger $logger = null;

    public function __construct(Config $config, string $logDir)
    {
        $this->config = $config;
        $this->configCacheFile = rtrim($logDir, '/') . '/.logger_config_cache.json';
        
        $this->detectEnvironment();
        $this->loadConfiguration();
        $this->lastPerformanceCheck = microtime(true);
    }
    
    /**
     * Définit le logger pour les événements de configuration
     */
    public function setLogger(DeduplicatedLogger $logger): void
    {
        $this->logger = $logger;
    }
    
    /**
     * Détecte automatiquement l'environnement
     */
    private function detectEnvironment(): void
    {
        // Ordre de priorité pour la détection
        $detectionMethods = [
            'config_explicit' => [$this, 'detectFromConfig'],
            'environment_var' => [$this, 'detectFromEnvVar'],
            'server_characteristics' => [$this, 'detectFromServerCharacteristics'],
            'file_indicators' => [$this, 'detectFromFileIndicators'],
            'network_indicators' => [$this, 'detectFromNetworkIndicators']
        ];
        
        foreach ($detectionMethods as $method => $callable) {
            $detected = call_user_func($callable);
            if ($detected !== null) {
                $this->environment = $detected;
                $this->logConfigEvent('environment_detected', [
                    'environment' => $detected,
                    'method' => $method
                ]);
                return;
            }
        }
        
        // Par défaut, considérer comme production pour la sécurité
        $this->environment = 'production';
        $this->logConfigEvent('environment_default', [
            'environment' => 'production',
            'reason' => 'no_detection_method_succeeded'
        ]);
    }
    
    /**
     * Détection via configuration explicite
     */
    private function detectFromConfig(): ?string
    {
        $env = $this->config->get('ENVIRONMENT');
        if ($env && in_array($env, ['development', 'staging', 'production'])) {
            return $env;
        }
        
        $appEnv = $this->config->get('APP_ENV');
        if ($appEnv) {
            $mapping = [
                'dev' => 'development',
                'local' => 'development',
                'test' => 'staging',
                'staging' => 'staging',
                'prod' => 'production',
                'production' => 'production'
            ];
            return $mapping[$appEnv] ?? null;
        }
        
        return null;
    }
    
    /**
     * Détection via variables d'environnement
     */
    private function detectFromEnvVar(): ?string
    {
        $indicators = [
            'development' => ['XDEBUG_CONFIG', 'COMPOSER_DEV_MODE'],
            'staging' => ['STAGING_ENV', 'PRE_PROD'],
            'production' => ['PRODUCTION', 'LIVE_ENV']
        ];
        
        foreach ($indicators as $env => $vars) {
            foreach ($vars as $var) {
                if (getenv($var) !== false) {
                    return $env;
                }
            }
        }
        
        return null;
    }
    
    /**
     * Détection via caractéristiques du serveur
     */
    private function detectFromServerCharacteristics(): ?string
    {
        // Vérifier si on est en CLI
        if (php_sapi_name() === 'cli') {
            // En CLI, regarder les arguments ou l'environnement
            global $argv;
            if (isset($argv) && in_array('--dev', $argv)) {
                return 'development';
            }
        }
        
        // Vérifier le nom du serveur
        $serverName = $_SERVER['SERVER_NAME'] ?? $_SERVER['HTTP_HOST'] ?? '';
        
        if (preg_match('/localhost|127\.0\.0\.1|\.local$|\.dev$/i', $serverName)) {
            return 'development';
        }
        
        if (preg_match('/staging|preprod|test/i', $serverName)) {
            return 'staging';
        }
        
        // Vérifier les extensions de debug
        if (extension_loaded('xdebug') && ini_get('xdebug.mode')) {
            return 'development';
        }
        
        return null;
    }
    
    /**
     * Détection via indicateurs de fichiers
     */
    private function detectFromFileIndicators(): ?string
    {
        $basePath = dirname(__DIR__, 4); // Remonter à la racine du projet
        
        // Fichiers indicateurs de développement
        $devFiles = ['.env.local', 'composer.json', '.git', 'webpack.dev.js', 'gulpfile.js'];
        foreach ($devFiles as $file) {
            if (file_exists($basePath . '/' . $file)) {
                return 'development';
            }
        }
        
        // Fichiers indicateurs de staging
        $stagingFiles = ['.env.staging', 'staging.flag'];
        foreach ($stagingFiles as $file) {
            if (file_exists($basePath . '/' . $file)) {
                return 'staging';
            }
        }
        
        // Fichiers indicateurs de production
        $prodFiles = ['.env.production', 'production.flag'];
        foreach ($prodFiles as $file) {
            if (file_exists($basePath . '/' . $file)) {
                return 'production';
            }
        }
        
        return null;
    }
    
    /**
     * Détection via indicateurs réseau
     */
    private function detectFromNetworkIndicators(): ?string
    {
        $remoteAddr = $_SERVER['REMOTE_ADDR'] ?? '';
        
        // Adresses locales = développement
        if (in_array($remoteAddr, ['127.0.0.1', '::1']) || 
            preg_match('/^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[01])\./', $remoteAddr)) {
            return 'development';
        }
        
        return null;
    }
    
    /**
     * Charge la configuration selon l'environnement détecté
     */
    private function loadConfiguration(): void
    {
        // Charger le preset de base
        $baseConfig = $this->environmentPresets[$this->environment] ?? $this->environmentPresets['production'];
        
        // Charger la configuration depuis le cache si disponible
        $cachedConfig = $this->loadConfigFromCache();
        
        // Fusionner les configurations
        $this->loggerConfig = array_merge($baseConfig, $cachedConfig);
        
        // Appliquer les overrides depuis la configuration globale
        $this->applyConfigOverrides();
        
        // Détecter le type d'application et appliquer le preset
        $this->applyApplicationPreset();
        
        // Ajuster selon les métriques de performance si disponibles
        $this->adjustForPerformance();
        
        $this->logConfigEvent('configuration_loaded', [
            'environment' => $this->environment,
            'config' => $this->loggerConfig
        ]);
    }
    
    /**
     * Charge la configuration depuis le cache
     */
    private function loadConfigFromCache(): array
    {
        if (!file_exists($this->configCacheFile)) {
            return [];
        }
        
        $content = file_get_contents($this->configCacheFile);
        if (!$content) {
            return [];
        }
        
        $data = json_decode($content, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }
        
        // Vérifier si le cache n'est pas trop ancien (1 heure)
        if (isset($data['timestamp']) && time() - $data['timestamp'] > 3600) {
            return [];
        }
        
        return $data['config'] ?? [];
    }
    
    /**
     * Sauvegarde la configuration dans le cache
     */
    private function saveConfigToCache(): void
    {
        $data = [
            'timestamp' => time(),
            'environment' => $this->environment,
            'config' => $this->loggerConfig
        ];
        
        file_put_contents($this->configCacheFile, json_encode($data, JSON_PRETTY_PRINT), LOCK_EX);
    }
    
    /**
     * Applique les overrides depuis la configuration globale
     */
    private function applyConfigOverrides(): void
    {
        $overrides = [
            'LOG_LEVEL' => 'log_level',
            'LOG_BUFFER_SIZE' => 'buffer_size',
            'LOG_FLUSH_INTERVAL' => 'flush_interval',
            'LOG_COMPRESSION' => 'compression_enabled',
            'LOG_DEDUPLICATION' => 'deduplication_enabled',
            'LOG_MAX_FILE_SIZE' => 'max_file_size',
            'LOG_ROTATION_DAYS' => 'rotation_days'
        ];
        
        foreach ($overrides as $configKey => $loggerKey) {
            $value = $this->config->get($configKey);
            if ($value !== null) {
                $this->loggerConfig[$loggerKey] = $this->convertConfigValue($value, $loggerKey);
            }
        }
    }
    
    /**
     * Convertit une valeur de configuration au bon type
     */
    private function convertConfigValue($value, string $key): mixed
    {
        switch ($key) {
            case 'buffer_size':
            case 'flush_interval':
            case 'rotation_days':
                return (int) $value;
                
            case 'compression_enabled':
            case 'deduplication_enabled':
            case 'enable_live_stream':
                return filter_var($value, FILTER_VALIDATE_BOOLEAN);
                
            case 'log_level':
                return strtolower((string) $value);
                
            default:
                return $value;
        }
    }
    
    /**
     * Applique un preset selon le type d'application détecté
     */
    private function applyApplicationPreset(): void
    {
        $appType = $this->detectApplicationType();
        
        if (isset($this->applicationPresets[$appType])) {
            $preset = $this->applicationPresets[$appType];
            $this->loggerConfig = array_merge($this->loggerConfig, $preset);
            
            $this->logConfigEvent('application_preset_applied', [
                'application_type' => $appType,
                'preset' => $preset
            ]);
        }
    }
    
    /**
     * Détecte le type d'application
     */
    private function detectApplicationType(): string
    {
        // Vérifier si c'est une API
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
        
        if (strpos($requestUri, '/api/') !== false || 
            strpos($contentType, 'application/json') !== false) {
            return 'api_service';
        }
        
        // Vérifier si c'est du batch processing (CLI)
        if (php_sapi_name() === 'cli') {
            return 'batch_processing';
        }
        
        // Vérifier les headers de microservice
        if (isset($_SERVER['HTTP_X_SERVICE_NAME']) || isset($_SERVER['HTTP_X_TRACE_ID'])) {
            return 'microservice';
        }
        
        // Par défaut, application web
        return 'web_application';
    }
    
    /**
     * Ajuste la configuration selon les métriques de performance
     */
    private function adjustForPerformance(): void
    {
        // Charger les métriques depuis les logs ou cache
        $this->loadPerformanceMetrics();
        
        // Ajuster le buffer selon le volume de logs
        if ($this->performanceMetrics['log_volume_per_hour'] > 10000) {
            $this->loggerConfig['buffer_size'] = min(200, $this->loggerConfig['buffer_size'] * 2);
            $this->loggerConfig['flush_interval'] = min(60, $this->loggerConfig['flush_interval'] * 1.5);
        }
        
        // Réduire les logs de debug si trop d'erreurs
        if ($this->performanceMetrics['error_rate'] > 5) {
            if ($this->loggerConfig['log_level'] === 'debug') {
                $this->loggerConfig['log_level'] = 'info';
            }
        }
        
        // Ajuster la compression selon l'usage disque
        if ($this->performanceMetrics['disk_usage_growth'] > 1000) { // MB/jour
            $this->loggerConfig['compression_enabled'] = true;
            $this->loggerConfig['rotation_days'] = max(7, $this->loggerConfig['rotation_days'] / 2);
        }
    }
    
    /**
     * Charge les métriques de performance
     */
    private function loadPerformanceMetrics(): void
    {
        // Simuler le chargement de métriques
        // En production, ceci viendrait d'une base de données ou d'un système de monitoring
        
        $metricsFile = dirname($this->configCacheFile) . '/.performance_metrics.json';
        
        if (file_exists($metricsFile)) {
            $content = file_get_contents($metricsFile);
            if ($content) {
                $data = json_decode($content, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $this->performanceMetrics = array_merge($this->performanceMetrics, $data);
                }
            }
        }
    }
    
    /**
     * Met à jour les métriques de performance
     */
    public function updatePerformanceMetrics(array $metrics): void
    {
        $this->performanceMetrics = array_merge($this->performanceMetrics, $metrics);
        
        $metricsFile = dirname($this->configCacheFile) . '/.performance_metrics.json';
        file_put_contents($metricsFile, json_encode($this->performanceMetrics, JSON_PRETTY_PRINT), LOCK_EX);
        
        // Vérifier si une reconfiguration est nécessaire
        $this->checkForReconfiguration();
    }
    
    /**
     * Vérifie si une reconfiguration automatique est nécessaire
     */
    private function checkForReconfiguration(): void
    {
        $needsReconfiguration = false;
        $reasons = [];
        
        // Vérifier les seuils critiques
        if ($this->performanceMetrics['error_rate'] > 10) {
            $needsReconfiguration = true;
            $reasons[] = 'high_error_rate';
        }
        
        if ($this->performanceMetrics['avg_log_processing_time'] > 100) { // ms
            $needsReconfiguration = true;
            $reasons[] = 'slow_log_processing';
        }
        
        if ($this->performanceMetrics['disk_usage_growth'] > 2000) { // MB/jour
            $needsReconfiguration = true;
            $reasons[] = 'high_disk_usage';
        }
        
        if ($needsReconfiguration) {
            $this->triggerAutomaticReconfiguration($reasons);
        }
    }
    
    /**
     * Déclenche une reconfiguration automatique
     */
    private function triggerAutomaticReconfiguration(array $reasons): void
    {
        $this->logConfigEvent('automatic_reconfiguration_triggered', [
            'reasons' => $reasons,
            'old_config' => $this->loggerConfig
        ]);
        
        // Recharger la configuration avec les nouvelles métriques
        $this->adjustForPerformance();
        
        // Sauvegarder la nouvelle configuration
        $this->saveConfigToCache();
        
        $this->logConfigEvent('automatic_reconfiguration_completed', [
            'new_config' => $this->loggerConfig
        ]);
    }
    
    /**
     * Recharge la configuration à chaud
     */
    public function reloadConfiguration(): void
    {
        $this->logConfigEvent('hot_reload_triggered');
        
        $oldConfig = $this->loggerConfig;
        $this->loadConfiguration();
        
        $this->logConfigEvent('hot_reload_completed', [
            'old_config' => $oldConfig,
            'new_config' => $this->loggerConfig,
            'changes' => $this->getConfigDifferences($oldConfig, $this->loggerConfig)
        ]);
    }
    
    /**
     * Compare deux configurations et retourne les différences
     */
    private function getConfigDifferences(array $old, array $new): array
    {
        $differences = [];
        
        $allKeys = array_unique(array_merge(array_keys($old), array_keys($new)));
        
        foreach ($allKeys as $key) {
            $oldValue = $old[$key] ?? null;
            $newValue = $new[$key] ?? null;
            
            if ($oldValue !== $newValue) {
                $differences[$key] = [
                    'old' => $oldValue,
                    'new' => $newValue
                ];
            }
        }
        
        return $differences;
    }
    
    /**
     * Retourne la configuration actuelle
     */
    public function getConfiguration(): array
    {
        return $this->loggerConfig;
    }
    
    /**
     * Retourne l'environnement détecté
     */
    public function getEnvironment(): string
    {
        return $this->environment;
    }
    
    /**
     * Retourne une valeur de configuration spécifique
     */
    public function get(string $key, $default = null)
    {
        return $this->loggerConfig[$key] ?? $default;
    }
    
    /**
     * Met à jour une valeur de configuration
     */
    public function set(string $key, $value): void
    {
        $oldValue = $this->loggerConfig[$key] ?? null;
        $this->loggerConfig[$key] = $value;
        
        $this->logConfigEvent('configuration_updated', [
            'key' => $key,
            'old_value' => $oldValue,
            'new_value' => $value
        ]);
        
        $this->saveConfigToCache();
    }
    
    /**
     * Retourne les présets disponibles
     */
    public function getAvailablePresets(): array
    {
        return [
            'environments' => array_keys($this->environmentPresets),
            'applications' => array_keys($this->applicationPresets)
        ];
    }
    
    /**
     * Applique un preset spécifique
     */
    public function applyPreset(string $type, string $name): bool
    {
        $presets = $type === 'environment' ? $this->environmentPresets : $this->applicationPresets;
        
        if (!isset($presets[$name])) {
            return false;
        }
        
        $oldConfig = $this->loggerConfig;
        $this->loggerConfig = array_merge($this->loggerConfig, $presets[$name]);
        
        $this->logConfigEvent('preset_applied', [
            'type' => $type,
            'name' => $name,
            'changes' => $this->getConfigDifferences($oldConfig, $this->loggerConfig)
        ]);
        
        $this->saveConfigToCache();
        return true;
    }
    
    /**
     * Retourne les métriques de performance actuelles
     */
    public function getPerformanceMetrics(): array
    {
        return $this->performanceMetrics;
    }
    
    /**
     * Vérifie périodiquement les performances
     */
    public function performPerformanceCheck(): void
    {
        $currentTime = microtime(true);
        
        if ($currentTime - $this->lastPerformanceCheck >= $this->performanceCheckInterval) {
            $this->loadPerformanceMetrics();
            $this->checkForReconfiguration();
            $this->lastPerformanceCheck = $currentTime;
        }
    }
    
    /**
     * Log un événement de configuration
     */
    private function logConfigEvent(string $event, array $context = []): void
    {
        if (!$this->logger) {
            return;
        }
        
        $this->logger->info("CONFIG: {$event}", array_merge($context, [
            'environment' => $this->environment,
            'config_manager' => true
        ]));
    }
    
    /**
     * Exporte la configuration actuelle
     */
    public function exportConfiguration(): array
    {
        return [
            'timestamp' => time(),
            'environment' => $this->environment,
            'configuration' => $this->loggerConfig,
            'performance_metrics' => $this->performanceMetrics,
            'presets_available' => $this->getAvailablePresets()
        ];
    }
    
    /**
     * Valide une configuration
     */
    public function validateConfiguration(array $config): array
    {
        $errors = [];
        
        // Vérifier les valeurs requises
        $required = ['log_level', 'buffer_size', 'flush_interval'];
        foreach ($required as $key) {
            if (!isset($config[$key])) {
                $errors[] = "Missing required configuration: {$key}";
            }
        }
        
        // Vérifier les types et valeurs
        if (isset($config['log_level']) && 
            !in_array($config['log_level'], ['debug', 'info', 'warning', 'error', 'critical'])) {
            $errors[] = "Invalid log_level: must be debug, info, warning, error, or critical";
        }
        
        if (isset($config['buffer_size']) && 
            (!is_int($config['buffer_size']) || $config['buffer_size'] < 1 || $config['buffer_size'] > 1000)) {
            $errors[] = "Invalid buffer_size: must be integer between 1 and 1000";
        }
        
        if (isset($config['flush_interval']) && 
            (!is_int($config['flush_interval']) || $config['flush_interval'] < 1 || $config['flush_interval'] > 300)) {
            $errors[] = "Invalid flush_interval: must be integer between 1 and 300 seconds";
        }
        
        return $errors;
    }
}