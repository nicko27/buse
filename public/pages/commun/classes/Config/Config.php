<?php
namespace Commun\Config;

/**
 * Classe centrale de configuration applicative
 *
 * - Lit le .env pour les variables d'environnement
 * - Se fait alimenter par une source de données via BDDManager
 * - Typage dynamique selon la colonne `typeval`
 * - Expose un accès centralisé, sans define()
 * - Compatible avec un accès direct (array) ou via méthode
 * - Gère la liste des variables à injecter dans Twig
 *
 * @package Commun\Config
 * @author Application Framework
 * @version 1.0
 *
 * Types de valeurs supportés pour typeval:
 * - 'int', 'integer': Conversion en entier
 * - 'float', 'double': Conversion en nombre à virgule flottante
 * - 'bool', 'boolean': Conversion en booléen (supporte 'true', 'yes', 'on', 'oui', '1')
 * - 'json', 'array': Décodage JSON en tableau associatif
 * - 'date', 'datetime': Retourne la valeur telle quelle (peut être étendu pour DateTime)
 * - 'string' ou autre: Conversion en chaîne de caractères (par défaut)
 */
class Config
{
    /** @var self|null Instance unique (singleton) */
    private static ?Config $instance = null;

    /** @var array<string, mixed> Variables d'environnement du .env */
    private array $envVars = [];

    /** @var array<string, mixed> Configuration applicative typée */
    private array $config = [];

    /** @var array<string, array<string, mixed>> Métadonnées de configuration */
    private array $meta = [];

    /** @var array<string, mixed> Variables à injecter dans Twig */
    private array $twigVars = [];

    /** @var bool Indique si la configuration BDD a été chargée */
    private bool $databaseLoaded = false;

    /** @var bool Mode debug pour les logs */
    private bool $debugMode = false;

