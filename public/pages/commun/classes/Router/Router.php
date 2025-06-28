<?php
namespace Commun\Router;

use Commun\Database\BDDManager;
use Commun\Logger\Logger;
use Commun\Security\RightsManager;

/**
 * Gestionnaire de routage avec support du schema simplifié
 *
 * Cette classe gère le routage des requêtes, la vérification d'accès,
 * et la génération d'URLs. Elle est séparée en plusieurs responsabilités :
 * - Routage : correspondance URL -> route
 * - Accès : vérification des droits (délégué à AccessChecker)
 * - URLs : génération d'URLs
 *
 * @package Commun\Router
 * @author Application Framework
 * @version 1.0
 */
class Router
{
    /** @var \Psr\Log\LoggerInterface Logger pour la journalisation */
    private $logger;

    /** @var BDDManager Instance du gestionnaire de base de données */
    private BDDManager $dbManager;

    /** @var RightsManager|null Instance du gestionnaire de droits */
    private ?RightsManager $rightsManager = null;

    /** @var array<string, array<string, mixed>> Cache des routes chargées */
    private array $routes = [];

    /** @var array<int, array<string, mixed>> Cache des types de templates */
    private array $templateTypes = [];

    /** @var bool Indique si les routes ont été chargées */
    private bool $routesLoaded = false;

    /** @var array<string, mixed>|null Route actuellement active */
    private ?array $currentRoute = null;

    /** @var string Route par défaut */
    private string $defaultRoute = 'index';

    /** @var string Route de redirection en cas d'accès refusé */
    private string $accessDeniedRoute = 'login';

    /** @var string Répertoire web de l'application */
    private string $webDirectory = '';

    /** @var string Méthode HTTP actuelle */
    private string $httpMethod;

    /** @var array<string, string> Paramètres GET validés et échappés */
    private array $getParams = [];

    /** @var array<string, string> Paramètres POST validés et échappés */
    private array $postParams = [];

    /** @var int Timestamp du dernier chargement des routes (pour cache) */
    private int $lastRoutesLoad = 0;

    /** @var int Durée de vie du cache des routes en secondes */
    private int $cacheLifetime = 300; // 5 minutes

    /**
     * Constructeur
     *
     * @param BDDManager $dbManager Instance du gestionnaire de base de données
     * @throws \Exception Si le gestionnaire de base de données est invalide
     */
    public function __construct(BDDManager $dbManager)
    {
        $this->dbManager  = $dbManager;
        $this->httpMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        // CORRECTION 14: Validation et échappement des paramètres
        $this->sanitizeRequestParams();

        try {
            $this->logger = Logger::getInstance()->getLogger();
        } catch (\Exception $e) {
            $this->logger = new \Psr\Log\NullLogger();
        }
    }

    /**
     * Factory method pour créer une instance
     *
     * @param BDDManager $dbManager Instance du gestionnaire de base de données
     * @return self Nouvelle instance de Router
     */
    public static function create(BDDManager $dbManager): self
    {
        return new self($dbManager);
    }

    /**
     * Définit la route par défaut
     *
     * @param string $route Nom de la route par défaut
     * @return void
     */
    public function setDefaultRoute(string $route): void
    {
        $this->defaultRoute = $this->sanitizeRouteSlug($route);
    }

    /**
     * Définit la route de redirection en cas d'accès refusé
     *
     * @param string $route Nom de la route d'accès refusé
     * @return void
     */
    public function setAccessDeniedRoute(string $route): void
    {
        $this->accessDeniedRoute = $this->sanitizeRouteSlug($route);
    }

    /**
     * Définit le gestionnaire de droits
     *
     * @param RightsManager $rightsManager Instance du gestionnaire de droits
     * @return void
     */
    public function setRightsManager(RightsManager $rightsManager): void
    {
        $this->rightsManager = $rightsManager;
    }

    /**
     * Définit le répertoire web de l'application
     *
     * @param string $webDir Répertoire web
     * @return void
     */
    public function setWebDirectory(string $webDir): void
    {
        $this->webDirectory = '/' . trim($webDir, '/');
    }

