<?php

use Commun\Config\Config;
require_once dirname(__DIR__, 3) . "/vendor/autoload.php";

// Charger les classes
require_once __DIR__ . "/Config/Config.php";
require_once __DIR__ . "/Logger/Logger.php";
require_once __DIR__ . "/Utils/FileUtils.php";
require_once __DIR__ . "/Utils/DateUtils.php";
require_once __DIR__ . "/Utils/StringUtils.php";
require_once __DIR__ . "/Utils/ExcelProcessor.php";
require_once __DIR__ . "/Utils/TphUtils.php";
require_once __DIR__ . "/Utils/UploadManager.php";
require_once __DIR__ . "/Utils/FileListUtils.php";
require_once __DIR__ . "/Ldap/LdapManager.php";
require_once __DIR__ . "/Database/SqlManager.php";
require_once __DIR__ . "/Template/TwigExtensions.php";
require_once __DIR__ . "/Security/CsrfManager.php";
require_once __DIR__ . "/Mail/EMLGenerator.php";
require_once __DIR__ . "/Security/RightsManager.php";
use Commun\Database\SqlManager;
use Commun\Ldap\BaseDNConfig;
use Commun\Ldap\LdapConfig;
use Commun\Ldap\LdapManager;
use Commun\Logger\Logger;
use Commun\Security\CsrfManager;
use Commun\Security\RightsManager;
use Commun\Template\TwigExtensions;

// Initialiser la configuration
$config = Config::getInstance();

// Initialiser le logger avec les paramètres de configuration
Logger::initWithParams(
    $config->get('LOGGER_NAME', $config->get('SITE')),
    $config->get('LOG_DIR', $config->get('LOG_DIR'))
);
$logger = Logger::getInstance()->getLogger();

// Initialiser la sécurité et la session
session_start();

$csrfManager            = CsrfManager::getInstance();
$_SESSION['CSRF_TOKEN'] = $csrfManager->getToken();

// Initialize SqlManager
SqlManager::initWithParams(
    $config->get('DB_HOST'),
    $config->get('DB_NAME'),
    $config->get('DB_USER'),
    $config->get('DB_PASSWORD')
);

$sqlManager = SqlManager::getInstance();
// Créer les répertoires nécessaires
$directories = [
    $config->get('LOG_DIR'),
    $config->get('UPLOAD_DIR'),
];

foreach ($directories as $dir) {
    if (! is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
}

// Configurer Twig
$loader = new \Twig\Loader\FilesystemLoader($config->get('VIEWS_DIR'));
$twig   = new \Twig\Environment($loader, [
    'cache' => false,
    'debug' => true,
]);

// Ajouter les extensions Twig
$twig->addExtension(new \Twig\Extension\DebugExtension());
$twig->addExtension(new TwigExtensions());

try {
    // Essayez d'abord de récupérer les valeurs de configuration
    $ldapBaseDNLists    = $config->get("LDAP_BASE_DN_LISTS");
    $ldapBaseDNServices = $config->get("LDAP_BASE_DN_SERVICES");
    $ldapBaseDNPersons  = $config->get("LDAP_BASE_DN_PERSONS");
    $ldapHost           = $config->get("LDAP_HOST");
    $ldapPort           = $config->get("LDAP_PORT");
    $ldapUseLdaps       = $config->get("LDAP_USE_LDAPS");

    // Créez les objets seulement si les valeurs nécessaires sont disponibles
    if ($ldapBaseDNLists !== null && $ldapBaseDNServices !== null && $ldapBaseDNPersons !== null) {
        $baseDN = new BaseDNConfig(
            lists: $ldapBaseDNLists,
            services: $ldapBaseDNServices,
            persons: $ldapBaseDNPersons
        );

        if ($ldapHost !== null && $ldapPort !== null && $ldapUseLdaps !== null) {
            $ldapConfig = new LdapConfig(
                host: $ldapHost,
                port: $ldapPort,
                useLdaps: $ldapUseLdaps,
                baseDN: $baseDN
            );

            $ldap = LdapManager::initialize($ldapConfig);
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

    // Vous pouvez ajouter ici un code pour gérer l'absence de LDAP
    // Par exemple, définir une variable pour indiquer que LDAP n'est pas disponible
    $ldapAvailable = false;
}

$rightsManager = RightsManager::getInstance();
$debug         = (isset($_GET['debug'])) ? $_GET['debug'] : 0;
$serverAddr    = isset($_SERVER['SERVER_ADDR']) ? $_SERVER['SERVER_ADDR'] : '127.0.0.1';
if ($serverAddr == "127.0.0.1") {
    $debug = $config->get("DEBUG");
}

if (strcmp($config->get("ENV"), "dev") == 0) {
    $debug = $config->get("DEBUG");
}

if ($debug == $config->get("DEBUG")) {
    if (! isset($_GET['nigend'])) {
        $nigend = 224286;
    } else {
        $nigend = $_GET['nigend'];
    }
    $personsAttributes = ["employeenumber", "title", "sn", "givenname", "mail", "codeunite", "ou"];
    $person            = sprintf("employeenumber=%s", $nigend);
    $personsInfo       = [];
    $ldapManager       = LdapManager::getInstance();
    $personsInfo       = $ldapManager->searchPersons($person, $personsAttributes, 10)[0];

    if ((sizeof($personsInfo) == 0) && ($nigend == 224286)) {
        $this->userId        = 224286;
        $this->userName      = "ADJ VOIRIN Nicolas";
        $this->userMail      = "nicolas.voirin@gendarmerie.interieur.gouv.fr";
        $this->userUnit      = "SOLC BDRIJ GGD27";
        $this->userCu        = "12027";
        $this->userShortName = "VOIRIN Nicolas";

    }
    $rightsManager->initialize(1, $personsInfo);
} else {
    $rightsManager->initialize();
}

$logger->info("cu:" . $rightsManager->getUserCu());

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
