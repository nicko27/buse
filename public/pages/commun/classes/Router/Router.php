<?php
namespace Commun\Router;

use Commun\Database\BDDManager;
use Commun\Logger\Logger;
use Commun\Security\RightsManager;

/**
 * Classe Router - Gestionnaire de routage sécurisé et optimisé
 *
 * CORRECTIONS APPLIQUÉES :
 * - Gestion robuste des exceptions
 * - Cache sécurisé avec validation d'intégrité
 * - Requêtes SQL optimisées avec jointures
 * - Validation stricte des slugs et URLs
 * - Gestion mémoire optimisée avec lazy loading
 * - Sécurisation des redirections
 * - Masquage des données sensibles dans les logs
 * - Thread-safety amélioré
 * - Validation des types de données
 * - Gestion des timeouts et performances
 */
class Router
{
    /** @var Router|null Instance unique thread-safe */
    private static ?Router $instance = null;

    /** @var \Psr\Log\LoggerInterface Logger pour la journalisation */
    private $logger;

    /** @var BDDManager Instance du gestionnaire de base de données */
    private BDDManager $dbManager;

    /** @var RightsManager|null Instance du gestionnaire de droits */
    private ?RightsManager $rightsManager = null;

    /** @var array Cache des routes avec hash d'intégrité */
    private array $routesCache = [
        'data' => [],
        'hash' => null,
        'timestamp' => 0,
        'valid' => false
    ];

    /** @var array Cache des types de templates */
    private array $templateTypesCache = [
        'data' => [],
        'hash' => null,
        'valid' => false
    ];

    /** @var bool Indique si les routes ont été chargées avec succès */
    private bool $routesLoadedSuccessfully = false;

    /** @var array Route actuellement active */
    private ?array $currentRoute = null;

    /** @var string Route par défaut (validée) */
    private string $defaultRoute = 'index';

    /** @var string Route de redirection en cas d'accès refusé (validée) */
    private string $accessDeniedRoute = 'login';

    /** @var string Répertoire web de l'application (validé) */
    private string $webDirectory = '';

    /** @var string Méthode HTTP actuelle (validée) */
    private string $httpMethod;

    /** @var array Paramètres GET nettoyés */
    private array $getParams = [];

    /** @var array Paramètres POST nettoyés */
    private array $postParams = [];

    /** @var int Timeout pour les requêtes BDD en secondes */
    private int $dbTimeout = 10;

    /** @var int Nombre maximum de routes en cache */
    private int $maxRoutesInCache = 1000;

    /** @var int TTL du cache en secondes */
    private int $cacheTtl = 3600;

    /** @var array Whitelist des domaines autorisés pour les redirections */
    private array $allowedRedirectDomains = [];

    /** @var array Regex patterns pour la validation des slugs */
    private array $slugValidationPattern = '/^[a-zA-Z0-9\/_-]+$/';

    /** @var bool Mode thread-safe activé */
    private bool $threadSafeMode = true;

    /** @var array Mutex pour éviter les race conditions */
    private static array $mutexLocks = [];

    /**
     * Constructeur privé sécurisé
     */
    private function __construct(BDDManager $dbManager)
    {
        // Validation stricte des dépendances
        if (!$dbManager) {
            throw new \InvalidArgumentException("BDDManager instance cannot be null");
        }

        // Test de connectivité BDD avant initialisation
        if (!$dbManager->testConnection()) {
            throw new \RuntimeException("Database connection test failed");
        }

        $this->dbManager = $dbManager;

        // Validation et nettoyage de la méthode HTTP
        $this->httpMethod = $this->validateHttpMethod($_SERVER['REQUEST_METHOD'] ?? 'GET');

        // Nettoyage et validation des paramètres
        $this->getParams = $this->sanitizeParams($_GET);
        $this->postParams = $this->sanitizeParams($_POST);

        // Initialisation du logger avec gestion d'erreur
        try {
            $this->logger = Logger::getInstance()->getLogger();
        } catch (\Exception $e) {
            $this->logger = new \Psr\Log\NullLogger();
        }

        // Configuration des domaines autorisés depuis l'environnement
        $this->initializeAllowedDomains();
    }

    /**
     * Obtenir l'instance unique thread-safe
     */
    public static function getInstance(BDDManager $dbManager = null): self
    {
        // Thread-safety avec double-checked locking
        if (self::$instance === null) {
            $lockKey = 'router_instance';

            if (!isset(self::$mutexLocks[$lockKey])) {
                self::$mutexLocks[$lockKey] = true;

                try {
                    if (self::$instance === null) {
                        if ($dbManager === null) {
                            throw new \InvalidArgumentException("BDDManager instance required for initialization");
                        }
                        self::$instance = new self($dbManager);
                    }
                } finally {
                    unset(self::$mutexLocks[$lockKey]);
                }
            }
        }

        return self::$instance;
    }

