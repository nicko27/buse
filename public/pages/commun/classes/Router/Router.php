<?php
namespace Commun\Router;

use Commun\Database\BDDManager;
use Commun\Logger\Logger;
use Commun\Security\RightsManager;

/**
 * Classe Router - Gestionnaire de routage avec support du nouveau schema simplifié
 */
class Router
{
    /** @var Router|null Instance unique de la classe */
    private static ?Router $instance = null;

    /** @var \Psr\Log\LoggerInterface Logger pour la journalisation */
    private $logger;

    /** @var BDDManager Instance du gestionnaire de base de données */
    private BDDManager $dbManager;

    /** @var RightsManager|null Instance du gestionnaire de droits */
    private ?RightsManager $rightsManager = null;

    /** @var array Cache des routes chargées */
    private array $routes = [];

    /** @var array Cache des types de templates */
    private array $templateTypes = [];

    /** @var bool Indique si les routes ont été chargées */
    private bool $routesLoaded = false;

    /** @var array Route actuellement active */
    private ?array $currentRoute = null;

    /** @var string Route par défaut */
    private string $defaultRoute = 'index';

    /** @var string Route de redirection en cas d'accès refusé */
    private string $accessDeniedRoute = 'login';

    /** @var string Répertoire web de l'application */
    private string $webDirectory = '';

    /** @var string Méthode HTTP actuelle */
    private string $httpMethod;

    /** @var array Paramètres GET */
    private array $getParams = [];

    /** @var array Paramètres POST */
    private array $postParams = [];

    /**
     * Constructeur privé pour empêcher l'instanciation directe
     */
    private function __construct(BDDManager $dbManager)
    {
        $this->dbManager  = $dbManager;
        $this->httpMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';
        $this->getParams  = $_GET;
        $this->postParams = $_POST;

        try {
            $this->logger = Logger::getInstance()->getLogger();
        } catch (\Exception $e) {
            $this->logger = new \Psr\Log\NullLogger();
        }
    }

    /**
     * Obtenir l'instance unique du routeur
     */
    public static function getInstance(BDDManager $dbManager = null): self
    {
        if (self::$instance === null) {
            if ($dbManager === null) {
                throw new \InvalidArgumentException("BDDManager instance required for initialization");
            }
            self::$instance = new self($dbManager);
        }
        return self::$instance;
    }

    /**
     * Définit la route par défaut
     */
    public function setDefaultRoute(string $route): void
    {
        $this->defaultRoute = $route;
    }

    /**
     * Définit la route de redirection en cas d'accès refusé
     */
    public function setAccessDeniedRoute(string $route): void
    {
        $this->accessDeniedRoute = $route;
    }

    /**
     * Définit le gestionnaire de droits
     */
    public function setRightsManager(RightsManager $rightsManager): void
    {
        $this->rightsManager = $rightsManager;
    }

    /**
     * Définit le répertoire web de l'application
     */
    public function setWebDirectory(string $webDir): void
    {
        $this->webDirectory = '/' . trim($webDir, '/');
    }

    /**
     * Charge toutes les routes depuis la base de données
     */
    public function loadRoutes(): void
    {
        if ($this->routesLoaded) {
            return;
        }

        try {
            // Charger les types de templates
            $this->loadTemplateTypes();

            // Charger les pages actives
            $pagesResult = $this->dbManager->getAllContentTable('pages');

            foreach ($pagesResult as $page) {
                if (! $page['active']) {
                    continue;
                }

                $pageId = $page['id'];

                $this->routes[$page['slug']] = [
                    'page'      => $page,
                    'templates' => $this->loadPageTemplates($pageId),
                ];
            }

            $this->routesLoaded = true;
            $this->logger->info("Routes chargées avec succès", [
                'count'  => count($this->routes),
                'method' => $this->httpMethod,
            ]);

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des routes", [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Charge les types de templates depuis la base de données
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
            $this->templateTypes = [];
        }
    }

