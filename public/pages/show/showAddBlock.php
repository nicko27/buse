<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

include_once __DIR__ . "/fonctions/timelineFcts.php";
$cu  = $_POST['cu'];
$prd = $_POST['prd'];
try {
    $vars                 = array();
    $vars["id"]           = 0;
    $vars["hiddenUpdate"] = "hidden";
    $vars["fct"]          = "addBlock";
    $vars["WEB_PAGES"]    = WEB_PAGES;
    $vars["cu"]           = $cu;
    $vars["suId"]         = 0;
    $vars["utilisateur"]  = "";
    $vars["tph"]          = "";
    $vars["date"]         = date('d.m.Y');
    $vars["users"]        = "";
    $vars["rubis"]        = "";
    $returnValue          = getTimeSelectionData();
    $vars["start_hour"]   = $returnValue["hours"];
    $vars["start_minute"] = $returnValue["minutes"];
    $returnValue          = getTimeSelectionData(true);
    $vars["end_hour"]     = $returnValue["hours"];
    $vars["end_minute"]   = $returnValue["minutes"];
    $sql_service          = "select * from services where invisible=0";
    $stmt_service         = IDBDD->prepare($sql_service);
    $stmt_service->execute();
    $services = [];
    while ($resultat_service = $stmt_service->fetch()) {
        $tbl = array("id" => $resultat_service["id"], "name" => $resultat_service["name"], "selected" => "");
        if ($resultat_service["id"] == $prd) {
            $tbl["selected"] = "selected";
            $color           = $resultat_service['color'];
        }
        $services[] = $tbl;
    }
    if ($prd > 0) {
        $vars['color'] = $color;
    } else {
        $vars['color'] = sprintf("#%06X", $randomDecimal);
    }

    $vars["services"] = $services;
    $vars["memo"]     = "";
    $html             = $twig->render('/show/modalBlock.twig', $vars);
    $returnValue      = array("erreur" => 0, "msgError" => "", "html" => $html);
} catch (Exception $e) {
    $erreur   = 1;
    $msgError = $e->getMessage();
    LOGGER->error("showAddBlock: Erreur");
    LOGGER->error("erreur: " . $msgError);
    $returnValue = array("erreur" => $erreur, "msgError" => $msgError);
}
echo json_encode($returnValue);
