<?php

use Commun\Config\Config;
use Commun\Database\SqlAdapter;
use Commun\Database\SqlManager;
use Commun\Ldap\BaseDNConfig;
use Commun\Ldap\LdapConfig;
use Commun\Ldap\LdapManager;
use Commun\Logger\Logger;
use Commun\Security\CsrfManager;
use Commun\Security\RightsManager;
use Commun\Template\TwigExtensions;

require_once dirname(__DIR__, 3) . "/vendor/autoload.php";

// Charger les classes
require_once __DIR__ . "/Config/Config.php";
require_once __DIR__ . "/Database/BDDManager.php";
require_once __DIR__ . "/Database/SqlManager.php";
require_once __DIR__ . "/Database/SqlAdapter.php";
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

// ✅ ÉTAPE 1 : Initialiser la configuration (lit le .env seulement)
$config = Config::getInstance();

// ✅ ÉTAPE 2 : Initialiser SqlManager avec les paramètres du .env
try {
    SqlManager::initWithParams(
        $config->get('DB_HOST'),
        $config->get('DB_NAME'),
        $config->get('DB_USER'),
        $config->get('DB_PASSWORD')
    );

    // ✅ ÉTAPE 3 : Créer l'adapter neutre et charger la config BDD
    $sqlManager = SqlManager::getInitializedInstance();
    $sqlAdapter = new SqlAdapter($sqlManager);

    // ✅ ÉTAPE 4 : Charger la configuration depuis la base de données
    $config->loadFromDatabase($sqlAdapter);

    // Debug temporaire
    $config->debugPagesConfig();

} catch (\Exception $e) {
    error_log("Erreur d'initialisation de la base de données : " . $e->getMessage());
    // Continuer avec la config .env seulement si la BDD n'est pas accessible
}

// Initialiser le logger avec les paramètres de configuration
Logger::initWithParams(
    $config->get('LOGGER_NAME', $config->get('SITE', 'buse')),
    $config->get('LOG_DIR', dirname(__DIR__, 3) . '/logs')
);
$logger = Logger::getInstance()->getLogger();

// ✅ CORRECTION : Vérifier si une session est déjà active avant de la démarrer
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$csrfManager            = CsrfManager::getInstance();
$_SESSION['CSRF_TOKEN'] = $csrfManager->getToken();

// Créer les répertoires nécessaires
$directories = [
    $config->get('LOG_DIR', dirname(__DIR__, 3) . '/logs'),
    $config->get('UPLOAD_DIR', dirname(__DIR__, 3) . '/files'),
];

foreach ($directories as $dir) {
    if (! is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

// ✅ CORRECTION : Construire le chemin des vues correctement
$viewsDir = $config->get('VIEWS_DIR');
if (! $viewsDir) {
    // Fallback si VIEWS_DIR n'est pas configuré
    $viewsDir = dirname(__DIR__, 2) . '/views';
}

// Vérifier que le dossier des vues existe
if (! is_dir($viewsDir)) {
    throw new \Exception("Le dossier des vues n'existe pas : $viewsDir");
}

// Configurer Twig
$loader = new \Twig\Loader\FilesystemLoader($viewsDir);
$twig   = new \Twig\Environment($loader, [
    'cache' => $config->get('TWIG_CACHE', false),
    'debug' => $config->get('TWIG_DEBUG', true),
]);

// Ajouter les extensions Twig
$twig->addExtension(new \Twig\Extension\DebugExtension());
$twig->addExtension(new TwigExtensions());

// Ajouter les variables de configuration à Twig
foreach ($config->getTwigVars() as $key => $value) {
    $twig->addGlobal($key, $value);
}

// Configuration LDAP
$ldapAvailable = false;
try {
    // Essayez d'abord de récupérer les valeurs de configuration
    $ldapBaseDNLists    = $config->get("LDAP_BASE_DN_LISTS");
    $ldapBaseDNServices = $config->get("LDAP_BASE_DN_SERVICES");
    $ldapBaseDNPersons  = $config->get("LDAP_BASE_DN_PERSONS");
    $ldapHost           = $config->get("LDAP_HOST");
    $ldapPort           = $config->get("LDAP_PORT");
    $ldapUseLdaps       = $config->get("LDAP_USE_LDAPS");

    // Créez les objets seulement si les valeurs nécessaires sont disponibles
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
    // Attrape TOUTES les exceptions et erreurs, y compris TypeError
    $logger->error("Erreur de connexion LDAP", [
        'error' => $e->getMessage(),
        'code'  => $e->getCode(),
        'file'  => $e->getFile(),
        'line'  => $e->getLine(),
    ]);

    // LDAP non disponible mais l'application peut continuer
    $ldapAvailable = false;
}

// Initialiser le gestionnaire de droits
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

// Ajouter les variables utilisateur à Twig
$twig->addGlobal('user', [
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
]);

// Variables globales supplémentaires
$twig->addGlobal('config', $config);
$twig->addGlobal('ldap_available', $ldapAvailable);