    /**
     * Charge les templates d'une page
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
            return [];
        }
    }

    /**
     * Trouve une route correspondant au slug donné
     */
    public function match(string $slug, ?string $method = null): ?array
    {
        $this->loadRoutes();

        // Nettoyer le slug
        $slug = trim($slug, '/');

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
     */
    public function isPost(): bool
    {
        return $this->httpMethod === 'POST';
    }

    /**
     * Vérifie si la requête est en GET
     */
    public function isGet(): bool
    {
        return $this->httpMethod === 'GET';
    }

    /**
     * Récupère un paramètre GET
     */
    public function getParam(string $key, $default = null)
    {
        return $this->getParams[$key] ?? $default;
    }

    /**
     * Récupère un paramètre POST
     */
    public function postParam(string $key, $default = null)
    {
        return $this->postParams[$key] ?? $default;
    }

    /**
     * Récupère un paramètre GET ou POST
     */
    public function param(string $key, $default = null)
    {
        return $this->postParams[$key] ?? $this->getParams[$key] ?? $default;
    }

    /**
     * Vérifie si un paramètre existe
     */
    public function hasParam(string $key): bool
    {
        return isset($this->getParams[$key]) || isset($this->postParams[$key]);
    }

    /**
     * Retourne tous les paramètres GET
     */
    public function getAllGetParams(): array
    {
        return $this->getParams;
    }

    /**
     * Retourne tous les paramètres POST
     */
    public function getAllPostParams(): array
    {
        return $this->postParams;
    }

    /**
     * Retourne tous les paramètres (GET + POST)
     */
    public function getAllParams(): array
    {
        return array_merge($this->getParams, $this->postParams);
    }

    /**
     * Retourne la route actuellement active
     */
    public function getCurrentRoute(): ?array
    {
        return $this->currentRoute;
    }

    /**
     * Retourne les templates de la route courante pour une zone
     */
    public function getTemplatesForZone(string $zone): array
    {
        if (! $this->currentRoute) {
            return [];
        }

        return $this->currentRoute['templates'][$zone] ?? [];
    }

    /**
     * Vérifie si l'utilisateur a les droits pour accéder à une route
     */
    public function checkAccess(array $route): bool
    {
        $page = $route['page'];

        // Si aucun droit requis (rights = 0), accès libre
        if (empty($page['rights']) || $page['rights'] == 0) {
            return true;
        }

        // Vérifier si l'utilisateur est connecté
        if (! $this->isUserAuthenticated()) {
            $this->logger->info("Accès refusé : utilisateur non authentifié", [
                'page'            => $page['slug'],
                'method'          => $this->httpMethod,
                'rights_required' => $page['rights'],
            ]);
            return false;
        }

        // Vérifier les droits avec RightsManager
        if (! $this->rightsManager) {
            $this->logger->error("RightsManager non défini pour vérifier les droits");
            return false;
        }

        $userRights     = $this->rightsManager->getBinaryRights();
        $requiredRights = (int) $page['rights'];

        // Vérification binaire : l'utilisateur a-t-il au moins un des droits requis ?
        $hasAccess = ($userRights & $requiredRights) > 0;

        if (! $hasAccess) {
            $this->logger->info("Accès refusé : droits insuffisants", [
                'page'            => $page['slug'],
                'required_rights' => $requiredRights,
                'user_rights'     => $userRights,
                'user'            => $this->rightsManager->getUserId(),
                'method'          => $this->httpMethod,
            ]);
        }

        return $hasAccess;
    }

    /**
     * Vérifie si l'utilisateur est authentifié
     */
    private function isUserAuthenticated(): bool
    {
        if ($this->rightsManager) {
            return $this->rightsManager->isAuthenticated();
        }

        return isset($_SESSION['user']) && ! empty($_SESSION['user']);
    }

    /**
     * Gère une redirection si nécessaire
     */
    public function handleRedirect(array $route): bool
    {
        $page = $route['page'];

        // Redirection simple basée sur redirect_to
        if (isset($page['redirect_to']) && ! empty($page['redirect_to'])) {
            header('Location: ' . $page['redirect_to'], true, 302);
            exit;
        }

        return false;
    }

    /**
     * Redirige vers la page d'accès refusé
     */
    public function redirectToAccessDenied(): void
    {
        $accessDeniedUrl = $this->generateUrl($this->accessDeniedRoute);

        // Ajouter l'URL demandée en paramètre pour redirection après login
        $requestedUrl = $_SERVER['REQUEST_URI'] ?? '/';
        $accessDeniedUrl .= '?redirect=' . urlencode($requestedUrl);

        header('Location: ' . $accessDeniedUrl, true, 302);
        exit;
    }

    /**
     * Redirige vers une URL
     */
    public function redirect(string $url, int $code = 302): void
    {
        header('Location: ' . $url, true, $code);
        exit;
    }

    /**
     * Redirige vers une route par son slug
     */
    public function redirectToRoute(string $slug, array $params = [], int $code = 302): void
    {
        $url = $this->generateUrl($slug, $params);
        $this->redirect($url, $code);
    }

    /**
     * Génère une URL à partir d'un slug
     */
    public function generateUrl(string $slug, array $params = []): string
    {
        $url = $this->webDirectory . '/' . trim($slug, '/');

        if (! empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        return $url;
    }

    /**
     * Vide le cache des routes
     */
    public function clearCache(): void
    {
        $this->routes        = [];
        $this->templateTypes = [];
        $this->routesLoaded  = false;
        $this->currentRoute  = null;

        $this->logger->info("Cache du routeur vidé");
    }

    /**
     * Retourne toutes les routes chargées
     */
    public function getAllRoutes(): array
    {
        $this->loadRoutes();
        return $this->routes;
    }

    /**
     * Vérifie si une route existe
     */
    public function routeExists(string $slug): bool
    {
        $this->loadRoutes();
        return isset($this->routes[$slug]);
    }

    /**
     * Retourne les droits requis pour la route courante
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
     */
    public function currentRouteRequiresAuth(): bool
    {
        if (! $this->currentRoute) {
            return false;
        }

        return $this->getCurrentRouteRights() > 0;
    }

    /**
     * Retourne des informations sur la requête courante
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
            'request_info'         => $this->getRequestInfo(),
        ];
    }

    /**
     * Méthode de debug
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
     */
    public function getTemplateType(int $typeId): ?array
    {
        $types = $this->getTemplateTypes();
        return $types[$typeId] ?? null;
    }

    /**
     * Retourne un type de template par son nom
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
}