    /**
     * Retourne l'instance unique de configuration
     *
     * @return self Instance unique
     */
    public static function getInstance(): self
    {
        if (! self::$instance) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Constructeur privé : lit seulement le .env
     */
    private function __construct()
    {
        $this->loadEnv();
        // CORRECTION 1: Récupérer la vraie valeur de DEBUG_MODE au lieu d'une expression booléenne
        $this->debugMode = $this->get('DEBUG_MODE', false) ||
            ($this->get('TWIG_DEBUG', false) || $this->get('ENV') === 'dev');
    }

    /**
     * Charge les variables d'environnement à partir du .env avec vlucas/phpdotenv
     *
     * @return void
     * @throws \Exception Si erreur lors du chargement du .env
     */
    private function loadEnv(): void
    {
        $envPath = $this->findEnvPath();
        if (! $envPath) {
            return; // Pas de fichier .env trouvé
        }

        try {
            $dotenv = \Dotenv\Dotenv::createImmutable($envPath);
            $dotenv->safeLoad(); // safeLoad n'écrase pas les variables déjà définies

            // Copier dans notre tableau local pour compatibilité
            foreach ($_ENV as $key => $value) {
                $this->envVars[$key] = $value;
            }
        } catch (\Exception $e) {
            throw new \Exception("Erreur lors du chargement du fichier .env : " . $e->getMessage());
        }
    }

    /**
     * Trouve le répertoire contenant le fichier .env
     *
     * @return string|null Chemin vers le répertoire contenant .env ou null si non trouvé
     */
    private function findEnvPath(): ?string
    {
        $currentDir = __DIR__;
        $maxLevels  = 6; // Limite pour éviter les boucles infinies

        for ($i = 0; $i < $maxLevels; $i++) {
            $envFile = $currentDir . '/.env';
            if (file_exists($envFile)) {
                return $currentDir;
            }

            $parentDir = dirname($currentDir);
            if ($parentDir === $currentDir) {
                break; // Racine atteinte
            }
            $currentDir = $parentDir;
        }

        // Vérifier le chemin par défaut
        $defaultPath = dirname(__DIR__, 3);
        if (file_exists($defaultPath . '/.env')) {
            return $defaultPath;
        }

        return null;
    }

    /**
     * Charge la configuration depuis une source de données
     *
     * @param \Commun\Database\BDDManager $dbManager Gestionnaire de base de données
     * @return void
     * @throws \Exception Si erreur lors du chargement
     */
    public function loadFromDatabase(\Commun\Database\BDDManager $dbManager): void
    {
        try {
            // CORRECTION 21: Vérifier que les tables existent avant de les utiliser
            if (! $dbManager->tableExists('configuration_types')) {
                throw new \Exception("Table 'configuration_types' non trouvée");
            }

            if (! $dbManager->tableExists('configuration')) {
                throw new \Exception("Table 'configuration' non trouvée");
            }

            // Récupérer les types pour typage automatique
            $types = [];
            try {
                $typesData = $dbManager->getAllContentTable('configuration_types');
                foreach ($typesData as $row) {
                    $types[$row['id']] = $row;
                }
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors du chargement des types de configuration : " . $e->getMessage());
            }

            // Charger la configuration principale
            try {
                $configData = $dbManager->getAllContentTable('configuration');
            } catch (\Exception $e) {
                throw new \Exception("Erreur lors du chargement de la configuration : " . $e->getMessage());
            }

            // Réinitialiser les données
            $this->config   = [];
            $this->meta     = [];
            $this->twigVars = [];

            foreach ($configData as $row) {
                $var     = $row['var'];
                $value   = $row['value'];
                $typeval = $row['typeval'] ?? null;
                $typeId  = $row['configuration_type_id'] ?? null;

                // Détecter le type à utiliser (priorité à typeval si présent)
                $type = $typeval;
                if (! $type && $typeId && isset($types[$typeId])) {
                    $type = $types[$typeId]['code'] ?? null;
                }

                $typedValue = $this->castValue($value, $type);

                $this->config[$var] = $typedValue;
                $this->meta[$var]   = $row;

                // Préparer les variables à injecter dans Twig si twig=1
                if (! empty($row['twig'])) {
                    $this->twigVars[$var] = $typedValue;
                }
            }

            $this->databaseLoaded = true;

        } catch (\Exception $e) {
            throw new \Exception("Erreur lors du chargement de la configuration : " . $e->getMessage());
        }
    }

    /**
     * Retourne la valeur d'une variable (env ou config)
     *
     * @param string $key Nom de la variable
     * @param mixed $default Valeur par défaut
     * @return mixed La valeur de la variable ou la valeur par défaut
     */
    public function get(string $key, $default = null)
    {
        // Priorité : 1. Config BDD, 2. Variables d'environnement, 3. Défaut
        if (isset($this->config[$key])) {
            return $this->config[$key];
        }

        if (isset($this->envVars[$key])) {
            return $this->envVars[$key];
        }

        // Fallback sur getenv() si pas dans envVars
        $envValue = getenv($key);
        if ($envValue !== false) {
            return $envValue;
        }

        return $default;
    }

    /**
     * Retourne toutes les variables de configuration (BDD uniquement)
     *
     * @return array<string, mixed> Variables de configuration
     */
    public function all(): array
    {
        return $this->config;
    }

    /**
     * Retourne toutes les variables d'environnement
     *
     * @return array<string, mixed> Variables d'environnement
     */
    public function getAllEnv(): array
    {
        return $this->envVars;
    }

    /**
     * Retourne toutes les variables à injecter dans Twig
     *
     * @return array<string, mixed> Variables Twig
     */
    public function getTwigVars(): array
    {
        return $this->twigVars;
    }

    /**
     * Retourne les métadonnées d'une variable
     *
     * @param string $key Nom de la variable
     * @return array<string, mixed>|null Métadonnées ou null si non trouvées
     */
    public function getMeta(string $key): ?array
    {
        return $this->meta[$key] ?? null;
    }

    /**
     * Indique si la configuration BDD a été chargée
     *
     * @return bool True si chargée, false sinon
     */
    public function isDatabaseLoaded(): bool
    {
        return $this->databaseLoaded;
    }

    /**
     * Recharge la configuration depuis la base de données
     *
     * @param \Commun\Database\BDDManager $dbManager Gestionnaire de base de données
     * @return void
     * @throws \Exception Si erreur lors du rechargement
     */
    public function reload(\Commun\Database\BDDManager $dbManager): void
    {
        $this->loadFromDatabase($dbManager);
    }

    /**
     * Effectue le typage automatique en fonction du type
     *
     * @param mixed $value Valeur à typer
     * @param string|null $type Type de destination
     * @return mixed Valeur typée
     */
    private function castValue($value, ?string $type)
    {
        if ($value === null) {
            return null;
        }

        switch ($type) {
            case 'int':
            case 'integer':
                return (int) $value;

            case 'float':
            case 'double':
                return (float) $value;

            case 'bool':
            case 'boolean':
                if (is_string($value)) {
                    return in_array(strtolower($value), ['1', 'true', 'yes', 'on', 'oui']);
                }
                return (bool) $value;

            case 'json':
            case 'array':
                if (is_string($value)) {
                    $decoded = json_decode($value, true);
                    if (json_last_error() === JSON_ERROR_NONE) {
                        return $decoded;
                    }
                }
                return $value;

            case 'date':
            case 'datetime':
                // Retourne la valeur telle quelle, peut être étendu pour DateTime
                return $value;

            case 'string':
            default:
                return (string) $value;
        }
    }

    // --- SUPPRESSION de l'implémentation ArrayAccess (problème 37) ---
    // L'interface ArrayAccess n'est pas vraiment utilisée ailleurs dans le code
    // et complique inutilement la classe. Suppression complète.
}
