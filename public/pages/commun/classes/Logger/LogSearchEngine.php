<?php
namespace Commun\Logger;

/**
 * LogSearchEngine - Moteur de recherche et filtrage pour les logs
 * 
 * Fonctionnalités:
 * - Recherche full-text dans l'historique des logs
 * - Filtrage par niveau de log
 * - Indexation automatique pour performances
 * - Recherche par période et contexte
 * - Cache des résultats de recherche
 */
class LogSearchEngine
{
    /** @var string Répertoire des logs */
    private string $logDir;
    
    /** @var string Fichier d'index de recherche */
    private string $indexFile;
    
    /** @var array Index de recherche en mémoire */
    private array $searchIndex = [];
    
    /** @var array Cache des résultats de recherche */
    private array $searchCache = [];
    
    /** @var int Taille maximale du cache */
    private int $maxCacheSize = 100;
    
    /** @var int Nombre maximum de résultats par recherche */
    private int $maxResults = 1000;
    
    /** @var array Niveaux de log supportés */
    private array $supportedLevels = ['debug', 'info', 'warning', 'error', 'critical'];
    
    /** @var array Mots-clés à ignorer dans la recherche */
    private array $stopWords = [
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
        'to', 'was', 'will', 'with', 'le', 'la', 'les', 'un', 'une', 'des',
        'de', 'du', 'et', 'ou', 'est', 'ce', 'dans', 'pour', 'sur', 'avec'
    ];
    
    /** @var array Patterns pour extraire des informations structurées */
    private array $extractionPatterns = [
        'ip' => '/\b(?:\d{1,3}\.){3}\d{1,3}\b/',
        'email' => '/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/',
        'url' => '/https?:\/\/[^\s]+/',
        'file_path' => '/\/[^\s]*\.(?:php|js|css|html|log)/',
        'error_code' => '/\b(?:HTTP_|ERROR_|ERR_)\w+\b/',
        'sql_table' => '/\b(?:SELECT|INSERT|UPDATE|DELETE)\s+.*?\bFROM\s+(\w+)/i'
    ];

    public function __construct(string $logDir)
    {
        $this->logDir = rtrim($logDir, '/');
        $this->indexFile = $this->logDir . '/.search_index.json';
        
        if (!is_dir($this->logDir)) {
            throw new \InvalidArgumentException("Log directory does not exist: {$this->logDir}");
        }
        
        $this->loadSearchIndex();
    }

    /**
     * Recherche dans les logs avec filtres
     */
    public function search(array $criteria): array
    {
        $cacheKey = $this->generateCacheKey($criteria);
        
        // Vérifier le cache
        if (isset($this->searchCache[$cacheKey])) {
            return $this->searchCache[$cacheKey];
        }
        
        $results = $this->performSearch($criteria);
        
        // Mettre en cache
        $this->cacheResults($cacheKey, $results);
        
        return $results;
    }
    
    /**
     * Effectue la recherche selon les critères
     */
    private function performSearch(array $criteria): array
    {
        $query = $criteria['query'] ?? '';
        $level = $criteria['level'] ?? 'all';
        $dateFrom = $criteria['date_from'] ?? null;
        $dateTo = $criteria['date_to'] ?? null;
        $limit = min($criteria['limit'] ?? 100, $this->maxResults);
        $contextSize = $criteria['context'] ?? 0; // Lignes de contexte autour du résultat
        
        $results = [];
        $logFiles = $this->getLogFiles();
        
        foreach ($logFiles as $file) {
            if (count($results) >= $limit) {
                break;
            }
            
            $fileResults = $this->searchInFile($file, [
                'query' => $query,
                'level' => $level,
                'date_from' => $dateFrom,
                'date_to' => $dateTo,
                'context' => $contextSize,
                'remaining_limit' => $limit - count($results)
            ]);
            
            $results = array_merge($results, $fileResults);
        }
        
        // Trier par timestamp décroissant (plus récent en premier)
        usort($results, function($a, $b) {
            return $b['timestamp'] <=> $a['timestamp'];
        });
        
        return array_slice($results, 0, $limit);
    }
    
