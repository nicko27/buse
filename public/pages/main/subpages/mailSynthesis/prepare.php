<?php
/**
 * Génération automatique d'emails de rapport d'événements pour les mairies
 *
 * Ce script récupère les événements des dernières 24 heures, les organise
 * par COB/BTA et commune, puis prépare les emails à envoyer.
 * Retourne un JSON avec toutes les informations nécessaires pour l'envoi et le suivi.
 */
require_once __DIR__ . '/../../../commun/init.php';
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;
use Commun\Mail\EMLGenerator;
use Commun\Utils\FileUtils;
// Initialisation
$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInitializedInstance();

// Initialisation du tableau de résultats pour AJAX
$result = [
    'success' => false,
    'message' => '',
    'data'    => [
        'stats'  => [
            'totalEvents'     => 0,
            'processedEvents' => 0,
            'totalUnits'      => 0,
            'totalCities'     => 0,
        ],
        'units'  => [],
        'cities' => [],
        'files'  => [
            'html' => [],
            'eml'  => [],
        ],
        'emails' => [],
    ],
    'errors'  => [],
];

global $twig, $sqlManager, $config, $debug, $logger;

// Vérification des dépendances
if (! isset($sqlManager) || ! isset($config) || ! isset($twig)) {
    $result['message']  = "Erreur: Les variables globales requises ne sont pas définies";
    $result['errors'][] = "Variables globales manquantes";
    echo json_encode($result);
    exit;
}

try {
    // Configuration des dates
    $start = new \DateTime('yesterday 07:00');
    $end   = new \DateTime('today 07:00');

    // Nettoyage des anciens fichiers
    FileUtils::deleteOldFiles($config->get("FILES_DIR"), $start, ["xlsx", "eml", "ods"]);

    $cuCie = $config->get("MAIL_CIE_ENABLE");
    if ($cieCu == 1) {
        $cuCie = null;
    }

    // Récupération des événements
    $events                                 = getEvents($sqlManager, $start, $end, $cuCie);
    $result['data']['stats']['totalEvents'] = count($events) - 1; // On soustrait l'événement fictif

    if (empty($events) || $result['data']['stats']['totalEvents'] == 0) {
        $result['success'] = true;
        $result['message'] = "Aucun événement trouvé pour la période spécifiée.";
        echo json_encode($result);
        exit;
    }

    // Préparation des données pour les emails
    $processedEvents = 0;
    $totalCities     = 0;
    $organizedData   = organizeEventDataByCOBAndBTA($events, $sqlManager, $config, $twig, $processedEvents, $totalCities);

    $result['data']['stats']['processedEvents'] = $processedEvents;
    $result['data']['stats']['totalUnits']      = count($organizedData);
    $result['data']['stats']['totalCities']     = $totalCities;

    // Préparation des données pour chaque unité
    foreach ($organizedData as $unitId => $unitData) {
        if (! empty($unitData['cities'])) {
            $emailData = prepareUnitEmail($unitData, $unitId, $unitData['destinataires'], $sqlManager, $config, $twig, $debug);

            if ($emailData !== null) {
                // Ajouter les informations à la réponse
                $result['data']['units'][] = [
                    'id'         => $unitId,
                    'label'      => $unitData['label'],
                    'type'       => $unitData['isCob'] == 1 ? 'COB' : 'BTA',
                    'eventCount' => $unitData['eventCount'] ?? 0,
                    'cityCount'  => count($unitData['cities']),
                    'htmlFile'   => $emailData['htmlFile'],
                    'emlFile'    => $emailData['emlFile'],
                ];

                // Ajouter les fichiers générés
                $result['data']['files']['html'][] = $emailData['htmlFile'];
                $result['data']['files']['eml'][]  = $emailData['emlFile'];

                // Ajouter les informations d'email
                $result['data']['emails'][] = [
                    'subject'  => $emailData['subject'],
                    'to'       => $emailData['to'],
                    'htmlFile' => $emailData['htmlFile'],
                    'emlFile'  => $emailData['emlFile'],
                ];
            }

            // Ajouter les données des villes
            foreach ($unitData['cities'] as $city) {
                $result['data']['cities'][] = [
                    'name'       => $city['name'],
                    'unitId'     => $unitId,
                    'eventCount' => count($city['events']),
                    'emlFile'    => $city['emlName'],
                ];

                // Ajouter le fichier EML de la ville
                if (! empty($city['emlName'])) {
                    $result['data']['files']['eml'][] = $city['emlName'];
                }
            }
        }
    }

    $result['success'] = true;
    $result['message'] = "Traitement terminé avec succès. " .
        $result['data']['stats']['processedEvents'] . " événements traités pour " .
        $result['data']['stats']['totalCities'] . " communes et " .
        $result['data']['stats']['totalUnits'] . " unités.";

} catch (\Exception $e) {
    $result['message']  = "Erreur durant le traitement";
    $result['errors'][] = $e->getMessage();
}

