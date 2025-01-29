<?php

require_once dirname(__DIR__, 2) . "/pages/commun/init.php";

use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
$config     = Config::getInstance();

$sql  = "select * from permanences where 1";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['permanences_tbl'] = $stmt->fetchAll((PDO::FETCH_ASSOC));
$sql                     = "select * from sites where 1";
$stmt                    = $sqlManager->prepare($sql);
$stmt->execute();
$vars['sites_tbl'] = $stmt->fetchAll((PDO::FETCH_ASSOC));
date_default_timezone_set('Europe/Paris');
$sql  = "SELECT * FROM memos WHERE invisible=0 and ((date_debut <= CURDATE() AND (date_fin >= CURDATE() OR date_fin = '') AND ((date_debut = CURDATE() AND debut <= CURTIME()) OR date_debut < CURDATE() OR date_debut = '') AND ((date_fin = CURDATE() AND fin >= CURTIME()) OR date_fin > CURDATE() OR date_fin = '')) OR permanent = 1)";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$memos           = [];
$memo            = [];
$triggered       = 0;
$currentDateTime = new DateTime();
$currentDate     = $currentDateTime->format('Y-m-d');
$currentTime     = $currentDateTime->format('H:i');
$alarm           = 0;
while ($resultat = $stmt->fetch()) {
    $memo = $resultat;
    if (($resultat['alarm'] == 1) && ($resultat['alarmTriggered'] == 0)) {
        $dateToCompareObj = DateTime::createFromFormat('Y-m-d H:i', $resultat['startDate'] . ' ' . $resultat['startHour']);
        if ($currentDate > $dateToCompareObj) {
            $alarm = 1;
        }
        $sqlManager->update("memos", ["alarmTriggered" => 1], "id=" . $resultat['id']);
    }
    $memos[] = $memo;
}
$vars['memos_tbl'] = $memos;
$vars['alarm']     = 1;
