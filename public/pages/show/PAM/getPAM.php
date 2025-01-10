<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";
include_once "getPAMFcts.php";
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;
use Commun\Utils\StringUtils;
use Commun\Utils\TphUtils;

$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();

// Validation et nettoyage des entrées
$cu         = filter_input(INPUT_POST, 'cu', FILTER_VALIDATE_INT);
$debug_hour = filter_input(INPUT_POST, 'debug_hour', FILTER_SANITIZE_STRING);
$debug_date = filter_input(INPUT_POST, 'debug_date', FILTER_SANITIZE_STRING);

if ($cu === false || $cu === null) {
    echo json_encode(['erreur' => 1, 'msgError' => 'Paramètre CU invalide']);
    exit;
}

date_default_timezone_set('Europe/Paris'); // Définir le fuseau horaire

$erreur       = 0;
$matin        = 0;
$aprem        = 0;
$nuit         = 0;
$current_date = new DateTime("now");

// Utiliser l'heure de débogage si spécifiée
if ($debug_hour !== "0" && preg_match('/^\d{2}:\d{2}$/', $debug_hour)) {
    list($hour, $minute) = explode(':', $debug_hour);
    $current_date->setTime((int) $hour, (int) $minute, 0);
}
if ($debug_date !== "0") {
    $current_date->setDate((int) substr($debug_date, 0, 4), (int) substr($debug_date, 5, 2), (int) substr($debug_date, 8, 2));
}

$matin = (isCurrentTimeInRange($current_date, $config->get("DEBUT_MATIN"), $config->get("FIN_MATIN"))) ? 1 : 0;
$aprem = (isCurrentTimeInRange($current_date, $config->get("DEBUT_APREM"), $config->get("FIN_APREM"))) ? 1 : 0;
$nuit  = (isCurrentTimeInRange($current_date, $config->get("DEBUT_NUIT"), $config->get("FIN_NUIT"))) ? 1 : 0;
// Vérifier si nous sommes dans la plage "nuit" et que l'heure actuelle est avant DEBUT_MATIN
if ($nuit == 1 && $current_date->format('H:i') < $config->get("DEBUT_MATIN")) {
    $current_date->modify('-1 day');
}

$sql  = "SELECT nom, tph FROM tph_pam WHERE cu = :cu AND matin = :matin AND aprem = :aprem AND nuit = :nuit AND date = :date";
$stmt = $sqlManager->prepare($sql);
$stmt->bindValue(":cu", $cu, PDO::PARAM_INT);
$stmt->bindValue(":matin", $matin, PDO::PARAM_INT);
$stmt->bindValue(":aprem", $aprem, PDO::PARAM_INT);
$stmt->bindValue(":nuit", $nuit, PDO::PARAM_INT);
$stmt->bindValue(":date", $current_date->format('Y-m-d'), PDO::PARAM_STR);

try {
    $stmt->execute();
    $resultat = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($resultat) {
        $tph         = TphUtils::formatPhoneWithZeros($resultat["tph"]);
        $nom         = StringUtils::truncateMiddle($resultat["nom"], $config->get("TRUNCATE_PAM_LEN"));
        $returnValue = array("nom" => $nom, "tph" => $tph, "erreur" => 0, "msgError" => "", "cu" => $cu);
    } else {
        $returnValue = array("erreur" => 1, "msgError" => "Aucune donnée trouvée");
    }
} catch (Exception $e) {
    $logger->error("getPAM: Erreur lors de la récupération des données");
    $logger->error("Message d'erreur: " . $e->getMessage());
    $returnValue = array("erreur" => 1, "msgError" => "Une erreur est survenue lors de la récupération des données");
}

header('Content-Type: application/json');
echo json_encode($returnValue);
