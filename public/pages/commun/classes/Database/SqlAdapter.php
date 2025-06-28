<?php
namespace Commun\Database;

require_once __DIR__ . '/BDDManager.php';

/**
 * Adaptateur pour SqlManager implémentant l'interface BDDManager
 *
 * Cette classe permet d'utiliser SqlManager via l'interface BDDManager,
 * en adaptant les méthodes spécifiques de SqlManager aux méthodes définies dans BDDManager.
 * Elle fournit une couche d'abstraction pour rendre l'accès aux données indépendant
 * du type de base de données utilisé.
 *
 * CORRECTION 10: Différenciation claire des erreurs de connexion vs erreurs de requête
 *
 * @package Commun\Database
 * @author Application Framework
 * @version 1.0
 */
class SqlAdapter implements BDDManager
{
    /** @var SqlManager Instance de SqlManager à adapter */
    private SqlManager $sqlManager;

    /** @var array<string> Cache des tables existantes */
    private array $tablesCache = [];

    /** @var bool Indique si le cache des tables a été initialisé */
    private bool $tablesCacheInitialized = false;

    /** @var int Timestamp du dernier test de connexion réussi */
    private int $lastConnectionTest = 0;

    /** @var int Intervalle de cache pour les tests de connexion (secondes) */
    private int $connectionTestInterval = 60;

    /**
     * Constructeur
     *
     * @param SqlManager $sqlManager Instance de SqlManager à adapter
     * @throws SqlAdapterException Si SqlManager invalide
     */
    public function __construct(SqlManager $sqlManager)
    {
        if (! $sqlManager instanceof SqlManager) {
            throw new SqlAdapterConnectionException("Instance SqlManager invalide fournie à SqlAdapter");
        }

        $this->sqlManager = $sqlManager;

        // Test initial de connexion
        if (! $this->testConnection()) {
            throw new SqlAdapterConnectionException("Connexion SqlManager non fonctionnelle lors de l'initialisation");
        }
    }

    /**
     * Récupère toutes les lignes d'une table.
     *
     * @param string $table Nom de la table à lire
     * @return array<int, array<string, mixed>> Tableau de lignes associatives
     * @throws SqlAdapterTableException Si la table n'existe pas
     * @throws SqlAdapterQueryException Si erreur lors de la requête
     * @throws SqlAdapterConnectionException Si problème de connexion
     */
    public function getAllContentTable(string $table): array
    {
        try {
            // Vérifier la connexion d'abord
            if (! $this->testConnection()) {
                throw new SqlAdapterConnectionException("Perte de connexion à la base de données");
            }

            // Vérifier l'existence de la table
            if (! $this->tableExists($table)) {
                throw new SqlAdapterTableException("La table '$table' n'existe pas ou n'est pas accessible");
            }

            // Exécuter la requête avec le nouveau format standardisé
            $result = $this->sqlManager->query(
                "SELECT * FROM `" . $this->escapeName($table) . "`"
            );

            // Analyser le résultat selon le nouveau format
            if (! $result['success']) {
                // Différencier les erreurs selon leur nature
                $errorMessage = $result['message'] ?? 'Erreur inconnue';

                if ($this->isConnectionError($errorMessage)) {
                    throw new SqlAdapterConnectionException(
                        "Erreur de connexion lors de la lecture de la table '$table': $errorMessage"
                    );
                } else {
                    throw new SqlAdapterQueryException(
                        "Erreur de requête lors de la lecture de la table '$table': $errorMessage"
                    );
                }
            }

            return $result['data'] ?? [];

        } catch (SqlAdapterException $e) {
            // Re-lancer les exceptions spécialisées
            throw $e;
        } catch (\Exception $e) {
            // Classifier les autres exceptions
            if ($this->isConnectionError($e->getMessage())) {
                throw new SqlAdapterConnectionException(
                    "Erreur de connexion lors de l'accès à la table '$table': " . $e->getMessage(),
                    0,
                    $e
                );
            } else {
                throw new SqlAdapterQueryException(
                    "Erreur lors de l'accès à la table '$table': " . $e->getMessage(),
                    0,
                    $e
                );
            }
        }
    }

