<?php

namespace Commun\Database;

use Commun\Logger\Logger;
use PDO;
use PDOException;

class SqlManager
{
    private static $instance = null;
    private $logger;
    private $db;

    private function __construct(PDO $db)
    {
        $this->logger = Logger::getInstance()->getLogger();
        $this->db     = $db;
    }

    public static function getInstance(PDO $db = null): self
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
     * Initialize SqlManager with database connection parameters
     * @param string $host Database host
     * @param string $dbname Database name
     * @param string $username Database username
     * @param string $password Database password
     * @param array $options Optional PDO connection options
     * @return self
     * @throws \PDOException
     */
    public static function initWithParams(
        string $host,
        string $dbname,
        string $username,
        string $password,
        array $options = []
    ): self {
        // Default PDO options if not provided
        $defaultOptions = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ];

        // Merge default options with provided options
        $connectionOptions = array_merge($defaultOptions, $options);

        // Create PDO instance
        $dsn = "mysql:host={$host};dbname={$dbname};charset=utf8mb4";
        $pdo = new PDO($dsn, $username, $password, $connectionOptions);

        // Initialize and return SqlManager instance
        return self::getInstance($pdo);
    }

    /**
     * Prépare une requête SQL
     */
    public function prepare(string $sql)
    {
        return $this->db->prepare($sql);
    }

    /**
     * Insère des données dans une table
     */
    public function insert(string $table, array $data): array
    {
        try {
            $columns      = implode(", ", array_keys($data));
            $placeholders = ":" . implode(", :", array_keys($data));
            $sql          = "INSERT INTO $table ($columns) VALUES ($placeholders)";

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
     * Met à jour des données dans une table
     */
    public function update(string $table, array $data, string $where, array $whereParams = []): array
    {
        try {
            $sets = [];
            foreach ($data as $key => $value) {
                $sets[] = "$key = :set_$key";
            }
            $sql = sprintf(
                "UPDATE %s SET %s WHERE %s",
                $table,
                implode(", ", $sets),
                $where
            );

            $stmt = $this->db->prepare($sql);

            // Bind SET parameters
            foreach ($data as $key => $value) {
                $stmt->bindValue(":set_$key", $value);
            }

            // Bind WHERE parameters
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
     * Supprime des données d'une table
     */
    public function delete(string $table, string $where, array $params = []): array
    {
        try {
            $sql  = sprintf("DELETE FROM %s WHERE %s", $table, $where);
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
     * Insère ou met à jour des données dans une table
     */
    public function insertOrUpdate(string $table, array $data, array $uniqueColumns): array
    {
        try {
            // Vérifier si l'enregistrement existe
            $conditions = [];
            $params     = [];
            foreach ($uniqueColumns as $column => $value) {
                $conditions[]            = "$column = :check_$column";
                $params["check_$column"] = $value;
            }

            $sql  = sprintf("SELECT id FROM %s WHERE %s", $table, implode(" AND ", $conditions));
            $stmt = $this->db->prepare($sql);
            foreach ($params as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($result) {
                // Update
                $id = $result['id'];
                return $this->update($table, $data, "id = :id", ['id' => $id]);
            } else {
                // Insert
                return $this->insert($table, $data);
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
     * Explicitly initialize SqlManager if not already initialized
     * @return self
     * @throws \Exception if SqlManager has not been initialized
     */
    public static function getInitializedInstance(): self
    {
        if (self::$instance === null) {
            throw new \Exception("SqlManager has not been initialized. Call initWithParams() first.");
        }
        return self::$instance;
    }

    /**
     * Insère des données dans une table si aucun enregistrement correspondant à des colonnes uniques n'existe
     *
     * @param string $table Nom de la table
     * @param array $data Données à insérer (clé => valeur)
     * @param array $uniqueColumns Colonnes servant de critères d'unicité (clé => valeur)
     * @return array Résultat avec statut d'erreur et l'ID inséré (le cas échéant)
     */
    public function insertIfAbsent(string $table, array $data, array $uniqueColumns): array
    {
        try {
            // Construire la clause WHERE pour vérifier l'existence
            $conditions = [];
            $params     = [];
            foreach ($uniqueColumns as $column => $value) {
                $conditions[]            = "$column = :check_$column";
                $params["check_$column"] = $value;
            }

            $sql  = sprintf("SELECT COUNT(*) as count FROM %s WHERE %s", $table, implode(" AND ", $conditions));
            $stmt = $this->db->prepare($sql);

            foreach ($params as $key => $value) {
                $stmt->bindValue(":$key", $value);
            }

            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            // Si aucun enregistrement trouvé, insérer
            if ((int) $result['count'] === 0) {
                return $this->insert($table, $data);
            } else {
                $sql  = sprintf("SELECT id FROM %s WHERE %s", $table, implode(" AND ", $conditions));
                $stmt = $this->db->prepare($sql);

                foreach ($params as $key => $value) {
                    $stmt->bindValue(":$key", $value);
                }
                $stmt->execute();
                $result = $stmt->fetch(PDO::FETCH_ASSOC);
                return [
                    'error' => 0,
                    'msg'   => 'Record already exists',
                    'id'    => $result['id'],
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

}
