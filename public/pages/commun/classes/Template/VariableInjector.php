<?php
namespace Commun\Template;

use Commun\Config\Config;
use Commun\Router\Router;
use Commun\Security\CsrfManager;
use Commun\Security\RightsManager;
use Twig\Environment;

/**
 * Injecteur de variables pour Twig
 *
 * Centralise l'injection des variables globales dans Twig selon le contexte de rendu.
 * Gère automatiquement les variables utilisateur, configuration, navigation, etc.
 *
 * @package Commun\Template
 * @author Application Framework
 * @version 1.0
 */
class VariableInjector
{
    private Config $config;
    private ?Router $router;
    private ?RightsManager $rightsManager;
    private ?CsrfManager $csrfManager;
    private $logger; // Type flexible pour accepter différents types de logger
    private Environment $twig;

    /** @var array<string, mixed> Variables déjà injectées (cache) */
    private array $injectedVars = [];

    /**
     * Constructeur
     *
     * @param Environment $twig Environnement Twig
     * @param Config $config Instance de configuration
     * @param Router|null $router Instance du routeur
     * @param RightsManager|null $rightsManager Gestionnaire de droits
     * @param CsrfManager|null $csrfManager Gestionnaire CSRF
     * @param mixed $logger Logger (accepte différents types)
     */
    public function __construct(
        Environment $twig,
        Config $config,
        ?Router $router = null,
        ?RightsManager $rightsManager = null,
        ?CsrfManager $csrfManager = null,
        $logger = null
    ) {
        $this->twig          = $twig;
        $this->config        = $config;
        $this->router        = $router;
        $this->rightsManager = $rightsManager;
        $this->csrfManager   = $csrfManager;
        $this->logger        = $logger;
    }

    /**
     * Injecte toutes les variables nécessaires selon le contexte
     *
     * @param RenderContext $context Contexte de rendu
     * @param array<string, mixed> $currentRoute Route courante (optionnel)
     * @return void
     */
    public function injectVariables(RenderContext $context, ?array $currentRoute = null): void
    {
        $requiredGlobals = $context->getRequiredGlobals();

        foreach ($requiredGlobals as $globalName) {
            if (! isset($this->injectedVars[$globalName])) {
                $value = $this->getVariableValue($globalName, $context, $currentRoute);
                if ($value !== null) {
                    $this->twig->addGlobal($globalName, $value);
                    $this->injectedVars[$globalName] = $value;
                }
            }
        }

        // Variables spécifiques au contexte
        $this->injectContextSpecificVariables($context, $currentRoute);
    }

    /**
     * Retourne la valeur d'une variable globale
     *
     * @param string $name Nom de la variable
     * @param RenderContext $context Contexte de rendu
     * @param array<string, mixed>|null $currentRoute Route courante
     * @return mixed Valeur de la variable
     */
    private function getVariableValue(string $name, RenderContext $context, ?array $currentRoute = null): mixed
    {
        return match ($name) {
            'app' => $this->getAppVariables(),
            'request' => $this->getRequestVariables(),
            'config' => $this->getConfigVariables(),
            'user' => $this->getUserVariables(),
            'navigation' => $this->getNavigationVariables(),
            'current_route' => $currentRoute,
            'page_data' => $this->getPageDataVariables($currentRoute),
            'csrf_token' => $this->getCsrfToken(),
            'debug_info' => $this->getDebugVariables(),
            default => null
        };
    }

    /**
     * Variables de l'application
     *
     * @return array<string, mixed>
     */
    private function getAppVariables(): array
    {
        return [
            'name'        => $this->config->get('SITE', 'Application'),
            'version'     => $this->config->get('APP_VERSION', '1.0.0'),
            'environment' => $this->config->get('ENV', 'production'),
            'debug'       => $this->config->get('DEBUG_MODE', false),
        ];
    }

    /**
     * Variables de requête
     *
     * @return array<string, mixed>
     */
    private function getRequestVariables(): array
    {
        return [
            'uri'        => $_SERVER['REQUEST_URI'] ?? '/',
            'method'     => $_SERVER['REQUEST_METHOD'] ?? 'GET',
            'is_https'   => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? '',
            'is_ajax'    => ! empty($_SERVER['HTTP_X_REQUESTED_WITH']) &&
            strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest',
        ];
    }

