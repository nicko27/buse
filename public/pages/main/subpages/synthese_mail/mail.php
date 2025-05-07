<?php
require_once dirname(__DIR__, 2) . "/pages/commun/init.php";
use Commun\EMLGenerator\EMLGenerator;
$sql = "SELECT
evenements.*,
categories.niveau,
categories.categorie,
cities.name,
cities.old_name
FROM evenements
JOIN categories      ON evenements.categorie_id = categories.id
JOIN cities          ON evenements.commune_id = cities.id
JOIN mairies         ON cities.insee = mairies.insee
WHERE cities.id=:id
ORDER BY cities.name, evenements.date, evenements.heure";
$stmt = $sqlManager->prepare($sql);
$stmt->execute(["cu" => $cu]);
$vars["mails_tbl"] = $stmt->fetchAll(PDO::FETCH_ASSOC);

$eml = new EMLGenerator();
$eml->setFrom("nicolas.voirin@me.com");
$eml->setTo("nicolas.voirin@gendarmerie.interieur.gouv.fr");
$eml->setSubject("Evènement(s) sur la commune");
$eml->setBody('<h1>Bonjour Nicolas</h1><p>Voici un email <b>généré</b> depuis PHP.</p>',
    'Bonjour Bob, voici un email généré depuis PHP.');
$file = $config->get("MAILS_DIR") . "/mail.eml";
$eml->generateEML($file);
// Forcer le téléchargement
header('Content-Description: File Transfer');
header('Content-Type: message/rfc822'); // Type MIME standard pour .eml
header('Content-Disposition: attachment; filename="' . basename($file) . '"');
header('Content-Transfer-Encoding: binary');
header('Expires: 0');
header('Cache-Control: must-revalidate');
header('Pragma: public');
header('Content-Length: ' . filesize($file));

// Nettoie les tampons de sortie
ob_clean();
flush();

// Envoie le fichier
readfile($file);
exit;
