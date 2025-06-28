<?php
namespace Commun\Router;

/**
 * RouterConfig - Configuration centralisée du routeur
 *
 * Cette classe contient toutes les constantes et configurations
 * par défaut du routeur sécurisé.
 *
 * VERSION COMPLÈTE avec gestion des domaines de redirection
 */
class RouterConfig
{
    // Validation des slugs
    public const SLUG_PATTERN    = '/^[a-zA-Z0-9\/_-]+$/';
    public const MAX_SLUG_LENGTH = 255;

    // Méthodes HTTP autorisées
    public const ALLOWED_HTTP_METHODS = [
        'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD',
    ];

    // Codes de redirection autorisés
    public const ALLOWED_REDIRECT_CODES = [301, 302, 303, 307, 308];

    // Limites de cache
    public const DEFAULT_MAX_ROUTES_CACHE = 1000;
    public const MAX_ROUTES_CACHE_LIMIT   = 10000;
    public const DEFAULT_CACHE_TTL        = 3600;  // 1 heure
    public const MAX_CACHE_TTL            = 86400; // 24 heures

                                           // Timeouts
    public const DEFAULT_DB_TIMEOUT = 10;  // secondes
    public const MAX_DB_TIMEOUT     = 300; // 5 minutes

    // Limitations de sécurité
    public const MAX_URI_LENGTH                = 2000;
    public const MAX_PARAM_VALUE_LENGTH        = 10000;
    public const MAX_REDIRECT_URL_PARAM_LENGTH = 500;

    // Paramètres sensibles à masquer dans les logs
    public const SENSITIVE_PARAM_KEYS = [
        'password', 'passwd', 'pwd', 'pass',
        'token', 'csrf_token', 'api_token', 'auth_token',
        'secret', 'key', 'private_key',
        'session_id', 'sess_id',
        'credit_card', 'card_number', 'cvv',
    ];

    // Headers IP autorisés (par ordre de priorité)
    public const IP_HEADERS = [
        'HTTP_CF_CONNECTING_IP',
        'HTTP_X_FORWARDED_FOR',
        'HTTP_X_REAL_IP',
        'REMOTE_ADDR',
    ];

    // Domaines toujours autorisés pour les redirections
    public const DEFAULT_ALLOWED_DOMAINS = [
        'localhost',
        '127.0.0.1',
    ];

    // CORRECTION : Domaines de redirection par défaut (pour la constante ALLOWED_REDIRECT_DOMAINS)
    public const ALLOWED_REDIRECT_DOMAINS = 'localhost,127.0.0.1';

    // Patterns de validation
    public const PARAM_KEY_PATTERN = '/^[a-zA-Z0-9_-]+$/';
    public const DOMAIN_PATTERN    = '/^[a-zA-Z0-9.-]+$/';

    // Messages d'erreur standardisés
    public const ERROR_MESSAGES = [
        'invalid_slug'          => 'Invalid route slug format',
        'invalid_http_method'   => 'Invalid HTTP method',
        'invalid_redirect_code' => 'Invalid redirect status code',
        'invalid_domain'        => 'Invalid domain format',
        'db_timeout'            => 'Database operation timeout',
        'cache_integrity'       => 'Cache integrity check failed',
        'uri_too_long'          => 'URI length exceeds maximum allowed',
        'unauthorized_redirect' => 'Redirect to unauthorized domain blocked',
    ];

    // Configuration des health checks
    public const HEALTH_CHECK_CONFIG = [
        'memory_warning_threshold'  => 0.7,
        'memory_critical_threshold' => 0.9,
        'cache_stale_threshold'     => 7200, // 2 heures
    ];

    // Routes par défaut
    public const DEFAULT_ROUTES = [
        'default_route'       => 'index',
        'access_denied_route' => 'login',
        'error_404_route'     => '404',
        'error_500_route'     => '500',
    ];

