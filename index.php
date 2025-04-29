<?php

// Gestion de la session
if (session_status() === PHP_SESSION_ACTIVE) {
    session_unset();
}

// Inclusion des fichiers nécessaires
require_once "public/pages/commun/init.php";

use Commun\Config\Config;
use UpdateFlow\Managers\VersionManager;
use UpdateFlow\Utils\Logger as UpdateFlowLogger;

// Récupérer l'instance de Config
$config = Config::getInstance();

// Charger les dépendances UpdateFlow
require_once $config->get('ASSETS_DIR') . "/libs/updateFlow/src/php/Managers/VersionManager.php";
require_once $config->get('ASSETS_DIR') . "/libs/updateFlow/src/php/Utils/Response.php";
require_once $config->get('ASSETS_DIR') . "/libs/updateFlow/src/php/Utils/Logger.php";
require_once $config->get('PAGES_DIR') . "/index/fonctions/indexFcts.php";

// Initialisation des variables
$vars = [];

// Gestion de la version
$updateFlowLogger = new UpdateFlowLogger(Commun\Logger\Logger::getInstance()->getLogger());
$versionManager   = new VersionManager(
    $config->get('ROOT') . "/version",
    VersionManager::FORMAT_TEXT,
    $updateFlowLogger
);

// Variables de version
$vars = array_merge($vars, [
    'version'          => $versionManager->getVersion(),
    'nextPatchVersion' => $versionManager->generateNewVersion($versionManager->getVersion(), 'patch'),
    'nextMinorVersion' => $versionManager->generateNewVersion($versionManager->getVersion(), 'minor'),
    'nextMajorVersion' => $versionManager->generateNewVersion($versionManager->getVersion(), 'major'),
]);

// Récupération de la page et initialisation des variables associées
$page = isset($_GET['page']) ? (int) $_GET['page'] : $config->get('PAGE_INDEX');
$vars = array_merge($vars, initVars($_GET));
$vars = getPagesVars($page, $vars, $_GET);

// Ajout du CSRF token aux variables
$vars['csrf_token'] = $csrfManager->getToken();

// Rendu de la page avec Twig
$html = $twig->render('/index/index.twig', $vars);
echo $html;
