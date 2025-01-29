<?php
include_once dirname(__DIR__, 2) . "/commun/init.php";
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
include_once "getTimelineBlocksFcts.php";

// Récupérer les paramètres POST
$case_pos_now   = $_POST['case_pos_now'];
$interval       = $_POST['interval'];
$debug_hour     = $_POST['debug_hour'];
$debug_date     = $_POST['debug_date'];
$nb_quart_heure = $config->get("NB_QUART_HEURE");

// Calculer l'heure de la première et de la dernière case
$first_case_time = getFirstCaseTime($case_pos_now, $interval, $debug_date, $debug_hour);
$last_case_time  = getLastCaseTime($first_case_time, $nb_quart_heure, $interval, $debug_hour);
$debut           = $first_case_time->format('H:i');
$fin             = $last_case_time->format('H:i');
$debug_date      = ($debug_date !== "0") ? $debug_date : date('Y-m-d');

try {
    $erreur   = 0;
    $msgError = "";

    // Requête SQL pour obtenir les données nécessaires
    $sql = 'SELECT services.name,services.shortName, services_unites.id as suId, memo, nom, tph, cu, cu_cob, debut, fin, date_debut,date_fin, users, services.color as sColor, services_unites.color as suColor
    FROM services_unites
    JOIN services ON services.id = services_unites.serviceId
    WHERE services_unites.invisible = 0 and services.invisible in (-1,0)
    AND (date_debut = :date or date_fin = :date)
    ORDER BY cu';

    $stmt = $sqlManager->prepare($sql);
    $stmt->execute([":date" => $debug_date]);
    $results = $stmt->fetchAll();

    $listeResult = [];
    $returnList  = [];
    $cuList      = [];
    $listeId     = [];

    // Traitement des résultats
    foreach ($results as $resultat) {
        // Calculer les indices des cases de début et de fin
        $entry_debut_time = new DateTime($resultat['date_debut'] . ' ' . $resultat['debut']);
        $entry_fin_time   = new DateTime($resultat['date_fin'] . ' ' . $resultat['fin']);

        // Si l'heure de fin est inférieure à l'heure de début, ajouter un jour à la date de fin
        if ($entry_fin_time < $entry_debut_time) {
            $entry_fin_time->modify('+1 day');
        }
        $debut_index = floor(($entry_debut_time->getTimestamp() - $first_case_time->getTimestamp()) / ($interval * 60)) + 1;
        if ($entry_fin_time >= $first_case_time) {
            $fin_index = ceil(($entry_fin_time->getTimestamp() - $first_case_time->getTimestamp()) / ($interval * 60)) + 1;
            if (($fin_index >= 1 || $debut_index >= 1) && ($debut_index <= $nb_quart_heure)) {
                $debut_index              = max($debut_index, 1);
                $resultat["start_column"] = ($debut_index > 0) ? $debut_index : 1;
                $resultat["end_column"]   = min($fin_index, $nb_quart_heure);
                $cu                       = $resultat["cu"];
                if ($cu > 0) {
                    if (!in_array($cu, $cuList)) {
                        $cuList[] = $cu;
                        $listeId  = [];
                    }
                    if (!isset($listeResult[$cu])) {
                        $listeResult[$cu] = [];
                    }
                    $md5Result = md5(sprintf("%s %s  %s %s %s %s %s", $resultat['tph'], $resultat['cu'], $resultat['cu_cob'], $resultat['debut'], $resultat['fin'], $resultat['date_debut'], $resultat['date_fin']));
                    if (!in_array($md5Result, $listeId)) {
                        $listeResult[$cu][] = $resultat;
                        $listeId[]          = $md5Result;
                    }
                }
            }
        }
    }
    $current_time = new DateTime();
    if ($debug_hour !== null && preg_match('/^\d{2}:\d{2}$/', $debug_hour)) {
        list($hour, $minute) = explode(':', $debug_hour);
        $current_time->setTime((int) $hour, (int) $minute, 0);
    } else {
        $current_minute = (int) $current_time->format('i');
        $rounded_minute = floor($current_minute / $interval) * $interval;
        $current_time->setTime((int) $current_time->format('H'), $rounded_minute, 0);
    }
    if ($debug_date !== "0") {
        $current_time->setDate((int) substr($debug_date, 0, 4), (int) substr($debug_date, 5, 2), (int) substr($debug_date, 8, 2));
    }

    // Traiter les blocs par CU
    $cuPrecedent       = 0;
    $unitNamePrecedent = "";
    $unitConcat        = $config->get("MINIMUM_BLOCK_CONCAT");
    foreach ($cuList as $cu) {
        $newBlocks = [];
        if ($cu == $cuPrecedent) {
            $unitName = $unitNamePrecedent;
        } else {
            $cuPrecedent = $cu;
            $stmtName    = $sqlManager->prepare("select newName from unites_ldap where cu = :cu");
            $stmtName->execute([":cu" => $cu]);
            $resultatName = $stmtName->fetchAll();
            $unitName     = "";
            if ($resultatName) {
                $unitName = $resultatName[0]["newName"];
            } else {
                $stmtName = $sqlManager->prepare("select name from unites_manuelles where cu = :cu");
                $stmtName->execute([":cu" => $cu]);
                $resultatName = $stmtName->fetchAll();
                if ($resultatName) {
                    $unitName   = $resultatName[0]["name"];
                    $unitConcat = 50;
                }
            }
        }
        $blocks = handleBlocksByCu($listeResult[$cu], $config->get("NB_QUART_HEURE"), $unitConcat, $config->get("NB_LINES_TIMELINE"));
        foreach ($blocks as $bloc) {
            $bloc['unitName'] = $unitName;
            $entry_debut_time = new DateTime($bloc['date_debut'] . ' ' . $bloc['debut']);
            $entry_fin_time   = new DateTime($bloc['date_fin'] . ' ' . $bloc['fin']);

            // Si l'heure de fin est inférieure à l'heure de début, ajouter un jour à la date de fin
            if ($entry_fin_time < $entry_debut_time) {
                $entry_fin_time->modify('+1 day');
            }
            // Vérifier si l'heure actuelle a dépassé l'heure de fin
            if ($current_time > $entry_fin_time) {
                $bloc['outdated'] = 1;
            }
            //rajouter ici que $bloc["outdated"]=1 si la date courante dépasse $bloc["fin"];
            if ($bloc['merged'] == 1) {
                $bloc['users'] = removeDuplicatesAndSortByRubis($bloc['users']);
            }
            $bloc["WEB_PAGES"]       = $config->get("WEB_PAGES");
            $bloc["LARGEUR_MIN_TPH"] = $config->get("LARGEUR_MIN_TPH");
            $bloc['end_column']      = min($bloc['end_column'], $nb_quart_heure);
            $bloc["divContent"]      = $twig->render('/show/timeline/block_timeline.twig', $bloc);
            $newBlocks[]             = $bloc;

        }
        $returnList[$cu] = $newBlocks;
    }
    $returnValue = array("erreur" => 0, "msgError" => "", "parCu" => $returnList);
} catch (Exception $e) {
    $erreur   = 1;
    $msgError = $e->getMessage();
    $logger->error("getTimelineBlocks: Erreur dans le traitement des données");
    $logger->error("Message d'erreur: " . $msgError);
    $logger->error("Trace: " . $e->getTraceAsString());
    $returnValue = array("erreur" => $erreur, "msgError" => $msgError);
}

echo json_encode($returnValue);