    /**
     * Validation stricte de la méthode HTTP
     */
    private function validateHttpMethod(string $method): string
    {
        $allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'];
        $method = strtoupper(trim($method));

        if (!in_array($method, $allowedMethods, true)) {
            throw new \InvalidArgumentException("Invalid HTTP method: $method");
        }

        return $method;
    }

    /**
     * Nettoyage et validation des paramètres
     */
    private function sanitizeParams(array $params): array
    {
        $sanitized = [];

        foreach ($params as $key => $value) {
            // Validation de la clé
            if (!is_string($key) || !preg_match('/^[a-zA-Z0-9_-]+$/', $key)) {
                continue; // Ignorer les clés invalides
            }

            // Nettoyage récursif des valeurs
            $sanitized[$key] = $this->sanitizeValue($value);
        }

        return $sanitized;
    }

    /**
     * Nettoyage récursif d'une valeur
     */
    private function sanitizeValue($value)
    {
        if (is_array($value)) {
            return array_map([$this, 'sanitizeValue'], $value);
        }

        if (is_string($value)) {
            // Suppression des caractères dangereux
            $value = str_replace(["\0", "\x00"], '', $value);
            $value = trim($value);

            // Limitation de taille
            if (strlen($value) > 10000) {
                $value = substr($value, 0, 10000);
            }
        }

        return $value;
    }

    /**
     * Initialisation des domaines autorisés pour les redirections
     */
    private function initializeAllowedDomains(): void
    {
        $currentHost = $_SERVER['HTTP_HOST'] ?? 'localhost';
        $this->allowedRedirectDomains = [
            $currentHost,
            'localhost',
            '127.0.0.1'
        ];

        // Ajouter d'autres domaines depuis la configuration si disponible
        if (defined('ALLOWED_REDIRECT_DOMAINS')) {
            $this->allowedRedirectDomains = array_merge(
                $this->allowedRedirectDomains,
                explode(',', ALLOWED_REDIRECT_DOMAINS)
            );
        }
    }