// Renvoyer le résultat en JSON
echo json_encode($result);
exit;

/**
 * Récupère les événements depuis la base de données
 */
function getEvents($sqlManager, $start, $end, $cuCie = null)
{
    $sql = "SELECT
        evenements.*,
        categories.niveau,
        categories.categorie,
        categories.nature,
        cities.name,
        cities.id as cid,
        mairies.mail,
        cities.old_name,
        unites_ldap.cu,
        unites_ldap.isCob,
        unites_ldap.label,
        unites_ldap.cuCob,
        unites_ldap.cuCie,
        unites_ldap.newName as ulName,
        unites_ldap.mail as ulMail
    FROM evenements
    JOIN categories      ON evenements.categorie_id = categories.id
    JOIN cities          ON evenements.commune_id = cities.id
    JOIN mairies         ON cities.insee = mairies.insee
    JOIN unites_ldap     ON mairies.unit_id= unites_ldap.id
    WHERE
        CONCAT(evenements.date, ' ', evenements.heure) >= :start
        AND CONCAT(evenements.date, ' ', evenements.heure) < :end";

    // Ajout du filtrage par cuCie si spécifié
    if ($cuCie !== null) {
        $sql .= " AND unites_ldap.cuCie = :cuCie";
    }

    $sql .= " ORDER BY unites_ldap.cuCie, unites_ldap.newName, cities.name, cities.old_name, evenements.date, evenements.heure";

    $stmt = $sqlManager->prepare($sql);

    $params = [
        "start" => $start->format('Y-m-d H:i:s'),
        "end"   => $end->format('Y-m-d H:i:s'),
    ];

    // Ajout du paramètre cuCie si spécifié
    if ($cuCie !== null) {
        $params["cuCie"] = $cuCie;
    }

    $stmt->execute($params);

    $events = $stmt->fetchAll(\PDO::FETCH_ASSOC);

    // Ajouter un événement fictif à la fin pour traiter le dernier groupe
    $events[] = ["name" => "", "id" => -1, "cuCob" => -1, "cuCie" => -1];

    return $events;
}
/**
 * Organise les données des événements par COB et BTA
 */
