<?php
// Placer ce code au tout début du fichier, avant toute autre opération
// Gestion des CORS
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
header("Access-Control-Allow-Origin: $origin");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, SOAPAction");
header("Access-Control-Allow-Credentials: true");

// Terminer immédiatement pour les requêtes preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Assurez-vous que la session est démarrée
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

require_once __DIR__ . '/../../../commun/init.php';
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInitializedInstance();

// Détection de l'environnement local
$serverAddr = $_SERVER['SERVER_ADDR'] ?? '127.0.0.1';
$isLocalEnv = ($serverAddr === '127.0.0.1');

// Vérification de la session utilisateur seulement si pas en localhost
if (! $isLocalEnv && (! isset($_SESSION['user']) || ! isset($_SESSION['user']->mailToken))) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'message' => 'Session utilisateur invalide ou expirée',
        'errors'  => ['Session utilisateur non disponible'],
    ]);
    exit;
}

/**
 * Envoi des mails d'événements HTML par lots
 */
// Initialisation du résultat
$result = [
    'success' => false,
    'message' => '',
    'data'    => [
        'sent'   => [],
        'failed' => [],
    ],
    'errors'  => [],
];

// Journal d'activité
$logger->info("Début du traitement d'une requête AJAX pour envoi d'emails");
$logger->info("Environnement local: " . ($isLocalEnv ? 'Oui' : 'Non'));
if (! $isLocalEnv) {
    $logger->info("Session active: " . session_id());
    $logger->info("Token disponible: " . (isset($_SESSION['user']->mailToken) ? 'Oui' : 'Non'));
}

// Vérification des données reçues
if (! isset($_POST['emails']) || empty($_POST['emails'])) {
    $result['message'] = "Aucun rapport à envoyer";
    header('Content-Type: application/json');
    echo json_encode($result);
    exit;
}

// Récupération des variables globales
global $config;
// La variable $debug est initialisée dans un fichier parent et est disponible ici

// Vérification de la configuration
if (! isset($config)) {
    $result['message']  = "Configuration non disponible";
    $result['errors'][] = "Variable globale config manquante";
    header('Content-Type: application/json');
    echo json_encode($result);
    exit;
}

// Vérification de la classe SSOlocal seulement si pas en localhost
if (! $isLocalEnv && ! class_exists('SSOlocal')) {
    $result['message']  = "La classe SSOlocal n'est pas disponible";
    $result['errors'][] = "Classe SSOlocal manquante";
    header('Content-Type: application/json');
    echo json_encode($result);
    exit;
}

// Limite de temps d'exécution augmentée pour les envois multiples
set_time_limit(300);

// Répertoire des fichiers emails
$mailsDir = $config->get('MAILS_DIR');

// Traitement des fichiers HTML à envoyer
$emailFiles = json_decode($_POST['emails'], true);