    /**
     * Variables de configuration publiques
     *
     * @return array<string, mixed>
     */
    private function getConfigVariables(): array
    {
        // Variables de configuration à exposer dans Twig
        $twigVars = $this->config->getTwigVars();

        // Ajouter quelques variables système
        $systemVars = [
            'debug_mode'    => $this->config->get('DEBUG_MODE', false),
            'environment'   => $this->config->get('ENV', 'production'),
            'cache_enabled' => $this->config->get('TWIG_CACHE', false),
        ];

        return array_merge($twigVars, $systemVars);
    }

    /**
     * Variables utilisateur
     *
     * @return array<string, mixed>
     */
    private function getUserVariables(): array
    {
        if (! $this->rightsManager || ! $this->rightsManager->isAuthenticated()) {
            return [
                'authenticated' => false,
                'binaryRights'  => 0,
            ];
        }

        return [
            'authenticated'  => true,
            'id'             => $this->rightsManager->getUserId(),
            'name'           => $this->rightsManager->getUserName(),
            'email'          => $this->rightsManager->getUserMail(),
            'unit'           => $this->rightsManager->getUserUnit(),
            'cu'             => $this->rightsManager->getUserCu(),
            'short_name'     => $this->rightsManager->getUserShortName(),
            'timeline'       => $this->rightsManager->canReadTimeline(),
            'permanences'    => $this->rightsManager->canReadPermanences(),
            'import'         => $this->rightsManager->canImport(),
            'synthesisLevel' => $this->rightsManager->getSynthesisViewLevel(),
            'admin'          => $this->rightsManager->isAdmin(),
            'superAdmin'     => $this->rightsManager->isSuperAdmin(),
            'binaryRights'   => $this->rightsManager->getBinaryRights(),
            'debug'          => $this->rightsManager->isDebug(),
        ];
    }

    /**
     * Variables de navigation
     *
     * @return array<string>
     */
    private function getNavigationVariables(): array
    {
        if (! $this->router) {
            return [];
        }

        try {
            $allRoutes  = $this->router->getAllRoutes();
            $navigation = [];

            foreach ($allRoutes as $slug => $routeData) {
                $routePage  = $routeData['page'];
                $pageRights = (int) ($routePage['rights'] ?? 0);

                // Vérifier si l'utilisateur peut accéder à cette route
                $userCanAccess = true;
                if ($pageRights > 0 && $this->rightsManager) {
                    if (! $this->rightsManager->isAuthenticated()) {
                        $userCanAccess = false;
                    } else {
                        $userRights    = $this->rightsManager->getBinaryRights();
                        $userCanAccess = ($userRights & $pageRights) > 0;
                    }
                }

                if ($userCanAccess && ($routePage['active'] ?? true)) {
                    $navigation[] = [
                        'slug'            => $slug,
                        'title'           => $routePage['title'],
                        'description'     => $routePage['description'] ?? '',
                        'rights_required' => $pageRights,
                    ];
                }
            }

            return $navigation;

        } catch (\Exception $e) {
            if ($this->logger && method_exists($this->logger, 'debug')) {
                $this->logger->debug("Erreur génération navigation", ['error' => $e->getMessage()]);
            }
            return [];
        }
    }

    /**
     * Variables de données de page
     *
     * @param array<string, mixed>|null $currentRoute Route courante
     * @return array<string, mixed>|null
     */
    private function getPageDataVariables(?array $currentRoute = null): ?array
    {
        if (! $currentRoute) {
            return null;
        }

        $page      = $currentRoute['page'];
        $templates = $currentRoute['templates'] ?? [];

        $processedTemplates = [];
        $zonesAvailable     = [];
        $templatesCount     = 0;

        foreach ($templates as $zoneName => $zoneTemplates) {
            if (! empty($zoneTemplates)) {
                $zonesAvailable[]              = $zoneName;
                $processedTemplates[$zoneName] = [];

                foreach ($zoneTemplates as $template) {
                    $templateData = [
                        'id'            => $template['id'] ?? null,
                        'template_name' => $template['template_name'] ?? $template['name'] ?? 'unknown',
                        'priority'      => $template['priority'] ?? 0,
                        'enabled'       => $template['enabled'] ?? true,
                        'variables'     => json_decode($template['variables'] ?? '{}', true),
                        'content'       => $template['content'] ?? '',
                    ];

                    $processedTemplates[$zoneName][] = $templateData;
                    $templatesCount++;
                }

                // Trier par priorité
                usort($processedTemplates[$zoneName], function ($a, $b) {
                    return ($a['priority'] ?? 0) <=> ($b['priority'] ?? 0);
                });
            }
        }

        return [
            'id'                => $page['id'],
            'slug'              => $page['slug'],
            'title'             => $page['title'],
            'description'       => $page['description'] ?? '',
            'rights'            => $page['rights'] ?? 0,
            'active'            => $page['active'] ?? true,
            'zones_count'       => count($zonesAvailable),
            'templates_count'   => $templatesCount,
            'templates_by_zone' => $processedTemplates,
            'zones_available'   => $zonesAvailable,
        ];
    }

