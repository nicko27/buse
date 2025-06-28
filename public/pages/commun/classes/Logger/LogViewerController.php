<?php
namespace Commun\Logger;

/**
 * LogViewerController - Contrôleur pour l'interface web de visualisation des logs
 * 
 * Fonctionnalités:
 * - Dashboard avec widgets configurables
 * - Live feed des logs en temps réel via Server-Sent Events
 * - Filtrage par niveau de log
 * - Mode sombre/clair
 * - Recherche dans l'historique
 * - Interface responsive
 */
class LogViewerController
{
    /** @var string Répertoire des logs */
    private string $logDir;
    
    /** @var array Configuration de l'interface */
    private array $config;
    
    /** @var DeduplicatedLogger Instance du logger pour les métriques */
    private ?DeduplicatedLogger $logger = null;
    
    /** @var array Niveaux de log supportés */
    private array $logLevels = ['debug', 'info', 'warning', 'error', 'critical'];
    
    /** @var int Nombre maximum de lignes à charger par défaut */
    private int $defaultLimit = 500;
    
    /** @var array Cache des fichiers de log */
    private array $logFilesCache = [];

    public function __construct(string $logDir, array $config = [])
    {
        $this->logDir = rtrim($logDir, '/');
        $this->config = array_merge($this->getDefaultConfig(), $config);
        
        // Vérifier que le répertoire existe
        if (!is_dir($this->logDir)) {
            throw new \InvalidArgumentException("Log directory does not exist: {$this->logDir}");
        }
    }
    
    /**
     * Configuration par défaut de l'interface
     */
    private function getDefaultConfig(): array
    {
        return [
            'title' => 'Log Viewer',
            'theme' => 'auto', // auto, light, dark
            'auto_refresh' => true,
            'refresh_interval' => 5000, // ms
            'max_lines_display' => 1000,
            'enable_search' => true,
            'enable_download' => true,
            'datetime_format' => 'Y-m-d H:i:s',
            'timezone' => 'Europe/Paris'
        ];
    }
    
    /**
     * Définit l'instance du logger pour les métriques
     */
    public function setLogger(DeduplicatedLogger $logger): void
    {
        $this->logger = $logger;
    }
    
    /**
     * Route principale - Affiche le dashboard
     */
    public function dashboard(): void
    {
        $stats = $this->getLogStats();
        $recentLogs = $this->getRecentLogs(50);
        
        $this->renderTemplate('dashboard', [
            'stats' => $stats,
            'recent_logs' => $recentLogs,
            'config' => $this->config,
            'log_levels' => $this->logLevels
        ]);
    }
    
    /**
     * Route API - Récupère les logs avec filtres
     */
    public function apiGetLogs(): void
    {
        header('Content-Type: application/json');
        
        $filters = $this->getFiltersFromRequest();
        $logs = $this->getFilteredLogs($filters);
        
        echo json_encode([
            'success' => true,
            'data' => $logs,
            'filters_applied' => $filters,
            'timestamp' => time()
        ]);
    }
    
    /**
     * Route SSE - Stream des logs en temps réel
     */
    public function streamLogs(): void
    {
        header('Content-Type: text/event-stream');
        header('Cache-Control: no-cache');
        header('Connection: keep-alive');
        
        // Obtenir la position de départ
        $lastPosition = $_GET['lastPosition'] ?? 0;
        $level = $_GET['level'] ?? 'all';
        
        // Configuration SSE
        $maxDuration = 300; // 5 minutes max
        $startTime = time();
        
        while (time() - $startTime < $maxDuration) {
            $newLogs = $this->getNewLogs($lastPosition, $level);
            
            if (!empty($newLogs)) {
                foreach ($newLogs as $log) {
                    echo "data: " . json_encode($log) . "\n\n";
                    $lastPosition = max($lastPosition, $log['position'] ?? 0);
                }
                
                // Envoyer la nouvelle position
                echo "event: position\n";
                echo "data: {\"position\": $lastPosition}\n\n";
                
                ob_flush();
                flush();
            }
            
            // Vérifier si le client est toujours connecté
            if (connection_aborted()) {
                break;
            }
            
            sleep(1);
        }
    }
    
