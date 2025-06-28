<?php
namespace Commun\Router;

/**
 * RouterConfig - Configuration centralisée du routeur
 *
 * Cette classe contient toutes les constantes et configurations
 * par défaut du routeur sécurisé.
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

    /**
     * Retourne la configuration par défaut du routeur
     */
    public static function getDefaultConfig(): array
    {
        return [
            'max_routes_cache'        => self::DEFAULT_MAX_ROUTES_CACHE,
            'cache_ttl'               => self::DEFAULT_CACHE_TTL,
            'db_timeout'              => self::DEFAULT_DB_TIMEOUT,
            'thread_safe_mode'        => true,
            'slug_validation_pattern' => self::SLUG_PATTERN,
            'allowed_http_methods'    => self::ALLOWED_HTTP_METHODS,
            'allowed_redirect_codes'  => self::ALLOWED_REDIRECT_CODES,
            'sensitive_param_keys'    => self::SENSITIVE_PARAM_KEYS,
            'ip_headers'              => self::IP_HEADERS,
            'default_allowed_domains' => self::DEFAULT_ALLOWED_DOMAINS,
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
}
