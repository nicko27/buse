<?php
namespace Commun\Template;

use Commun\Config\Config;
use Commun\Router\Router;
use Commun\Security\CsrfManager;
use Commun\Security\RightsManager;
use Twig\Environment;
use Twig\Error\LoaderError;
use Twig\Extension\DebugExtension;
use Twig\Loader\FilesystemLoader;
use Twig\TwigFilter;
use Twig\TwigFunction;

/**
 * Gestionnaire centralisé de Twig
 *
 * Centralise toute la logique Twig :
 * - Initialisation et configuration
 * - Gestion des extensions et filtres
 * - Injection des variables globales
 * - Rendu des pages, modales et composants
 * - Logging des variables en mode debug
 *
 * @package Commun\Template
 * @author Application Framework
 * @version 1.0
 */
class TwigManager
{
    /** @var TwigManager|null Instance singleton */
    private static ?TwigManager $instance = null;

    private Environment $twig;
    private VariableInjector $variableInjector;
    private Config $config;
    private ?Router $router;
    private ?RightsManager $rightsManager;
    private ?CsrfManager $csrfManager;
    private $logger; // Type flexible pour accepter différents types de logger

    /** @var bool Indique si Twig est initialisé */
    private bool $initialized = false;

    /** @var array<string, mixed> Statistiques de rendu */
    private array $renderStats = [];

    /**
     * Constructeur privé (singleton)
     */
    private function __construct()
    {
        // Constructeur vide pour le singleton
    }

    /**
     * Retourne l'instance singleton
     *
     * @return self
     */
    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Initialise TwigManager
     *
     * @param Config $config Instance de configuration
     * @param Router|null $router Instance du routeur
     * @param RightsManager|null $rightsManager Gestionnaire de droits
     * @param mixed $logger Logger (accepte différents types)
     * @throws \Exception Si erreur d'initialisation
     */
    public function initialize(
        Config $config,
        ?Router $router = null,
        ?RightsManager $rightsManager = null,
        $logger = null
    ): void {
        if ($this->initialized) {
            return; // Déjà initialisé
        }

        $this->config        = $config;
        $this->router        = $router;
        $this->rightsManager = $rightsManager;
        $this->logger        = $logger;

        // Initialiser CSRF Manager si disponible
        try {
            $this->csrfManager = CsrfManager::getInstance();
        } catch (\Exception $e) {
            $this->csrfManager = null;
            if ($this->logger) {
                $this->logDebug("CSRF Manager non disponible", ['error' => $e->getMessage()]);
            }
        }

        // Configurer Twig
        $this->configureTwig();

        // Créer l'injecteur de variables
        $this->variableInjector = new VariableInjector(
            $this->twig,
            $this->config,
            $this->router,
            $this->rightsManager,
            $this->csrfManager,
            $this->logger
        );

        // Ajouter les extensions et filtres
        $this->addExtensions();
        $this->addFilters();
        $this->addFunctions();

        $this->initialized = true;

        if ($this->logger) {
            $this->logInfo("TwigManager initialisé avec succès");
        }
    }

    /**
     * Configure l'environnement Twig
     *
     * @throws \Exception Si erreur de configuration
     */
    private function configureTwig(): void
    {
        // Détection et création du répertoire des vues
        $viewsDir = $this->findOrCreateViewsDirectory();

        // Créer le loader
        $loader = new FilesystemLoader($viewsDir);

        // Configuration des options Twig
        $twigOptions = [
            'cache'            => $this->configureTwigCache(),
            'debug'            => $this->config->get('DEBUG_MODE', false),
            'strict_variables' => $this->config->get('TWIG_STRICT_VARIABLES', false),
            'autoescape'       => $this->config->get('TWIG_AUTOESCAPE', 'html'),
            'optimizations'    => $this->config->get('TWIG_OPTIMIZATIONS', -1),
        ];

        // Créer l'environnement Twig
        $this->twig = new Environment($loader, $twigOptions);

        if ($this->logger) {
            $this->logInfo("Environnement Twig configuré", [
                'views_dir'     => $viewsDir,
                'cache_enabled' => $twigOptions['cache'] !== false,
                'debug_enabled' => $twigOptions['debug'],
            ]);
        }
    }

