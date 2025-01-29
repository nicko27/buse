<?php
include_once dirname(__DIR__, 3) . "/commun/init.php";
include_once dirname(__DIR__, 2) . "/blocks/timelineFcts.php";

try {
    $logger->info("=== Début addBlock ===");

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

    if (empty($inputData)) {
        throw new Exception("Aucune donnée reçue");
    }
    $permanent = (isset($inputData['permanent'])) ? $inputData['permanent'] : 0;

    if ($permanent == 0) {
        // Récupération et validation des dates avec heures
        $debut_date = DateTime::createFromFormat('d.m.Y H:i', $inputData['debut_date']);
        $fin_date   = DateTime::createFromFormat('d.m.Y H:i', $inputData['fin_date']);

        if (!$debut_date || !$fin_date) {
            throw new Exception("Format de date invalide (format attendu: DD.MM.YYYY HH:mm)");
        }
        // Formatage des dates pour la base de données
        $valDateDebut = $debut_date->format('Y-m-d');
        $valDateFin   = $fin_date->format('Y-m-d');
        $heureDebut   = $debut_date->format('H:i');
        $heureFin     = $fin_date->format('H:i');

        $alarm = (isset($inputData['alarm'])) ? $inputData['alarm'] : 0;
    } else {
        $formattedEndDate   = "";
        $formattedStartDate = "";
        $alarm              = "";
    }
    $data = [
        "debut"          => $heureDebut,
        "fin"            => $heureFin,
        "date_debut"     => $valDateDebut,
        "date_fin"       => $valDateFin,
        "permanent"      => $permanent,
        "memo"           => $_POST["memo"],
        "alarm"          => $alarm,
        "alarmTriggered" => 0,
        "invisible"      => 0,
    ];
    $result = $sqlManager->update("memos", $data, sprintf("id=%d", $_POST["id"]));
    // Réponse JSON
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => ($result["error"] == 0) ? false : true,
        "msgError" => $result["message"] ?? "",
        "data"     => $data,
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    $logger->error("Erreur updateBlock: " . $e->getMessage());
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => true,
        "msgError" => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
