<?php
namespace Commun\Config;

use ArrayAccess;

/**
 * Classe centrale de configuration applicative
 *
 * - Lit le .env pour les variables d'environnement
 * - Se fait alimenter par une source de données via BDDManager
 * - Typage dynamique selon la colonne `typeval`
 * - Expose un accès centralisé, sans define()
 * - Compatible avec un accès direct (array) ou via méthode
 * - Gère la liste des variables à injecter dans Twig
 */
class Config implements ArrayAccess
{
    /** @var self|null Singleton */
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
        $this->envVars['DEBUG_MODE'] = $this->get('TWIG_DEBUG', false) || $this->get('ENV') === 'dev';
    }

    /**
     * Charge les variables d'environnement à partir du .env avec vlucas/phpdotenv
     */
    private function loadEnv(): void
    {
        $envPath = $this->findEnvPath();
        if (! $envPath) {
            return; // Pas de fichier .env trouvé
        }

        $dotenv = \Dotenv\Dotenv::createImmutable($envPath);
        $dotenv->safeLoad(); // safeLoad n'écrase pas les variables déjà définies

        // Copier dans notre tableau local pour compatibilité
        foreach ($_ENV as $key => $value) {
            $this->envVars[$key] = $value;
        }
        $this->buildPagesAndSubpagesArrays();
    }

    /**
     * Trouve le répertoire contenant le fichier .env
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
     * @throws \Exception Si erreur lors du chargement
     */
    public function loadFromDatabase(\Commun\Database\BDDManager $dbManager): void
    {
        try {
            // Récupérer les types pour typage automatique
            $types     = [];
            $typesData = $dbManager->getAllContentTable('configuration_types');
            foreach ($typesData as $row) {
                $types[$row['id']] = $row;
            }

            // Charger la configuration principale
            $configData = $dbManager->getAllContentTable('configuration');

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
            $this->buildPagesAndSubpagesArrays();

        } catch (\Exception $e) {
            throw new \Exception("Erreur lors du chargement de la configuration : " . $e->getMessage());
        }
    }

    /**
     * Retourne la valeur d'une variable (env ou config)
     *
     * @param string $key Nom de la variable
     * @param mixed $default Valeur par défaut
     * @return mixed
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
     */
    public function all(): array
    {
        return $this->config;
    }

    /**
     * Retourne toutes les variables d'environnement
     */
    public function getAllEnv(): array
    {
        return $this->envVars;
    }

    /**
     * Retourne toutes les variables à injecter dans Twig
     */
    public function getTwigVars(): array
    {
        return $this->twigVars;
    }

    /**
     * Retourne les métadonnées d'une variable
     */
    public function getMeta(string $key): ?array
    {
        return $this->meta[$key] ?? null;
    }

    /**
     * Indique si la configuration BDD a été chargée
     */
    public function isDatabaseLoaded(): bool
    {
        return $this->databaseLoaded;
    }

    /**
     * Recharge la configuration depuis la base de données
     *
     * @param \Commun\Database\BDDManager $dbManager Gestionnaire de base de données
     */
    public function reload(\Commun\Database\BDDManager $dbManager): void
    {
        $this->loadFromDatabase($dbManager);
    }

    /**
     * Construit les tableaux PAGES_LIST et SUBPAGES_MAIN_LIST à partir des variables de configuration
     */
    private function buildPagesAndSubpagesArrays(): void
    {
        if ($this->debugMode) {
            error_log("Config: Construction des tableaux PAGES et SUBPAGES");
        }

        $pages    = [];
        $subpages = [];

        // Préserver les tableaux existants s'ils existent déjà
        if (isset($this->config['PAGES_LIST']) && is_array($this->config['PAGES_LIST'])) {
            $pages = $this->config['PAGES_LIST'];
        }
        if (isset($this->config['SUBPAGES_MAIN_LIST']) && is_array($this->config['SUBPAGES_MAIN_LIST'])) {
            $subpages = $this->config['SUBPAGES_MAIN_LIST'];
        }

        // Chercher dans TOUTES les sources (BDD ET .env)
        $allConfig = array_merge($this->envVars, $this->config);

        $pagesCount    = 0;
        $subpagesCount = 0;

        foreach ($allConfig as $key => $value) {
            // Construire le tableau des pages (PAGES_0, PAGES_1, etc.)
            if (str_starts_with($key, 'PAGES_')) {
                $suffix = substr($key, 6); // Récupérer ce qui suit "PAGES_"
                if (is_numeric($suffix)) {
                    $pageId         = (int) $suffix;
                    $pages[$pageId] = $value;
                    $pagesCount++;
                }
            }

            // Construire le tableau des sous-pages (SUBPAGES_0, SUBPAGES_1, etc.)
            if (str_starts_with($key, 'SUBPAGES_')) {
                $suffix = substr($key, 9); // Récupérer ce qui suit "SUBPAGES_"
                if (is_numeric($suffix)) {
                    $subpageId            = (int) $suffix;
                    $subpages[$subpageId] = $value;
                    $subpagesCount++;
                }
            }
        }

        // Trier les tableaux par clé pour s'assurer de l'ordre
        ksort($pages);
        ksort($subpages);

        // Ajouter les tableaux à la configuration
        $this->config['PAGES_LIST']         = $pages;
        $this->config['SUBPAGES_MAIN_LIST'] = $subpages;

        // Ajouter aussi aux variables Twig
        $this->twigVars['PAGES_LIST']         = $pages;
        $this->twigVars['SUBPAGES_MAIN_LIST'] = $subpages;

        if ($this->debugMode && ($pagesCount > 0 || $subpagesCount > 0)) {
            error_log("Config: Construit $pagesCount pages et $subpagesCount sous-pages");
        }
    }

    /**
     * Debug : affiche toutes les clés de configuration qui commencent par PAGES_ ou SUBPAGES_
     */
    public function debugPagesConfig(): void
    {
        error_log("=== DEBUG Config PAGES ===");
        error_log("Variables CONFIG: " . count($this->config));
        error_log("Variables ENV: " . count($this->envVars));

        $pagesKeys = [];
        $allConfig = array_merge($this->envVars, $this->config);

        foreach ($allConfig as $key => $value) {
            if (str_starts_with($key, 'PAGES_') || str_starts_with($key, 'SUBPAGES_')) {
                $pagesKeys[] = "$key = " . (is_array($value) ? json_encode($value) : $value);
            }
        }

        error_log("Clés trouvées: " . implode(', ', $pagesKeys));
        error_log("PAGES_LIST final: " . json_encode($this->get('PAGES_LIST')));
        error_log("SUBPAGES_MAIN_LIST final: " . json_encode($this->get('SUBPAGES_MAIN_LIST')));
        error_log("=== FIN DEBUG ===");
    }

    /**
     * Effectue le typage automatique en fonction du type
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

    // --- Implémentation ArrayAccess ---

    public function offsetExists(mixed $offset): bool
    {
        return $this->get($offset) !== null;
    }

    public function offsetGet(mixed $offset): mixed
    {
        return $this->get($offset);
    }

    public function offsetSet(mixed $offset, mixed $value): void
    {
        if ($offset === null) {
            throw new \InvalidArgumentException("Cannot append to Config array");
        }
        $this->config[$offset] = $value;
    }

    public function offsetUnset(mixed $offset): void
    {
        unset($this->config[$offset]);
        unset($this->meta[$offset]);
        unset($this->twigVars[$offset]);
    }
}