    /**
     * Trouve ou crée le répertoire des vues
     *
     * @return string Chemin vers le répertoire des vues
     * @throws \Exception Si impossible de créer le répertoire
     */
    private function findOrCreateViewsDirectory(): string
    {
        // 1. Essayer la configuration
        $viewsDir = $this->config->get('VIEWS_DIR');

        // 2. Chemins par défaut à essayer
        $defaultPaths = [
            dirname(__DIR__, 2) . '/views',     // public/pages/views
            dirname(__DIR__, 3) . '/views',     // views (racine)
            dirname(__DIR__, 3) . '/templates', // templates (racine)
            dirname(__DIR__, 2) . '/templates', // public/pages/templates
        ];

        // 3. Si pas de config, essayer les chemins par défaut
        if (! $viewsDir) {
            foreach ($defaultPaths as $path) {
                if (is_dir($path) && is_readable($path)) {
                    $viewsDir = $path;
                    break;
                }
            }
        }

        // 4. Si toujours rien, créer le répertoire par défaut
        if (! $viewsDir || ! is_dir($viewsDir)) {
            $viewsDir = dirname(__DIR__, 2) . '/views';

            if (! is_dir($viewsDir)) {
                if (! mkdir($viewsDir, 0755, true)) {
                    throw new \Exception("Impossible de créer le répertoire des vues : $viewsDir");
                }
            }
        }

        // Vérification finale
        if (! is_readable($viewsDir)) {
            throw new \Exception("Le dossier des vues n'est pas lisible : $viewsDir");
        }

        return realpath($viewsDir);
    }

    /**
     * Configure le cache Twig
     *
     * @return string|false Chemin du cache ou false si désactivé
     */
    private function configureTwigCache(): string | false
    {
        $cacheEnabled = $this->config->get('TWIG_CACHE', false);

        if (! $cacheEnabled) {
            return false;
        }

        $cacheDir = is_string($cacheEnabled) ?
        $cacheEnabled :
        $this->config->get('TWIG_CACHE_DIR', dirname(__DIR__, 3) . '/cache/twig');

        if (! is_dir($cacheDir)) {
            if (! mkdir($cacheDir, 0755, true)) {
                if ($this->logger) {
                    $this->logWarning("Impossible de créer le cache Twig", ['cache_dir' => $cacheDir]);
                }
                return false;
            }
        }

        if (! is_writable($cacheDir)) {
            if ($this->logger) {
                $this->logWarning("Cache Twig non accessible en écriture", ['cache_dir' => $cacheDir]);
            }
            return false;
        }

        return $cacheDir;
    }

    /**
     * Ajoute les extensions Twig
     *
     * @return void
     */
    private function addExtensions(): void
    {
        // Extension de debug si activée
        if ($this->config->get('DEBUG_MODE', false)) {
            $this->twig->addExtension(new DebugExtension());
        }

        // Extension personnalisée de l'application
        if (class_exists('Commun\Template\TwigExtensions')) {
            $this->twig->addExtension(new TwigExtensions());
        }
    }