    /**
     * Retourne la configuration par défaut du routeur
     */
    public static function getDefaultConfig(): array
    {
        return [
            'max_routes_cache'         => self::DEFAULT_MAX_ROUTES_CACHE,
            'cache_ttl'                => self::DEFAULT_CACHE_TTL,
            'db_timeout'               => self::DEFAULT_DB_TIMEOUT,
            'thread_safe_mode'         => true,
            'slug_validation_pattern'  => self::SLUG_PATTERN,
            'allowed_http_methods'     => self::ALLOWED_HTTP_METHODS,
            'allowed_redirect_codes'   => self::ALLOWED_REDIRECT_CODES,
            'sensitive_param_keys'     => self::SENSITIVE_PARAM_KEYS,
            'ip_headers'               => self::IP_HEADERS,
            'default_allowed_domains'  => self::DEFAULT_ALLOWED_DOMAINS,
            'allowed_redirect_domains' => self::ALLOWED_REDIRECT_DOMAINS,
            'default_routes'           => self::DEFAULT_ROUTES,
        ];
    }

    /**
     * Valide une configuration utilisateur
     */
    public static function validateConfig(array $config): array
    {
        $errors = [];

        if (isset($config['max_routes_cache'])) {
            if (! is_int($config['max_routes_cache']) ||
                $config['max_routes_cache'] <= 0 ||
                $config['max_routes_cache'] > self::MAX_ROUTES_CACHE_LIMIT) {
                $errors[] = "max_routes_cache must be between 1 and " . self::MAX_ROUTES_CACHE_LIMIT;
            }
        }

        if (isset($config['cache_ttl'])) {
            if (! is_int($config['cache_ttl']) ||
                $config['cache_ttl'] <= 0 ||
                $config['cache_ttl'] > self::MAX_CACHE_TTL) {
                $errors[] = "cache_ttl must be between 1 and " . self::MAX_CACHE_TTL;
            }
        }

        if (isset($config['db_timeout'])) {
            if (! is_int($config['db_timeout']) ||
                $config['db_timeout'] <= 0 ||
                $config['db_timeout'] > self::MAX_DB_TIMEOUT) {
                $errors[] = "db_timeout must be between 1 and " . self::MAX_DB_TIMEOUT;
            }
        }

        // Validation des domaines autorisés
        if (isset($config['allowed_redirect_domains'])) {
            if (! is_string($config['allowed_redirect_domains'])) {
                $errors[] = "allowed_redirect_domains must be a comma-separated string";
            } else {
                $domains = explode(',', $config['allowed_redirect_domains']);
                foreach ($domains as $domain) {
                    $domain = trim($domain);
                    if (! empty($domain) && ! preg_match(self::DOMAIN_PATTERN, $domain)) {
                        $errors[] = "Invalid domain format: $domain";
                    }
                }
            }
        }

        return $errors;
    }

    /**
     * Fusionne la configuration utilisateur avec les valeurs par défaut
     */
    public static function mergeConfig(array $userConfig = []): array
    {
        $defaultConfig    = self::getDefaultConfig();
        $validationErrors = self::validateConfig($userConfig);

        if (! empty($validationErrors)) {
            throw new \InvalidArgumentException(
                "Invalid router configuration: " . implode(', ', $validationErrors)
            );
        }

        return array_merge($defaultConfig, $userConfig);
    }

    /**
     * Obtient les domaines autorisés pour les redirections
     *
     * @param string|null $configValue Valeur de configuration (défaut depuis la constante)
     * @return array Liste des domaines autorisés
     */
    public static function getAllowedRedirectDomains(?string $configValue = null): array
    {
        $domainsString = $configValue ?? self::ALLOWED_REDIRECT_DOMAINS;

        if (empty($domainsString)) {
            return self::DEFAULT_ALLOWED_DOMAINS;
        }

        $domains      = array_map('trim', explode(',', $domainsString));
        $validDomains = [];

        foreach ($domains as $domain) {
            if (! empty($domain) && preg_match(self::DOMAIN_PATTERN, $domain)) {
                $validDomains[] = strtolower($domain);
            }
        }

        // Toujours inclure les domaines par défaut
        return array_unique(array_merge(self::DEFAULT_ALLOWED_DOMAINS, $validDomains));
    }

