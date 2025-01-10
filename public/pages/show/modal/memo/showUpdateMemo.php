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
$id = null;
if (isset($_POST['id'])) {
    $id = $_POST['id'];
} else {
    $rawData = file_get_contents('php://input');
    if (!empty($rawData)) {
        $data = json_decode($rawData, true);
        $id   = $data['id'] ?? null;
    }
}

if (!$id) {
    $logger->error("ID de mission manquant");
    header('HTTP/1.1 400 Bad Request');
    echo json_encode([
        'error'   => true,
        'message' => "L'ID de la mission est requis",
    ]);
    exit();
}

try {

    $vars              = array();
    $vars["title"]     = "MODIFIER UN MEMO";
    $vars["actionJs"]  = "updateMemo()";
    $vars["actionTxt"] = "Modifier le memo";
    $sql               = "select * from memos where id=:id";
    $stmt              = $sqlManager->prepare($sql);
    $stmt->execute([':id' => $id]);
    $resultat = $stmt->fetch();
    if (!$resultat) {
        $errorInfo = $stmt->errorInfo();
        $logger->error("Échec de la récupération du memo", [
            'id'           => $id,
            'sqlState'     => $errorInfo[0],
            'errorCode'    => $errorInfo[1],
            'errorMessage' => $errorInfo[2],
        ]);
        header('HTTP/1.1 404 Not Found');
        echo json_encode([
            'error'   => true,
            'message' => "Le memo demandé n'existe pas ou a été supprimé",
            'details' => 'ID: ' . $id,
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
    $vars["id"]         = $id;
    $vars["memo"]       = $resultat["memo"];
    $vars["date_debut"] = $debut_date->format('d.m.Y H:i');
    $vars["date_fin"]   = $fin_date->format('d.m.Y H:i');
    $vars["permanent"]  = $resultat["permanent"];

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