foreach ($emailFiles as $emailFile) {
    try {
        // Vérification que le fichier est bien un HTML
        if (! preg_match('/\.html$/', $emailFile['htmlFile'])) {
            $result['data']['failed'][] = [
                'file'  => $emailFile['htmlFile'],
                'error' => 'Format de fichier non valide, seul HTML est accepté',
            ];
            continue;
        }

        // Vérification du fichier HTML
        $htmlFilePath = $mailsDir . '/' . $emailFile['htmlFile'];

        if (! file_exists($htmlFilePath)) {
            $result['data']['failed'][] = [
                'file'  => $emailFile['htmlFile'],
                'error' => 'Fichier HTML introuvable: ' . $htmlFilePath,
            ];
            continue;
        }

        // Lecture du fichier HTML
        $htmlContent = file_get_contents($htmlFilePath);

        if (empty($htmlContent)) {
            $result['data']['failed'][] = [
                'file'  => $emailFile['htmlFile'],
                'error' => 'Fichier HTML vide',
            ];
            continue;
        }

        // Préparation des données pour l'envoi
        $subject = $emailFile['subject'] ?? "Gendarmerie de l'Eure: Rapport d'événements";

        // Extraction des destinataires depuis les données
        $originalRecipients = [];
        if (isset($emailFile['to']) && is_array($emailFile['to'])) {
            foreach ($emailFile['to'] as $recipient) {
                if (isset($recipient['mail']) && filter_var($recipient['mail'], FILTER_VALIDATE_EMAIL)) {
                    $originalRecipients[] = ["type" => "To", "mail" => $recipient['mail']];
                }
            }
        }

        // Si aucun destinataire valide trouvé
        if (empty($originalRecipients)) {
            $result['data']['failed'][] = [
                'file'  => $emailFile['htmlFile'],
                'error' => 'Aucun destinataire valide',
            ];
            continue;
        }

                                           // Définit les destinataires en fonction des conditions
        $recipients = $originalRecipients; // Par défaut, utilise les destinataires originaux

        // Si debug activé et pas en local, envoyer à nicolas.voirin uniquement
        if ($debug > 0 && ! $isLocalEnv) {
            $recipients = [
                ['type' => 'To', 'mail' => 'nicolas.voirin@gendarmerie.interieur.gouv.fr'],
            ];
            $logger->info("Mode debug activé - Envoi à nicolas.voirin@gendarmerie.interieur.gouv.fr uniquement");
        }

        // En mode localhost, simuler l'envoi sans réellement envoyer
        if ($isLocalEnv) {
            $logger->info("Mode local détecté - Simulation d'envoi pour " . $emailFile['htmlFile']);
            $result['data']['sent'][] = [
                'file'    => $emailFile['htmlFile'],
                'to'      => $recipients,
                'subject' => $subject,
                'note'    => 'Simulation en environnement local',
            ];
        }
        // Si debug activé et pas en local, ou mode normal (pas debug) et pas en local
        else {
            $recipients = [
                ['type' => 'To', 'mail' => 'nicolas.voirin@gendarmerie.interieur.gouv.fr'],
            ];
            // Envoi réel des mails
            $sendResult = sendMail($subject, $htmlContent, $recipients);

            // Vérification du résultat de l'envoi
            if ($sendResult['success']) {
                // Enregistrement du succès
                $result['data']['sent'][] = [
                    'file'    => $emailFile['htmlFile'],
                    'to'      => $recipients,
                    'subject' => $subject,
                    'note'    => ($debug > 0) ? 'Envoi en mode debug à nicolas.voirin' : 'Envoi normal',
                ];
            } else {
                // Échec de l'envoi
                $result['data']['failed'][] = [
                    'file'  => $emailFile['htmlFile'],
                    'error' => $sendResult['message'],
                ];
            }
        }

    } catch (Exception $e) {
        $logger->error("Exception lors du traitement de " . ($emailFile['htmlFile'] ?? 'unknown') . ": " . $e->getMessage());
        $result['data']['failed'][] = [
            'file'  => $emailFile['htmlFile'] ?? 'inconnu',
            'error' => $e->getMessage(),
        ];
    }
}

// Préparation du résultat
$result['success'] = (count($result['data']['sent']) > 0);
$result['message'] = sprintf(
    "Envoi terminé : %d mails envoyés, %d échecs",
    count($result['data']['sent']),
    count($result['data']['failed'])
);

// Journalisation du résultat final
$logger->info($result['message']);

// Envoi de la réponse
header('Content-Type: application/json');
echo json_encode($result);
exit;

function sendMail($subject, $body, $recipients)
{
    global $logger;
    $response = [
        "success" => false,
        "message" => "",
        "details" => null,
    ];

    try {
        if (! class_exists("SSOlocal")) {
            throw new Exception('Classe SSOlocal non disponible');
        }

        if (! isset($_SESSION['user']) || ! isset($_SESSION['user']->mailToken)) {
            throw new Exception('Session utilisateur invalide');
        }

        if ($_SESSION['user']->mailTokenExp < time()) {
            // Tentative de réauthentification
            try {
                SSOlocal::authenticate();
                $logger->info("Réauthentification réussie après expiration du token");
            } catch (Exception $e) {
                throw new Exception('Jeton caduc et réauthentification échouée: ' . $e->getMessage());
            }
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
            'stream_context'     => $stream_context,
            'location'           => SSOlocal::MAIL_URL,
            'uri'                => 'SOAPService/Mail',
            'trace'              => true,
            'exceptions'         => true,
            'connection_timeout' => 30,
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
            "faultcode"   => $e->faultcode,
            "faultstring" => $e->faultstring,
        ];

    } catch (Exception $e) {
        $logger->error("Erreur: " . $e->getMessage());
        $response["success"] = false;
        $response["message"] = "Erreur lors de l'envoi du mail: " . $e->getMessage();
    }

    return $response;
}
