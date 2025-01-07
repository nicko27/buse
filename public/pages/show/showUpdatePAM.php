<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

include_once __DIR__ . "/show/fonctions/timelineFcts.php";
$cu = $_POST['cu'];
// Récupérer la date d'aujourd'hui et d'hier
$aujourdhui    = new DateTime();
$aujourdhuiStr = $aujourdhui->format('Y-m-d');
try {
    $vars              = array();
    $vars["hiddenAdd"] = "hidden";
    $vars["fct"]       = "updatePAM";
    $vars["cu"]        = $cu;
    $vars["WEB_PAGES"] = WEB_PAGES;
    $sql               = "select * from tph_pam where matin=1 and cu=:cu and date=:date";
    $stmt              = IDBDD->prepare($sql);
    $stmt->execute([':cu' => $cu, ':date' => $aujourdhuiStr]);
    $resultat            = $stmt->fetch();
    $vars["nomPamMatin"] = $resultat['nom'];
    $vars["tphPamMatin"] = $resultat['tph'];
    $vars["DEBUT_MATIN"] = DEBUT_MATIN;
    $vars["FIN_MATIN"]   = FIN_MATIN;
    $vars["DEBUT_APREM"] = DEBUT_APREM;
    $vars["FIN_APREM"]   = FIN_APREM;
    $vars["DEBUT_NUIT"]  = DEBUT_NUIT;
    $vars["FIN_NUIT"]    = FIN_NUIT;
    $sql                 = "select * from tph_pam where aprem=1 and cu=:cu and date=:date";
    $stmt                = IDBDD->prepare($sql);
    $stmt->execute([':cu' => $cu, ':date' => $aujourdhuiStr]);
    $resultat            = $stmt->fetch();
    $vars["nomPamAprem"] = $resultat['nom'];
    $vars["tphPamAprem"] = $resultat['tph'];
    $sql                 = "select * from tph_pam where nuit=1 and cu=:cu and date=:date";
    $stmt                = IDBDD->prepare($sql);
    $stmt->execute([':cu' => $cu, ':date' => $aujourdhuiStr]);
    $resultat           = $stmt->fetch();
    $vars["nomPamNuit"] = $resultat['nom'];
    $vars["tphPamNuit"] = $resultat['tph'];
    $html               = $twig->render('/show/modalPAM.twig', $vars);
    $returnValue        = array("erreur" => 0, "msgError" => "", "html" => $html);
} catch (Exception $e) {
    $erreur   = 1;
    $msgError = $e->getMessage();
    LOGGER->error("showUpdateBlock: Erreur");
    LOGGER->error("erreur: " . $msgError);
    $returnValue = array("erreur" => $erreur, "msgError" => $msgError);
}
echo json_encode($returnValue);
