<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

include_once __DIR__ . "/show/fonctions/timelineFcts.php";
$suId = $_POST['suId'];
try {
    $sql  = "select *,services_unites.id as suId,services_unites.color as suColor,services.color as sColor from services_unites,services where services_unites.id=:suId and serviceId=services.id";
    $stmt = IDBDD->prepare($sql);
    $stmt->execute(['suId' => $suId]);
    $resultat             = $stmt->fetch();
    $vars                 = array();
    $vars["id"]           = $suId;
    $vars["hiddenAdd"]    = "hidden";
    $vars["fct"]          = "updateBlock";
    $vars["WEB_PAGES"]    = WEB_PAGES;
    $vars["cu"]           = $resultat["cu"];
    $vars["suId"]         = $resultat["suId"];
    $vars["utilisateur"]  = $resultat["nom"];
    $vars["tph"]          = $resultat["tph"];
    $datetime             = DateTime::createFromFormat('Y-m-d', $resultat["date_debut"]);
    $formattedDate        = $datetime->format('d.m.Y');
    $vars["date"]         = $formattedDate;
    $vars["users"]        = $resultat["users"];
    $vars["rubis"]        = $resultat["rubis"];
    $vars["color"]        = (strlen($resultat["suColor"]) > 0) ? $resultat["suColor"] : $resultat["sColor"];
    $returnValue          = getTimeSelectionDataFromTime($resultat["debut"]);
    $vars["start_hour"]   = $returnValue["hours"];
    $vars["start_minute"] = $returnValue["minutes"];
    $returnValue          = getTimeSelectionDataFromTime($resultat["fin"]);
    $vars["end_hour"]     = $returnValue["hours"];
    $vars["end_minute"]   = $returnValue["minutes"];
    $sql_service          = "select * from services where invisible=0";
    $stmt_service         = IDBDD->prepare($sql_service);
    $stmt_service->execute();
    $services = [];
    while ($resultat_service = $stmt_service->fetch()) {
        if ($resultat["serviceId"] == $resultat_service["id"]) {
            $services[] = array("id" => $resultat_service["id"], "name" => $resultat_service["name"], "selected" => "selected='true'");
        } else {
            $services[] = array("id" => $resultat_service["id"], "name" => $resultat_service["name"], "selected" => "");
        }
    }
    $vars["services"] = $services;
    $vars["memo"]     = $resultat["memo"];
    $html             = $twig->render('/show/modalBlock.twig', $vars);
    $returnValue      = array("erreur" => 0, "msgError" => "", "html" => $html);
} catch (Exception $e) {
    $erreur   = 1;
    $msgError = $e->getMessage();
    LOGGER->error("showUpdateBlock: Erreur");
    LOGGER->error("erreur: " . $msgError);
    $returnValue = array("erreur" => $erreur, "msgError" => $msgError);
}
echo json_encode($returnValue);
