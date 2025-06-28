<?php
namespace Commun\Logger;

/**
 * DeduplicatedLogger - Version du EnhancedLogger avec déduplication des erreurs répétitives
 * 
 * Améliorations:
 * - Déduplication des erreurs répétitives
 * - Comptage automatique des occurrences
 * - Résumés périodiques des erreurs fréquentes
 * - Gestion intelligente des logs similaires
 */
class DeduplicatedLogger extends EnhancedLogger
{
    /** @var array Cache des hashes de messages pour déduplication */
    private array $messageHashes = [];
    
    /** @var array Compteurs d'occurrences par hash de message */
    private array $occurrenceCounts = [];
    
    /** @var array Dernières occurrences par hash */
    private array $lastOccurrences = [];
    
    /** @var int Durée en secondes pour considérer un message comme répétitif */
    private int $deduplicationWindow = 300; // 5 minutes
    
    /** @var int Nombre maximum d'occurrences avant suppression complète */
    private int $maxOccurrences = 100;
    
    /** @var int Intervalle en secondes pour les résumés de déduplication */
    private int $summaryInterval = 3600; // 1 heure
    
    /** @var float Timestamp du dernier résumé */
    private float $lastSummaryTime = 0;
    
    /** @var array Messages supprimés depuis le dernier résumé */
    private array $suppressedMessages = [];
    
    /** @var array Configuration de déduplication par niveau */
    private array $deduplicationConfig = [
        'debug' => [
            'enabled' => true,
            'window' => 60,      // 1 minute pour debug
            'max_occurrences' => 10
        ],
        'info' => [
            'enabled' => true,
            'window' => 300,     // 5 minutes pour info
            'max_occurrences' => 20
        ],
        'warning' => [
            'enabled' => true,
            'window' => 600,     // 10 minutes pour warning
            'max_occurrences' => 50
        ],
        'error' => [
            'enabled' => true,
            'window' => 300,     // 5 minutes pour error
            'max_occurrences' => 30
        ],
        'critical' => [
            'enabled' => false,  // Ne jamais dédupliquer les critiques
            'window' => 0,
            'max_occurrences' => 0
        ]
    ];

    public function __construct(string $loggerName, string $logDir)
    {
        parent::__construct($loggerName, $logDir);
        $this->lastSummaryTime = microtime(true);
    }

    /**
     * Log avec déduplication intelligente
     */
    public function log($level, string $message, array $context = []): void
    {
        $levelString = strtolower((string) $level);
        
        // Vérifier si la déduplication est activée pour ce niveau
        if (!$this->isDeduplicationEnabled($levelString)) {
            parent::log($level, $message, $context);
            return;
        }
        
        // Créer un hash unique pour ce message
        $messageHash = $this->createMessageHash($message, $context, $levelString);
        
        // Vérifier si ce message doit être dédupliqué
        if ($this->shouldDeduplicate($messageHash, $levelString)) {
            $this->handleDuplicateMessage($messageHash, $level, $message, $context);
            return;
        }
        
        // Message non dédupliqué, le logger normalement
        $this->recordMessageOccurrence($messageHash, $levelString);
        
        // Ajouter les informations de déduplication au contexte
        $context['deduplication'] = [
            'hash' => substr($messageHash, 0, 8),
            'first_occurrence' => true,
            'count' => 1
        ];
        
        parent::log($level, $message, $context);
        
        // Vérifier s'il faut générer un résumé
        $this->checkAndGenerateSummary();
    }
    
    /**
     * Vérifie si la déduplication est activée pour un niveau
     */
    private function isDeduplicationEnabled(string $level): bool
    {
        return $this->deduplicationConfig[$level]['enabled'] ?? false;
    }
    
    /**
     * Crée un hash unique pour un message
     */
    private function createMessageHash(string $message, array $context, string $level): string
    {
        // Nettoyer le message des données variables (timestamps, IDs, etc.)
        $cleanMessage = $this->normalizeMessage($message);
        
        // Créer un hash basé sur le message nettoyé, le niveau et le contexte structurel
        $contextStructure = $this->getContextStructure($context);
        
        return md5($cleanMessage . $level . serialize($contextStructure));
    }
    