function organizeEventDataByCOBAndBTA($events, $sqlManager, $config, $twig, &$processedEvents, &$totalCities)
{
    $organizedData   = [];
    $cityName        = "";
    $currentUnitId   = 0;
    $evts_tbl        = [];
    $unitEmails      = [];
    $citiesProcessed = [];

    // Ajouter les variables de configuration globales
    $globalConfig = [
        "WEB_DIR"  => $config->get("WEB_DIR"),
        "WEB_ADDR" => $config->get("WEB_ADDR"),
    ];

    foreach ($events as $event) {
        // Déterminer l'ID de l'unité (COB ou BTA)
        $unitId = determineUnitId($event);

        // Changement de commune
        if ($cityName !== $event['name']) {
            if (! empty($evts_tbl) && $cityName != "") {
                // Générer l'email pour la commune précédente
                $emlName = generateCityEml($evts_tbl, $config, $twig);

                // Ajouter les événements au contenu de l'unité
                if (isset($organizedData[$currentUnitId])) {
                    $organizedData[$currentUnitId]['cities'][] = [
                        "events"  => $evts_tbl,
                        "name"    => $cityName,
                        "mail"    => $evts_tbl[0]['mail'] ?? '',
                        "emlName" => $emlName,
                    ];

                    // Incrémenter le compteur d'événements traités
                    $processedEvents += count($evts_tbl);

                    // Comptabiliser la ville si elle n'a pas déjà été traitée
                    if (! in_array($cityName, $citiesProcessed)) {
                        $citiesProcessed[] = $cityName;
                    }
                }
            }

            $cityName = $event['name'];
            $evts_tbl = [];

            // Collecter les emails des unités
            if (! empty($event['ulMail']) && ! in_array($event['ulMail'], $unitEmails)) {
                $unitEmails[] = $event['ulMail'];
                if (isset($organizedData[$unitId])) {
                    $organizedData[$unitId]['destinataires'][] = $event['ulMail'];
                }
            }
        }

        // Ajouter l'événement à la liste actuelle
        if ($event['id'] != -1) {
            $evts_tbl[] = $event;
        }

        // Changement d'unité (COB ou BTA)
        if ($currentUnitId != $unitId && $unitId != -1) {
            // Initialiser la nouvelle unité si nécessaire
            if (! isset($organizedData[$unitId])) {
                // Récupérer les informations de l'unité
                $unitInfo = getUnitInfo($sqlManager, $unitId);

                $organizedData[$unitId] = array_merge($globalConfig, [
                    'label'         => $unitInfo['label'] ?? ($event['isCob'] == 1 ? 'COB ' : 'BTA ') . $unitId,
                    'id'            => $unitId,
                    'isCob'         => $event['isCob'],
                    'cities'        => [],
                    'destinataires' => [],
                    'ulName'        => $event['ulName'] ?? '',
                    'eventCount'    => 0, // Ajout d'un compteur d'événements par unité
                ]);
            }

            $currentUnitId = $unitId;
        }
    }

    // Traiter le dernier groupe d'événements
    if (! empty($evts_tbl) && $cityName != "") {
        $emlName = generateCityEml($evts_tbl, $config, $twig);

        if (isset($organizedData[$currentUnitId])) {
            $organizedData[$currentUnitId]['cities'][] = [
                "events"  => $evts_tbl,
                "name"    => $cityName,
                "mail"    => $evts_tbl[0]['mail'] ?? '',
                "emlName" => $emlName,
            ];

            // Incrémenter le compteur d'événements traités
            $processedEvents += count($evts_tbl);

            // Comptabiliser la ville si elle n'a pas déjà été traitée
            if (! in_array($cityName, $citiesProcessed)) {
                $citiesProcessed[] = $cityName;
            }
        }
    }

    // Calculer le nombre total de villes distinctes
    $totalCities = count($citiesProcessed);

    // Calculer le nombre d'événements par unité
    foreach ($organizedData as $unitId => &$unitData) {
        $count = 0;
        foreach ($unitData['cities'] as $city) {
            $count += count($city['events']);
        }
        $unitData['eventCount'] = $count;
    }

    return $organizedData;
}

/**
 * Détermine l'ID de l'unité (COB ou BTA)
 */
function determineUnitId($event)
{
    // Si c'est une COB (isCob=1), utiliser son ID (cu)
    if ($event['isCob'] == 1) {
        return $event['cu'];
    }

    // Si c'est une BTA (isCob=0), vérifier si elle appartient à une COB
    if (! empty($event['cuCob']) && $event['cuCob'] > 0) {
        // Si la BTA appartient à une COB, on utilise l'ID de la COB
        return $event['cuCob'];
    }

    // Sinon, c'est une BTA autonome, on utilise son propre ID
    return $event['cu'];
}

/**
 * Récupère les informations d'une unité (COB ou BTA)
 */
function getUnitInfo($sqlManager, $unitId)
{
    if (empty($unitId)) {
        return ['label' => '', 'mail' => ''];
    }

    $sql  = "SELECT label, mail, isCob FROM unites_ldap WHERE cu = :cu";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute(["cu" => $unitId]);
    return $stmt->fetch(\PDO::FETCH_ASSOC) ?: ['label' => '', 'mail' => '', 'isCob' => 0];
}

/**
 * Prépare les données d'email pour une unité (COB ou BTA)
 * Ne fait pas l'envoi mais prépare toutes les données nécessaires
 */