    /**
     * Route API - Recherche dans les logs
     */
    public function apiSearch(): void
    {
        header('Content-Type: application/json');
        
        $query = $_GET['q'] ?? '';
        $level = $_GET['level'] ?? 'all';
        $limit = min((int)($_GET['limit'] ?? 100), 1000);
        
        if (empty($query)) {
            echo json_encode(['success' => false, 'error' => 'Query parameter required']);
            return;
        }
        
        $results = $this->searchLogs($query, $level, $limit);
        
        echo json_encode([
            'success' => true,
            'query' => $query,
            'results' => $results,
            'count' => count($results)
        ]);
    }
    
    /**
     * Route API - Statistiques en temps réel
     */
    public function apiStats(): void
    {
        header('Content-Type: application/json');
        
        $stats = $this->getLogStats();
        $deduplicationStats = null;
        
        if ($this->logger) {
            $deduplicationStats = $this->logger->getDeduplicationStats();
        }
        
        echo json_encode([
            'success' => true,
            'stats' => $stats,
            'deduplication' => $deduplicationStats,
            'timestamp' => time()
        ]);
    }
    
    /**
     * Route - Téléchargement de logs
     */
    public function downloadLogs(): void
    {
        if (!$this->config['enable_download']) {
            http_response_code(403);
            echo 'Download disabled';
            return;
        }
        
        $date = $_GET['date'] ?? date('Y-m-d');
        $level = $_GET['level'] ?? 'all';
        $format = $_GET['format'] ?? 'txt';
        
        $filename = "logs-{$date}-{$level}.{$format}";
        $logs = $this->getLogsForDate($date, $level);
        
        header('Content-Type: application/octet-stream');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        
        if ($format === 'json') {
            echo json_encode($logs, JSON_PRETTY_PRINT);
        } else {
            foreach ($logs as $log) {
                echo $log['raw_line'] . "\n";
            }
        }
    }
    
    /**
     * Récupère les statistiques des logs
     */
    private function getLogStats(): array
    {
        $stats = [
            'total_files' => 0,
            'total_size_mb' => 0,
            'by_level' => array_fill_keys($this->logLevels, 0),
            'by_date' => [],
            'last_activity' => null
        ];
        
        $logFiles = $this->getLogFiles();
        $stats['total_files'] = count($logFiles);
        
        foreach ($logFiles as $file) {
            $stats['total_size_mb'] += round(filesize($file) / 1024 / 1024, 2);
            
            // Analyser les derniers logs pour les statistiques
            $recentLogs = $this->parseLogFile($file, 100);
            
            foreach ($recentLogs as $log) {
                if (isset($stats['by_level'][$log['level']])) {
                    $stats['by_level'][$log['level']]++;
                }
                
                $date = date('Y-m-d', strtotime($log['datetime']));
                $stats['by_date'][$date] = ($stats['by_date'][$date] ?? 0) + 1;
                
                if (!$stats['last_activity'] || strtotime($log['datetime']) > strtotime($stats['last_activity'])) {
                    $stats['last_activity'] = $log['datetime'];
                }
            }
        }
        
        // Garder seulement les 30 derniers jours
        $stats['by_date'] = array_slice($stats['by_date'], -30, null, true);
        
        return $stats;
    }
    
    /**
     * Récupère les logs récents
     */
    private function getRecentLogs(int $limit = 100): array
    {
        $logFile = $this->getMostRecentLogFile();
        if (!$logFile) {
            return [];
        }
        
        return $this->parseLogFile($logFile, $limit, true);
    }
    
    /**
     * Récupère les nouveaux logs depuis une position
     */
    private function getNewLogs(int $lastPosition, string $level = 'all'): array
    {
        $logFile = $this->getMostRecentLogFile();
        if (!$logFile) {
            return [];
        }
        
        $newLogs = [];
        $handle = fopen($logFile, 'r');
        
        if ($handle) {
            fseek($handle, $lastPosition);
            $currentPosition = $lastPosition;
            
            while (($line = fgets($handle)) !== false) {
                $log = $this->parseLogLine($line);
                if ($log && ($level === 'all' || $log['level'] === $level)) {
                    $log['position'] = $currentPosition;
                    $newLogs[] = $log;
                }
                $currentPosition = ftell($handle);
            }
            
            fclose($handle);
        }
        
        return $newLogs;
    }
    
