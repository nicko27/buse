<?php
// Charge le SSO
require_once '/var/www/html/buse2/public/pages/commun/Security/SSOlocal.php';

// Initialisation du logger si non disponible
if (!isset($logger)) {
    // Si vous n'avez pas de logger, créez un substitut simple
    $logger = new class {
        public function info($message) { error_log($message); }
        public function error($message) { error_log("ERREUR: " . $message); }
        public function debug($message) { error_log("DEBUG: " . $message); }
    };
}

// Configuration des destinataires
$to = [
    ['type' => 'To', 'mail' => 'nicolas.voirin@gendarmerie.interieur.gouv.fr'],
];

// Chemin correct du fichier
$mailFilePath = "/var/www/html/buse2/mails/aaa_mail_bta_Brigade_territoriale_autonome_des_Andelys_2025-05-20.html";

// Vérification de l'existence du fichier
if (!file_exists($mailFilePath)) {
    die("ERREUR: Le fichier n'existe pas: " . $mailFilePath);
}

// Vérification des permissions
if (!is_readable($mailFilePath)) {
    die("ERREUR: Le fichier existe mais n'est pas lisible: " . $mailFilePath);
}

// Chargement du contenu avec gestion d'erreur
$mailContent = file_get_contents($mailFilePath);
if ($mailContent === false) {
    die("ERREUR: Impossible de lire le contenu du fichier.");
}

// Afficher les premiers caractères pour vérification
echo "Aperçu du contenu du mail (premiers 500 caractères) :<br>";
echo htmlspecialchars(substr($mailContent, 0, 500)) . "...<br><br>";

// Envoyer le mail
$result = sendMail("Test envoi direct", $mailContent, $to);

// Afficher le résultat
echo "<pre>";
print_r($result);
echo "</pre>";

function sendMail($subject, $body, $recipients)
{
    global $logger;
    $response = [
        "success" => false,
        "message" => "",
        "details" => null
    ];
    
    try {
        if (!class_exists("SSOlocal")) {
            throw new Exception('Classe SSOlocal non disponible');
        }
        
        if ($_SESSION['user']->mailTokenExp < time()) {
            throw new Exception('Jeton caduc');
        }
        
        $stream_context = stream_context_create([
            'ssl'  => [
                'verify_peer'      => false,
                'verify_peer_name' => false,
            ],
            'http' => [
                'header' => 'MailToken: ' . $_SESSION['user']->mailToken,
            ],
        ]);
        
        $client = new SoapClient(null, [
            'stream_context' => $stream_context,
            'location'       => SSOlocal::MAIL_URL,
            'uri'            => 'SOAPService/Mail',
            'trace'          => true,
            'exceptions'     => true
        ]);
        
        // Journaliser les détails avant envoi
        $logger->info("Tentative d'envoi à " . json_encode($recipients));
        
        $result = $client->__soapCall('send', [
            'subject'    => $subject,
            'body'       => $body,
            'recipients' => $recipients,
        ], null);
        
        // Enregistrement des requêtes/réponses pour débogage
        $logger->debug("Requête SOAP: " . $client->__getLastRequest());
        $logger->debug("Réponse SOAP: " . $client->__getLastResponse());
        
        $logger->info("Email envoyé avec succès");
        $logger->info("Destinataires: " . json_encode($recipients, true));
        
        $response["success"] = true;
        $response["message"] = "Email envoyé avec succès";
        $response["details"] = $result;
        
    } catch (SoapFault $e) {
        $logger->error("Erreur SOAP: " . $e->getMessage());
        $logger->error("Code: " . $e->faultcode);
        
        if (isset($client)) {
            $logger->debug("Dernière requête: " . $client->__getLastRequest());
            $logger->debug("Dernière réponse: " . $client->__getLastResponse());
        }
        
        $response["success"] = false;
        $response["message"] = "Erreur lors de l'envoi du mail (SOAP): " . $e->getMessage();
        $response["details"] = [
            "faultcode" => $e->faultcode,
            "faultstring" => $e->faultstring
        ];
        
    } catch (Exception $e) {
        $logger->error("Erreur: " . $e->getMessage());
        $response["success"] = false;
        $response["message"] = "Erreur lors de l'envoi du mail: " . $e->getMessage();
    }
    
    return $response;
}