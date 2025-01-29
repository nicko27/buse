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
    $id = intval($inputData['id']);

    // Vérification que le bloc existe
    $sql  = "SELECT id FROM services_unites WHERE id = :id AND invisible = 0";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute(['id' => $id]);

    if (!$stmt->fetch()) {
        throw new Exception("Bloc non trouvé ou déjà supprimé");
    }

    // Suppression logique du bloc
    $sql     = "UPDATE services_unites SET invisible = 1 WHERE id = :id";
    $stmt    = $sqlManager->prepare($sql);
    $success = $stmt->execute(['id' => $id]);

    if (!$success) {
        throw new Exception("Échec de la suppression du bloc");
    }

    $logger->info("Bloc supprimé avec succès", ['id' => $id]);

    header('Content-Type: application/json');
    echo json_encode([
        "erreur"  => false,
        "message" => "Bloc supprimé avec succès",
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