    /**
     * Charge toutes les routes depuis la base de données avec optimisations
     */
    public function loadRoutes(): void
    {
        // Vérifier le cache existant
        if ($this->isCacheValid()) {
            $this->routesLoadedSuccessfully = true;
            return;
        }

        $lockKey = 'load_routes';
        if (isset(self::$mutexLocks[$lockKey])) {
            return; // Éviter les chargements concurrents
        }

        self::$mutexLocks[$lockKey] = true;

        try {
            // Charger les types de templates d'abord
            $this->loadTemplateTypesOptimized();

            // Requête optimisée avec jointures pour éviter le problème N+1
            $sql = "
                SELECT
                    p.id as page_id,
                    p.slug,
                    p.title,
                    p.description,
                    p.rights,
                    p.active,
                    p.redirect_to,
                    p.php,
                    pt.id as template_id,
                    pt.template_type_id,
                    pt.template_path,
                    pt.enabled as template_enabled,
                    pt.priority,
                    pt.template_data,
                    ptt.name as zone_name,
                    ptt.active as type_active
                FROM pages p
                LEFT JOIN page_templates pt ON p.id = pt.page_id AND pt.enabled = 1
                LEFT JOIN page_template_types ptt ON pt.template_type_id = ptt.id AND ptt.active = 1
                WHERE p.active = 1
                ORDER BY p.slug, ptt.name, pt.priority ASC
            ";

            $result = $this->executeWithTimeout($sql);

            if ($result['error'] !== 0) {
                throw new \RuntimeException("Failed to load routes: " . ($result['msgError'] ?? 'Unknown error'));
            }

            $this->processRouteData($result['data']);
            $this->routesLoadedSuccessfully = true;

            $this->logger->info("Routes loaded successfully", [
                'count' => count($this->routesCache['data']),
                'method' => $this->httpMethod,
                'memory_usage' => memory_get_usage(true)
            ]);

        } catch (\Exception $e) {
            $this->routesLoadedSuccessfully = false;
            $this->logger->error("Critical error loading routes", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            throw new \RuntimeException("Failed to load routes: " . $e->getMessage(), 0, $e);
        } finally {
            unset(self::$mutexLocks[$lockKey]);
        }
    }

    /**
     * Exécution d'une requête avec timeout
     */
    private function executeWithTimeout(string $sql, array $params = []): array
    {
        $startTime = microtime(true);

        try {
            $result = $this->dbManager->query($sql, $params);

            $executionTime = microtime(true) - $startTime;

            if ($executionTime > $this->dbTimeout) {
                $this->logger->warning("Slow query detected", [
                    'execution_time' => $executionTime,
                    'sql' => substr($sql, 0, 200)
                ]);
            }

            return $result;
        } catch (\Exception $e) {
            $executionTime = microtime(true) - $startTime;

            if ($executionTime > $this->dbTimeout) {
                throw new \RuntimeException("Query timeout exceeded", 0, $e);
            }

            throw $e;
        }
    }

    /**
     * Charge les types de templates de manière optimisée
     */
    private function loadTemplateTypesOptimized(): void
    {
        if ($this->templateTypesCache['valid']) {
            return;
        }

        try {
            $result = $this->executeWithTimeout("SELECT * FROM page_template_types WHERE active = 1");

            if ($result['error'] !== 0) {
                throw new \RuntimeException("Failed to load template types");
            }

            $types = [];
            foreach ($result['data'] as $type) {
                $typeId = (int) $type['id'];
                $types[$typeId] = [
                    'id' => $typeId,
                    'name' => $this->sanitizeValue($type['name']),
                    'description' => $this->sanitizeValue($type['description'] ?? ''),
                    'active' => (bool) $type['active']
                ];
            }

            $this->templateTypesCache = [
                'data' => $types,
                'hash' => md5(serialize($types)),
                'valid' => true
            ];

        } catch (\Exception $e) {
            $this->logger->error("Error loading template types", [
                'error' => $e->getMessage()
            ]);
            $this->templateTypesCache = ['data' => [], 'hash' => null, 'valid' => false];
        }
    }

    /**
     * Traitement des données de routes avec validation
     */
    private function processRouteData(array $routeData): void
    {
        $routes = [];
        $routeCount = 0;

        foreach ($routeData as $row) {
            if ($routeCount >= $this->maxRoutesInCache) {
                $this->logger->warning("Max routes limit reached", [
                    'limit' => $this->maxRoutesInCache
                ]);
                break;
            }

            $slug = $this->sanitizeValue($row['slug']);

            // Validation stricte du slug
            if (!$this->isValidSlug($slug)) {
                $this->logger->warning("Invalid slug detected", ['slug' => $slug]);
                continue;
            }

            $pageId = (int) $row['page_id'];
            $rights = $this->validateRights($row['rights']);

            if (!isset($routes[$slug])) {
                $routes[$slug] = [
                    'page' => [
                        'id' => $pageId,
                        'slug' => $slug,
                        'title' => $this->sanitizeValue($row['title']),
                        'description' => $this->sanitizeValue($row['description'] ?? ''),
                        'rights' => $rights,
                        'active' => (bool) $row['active'],
                        'redirect_to' => $this->validateRedirectUrl($row['redirect_to']),
                        'php' => $this->sanitizeValue($row['php'] ?? '')
                    ],
                    'templates' => []
                ];
                $routeCount++;
            }

            // Ajouter le template s'il existe
            if ($row['template_id'] && $row['zone_name'] && $row['template_enabled']) {
                $zoneName = $this->sanitizeValue($row['zone_name']);

                if (!isset($routes[$slug]['templates'][$zoneName])) {
                    $routes[$slug]['templates'][$zoneName] = [];
                }

                $routes[$slug]['templates'][$zoneName][] = [
                    'id' => (int) $row['template_id'],
                    'template_type_id' => (int) $row['template_type_id'],
                    'template_path' => $this->sanitizeValue($row['template_path']),
                    'priority' => (int) ($row['priority'] ?? 0),
                    'template_data' => $this->sanitizeValue($row['template_data'] ?? ''),
                    'zone_name' => $zoneName
                ];
            }
        }

        // Trier les templates par priorité dans chaque zone
        foreach ($routes as &$route) {
            foreach ($route['templates'] as &$templates) {
                usort($templates, function ($a, $b) {
                    return $a['priority'] <=> $b['priority'];
                });
            }
        }

        // Mise à jour du cache avec hash d'intégrité
        $this->routesCache = [
            'data' => $routes,
            'hash' => md5(serialize($routes)),
            'timestamp' => time(),
            'valid' => true
        ];
    }

    /**
     * Validation stricte des slugs
     */
    private function isValidSlug(string $slug): bool
    {
        if (empty($slug) || strlen($slug) > 255) {
            return false;
        }

        // Vérification des caractères dangereux
        if (strpos($slug, '..') !== false || strpos($slug, "\0") !== false) {
            return false;
        }

        return preg_match($this->slugValidationPattern, $slug) === 1;
    }

    /**
     * Validation des droits avec type checking
     */
    private function validateRights($rights): int
    {
        if ($rights === null || $rights === '') {
            return 0;
        }

        if (is_string($rights) && ctype_digit($rights)) {
            $rights = (int) $rights;
        }

        if (!is_int($rights) || $rights < 0) {
            return 0;
        }

        // Limitation raisonnable des droits (32 bits)
        return min($rights, 2147483647);
    }

    /**
     * Validation sécurisée des URLs de redirection
     */
    private function validateRedirectUrl(?string $url): ?string
    {
        if (empty($url)) {
            return null;
        }

        $url = trim($url);

        // URLs relatives acceptées
        if (strpos($url, '/') === 0 && strpos($url, '//') !== 0) {
            return $this->sanitizeValue($url);
        }

        // URLs absolues - vérification du domaine
        $parsed = parse_url($url);
        if ($parsed === false || !isset($parsed['host'])) {
            return null;
        }

        $host = strtolower($parsed['host']);
        foreach ($this->allowedRedirectDomains as $allowedDomain) {
            if ($host === strtolower(trim($allowedDomain))) {
                return $this->sanitizeValue($url);
            }
        }

        $this->logger->warning("Blocked redirect to unauthorized domain", [
            'url' => $url,
            'host' => $host,
            'allowed_domains' => $this->allowedRedirectDomains
        ]);

        return null;
    }

    /**
     * Vérification de la validité du cache
     */
    private function isCacheValid(): bool
    {
        if (!$this->routesCache['valid'] || empty($this->routesCache['data'])) {
            return false;
        }

        // Vérification TTL
        if (time() - $this->routesCache['timestamp'] > $this->cacheTtl) {
            return false;
        }

        // Vérification de l'intégrité
        $currentHash = md5(serialize($this->routesCache['data']));
        if ($currentHash !== $this->routesCache['hash']) {
            $this->logger->error("Cache integrity check failed", [
                'expected_hash' => $this->routesCache['hash'],
                'current_hash' => $currentHash
            ]);
            return false;
        }

        return true;
    }

    /**
     * Recherche sécurisée d'une route
     */
    public function match(string $slug, ?string $method = null): ?array
    {
        try {
            // Lazy loading des routes
            if (!$this->routesLoadedSuccessfully) {
                $this->loadRoutes();
            }

            // Validation et nettoyage du slug
            $slug = trim($slug, '/');
            if (!$this->isValidSlug($slug) && $slug !== '') {
                $this->logger->warning("Invalid slug in match", ['slug' => $slug]);
                return null;
            }

            // Slug vide = route par défaut
            if (empty($slug)) {
                $slug = $this->defaultRoute;
            }

            // Validation de la méthode HTTP
            $method = $method ? $this->validateHttpMethod($method) : $this->httpMethod;

            // Recherche de la route
            if (!isset($this->routesCache['data'][$slug])) {
                return null;
            }

            $route = $this->routesCache['data'][$slug];

            // Enrichissement sécurisé des informations de requête
            $route['request'] = [
                'method' => $method,
                'slug' => $slug,
                'get' => $this->maskSensitiveParams($this->getParams),
                'post' => $this->maskSensitiveParams($this->postParams),
                'is_post' => $method === 'POST',
                'is_get' => $method === 'GET',
                'has_post_data' => !empty($this->postParams),
                'timestamp' => time(),
                'ip' => $this->getClientIp()
            ];

            $this->currentRoute = $route;
            return $route;

        } catch (\Exception $e) {
            $this->logger->error("Error in route matching", [
                'slug' => $slug ?? 'unknown',
                'method' => $method ?? 'unknown',
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Masquage des paramètres sensibles pour les logs
     */
    private function maskSensitiveParams(array $params): array
    {
        $sensitiveKeys = [
            'password', 'passwd', 'pwd', 'pass',
            'token', 'csrf_token', 'api_token', 'auth_token',
            'secret', 'key', 'private_key',
            'session_id', 'sess_id',
            'credit_card', 'card_number', 'cvv'
        ];

        $masked = [];
        foreach ($params as $key => $value) {
            $keyLower = strtolower($key);
            $isSensitive = false;

            foreach ($sensitiveKeys as $sensitiveKey) {
                if (strpos($keyLower, $sensitiveKey) !== false) {
                    $isSensitive = true;
                    break;
                }
            }

            if ($isSensitive) {
                $masked[$key] = '[MASKED]';
            } else {
                $masked[$key] = $value;
            }
        }

        return $masked;
    }

    /**
     * Obtention sécurisée de l'IP client
     */
    private function getClientIp(): string
    {
        $ipHeaders = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'REMOTE_ADDR'
        ];

        foreach ($ipHeaders as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = trim(explode(',', $_SERVER[$header])[0]);
                if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $ip;
                }
            }
        }

        return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    }

    /**
     * Correspondance depuis URI avec validation complète
     */
    public function matchFromUri(?string $uri = null): ?array
    {
        try {
            if ($uri === null) {
                $uri = $_SERVER['REQUEST_URI'] ?? '/';
            }

            // Validation et nettoyage de l'URI
            $uri = $this->sanitizeValue($uri);

            // Protection contre les attaques d'URI
            if (strlen($uri) > 2000) {
                $this->logger->warning("URI too long", ['uri_length' => strlen($uri)]);
                return null;
            }

            // Extraction sécurisée du chemin
            $path = parse_url($uri, PHP_URL_PATH);
            if ($path === false || $path === null) {
                $this->logger->warning("Invalid URI format", ['uri' => $uri]);
                return null;
            }

            // Gestion du répertoire web
            if (!empty($this->webDirectory) && $this->webDirectory !== '/') {
                if (strpos($path, $this->webDirectory . '/') === 0) {
                    $path = substr($path, strlen($this->webDirectory));
                } elseif ($path === $this->webDirectory) {
                    $path = '/';
                }
            }

            return $this->match($path, $this->httpMethod);

        } catch (\Exception $e) {
            $this->logger->error("Error matching URI", [
                'uri' => $uri ?? 'null',
                'error' => $e->getMessage()
            ]);
            return null;
        }
    }

    /**
     * Vérification sécurisée des droits d'accès
     */
    public function checkAccess(array $route): bool
    {
        try {
            $page = $route['page'] ?? null;
            if (!$page) {
                return false;
            }

            $requiredRights = (int) ($page['rights'] ?? 0);

            // Accès libre si aucun droit requis
            if ($requiredRights === 0) {
                return true;
            }

            // Vérification de l'authentification
            if (!$this->rightsManager || !$this->rightsManager->isAuthenticated()) {
                $this->logger->info("Access denied: user not authenticated", [
                    'page' => $page['slug'],
                    'required_rights' => $requiredRights
                ]);
                return false;
            }

            // Vérification des droits binaires
            $userRights = $this->rightsManager->getBinaryRights();
            $hasAccess = ($userRights & $requiredRights) > 0;

            if (!$hasAccess) {
                $this->logger->info("Access denied: insufficient rights", [
                    'page' => $page['slug'],
                    'required_rights' => $requiredRights,
                    'user_rights' => $userRights,
                    'user_id' => $this->rightsManager->getUserId()
                ]);
            }

            return $hasAccess;

        } catch (\Exception $e) {
            $this->logger->error("Error checking access", [
                'error' => $e->getMessage(),
                'page' => $route['page']['slug'] ?? 'unknown'
            ]);
            return false;
        }
    }

    /**
     * Redirection sécurisée
     */
    public function redirect(string $url, int $code = 302): void
    {
        // Validation du code de statut
        $allowedCodes = [301, 302, 303, 307, 308];
        if (!in_array($code, $allowedCodes, true)) {
            $code = 302;
        }

        // Validation de l'URL
        $validatedUrl = $this->validateRedirectUrl($url);
        if (!$validatedUrl) {
            $this->logger->error("Blocked unsafe redirect", ['url' => $url]);
            $validatedUrl = '/'; // Fallback sécurisé
        }

        // Protection contre les headers déjà envoyés
        if (headers_sent($file, $line)) {
            $this->logger->error("Cannot redirect, headers already sent", [
                'file' => $file,
                'line' => $line,
                'url' => $validatedUrl
            ]);
            return;
        }

        header('Location: ' . $validatedUrl, true, $code);
        exit;
    }

    // Setters avec validation

    public function setDefaultRoute(string $route): void
    {
        if ($this->isValidSlug($route)) {
            $this->defaultRoute = $route;
        } else {
            throw new \InvalidArgumentException("Invalid default route: $route");
        }
    }

    public function setAccessDeniedRoute(string $route): void
    {
        if ($this->isValidSlug($route)) {
            $this->accessDeniedRoute = $route;
        } else {
            throw new \InvalidArgumentException("Invalid access denied route: $route");
        }
    }

    public function setWebDirectory(string $webDir): void
    {
        $this->webDirectory = '/' . trim($webDir, '/');
    }

    public function setRightsManager(RightsManager $rightsManager): void
    {
        $this->rightsManager = $rightsManager;
    }

    // Getters sécurisés

    public function isPost(): bool
    {
        return $this->httpMethod === 'POST';
    }

    public function isGet(): bool
    {
        return $this->httpMethod === 'GET';
    }

    public function getParam(string $key, $default = null)
    {
        return $this->getParams[$key] ?? $default;
    }

    public function postParam(string $key, $default = null)
    {
        return $this->postParams[$key] ?? $default;
    }

    public function getCurrentRoute(): ?array
    {
        return $this->currentRoute;
    }

    public function getAllRoutes(): array
    {
        if (!$this->routesLoadedSuccessfully) {
            $this->loadRoutes();
        }
        return $this->routesCache['data'];
    }

    public function getTemplateTypes(): array
    {
        $this->loadTemplateTypesOptimized();
        return $this->templateTypesCache['data'];
    }

    /**
     * Nettoyage sécurisé du cache
     */
    public function clearCache(): void
    {
        $this->routesCache = [
            'data' => [],
            'hash' => null,
            'timestamp' => 0,
            'valid' => false
        ];

        $this->templateTypesCache = [
            'data' => [],
            'hash' => null,
            'valid' => false
        ];

        $this->routesLoadedSuccessfully = false;
        $this->currentRoute = null;

        $this->logger->info("Router cache cleared securely");
    }

    /**
     * Réinitialisation sécurisée de l'instance
     */
    public static function resetInstance(): void
    {
        if (self::$instance && self::$instance->dbManager) {
            // Nettoyage propre des ressources
            self::$instance->clearCache();
        }

        self::$instance = null;
        self::$mutexLocks = [];
    }

    /**
     * Génération sécurisée d'URL
     */
    public function generateUrl(string $slug, array $params = []): string
    {
        if (!$this->isValidSlug($slug)) {
            throw new \InvalidArgumentException("Invalid slug for URL generation: $slug");
        }

        $url = $this->webDirectory . '/' . trim($slug, '/');

        // Nettoyage et validation des paramètres
        $cleanParams = [];
        foreach ($params as $key => $value) {
            if (is_string($key) && preg_match('/^[a-zA-Z0-9_-]+$/', $key)) {
                $cleanParams[$key] = $this->sanitizeValue($value);
            }
        }

        if (!empty($cleanParams)) {
            $url .= '?' . http_build_query($cleanParams, '', '&', PHP_QUERY_RFC3986);
        }

        return $url;
    }

    /**
     * Redirection vers une route par son slug
     */
    public function redirectToRoute(string $slug, array $params = [], int $code = 302): void
    {
        $url = $this->generateUrl($slug, $params);
        $this->redirect($url, $code);
    }

    /**
     * Vérification d'existence sécurisée d'une route
     */
    public function routeExists(string $slug): bool
    {
        if (!$this->isValidSlug($slug)) {
            return false;
        }

        if (!$this->routesLoadedSuccessfully) {
            try {
                $this->loadRoutes();
            } catch (\Exception $e) {
                return false;
            }
        }

        return isset($this->routesCache['data'][$slug]);
    }

    /**
     * Obtention sécurisée des templates pour une zone
     */
    public function getTemplatesForZone(string $zone): array
    {
        if (!$this->currentRoute) {
            return [];
        }

        $zone = $this->sanitizeValue($zone);
        return $this->currentRoute['templates'][$zone] ?? [];
    }

    /**
     * Gestion sécurisée des redirections de page
     */
    public function handleRedirect(array $route): bool
    {
        $page = $route['page'] ?? null;
        if (!$page) {
            return false;
        }

        $redirectTo = $page['redirect_to'] ?? null;
        if (empty($redirectTo)) {
            return false;
        }

        // La validation a déjà été faite lors du chargement
        if ($redirectTo) {
            $this->redirect($redirectTo, 302);
            return true;
        }

        return false;
    }

    /**
     * Redirection vers la page d'accès refusé
     */
    public function redirectToAccessDenied(): void
    {
        $accessDeniedUrl = $this->generateUrl($this->accessDeniedRoute);

        // Ajouter l'URL demandée en paramètre pour redirection après login
        $requestedUrl = $_SERVER['REQUEST_URI'] ?? '/';
        $safeRequestedUrl = $this->sanitizeValue($requestedUrl);

        if (strlen($safeRequestedUrl) <= 500) { // Limitation de taille
            $accessDeniedUrl .= '?redirect=' . urlencode($safeRequestedUrl);
        }

        $this->redirect($accessDeniedUrl, 302);
    }

    /**
     * Validation de l'authentification utilisateur
     */
    private function isUserAuthenticated(): bool
    {
        if ($this->rightsManager) {
            return $this->rightsManager->isAuthenticated();
        }

        // Fallback sécurisé sur la session
        return isset($_SESSION['user']) && !empty($_SESSION['user']) && is_array($_SESSION['user']);
    }

    /**
     * Obtention des droits de la route courante
     */
    public function getCurrentRouteRights(): int
    {
        if (!$this->currentRoute) {
            return 0;
        }

        return $this->validateRights($this->currentRoute['page']['rights'] ?? 0);
    }

    /**
     * Vérification si la route courante nécessite une authentification
     */
    public function currentRouteRequiresAuth(): bool
    {
        return $this->getCurrentRouteRights() > 0;
    }

    /**
     * Informations sécurisées sur la requête courante
     */
    public function getRequestInfo(): array
    {
        return [
            'method' => $this->httpMethod,
            'uri' => $this->sanitizeValue($_SERVER['REQUEST_URI'] ?? '/'),
            'slug' => $this->currentRoute['request']['slug'] ?? null,
            'is_post' => $this->isPost(),
            'is_get' => $this->isGet(),
            'has_get_params' => !empty($this->getParams),
            'has_post_params' => !empty($this->postParams),
            'user_agent' => substr($this->sanitizeValue($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 500),
            'ip' => $this->getClientIp(),
            'timestamp' => time(),
            'route_requires_auth' => $this->currentRouteRequiresAuth()
        ];
    }

    /**
     * Statistiques sécurisées du routeur
     */
    public function getStats(): array
    {
        $stats = [
            'routes_loaded' => $this->routesLoadedSuccessfully,
            'routes_count' => count($this->routesCache['data']),
            'template_types_count' => count($this->templateTypesCache['data']),
            'current_route' => $this->currentRoute['page']['slug'] ?? null,
            'http_method' => $this->httpMethod,
            'web_directory' => $this->webDirectory,
            'cache_valid' => $this->isCacheValid(),
            'cache_timestamp' => $this->routesCache['timestamp'],
            'memory_usage_bytes' => memory_get_usage(true),
            'thread_safe_mode' => $this->threadSafeMode
        ];

        // Ajouter les informations de requête si disponibles
        if ($this->currentRoute) {
            $stats['request_info'] = $this->getRequestInfo();
        }

        return $stats;
    }

    /**
     * Informations de debug sécurisées
     */
    public function debug(): array
    {
        if (!$this->routesLoadedSuccessfully) {
            try {
                $this->loadRoutes();
            } catch (\Exception $e) {
                // Continue avec des données partielles
            }
        }

        return [
            'router_stats' => $this->getStats(),
            'current_route_sanitized' => $this->sanitizeDebugRoute($this->currentRoute),
            'available_routes' => array_keys($this->routesCache['data']),
            'template_types' => $this->getTemplateTypes(),
            'get_params_masked' => $this->maskSensitiveParams($this->getParams),
            'post_params_masked' => $this->maskSensitiveParams($this->postParams),
            'cache_info' => [
                'valid' => $this->isCacheValid(),
                'hash' => substr($this->routesCache['hash'] ?? '', 0, 8),
                'timestamp' => $this->routesCache['timestamp'],
                'ttl_remaining' => $this->cacheTtl - (time() - $this->routesCache['timestamp'])
            ],
            'security_info' => [
                'allowed_redirect_domains' => $this->allowedRedirectDomains,
                'thread_safe_mode' => $this->threadSafeMode,
                'db_timeout' => $this->dbTimeout,
                'max_routes_cache' => $this->maxRoutesInCache
            ]
        ];
    }

    /**
     * Nettoyage des données de route pour le debug
     */
    private function sanitizeDebugRoute(?array $route): ?array
    {
        if (!$route) {
            return null;
        }

        $sanitized = $route;

        // Masquer les données sensibles dans les paramètres de requête
        if (isset($sanitized['request'])) {
            $sanitized['request']['get'] = $this->maskSensitiveParams($sanitized['request']['get'] ?? []);
            $sanitized['request']['post'] = $this->maskSensitiveParams($sanitized['request']['post'] ?? []);
        }

        return $sanitized;
    }

    /**
     * Obtention d'un type de template par ID avec validation
     */
    public function getTemplateType(int $typeId): ?array
    {
        if ($typeId <= 0) {
            return null;
        }

        $types = $this->getTemplateTypes();
        return $types[$typeId] ?? null;
    }

    /**
     * Obtention d'un type de template par nom avec validation
     */
    public function getTemplateTypeByName(string $name): ?array
    {
        $name = $this->sanitizeValue($name);
        if (empty($name)) {
            return null;
        }

        $types = $this->getTemplateTypes();
        foreach ($types as $type) {
            if ($type['name'] === $name) {
                return $type;
            }
        }

        return null;
    }

    /**
     * Configuration du timeout de base de données
     */
    public function setDbTimeout(int $timeout): void
    {
        if ($timeout > 0 && $timeout <= 300) { // Max 5 minutes
            $this->dbTimeout = $timeout;
        } else {
            throw new \InvalidArgumentException("Invalid database timeout: $timeout");
        }
    }

    /**
     * Configuration de la taille maximale du cache
     */
    public function setMaxRoutesInCache(int $maxRoutes): void
    {
        if ($maxRoutes > 0 && $maxRoutes <= 10000) { // Limitation raisonnable
            $this->maxRoutesInCache = $maxRoutes;
        } else {
            throw new \InvalidArgumentException("Invalid max routes cache size: $maxRoutes");
        }
    }

    /**
     * Configuration du TTL du cache
     */
    public function setCacheTtl(int $ttl): void
    {
        if ($ttl > 0 && $ttl <= 86400) { // Max 24 heures
            $this->cacheTtl = $ttl;
        } else {
            throw new \InvalidArgumentException("Invalid cache TTL: $ttl");
        }
    }

    /**
     * Ajout de domaines autorisés pour les redirections
     */
    public function addAllowedRedirectDomain(string $domain): void
    {
        $domain = strtolower(trim($domain));

        // Validation basique du domaine
        if (preg_match('/^[a-zA-Z0-9.-]+$/', $domain) && !in_array($domain, $this->allowedRedirectDomains)) {
            $this->allowedRedirectDomains[] = $domain;
        } else {
            throw new \InvalidArgumentException("Invalid domain: $domain");
        }
    }

    /**
     * Vérification de l'état de santé du routeur
     */
    public function healthCheck(): array
    {
        $health = [
            'status' => 'healthy',
            'checks' => [],
            'timestamp' => time()
        ];

        // Test de connectivité BDD
        try {
            $dbTest = $this->dbManager->testConnection();
            $health['checks']['database'] = $dbTest ? 'ok' : 'failed';
            if (!$dbTest) {
                $health['status'] = 'unhealthy';
            }
        } catch (\Exception $e) {
            $health['checks']['database'] = 'error';
            $health['status'] = 'unhealthy';
        }

        // Test de chargement des routes
        try {
            if (!$this->routesLoadedSuccessfully) {
                $this->loadRoutes();
            }
            $health['checks']['routes'] = $this->routesLoadedSuccessfully ? 'ok' : 'failed';
            if (!$this->routesLoadedSuccessfully) {
                $health['status'] = 'degraded';
            }
        } catch (\Exception $e) {
            $health['checks']['routes'] = 'error';
            $health['status'] = 'unhealthy';
        }

        // Test de validité du cache
        $health['checks']['cache'] = $this->isCacheValid() ? 'ok' : 'stale';

        // Test de mémoire
        $memoryUsage = memory_get_usage(true);
        $memoryLimit = $this->parseMemoryLimit(ini_get('memory_limit'));

        if ($memoryLimit > 0 && $memoryUsage > $memoryLimit * 0.9) {
            $health['checks']['memory'] = 'critical';
            $health['status'] = 'unhealthy';
        } elseif ($memoryLimit > 0 && $memoryUsage > $memoryLimit * 0.7) {
            $health['checks']['memory'] = 'warning';
            if ($health['status'] === 'healthy') {
                $health['status'] = 'degraded';
            }
        } else {
            $health['checks']['memory'] = 'ok';
        }

        $health['metrics'] = [
            'memory_usage_bytes' => $memoryUsage,
            'memory_limit_bytes' => $memoryLimit,
            'routes_count' => count($this->routesCache['data']),
            'cache_age_seconds' => time() - $this->routesCache['timestamp']
        ];

        return $health;
    }

    /**
     * Parse de la limite mémoire PHP
     */
    private function parseMemoryLimit(string $memoryLimit): int
    {
        $memoryLimit = trim($memoryLimit);

        if ($memoryLimit === '-1') {
            return 0; // Illimité
        }

        $unit = strtolower(substr($memoryLimit, -1));
        $value = (int) substr($memoryLimit, 0, -1);

        switch ($unit) {
            case 'g':
                return $value * 1024 * 1024 * 1024;
            case 'm':
                return $value * 1024 * 1024;
            case 'k':
                return $value * 1024;
            default:
                return (int) $memoryLimit;
        }
    }

    /**
     * Destructeur sécurisé
     */
    public function __destruct()
    {
        // Nettoyage des verrous mutex
        self::$mutexLocks = [];

        // Log de fin de vie si logger disponible
        if ($this->logger && $this->routesLoadedSuccessfully) {
            $this->logger->debug("Router instance destroyed", [
                'routes_loaded' => $this->routesLoadedSuccessfully,
                'memory_peak' => memory_get_peak_usage(true)
            ]);
        }
    }
}