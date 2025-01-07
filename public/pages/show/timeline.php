<?php
use Commun\Database\SqlManager;
use Commun\Logger\Logger;
use Commun\Utils\DateUtils;
// Inclusion du fichier d'initialisation global
include_once dirname(__DIR__, 1) . "/commun/init.php";
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
// Inclusion des fonctions spécifiques à la timeline
require_once "fonctions/timelineFcts.php";

// Initialisation des variables pour stocker les données de la timeline
$cieList    = getCompagniesList(); // Récupère la liste des compagnies
$cieContent = []; // Contient les unités de chaque compagnie

foreach ($cieList as $cie) {
    $cobUnits   = getCobUnits($cie['cu']);
    $aloneUnits = getAloneUnits($cie['cu']);
    $pos        = 0;
    foreach ($cobUnits as $unit) {
        $childsUnits = getChildrenUnits($unit['cu']);
        if ($childsUnits) {
            $cobUnits[$pos]['childrenUnits'] = $childsUnits;
        }
        $pos += 1;
    }
    $cieContent[] = array_merge($cobUnits, $aloneUnits, getManualUnit($cie['cu']));
}

// Récupération des services non invisibles
$sql  = "SELECT * FROM services WHERE invisible = 0";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['services'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Récupération des données de sélection de temps
$returnValue          = DateUtils::getTimeSelectionData();
$vars['start_hour']   = $returnValue['hours'];
$vars['start_minute'] = $returnValue['minutes'];

// Récupération des données de fin de temps
$returnValue        = DateUtils::getTimeSelectionData(true);
$vars['end_hour']   = $returnValue['hours'];
$vars['end_minute'] = $returnValue['minutes'];

// Préparation des variables pour le template
$vars['cieContent']     = $cieContent;
$vars['cieList']        = $cieList;
$vars['NB_QUART_HEURE'] = $config->get('NB_QUART_HEURE'); // NB_QUART_HEURE;
$vars['CASE_POS_NOW']   = $config->get('CASE_POS_NOW'); // CASE_POS_NOW;
$vars['INTERVAL']       = $config->get('INTERVAL'); // INTERVAL;
