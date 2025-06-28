<?php
namespace Commun\Logger;

use Monolog\ErrorHandler;
use Monolog\Formatter\LineFormatter;
use Monolog\Handler\ErrorLogHandler;
use Monolog\Handler\RotatingFileHandler;
use Monolog\Handler\BufferHandler;
use Monolog\Level;
use Monolog\Logger as MonologLogger;
use Monolog\LogRecord;

/**
 * BufferedLogger - Version optimisée du Logger avec mise en cache et buffering
 * 
 * Améliorations:
 * - Cache des handlers pour éviter les réinitialisations
 * - Buffering en mémoire avec flush automatique
 * - Compression des anciens logs
 * - Index des logs pour recherches rapides
 */
class BufferedLogger extends Logger
{
    /** @var array Cache des handlers créés */
    private static array $handlersCache = [];
    
    /** @var array Buffer des logs en mémoire */
    private array $logBuffer = [];
    
    /** @var int Taille maximale du buffer avant flush */
    private int $bufferSize = 100;
    
    /** @var int Nombre de logs actuellement en buffer */
    private int $bufferCount = 0;
    
    /** @var float Timestamp du dernier flush */
    private float $lastFlush = 0;
    
    /** @var int Intervalle de flush forcé en secondes */
    private int $flushInterval = 30;
    
    /** @var bool Active/désactive la compression des anciens logs */
    private bool $compressionEnabled = true;
    
    /** @var int Nombre de jours avant compression */
    private int $compressionAfterDays = 7;
    
    /** @var array Index des logs par niveau et timestamp */
    private array $logIndex = [];
    
    /** @var string Fichier d'index pour les recherches */
    private string $indexFile;

    protected function initLogger(): void
    {
        // Créer le logger principal
        $this->logger = new MonologLogger($this->loggerName);
        
        // Initialiser le fichier d'index
        $this->indexFile = $this->logDir . '/logs.index';
        $this->loadLogIndex();
        
        // Créer les handlers avec cache
        $this->setupCachedHandlers();
        
        // Programmer la compression des anciens logs
        $this->scheduleLogCompression();
        
        // Initialiser le timestamp du dernier flush
        $this->lastFlush = microtime(true);
    }
    
    /**
     * Configure les handlers avec système de cache
     */
    private function setupCachedHandlers(): void
    {
        $cacheKey = $this->loggerName . '_' . $this->logDir;
        
        if (!isset(self::$handlersCache[$cacheKey])) {
            // Créer le formatter une seule fois
            $formatter = $this->createOptimizedFormatter();
            
            // Handler de fichier avec buffer
            $fileHandler = $this->createBufferedFileHandler();
            $fileHandler->setFormatter($formatter);
            
            // Handler système (sans buffer pour les erreurs critiques)
            $syslogHandler = new ErrorLogHandler();
            $syslogHandler->setFormatter($formatter);
            
            self::$handlersCache[$cacheKey] = [
                'file' => $fileHandler,
                'syslog' => $syslogHandler
            ];
        }
        
        // Utiliser les handlers du cache
        $handlers = self::$handlersCache[$cacheKey];
        $this->logger->pushHandler($handlers['file']);
        $this->logger->pushHandler($handlers['syslog']);
    }
    
    /**
     * Crée un formatter optimisé
     */
    private function createOptimizedFormatter(): LineFormatter
    {
        $output = "%datetime% - %level_name%: %message%\n";
        $formatter = new LineFormatter($output, "Y-m-d H:i:s", true, true);
        $formatter->ignoreEmptyContextAndExtra(true);
        
        return $formatter;
    }
    
    /**
     * Crée un handler de fichier avec buffer
     */
    private function createBufferedFileHandler(): BufferHandler
    {
        // Handler de base (RotatingFileHandler personnalisé)
        $baseHandler = new class($this->logDir . "/error.log", 31, Level::Debug) extends RotatingFileHandler
        {
            protected function streamWrite($stream, LogRecord $record): void
            {
                if (is_resource($stream)) {
                    $formatted = mb_convert_encoding($record->formatted, 'UTF-8', 'auto');
                    fwrite($stream, (string) $formatted);
                }
            }
        };
        
        // Enrober dans un BufferHandler pour optimiser les écritures
        $bufferedHandler = new BufferHandler(
            $baseHandler,
            $this->bufferSize,
            Level::Debug,
            true, // bubble
            true  // flushOnOverflow
        );
        
        return $bufferedHandler;
    }
    
    /**
     * Log avec buffering intelligent et indexation
     */
    public function log($level, string $message, array $context = []): void
    {
        // Appeler le log parent
        parent::log($level, $message, $context);
        
        // Ajouter à l'index pour recherches rapides
        $this->addToIndex($level, $message, $context);
        
        // Incrémenter le compteur de buffer
        $this->bufferCount++;
        
        // Vérifier si un flush est nécessaire
        $this->checkAndFlush();
    }
    
    /**
     * Ajoute une entrée à l'index des logs
     */
    private function addToIndex($level, string $message, array $context): void
    {
        $timestamp = time();
        $indexEntry = [
            'timestamp' => $timestamp,
            'level' => (string) $level,
            'message_hash' => md5($message),
            'has_context' => !empty($context),
            'date' => date('Y-m-d H:i:s', $timestamp)
        ];
        
        // Garder seulement les 1000 dernières entrées en mémoire
        if (count($this->logIndex) >= 1000) {
            array_shift($this->logIndex);
        }
        
        $this->logIndex[] = $indexEntry;
    }
    
