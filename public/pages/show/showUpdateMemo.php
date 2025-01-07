<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

try {
    $sql  = "select * from memos where id=:id";
    $stmt = IDBDD->prepare($sql);
    $stmt->bindValue(":id", $_POST["memoId"], PDO::PARAM_INT);
    $stmt->execute();
    $resultat               = $stmt->fetch();
    $vars                   = [];
    $vars["hiddenAdd"]      = "hidden";
    $vars["fct"]            = "updateMemo";
    $vars['memoId']         = $_POST["memoId"];
    $vars['memo']           = $resultat["memo"];
    $vars['permanent']      = $resultat["permanent"];
    $vars['alarm_selected'] = ($resultat['alarm'] == 1) ? "checked" : "";
    if ($vars['permanent'] == 0) {
        $datetime                   = DateTime::createFromFormat('Y-m-d', $resultat["startDate"]);
        $formattedDate              = $datetime->format('d.m.Y');
        $vars["start-date"]         = $formattedDate;
        $datetime                   = DateTime::createFromFormat('Y-m-d', $resultat["endDate"]);
        $formattedDate              = $datetime->format('d.m.Y');
        $vars["end-date"]           = $formattedDate;
        $returnValue                = getTimeSelectionDataFromTime($resultat["startTime"]);
        $vars["start_hour"]         = $returnValue["hours"];
        $vars["start_minute"]       = $returnValue["minutes"];
        $returnValue                = getTimeSelectionDataFromTime($resultat["endTime"]);
        $vars["end_hour"]           = $returnValue["hours"];
        $vars["end_minute"]         = $returnValue["minutes"];
        $vars["permanent_selected"] = "";
    } else {
        $returnValue                = getTimeSelectionData();
        $vars["start_hour"]         = $returnValue["hours"];
        $vars["start_minute"]       = $returnValue["minutes"];
        $returnValue                = getTimeSelectionData(true);
        $vars["end_hour"]           = $returnValue["hours"];
        $vars["end_minute"]         = $returnValue["minutes"];
        $vars["start-date"]         = date('d.m.Y');
        $vars["end-date"]           = date('d.m.Y');
        $vars["permanent_selected"] = "checked";
    }
    $vars["WEB_PAGES"] = WEB_PAGES;
    $html              = $twig->render('/show/modalMemo.twig', $vars);
    $returnValue       = array("erreur" => 0, "msgError" => "", "html" => $html, "startDate" => $resultat["startDate"], "endDate" => $resultat["endDate"]);
} catch (Exception $e) {
    $erreur   = 1;
    $msgError = $e->getMessage();
    LOGGER->error("showUpdateMemo: Erreur");
    LOGGER->error("erreur: " . $msgError);
    $returnValue = array("erreur" => $erreur, "msgError" => $msgError);
}
echo json_encode($returnValue);