    /**
     * Charge toutes les routes depuis la base de données avec cache
     *
     * @return void
     * @throws \Exception Si erreur lors du chargement
     */
    public function loadRoutes(): void
    {
        // CORRECTION 15: Cache efficace des routes
        $currentTime = time();

        if ($this->routesLoaded &&
            ($currentTime - $this->lastRoutesLoad) < $this->cacheLifetime) {
            return; // Cache encore valide
        }

        try {
            // CORRECTION 3: Vérifier que les tables existent avant de les utiliser
            if (! $this->dbManager->tableExists('pages')) {
                throw new \Exception("Table 'pages' non trouvée");
            }

            if (! $this->dbManager->tableExists('page_template_types')) {
                throw new \Exception("Table 'page_template_types' non trouvée");
            }

            if (! $this->dbManager->tableExists('page_templates')) {
                throw new \Exception("Table 'page_templates' non trouvée");
            }

            // Charger les types de templates
            $this->loadTemplateTypes();

            // Charger les pages actives
            $pagesResult = $this->dbManager->getAllContentTable('pages');

            // Réinitialiser le cache
            $this->routes = [];

            foreach ($pagesResult as $page) {
                if (! $page['active']) {
                    continue;
                }

                $pageId = $page['id'];
                $slug   = $this->sanitizeRouteSlug($page['slug']);

                $this->routes[$slug] = [
                    'page'      => $page,
                    'templates' => $this->loadPageTemplates($pageId),
                ];
            }

            $this->routesLoaded   = true;
            $this->lastRoutesLoad = $currentTime;

            $this->logger->info("Routes chargées avec succès", [
                'count'        => count($this->routes),
                'method'       => $this->httpMethod,
                'cached_until' => $currentTime + $this->cacheLifetime,
            ]);

        } catch (\Exception $e) {
            // CORRECTION 20: Gestion d'erreurs améliorée
            $this->logger->error("Erreur lors du chargement des routes", [
                'error'            => $e->getMessage(),
                'file'             => $e->getFile(),
                'line'             => $e->getLine(),
                'tables_available' => $this->getAvailableTables(),
            ]);
            throw new \Exception("Impossible de charger les routes : " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Charge les types de templates depuis la base de données
     *
     * @return void
     * @throws \Exception Si erreur lors du chargement
     */
    private function loadTemplateTypes(): void
    {
        try {
            $typesResult = $this->dbManager->getAllContentTable('page_template_types');

            $this->templateTypes = [];
            foreach ($typesResult as $type) {
                if ($type['active']) {
                    $this->templateTypes[$type['id']] = $type;
                }
            }

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des types de templates", [
                'error' => $e->getMessage(),
            ]);
            throw new \Exception("Impossible de charger les types de templates : " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Charge les templates d'une page
     *
     * @param int $pageId ID de la page
     * @return array<string, array<array<string, mixed>>> Templates groupés par zone
     * @throws \Exception Si erreur lors du chargement
     */
    private function loadPageTemplates(int $pageId): array
    {
        try {
            $templatesResult = $this->dbManager->getAllContentTable('page_templates');

            $pageTemplates = [];
            foreach ($templatesResult as $template) {
                if ($template['page_id'] == $pageId && $template['enabled']) {
                    $typeId = $template['template_type_id'];

                    if (isset($this->templateTypes[$typeId])) {
                        $zoneName = $this->templateTypes[$typeId]['name'];

                        if (! isset($pageTemplates[$zoneName])) {
                            $pageTemplates[$zoneName] = [];
                        }
                        $pageTemplates[$zoneName][] = $template;
                    }
                }
            }

            // Trier chaque zone par priorité
            foreach ($pageTemplates as $zone => $templates) {
                usort($pageTemplates[$zone], function ($a, $b) {
                    return ($a['priority'] ?? 0) <=> ($b['priority'] ?? 0);
                });
            }

            return $pageTemplates;

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des templates", [
                'page_id' => $pageId,
                'error'   => $e->getMessage(),
            ]);
            throw new \Exception("Impossible de charger les templates pour la page $pageId : " . $e->getMessage(), 0, $e);
        }
    }

    /**
     * Trouve une route correspondant au slug donné
     *
     * @param string $slug Slug de la route
     * @param string|null $method Méthode HTTP (optionnel)
     * @return array<string, mixed>|null Route trouvée ou null
     */
    public function match(string $slug, ?string $method = null): ?array
    {
        $this->loadRoutes();

        // Nettoyer le slug
        $slug = $this->sanitizeRouteSlug($slug);

        // Utiliser la route par défaut si vide
        if (empty($slug)) {
            $slug = $this->defaultRoute;
        }

        if (isset($this->routes[$slug])) {
            $route = $this->routes[$slug];

            // Ajouter les informations de requête
            $route['request'] = [
                'method'        => $method ?? $this->httpMethod,
                'slug'          => $slug,
                'get'           => $this->getParams,
                'post'          => $this->postParams,
                'is_post'       => $this->isPost(),
                'is_get'        => $this->isGet(),
                'has_post_data' => ! empty($this->postParams),
            ];

            $this->currentRoute = $route;
            return $this->currentRoute;
        }

        return null;
    }

    /**
     * Trouve une route à partir de l'URI actuelle
     *
     * @param string|null $uri URI à analyser (par défaut l'URI courante)
     * @return array<string, mixed>|null Route trouvée ou null
     */
    public function matchFromUri(?string $uri = null): ?array
    {
        if ($uri === null) {
            $uri = $_SERVER['REQUEST_URI'] ?? '/';
        }

        // Extraire le chemin de l'URI (sans query string)
        $path = parse_url($uri, PHP_URL_PATH);

        // Gérer le répertoire web
        if (! empty($this->webDirectory) && $this->webDirectory !== '/') {
            if (strpos($path, $this->webDirectory . '/') === 0) {
                $path = substr($path, strlen($this->webDirectory));
            } elseif ($path === $this->webDirectory) {
                $path = '/';
            }
        }

        return $this->match($path, $this->httpMethod);
    }

    /**
     * Vérifie si la requête est en POST
     *
     * @return bool True si POST
     */
    public function isPost(): bool
    {
        return $this->httpMethod === 'POST';
    }

    /**
     * Vérifie si la requête est en GET
     *
     * @return bool True si GET
     */
    public function isGet(): bool
    {
        return $this->httpMethod === 'GET';
    }

    /**
     * Récupère un paramètre GET
     *
     * @param string $key Nom du paramètre
     * @param mixed $default Valeur par défaut
     * @return mixed Valeur du paramètre
     */
    public function getParam(string $key, $default = null)
    {
        return $this->getParams[$key] ?? $default;
    }

    /**
     * Récupère un paramètre POST
     *
     * @param string $key Nom du paramètre
     * @param mixed $default Valeur par défaut
     * @return mixed Valeur du paramètre
     */
    public function postParam(string $key, $default = null)
    {
        return $this->postParams[$key] ?? $default;
    }

    /**
     * Récupère un paramètre GET ou POST
     *
     * @param string $key Nom du paramètre
     * @param mixed $default Valeur par défaut
     * @return mixed Valeur du paramètre
     */
    public function param(string $key, $default = null)
    {
        return $this->postParams[$key] ?? $this->getParams[$key] ?? $default;
    }

    /**
     * Vérifie si un paramètre existe
     *
     * @param string $key Nom du paramètre
     * @return bool True si le paramètre existe
     */
    public function hasParam(string $key): bool
    {
        return isset($this->getParams[$key]) || isset($this->postParams[$key]);
    }

    /**
     * Retourne tous les paramètres GET
     *
     * @return array<string, string> Paramètres GET
     */
    public function getAllGetParams(): array
    {
        return $this->getParams;
    }

    /**
     * Retourne tous les paramètres POST
     *
     * @return array<string, string> Paramètres POST
     */
    public function getAllPostParams(): array
    {
        return $this->postParams;
    }

    /**
     * Retourne tous les paramètres (GET + POST)
     *
     * @return array<string, string> Tous les paramètres
     */
    public function getAllParams(): array
    {
        return array_merge($this->getParams, $this->postParams);
    }

    /**
     * Retourne la route actuellement active
     *
     * @return array<string, mixed>|null Route active ou null
     */
    public function getCurrentRoute(): ?array
    {
        return $this->currentRoute;
    }

    /**
     * Retourne les templates de la route courante pour une zone
     *
     * @param string $zone Nom de la zone
     * @return array<array<string, mixed>> Templates de la zone
     */
    public function getTemplatesForZone(string $zone): array
    {
        if (! $this->currentRoute) {
            return [];
        }

        return $this->currentRoute['templates'][$zone] ?? [];
    }

    /**
     * Redirige vers une URL
     *
     * @param string $url URL de destination
     * @param int $code Code de statut HTTP
     * @return never
     */
    public function redirect(string $url, int $code = 302): never
    {
        header('Location: ' . $url, true, $code);
        exit;
    }

    /**
     * Redirige vers une route par son slug
     *
     * @param string $slug Slug de la route
     * @param array<string, mixed> $params Paramètres de query
     * @param int $code Code de statut HTTP
     * @return never
     */
    public function redirectToRoute(string $slug, array $params = [], int $code = 302): never
    {
        $url = $this->generateUrl($slug, $params);
        $this->redirect($url, $code);
    }

    /**
     * Génère une URL à partir d'un slug
     *
     * @param string $slug Slug de la route
     * @param array<string, mixed> $params Paramètres de query
     * @return string URL générée
     */
    public function generateUrl(string $slug, array $params = []): string
    {
        $slug = $this->sanitizeRouteSlug($slug);
        $url  = $this->webDirectory . '/' . trim($slug, '/');

        if (! empty($params)) {
            // Filtrer et valider les paramètres
            $validParams = [];
            foreach ($params as $key => $value) {
                $cleanKey   = $this->sanitizeParamKey($key);
                $cleanValue = $this->sanitizeParamValue($value);
                if ($cleanKey && $cleanValue !== null) {
                    $validParams[$cleanKey] = $cleanValue;
                }
            }

            if (! empty($validParams)) {
                $url .= '?' . http_build_query($validParams);
            }
        }

        return $url;
    }

    /**
     * Vide le cache des routes
     *
     * @return void
     */
    public function clearCache(): void
    {
        $this->routes         = [];
        $this->templateTypes  = [];
        $this->routesLoaded   = false;
        $this->currentRoute   = null;
        $this->lastRoutesLoad = 0;

        $this->logger->info("Cache du routeur vidé");
    }

    /**
     * Retourne toutes les routes chargées
     *
     * @return array<string, array<string, mixed>> Routes chargées
     */
    public function getAllRoutes(): array
    {
        $this->loadRoutes();
        return $this->routes;
    }

    /**
     * Vérifie si une route existe
     *
     * @param string $slug Slug de la route
     * @return bool True si la route existe
     */
    public function routeExists(string $slug): bool
    {
        $this->loadRoutes();
        $slug = $this->sanitizeRouteSlug($slug);
        return isset($this->routes[$slug]);
    }

    /**
     * Retourne les droits requis pour la route courante
     *
     * @return int Droits requis (masque binaire)
     */
    public function getCurrentRouteRights(): int
    {
        if (! $this->currentRoute) {
            return 0;
        }

        return (int) ($this->currentRoute['page']['rights'] ?? 0);
    }

    /**
     * Vérifie si la route courante nécessite une authentification
     *
     * @return bool True si authentification requise
     */
    public function currentRouteRequiresAuth(): bool
    {
        return $this->getCurrentRouteRights() > 0;
    }

    /**
     * Retourne des informations sur la requête courante
     *
     * @return array<string, mixed> Informations de requête
     */
    public function getRequestInfo(): array
    {
        return [
            'method'          => $this->httpMethod,
            'uri'             => $_SERVER['REQUEST_URI'] ?? '/',
            'slug'            => $this->currentRoute['request']['slug'] ?? null,
            'is_post'         => $this->isPost(),
            'is_get'          => $this->isGet(),
            'has_get_params'  => ! empty($this->getParams),
            'has_post_params' => ! empty($this->postParams),
            'user_agent'      => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'ip'              => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        ];
    }

    /**
     * Retourne des statistiques sur le routeur
     *
     * @return array<string, mixed> Statistiques
     */
    public function getStats(): array
    {
        return [
            'routes_loaded'        => $this->routesLoaded,
            'routes_count'         => count($this->routes),
            'template_types_count' => count($this->templateTypes),
            'current_route'        => $this->currentRoute['page']['slug'] ?? null,
            'http_method'          => $this->httpMethod,
            'web_directory'        => $this->webDirectory,
            'cache_valid_until'    => $this->lastRoutesLoad + $this->cacheLifetime,
            'request_info'         => $this->getRequestInfo(),
        ];
    }

    /**
     * Méthode de debug
     *
     * @return array<string, mixed> Informations de debug
     */
    public function debug(): array
    {
        return [
            'router_stats'       => $this->getStats(),
            'current_route_full' => $this->currentRoute,
            'all_routes'         => array_keys($this->getAllRoutes()),
            'template_types'     => $this->templateTypes,
            'get_params'         => $this->getParams,
            'post_params'        => $this->postParams,
        ];
    }

    /**
     * Retourne tous les types de templates disponibles
     *
     * @return array<int, array<string, mixed>> Types de templates
     */
    public function getTemplateTypes(): array
    {
        if (empty($this->templateTypes)) {
            $this->loadTemplateTypes();
        }
        return $this->templateTypes;
    }

    /**
     * Retourne un type de template par son ID
     *
     * @param int $typeId ID du type
     * @return array<string, mixed>|null Type de template ou null
     */
    public function getTemplateType(int $typeId): ?array
    {
        $types = $this->getTemplateTypes();
        return $types[$typeId] ?? null;
    }

    /**
     * Retourne un type de template par son nom
     *
     * @param string $name Nom du type
     * @return array<string, mixed>|null Type de template ou null
     */
    public function getTemplateTypeByName(string $name): ?array
    {
        $types = $this->getTemplateTypes();
        foreach ($types as $type) {
            if ($type['name'] === $name) {
                return $type;
            }
        }
        return null;
    }

    /**
     * Configure la durée de vie du cache
     *
     * @param int $seconds Durée en secondes
     * @return void
     */
    public function setCacheLifetime(int $seconds): void
    {
        $this->cacheLifetime = max(0, $seconds);
    }

    // --- Méthodes privées de validation et nettoyage ---

    /**
     * Valide et nettoie les paramètres de requête
     *
     * @return void
     */
    private function sanitizeRequestParams(): void
    {
        // Nettoyer et valider les paramètres GET
        foreach ($_GET as $key => $value) {
            $cleanKey   = $this->sanitizeParamKey($key);
            $cleanValue = $this->sanitizeParamValue($value);

            if ($cleanKey && $cleanValue !== null) {
                $this->getParams[$cleanKey] = $cleanValue;
            }
        }

        // Nettoyer et valider les paramètres POST
        foreach ($_POST as $key => $value) {
            $cleanKey   = $this->sanitizeParamKey($key);
            $cleanValue = $this->sanitizeParamValue($value);

            if ($cleanKey && $cleanValue !== null) {
                $this->postParams[$cleanKey] = $cleanValue;
            }
        }
    }

    /**
     * Nettoie un nom de paramètre
     *
     * @param mixed $key Nom du paramètre
     * @return string|null Nom nettoyé ou null si invalide
     */
    private function sanitizeParamKey($key): ?string
    {
        if (! is_string($key) && ! is_numeric($key)) {
            return null;
        }

        $key = (string) $key;

        // Validation basique : alphanumériques + underscore + tiret
        if (! preg_match('/^[a-zA-Z0-9_-]{1,50}$/', $key)) {
            return null;
        }

        return $key;
    }

    /**
     * Nettoie une valeur de paramètre
     *
     * @param mixed $value Valeur du paramètre
     * @return string|null Valeur nettoyée ou null si invalide
     */
    private function sanitizeParamValue($value): ?string
    {
        if (is_array($value) || is_object($value)) {
            return null;
        }

        $value = (string) $value;

        // Supprimer les caractères de contrôle
        $value = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $value);

        // Limiter la longueur
        $value = substr($value, 0, 1000);

        return $value;
    }

    /**
     * Nettoie un slug de route
     *
     * @param string $slug Slug à nettoyer
     * @return string Slug nettoyé
     */
    private function sanitizeRouteSlug(string $slug): string
    {
        $slug = trim($slug, '/');

        // Remplacer les caractères invalides
        $slug = preg_replace('/[^a-zA-Z0-9\/\-_]/', '', $slug);

        // Nettoyer les slashes multiples
        $slug = preg_replace('/\/+/', '/', $slug);

        return $slug;
    }

    /**
     * Récupère la liste des tables disponibles (pour debug)
     *
     * @return array<string> Liste des tables
     */
    private function getAvailableTables(): array
    {
        try {
            return $this->dbManager->getAvailableTables();
        } catch (\Exception $e) {
            return [];
        }
    }
}