    /**
     * Normalise un message en supprimant les données variables
     */
    private function normalizeMessage(string $message): string
    {
        // Supprimer les timestamps
        $normalized = preg_replace('/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/', '[TIMESTAMP]', $message);
        
        // Supprimer les IDs numériques
        $normalized = preg_replace('/\b\d{3,}\b/', '[ID]', $normalized);
        
        // Supprimer les adresses IP
        $normalized = preg_replace('/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/', '[IP]', $normalized);
        
        // Supprimer les URLs complètes
        $normalized = preg_replace('/https?:\/\/[^\s]+/', '[URL]', $normalized);
        
        // Supprimer les chemins de fichiers complets
        $normalized = preg_replace('/\/[^\s]*\.php/', '[FILEPATH]', $normalized);
        
        // Supprimer les hash/tokens
        $normalized = preg_replace('/\b[a-f0-9]{16,}\b/', '[HASH]', $normalized);
        
        return trim($normalized);
    }
    
    /**
     * Extrait la structure du contexte sans les valeurs variables
     */
    private function getContextStructure(array $context): array
    {
        $structure = [];
        
        foreach ($context as $key => $value) {
            if (is_array($value)) {
                $structure[$key] = $this->getContextStructure($value);
            } else {
                // Garder seulement le type et quelques métadonnées
                $structure[$key] = [
                    'type' => gettype($value),
                    'empty' => empty($value)
                ];
            }
        }
        
        return $structure;
    }
    
    /**
     * Vérifie si un message doit être dédupliqué
     */
    private function shouldDeduplicate(string $messageHash, string $level): bool
    {
        $config = $this->deduplicationConfig[$level];
        $currentTime = microtime(true);
        
        // Vérifier si ce hash existe déjà
        if (!isset($this->messageHashes[$messageHash])) {
            return false;
        }
        
        $lastOccurrence = $this->lastOccurrences[$messageHash] ?? 0;
        $timeDiff = $currentTime - $lastOccurrence;
        
        // Si trop de temps s'est écoulé, ne pas dédupliquer
        if ($timeDiff > $config['window']) {
            return false;
        }
        
        // Si on a atteint le maximum d'occurrences, dédupliquer
        $count = $this->occurrenceCounts[$messageHash] ?? 0;
        if ($count >= $config['max_occurrences']) {
            return true;
        }
        
        return true; // Dédupliquer par défaut si dans la fenêtre
    }
    
    /**
     * Gère un message dupliqué
     */
    private function handleDuplicateMessage(string $messageHash, $level, string $message, array $context): void
    {
        $this->recordMessageOccurrence($messageHash, strtolower((string) $level));
        
        $count = $this->occurrenceCounts[$messageHash];
        $config = $this->deduplicationConfig[strtolower((string) $level)];
        
        // Enregistrer pour le résumé
        $this->suppressedMessages[$messageHash] = [
            'level' => (string) $level,
            'message' => $message,
            'count' => $count,
            'last_seen' => microtime(true),
            'first_seen' => $this->messageHashes[$messageHash]
        ];
        
        // Log occasionnel pour indiquer la déduplication
        if ($count % 10 === 0 || $count === $config['max_occurrences']) {
            $context['deduplication'] = [
                'hash' => substr($messageHash, 0, 8),
                'suppressed_count' => $count - 1,
                'status' => $count >= $config['max_occurrences'] ? 'max_reached' : 'ongoing'
            ];
            
            $dedupMessage = "[DEDUPLICATED] " . $message . " (occurred {$count} times)";
            parent::log($level, $dedupMessage, $context);
        }
    }
    
    /**
     * Enregistre une occurrence de message
     */
    private function recordMessageOccurrence(string $messageHash, string $level): void
    {
        $currentTime = microtime(true);
        
        if (!isset($this->messageHashes[$messageHash])) {
            $this->messageHashes[$messageHash] = $currentTime;
            $this->occurrenceCounts[$messageHash] = 0;
        }
        
        $this->occurrenceCounts[$messageHash]++;
        $this->lastOccurrences[$messageHash] = $currentTime;
    }
    
    /**
     * Vérifie et génère un résumé si nécessaire
     */
    private function checkAndGenerateSummary(): void
    {
        $currentTime = microtime(true);
        
        if ($currentTime - $this->lastSummaryTime >= $this->summaryInterval) {
            $this->generateDeduplicationSummary();
            $this->lastSummaryTime = $currentTime;
        }
    }
    
