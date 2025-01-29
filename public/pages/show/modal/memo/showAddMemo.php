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
    $vars["title"]     = "AJOUTER UN MEMO";
    $vars["actionJs"]  = "addMemo()";
    $vars["actionTxt"] = "Ajouter le memo";
    $vars["id"]        = 0;

    $html = $twig->render('/show/modal/memo.twig', $vars);
    $html = preg_replace('/\s+/', ' ', $html);
    $html = trim($html);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;

} catch (Exception $e) {
    error_log("Erreur showUpdateMemo: " . $e->getMessage());
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => true,
        "msgError" => "Erreur lors de la récupération des données: " . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
