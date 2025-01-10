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
try {
    $vars              = array();
    $vars["suId"]      = 0;
    $vars["title"]     = "AJOUTER UNE MISSION";
    $vars["actionJs"]  = "addBlock()";
    $vars["actionTxt"] = "Ajouter la mission";
    $sql_unit          = "SELECT newName as name, cu FROM unites_ldap WHERE invisible = 0 UNION SELECT name, cu FROM unites_manuelles ORDER BY name";
    $stmt_unit         = $sqlManager->prepare($sql_unit);
    $stmt_unit->execute();
    $unites        = $stmt_unit->fetchAll();
    $vars["units"] = $unites;
    $sql_service   = "select * from services where invisible<1";
    $stmt_service  = $sqlManager->prepare($sql_service);
    $stmt_service->execute();
    $services = [];
    while ($resultat_service = $stmt_service->fetch()) {
        $tbl        = array("id" => $resultat_service["id"], "name" => $resultat_service["name"], "selected" => "");
        $services[] = $tbl;
    }

    $vars["services"] = $services;
    $html             = $twig->render('/show/modal/block.twig', $vars);
    // Supprimer les retours à la ligne et espaces multiples
    $html = preg_replace('/\s+/', ' ', $html);
    $html = trim($html);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;
} catch (Exception $e) {
    $erreur   = 1;
    $msgError = $e->getMessage();
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => 1,
        "msgError" => "Erreur lors de la récupération des données: " . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
