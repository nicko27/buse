<?php
/**
 * 050-logger.php
 * Initialisation du système de logging
 */

use Commun\Logger\Logger;

$loggerInitialized = false;
$loggerError = null;

try {
    // Configuration du logger
    $loggerName = $config->get('LOGGER_NAME', $config->get('SITE', 'app'));
    $logDir = $config->get('LOG_DIR', dirname(__DIR__, 3) . '/logs');
    
    // Vérification/création du répertoire de logs
    if (!is_dir($logDir)) {
        if (!mkdir($logDir, 0755, true)) {
            throw new \Exception("Impossible de créer le répertoire de logs : $logDir");
        }
    }
    
    // Vérification des permissions d'écriture
    if (!is_writable($logDir)) {
        throw new \Exception("Répertoire de logs non accessible en écriture : $logDir");
    }
    
    // Initialisation du logger
    Logger::initWithParams($loggerName, $logDir);
    $logger = Logger::getInstance()->getLogger();
    
    // Test d'écriture
    $logger->info("Logger initialisé avec succès", [
        'logger_name' => $loggerName,
        'log_directory' => $logDir,
        'php_version' => PHP_VERSION,
        'timestamp' => date('Y-m-d H:i:s'),
    ]);
    
    $loggerInitialized = true;

} catch (\Exception $e) {
    $loggerInitialized = false;
    $loggerError = $e->getMessage();
    
    // Fallback : utiliser error_log PHP natif
    error_log("Erreur d'initialisation du logger : " . $loggerError);
    
    // Créer un logger de fallback pour éviter les erreurs fatales
    $logger = new \Psr\Log\NullLogger();
}

// Statistiques du logger
$loggerStats = [
    'initialized' => $loggerInitialized,
    'logger_name' => $loggerName ?? null,
    'log_directory' => $logDir ?? null,
    'directory_writable' => isset($logDir) ? is_writable($logDir) : false,
    'error' => $loggerError,
];

// Log des statistiques collectées précédemment
if ($loggerInitialized && isset($GLOBALS['app_init_stats'])) {
    $logger->info("Statistiques d'initialisation", [
        'config' => $GLOBALS['app_init_stats']['config'] ?? [],
        'database' => $GLOBALS['app_init_stats']['database'] ?? [],
        'logger' => $loggerStats,
    ]);
}

// Ajout des stats du logger
$GLOBALS['app_init_stats']['logger'] = $loggerStats;

// Log spécifique pour les erreurs de BDD si elles existent
if (isset($databaseError) && $databaseError && $loggerInitialized) {
    $logger->error("Erreur de base de données détectée", [
        'error' => $databaseError,
        'database_config' => [
            'host' => $config->get('DB_HOST'),
            'database' => $config->get('DB_NAME'),
            'user' => $config->get('DB_USER'),
            // Ne pas logger le mot de passe
        ],
    ]);
}

// Configuration du niveau de log selon l'environnement
if ($loggerInitialized) {
    $environment = $config->get('ENV', 'production');
    $debugMode = $config->get('DEBUG', '0');
    
    if ($environment === 'dev' || $debugMode === '1') {
        $logger->info("Mode debug activé", [
            'environment' => $environment,
            'debug' => $debugMode,
            'request_uri' => $_SERVER['REQUEST_URI'] ?? 'N/A',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'N/A',
        ]);
    }
}