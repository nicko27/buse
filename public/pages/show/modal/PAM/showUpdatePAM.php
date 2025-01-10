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

if (!isset($inputData['cu'])) {
    $cu = 0;
} else {
    $cu = $inputData['cu'];
}
// Récupérer la date d'aujourd'hui et d'hier
$aujourdhui    = new DateTime();
$aujourdhuiStr = $aujourdhui->format('Y-m-d');

try {
    $vars              = array();
    $vars["hiddenAdd"] = "hidden";
    $vars["fct"]       = "updatePAM";
    $vars["cu"]        = $cu;
    if ($cu == 0) {
        $sql_unit  = "SELECT newName as name, cu FROM unites_ldap WHERE invisible = 0 UNION SELECT name, cu FROM unites_manuelles ORDER BY name";
        $stmt_unit = $sqlManager->prepare($sql_unit);
        $stmt_unit->execute();
        $unites        = $stmt_unit->fetchAll();
        $vars["units"] = $unites;
    }
    $sql  = "select * from tph_pam where matin=1 and cu=:cu and date=:date";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute([':cu' => $cu, ':date' => $aujourdhuiStr]);
    $resultat            = $stmt->fetch();
    $vars["nomPamMatin"] = htmlspecialchars($resultat['nom'] ?? '', ENT_QUOTES, 'UTF-8');
    $vars["tphPamMatin"] = htmlspecialchars($resultat['tph'] ?? '', ENT_QUOTES, 'UTF-8');
    $vars["DEBUT_MATIN"] = $config->get("DEBUT_MATIN");
    $vars["FIN_MATIN"]   = $config->get("FIN_MATIN");
    $vars["DEBUT_APREM"] = $config->get("DEBUT_APREM");
    $vars["FIN_APREM"]   = $config->get("FIN_APREM");
    $vars["DEBUT_NUIT"]  = $config->get("DEBUT_NUIT");
    $vars["FIN_NUIT"]    = $config->get("FIN_NUIT");
    $sql                 = "select * from tph_pam where aprem=1 and cu=:cu and date=:date";
    $stmt                = $sqlManager->prepare($sql);
    $stmt->execute([':cu' => $cu, ':date' => $aujourdhuiStr]);
    $resultat            = $stmt->fetch();
    $vars["nomPamAprem"] = htmlspecialchars($resultat['nom'] ?? '', ENT_QUOTES, 'UTF-8');
    $vars["tphPamAprem"] = htmlspecialchars($resultat['tph'] ?? '', ENT_QUOTES, 'UTF-8');
    $sql                 = "select * from tph_pam where nuit=1 and cu=:cu and date=:date";
    $stmt                = $sqlManager->prepare($sql);
    $stmt->execute([':cu' => $cu, ':date' => $aujourdhuiStr]);
    $resultat           = $stmt->fetch();
    $vars["nomPamNuit"] = htmlspecialchars($resultat['nom'] ?? '', ENT_QUOTES, 'UTF-8');
    $vars["tphPamNuit"] = htmlspecialchars($resultat['tph'] ?? '', ENT_QUOTES, 'UTF-8');

    // Rendre le template et nettoyer le HTML
    $html = $twig->render('/show/modal/PAM.twig', $vars);
    // Supprimer les retours à la ligne et espaces multiples
    $html = preg_replace('/\s+/', ' ', $html);
    $html = trim($html);

    header('Content-Type: text/html; charset=utf-8');
    echo $html;
} catch (Exception $e) {
    $logger->error("showUpdatePAM: Erreur lors de la récupération des données");
    $logger->error("erreur: " . $e->getMessage());
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        "erreur"   => 1,
        "msgError" => "Erreur lors de la récupération des données: " . $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
