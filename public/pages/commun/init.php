<?php

use Commun\Config\Config;
use Commun\Database\SqlAdapter;
use Commun\Database\SqlManager;
use Commun\Ldap\BaseDNConfig;
use Commun\Ldap\LdapConfig;
use Commun\Ldap\LdapManager;
use Commun\Logger\Logger;
use Commun\Router\Router;
use Commun\Security\CsrfManager;
use Commun\Security\RightsManager;
use Commun\Template\TwigExtensions;

require_once dirname(__DIR__, 3) . "/vendor/autoload.php";

// Charger les classes nécessaires
require_once __DIR__ . "/Config/Config.php";
require_once __DIR__ . "/Database/BDDManager.php";
require_once __DIR__ . "/Database/SqlManager.php";
require_once __DIR__ . "/Database/SqlAdapter.php";
require_once __DIR__ . "/Router/Router.php";
require_once __DIR__ . "/Logger/Logger.php";
require_once __DIR__ . "/Utils/FileUtils.php";
require_once __DIR__ . "/Utils/DateUtils.php";
require_once __DIR__ . "/Utils/StringUtils.php";
require_once __DIR__ . "/Utils/ExcelProcessor.php";
require_once __DIR__ . "/Utils/TphUtils.php";
require_once __DIR__ . "/Utils/UploadManager.php";
require_once __DIR__ . "/Utils/FileListUtils.php";
require_once __DIR__ . "/Ldap/LdapManager.php";
require_once __DIR__ . "/Template/TwigExtensions.php";
require_once __DIR__ . "/Security/CsrfManager.php";
require_once __DIR__ . "/Mail/EMLGenerator.php";
require_once __DIR__ . "/Security/RightsManager.php";

// =====================================================
// ÉTAPE 1 : Initialisation de la configuration
// =====================================================

$config = Config::getInstance();

try {
    // Initialiser SqlManager avec les paramètres du .env
    SqlManager::initWithParams(
        $config->get('DB_HOST'),
        $config->get('DB_NAME'),
        $config->get('DB_USER'),
        $config->get('DB_PASSWORD')
    );

    // Créer l'adapter et charger la configuration depuis la base de données
    $sqlManager = SqlManager::getInitializedInstance();
    $sqlAdapter = new SqlAdapter($sqlManager);
    $config->loadFromDatabase($sqlAdapter);

} catch (\Exception $e) {
    error_log("Erreur d'initialisation de la base de données : " . $e->getMessage());
    // Continuer avec la config .env seulement si la BDD n'est pas accessible
}

// =====================================================
// ÉTAPE 2 : Initialisation du logger
// =====================================================

Logger::initWithParams(
    $config->get('LOGGER_NAME', $config->get('SITE', 'buse')),
    $config->get('LOG_DIR', dirname(__DIR__, 3) . '/logs')
);
$logger = Logger::getInstance()->getLogger();

// =====================================================
// ÉTAPE 3 : Gestion de session et CSRF
// =====================================================

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$csrfManager            = CsrfManager::getInstance();
$_SESSION['CSRF_TOKEN'] = $csrfManager->getToken();

// =====================================================
// ÉTAPE 4 : Création des répertoires nécessaires
// =====================================================

$directories = [
    $config->get('LOG_DIR', dirname(__DIR__, 3) . '/logs'),
    $config->get('UPLOAD_DIR', dirname(__DIR__, 3) . '/files'),
];