    /**
     * Ajoute les filtres Twig personnalisés
     *
     * @return void
     */
    private function addFilters(): void
    {
        // Filtre pour trier un tableau par propriété
        $this->twig->addFilter(new TwigFilter('sort_by', function ($array, $property) {
            if (! is_array($array)) {
                return $array;
            }

            usort($array, function ($a, $b) use ($property) {
                $aVal = is_array($a) ? ($a[$property] ?? 0) : (isset($a->$property) ? $a->$property : 0);
                $bVal = is_array($b) ? ($b[$property] ?? 0) : (isset($b->$property) ? $b->$property : 0);
                return $aVal <=> $bVal;
            });

            return $array;
        }));

        // Filtre pour filtrer un tableau par propriété
        $this->twig->addFilter(new TwigFilter('filter_by', function ($array, $property, $value) {
            if (! is_array($array)) {
                return [];
            }

            return array_filter($array, function ($item) use ($property, $value) {
                $itemVal = is_array($item) ? ($item[$property] ?? null) : (isset($item->$property) ? $item->$property : null);
                return $itemVal === $value;
            });
        }));

        // Filtre pour formater une taille de fichier
        $this->twig->addFilter(new TwigFilter('filesize', function ($bytes) {
            if ($bytes <= 0) {
                return '0 B';
            }

            $units = ['B', 'KB', 'MB', 'GB', 'TB'];
            $base  = log($bytes, 1024);
            return round(pow(1024, $base - floor($base)), 2) . ' ' . $units[floor($base)];
        }));

        // Filtre pour JSON pretty print
        $this->twig->addFilter(new TwigFilter('json_pretty', function ($value) {
            return json_encode($value, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        }));
    }

    /**
     * Ajoute les fonctions Twig personnalisées
     *
     * @return void
     */
    private function addFunctions(): void
    {
        // Fonction pour générer une URL avec le routeur
        $this->twig->addFunction(new TwigFunction('url', function ($route, $params = []) {
            if ($this->router && method_exists($this->router, 'generateUrl')) {
                return $this->router->generateUrl($route, $params);
            } else {
                // Fallback
                $webDir = $this->config->get('WEB_DIR', '');
                $url    = $webDir . '/' . trim($route, '/');

                if (! empty($params)) {
                    $url .= '?' . http_build_query($params);
                }

                return $url;
            }
        }));

        // Fonction pour vérifier si une route existe
        $this->twig->addFunction(new TwigFunction('route_exists', function ($route) {
            if ($this->router && method_exists($this->router, 'routeExists')) {
                return $this->router->routeExists($route);
            }
            return false;
        }));

        // Fonction pour vérifier un droit utilisateur
        $this->twig->addFunction(new TwigFunction('has_right', function ($right) {
            if (! $this->rightsManager || ! $this->rightsManager->isAuthenticated()) {
                return false;
            }

            return match ($right) {
                'timeline' => $this->rightsManager->canReadTimeline(),
                'permanences' => $this->rightsManager->canReadPermanences(),
                'import'      => $this->rightsManager->canImport(),
                'admin'       => $this->rightsManager->isAdmin(),
                'super_admin' => $this->rightsManager->isSuperAdmin(),
                default       => $this->rightsManager->hasRight($right)
            };
        }));

        // Fonction pour obtenir la configuration
        $this->twig->addFunction(new TwigFunction('config', function ($key, $default = null) {
            return $this->config->get($key, $default);
        }));

        // Fonction pour obtenir des templates d'une zone
        $this->twig->addFunction(new TwigFunction('get_templates_for_zone', function ($zone) {
            if (! $this->router || ! method_exists($this->router, 'getTemplatesForZone')) {
                return [];
            }
            return $this->router->getTemplatesForZone($zone);
        }));
    }

    /**
     * Rend une page complète
     *
     * @param array<string, mixed> $currentRoute Route courante
     * @return string HTML rendu
     * @throws \Exception Si erreur de rendu
     */
    public function renderPage(array $currentRoute): string
    {
        $startTime = microtime(true);

        try {
            // Injecter les variables pour une page complète
            $this->variableInjector->injectVariables(RenderContext::FULL_PAGE, $currentRoute);

            // Déterminer le layout à utiliser
            $layoutTemplate = $this->getLayoutTemplate($currentRoute);

            // Variables supplémentaires pour le rendu
            $this->twig->addGlobal('render_context', RenderContext::FULL_PAGE->value);
            $this->twig->addGlobal('render_time', date('Y-m-d H:i:s'));

            // Rendu
            $output = $this->twig->render($layoutTemplate);

            $renderTime = round((microtime(true) - $startTime) * 1000, 2);

            // Statistiques
            $this->renderStats[] = [
                'type'           => 'page',
                'template'       => $layoutTemplate,
                'render_time_ms' => $renderTime,
                'output_size'    => strlen($output),
                'timestamp'      => time(),
            ];

            if ($this->logger) {
                $this->logInfo("Page rendue avec succès", [
                    'page'              => $currentRoute['page']['slug'],
                    'layout'            => $layoutTemplate,
                    'render_time_ms'    => $renderTime,
                    'output_size_bytes' => strlen($output),
                ]);
            }

            return $output;

        } catch (LoaderError $e) {
            throw new \Exception("Template de layout non trouvé : " . $e->getMessage());
        } catch (\Exception $e) {
            if ($this->logger) {
                $this->logError("Erreur de rendu de page", [
                    'page'  => $currentRoute['page']['slug'] ?? 'unknown',
                    'error' => $e->getMessage(),
                ]);
            }
            throw $e;
        }
    }

    /**
     * Rend une modale
     *
     * @param string $templateName Nom du template modal
     * @param array<string, mixed> $data Données pour le template
     * @return string HTML rendu
     * @throws \Exception Si erreur de rendu
     */
    public function renderModal(string $templateName, array $data = []): string
    {
        $startTime = microtime(true);

        try {
            // Injecter les variables pour une modale
            $this->variableInjector->injectVariables(RenderContext::MODAL);

            // Ajouter les données spécifiques à la modale
            foreach ($data as $key => $value) {
                $this->twig->addGlobal($key, $value);
            }

            $this->twig->addGlobal('render_context', RenderContext::MODAL->value);

            // Rendu
            $output = $this->twig->render($templateName);

            $renderTime = round((microtime(true) - $startTime) * 1000, 2);

            // Statistiques
            $this->renderStats[] = [
                'type'           => 'modal',
                'template'       => $templateName,
                'render_time_ms' => $renderTime,
                'output_size'    => strlen($output),
                'timestamp'      => time(),
            ];

            if ($this->logger) {
                $this->logDebug("Modale rendue", [
                    'template'       => $templateName,
                    'render_time_ms' => $renderTime,
                ]);
            }

            return $output;

        } catch (LoaderError $e) {
            throw new \Exception("Template modal non trouvé : $templateName");
        } catch (\Exception $e) {
            if ($this->logger) {
                $this->logError("Erreur de rendu de modale", [
                    'template' => $templateName,
                    'error'    => $e->getMessage(),
                ]);
            }
            throw $e;
        }
    }

    /**
     * Rend un composant
     *
     * @param string $componentName Nom du composant
     * @param array<string, mixed> $data Données pour le composant
     * @return string HTML rendu
     * @throws \Exception Si erreur de rendu
     */
    public function renderComponent(string $componentName, array $data = []): string
    {
        $startTime = microtime(true);

        try {
            // Injecter les variables pour un composant
            $this->variableInjector->injectVariables(RenderContext::COMPONENT);

            // Ajouter les données spécifiques au composant
            foreach ($data as $key => $value) {
                $this->twig->addGlobal($key, $value);
            }

            $this->twig->addGlobal('render_context', RenderContext::COMPONENT->value);

            // Rendu
            $output = $this->twig->render($componentName);

            $renderTime = round((microtime(true) - $startTime) * 1000, 2);

            if ($this->logger) {
                $this->logDebug("Composant rendu", [
                    'component'      => $componentName,
                    'render_time_ms' => $renderTime,
                ]);
            }

            return $output;

        } catch (LoaderError $e) {
            throw new \Exception("Template composant non trouvé : $componentName");
        } catch (\Exception $e) {
            if ($this->logger) {
                $this->logError("Erreur de rendu de composant", [
                    'component' => $componentName,
                    'error'     => $e->getMessage(),
                ]);
            }
            throw $e;
        }
    }

    /**
     * Détermine le template de layout à utiliser
     *
     * @param array<string, mixed> $currentRoute Route courante
     * @return string Nom du template de layout
     */
    private function getLayoutTemplate(array $currentRoute): string
    {
        // Layout par défaut
        $layoutTemplate = $this->config->get('DEFAULT_LAYOUT', 'layouts/default.twig');

        // Override par page spécifique
        $pageSlug      = str_replace('/', '_', $currentRoute['page']['slug']);
        $pageLayoutKey = 'LAYOUT_' . strtoupper($pageSlug);
        $pageLayout    = $this->config->get($pageLayoutKey);

        if ($pageLayout) {
            $layoutTemplate = $pageLayout;
        }

        // Override global
        $globalLayout = $this->config->get('TWIG_DEFAULT_LAYOUT');
        if ($globalLayout && ! $pageLayout) {
            $layoutTemplate = $globalLayout;
        }

        return $layoutTemplate;
    }

    /**
     * Log toutes les variables Twig en mode debug
     *
     * @return void
     */
    public function debugLogVariables(): void
    {
        if (! $this->config->get('DEBUG_MODE', false) || ! $this->logger) {
            return;
        }

        try {
            $twigGlobals  = $this->twig->getGlobals();
            $injectedVars = $this->variableInjector->getInjectedVariables();

            // Nettoyer et masquer les variables pour le log
            $sanitizedVars = [];
            foreach ($twigGlobals as $key => $value) {
                $sanitizedVars[$key] = $this->sanitizeForLog($value, 3);
            }
            $maskedVars = $this->maskSensitiveData($sanitizedVars);

            $this->logDebug("Variables Twig disponibles", [
                'total_vars_count'    => count($twigGlobals),
                'injected_vars_count' => count($injectedVars),
                'variables'           => $maskedVars,
            ]);

        } catch (\Exception $e) {
            $this->logWarning("Erreur lors du logging des variables Twig", [
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Ajoute une variable globale
     *
     * @param string $name Nom de la variable
     * @param mixed $value Valeur de la variable
     * @return void
     */
    public function addGlobalVariable(string $name, mixed $value): void
    {
        $this->twig->addGlobal($name, $value);
    }

    /**
     * Retourne l'environnement Twig
     *
     * @return Environment
     * @throws \Exception Si TwigManager non initialisé
     */
    public function getEnvironment(): Environment
    {
        if (! $this->initialized) {
            throw new \Exception("TwigManager non initialisé. Appelez initialize() d'abord.");
        }

        return $this->twig;
    }

    /**
     * Retourne les statistiques de rendu
     *
     * @return array<array<string, mixed>>
     */
    public function getRenderStats(): array
    {
        return $this->renderStats;
    }

    /**
     * Vide les statistiques de rendu
     *
     * @return void
     */
    public function clearRenderStats(): void
    {
        $this->renderStats = [];
    }

    /**
     * Indique si TwigManager est initialisé
     *
     * @return bool
     */
    public function isInitialized(): bool
    {
        return $this->initialized;
    }

    // ===== MÉTHODES HELPER DE LOGGING =====

    /**
     * Log une information
     */
    private function logInfo(string $message, array $context = []): void
    {
        if ($this->logger && method_exists($this->logger, 'info')) {
            $this->logger->info($message, $context);
        }
    }

    /**
     * Log un debug
     */
    private function logDebug(string $message, array $context = []): void
    {
        if ($this->logger && method_exists($this->logger, 'debug')) {
            $this->logger->debug($message, $context);
        }
    }

    /**
     * Log un warning
     */
    private function logWarning(string $message, array $context = []): void
    {
        if ($this->logger && method_exists($this->logger, 'warning')) {
            $this->logger->warning($message, $context);
        }
    }

    /**
     * Log une erreur
     */
    private function logError(string $message, array $context = []): void
    {
        if ($this->logger && method_exists($this->logger, 'error')) {
            $this->logger->error($message, $context);
        }
    }

    /**
     * Sanitize des données pour le log (version simplifiée)
     */
    private function sanitizeForLog($data, int $maxDepth = 3): mixed
    {
        if ($maxDepth <= 0) {
            return '[MAX_DEPTH_REACHED]';
        }

        if (is_array($data)) {
            $result = [];
            $count  = 0;
            foreach ($data as $key => $value) {
                if ($count >= 10) {
                    $result['...'] = '[TRUNCATED]';
                    break;
                }
                $result[$key] = $this->sanitizeForLog($value, $maxDepth - 1);
                $count++;
            }
            return $result;
        } elseif (is_object($data)) {
            return ['__object_class' => get_class($data)];
        } elseif (is_string($data) && strlen($data) > 100) {
            return substr($data, 0, 100) . '...';
        }

        return $data;
    }

    /**
     * Masque les données sensibles (version simplifiée)
     */
    private function maskSensitiveData(array $data): array
    {
        $sensitiveKeys = ['password', 'token', 'secret', 'key', 'mail'];

        foreach ($data as $key => $value) {
            $keyLower = strtolower($key);
            foreach ($sensitiveKeys as $sensitive) {
                if (strpos($keyLower, $sensitive) !== false) {
                    $data[$key] = '***masked***';
                    break;
                }
            }
        }

        return $data;
    }
}