    /**
     * Vérifie si un flush est nécessaire et l'exécute
     */
    private function checkAndFlush(): void
    {
        $currentTime = microtime(true);
        $timeSinceLastFlush = $currentTime - $this->lastFlush;
        
        // Flush si le buffer est plein ou si l'intervalle de temps est dépassé
        if ($this->bufferCount >= $this->bufferSize || $timeSinceLastFlush >= $this->flushInterval) {
            $this->forceFlush();
        }
    }
    
    /**
     * Force le flush du buffer
     */
    public function forceFlush(): void
    {
        // Flush tous les handlers bufferisés
        foreach ($this->logger->getHandlers() as $handler) {
            if ($handler instanceof BufferHandler) {
                $handler->flush();
            }
        }
        
        // Sauvegarder l'index
        $this->saveLogIndex();
        
        // Réinitialiser les compteurs
        $this->bufferCount = 0;
        $this->lastFlush = microtime(true);
    }
    
    /**
     * Charge l'index des logs depuis le fichier
     */
    private function loadLogIndex(): void
    {
        if (file_exists($this->indexFile)) {
            $indexData = file_get_contents($this->indexFile);
            if ($indexData !== false) {
                $decoded = json_decode($indexData, true);
                if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                    $this->logIndex = array_slice($decoded, -1000); // Garder les 1000 derniers
                }
            }
        }
    }
    
    /**
     * Sauvegarde l'index des logs dans le fichier
     */
    private function saveLogIndex(): void
    {
        if (!empty($this->logIndex)) {
            $jsonData = json_encode($this->logIndex, JSON_PRETTY_PRINT);
            file_put_contents($this->indexFile, $jsonData, LOCK_EX);
        }
    }
    
    /**
     * Programme la compression des anciens logs
     */
    private function scheduleLogCompression(): void
    {
        if (!$this->compressionEnabled) {
            return;
        }
        
        // Vérifier s'il faut compresser (une fois par jour maximum)
        $compressionFlagFile = $this->logDir . '/.last_compression';
        $lastCompression = 0;
        
        if (file_exists($compressionFlagFile)) {
            $lastCompression = (int) file_get_contents($compressionFlagFile);
        }
        
        // Si plus de 24h depuis la dernière compression
        if (time() - $lastCompression > 86400) {
            $this->compressOldLogs();
            file_put_contents($compressionFlagFile, time());
        }
    }
    
    /**
     * Compresse les anciens fichiers de log
     */
    private function compressOldLogs(): void
    {
        if (!function_exists('gzopen')) {
            return; // Extension gzip non disponible
        }
        
        $cutoffDate = time() - ($this->compressionAfterDays * 86400);
        $pattern = $this->logDir . '/error-*.log';
        $files = glob($pattern);
        
        foreach ($files as $file) {
            $fileTime = filemtime($file);
            
            if ($fileTime < $cutoffDate && !str_ends_with($file, '.gz')) {
                $compressedFile = $file . '.gz';
                
                if (!file_exists($compressedFile)) {
                    $this->compressFile($file, $compressedFile);
                }
            }
        }
    }
    
    /**
     * Compresse un fichier de log
     */
    private function compressFile(string $sourceFile, string $targetFile): bool
    {
        $source = fopen($sourceFile, 'rb');
        $target = gzopen($targetFile, 'wb9');
        
        if (!$source || !$target) {
            return false;
        }
        
        while (!feof($source)) {
            gzwrite($target, fread($source, 8192));
        }
        
        fclose($source);
        gzclose($target);
        
        // Supprimer le fichier original si la compression a réussi
        if (file_exists($targetFile) && filesize($targetFile) > 0) {
            unlink($sourceFile);
            return true;
        }
        
        return false;
    }
    
    /**
     * Recherche dans l'index des logs
     */
    public function searchInIndex(array $criteria = []): array
    {
        $results = [];
        
        foreach ($this->logIndex as $entry) {
            $match = true;
            
            // Filtrer par niveau si spécifié
            if (isset($criteria['level']) && $entry['level'] !== $criteria['level']) {
                $match = false;
            }
            
            // Filtrer par période si spécifiée
            if (isset($criteria['from']) && $entry['timestamp'] < $criteria['from']) {
                $match = false;
            }
            
            if (isset($criteria['to']) && $entry['timestamp'] > $criteria['to']) {
                $match = false;
            }
            
            if ($match) {
                $results[] = $entry;
            }
        }
        
        return $results;
    }
    
    /**
     * Retourne les statistiques du buffer
     */
    public function getBufferStats(): array
    {
        return [
            'buffer_count' => $this->bufferCount,
            'buffer_size' => $this->bufferSize,
            'buffer_usage_percent' => round(($this->bufferCount / $this->bufferSize) * 100, 2),
            'last_flush' => $this->lastFlush,
            'time_since_last_flush' => microtime(true) - $this->lastFlush,
            'index_entries' => count($this->logIndex),
            'compression_enabled' => $this->compressionEnabled
        ];
    }
    
    /**
     * Configure la taille du buffer
     */
    public function setBufferSize(int $size): void
    {
        $this->bufferSize = max(10, $size); // Minimum 10
    }
    
    /**
     * Configure l'intervalle de flush
     */
    public function setFlushInterval(int $seconds): void
    {
        $this->flushInterval = max(5, $seconds); // Minimum 5 secondes
    }
    
    /**
     * Active/désactive la compression
     */
    public function setCompressionEnabled(bool $enabled): void
    {
        $this->compressionEnabled = $enabled;
    }
    
    /**
     * Destructeur : s'assurer que le buffer est vidé
     */
    public function __destruct()
    {
        $this->forceFlush();
    }
}