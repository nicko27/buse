<?php
namespace Commun\Router;

use Commun\Database\BDDManager;
use Commun\Logger\Logger;
use Commun\Security\RightsManager;

/**
 * Classe Router - Gestionnaire de routage basé sur base de données avec gestion des droits
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

    /**
     * Constructeur privé pour empêcher l'instanciation directe
     */
    private function __construct(BDDManager $dbManager)
    {
        $this->dbManager = $dbManager;

        try {
            $this->logger = Logger::getInstance()->getLogger();
        } catch (\Exception $e) {
            $this->logger = new \Psr\Log\NullLogger();
        }
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
     * Charge toutes les routes depuis la base de données
     */
    public function loadRoutes(): void
    {
        if ($this->routesLoaded) {
            return;
        }

        try {
            // Charger les pages actives avec BDDManager
            $pagesResult = $this->dbManager->getAllContentTable('pages');

            foreach ($pagesResult as $page) {
                if (! $page['active']) {
                    continue;
                }

                $pageId                      = $page['id'];
                $this->routes[$page['slug']] = [
                    'page'       => $page,
                    'templates'  => $this->loadPageTemplates($pageId),
                    'js_assets'  => $this->loadPageJSAssets($pageId),
                    'css_assets' => $this->loadPageCSSAssets($pageId),
                    'rights'     => $this->loadPageRights($pageId),
                ];
            }

            $this->routesLoaded = true;
            $this->logger->info("Routes chargées avec succès", ['count' => count($this->routes)]);

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des routes", [
                'error' => $e->getMessage(),
            ]);
            throw $e;
        }
    }

    /**
     * Charge les droits requis pour une page
     */
    private function loadPageRights(int $pageId): array
    {
        try {
            // Récupérer les droits depuis la table page_rights
            $rightsResult = $this->dbManager->getAllContentTable('page_rights');

            $pageRights = [];
            foreach ($rightsResult as $right) {
                if ($right['page_id'] == $pageId) {
                    $pageRights[] = $right['right_name'];
                }
            }

            return $pageRights;

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des droits de la page", [
                'page_id' => $pageId,
                'error'   => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Charge les templates d'une page
     */
    private function loadPageTemplates(int $pageId): array
    {
        try {
            $templatesResult = $this->dbManager->getAllContentTable('page_templates');

            // Filtrer par page_id et trier par order_position
            $pageTemplates = [];
            foreach ($templatesResult as $template) {
                if ($template['page_id'] == $pageId) {
                    $pageTemplates[] = $template;
                }
            }

            // Trier par order_position
            usort($pageTemplates, function ($a, $b) {
                return ($a['order_position'] ?? 0) <=> ($b['order_position'] ?? 0);
            });

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
     * Charge les assets JavaScript d'une page
     */
    private function loadPageJSAssets(int $pageId): array
    {
        try {
            $jsAssetsResult = $this->dbManager->getAllContentTable('page_assets_js');

            // Filtrer par page_id et trier par order_position
            $pageJSAssets = [];
            foreach ($jsAssetsResult as $asset) {
                if ($asset['page_id'] == $pageId) {
                    $pageJSAssets[] = $asset;
                }
            }

            // Trier par order_position
            usort($pageJSAssets, function ($a, $b) {
                return ($a['order_position'] ?? 0) <=> ($b['order_position'] ?? 0);
            });

            return $pageJSAssets;

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des assets JS", [
                'page_id' => $pageId,
                'error'   => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Charge les assets CSS d'une page
     */
    private function loadPageCSSAssets(int $pageId): array
    {
        try {
            $cssAssetsResult = $this->dbManager->getAllContentTable('page_assets_css');

            // Filtrer par page_id et trier par order_position
            $pageCSSAssets = [];
            foreach ($cssAssetsResult as $asset) {
                if ($asset['page_id'] == $pageId) {
                    $pageCSSAssets[] = $asset;
                }
            }

            // Trier par order_position
            usort($pageCSSAssets, function ($a, $b) {
                return ($a['order_position'] ?? 0) <=> ($b['order_position'] ?? 0);
            });

            return $pageCSSAssets;

        } catch (\Exception $e) {
            $this->logger->error("Erreur lors du chargement des assets CSS", [
                'page_id' => $pageId,
                'error'   => $e->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * Trouve une route correspondant au slug donné
     */
    public function match(string $slug): ?array
    {
        $this->loadRoutes();

        // Nettoyer le slug
        $slug = trim($slug, '/');

        // Utiliser la route par défaut si vide
        if (empty($slug)) {
            $slug = $this->defaultRoute;
        }

        if (isset($this->routes[$slug])) {
            $this->currentRoute = $this->routes[$slug];
            return $this->currentRoute;
        }

        return null;
    }

    /**
     * Définit le répertoire web de l'application
     */
    public function setWebDirectory(string $webDir): void
    {
        $this->webDirectory = '/' . trim($webDir, '/');
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

        return $this->match($path);
    }

    /**
     * Retourne la route actuellement active
     */
    public function getCurrentRoute(): ?array
    {
        return $this->currentRoute;
    }

    /**
     * Vérifie si l'utilisateur a les droits pour accéder à une route
     *
     * @param array $route La route à vérifier
     * @return bool True si l'utilisateur a accès, false sinon
     */
    public function checkAccess(array $route): bool
    {
        $page = $route['page'];

        // Si l'authentification est requise
        if ($page['requires_auth']) {
            // Vérifier si l'utilisateur est connecté
            if (! $this->isUserAuthenticated()) {
                $this->logger->info("Accès refusé : utilisateur non authentifié", [
                    'page' => $page['slug'],
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
                    ]);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * Vérifie si l'utilisateur possède un droit spécifique
     *
     * @param string $right Le nom du droit à vérifier
     * @return bool True si l'utilisateur possède le droit
     */
    private function checkUserRight(string $right): bool
    {
        if (! $this->rightsManager) {
            return false;
        }

        // Mapper les noms de droits avec les méthodes du RightsManager
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
                // Pour tout autre droit, utiliser la méthode générique
                return $this->rightsManager->hasRight($right);
        }
    }

    /**
     * Vérifie si l'utilisateur est authentifié
     */
    private function isUserAuthenticated(): bool
    {
        // Utiliser RightsManager s'il est disponible
        if ($this->rightsManager) {
            return $this->rightsManager->isAuthenticated();
        }

        // Sinon, vérifier la session
        return isset($_SESSION['user']) && ! empty($_SESSION['user']);
    }

    /**
     * Gère une redirection si nécessaire
     */
    public function handleRedirect(array $route): bool
    {
        $page = $route['page'];

        if (! empty($page['redirect_to'])) {
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
     * Retourne tous les templates d'une route groupés par type
     */
    public function getTemplatesByType(array $route): array
    {
        $templatesByType = [];

        foreach ($route['templates'] as $template) {
            $type = $template['type_twig'];
            if (! isset($templatesByType[$type])) {
                $templatesByType[$type] = [];
            }
            $templatesByType[$type][] = $template;
        }

        return $templatesByType;
    }

    /**
     * Retourne tous les assets JavaScript groupés par position
     */
    public function getJSAssetsByPosition(array $route): array
    {
        $assetsByPosition = [];

        foreach ($route['js_assets'] as $asset) {
            $position = $asset['position'];
            if (! isset($assetsByPosition[$position])) {
                $assetsByPosition[$position] = [];
            }
            $assetsByPosition[$position][] = $asset;
        }

        return $assetsByPosition;
    }

    /**
     * Retourne tous les assets CSS groupés par media
     */
    public function getCSSAssetsByMedia(array $route): array
    {
        $assetsByMedia = [];

        foreach ($route['css_assets'] as $asset) {
            $media = $asset['media'];
            if (! isset($assetsByMedia[$media])) {
                $assetsByMedia[$media] = [];
            }
            $assetsByMedia[$media][] = $asset;
        }

        return $assetsByMedia;
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
}
