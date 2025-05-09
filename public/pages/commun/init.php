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
require_once __DIR__ . "/EMLGenerator/EMLGenerator.php";

use Commun\Database\SqlManager;
use Commun\Ldap\BaseDNConfig;
use Commun\Ldap\LdapConfig;
use Commun\Ldap\LdapManager;
use Commun\Logger\Logger;
use Commun\Security\CsrfManager;
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

            LdapManager::initialize($ldapConfig);
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
