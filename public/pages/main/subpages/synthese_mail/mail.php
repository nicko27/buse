<?php
require_once dirname(__DIR__, 3) . "/commun/init.php";
use Commun\Mail\EMLGenerator;
$id  = $_POST['id'];
$sql = "SELECT
evenements.*,
categories.niveau,
categories.categorie,
categories.nature,
cities.name,
mairies.mail,
cities.old_name
FROM evenements
JOIN categories      ON evenements.categorie_id = categories.id
JOIN cities          ON evenements.commune_id = cities.id
JOIN mairies         ON cities.insee = mairies.insee
WHERE cities.id=:id AND evenements.sent=0 AND evenements.need_to_send=1
ORDER BY cities.name, evenements.date, evenements.heure";
$stmt = $sqlManager->prepare($sql);
$stmt->execute(["id" => $id]);
$sqlManager->update("evenements", ["sent" => 1], "commune_id=:id", ["id" => $id]);
$varsMail              = [];
$varsMail["mails_tbl"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
$html                  = $twig->render('/main/subpages/synthese_mail/template_html.twig', $varsMail);
$raw                   = $twig->render('/main/subpages/synthese_mail/template_raw.twig', $varsMail);
$from                  = $rightsManager->getUserMail();
$to                    = $varsMail["mails_tbl"][0]['mail'];
$eml                   = new EMLGenerator();
$eml->setFrom($from);
$eml->setTo($to);
$eml->setSubject("Evènement(s) ayant eu lieu sur votre commune");
$eml->setBody($html, $raw);
$now  = new \DateTime();
$file = sprintf("%s/mail_%s-%s.eml", $config->get("MAILS_DIR"), $id, $now->format('Y-m-d'));
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
