<?php

require_once dirname(__DIR__, 2) . "/pages/commun/init.php";

use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;
use Commun\Security\RightsManager;

// Initialisation
$config        = Config::getInstance();
$logger        = Logger::getInstance()->getLogger();
$sqlManager    = SqlManager::getInstance();
$rightsManager = RightsManager::getInstance();

if ($rightsManager->isDebug()) {
    $vars["debugMenu"] = sprintf("&debug=%s&nigend=%s", $config->get("DEBUG"), $rightsManager->getUserId());
}

// Récupération de la sous-page
if (isset($get['subpage'])) {
    $subpage = $get["subpage"];
} else {
    $subpage = 0;
}

$php_file = sprintf("%s/main/subpages/%s/main.php", $config->get('PAGES_DIR'), $config->get('SUBPAGES_MAIN_LIST')[$subpage]);

try {
    if (is_file($php_file)) {
        require_once $php_file;
    }

} catch (PDOException $e) {
    $logger->error("Error loading main data", [
        'error' => $e->getMessage(),
        'code'  => $e->getCode(),
    ]);
    throw $e;
}
