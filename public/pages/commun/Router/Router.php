<?php
namespace Commun\Router;

use Commun\Database\BDDManager;
use Commun\Logger\Logger;
use Commun\Security\RightsManager;

/**
 * Classe Router - Gestionnaire de routage simple avec support GET/POST
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
                    'layout'    => $this->loadPageLayout($pageId),
                    'assets'    => $this->loadPageAssets($pageId),
                    'rights'    => $this->loadPageRights($pageId),
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
     * Charge les templates d'une page depuis la table simplifiée
     */
    private function loadPageTemplates(int $pageId): array
    {
        try {
            $templatesResult = $this->dbManager->getAllContentTable('page_templates');

            $pageTemplates = [];
            foreach ($templatesResult as $template) {
                if ($template['page_id'] == $pageId && $template['enabled']) {
                    $zone = $template['zone'];
                    if (! isset($pageTemplates[$zone])) {
                        $pageTemplates[$zone] = [];
                    }
                    $pageTemplates[$zone][] = $template;
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
     * Charge le layout d'une page
     */
    private function loadPageLayout(int $pageId): array
    {
        try {
            if (! $this->dbManager->tableExists('page_layouts')) {
                return ['layout_template' => 'layouts/default.twig'];
            }

            $layoutsResult = $this->dbManager->getAllContentTable('page_layouts');

            foreach ($layoutsResult as $layout) {
                if ($layout['page_id'] == $pageId) {
                    return $layout;
                }
            }

            // Fallback par défaut
            return ['layout_template' => 'layouts/default.twig'];

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement du layout", [
                'page_id' => $pageId,
                'error'   => $e->getMessage(),
            ]);
            return ['layout_template' => 'layouts/default.twig'];
        }
    }

    /**
     * Charge les assets d'une page
     */
    private function loadPageAssets(int $pageId): array
    {
        try {
            if (! $this->dbManager->tableExists('page_assets')) {
                return ['css' => [], 'js' => []];
            }

            $assetsResult = $this->dbManager->getAllContentTable('page_assets');

            $assets = ['css' => [], 'js' => []];

            foreach ($assetsResult as $asset) {
                if ($asset['page_id'] == $pageId && $asset['enabled']) {
                    $type = $asset['file_type'];
                    $zone = $asset['zone'] ?? 'global';

                    if (! isset($assets[$type][$zone])) {
                        $assets[$type][$zone] = [];
                    }

                    $assets[$type][$zone][] = $asset;
                }
            }

            // Trier par priorité
            foreach (['css', 'js'] as $type) {
                foreach ($assets[$type] as $zone => $zoneAssets) {
                    usort($assets[$type][$zone], function ($a, $b) {
                        return ($a['priority'] ?? 0) <=> ($b['priority'] ?? 0);
                    });
                }
            }

            return $assets;

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des assets", [
                'page_id' => $pageId,
                'error'   => $e->getMessage(),
            ]);
            return ['css' => [], 'js' => []];
        }
    }

    /**
     * Charge les droits requis pour une page
     */
    private function loadPageRights(int $pageId): array
    {
        try {
            // Si la table page_rights existe, l'utiliser
            if ($this->dbManager->tableExists('page_rights')) {
                $rightsResult = $this->dbManager->getAllContentTable('page_rights');

                $pageRights = [];
                foreach ($rightsResult as $right) {
                    if ($right['page_id'] == $pageId) {
                        $pageRights[] = $right['right_name'];
                    }
                }

                return $pageRights;
            }

            return [];

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des droits de la page", [
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
     * Retourne le layout de la route courante
     */
    public function getCurrentLayout(): array
    {
        if (! $this->currentRoute) {
            return ['layout_template' => 'layouts/default.twig'];
        }

        return $this->currentRoute['layout'] ?? ['layout_template' => 'layouts/default.twig'];
    }

    /**
     * Retourne les assets de la route courante
     */
    public function getCurrentAssets(): array
    {
        if (! $this->currentRoute) {
            return ['css' => [], 'js' => []];
        }

        return $this->currentRoute['assets'] ?? ['css' => [], 'js' => []];
    }

    /**
     * Vérifie si l'utilisateur a les droits pour accéder à une route
     */
    public function checkAccess(array $route): bool
    {
        $page = $route['page'];

        // Si l'authentification est requise
        if ($page['requires_auth']) {
            // Vérifier si l'utilisateur est connecté
            if (! $this->isUserAuthenticated()) {
                $this->logger->info("Accès refusé : utilisateur non authentifié", [
                    'page'   => $page['slug'],
                    'method' => $this->httpMethod,
                ]);
                return false;
            }

            // Si des droits spécifiques sont requis
            if (! empty($route['rights'])) {
                if (! $this->rightsManager) {
                    $this->logger->error("RightsManager non défini pour vérifier les droits");
                    return false;
                }

                // Vérifier si l'utilisateur a au moins un des droits requis
                $hasAccess = false;
                foreach ($route['rights'] as $requiredRight) {
                    if ($this->checkUserRight($requiredRight)) {
                        $hasAccess = true;
                        break;
                    }
                }

                if (! $hasAccess) {
                    $this->logger->info("Accès refusé : droits insuffisants", [
                        'page'            => $page['slug'],
                        'required_rights' => $route['rights'],
                        'user'            => $this->rightsManager->getUserId(),
                        'method'          => $this->httpMethod,
                    ]);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Vérifie si l'utilisateur possède un droit spécifique
     */
    private function checkUserRight(string $right): bool
    {
        if (! $this->rightsManager) {
            return false;
        }

        switch ($right) {
            case 'timeline':
                return $this->rightsManager->canReadTimeline();
            case 'permanences':
                return $this->rightsManager->canReadPermanences();
            case 'import':
                return $this->rightsManager->canImport();
            case 'view_synthesis':
                return $this->rightsManager->canViewSynthesis();
            case 'view_synthesis_1':
                return $this->rightsManager->canViewSynthesisLevel(1);
            case 'view_synthesis_2':
                return $this->rightsManager->canViewSynthesisLevel(2);
            case 'admin':
                return $this->rightsManager->isAdmin();
            case 'super_admin':
                return $this->rightsManager->isSuperAdmin();
            default:
                return $this->rightsManager->hasRight($right);
        }
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

        // Redirection simple basée sur une colonne redirect_to (si elle existe)
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
        $this->routes       = [];
        $this->routesLoaded = false;
        $this->currentRoute = null;

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
    public function getCurrentRouteRights(): array
    {
        if (! $this->currentRoute) {
            return [];
        }

        return $this->currentRoute['rights'] ?? [];
    }

    /**
     * Vérifie si la route courante nécessite une authentification
     */
    public function currentRouteRequiresAuth(): bool
    {
        if (! $this->currentRoute) {
            return false;
        }

        return (bool) $this->currentRoute['page']['requires_auth'];
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
            'routes_loaded' => $this->routesLoaded,
            'routes_count'  => count($this->routes),
            'current_route' => $this->currentRoute['page']['slug'] ?? null,
            'http_method'   => $this->httpMethod,
            'web_directory' => $this->webDirectory,
            'request_info'  => $this->getRequestInfo(),
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
            'get_params'         => $this->getParams,
            'post_params'        => $this->postParams,
        ];
    }
}