function prepareUnitEmail($unitData, $unitId, $destinataires, $sqlManager, $config, $twig, $debug)
{
    try {
        if (empty($unitData['cities'])) {
            return null;
        }

        // Préparer les données pour le template
        $date       = (new \DateTime())->format('Y-m-d');
        $unitName   = FileUtils::sanitizeFileName($unitData['label']);
        $unitType   = $unitData['isCob'] == 1 ? 'COB' : 'BTA';
        $eventCount = $unitData['eventCount'] ?? 0;

        // Préparer les destinataires
        $to = [];
        foreach ($destinataires as $dest) {
            $to[] = ['type' => 'To', 'mail' => $dest];
        }

        // Récupérer l'email de l'unité
        $unitInfo = getUnitInfo($sqlManager, $unitId);
        if (! empty($unitInfo['mail'])) {
            $to[] = ['type' => 'To', 'mail' => $unitInfo['mail']];
        }

        // Générer le contenu HTML de l'email
        $bodyContent = $twig->render('/main/subpages/mailSynthesis/cob_mail_html.twig', [
            'cobs'     => [$unitData], // On passe un tableau avec une seule unité
            'links'    => [['id' => $unitId, 'name' => $unitData['ulName']]],
            'WEB_DIR'  => $unitData['WEB_DIR'],
            'WEB_ADDR' => $unitData['WEB_ADDR'],
            'stats'    => [
                'eventCount' => $eventCount,
                'cityCount'  => count($unitData['cities']),
            ],
        ]);

        // Préparer le sujet de l'email
        $subject = "Gendarmerie de l'Eure: Événements $unitType " . $unitData['label'] . " ($eventCount événements)";

        // Générer le contenu texte de l'email (version simplifiée)
        $textContent = "Veuillez consulter la version HTML de ce message pour voir les événements.";

        // Sauvegarder le fichier HTML pour l'unité
        $htmlName     = sprintf("aaa_mail_%s_%s_%s.html", strtolower($unitType), $unitName, $date);
        $htmlFileName = sprintf("%s/%s", $config->get('MAILS_DIR'), $htmlName);
        file_put_contents($htmlFileName, $bodyContent);

        // Créer le fichier EML mais ne pas l'envoyer
        $eml  = new EMLGenerator($twig);
        $from = "";
        $eml->setSimpleEmailTemplate('/main/subpages/mailSynthesis/event_mail_html.twig');
        $emlContent = $eml->createSimpleEmail($from, implode(', ', array_column($to, 'mail')), $subject, $textContent, $bodyContent);

        // Sauvegarder le fichier EML
        $emlName     = sprintf("mail_%s_%s_%s.eml", strtolower($unitType), $unitName, $date);
        $emlFileName = sprintf("%s/%s", $config->get('MAILS_DIR'), $emlName);
        file_put_contents($emlFileName, $emlContent);

        // Retourner les données nécessaires pour l'envoi
        return [
            'subject'    => $subject,
            'to'         => $to,
            'htmlFile'   => $htmlName,
            'emlFile'    => $emlName,
            'unitId'     => $unitId,
            'unitLabel'  => $unitData['label'],
            'unitType'   => $unitType,
            'eventCount' => $eventCount,
            'cityCount'  => count($unitData['cities']),
        ];
    } catch (\Exception $e) {
        error_log("Erreur lors de la préparation de l'email pour l'unité: " . $e->getMessage());
        return null;
    }
}

/**
 * Génère un email pour une commune
 */
function generateCityEml($evts_tbl, $config, $twig)
{
    try {
        if (empty($evts_tbl)) {
            return null;
        }

        $eml  = new EMLGenerator($twig);
        $from = "";
        $to   = $evts_tbl[0]['ulMail']; // Email de l'unité

        // Préparer les données pour le template
        $varsMail = ['mails_tbl' => $evts_tbl];

        // Générer le contenu de l'email
        $textContent = $twig->render('/main/subpages/mailSynthesis/event_mail_text.twig', $varsMail);
        $htmlContent = $twig->render('/main/subpages/mailSynthesis/event_mail_html.twig', $varsMail);
        $subject     = "Gendarmerie de l'Eure: Événements ayant eu lieu sur votre commune";

        // Créer l'email
        $eml->setSimpleEmailTemplate('main/subpages/mailSynthesis/eml_unit_mail.twig');
        $emlContent = $eml->createSimpleEmail($from, $to, $subject, $textContent, $htmlContent);

        // Sauvegarder l'email
        $date = FileUtils::sanitizeFileName($evts_tbl[0]['date']);
        $city = FileUtils::sanitizeFileName($evts_tbl[0]['name']);
        if (! empty($evts_tbl[0]['old_name'])) {
            $city = FileUtils::sanitizeFileName($evts_tbl[0]['old_name']);
        }
        $emlName     = sprintf("mail_%s_%s.eml", $city, $date);
        $emlFileName = sprintf("%s/%s", $config->get('MAILS_DIR'), $emlName);
        file_put_contents($emlFileName, $emlContent);

        return $emlName;
    } catch (\Exception $e) {
        error_log("Erreur lors de la génération de l'email pour la commune: " . $e->getMessage());
        return null;
    }
}
