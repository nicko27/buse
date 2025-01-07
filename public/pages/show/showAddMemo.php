<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

try {

    $vars                 = [];
    $vars["hiddenUpdate"] = "hidden";
    $vars["fct"]          = "addMemo";
    $vars['memoId']       = $_POST["memoId"];
    $vars["start-date"]   = date('d.m.Y');
    $vars["end-date"]     = date('d.m.Y');
    $returnValue          = getTimeSelectionData();
    $vars["start_hour"]   = $returnValue["hours"];
    $vars["start_minute"] = $returnValue["minutes"];
    $returnValue          = getTimeSelectionData(true);
    $vars["end_hour"]     = $returnValue["hours"];
    $vars["end_minute"]   = $returnValue["minutes"];
    $vars["WEB_PAGES"]    = WEB_PAGES;
    $html                 = $twig->render('/show/modalMemo.twig', $vars);
    $returnValue          = array("erreur" => 0, "msgError" => "", "html" => $html, "startDate" => date('d.m.Y'), "endDate" => date('d.m.Y'));
} catch (Exception $e) {
    $erreur   = 1;
    $msgError = $e->getMessage();
    LOGGER->error("showAddMemo: Erreur");
    LOGGER->error("erreur: " . $msgError);
    $returnValue = array("erreur" => $erreur, "msgError" => $msgError);
}
echo json_encode($returnValue);