foreach ($directories as $dir) {
    if (! is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

// =====================================================
// ÉTAPE 5 : Initialisation du routeur simplifié
// =====================================================

$router = Router::getInstance($sqlAdapter);
$router->setWebDirectory($config->get('WEB_DIR', ''));
$router->setDefaultRoute($config->get('DEFAULT_ROUTE', 'index'));
$router->setAccessDeniedRoute($config->get('ACCESS_DENIED_ROUTE', 'login'));

// =====================================================
// ÉTAPE 6 : Configuration de Twig simple
// =====================================================

$viewsDir = $config->get('VIEWS_DIR');
if (! $viewsDir) {
    $viewsDir = dirname(__DIR__, 2) . '/views';
}

if (! is_dir($viewsDir)) {
    throw new \Exception("Le dossier des vues n'existe pas : $viewsDir");
}

$loader = new \Twig\Loader\FilesystemLoader($viewsDir);
$twig   = new \Twig\Environment($loader, [
    'cache' => $config->get('TWIG_CACHE', false),
    'debug' => $config->get('TWIG_DEBUG', true),
]);

// Ajouter les extensions Twig
$twig->addExtension(new \Twig\Extension\DebugExtension());
$twig->addExtension(new TwigExtensions());

// Ajouter des filtres utiles pour les templates
$twig->addFilter(new \Twig\TwigFilter('sort_by', function ($array, $property) {
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

$twig->addFilter(new \Twig\TwigFilter('filter_by', function ($array, $property, $value) {
    if (! is_array($array)) {
        return [];
    }

    return array_filter($array, function ($item) use ($property, $value) {
        $itemVal = is_array($item) ? ($item[$property] ?? null) : (isset($item->$property) ? $item->$property : null);
        return $itemVal === $value;
    });
}));

// Ajouter les variables de configuration à Twig
foreach ($config->getTwigVars() as $key => $value) {
    $twig->addGlobal($key, $value);
}

// =====================================================
// ÉTAPE 7 : Configuration LDAP
// =====================================================

$ldapAvailable = false;
try {
    $ldapBaseDNLists    = $config->get("LDAP_BASE_DN_LISTS");
    $ldapBaseDNServices = $config->get("LDAP_BASE_DN_SERVICES");
    $ldapBaseDNPersons  = $config->get("LDAP_BASE_DN_PERSONS");
    $ldapHost           = $config->get("LDAP_HOST");
    $ldapPort           = $config->get("LDAP_PORT");
    $ldapUseLdaps       = $config->get("LDAP_USE_LDAPS");

    if ($ldapBaseDNLists && $ldapBaseDNServices && $ldapBaseDNPersons) {
        $baseDN = new BaseDNConfig(
            lists: $ldapBaseDNLists,
            services: $ldapBaseDNServices,
            persons: $ldapBaseDNPersons
        );

        if ($ldapHost && $ldapPort !== null && $ldapUseLdaps !== null) {
            $ldapConfig = new LdapConfig(
                host: $ldapHost,
                port: $ldapPort,
                useLdaps: $ldapUseLdaps,
                baseDN: $baseDN
            );

            $ldap          = LdapManager::initialize($ldapConfig);
            $ldapAvailable = true;
        } else {
            throw new \Exception("Configuration LDAP incomplète : host, port ou useLdaps manquant");
        }
    } else {
        throw new \Exception("Configuration LDAP incomplète : BaseDN manquant");
    }
} catch (\Throwable $e) {
    $logger->error("Erreur de connexion LDAP", [
        'error' => $e->getMessage(),
        'code'  => $e->getCode(),
        'file'  => $e->getFile(),
        'line'  => $e->getLine(),
    ]);
    $ldapAvailable = false;
}

// =====================================================
// ÉTAPE 8 : Initialisation du gestionnaire de droits
// =====================================================

$rightsManager = RightsManager::getInstance();

// Gestion du mode debug
$debug      = 0;
$serverAddr = $_SERVER['SERVER_ADDR'] ?? '127.0.0.1';

// Debug sur localhost ou environnement de développement
if ($serverAddr === "127.0.0.1" || $config->get("ENV") === "dev") {
    $debug = (int) $config->get("DEBUG", 0);
}

// Override debug par paramètre GET
if (isset($_GET['debug'])) {
    $debug = (int) $_GET['debug'];
}

// Authentification en mode debug
if ($debug === $config->get("DEBUG")) {
    $nigend = $_GET['nigend'] ?? 224286;

    $personsAttributes = ["employeenumber", "title", "sn", "givenname", "mail", "codeunite", "ou"];
    $person            = sprintf("employeenumber=%s", $nigend);
    $personsInfo       = [];

    if ($ldapAvailable) {
        $ldapManager = LdapManager::getInstance();
        $personsInfo = $ldapManager->searchPersons($person, $personsAttributes, 10)[0] ?? null;
    }

    // Fallback pour l'utilisateur de test
    if (! $personsInfo && $nigend == 224286) {
        $personsInfo = [
            "employeenumber" => "224286",
            "title"          => "ADJ",
            "sn"             => "VOIRIN",
            "givenname"      => "Nicolas",
            "mail"           => "nicolas.voirin@gendarmerie.interieur.gouv.fr",
            "ou"             => "SOLC BDRIJ GGD27",
            "codeunite"      => "12027",
        ];
    }

    $rightsManager->initialize(1, $personsInfo ?: []);
} else {
    $rightsManager->initialize();
}

$logger->info("Utilisateur connecté - CU: " . $rightsManager->getUserCu());

// Lier le gestionnaire de droits au routeur
$router->setRightsManager($rightsManager);

// =====================================================
// ÉTAPE 9 : Routage et résolution de la requête
// =====================================================

// Router la requête actuelle
$currentRoute = $router->matchFromUri();

// Si aucune route trouvée, page 404
if (! $currentRoute) {
    http_response_code(404);

    try {
        echo $twig->render('errors/404.twig', [
            'requested_uri'    => $_SERVER['REQUEST_URI'] ?? '/',
            'available_routes' => array_keys($router->getAllRoutes()),
            'is_debug'         => $config->get('TWIG_DEBUG', false),
        ]);
    } catch (\Exception $e) {
        die("Page non trouvée");
    }
    exit;
}

// Vérifier les droits d'accès
if (! $router->checkAccess($currentRoute)) {
    $logger->warning("Accès refusé pour l'utilisateur", [
        'user_id'         => $rightsManager->getUserId(),
        'page'            => $currentRoute['page']['slug'],
        'method'          => $router->isPost() ? 'POST' : 'GET',
        'required_rights' => $currentRoute['rights'] ?? [],
    ]);

    // Rediriger vers la page d'accès refusé
    $router->redirectToAccessDenied();
}

// Gérer les redirections
$router->handleRedirect($currentRoute);

// =====================================================
// ÉTAPE 10 : Préparation des données pour Twig
// =====================================================

// Construire le tableau des droits pour la session et Twig
$rightsTbl = [
    'debug'          => $debug,
    'authenticated'  => $rightsManager->isAuthenticated(),
    'id'             => $rightsManager->getUserId(),
    'name'           => $rightsManager->getUserName(),
    'email'          => $rightsManager->getUserMail(),
    'unit'           => $rightsManager->getUserUnit(),
    'cu'             => $rightsManager->getUserCu(),
    'timeline'       => $rightsManager->canReadTimeline(),
    'permanences'    => $rightsManager->canReadPermanences(),
    'import'         => $rightsManager->canImport(),
    'synthesisLevel' => $rightsManager->getSynthesisViewLevel(),
    'admin'          => $rightsManager->isAdmin(),
    'superAdmin'     => $rightsManager->isSuperAdmin(),
    'binaryRights'   => $rightsManager->getBinaryRights(),
];

// Ajouter les variables globales à Twig
$twig->addGlobal('user', $rightsTbl);
$twig->addGlobal('current_route', $currentRoute);
$twig->addGlobal('router', $router);
$twig->addGlobal('config', $config);
$twig->addGlobal('ldap_available', $ldapAvailable);

// Variables spécifiques au système de templates simplifié
$twig->addGlobal('page_templates', $currentRoute['templates'] ?? []);
$twig->addGlobal('page_layout', $currentRoute['layout'] ?? ['layout_template' => 'layouts/default.twig']);
$twig->addGlobal('page_assets', $currentRoute['assets'] ?? ['css' => [], 'js' => []]);
$twig->addGlobal('request_info', $router->getRequestInfo());

// =====================================================
// ÉTAPE 11 : Chargement et exécution du fichier PHP de la page
// =====================================================

$page    = $currentRoute['page'];
$phpFile = null;

// Déduire le fichier PHP à partir du slug
$slugParts = explode('/', $page['slug']);
if (count($slugParts) === 1) {
    // Page principale (ex: 'index', 'show', 'main')
    $phpFile = $page['slug'] . '/' . $page['slug'] . '.php';
} elseif (count($slugParts) === 2) {
    // Sous-page (ex: 'main/import', 'main/categories')
    $phpFile = $slugParts[0] . '/subpages/' . $slugParts[1] . '/main.php';
}

if ($phpFile) {
    $phpFilePath = $config->get('PAGES_DIR', dirname(__DIR__)) . '/' . $phpFile;

    if (file_exists($phpFilePath)) {
        $logger->debug("Exécution du fichier PHP de la page", [
            'file'   => $phpFilePath,
            'slug'   => $page['slug'],
            'method' => $router->isPost() ? 'POST' : 'GET',
        ]);

        // Inclure le fichier PHP de la page
        // Les variables $router, $twig, $config, etc. sont disponibles dans le fichier inclus
        require_once $phpFilePath;
    } else {
        $logger->debug("Aucun fichier PHP spécifique trouvé pour la page", [
            'attempted_file' => $phpFilePath,
            'slug'           => $page['slug'],
        ]);
    }
}

// =====================================================
// ÉTAPE 12 : Rendu final avec le système simple
// =====================================================

try {
    // Récupérer le layout configuré pour cette page
    $layout         = $router->getCurrentLayout();
    $layoutTemplate = $layout['layout_template'] ?? 'layouts/default.twig';

    $logger->debug("Rendu de la page avec layout simple", [
        'page'            => $page['slug'],
        'layout'          => $layoutTemplate,
        'templates_count' => array_sum(array_map('count', $currentRoute['templates'] ?? [])),
        'method'          => $router->isPost() ? 'POST' : 'GET'
    ]);

    // Rendre le layout principal
    // Le layout utilisera les variables page_templates pour inclure les zones
    echo $twig->render($layoutTemplate);

} catch (\Twig\Error\LoaderError $e) {
    $logger->error("Template de layout non trouvé", [
        'layout' => $layoutTemplate,
        'page'   => $page['slug'],
        'error'  => $e->getMessage(),
    ]);

    // Fallback vers un layout par défaut
    try {
        echo $twig->render('layouts/default.twig');
    } catch (\Exception $fallbackError) {
        // Dernière chance : afficher une page d'erreur simple
        http_response_code(500);
        echo "<h1>Erreur de template</h1>";
        echo "<p>Impossible de charger le layout pour cette page.</p>";
        if ($config->get('TWIG_DEBUG', false)) {
            echo "<h2>Erreur principale :</h2>";
            echo "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
            echo "<h2>Erreur de fallback :</h2>";
            echo "<pre>" . htmlspecialchars($fallbackError->getMessage()) . "</pre>";
            echo "<h2>Debug du routeur :</h2>";
            echo "<pre>" . htmlspecialchars(json_encode($router->debug(), JSON_PRETTY_PRINT)) . "</pre>";
        }
    }

} catch (\Exception $e) {
    $logger->error("Erreur lors du rendu de la page", [
        'page'   => $page['slug'],
        'layout' => $layoutTemplate,
        'error'  => $e->getMessage(),
        'trace'  => $e->getTraceAsString(),
    ]);

    http_response_code(500);
    echo "<h1>Erreur serveur</h1>";
    echo "<p>Une erreur s'est produite lors du rendu de la page.</p>";

    if ($config->get('TWIG_DEBUG', false)) {
        echo "<h2>Détails de l'erreur :</h2>";
        echo "<pre>" . htmlspecialchars($e->getMessage()) . "</pre>";
        echo "<pre>" . htmlspecialchars($e->getTraceAsString()) . "</pre>";

        echo "<h2>Debug du routeur :</h2>";
        echo "<pre>" . htmlspecialchars(json_encode($router->debug(), JSON_PRETTY_PRINT)) . "</pre>";

        echo "<h2>Variables Twig disponibles :</h2>";
        echo "<pre>" . htmlspecialchars(json_encode([
            'page_templates' => array_keys($currentRoute['templates'] ?? []),
            'page_layout'    => $currentRoute['layout']['layout_template'] ?? 'N/A',
            'page_assets'    => [
                'css_zones' => array_keys($currentRoute['assets']['css'] ?? []),
                'js_zones'  => array_keys($currentRoute['assets']['js'] ?? [])
            ]
        ], JSON_PRETTY_PRINT)) . "</pre>";
    }
}

// =====================================================
// ÉTAPE 13 : Logging des statistiques (optionnel)
// =====================================================

if ($config->get('TWIG_DEBUG', false)) {
    $renderTime = microtime(true) - ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true));

    $logger->debug("Statistiques de la requête", [
        'route'              => $page['slug'],
        'method'             => $router->isPost() ? 'POST' : 'GET',
        'render_time'        => round($renderTime * 1000, 2) . 'ms',
        'memory_usage'       => round(memory_get_peak_usage(true) / 1024 / 1024, 2) . 'MB',
        'templates_by_zone'  => array_map('count', $currentRoute['templates'] ?? []),
        'assets_count'       => [
            'css' => array_sum(array_map('count', $currentRoute['assets']['css'] ?? [])),
            'js'  => array_sum(array_map('count', $currentRoute['assets']['js'] ?? []))
        ],
        'user_authenticated' => $rightsManager->isAuthenticated(),
        'has_post_data'      => ! empty($_POST)
    ]);
}