    /**
     * Vérifie si une table existe et est accessible.
     *
     * @param string $table Nom de la table à vérifier
     * @return bool True si la table existe et est accessible, false sinon
     */
    public function tableExists(string $table): bool
    {
        try {
            // Utiliser le cache si disponible et récent
            if ($this->tablesCacheInitialized && in_array($table, $this->tablesCache)) {
                return true;
            }

            // Vérifier la connexion
            if (! $this->testConnection()) {
                return false;
            }

            // Requête pour vérifier l'existence de la table
            $result = $this->sqlManager->query(
                "SELECT 1 FROM information_schema.tables
                 WHERE table_schema = DATABASE()
                 AND table_name = ?",
                [$table]
            );

            if (! $result['success']) {
                return false;
            }

            $exists = ! empty($result['data']);

            // Mettre à jour le cache si la table existe
            if ($exists && ! in_array($table, $this->tablesCache)) {
                $this->tablesCache[] = $table;
            }

            return $exists;

        } catch (\Exception $e) {
            // Log l'erreur mais ne pas lever d'exception pour cette méthode
            return false;
        }
    }

    /**
     * Retourne la liste des tables disponibles.
     *
     * @return array<string> Liste des noms de tables
     * @throws SqlAdapterConnectionException Si problème de connexion
     * @throws SqlAdapterQueryException Si erreur lors de la requête
     */
    public function getAvailableTables(): array
    {
        if ($this->tablesCacheInitialized) {
            return $this->tablesCache;
        }

        try {
            // Vérifier la connexion
            if (! $this->testConnection()) {
                throw new SqlAdapterConnectionException("Impossible de se connecter pour récupérer la liste des tables");
            }

            $result = $this->sqlManager->query(
                "SELECT table_name
                 FROM information_schema.tables
                 WHERE table_schema = DATABASE()
                 ORDER BY table_name"
            );

            if (! $result['success']) {
                $errorMessage = $result['message'] ?? 'Erreur inconnue';

                if ($this->isConnectionError($errorMessage)) {
                    throw new SqlAdapterConnectionException(
                        "Erreur de connexion lors de la récupération des tables: $errorMessage"
                    );
                } else {
                    throw new SqlAdapterQueryException(
                        "Erreur de requête lors de la récupération des tables: $errorMessage"
                    );
                }
            }

            $this->tablesCache            = array_column($result['data'], 'table_name');
            $this->tablesCacheInitialized = true;

            return $this->tablesCache;

        } catch (SqlAdapterException $e) {
            throw $e;
        } catch (\Exception $e) {
            if ($this->isConnectionError($e->getMessage())) {
                throw new SqlAdapterConnectionException(
                    "Erreur de connexion lors de la récupération des tables: " . $e->getMessage(),
                    0,
                    $e
                );
            } else {
                throw new SqlAdapterQueryException(
                    "Erreur lors de la récupération des tables: " . $e->getMessage(),
                    0,
                    $e
                );
            }
        }
    }