    /**
     * Recherche dans un fichier spécifique
     */
    private function searchInFile(string $file, array $criteria): array
    {
        $results = [];
        $lines = file($file, FILE_IGNORE_NEW_LINES);
        $totalLines = count($lines);
        
        for ($i = 0; $i < $totalLines; $i++) {
            if (count($results) >= $criteria['remaining_limit']) {
                break;
            }
            
            $line = $lines[$i];
            $logEntry = $this->parseLogLine($line, $i + 1);
            
            if (!$logEntry) {
                continue;
            }
            
            // Appliquer les filtres
            if (!$this->matchesCriteria($logEntry, $criteria)) {
                continue;
            }
            
            // Ajouter le contexte si demandé
            if ($criteria['context'] > 0) {
                $logEntry['context'] = $this->getContext($lines, $i, $criteria['context']);
            }
            
            $logEntry['file'] = basename($file);
            $logEntry['line_number'] = $i + 1;
            
            $results[] = $logEntry;
        }
        
        return $results;
    }
    
    /**
     * Vérifie si une entrée correspond aux critères
     */
    private function matchesCriteria(array $logEntry, array $criteria): bool
    {
        // Filtrer par niveau
        if ($criteria['level'] !== 'all' && $logEntry['level'] !== $criteria['level']) {
            return false;
        }
        
        // Filtrer par date
        if ($criteria['date_from'] && $logEntry['timestamp'] < strtotime($criteria['date_from'])) {
            return false;
        }
        
        if ($criteria['date_to'] && $logEntry['timestamp'] > strtotime($criteria['date_to'] . ' 23:59:59')) {
            return false;
        }
        
        // Recherche textuelle
        if (!empty($criteria['query'])) {
            return $this->matchesQuery($logEntry, $criteria['query']);
        }
        
        return true;
    }
    
    /**
     * Vérifie si une entrée correspond à la requête textuelle
     */
    private function matchesQuery(array $logEntry, string $query): bool
    {
        $searchableText = strtolower($logEntry['message'] . ' ' . ($logEntry['context_text'] ?? ''));
        
        // Recherche simple par mots-clés
        $queryWords = $this->extractSearchTerms($query);
        
        foreach ($queryWords as $word) {
            if (strpos($searchableText, strtolower($word)) === false) {
                return false; // Tous les mots doivent être présents (AND)
            }
        }
        
        return true;
    }
    
    /**
     * Extrait les termes de recherche d'une requête
     */
    private function extractSearchTerms(string $query): array
    {
        // Supprimer la ponctuation et diviser en mots
        $words = preg_split('/[\s\p{P}]+/u', $query, -1, PREG_SPLIT_NO_EMPTY);
        
        // Filtrer les mots vides et trop courts
        $terms = [];
        foreach ($words as $word) {
            $word = trim($word);
            if (strlen($word) >= 2 && !in_array(strtolower($word), $this->stopWords)) {
                $terms[] = $word;
            }
        }
        
        return $terms;
    }
    
    /**
     * Récupère le contexte autour d'une ligne
     */
    private function getContext(array $lines, int $lineIndex, int $contextSize): array
    {
        $start = max(0, $lineIndex - $contextSize);
        $end = min(count($lines) - 1, $lineIndex + $contextSize);
        
        $context = [
            'before' => [],
            'after' => []
        ];
        
        // Lignes avant
        for ($i = $start; $i < $lineIndex; $i++) {
            $context['before'][] = [
                'line_number' => $i + 1,
                'content' => $lines[$i]
            ];
        }
        
        // Lignes après
        for ($i = $lineIndex + 1; $i <= $end; $i++) {
            $context['after'][] = [
                'line_number' => $i + 1,
                'content' => $lines[$i]
            ];
        }
        
        return $context;
    }
    
    /**
     * Parse une ligne de log
     */
    private function parseLogLine(string $line, int $lineNumber): ?array
    {
        // Pattern pour les logs Monolog : "2025-01-01 12:00:00 - ERROR: Message"
        $pattern = '/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) - (\w+): (.+)$/';
        
        if (preg_match($pattern, $line, $matches)) {
            $timestamp = strtotime($matches[1]);
            $level = strtolower($matches[2]);
            $message = $matches[3];
            
            // Extraire des informations structurées
            $extracted = $this->extractStructuredInfo($message);
            
            return [
                'datetime' => $matches[1],
                'timestamp' => $timestamp,
                'level' => $level,
                'message' => $message,
                'raw_line' => $line,
                'extracted' => $extracted,
                'line_number' => $lineNumber
            ];
        }
        
        return null;
    }
    