    /**
     * Génère un résumé des messages dédupliqués
     */
    private function generateDeduplicationSummary(): void
    {
        if (empty($this->suppressedMessages)) {
            return;
        }
        
        $summary = [
            'period_minutes' => round($this->summaryInterval / 60),
            'total_suppressed_types' => count($this->suppressedMessages),
            'total_suppressed_count' => array_sum(array_column($this->suppressedMessages, 'count')),
            'by_level' => [],
            'top_messages' => []
        ];
        
        // Grouper par niveau
        foreach ($this->suppressedMessages as $hash => $data) {
            $level = $data['level'];
            if (!isset($summary['by_level'][$level])) {
                $summary['by_level'][$level] = [
                    'unique_messages' => 0,
                    'total_occurrences' => 0
                ];
            }
            
            $summary['by_level'][$level]['unique_messages']++;
            $summary['by_level'][$level]['total_occurrences'] += $data['count'];
        }
        
        // Top 5 des messages les plus fréquents
        uasort($this->suppressedMessages, function($a, $b) {
            return $b['count'] <=> $a['count'];
        });
        
        $topMessages = array_slice($this->suppressedMessages, 0, 5, true);
        foreach ($topMessages as $hash => $data) {
            $summary['top_messages'][] = [
                'hash' => substr($hash, 0, 8),
                'level' => $data['level'],
                'message' => substr($data['message'], 0, 100) . (strlen($data['message']) > 100 ? '...' : ''),
                'count' => $data['count'],
                'duration_minutes' => round(($data['last_seen'] - $data['first_seen']) / 60, 1)
            ];
        }
        
        parent::info("[DEDUPLICATION SUMMARY]", $summary);
        
        // Nettoyer les messages expirés
        $this->cleanupExpiredMessages();
        
        // Réinitialiser pour la prochaine période
        $this->suppressedMessages = [];
    }
    
    /**
     * Nettoie les messages expirés du cache
     */
    private function cleanupExpiredMessages(): void
    {
        $currentTime = microtime(true);
        $maxWindow = max(array_column($this->deduplicationConfig, 'window'));
        
        foreach ($this->messageHashes as $hash => $firstSeen) {
            $lastSeen = $this->lastOccurrences[$hash] ?? $firstSeen;
            
            // Supprimer si plus vu depuis 2x la fenêtre maximale
            if ($currentTime - $lastSeen > ($maxWindow * 2)) {
                unset($this->messageHashes[$hash]);
                unset($this->occurrenceCounts[$hash]);
                unset($this->lastOccurrences[$hash]);
            }
        }
    }
    
    /**
     * Configure la déduplication pour un niveau spécifique
     */
    public function configureDeduplication(string $level, array $config): void
    {
        $level = strtolower($level);
        
        if (isset($this->deduplicationConfig[$level])) {
            $this->deduplicationConfig[$level] = array_merge(
                $this->deduplicationConfig[$level],
                $config
            );
        }
    }
    
    /**
     * Active/désactive la déduplication globalement
     */
    public function setDeduplicationEnabled(bool $enabled): void
    {
        foreach ($this->deduplicationConfig as $level => &$config) {
            if ($level !== 'critical') { // Toujours laisser critical non dédupliqué
                $config['enabled'] = $enabled;
            }
        }
    }
    
    /**
     * Retourne les statistiques de déduplication
     */
    public function getDeduplicationStats(): array
    {
        $stats = [
            'unique_messages_tracked' => count($this->messageHashes),
            'total_occurrences' => array_sum($this->occurrenceCounts),
            'currently_suppressed' => count($this->suppressedMessages),
            'config' => $this->deduplicationConfig
        ];
        
        // Statistiques par niveau
        $stats['by_level'] = [];
        foreach ($this->messageHashes as $hash => $firstSeen) {
            // Déterminer le niveau (simplification, on pourrait stocker le niveau)
            $count = $this->occurrenceCounts[$hash] ?? 0;
            if ($count > 1) {
                $stats['frequent_messages'][] = [
                    'hash' => substr($hash, 0, 8),
                    'count' => $count,
                    'first_seen' => date('Y-m-d H:i:s', (int) $firstSeen),
                    'last_seen' => date('Y-m-d H:i:s', (int) ($this->lastOccurrences[$hash] ?? $firstSeen))
                ];
            }
        }
        
        return $stats;
    }
    
    /**
     * Force la génération d'un résumé
     */
    public function forceSummary(): void
    {
        $this->generateDeduplicationSummary();
    }
    
    /**
     * Réinitialise les données de déduplication
     */
    public function resetDeduplication(): void
    {
        $this->messageHashes = [];
        $this->occurrenceCounts = [];
        $this->lastOccurrences = [];
        $this->suppressedMessages = [];
        $this->lastSummaryTime = microtime(true);
    }
}