    /**
     * Recherche dans les logs
     */
    private function searchLogs(string $query, string $level = 'all', int $limit = 100): array
    {
        $results = [];
        $logFiles = $this->getLogFiles();
        
        foreach ($logFiles as $file) {
            $logs = $this->parseLogFile($file);
            
            foreach ($logs as $log) {
                if (count($results) >= $limit) {
                    break 2;
                }
                
                if ($level !== 'all' && $log['level'] !== $level) {
                    continue;
                }
                
                if (stripos($log['message'], $query) !== false) {
                    $log['file'] = basename($file);
                    $results[] = $log;
                }
            }
        }
        
        return array_reverse($results); // Plus récents en premier
    }
    
    /**
     * Récupère les filtres depuis la requête
     */
    private function getFiltersFromRequest(): array
    {
        return [
            'level' => $_GET['level'] ?? 'all',
            'date' => $_GET['date'] ?? date('Y-m-d'),
            'limit' => min((int)($_GET['limit'] ?? $this->defaultLimit), $this->config['max_lines_display']),
            'search' => $_GET['search'] ?? ''
        ];
    }
    
    /**
     * Récupère les logs filtrés
     */
    private function getFilteredLogs(array $filters): array
    {
        $logs = [];
        
        if ($filters['date'] === date('Y-m-d')) {
            // Logs du jour - fichier actuel
            $logFile = $this->getMostRecentLogFile();
            if ($logFile) {
                $logs = $this->parseLogFile($logFile, $filters['limit'], true);
            }
        } else {
            // Logs d'une date spécifique
            $logs = $this->getLogsForDate($filters['date'], $filters['level']);
        }
        
        // Appliquer les filtres
        $filteredLogs = [];
        foreach ($logs as $log) {
            if ($filters['level'] !== 'all' && $log['level'] !== $filters['level']) {
                continue;
            }
            
            if (!empty($filters['search']) && stripos($log['message'], $filters['search']) === false) {
                continue;
            }
            
            $filteredLogs[] = $log;
        }
        
        return array_slice($filteredLogs, 0, $filters['limit']);
    }
    
    /**
     * Récupère les logs pour une date spécifique
     */
    private function getLogsForDate(string $date, string $level = 'all'): array
    {
        $logs = [];
        $logFiles = $this->getLogFiles();
        
        foreach ($logFiles as $file) {
            if (strpos(basename($file), $date) !== false) {
                $fileLogs = $this->parseLogFile($file);
                $logs = array_merge($logs, $fileLogs);
            }
        }
        
        return $logs;
    }
    
    /**
     * Récupère la liste des fichiers de log
     */
    private function getLogFiles(): array
    {
        if (empty($this->logFilesCache)) {
            $pattern = $this->logDir . '/error*.log';
            $files = glob($pattern);
            
            // Trier par date de modification (plus récent en premier)
            usort($files, function($a, $b) {
                return filemtime($b) - filemtime($a);
            });
            
            $this->logFilesCache = $files;
        }
        
        return $this->logFilesCache;
    }
    
    /**
     * Récupère le fichier de log le plus récent
     */
    private function getMostRecentLogFile(): ?string
    {
        $files = $this->getLogFiles();
        return $files[0] ?? null;
    }
    
    /**
     * Parse un fichier de log
     */
    private function parseLogFile(string $file, int $limit = 0, bool $reverse = false): array
    {
        $logs = [];
        
        if (!file_exists($file)) {
            return $logs;
        }
        
        $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        if ($reverse) {
            $lines = array_reverse($lines);
        }
        
        $count = 0;
        foreach ($lines as $line) {
            if ($limit > 0 && $count >= $limit) {
                break;
            }
            
            $log = $this->parseLogLine($line);
            if ($log) {
                $logs[] = $log;
                $count++;
            }
        }
        
        return $logs;
    }
    
    /**
     * Parse une ligne de log
     */
    private function parseLogLine(string $line): ?array
    {
        // Pattern pour les logs Monolog : "2025-01-01 12:00:00 - ERROR: Message"
        $pattern = '/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (\w+): (.+)$/';
        
        if (preg_match($pattern, $line, $matches)) {
            return [
                'datetime' => $matches[1],
                'level' => strtolower($matches[2]),
                'message' => $matches[3],
                'raw_line' => $line,
                'timestamp' => strtotime($matches[1])
            ];
        }
        
        return null;
    }
    
    /**
     * Rend un template HTML
     */
    private function renderTemplate(string $template, array $data = []): void
    {
        extract($data);
        
        // Template inline pour simplicité (pourrait être un fichier séparé)
        if ($template === 'dashboard') {
            include __DIR__ . '/templates/dashboard.php';
        }
    }
}