<?php
namespace Commun\Database;

use Commun\Logger\Logger;
use PDO;
use PDOException;

/**
 * Classe SqlManager - Gestionnaire de connexion et d'opérations SQL
 *
 * Cette classe utilise le pattern Singleton pour gérer les connexions à la base de données
 * et fournit des méthodes pour les opérations CRUD courantes.
 */
class SqlManager
{
    /** @var SqlManager|null Instance unique de la classe */
    private static ?SqlManager $instance = null;

    /** @var \Psr\Log\LoggerInterface Logger pour la journalisation */
    private $logger;

    /** @var PDO Instance de connexion PDO */
    private $db;

    /** @var array Table des noms de tables autorisés (protection contre les injections SQL) */
    private $allowedTables = [];

    /** @var bool Flag d'initialisation */
    private static $isInitialized = false;

    /**
     * Constructeur privé pour empêcher l'instanciation directe
     *
     * @param PDO $db Instance de connexion PDO
     */
    private function __construct(PDO $db)
    {
        $this->db = $db;

        // Initialiser le logger seulement s'il est disponible
        try {
            $this->logger = Logger::getInstance()->getLogger();
        } catch (\Exception $e) {
            // En cas d'erreur, on crée un logger null qui ne fait rien
            $this->logger = new \Psr\Log\NullLogger();
        }

        // Marquer comme initialisé seulement si tout est OK
        self::$isInitialized = true;
    }

    /**
     * Obtenir l'instance unique ou en créer une nouvelle
     *
     * @param PDO|null $db Instance de connexion PDO (requis lors de la première initialisation)
     * @return self Instance unique de SqlManager
     * @throws \InvalidArgumentException Si $db est null lors de la première initialisation
     */
    public static function getInstance(?PDO $db = null): self
    {
        if (self::$instance === null) {
            if ($db === null) {
                throw new \InvalidArgumentException("PDO instance required for initialization");
            }
            self::$instance = new self($db);
        }
        return self::$instance;
    }

    /**
     * Vérifie si l'instance est initialisée
     */
    public static function isInitialized(): bool
    {
        return self::$isInitialized && self::$instance !== null;
    }

    /**
     * Réinitialiser l'instance (utile pour les tests ou pour changer de connexion)
     *
     * @return void
     */
    public static function resetInstance(): void
    {
        // Fermer la connexion PDO si elle existe
        if (self::$instance && self::$instance->db) {
            self::$instance->db = null;
        }

        self::$instance      = null;
        self::$isInitialized = false; // ✅ CORRECTION : réinitialiser le flag aussi
    }

    /**
     * Initialiser SqlManager avec les paramètres de connexion à la base de données
     *
     * @param string $host Hôte de la base de données
     * @param string $dbname Nom de la base de données
     * @param string $username Nom d'utilisateur
     * @param string $password Mot de passe
     * @param array $options Options de connexion PDO optionnelles
     * @return self Instance de SqlManager
     * @throws PDOException En cas d'erreur de connexion
     */
    public static function initWithParams(
        string $host,
        string $dbname,
        string $username,
        string $password,
        array $options = []
    ): self {
        // Options PDO par défaut si non fournies
        $defaultOptions = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        // Ajouter l'option MySQL seulement si ce n'est pas surchargé
        if (! isset($options[PDO::MYSQL_ATTR_INIT_COMMAND])) {
            $defaultOptions[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci";
        }

        // Fusionner les options par défaut avec les options fournies
        $connectionOptions = array_merge($defaultOptions, $options);

        // Validation des types d'attributs pour éviter les erreurs
        $validatedOptions = [];
        foreach ($connectionOptions as $attribute => $value) {
            // S'assurer que les clés d'attributs sont des entiers
            if (is_string($attribute) && defined($attribute)) {
                $attribute = constant($attribute);
            }

            // Validation spécifique pour certains attributs
            switch ($attribute) {
                case PDO::ATTR_ERRMODE:
                case PDO::ATTR_DEFAULT_FETCH_MODE:
                    $validatedOptions[(int) $attribute] = (int) $value;
                    break;
                case PDO::ATTR_EMULATE_PREPARES:
                    $validatedOptions[(int) $attribute] = (bool) $value;
                    break;
                default:
                    $validatedOptions[(int) $attribute] = $value;
                    break;
            }
        }

        try {
            // Version simplifiée sans options par défaut pour diagnostic
            $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";

            // Utiliser seulement les options fournies par l'utilisateur
            $pdo = new PDO($dsn, $username, $password, $options);

            // Configurer après la connexion
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);

            // Test de connexion simple
            $pdo->query("SELECT 1");

            // Réinitialiser l'instance avant de créer une nouvelle
            self::resetInstance();

            // Initialiser et retourner l'instance SqlManager
            return self::getInstance($pdo);

        } catch (PDOException $e) {
            // Log l'erreur si possible
            if (class_exists('\Commun\Logger\Logger')) {
                try {
                    $logger = Logger::getInstance()->getLogger();
                    $logger->error("Erreur de connexion PDO", [
                        'host'     => $host,
                        'database' => $dbname,
                        'user'     => $username,
                        'error'    => $e->getMessage(),
                        'options'  => $validatedOptions,
                    ]);
                } catch (\Exception $logError) {
                    // Ignore les erreurs de log
                }
            }

            throw new PDOException("Connexion à la base de données échouée: " . $e->getMessage(), (int) $e->getCode(), $e);
        }
    }