    /**
     * Token CSRF
     *
     * @return string|null
     */
    private function getCsrfToken(): ?string
    {
        return $this->csrfManager?->getToken();
    }

    /**
     * Variables de debug
     *
     * @return array<string, mixed>|null
     */
    private function getDebugVariables(): ?array
    {
        if (! $this->config->get('DEBUG_MODE', false)) {
            return null;
        }

        return [
            'init_time'            => isset($_SERVER['REQUEST_TIME_FLOAT']) ?
            round((microtime(true) - $_SERVER['REQUEST_TIME_FLOAT']) * 1000, 2) : 0,
            'memory_usage'         => round(memory_get_usage(true) / 1024 / 1024, 2),
            'peak_memory'          => round(memory_get_peak_usage(true) / 1024 / 1024, 2),
            'included_files_count' => count(get_included_files()),
            'request_uri'          => $_SERVER['REQUEST_URI'] ?? '/',
            'session_id'           => session_id(),
        ];
    }

    /**
     * Injecte des variables spécifiques au contexte
     *
     * @param RenderContext $context Contexte de rendu
     * @param array<string, mixed>|null $currentRoute Route courante
     * @return void
     */
    private function injectContextSpecificVariables(RenderContext $context, ?array $currentRoute = null): void
    {
        switch ($context) {
            case RenderContext::FULL_PAGE:
                // Variables spécifiques aux pages complètes
                if ($this->router && $currentRoute) {
                    $this->twig->addGlobal('page_templates_processed',
                        $this->injectedVars['page_data']['templates_by_zone'] ?? []);

                    $this->twig->addGlobal('breadcrumb',
                        $this->generateBreadcrumb($currentRoute['page']['slug']));
                }
                break;

            case RenderContext::MODAL:
                // Variables spécifiques aux modales
                $this->twig->addGlobal('is_modal', true);
                break;

            case RenderContext::COMPONENT:
                // Variables spécifiques aux composants
                $this->twig->addGlobal('is_component', true);
                break;
        }
    }

    /**
     * Génère le breadcrumb pour une page
     *
     * @param string $slug Slug de la page
     * @return array<array<string, mixed>>
     */
    private function generateBreadcrumb(string $slug): array
    {
        $slugParts   = explode('/', $slug);
        $breadcrumb  = [];
        $currentPath = '';

        foreach ($slugParts as $part) {
            $currentPath .= ($currentPath ? '/' : '') . $part;
            $breadcrumbTitle = ucfirst($part);

            // Essayer de trouver le titre réel de la page
            if ($this->router) {
                try {
                    $allRoutes = $this->router->getAllRoutes();
                    if (isset($allRoutes[$currentPath])) {
                        $breadcrumbTitle = $allRoutes[$currentPath]['page']['title'];
                    }
                } catch (\Exception $e) {
                    // Ignorer, utiliser le titre par défaut
                }
            }

            $breadcrumb[] = [
                'title'      => $breadcrumbTitle,
                'slug'       => $currentPath,
                'is_current' => $currentPath === $slug,
            ];
        }

        return $breadcrumb;
    }

    /**
     * Retourne toutes les variables injectées (pour debug)
     *
     * @return array<string, mixed>
     */
    public function getInjectedVariables(): array
    {
        return $this->injectedVars;
    }

    /**
     * Vide le cache des variables injectées
     *
     * @return void
     */
    public function clearCache(): void
    {
        $this->injectedVars = [];
    }
}