    /**
     * Extrait des informations structurées du message
     */
    private function extractStructuredInfo(string $message): array
    {
        $extracted = [];
        
        foreach ($this->extractionPatterns as $type => $pattern) {
            if (preg_match_all($pattern, $message, $matches)) {
                $extracted[$type] = array_unique($matches[0]);
            }
        }
        
        return $extracted;
    }
    
    /**
     * Recherche par patterns spécifiques
     */
    public function searchByPattern(string $pattern, array $options = []): array
    {
        $level = $options['level'] ?? 'all';
        $limit = min($options['limit'] ?? 100, $this->maxResults);
        
        $results = [];
        $logFiles = $this->getLogFiles();
        
        foreach ($logFiles as $file) {
            if (count($results) >= $limit) {
                break;
            }
            
            $lines = file($file, FILE_IGNORE_NEW_LINES);
            
            foreach ($lines as $lineNumber => $line) {
                if (count($results) >= $limit) {
                    break;
                }
                
                $logEntry = $this->parseLogLine($line, $lineNumber + 1);
                
                if (!$logEntry) {
                    continue;
                }
                
                if ($level !== 'all' && $logEntry['level'] !== $level) {
                    continue;
                }
                
                if (preg_match($pattern, $logEntry['message'])) {
                    $logEntry['file'] = basename($file);
                    $results[] = $logEntry;
                }
            }
        }
        
        return $results;
    }
    
    /**
     * Recherche d'erreurs fréquentes
     */
    public function findFrequentErrors(array $options = []): array
    {
        $period = $options['period'] ?? '24h';
        $minOccurrences = $options['min_occurrences'] ?? 5;
        
        $fromTimestamp = strtotime("-{$period}");
        $errorCounts = [];
        
        $results = $this->search([
            'level' => 'error',
            'date_from' => date('Y-m-d H:i:s', $fromTimestamp),
            'limit' => 10000
        ]);
        
        foreach ($results as $result) {
            // Normaliser le message d'erreur
            $normalizedMessage = $this->normalizeErrorMessage($result['message']);
            
            if (!isset($errorCounts[$normalizedMessage])) {
                $errorCounts[$normalizedMessage] = [
                    'count' => 0,
                    'first_seen' => $result['timestamp'],
                    'last_seen' => $result['timestamp'],
                    'example' => $result
                ];
            }
            
            $errorCounts[$normalizedMessage]['count']++;
            $errorCounts[$normalizedMessage]['last_seen'] = max(
                $errorCounts[$normalizedMessage]['last_seen'],
                $result['timestamp']
            );
        }
        
        // Filtrer par nombre minimum d'occurrences
        $frequentErrors = array_filter($errorCounts, function($error) use ($minOccurrences) {
            return $error['count'] >= $minOccurrences;
        });
        
        // Trier par nombre d'occurrences décroissant
        uasort($frequentErrors, function($a, $b) {
            return $b['count'] <=> $a['count'];
        });
        
        return $frequentErrors;
    }
    
    /**
     * Normalise un message d'erreur pour regroupement
     */
    private function normalizeErrorMessage(string $message): string
    {
        // Supprimer les données variables (timestamps, IDs, chemins spécifiques)
        $normalized = preg_replace('/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/', '[TIMESTAMP]', $message);
        $normalized = preg_replace('/\b\d{3,}\b/', '[ID]', $normalized);
        $normalized = preg_replace('/\/[^\s]*\.php/', '[FILEPATH]', $normalized);
        $normalized = preg_replace('/\b[a-f0-9]{16,}\b/', '[HASH]', $normalized);
        
        return trim($normalized);
    }
    
    /**
     * Suggestions de recherche basées sur l'historique
     */
    public function getSuggestions(string $partialQuery, int $limit = 10): array
    {
        $suggestions = [];
        
        // Rechercher dans l'index des termes fréquents
        $terms = $this->extractSearchTerms($partialQuery);
        $lastTerm = end($terms);
        
        if (strlen($lastTerm) >= 2) {
            $indexTerms = $this->getFrequentTermsFromIndex();
            
            foreach ($indexTerms as $term => $frequency) {
                if (stripos($term, $lastTerm) === 0 && $term !== $lastTerm) {
                    $suggestions[] = [
                        'text' => $term,
                        'frequency' => $frequency,
                        'type' => 'term'
                    ];
                }
                
                if (count($suggestions) >= $limit) {
                    break;
                }
            }
        }
        
        // Ajouter des suggestions de niveau si pertinent
        if (empty($partialQuery) || stripos('error', $partialQuery) === 0) {
            foreach ($this->supportedLevels as $level) {
                if (stripos($level, $partialQuery) === 0) {
                    $suggestions[] = [
                        'text' => $level,
                        'frequency' => 0,
                        'type' => 'level'
                    ];
                }
            }
        }
        
        return array_slice($suggestions, 0, $limit);
    }
    
