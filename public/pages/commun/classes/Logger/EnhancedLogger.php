<?php
namespace Commun\Logger;

/**
 * EnhancedLogger - Version enrichie du BufferedLogger avec métadonnées automatiques
 * 
 * Améliorations:
 * - Mesure automatique du temps d'exécution des requêtes
 * - Détection du type de requête (AJAX, API, page normale)
 * - Enrichissement automatique du contexte
 * - Métriques de performance intégrées
 */
class EnhancedLogger extends BufferedLogger
{
    /** @var float Timestamp de début de la requête */
    private float $requestStartTime;
    
    /** @var array Métriques de performance */
    private array $performanceMetrics = [];
    
    /** @var string Type de requête détecté */
    private string $requestType = 'unknown';
    
    /** @var array Compteurs de logs par niveau */
    private array $logCounters = [];
    
    /** @var array Dernières mesures de temps */
    private array $timingMeasures = [];
    
    /** @var int Nombre maximum de mesures en mémoire */
    private int $maxTimingMeasures = 100;

    public function __construct(string $loggerName, string $logDir)
    {
        // Initialiser le temps de début
        $this->requestStartTime = $_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true);
        
        // Détecter le type de requête
        $this->detectRequestType();
        
        // Initialiser les compteurs
        $this->initializeCounters();
        
