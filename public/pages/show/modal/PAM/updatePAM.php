<?php
include_once dirname(__DIR__, 3) . "/commun/init.php";
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
$config     = Config::getInstance();

$logger->info("=== Début updatePAM ===");

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
if (!isset($inputData['cu'])) {
    $logger->error("Code unité manquant");
    header('HTTP/1.1 400 Bad Request');
    echo json_encode([
        "error"   => true,
        "message" => "Le code unité est requis",
    ]);
    exit();
}

try {
    $hui    = new DateTime();
    $huiStr = $hui->format('Y-m-d');

    // Mise à jour du PAM matin
    $data = [
        "nom"   => $inputData["nomPamMatin"] ?? '',
        "tph"   => $inputData["tphPamMatin"] ?? '',
        "date"  => $huiStr,
        "cu"    => $inputData["cu"],
        "matin" => 1,
        "aprem" => 0,
        "nuit"  => 0,
    ];
    $returnValueMatin = $sqlManager->insertOrUpdate("tph_pam", $data, ["matin" => 1, "date" => $huiStr, "cu" => $inputData["cu"]]);
    $logger->info("Mise à jour PAM matin:", $returnValueMatin);

    // Mise à jour du PAM après-midi
    $data = [
        "nom"   => $inputData["nomPamAprem"] ?? '',
        "tph"   => $inputData["tphPamAprem"] ?? '',
        "date"  => $huiStr,
        "cu"    => $inputData["cu"],
        "matin" => 0,
        "aprem" => 1,
        "nuit"  => 0,
    ];
    $returnValueAprem = $sqlManager->insertOrUpdate("tph_pam", $data, ["aprem" => 1, "date" => $huiStr, "cu" => $inputData["cu"]]);
    $logger->info("Mise à jour PAM après-midi:", $returnValueAprem);

    // Mise à jour du PAM nuit
    $data = [
        "nom"   => $inputData["nomPamNuit"] ?? '',
        "tph"   => $inputData["tphPamNuit"] ?? '',
        "date"  => $huiStr,
        "cu"    => $inputData["cu"],
        "matin" => 0,
        "aprem" => 0,
        "nuit"  => 1,
    ];
    $returnValueNuit = $sqlManager->insertOrUpdate("tph_pam", $data, ["nuit" => 1, "date" => $huiStr, "cu" => $inputData["cu"]]);
    $logger->info("Mise à jour PAM nuit:", $returnValueNuit);

    // Vérification des erreurs
    $hasError = $returnValueMatin['error'] || $returnValueAprem['error'] || $returnValueNuit['error'];

    if ($hasError) {
        $logger->error("Erreur lors de la mise à jour des PAM", [
            'matin' => $returnValueMatin,
            'aprem' => $returnValueAprem,
            'nuit'  => $returnValueNuit,
        ]);
    }

    header('Content-Type: application/json');
    echo json_encode([
        "erreur"  => $hasError,
        "message" => $hasError ? "Erreur lors de la mise à jour des PAM" : "Mise à jour réussie",
        "details" => [
            "matin" => $returnValueMatin,
            "aprem" => $returnValueAprem,
            "nuit"  => $returnValueNuit,
        ],
    ]);

} catch (Exception $e) {
    $logger->error("Exception lors de la mise à jour des PAM", [
        'message' => $e->getMessage(),
        'trace'   => $e->getTraceAsString(),
    ]);

    header('HTTP/1.1 500 Internal Server Error');
    echo json_encode([
        "error"   => true,
        "message" => "Une erreur est survenue lors de la mise à jour",
        "details" => $e->getMessage(),
    ]);
}
