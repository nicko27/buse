<?php
include_once dirname(__DIR__, 3) . "/commun/init.php";
include_once dirname(__DIR__, 2) . "/blocks/timelineFcts.php";
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
$config     = Config::getInstance();

// Récupération de l'ID depuis POST ou JSON
$suId = null;
if (isset($_POST['id'])) {
    $suId = $_POST['id'];
} else {
    $rawData = file_get_contents('php://input');
    if (!empty($rawData)) {
        $data = json_decode($rawData, true);
        $suId = $data['id'] ?? null;
    }
}

if (!$suId) {
    $logger->error("ID de mission manquant");
    header('HTTP/1.1 400 Bad Request');
    echo json_encode([
        'error'   => true,
        'message' => "L'ID de la mission est requis",
    ]);
    exit();
}

try {
    $sql  = "select *,services_unites.id as suId,services_unites.color as suColor,services.color as sColor from services_unites,services where services_unites.id=:suId and serviceId=services.id";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute(['suId' => $suId]);
    $resultat = $stmt->fetch();
    if (!$resultat) {
        $errorInfo = $stmt->errorInfo();
        $logger->error("Échec de la récupération de la mission", [
            'suId'         => $suId,
            'sqlState'     => $errorInfo[0],
            'errorCode'    => $errorInfo[1],
            'errorMessage' => $errorInfo[2],
        ]);
        header('HTTP/1.1 404 Not Found');
        echo json_encode([
            'error'   => true,
            'message' => "La mission demandée n'existe pas ou a été supprimée",
            'details' => 'ID: ' . $suId,
        ]);
        exit();
    }
    $date_debut_str = $resultat["date_debut"] . ' ' . $resultat["debut"];
    $date_fin_str   = $resultat["date_fin"] . ' ' . $resultat["fin"];

    $debut_date = DateTime::createFromFormat('Y-m-d H:i:s', $date_debut_str) ?:
    DateTime::createFromFormat('Y-m-d H:i', $date_debut_str);
    $fin_date = DateTime::createFromFormat('Y-m-d H:i:s', $date_fin_str) ?:
    DateTime::createFromFormat('Y-m-d H:i', $date_fin_str);

    if (!$debut_date || !$fin_date) {
        $errors = DateTime::getLastErrors();
        throw new Exception("Erreur lors de la lecture des dates. Erreurs: " . print_r($errors, true));
    }

    $vars               = array();
    $vars["title"]      = "MODIFIER UNE MISSION";
    $vars["actionJs"]   = "updateBlock()";
    $vars["actionTxt"]  = "Modifier la mission";
    $vars["WEB_PAGES"]  = WEB_PAGES;
    $vars["cu"]         = $resultat["cu"];
    $vars["suId"]       = $resultat["suId"];
    $vars["tph"]        = $resultat["tph"];
    $vars["date_debut"] = $debut_date->format('d.m.Y H:i');
    $vars["date_fin"]   = $fin_date->format('d.m.Y H:i');
    $vars["color"]      = (strlen($resultat["suColor"]) > 0) ? $resultat["suColor"] : $resultat["sColor"];
    $vars["memo"]       = $resultat["memo"];

    // Récupération des unités
    $sql_unit  = "SELECT newName as name, cu FROM unites_ldap WHERE invisible = 0 UNION SELECT name, cu FROM unites_manuelles ORDER BY name";
    $stmt_unit = $sqlManager->prepare($sql_unit);
    $stmt_unit->execute();
    $resultat_unites = $stmt_unit->fetchAll();
    $unites          = [];
    foreach ($resultat_unites as $unite) {
        $tbl = array(
            "name"     => $unite["name"],
            "cu"       => $unite["cu"],
            "selected" => ($unite["cu"] == $resultat["cu"]) ? "selected" : "",
        );
        $unites[] = $tbl;
    }
    $vars["units"] = $unites;

    // Récupération des services
    $sql_service  = "select * from services where invisible<1";
    $stmt_service = $sqlManager->prepare($sql_service);
    $stmt_service->execute();
    $services = [];
    while ($resultat_service = $stmt_service->fetch()) {
        $tbl = array(
            "id"       => $resultat_service["id"],
            "name"     => $resultat_service["name"],
            "selected" => ($resultat_service["id"] == $resultat["serviceId"]) ? "selected" : "",
        );
        $services[] = $tbl;
    }
    $vars["services"] = $services;

    $html = $twig->render('/show/modal/block.twig', $vars);
    $html = preg_replace('/\s+/', ' ', $html);
    $html = trim($html);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;

} catch (Exception $e) {
    error_log("Erreur showUpdateBlock: " . $e->getMessage());
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => 1,
        "msgError" => "Erreur lors de la récupération des données: " . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
