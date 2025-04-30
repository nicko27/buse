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
$loader = new \Twig\Loader\FilesystemLoader($config->get('VIEWS'));
$twig   = new \Twig\Environment($loader, [
    'cache' => false,
    'debug' => true,
]);

// Ajouter les extensions Twig
$twig->addExtension(new \Twig\Extension\DebugExtension());
$twig->addExtension(new TwigExtensions());

try {
    $baseDN = new BaseDNConfig(
        lists: $config->get("LDAP_BASE_DN_LISTS"),
        services: $config->get("LDAP_BASE_DN_SERVICES"),
        persons: $config->get("LDAP_BASE_DN_PERSONS")
    );

    $ldapConfig = new LdapConfig(
        host: $config->get("LDAP_HOST"),
        port: $config->get("LDAP_PORT"),
        useLdaps: $config->get("LDAP_USE_LDAPS"),
        baseDN: $baseDN
    );

    LdapManager::initialize($ldapConfig);
} catch (\Exception $e) {
    $logger->error("Erreur de connexion ldap", [
        'error' => $e->getMessage(),
        'code'  => $e->getCode(),
    ]);
}
