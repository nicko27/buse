<?php
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

include_once dirname(__DIR__, 2) . "/commun/init.php";
// Initialisation
date_default_timezone_set('Europe/Paris');

function getCompagniesList()
{
    $logger = Logger::getInstance()->getLogger();
    $sqlManager = SqlManager::getInstance();
    $cieContent = [];
    $sql = "SELECT unites_ldap.cu, newName, color 
            FROM unites_ldap 
            INNER JOIN compagnies ON compagnies.cu = unites_ldap.cu 
            WHERE isCie = 1 
            ORDER BY ordre ASC";
    try {
        $stmt = $sqlManager->prepare($sql);
        $stmt->execute();
        $ajoutManuelUnite = $stmt->fetchAll();
        foreach ($ajoutManuelUnite as $amu) {
            $cieContent[] = $amu;
        }
        return $cieContent;
    } catch (PDOException $e) {
        $logger->error("Error retrieving cie", [
            'error' => $e->getMessage()
        ]);
        return [];
    }
}

function getCobUnits($cu)
{
    $logger = Logger::getInstance()->getLogger();
    $sqlManager = SqlManager::getInstance();
    $sql = "SELECT cu, newName, mergedWithCu, isCob, cuCob 
            FROM unites_ldap 
            WHERE cuCie = :cu 
            AND isCob = 1 
            AND cuCob = cu 
            AND invisible = 0 
            ORDER BY newName ASC";
    try {
        $stmt = $sqlManager->prepare($sql);
        $stmt->bindParam(":cu", $cu);
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        $logger->error("Error retrieving cie", [
            'error' => $e->getMessage()
        ]);
        return [];
    }
}

function getAloneUnits($cu)
{
    $logger = Logger::getInstance()->getLogger();
    $sqlManager = SqlManager::getInstance();
    $sql = "SELECT cu, newName, mergedWithCu, isCob, cuCob 
            FROM unites_ldap 
            WHERE cuCie = :cu 
            AND invisible = 0 
            AND isCob = 0 
            ORDER BY newName ASC";
    try {
        $stmt = $sqlManager->prepare($sql);
        $stmt->bindParam(":cu", $cu);
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        $logger->error("Error retrieving cie", [
            'error' => $e->getMessage()
        ]);
        return [];
    }
}

function getChildrenUnits($cu)
{
    $logger = Logger::getInstance()->getLogger();
    $sqlManager = SqlManager::getInstance();
    $sql = "SELECT cu, newName, mergedWithCu, isCob, cuCob 
            FROM unites_ldap 
            WHERE cuCob = :cu 
            AND invisible = 0 
            AND isCob = 1 
            AND cuCob != cu 
            ORDER BY newName ASC";
    try {
        $stmt = $sqlManager->prepare($sql);
        $stmt->bindParam(":cu", $cu);
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        $logger->error("Error retrieving cie", [
            'error' => $e->getMessage()
        ]);
        return [];
    }
}


function getLdapUnitsFromCie($cu)
{
    $logger = Logger::getInstance()->getLogger();
    $sqlManager = SqlManager::getInstance();
    $sql = "SELECT cu, newName, mergedWithCu, isCob, cuCob 
            FROM unites_ldap 
            WHERE cuCie = :cu 
            AND invisible = 0 
            ORDER BY newName ASC";
    try {
        $stmt = $sqlManager->prepare($sql);
        $stmt->bindParam(":cu", $cu);
        $stmt->execute();
        return $stmt->fetchAll();
    } catch (PDOException $e) {
        $logger->error("Error retrieving cie", [
            'error' => $e->getMessage()
        ]);
        return [];
    }
}

function getManualUnit($cieCu)
{
    $logger = Logger::getInstance()->getLogger();
    $sqlManager = SqlManager::getInstance();
    $cieContent = [];
    $sql = "select * from unites_manuelles where cieCu=:cieCu";
    try {
        $stmt = $sqlManager->prepare($sql);
        $stmt->bindParam(":cieCu", $cieCu);
        $stmt->execute();
        $ajoutManuelUnite = $stmt->fetchAll();
        foreach ($ajoutManuelUnite as $amu) {
            $cieContent[] = $amu;
        }
        return $cieContent;
    } catch (PDOException $e) {
        $logger->error("Error retrieving manual unit", [
            'cieCu' => $cieCu,
            'error' => $e->getMessage()
        ]);
        return [];
    }
}