    /**
     * Met à jour l'index de recherche
     */
    public function updateSearchIndex(): void
    {
        $index = [
            'last_update' => time(),
            'files' => [],
            'terms' => []
        ];
        
        $logFiles = $this->getLogFiles();
        
        foreach ($logFiles as $file) {
            $fileModTime = filemtime($file);
            
            // Vérifier si le fichier a été modifié depuis la dernière indexation
            if (isset($this->searchIndex['files'][basename($file)]) &&
                $this->searchIndex['files'][basename($file)]['mtime'] >= $fileModTime) {
                continue;
            }
            
            $this->indexFile($file, $index);
        }
        
        $this->searchIndex = $index;
        $this->saveSearchIndex();
    }
    
    /**
     * Indexe un fichier spécifique
     */
    private function indexFile(string $file, array &$index): void
    {
        $lines = file($file, FILE_IGNORE_NEW_LINES);
        $terms = [];
        
        foreach ($lines as $line) {
            $logEntry = $this->parseLogLine($line, 0);
            
            if ($logEntry) {
                $messageTerms = $this->extractSearchTerms($logEntry['message']);
                
                foreach ($messageTerms as $term) {
                    $termLower = strtolower($term);
                    $terms[$termLower] = ($terms[$termLower] ?? 0) + 1;
                }
            }
        }
        
        $index['files'][basename($file)] = [
            'mtime' => filemtime($file),
            'size' => filesize($file),
            'line_count' => count($lines),
            'terms' => count($terms)
        ];
        
        // Fusionner les termes dans l'index global
        foreach ($terms as $term => $count) {
            $index['terms'][$term] = ($index['terms'][$term] ?? 0) + $count;
        }
    }
    
    /**
     * Récupère les termes fréquents de l'index
     */
    private function getFrequentTermsFromIndex(): array
    {
        $terms = $this->searchIndex['terms'] ?? [];
        
        // Trier par fréquence décroissante
        arsort($terms);
        
        return array_slice($terms, 0, 1000, true);
    }
    
    /**
     * Charge l'index de recherche
     */
    private function loadSearchIndex(): void
    {
        if (file_exists($this->indexFile)) {
            $content = file_get_contents($this->indexFile);
            if ($content) {
                $decoded = json_decode($content, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $this->searchIndex = $decoded;
                }
            }
        }
    }
    
    /**
     * Sauvegarde l'index de recherche
     */
    private function saveSearchIndex(): void
    {
        $content = json_encode($this->searchIndex, JSON_PRETTY_PRINT);
        file_put_contents($this->indexFile, $content, LOCK_EX);
    }
    
    /**
     * Génère une clé de cache pour les résultats
     */
    private function generateCacheKey(array $criteria): string
    {
        return md5(json_encode($criteria));
    }
    
    /**
     * Met en cache les résultats de recherche
     */
    private function cacheResults(string $key, array $results): void
    {
        // Limiter la taille du cache
        if (count($this->searchCache) >= $this->maxCacheSize) {
            $this->searchCache = array_slice($this->searchCache, -($this->maxCacheSize / 2), null, true);
        }
        
        $this->searchCache[$key] = $results;
    }
    
    /**
     * Vide le cache de recherche
     */
    public function clearCache(): void
    {
        $this->searchCache = [];
    }
    
    /**
     * Récupère la liste des fichiers de log
     */
    private function getLogFiles(): array
    {
        $pattern = $this->logDir . '/error*.log';
        $files = glob($pattern);
        
        // Trier par date de modification (plus récent en premier)
        usort($files, function($a, $b) {
            return filemtime($b) - filemtime($a);
        });
        
        return $files;
    }
    
    /**
     * Retourne les statistiques de l'index
     */
    public function getIndexStats(): array
    {
        return [
            'last_update' => $this->searchIndex['last_update'] ?? 0,
            'indexed_files' => count($this->searchIndex['files'] ?? []),
            'total_terms' => count($this->searchIndex['terms'] ?? []),
            'cache_size' => count($this->searchCache),
            'index_file_size' => file_exists($this->indexFile) ? filesize($this->indexFile) : 0
        ];
    }
}