    /**
     * Valide un slug selon les règles définies
     */
    public static function isValidSlug(string $slug): bool
    {
        if (empty($slug) || strlen($slug) > self::MAX_SLUG_LENGTH) {
            return false;
        }

        // Vérification des caractères dangereux
        if (strpos($slug, '..') !== false || strpos($slug, "\0") !== false) {
            return false;
        }

        return preg_match(self::SLUG_PATTERN, $slug) === 1;
    }

    /**
     * Valide une méthode HTTP
     */
    public static function isValidHttpMethod(string $method): bool
    {
        return in_array(strtoupper($method), self::ALLOWED_HTTP_METHODS, true);
    }

    /**
     * Valide un code de redirection
     */
    public static function isValidRedirectCode(int $code): bool
    {
        return in_array($code, self::ALLOWED_REDIRECT_CODES, true);
    }

    /**
     * Retourne les routes par défaut configurées
     */
    public static function getDefaultRoutes(): array
    {
        return self::DEFAULT_ROUTES;
    }

    /**
     * Valide et nettoie un paramètre de clé
     */
    public static function sanitizeParamKey(string $key): ?string
    {
        if (! preg_match(self::PARAM_KEY_PATTERN, $key)) {
            return null;
        }
        return $key;
    }

    /**
     * Vérifie si une clé de paramètre est sensible
     */
    public static function isSensitiveParam(string $key): bool
    {
        $keyLower = strtolower($key);

        foreach (self::SENSITIVE_PARAM_KEYS as $sensitiveKey) {
            if (strpos($keyLower, $sensitiveKey) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Obtient la configuration des health checks
     */
    public static function getHealthCheckConfig(): array
    {
        return self::HEALTH_CHECK_CONFIG;
    }

    /**
     * Retourne les headers IP par ordre de priorité
     */
    public static function getIpHeaders(): array
    {
        return self::IP_HEADERS;
    }

    /**
     * Crée une constante globale pour la compatibilité avec l'ancien code
     *
     * @param string|null $domainsString Domaines à définir
     */
    public static function defineAllowedRedirectDomains(?string $domainsString = null): void
    {
        if (! defined('ALLOWED_REDIRECT_DOMAINS')) {
            $domains = $domainsString ?? self::ALLOWED_REDIRECT_DOMAINS;
            define('ALLOWED_REDIRECT_DOMAINS', $domains);
        }
    }

    /**
     * Configuration complète pour l'initialisation du routeur
     */
    public static function getCompleteRouterConfig(): array
    {
        // S'assurer que la constante est définie
        self::defineAllowedRedirectDomains();

        return [
            // Configuration de base
            'routing'     => [
                'default_route'       => self::DEFAULT_ROUTES['default_route'],
                'access_denied_route' => self::DEFAULT_ROUTES['access_denied_route'],
                'error_routes'        => [
                    '404' => self::DEFAULT_ROUTES['error_404_route'],
                    '500' => self::DEFAULT_ROUTES['error_500_route'],
                ],
            ],

            // Configuration du cache
            'cache'       => [
                'max_routes'      => self::DEFAULT_MAX_ROUTES_CACHE,
                'ttl'             => self::DEFAULT_CACHE_TTL,
                'enabled'         => true,
                'integrity_check' => true,
            ],

            // Configuration de sécurité
            'security'    => [
                'allowed_methods'        => self::ALLOWED_HTTP_METHODS,
                'allowed_redirect_codes' => self::ALLOWED_REDIRECT_CODES,
                'allowed_domains'        => self::getAllowedRedirectDomains(),
                'slug_pattern'           => self::SLUG_PATTERN,
                'max_uri_length'         => self::MAX_URI_LENGTH,
                'sensitive_params'       => self::SENSITIVE_PARAM_KEYS,
            ],

            // Configuration de performance
            'performance' => [
                'db_timeout'    => self::DEFAULT_DB_TIMEOUT,
                'thread_safe'   => true,
                'memory_limits' => self::HEALTH_CHECK_CONFIG,
            ],

            // Configuration de logging
            'logging'     => [
                'ip_headers'       => self::IP_HEADERS,
                'mask_sensitive'   => true,
                'log_slow_queries' => true,
            ],
        ];
    }
}