        // Appeler le constructeur parent
        parent::__construct($loggerName, $logDir);
    }

    /**
     * Détecte le type de requête en cours
     */
    private function detectRequestType(): void
    {
        // Vérifier si c'est une requête CLI
        if (php_sapi_name() === 'cli') {
            $this->requestType = 'cli';
            return;
        }
        
        // Vérifier les headers pour AJAX
        if (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && 
            strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
            $this->requestType = 'ajax';
            return;
        }
        
        // Vérifier si c'est une API (basé sur l'URL ou l'Accept header)
        $requestUri = $_SERVER['REQUEST_URI'] ?? '';
        $acceptHeader = $_SERVER['HTTP_ACCEPT'] ?? '';
        
        if (strpos($requestUri, '/api/') !== false || 
            strpos($acceptHeader, 'application/json') !== false) {
            $this->requestType = 'api';
            return;
        }
        
        // Vérifier si c'est un appel REST
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        if (in_array($method, ['PUT', 'DELETE', 'PATCH']) || 
            ($method === 'POST' && strpos($acceptHeader, 'application/json') !== false)) {
            $this->requestType = 'rest';
            return;
        }
        
        // Vérifier si c'est une soumission de formulaire
        if ($method === 'POST' && strpos($acceptHeader, 'text/html') !== false) {
            $this->requestType = 'form';
            return;
        }
        
        // Par défaut, c'est une page web normale
        $this->requestType = 'web';
    }
    
    /**
     * Initialise les compteurs de logs
     */
    private function initializeCounters(): void
    {
        $levels = ['debug', 'info', 'warning', 'error', 'critical'];
        foreach ($levels as $level) {
            $this->logCounters[$level] = 0;
        }
    }
    
    /**
     * Enrichit automatiquement le contexte avec des métadonnées
     */
    protected function enrichContext(array $context): array
    {
        // Appeler l'enrichissement parent d'abord
        $context = parent::enrichContext($context);
        
        // Ajouter les métadonnées de performance
        $context['performance'] = $this->getPerformanceMetrics();
        
        // Ajouter le type de requête
        $context['request_type'] = $this->requestType;
        
        // Ajouter les informations de mémoire
        $context['memory'] = $this->getMemoryInfo();
        
        // Ajouter les statistiques de logs de cette requête
        $context['log_stats'] = $this->getLogStats();
        
        return $context;
    }
    
    /**
     * Récupère les métriques de performance actuelles
     */
    private function getPerformanceMetrics(): array
    {
        $currentTime = microtime(true);
        $executionTime = $currentTime - $this->requestStartTime;
        
        return [
            'execution_time_ms' => round($executionTime * 1000, 2),
            'execution_time_s' => round($executionTime, 3),
            'start_time' => $this->requestStartTime,
            'current_time' => $currentTime,
            'peak_memory_mb' => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
            'current_memory_mb' => round(memory_get_usage(true) / 1024 / 1024, 2)
        ];
    }
    
    /**
     * Récupère les informations mémoire détaillées
     */
    private function getMemoryInfo(): array
    {
        return [
            'current_usage' => memory_get_usage(false),
            'current_usage_real' => memory_get_usage(true),
            'peak_usage' => memory_get_peak_usage(false),
            'peak_usage_real' => memory_get_peak_usage(true),
            'memory_limit' => ini_get('memory_limit')
        ];
    }
    
    /**
     * Récupère les statistiques de logs de cette requête
     */
    private function getLogStats(): array
    {
        $total = array_sum($this->logCounters);
        
        return [
            'total_logs' => $total,
            'by_level' => $this->logCounters,
            'error_ratio' => $total > 0 ? round(($this->logCounters['error'] + $this->logCounters['critical']) / $total * 100, 2) : 0
        ];
    }
    
    /**
     * Log avec enrichissement automatique et mesures de performance
     */
    public function log($level, string $message, array $context = []): void
    {
        // Mesurer le temps de début du log
        $startTime = microtime(true);
        
        // Incrémenter le compteur pour ce niveau
        $levelString = strtolower((string) $level);
        if (isset($this->logCounters[$levelString])) {
            $this->logCounters[$levelString]++;
        }
        
        // Ajouter des métadonnées spécifiques au niveau
        $context = $this->addLevelSpecificContext($level, $context);
        
        // Appeler le log parent
        parent::log($level, $message, $context);
        
        // Mesurer le temps d'exécution du log
        $logTime = microtime(true) - $startTime;
        $this->addTimingMeasure('log_execution', $logTime);
    }
    
    /**
     * Ajoute du contexte spécifique selon le niveau de log
     */
    private function addLevelSpecificContext($level, array $context): array
    {
        $levelString = strtolower((string) $level);
        
        switch ($levelString) {
            case 'error':
            case 'critical':
                // Pour les erreurs, ajouter plus de contexte de débogage
                $context['debug_info'] = [
                    'php_version' => PHP_VERSION,
                    'sapi' => php_sapi_name(),
                    'request_method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
                    'request_uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
                    'script_name' => $_SERVER['SCRIPT_NAME'] ?? 'unknown'
                ];
                break;
                
            case 'warning':
                // Pour les warnings, ajouter des infos sur la performance
                $context['performance_warning'] = $this->checkPerformanceIssues();
                break;
        }
        
        return $context;
    }
    
    /**
     * Vérifie s'il y a des problèmes de performance
     */
    private function checkPerformanceIssues(): array
    {
        $issues = [];
        $metrics = $this->getPerformanceMetrics();
        
        // Vérifier le temps d'exécution
        if ($metrics['execution_time_ms'] > 5000) {
            $issues[] = 'slow_execution';
        }
        
        // Vérifier l'utilisation mémoire
        if ($metrics['current_memory_mb'] > 128) {
            $issues[] = 'high_memory_usage';
        }
        
        // Vérifier le ratio d'erreurs
        $logStats = $this->getLogStats();
        if ($logStats['error_ratio'] > 10) {
            $issues[] = 'high_error_ratio';
        }
        
        return $issues;
    }
    
    /**
     * Ajoute une mesure de timing
     */
    public function addTimingMeasure(string $operation, float $duration): void
    {
        $this->timingMeasures[] = [
            'operation' => $operation,
            'duration_ms' => round($duration * 1000, 3),
            'timestamp' => microtime(true)
        ];
        
        // Limiter le nombre de mesures en mémoire
        if (count($this->timingMeasures) > $this->maxTimingMeasures) {
            array_shift($this->timingMeasures);
        }
    }
    
    /**
     * Mesure le temps d'exécution d'une fonction
     */
    public function measureOperation(string $operationName, callable $operation)
    {
        $startTime = microtime(true);
        
        try {
            $result = $operation();
            $duration = microtime(true) - $startTime;
            
            $this->addTimingMeasure($operationName, $duration);
            $this->debug("Operation completed", [
                'operation' => $operationName,
                'duration_ms' => round($duration * 1000, 3),
                'status' => 'success'
            ]);
            
            return $result;
        } catch (\Throwable $e) {
            $duration = microtime(true) - $startTime;
            
            $this->addTimingMeasure($operationName . '_failed', $duration);
            $this->error("Operation failed", [
                'operation' => $operationName,
                'duration_ms' => round($duration * 1000, 3),
                'error' => $e->getMessage(),
                'status' => 'failed'
            ]);
            
            throw $e;
        }
    }
    
    /**
     * Log de début de requête avec contexte initial
     */
    public function logRequestStart(): void
    {
        $this->info("Request started", [
            'request_type' => $this->requestType,
            'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
            'uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown',
            'start_memory_mb' => round(memory_get_usage(true) / 1024 / 1024, 2)
        ]);
    }
    
    /**
     * Log de fin de requête avec métriques finales
     */
    public function logRequestEnd(): void
    {
        $metrics = $this->getPerformanceMetrics();
        $logStats = $this->getLogStats();
        
        $this->info("Request completed", [
            'request_type' => $this->requestType,
            'execution_time_ms' => $metrics['execution_time_ms'],
            'peak_memory_mb' => $metrics['peak_memory_mb'],
            'total_logs' => $logStats['total_logs'],
            'error_ratio' => $logStats['error_ratio'],
            'timing_measures_count' => count($this->timingMeasures)
        ]);
    }
    
    /**
     * Retourne toutes les mesures de timing
     */
    public function getTimingMeasures(): array
    {
        return $this->timingMeasures;
    }
    
    /**
     * Retourne les statistiques détaillées de la requête
     */
    public function getRequestStats(): array
    {
        return [
            'request_type' => $this->requestType,
            'performance' => $this->getPerformanceMetrics(),
            'memory' => $this->getMemoryInfo(),
            'log_stats' => $this->getLogStats(),
            'timing_measures' => $this->timingMeasures,
            'performance_issues' => $this->checkPerformanceIssues()
        ];
    }
    
    /**
     * Retourne le type de requête détecté
     */
    public function getRequestType(): string
    {
        return $this->requestType;
    }
    
    /**
     * Retourne le temps d'exécution depuis le début de la requête
     */
    public function getExecutionTime(): float
    {
        return microtime(true) - $this->requestStartTime;
    }
}