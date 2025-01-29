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

    // Récupération et validation des dates avec heures
    $debut_date = DateTime::createFromFormat('d.m.Y H:i', $inputData['debut_date']);
    $fin_date   = DateTime::createFromFormat('d.m.Y H:i', $inputData['fin_date']);

    $logger->info("Date début brute: " . $inputData['debut_date']);
    $logger->info("Date fin brute: " . $inputData['fin_date']);

    if (!$debut_date || !$fin_date) {
        throw new Exception("Format de date invalide (format attendu: DD.MM.YYYY HH:mm)");
    }

    $logger->info("Date début parsée: " . $debut_date->format('Y-m-d H:i'));
    $logger->info("Date fin parsée: " . $fin_date->format('Y-m-d H:i'));

    // Si la date de fin est avant la date de début, on ajoute un jour à la date de fin
    if ($fin_date < $debut_date) {
        $fin_date->modify('+1 day');
        $logger->info("Date fin ajustée: " . $fin_date->format('Y-m-d H:i'));
    }

    // Formatage des dates pour la base de données
    $valDateDebut = $debut_date->format('Y-m-d');
    $valDateFin   = $fin_date->format('Y-m-d');
    $heureDebut   = $debut_date->format('H:i');
    $heureFin     = $fin_date->format('H:i');

    // Récupération des autres champs
    $unit    = isset($inputData['unit']) ? intval($inputData['unit']) : 0;
    $service = isset($inputData['service']) ? intval($inputData['service']) : 0;
    $tph     = isset($inputData['tph']) ? trim($inputData['tph']) : '';
    $color   = isset($inputData['color']) ? trim($inputData['color']) : '#000000';
    $memo    = isset($inputData['memo']) ? trim($inputData['memo']) : '';

    $logger->info("Données validées:", [
        'unit'    => $unit,
        'service' => $service,
        'tph'     => $tph,
        'color'   => $color,
        'dates'   => [
            'debut_date'  => $valDateDebut,
            'fin_date'    => $valDateFin,
            'heure_debut' => $heureDebut,
            'heure_fin'   => $heureFin,
        ],
    ]);

    // Validation des données
    if ($unit <= 0) {
        throw new Exception("Unité invalide");
    }
    if ($service <= 0) {
        throw new Exception("Service invalide");
    }

    // Préparation des données pour la fonction d'ajout
    $data = [
        'nom'        => "NO NAME",
        'tph'        => $tph,
        'date_debut' => $valDateDebut,
        'date_fin'   => $valDateFin,
        'debut'      => $heureDebut,
        'fin'        => $heureFin,
        'cu'         => $unit,
        'cu_cob'     => $unit,
        'serviceId'  => $service,
        'color'      => $color,
        'memo'       => $memo,
        'users'      => "",
        'rubis'      => "",
        'invisible'  => 0,
    ];

    $logger->info("Données pour insertion:", $data);

    // Appel de la fonction d'ajout
    $result = $sqlManager->insert("services_unites", $data);
    $logger->info("Résultat de l'insertion:", $result);

    // Réponse JSON
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => ($result["error"] == 0) ? false : true,
        "msgError" => $result["message"] ?? "",
        "data"     => $data,
    ], JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    $logger->error("Erreur addBlock: " . $e->getMessage());
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => true,
        "msgError" => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
