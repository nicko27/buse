<?php
require_once __DIR__ . '/../../../commun/init.php';
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInitializedInstance();

require_once "fonctions/scrapersFcts.php";
require_once "fonctions/timelineFcts.php";
require_once "fonctions/permanencesFcts.php";

// Exemple d'utilisation
try {
    $today  = new DateTime();
    $today  = $today->format('Y-m-d');
    $search = sprintf("date_debut='%s'", $today);

    // Suppression des données existantes
    $sqlManager->delete("tph_pam", "date_debut=:dateDebut", ["date_debut" => $today]);
    $sqlManager->delete("services_unites", "date_debut=:dateDebut", ["date_debut" => $today]);

    // Nettoyage des données anciennes
    $today = new DateTime();
    $today->modify('-7 days');
    $sevenDays = $today->format('Y-m-d');
    $sqlManager->delete("tph_pam", "date_debut<:dateDebut", ["date_debut" => $sevenDays]);
    $sqlManager->delete("services_unites", "date_debut<:dateDebut", ["date_debut" => $sevenDays]);

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