    /**
     * Obtenir l'instance initialisée de SqlManager
     *
     * @return self Instance de SqlManager
     * @throws \Exception Si SqlManager n'a pas été initialisé
     */
    public static function getInitializedInstance(): self
    {
        if (self::$instance === null || ! self::$isInitialized) {
            throw new \Exception("SqlManager has not been initialized. Call initWithParams() first.");
        }
        return self::$instance;
    }

    /**
     * Définir les tables autorisées pour les opérations
     *
     * @param array $tables Liste des noms de tables autorisés
     * @return self Instance de SqlManager pour le chaînage
     */
    public function setAllowedTables(array $tables): self
    {
        $this->allowedTables = $tables;
        return $this;
    }

    /**
     * Vérifier si une table est autorisée
     *
     * @param string $table Nom de la table à vérifier
     * @return bool True si la table est autorisée, false sinon
     */
    private function isTableAllowed(string $table): bool
    {
        // Si aucune table autorisée n'est définie, on autorise toutes les tables
        if (empty($this->allowedTables)) {
            return true;
        }

        return in_array($table, $this->allowedTables, true);
    }

    /**
     * Teste la connectivité avec la base de données
     *
     * @return bool True si la connexion est opérationnelle, false sinon
     */
    public function testConnection(): bool
    {
        try {
            $stmt = $this->db->query("SELECT 1 as test");
            return $stmt !== false;
        } catch (PDOException $e) {
            $this->logger->error("Test de connexion échoué", [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Préparer une requête SQL
     *
     * @param string $sql Requête SQL à préparer
     * @return \PDOStatement Déclaration préparée
     * @throws PDOException En cas d'erreur de préparation
     */
    public function prepare(string $sql): \PDOStatement
    {
        try {
            return $this->db->prepare($sql);
        } catch (PDOException $e) {
            $this->logger->error("Erreur de préparation SQL", [
                'sql'   => $sql,
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Exécuter une requête SQL simple
     *
     * @param string $sql Requête SQL à exécuter
     * @param array $params Paramètres à lier à la requête
     * @return array Résultat avec statut d'erreur et nombre de lignes affectées
     */
    public function execute(string $sql, array $params = []): array
    {
        try {
            $stmt = $this->db->prepare($sql);

            foreach ($params as $key => $value) {
                $param = is_numeric($key) ? $key + 1 : ":" . ltrim($key, ":");
                $stmt->bindValue($param, $value);
            }

            $stmt->execute();

            return [
                'error'        => 0,
                'rowCount'     => $stmt->rowCount(),
                'lastInsertId' => $this->db->lastInsertId(),
            ];
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL EXECUTE", [
                'sql'    => $sql,
                'params' => $params,
                'error'  => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'rowCount' => 0,
            ];
        }
    }

    /**
     * Exécuter une requête SELECT
     *
     * @param string $sql Requête SQL à exécuter
     * @param array $params Paramètres à lier à la requête
     * @param int $fetchMode Mode de récupération des données
     * @return array Résultat avec statut d'erreur et données récupérées
     */
    public function query(string $sql, array $params = [], int $fetchMode = PDO::FETCH_ASSOC): array
    {
        try {
            $stmt = $this->db->prepare($sql);

            foreach ($params as $key => $value) {
                $param = is_numeric($key) ? $key + 1 : ":" . ltrim($key, ":");
                $stmt->bindValue($param, $value);
            }

            $stmt->execute();

            return [
                'error'    => 0,
                'data'     => $stmt->fetchAll($fetchMode),
                'rowCount' => $stmt->rowCount(),
            ];
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL QUERY", [
                'sql'    => $sql,
                'params' => $params,
                'error'  => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'data'     => [],
                'rowCount' => 0,
            ];
        }
    }

    /**
     * Récupérer une seule ligne
     *
     * @param string $sql Requête SQL à exécuter
     * @param array $params Paramètres à lier à la requête
     * @param int $fetchMode Mode de récupération des données
     * @return array Résultat avec statut d'erreur et données récupérées
     */
    public function queryOne(string $sql, array $params = [], int $fetchMode = PDO::FETCH_ASSOC): array
    {
        try {
            $stmt = $this->db->prepare($sql);

            foreach ($params as $key => $value) {
                $param = is_numeric($key) ? $key + 1 : ":" . ltrim($key, ":");
                $stmt->bindValue($param, $value);
            }

            $stmt->execute();
            $result = $stmt->fetch($fetchMode);

            return [
                'error' => 0,
                'data'  => $result ?: null,
                'found' => $result !== false,
            ];
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL QUERY_ONE", [
                'sql'    => $sql,
                'params' => $params,
                'error'  => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'data'     => null,
                'found'    => false,
            ];
        }
    }

    /**
     * Insérer des données dans une table
     *
     * @param string $table Nom de la table
     * @param array $data Données à insérer (clé => valeur)
     * @return array Résultat avec statut d'erreur et ID inséré
     */
    public function insert(string $table, array $data): array
    {
        if (! $this->isTableAllowed($table)) {
            return [
                'error'    => 1,
                'msgError' => "Table '$table' non autorisée",
                'id'       => null,
            ];
        }

        try {
            $columns = implode(", ", array_map(function ($col) {
                return "`" . str_replace("`", "``", $col) . "`";
            }, array_keys($data)));

            $placeholders = ":" . implode(", :", array_keys($data));
            $sql          = "INSERT INTO `" . str_replace("`", "``", $table) . "` ($columns) VALUES ($placeholders)";

            $stmt = $this->db->prepare($sql);

            foreach ($data as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }

            $stmt->execute();

            return [
                'error' => 0,
                'id'    => $this->db->lastInsertId(),
            ];
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL INSERT", [
                'table' => $table,
                'data'  => $data,
                'error' => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'id'       => null,
            ];
        }
    }

    /**
     * Mettre à jour des données dans une table
     *
     * @param string $table Nom de la table
     * @param array $data Données à mettre à jour (clé => valeur)
     * @param string $where Condition WHERE (sans le mot-clé WHERE)
     * @param array $whereParams Paramètres pour la condition WHERE
     * @return array Résultat avec statut d'erreur et nombre de lignes affectées
     */
    public function update(string $table, array $data, string $where, array $whereParams = []): array
    {
        if (! $this->isTableAllowed($table)) {
            return [
                'error'    => 1,
                'msgError' => "Table '$table' non autorisée",
                'rowCount' => 0,
            ];
        }

        try {
            $sets = [];
            foreach ($data as $key => $value) {
                $sets[] = "`" . str_replace("`", "``", $key) . "` = :set_" . $key;
            }

            $sql = "UPDATE `" . str_replace("`", "``", $table) . "` SET " .
            implode(", ", $sets) .
                " WHERE " . $where;

            $stmt = $this->db->prepare($sql);

            // Lier les paramètres SET
            foreach ($data as $key => $value) {
                $stmt->bindValue(":set_$key", $value);
            }

            // Lier les paramètres WHERE
            foreach ($whereParams as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }

            $stmt->execute();

            return [
                'error'    => 0,
                'rowCount' => $stmt->rowCount(),
            ];
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL UPDATE", [
                'table'       => $table,
                'data'        => $data,
                'where'       => $where,
                'whereParams' => $whereParams,
                'error'       => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'rowCount' => 0,
            ];
        }
    }

    /**
     * Supprimer des données d'une table
     *
     * @param string $table Nom de la table
     * @param string $where Condition WHERE (sans le mot-clé WHERE)
     * @param array $params Paramètres pour la condition WHERE
     * @return array Résultat avec statut d'erreur et nombre de lignes affectées
     */
    public function delete(string $table, string $where, array $params = []): array
    {
        if (! $this->isTableAllowed($table)) {
            return [
                'error'    => 1,
                'msgError' => "Table '$table' non autorisée",
                'rowCount' => 0,
            ];
        }

        try {
            $sql  = "DELETE FROM `" . str_replace("`", "``", $table) . "` WHERE " . $where;
            $stmt = $this->db->prepare($sql);

            foreach ($params as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }

            $stmt->execute();

            return [
                'error'    => 0,
                'rowCount' => $stmt->rowCount(),
            ];
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL DELETE", [
                'table'  => $table,
                'where'  => $where,
                'params' => $params,
                'error'  => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'rowCount' => 0,
            ];
        }
    }

    /**
     * Insérer ou mettre à jour des données dans une table
     *
     * @param string $table Nom de la table
     * @param array $data Données à insérer ou mettre à jour
     * @param array $uniqueColumns Colonnes servant de critères d'unicité (clé => valeur)
     * @param string $primaryKey Nom de la clé primaire (par défaut 'id')
     * @return array Résultat avec statut d'erreur et ID inséré/mis à jour
     */
    public function insertOrUpdate(string $table, array $data, array $uniqueColumns, string $primaryKey = 'id'): array
    {
        if (! $this->isTableAllowed($table)) {
            return [
                'error'    => 1,
                'msgError' => "Table '$table' non autorisée",
                'id'       => null,
            ];
        }

        try {
            // Vérifier si l'enregistrement existe
            $conditions = [];
            $params     = [];

            foreach ($uniqueColumns as $column => $value) {
                $conditions[]               = "`" . str_replace("`", "``", $column) . "` = :check_" . $column;
                $params["check_" . $column] = $value;
            }

            $sql = "SELECT `" . str_replace("`", "``", $primaryKey) . "` FROM `" .
            str_replace("`", "``", $table) . "` WHERE " .
            implode(" AND ", $conditions);

            $stmt = $this->db->prepare($sql);

            foreach ($params as $key => $value) {
                $stmt->bindValue(":" . $key, $value);
            }

            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($result) {
                // Update
                $id           = $result[$primaryKey];
                $updateResult = $this->update(
                    $table,
                    $data,
                    "`" . str_replace("`", "``", $primaryKey) . "` = :id",
                    ['id' => $id]
                );

                return [
                    'error'    => $updateResult['error'],
                    'msgError' => $updateResult['error'] ? $updateResult['msgError'] : null,
                    'id'       => $id,
                    'action'   => 'update',
                ];
            } else {
                // Insert
                $insertResult = $this->insert($table, $data);

                return [
                    'error'    => $insertResult['error'],
                    'msgError' => $insertResult['error'] ? $insertResult['msgError'] : null,
                    'id'       => $insertResult['id'],
                    'action'   => 'insert',
                ];
            }
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL INSERT/UPDATE", [
                'table'         => $table,
                'data'          => $data,
                'uniqueColumns' => $uniqueColumns,
                'error'         => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'id'       => null,
            ];
        }
    }

    /**
     * Insérer des données dans une table si aucun enregistrement correspondant aux colonnes uniques n'existe
     *
     * @param string $table Nom de la table
     * @param array $data Données à insérer
     * @param array $uniqueColumns Colonnes servant de critères d'unicité (clé => valeur)
     * @param string $primaryKey Nom de la clé primaire (par défaut 'id')
     * @return array Résultat avec statut d'erreur et ID inséré
     */
    public function insertIfAbsent(string $table, array $data, array $uniqueColumns, string $primaryKey = 'id'): array
    {
        if (! $this->isTableAllowed($table)) {
            return [
                'error'    => 1,
                'msgError' => "Table '$table' non autorisée",
                'id'       => null,
            ];
        }

        try {
            // Construire la clause WHERE pour vérifier l'existence
            $conditions = [];
            $params     = [];

            foreach ($uniqueColumns as $column => $value) {
                $conditions[]               = "`" . str_replace("`", "``", $column) . "` = :check_" . $column;
                $params["check_" . $column] = $value;
            }

            $sql = "SELECT COUNT(*) as count FROM `" .
            str_replace("`", "``", $table) . "` WHERE " .
            implode(" AND ", $conditions);

            $stmt = $this->db->prepare($sql);

            foreach ($params as $key => $value) {
                $stmt->bindValue(":" . $key, $value);
            }

            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            // Si aucun enregistrement trouvé, insérer
            if ((int) $result['count'] === 0) {
                return $this->insert($table, $data);
            } else {
                $sql = "SELECT `" . str_replace("`", "``", $primaryKey) . "` FROM `" .
                str_replace("`", "``", $table) . "` WHERE " .
                implode(" AND ", $conditions);

                $stmt = $this->db->prepare($sql);

                foreach ($params as $key => $value) {
                    $stmt->bindValue(":" . $key, $value);
                }

                $stmt->execute();
                $result = $stmt->fetch(PDO::FETCH_ASSOC);

                return [
                    'error' => 0,
                    'msg'   => 'Record already exists',
                    'id'    => $result[$primaryKey],
                ];
            }
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL INSERT IF ABSENT", [
                'table'         => $table,
                'data'          => $data,
                'uniqueColumns' => $uniqueColumns,
                'error'         => $e->getMessage(),
            ]);

            return [
                'error'    => 1,
                'msgError' => $e->getMessage(),
                'id'       => null,
            ];
        }
    }

    /**
     * Démarrer une transaction
     *
     * @return bool True si la transaction a été démarrée avec succès, false sinon
     */
    public function beginTransaction(): bool
    {
        try {
            return $this->db->beginTransaction();
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL BEGIN TRANSACTION", [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Valider une transaction
     *
     * @return bool True si la transaction a été validée avec succès, false sinon
     */
    public function commit(): bool
    {
        try {
            return $this->db->commit();
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL COMMIT", [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Annuler une transaction
     *
     * @return bool True si la transaction a été annulée avec succès, false sinon
     */
    public function rollBack(): bool
    {
        try {
            return $this->db->rollBack();
        } catch (PDOException $e) {
            $this->logger->error("Erreur SQL ROLLBACK", [
                'error' => $e->getMessage(),
            ]);
            return false;
        }
    }

    /**
     * Vérifier si une transaction est active
     *
     * @return bool True si une transaction est active, false sinon
     */
    public function inTransaction(): bool
    {
        return $this->db->inTransaction();
    }

    /**
     * Obtenir l'instance PDO sous-jacente
     *
     * @return PDO Instance PDO
     */
    public function getPDO(): PDO
    {
        return $this->db;
    }

    /**
     * ✅ AMÉLIORATION : Obtenir des informations sur la connexion
     *
     * @return array Informations sur la connexion
     */
    public function getConnectionInfo(): array
    {
        try {
            $info = [
                'driver'            => $this->db->getAttribute(PDO::ATTR_DRIVER_NAME),
                'version'           => $this->db->getAttribute(PDO::ATTR_SERVER_VERSION),
                'connection_status' => $this->db->getAttribute(PDO::ATTR_CONNECTION_STATUS),
                'charset'           => $this->db->query("SELECT @@character_set_connection")->fetchColumn(),
                'database'          => $this->db->query("SELECT DATABASE()")->fetchColumn(),
            ];
            return $info;
        } catch (PDOException $e) {
            $this->logger->error("Erreur lors de la récupération des infos de connexion", [
                'error' => $e->getMessage(),
            ]);
            return [];
        }
    }
}
