<?php

require_once dirname(__DIR__, 2) . "/pages/commun/init.php";

use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();

// Récupération de la sous-page
$subpage = $get["subpage"];
$phpFile = sprintf("%s/%s.php", SUBPAGES_MAIN_LIST[$subpage], SUBPAGES_MAIN_LIST[$subpage]);

try {
    // Récupération des sites
    $sql  = "SELECT * FROM sites";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $vars['sites_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Récupération des compagnies
    $sql = "SELECT c.id, c.cu, ul.codeServiceRio, ul.newName, c.ordre, c.color,c.autoHide
            FROM compagnies c
            JOIN unites_ldap ul ON c.cu = ul.cu
            WHERE isCie = 1
            ORDER BY ordre ASC";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $vars['cies_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Récupération des services
    $sql  = "SELECT * FROM services ORDER BY invisible ASC, name ASC";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $vars['services_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Récupération des unités LDAP
    $sql  = "SELECT * FROM unites_ldap ORDER BY newName ASC";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $vars['unites_ldap_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Récupération des unités manuelles
    $sql  = "SELECT * FROM unites_manuelles ORDER BY name ASC";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $vars['unites_manuelles_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $logger->debug("Main data loaded successfully", [
        'subpage' => $subpage,
        'phpFile' => $phpFile,
    ]);

} catch (PDOException $e) {
    $logger->error("Error loading main data", [
        'error' => $e->getMessage(),
        'code'  => $e->getCode(),
    ]);
    throw $e;
}