    /**
     * Teste la connectivité avec la source de données.
     *
     * @return bool True si la connexion est opérationnelle, false sinon
     */
    public function testConnection(): bool
    {
        // Utiliser le cache du test de connexion pour éviter les tests répétitifs
        $now = time();
        if (($now - $this->lastConnectionTest) < $this->connectionTestInterval) {
            return true; // Assumé fonctionnel si testé récemment
        }

        try {
            $result = $this->sqlManager->query("SELECT 1 as test");

            $isConnected = $result['success'] &&
            ! empty($result['data']) &&
                $result['data'][0]['test'] == 1;

            if ($isConnected) {
                $this->lastConnectionTest = $now;
            }

            return $isConnected;

        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Retourne des informations sur la source de données.
     *
     * @return array<string, mixed> Informations sur le backend
     */
    public function getSourceInfo(): array
    {
        $info = [
            'type'                 => 'MySQL/MariaDB',
            'adapter'              => 'SqlAdapter',
            'connection_status'    => 'unknown',
            'version'              => null,
            'charset'              => null,
            'database'             => null,
            'last_connection_test' => $this->lastConnectionTest,
        ];

        try {
            // Test de connexion
            $info['connection_status'] = $this->testConnection() ? 'connected' : 'disconnected';

            if ($info['connection_status'] === 'connected') {
                // Récupérer les informations de connexion du SqlManager
                $connectionInfo = $this->sqlManager->getConnectionInfo();

                $info = array_merge($info, [
                    'version'  => $connectionInfo['version'] ?? null,
                    'charset'  => $connectionInfo['charset'] ?? null,
                    'database' => $connectionInfo['database'] ?? null,
                    'driver'   => $connectionInfo['driver'] ?? null,
                ]);

                // Nombre de tables
                try {
                    $tables               = $this->getAvailableTables();
                    $info['tables_count'] = count($tables);
                    $info['tables']       = $tables;
                } catch (\Exception $e) {
                    $info['tables_error'] = $e->getMessage();
                }
            }

        } catch (\Exception $e) {
            $info['error']             = $e->getMessage();
            $info['connection_status'] = 'error';
        }

        return $info;
    }

    /**
     * Échappe un nom de table/colonne pour éviter les injections SQL
     *
     * @param string $name Nom à échapper
     * @return string Nom échappé
     */
    private function escapeName(string $name): string
    {
        return str_replace('`', '``', $name);
    }

    /**
     * Vide le cache des tables (utile après modifications de structure)
     *
     * @return void
     */
    public function clearTablesCache(): void
    {
        $this->tablesCache            = [];
        $this->tablesCacheInitialized = false;
    }

    /**
     * Force un nouveau test de connexion
     *
     * @return bool Résultat du test de connexion
     */
    public function forceConnectionTest(): bool
    {
        $this->lastConnectionTest = 0; // Reset du cache
        return $this->testConnection();
    }

    /**
     * Configure l'intervalle de cache pour les tests de connexion
     *
     * @param int $seconds Intervalle en secondes
     * @return void
     */
    public function setConnectionTestInterval(int $seconds): void
    {
        $this->connectionTestInterval = max(0, $seconds);
    }

    /**
     * Retourne l'instance SqlManager sous-jacente (pour les cas avancés)
     *
     * @return SqlManager Instance SqlManager
     */
    public function getSqlManager(): SqlManager
    {
        return $this->sqlManager;
    }

    /**
     * Détermine si un message d'erreur indique un problème de connexion
     * CORRECTION 10: Classification des erreurs
     *
     * @param string $errorMessage Message d'erreur à analyser
     * @return bool True si c'est une erreur de connexion
     */
    private function isConnectionError(string $errorMessage): bool
    {
        $connectionErrorPatterns = [
            'connection',
            'connect',
            'server has gone away',
            'lost connection',
            'can\'t connect',
            'access denied',
            'unknown database',
            'unknown host',
            'timeout',
            'refused',
            'unreachable',
            'network',
            'socket',
            'communication link failure',
            'pdo',
        ];

        $lowerMessage = strtolower($errorMessage);

        foreach ($connectionErrorPatterns as $pattern) {
            if (strpos($lowerMessage, $pattern) !== false) {
                return true;
            }
        }

        return false;
    }
}

/**
 * Exception de base pour SqlAdapter
 *
 * @package Commun\Database
 */
abstract class SqlAdapterException extends \Exception
{
    /**
     * Constructeur
     *
     * @param string $message Message d'erreur
     * @param int $code Code d'erreur
     * @param \Throwable|null $previous Exception précédente
     */
    public function __construct(string $message = "", int $code = 0,  ? \Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}

/**
 * Exception pour les erreurs de connexion
 * CORRECTION 10: Exception spécialisée pour les erreurs de connexion
 *
 * @package Commun\Database
 */
class SqlAdapterConnectionException extends SqlAdapterException
{
    /**
     * Constructeur
     *
     * @param string $message Message d'erreur de connexion
     * @param int $code Code d'erreur
     * @param \Throwable|null $previous Exception précédente
     */
    public function __construct(string $message = "", int $code = 0,  ? \Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}

/**
 * Exception pour les erreurs de requête
 * CORRECTION 10: Exception spécialisée pour les erreurs de requête
 *
 * @package Commun\Database
 */
class SqlAdapterQueryException extends SqlAdapterException
{
    /**
     * Constructeur
     *
     * @param string $message Message d'erreur de requête
     * @param int $code Code d'erreur
     * @param \Throwable|null $previous Exception précédente
     */
    public function __construct(string $message = "", int $code = 0,  ? \Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}

/**
 * Exception pour les erreurs liées aux tables
 * CORRECTION 10: Exception spécialisée pour les erreurs de table
 *
 * @package Commun\Database
 */
class SqlAdapterTableException extends SqlAdapterException
{
    /**
     * Constructeur
     *
     * @param string $message Message d'erreur de table
     * @param int $code Code d'erreur
     * @param \Throwable|null $previous Exception précédente
     */
    public function __construct(string $message = "", int $code = 0,  ? \Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
