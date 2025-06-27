<?php
namespace Commun\Database;

require_once __DIR__ . '/BDDManager.php';

/**
 * Classe SqlAdapter - Adaptateur pour SqlManager implémentant l'interface BDDManager
 *
 * Cette classe permet d'utiliser SqlManager via l'interface BDDManager,
 * en adaptant les méthodes spécifiques de SqlManager aux méthodes définies dans BDDManager.
 * Elle fournit une couche d'abstraction pour rendre l'accès aux données indépendant
 * du type de base de données utilisé.
 */
class SqlAdapter implements BDDManager
{
    /** @var SqlManager Instance de SqlManager à adapter */
    private SqlManager $sqlManager;

    /** @var array<string> Cache des tables existantes */
    private array $tablesCache = [];

    /** @var bool Indique si le cache des tables a été initialisé */
    private bool $tablesCacheInitialized = false;

    /**
     * Constructeur
     *
     * @param SqlManager $sqlManager Instance de SqlManager à adapter
     */
    public function __construct(SqlManager $sqlManager)
    {
        $this->sqlManager = $sqlManager;
    }

    /**
     * Récupère toutes les lignes d'une table.
     *
     * @param string $table Nom de la table à lire
     * @return array<int, array<string, mixed>> Tableau de lignes associatives
     * @throws \Exception En cas d'erreur d'accès aux données
     */
    public function getAllContentTable(string $table): array
    {
        if (! $this->tableExists($table)) {
            throw new \Exception("La table '$table' n'existe pas ou n'est pas accessible");
        }

        $result = $this->sqlManager->query(
            "SELECT * FROM `" . $this->escapeName($table) . "`"
        );

        if ($result['error'] !== 0) {
            throw new \Exception(
                "Erreur lors de la lecture de la table '$table': " .
                ($result['msgError'] ?? 'Erreur inconnue')
            );
        }

        return $result['data'] ?? [];
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
            // Utiliser le cache si disponible
            if ($this->tablesCacheInitialized && in_array($table, $this->tablesCache)) {
                return true;
            }

            // Requête pour vérifier l'existence de la table
            $result = $this->sqlManager->query(
                "SELECT 1 FROM information_schema.tables
                 WHERE table_schema = DATABASE()
                 AND table_name = ?",
                [$table]
            );

            if ($result['error'] !== 0) {
                return false;
            }

            $exists = ! empty($result['data']);

            // Mettre à jour le cache si la table existe
            if ($exists && ! in_array($table, $this->tablesCache)) {
                $this->tablesCache[] = $table;
            }

            return $exists;

        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Retourne la liste des tables disponibles.
     *
     * @return array<string> Liste des noms de tables
     * @throws \Exception En cas d'erreur d'accès aux métadonnées
     */
    public function getAvailableTables(): array
    {
        if ($this->tablesCacheInitialized) {
            return $this->tablesCache;
        }

        try {
            $result = $this->sqlManager->query(
                "SELECT table_name
                 FROM information_schema.tables
                 WHERE table_schema = DATABASE()
                 ORDER BY table_name"
            );

            if ($result['error'] !== 0) {
                throw new \Exception(
                    "Erreur lors de la récupération des tables: " .
                    ($result['msgError'] ?? 'Erreur inconnue')
                );
            }

            $this->tablesCache            = array_column($result['data'], 'table_name');
            $this->tablesCacheInitialized = true;

            return $this->tablesCache;

        } catch (\Exception $e) {
            throw new \Exception("Impossible de récupérer la liste des tables: " . $e->getMessage());
        }
    }

    /**
     * Teste la connectivité avec la source de données.
     *
     * @return bool True si la connexion est opérationnelle, false sinon
     */
    public function testConnection(): bool
    {
        try {
            $result = $this->sqlManager->query("SELECT 1 as test");
            return $result['error'] === 0;
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
            'type'              => 'MySQL/MariaDB',
            'adapter'           => 'SqlAdapter',
            'connection_status' => 'unknown',
            'version'           => null,
            'charset'           => null,
            'database'          => null,
        ];

        try {
            // Test de connexion
            $info['connection_status'] = $this->testConnection() ? 'connected' : 'disconnected';

            if ($info['connection_status'] === 'connected') {
                // Version du serveur
                $result = $this->sqlManager->query("SELECT VERSION() as version");
                if ($result['error'] === 0 && ! empty($result['data'])) {
                    $info['version'] = $result['data'][0]['version'];
                }

                // Charset et base de données
                $result = $this->sqlManager->query(
                    "SELECT DATABASE() as db_name,
                            @@character_set_database as charset"
                );
                if ($result['error'] === 0 && ! empty($result['data'])) {
                    $data             = $result['data'][0];
                    $info['database'] = $data['db_name'];
                    $info['charset']  = $data['charset'];
                }

                // Nombre de tables
                $tables               = $this->getAvailableTables();
                $info['tables_count'] = count($tables);
                $info['tables']       = $tables;
            }

        } catch (\Exception $e) {
            $info['error'] = $e->getMessage();
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
     */
    public function clearTablesCache(): void
    {
        $this->tablesCache            = [];
        $this->tablesCacheInitialized = false;
    }

    /**
     * Retourne l'instance SqlManager sous-jacente (pour les cas avancés)
     *
     * @return SqlManager
     */
    public function getSqlManager(): SqlManager
    {
        return $this->sqlManager;
    }
}
