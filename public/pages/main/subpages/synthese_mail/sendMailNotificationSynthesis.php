<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);
require_once dirname(__DIR__, 3) . "/commun/init.php";
use Commun\Config\Config;
use Commun\DataBase\SqlManager;

try {
    $config        = Config::getInstance();
    $destinataires = [];
    $subject       = "Test SSIC Ne pas répondre ne pas gérer";
    // HTML avec styles dans une balise <style>
    $htmlContent = sprintf("
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; color: #333; }
            h1 { color: #0066cc; font-size: 22px; }
            .important { color: #cc0000; font-weight: bold; }
            p { margin-bottom: 15px; line-height: 1.5; }
        </style>
    </head>
    <body>
        <h1>Bonjour!</h1>
        <p>Un ou plusieurs évènements ont eu lieu sur votre zone de compétence. Vous pouvez les afficher et les envoyer aux maires sous votre gestion.</p>
        <p><a href=%s/%s>Buses</a></p>
    </body>
    </html>", $config->get("WEB_ADDR"), $config->get("WEB_DIR"));

    $sql = "SELECT distinct unites_ldap.mail
FROM `unites_ldap`
JOIN mairies ON unites_ldap.id=mairies.unit_id
JOIN cities ON mairies.insee=cities.insee
JOIN evenements ON cities.id=evenements.commune_id
WHERE evenements.sent=0";
    $sqlManager = SqlManager::getInstance();
    $result     = $sqlManager->query($sql);
    if ($result['rowCount'] > 0) {
        foreach ($result['data'] as $resultat) {
            $destinataires[] = ['type' => 'To', 'mail' => $resultat["mail"]];
        }

        $destinataires[] = ['type' => 'Cc', 'mail' => $rightsManager->getUserMail()];

        // Envoyer l'email avec styles inlinés et pièces jointes
        if ($debug != $config->get("DEBUG")) {
            require_once dirname(__DIR__, 3) . "/commun/Security/SSOlocal.php";
            SSOlocal::mail($subject, $htmlContent, $destinataires, true);
            $result = ['success' => true, 'destinataires' => $destinataires, "mail" => true];
        } else {
            $result = ['success' => true, 'destinataires' => $destinataires, "mail" => false];
        }

    } else {
        $result = ['success' => true, "mail" => false];
    }

} catch (Throwable $e) {
    $result = [
        'success' => false,
        'error'   => $e->getMessage(),
        'file'    => $e->getFile(),
        'line'    => $e->getLine(),
    ];

}

header('Content-Type: application/json');
echo json_encode($result);
