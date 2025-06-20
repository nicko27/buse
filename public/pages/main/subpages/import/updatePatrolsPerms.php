<?php
require_once __DIR__ . '/../../../commun/init.php';
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInitializedInstance();

require_once "maj/scrapersFcts.php";
require_once "maj/timelineFcts.php";
require_once "maj/permanencesFcts.php";

// Exemple d'utilisation
try {
    $today = new DateTime();
    $today = $today->format('Y-m-d');

    // Suppression des données existantes
    $resultat = $sqlManager->delete("tph_pam", "date=:date", ["date" => $today]);
    $sqlManager->delete("services_unites", "date_debut=:date", ["date" => $today]);

    // Nettoyage des données anciennes
    $today = new DateTime();
    $today->modify('-7 days');
    $sevenDays = $today->format('Y-m-d');
    $sqlManager->delete("tph_pam", "date<:date", ["date" => $sevenDays]);
    $sqlManager->delete("services_unites", "date_debut<:date", ["date" => $sevenDays]);

    // Traitement des fichiers
    processHtmlFilesInDirectory($config->get("UPLOAD_DIR"));
    fillNullCuFromCob();
    fillNullCuFromLdap();

    // Nettoyage des permanences
    $sqlManager->delete("permanences", "1");
    processOdsFilesInDirectory($config->get("UPLOAD_DIR"));

} catch (Exception $e) {
    $logger->error("Error in updatePatrolsPerms.php", [
        'error' => $e->getMessage(),
    ]);
    echo json_encode([
        "erreur"    => 1,
        "msgErreur" => "Erreur : " . $e->getMessage(),
    ]);
}
echo trim(json_encode(["erreur" => 0]));
