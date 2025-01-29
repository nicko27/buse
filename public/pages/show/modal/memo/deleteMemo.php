<?php
include_once dirname(__DIR__, 3) . "/commun/init.php";
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
$config     = Config::getInstance();

$logger->info("=== Début deleteBlock ===");

// Récupération des données POST ou JSON
$inputData = [];
if (!empty($_POST)) {
    $inputData = $_POST;
    $logger->info("Données POST reçues:", $inputData);
} else {
    $rawData = file_get_contents('php://input');
    if (!empty($rawData)) {
        $inputData = json_decode($rawData, true);
        $logger->info("Données JSON reçues:", $inputData);
    }
}

// Validation des données requises
if (!isset($inputData['id'])) {
    $logger->error("ID du bloc manquant");
    header('HTTP/1.1 400 Bad Request');
    echo json_encode([
        "error"   => true,
        "message" => "L'ID du bloc est requis",
    ]);
    exit();
}

try {
    $id      = intval($inputData['id']);
    $sql     = "UPDATE memos SET invisible = 1 WHERE id = :id";
    $stmt    = $sqlManager->prepare($sql);
    $success = $stmt->execute(['id' => $id]);

    if (!$success) {
        throw new Exception("Échec de la suppression du mémo");
    }

    header('Content-Type: application/json');
    echo json_encode([
        "erreur"  => false,
        "message" => "Mémo supprimé avec succès",
    ]);

} catch (Exception $e) {
    $logger->error("Erreur lors de la suppression du bloc", [
        'message' => $e->getMessage(),
        'trace'   => $e->getTraceAsString(),
    ]);

    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode([
        "erreur"  => true,
        "message" => "Une erreur est survenue lors de la suppression",
        "details" => $e->getMessage(),
    ]);
}
