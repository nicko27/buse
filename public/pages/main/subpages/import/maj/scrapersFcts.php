<?php

use Commun\Ldap\LdapManager;
use Commun\Utils\DateUtils;
use Commun\Utils\TphUtils;
use duzun\hQuery;

/**
 * Scrapes data from HTML files in a directory.
 *
 * @param string $directory Directory containing HTML files
 * @throws InvalidArgumentException if the directory path is not valid
 */
function processHtmlFilesInDirectory($directory)
{
    global $sqlManager, $logger;

    if (! is_dir($directory)) {
        throw new InvalidArgumentException("Le chemin spécifié n'est pas un dossier valide.");
    }

    $files          = scandir($directory);
    $filesToProcess = [];

    // Collect HTML files and sort based on content
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'html') {
            $filePath  = $directory . DIRECTORY_SEPARATOR . $file;
            $doc       = hQuery::fromFile($filePath);
            $sousTitre = $doc->find('div#sousTitre');

            // Process operational tracking files last
            if ($sousTitre && trim($sousTitre->text()) === 'Suivi opérationnel') {
                $filesToProcess[] = $filePath; // Add to end
            } else {
                array_unshift($filesToProcess, $filePath); // Add to beginning
            }
        }
    }

    // Process files in collected order
    foreach ($filesToProcess as $filePath) {
        scrap($filePath);
    }
}

/**
 * Scrapes TPH (Temporary Part-Time Hospital) information from the given document.
 *
 * @param simple_html_dom $doc The HTML document object containing TPH information.
 * @param string $date The date for which the TPH information is being scraped.
 */
function scrapTph($doc, $date)
{
    global $sqlManager, $logger;

    $tphList = []; // List to store unique TPH numbers

    // Iterate through each fieldset containing TPH data
    foreach ($doc->find("fieldset.boxUnite") as $fieldset) {
        $cu = $fieldset->attr("id"); // Get CU (Center Unit) ID

        // Find all lines within the fieldset that contain TPH data
        $lines = $fieldset->find("table.permanences span.perm-nuit-crew");

        // Iterate through each line to extract TPH details
        foreach ($lines as $line) {
            $input = $line->attr("title"); // Get the title attribute

            // Use regex to extract name and TPH number from the text
            if (preg_match('/^([^()]+)\((\d+)\)$/', $line->text(), $matches)) {
                $name = trim($matches[1]); // Extract name
                $tph  = $matches[2];       // Extract TPH number

                // Add TPH number to the list if not already present
                if (! in_array($tph, $tphList)) {
                    $tphList[] = $tph;

                    // Update database with CU information for the TPH
                    $sqlManager->update("services_unites", ["cu" => getCorrectCu($cu, $input, $tph, 1)], sprintf('tph="%s"', $tph));
                }
            }
        }
    }
}

/**
 * Scrapes data from a specific HTML file based on its content.
 *
 * @param string $filePath Path to the HTML file
 */
function scrap($filePath)
{
    global $sqlManager, $logger;

    $doc      = hQuery::fromFile($filePath);
    $dayInput = $doc->find('input[name="day"]');
    $date     = DateUtils::convertDate($dayInput->val());

    // Check if operational tracking content exists
    $sousTitre = $doc->find('div#sousTitre');
    if ($sousTitre && trim($sousTitre->text()) === 'Suivi opérationnel') {
        scrapTimeLine($doc, $date);
        scrapTph($doc, $date);
    } else {
        scrapPam($doc, $date);
    }
}

/**
 * Scrapes timeline data from the document and inserts it into the database.
 *
 * @param object $doc The document object to scrape
 * @param string $date The date for which to scrape the timeline
 */
function scrapTimeLine($doc, $date)
{
    global $sqlManager;

    $baseDate = new DateTime($date);
    $patterns = [
        'hours'    => '/<span class="detail-heure">(.*?)<\/span>/',
        'pam'      => '/<span class="pam_left">(.*?)<\/span>/',
        'datetime' => '/<span class="detail-heure">([^<]+)<\/span> le ([^<]+)/',
    ];

    foreach ($doc->find("fieldset.boxUnite") as $fieldset) {
        processTimelineFieldset($fieldset, $baseDate, $patterns);
    }
}

/**
 * Processes a single timeline fieldset
 *
 * @param object $fieldset The fieldset DOM element to process
 * @param DateTime $baseDate Base date for the timeline
 * @param array $patterns Array of regex patterns used for parsing
 */
function processTimelineFieldset($fieldset, $baseDate, $patterns)
{
    $cu_cob = $fieldset->attr('id');
    $rows   = $fieldset->find(".suivi table.planif tbody tr.moyen");

    foreach ($rows as $tr) {
        $rubis = extractRubisIdentifier($tr);
        processTimelineRows($tr, $rubis, $cu_cob, $baseDate, $patterns);
    }
}

/**
 * Extracts Rubis identifier from a timeline row
 *
 * @param object $tr The table row element
 * @return string The Rubis identifier or empty string if invalid
 */
function extractRubisIdentifier($tr)
{
    $rubis = $tr->find('.moyen-label')->text();
    return (strlen($rubis) > 7) ? "" : $rubis;
}

/**
 * Processes timeline rows for a given table row
 *
 * @param object $tr The table row element
 * @param string $rubis The Rubis identifier
 * @param string $cu_cob The CU-COB identifier
 * @param DateTime $baseDate Base date for the timeline
 * @param array $patterns Array of regex patterns used for parsing
 */
function processTimelineRows($tr, $rubis, $cu_cob, $baseDate, $patterns)
{
    foreach ($tr->find(".timeline") as $timeline) {
        foreach ($timeline->find(".hiddenContent") as $hiddenContent) {
            processTimelineContent($hiddenContent, $rubis, $cu_cob, $baseDate, $patterns);
        }
    }
}

/**
 * Processes a single timeline content element
 *
 * @param object $hiddenContent The hidden content element
 * @param string $rubis The Rubis identifier
 * @param string $cu_cob The CU-COB identifier
 * @param DateTime $baseDate Base date for the timeline
 * @param array $patterns Array of regex patterns used for parsing
 */
function processTimelineContent($hiddenContent, $rubis, $cu_cob, $baseDate, $patterns)
{
    global $sqlManager;

    $timelineHtml = $hiddenContent->html();
    $timeData     = extractTimeData($timelineHtml, $patterns['hours']);
    $service      = $hiddenContent->find(".corps")[0]->text();
    $users        = extractUsers($hiddenContent->find(".corps ul li"), $rubis);

    $serviceId = insertService($service);
    $dates     = calculateTimelineDates($timelineHtml, $patterns['datetime'], $timeData);

    $record = createTimelineRecord([
        'cu_cob'    => $cu_cob,
        'rubis'     => $rubis,
        'users'     => $users,
        'timeData'  => $timeData,
        'dates'     => $dates,
        'serviceId' => $serviceId,
    ]);

    insertTimelineRecord($record);
}

/**
 * Extracts time data from timeline HTML
 *
 * @param string $timelineHtml The timeline HTML content
 * @param string $pattern The regex pattern for time extraction
 * @return array Array containing start and end times
 */
function extractTimeData($timelineHtml, $pattern)
{
    preg_match_all($pattern, $timelineHtml, $matches);
    return [
        'start' => $matches[1][0],
        'end'   => $matches[1][1],
    ];
}

/**
 * Inserts a service record and returns its ID
 *
 * @param string $serviceName The name of the service
 * @return int The service ID
 */
function insertService($serviceName)
{
    global $sqlManager;

    $serviceData = [
        "id"        => null,
        "name"      => $serviceName,
        "shortName" => "",
        "color"     => "",
        "invisible" => 1,
    ];

    return $sqlManager->insertIfAbsent("services", $serviceData, ["name" => $serviceName])['id'];
}

/**
 * Calculates timeline dates based on the content
 *
 * @param string $timelineHtml The timeline HTML content
 * @param string $pattern The datetime pattern
 * @param array $timeData Array containing start and end times
 * @return array Array containing start and end dates
 */
function calculateTimelineDates($timelineHtml, $pattern, $timeData)
{
    preg_match_all($pattern, $timelineHtml, $matches);
    $datetime  = DateTime::createFromFormat('d/m/Y', $matches[2][0]);
    $startDate = clone $datetime;
    $endDate   = clone $datetime;

    $startTime = explode(':', $timeData['start']);
    $endTime   = explode(':', $timeData['end']);

    $startDate->setTime((int) $startTime[0], (int) $startTime[1]);
    $endDate->setTime((int) $endTime[0], (int) $endTime[1]);

    if ($endDate < $startDate) {
        $endDate->modify('+1 day');
    }

    return [
        'start' => $startDate->format('Y-m-d'),
        'end'   => $endDate->format('Y-m-d'),
    ];
}

/**
 * Creates a timeline record array
 *
 * @param array $data Array containing all necessary data for the record
 * @return array The complete timeline record
 */
function createTimelineRecord($data)
{
    return [
        "cu"         => 0,
        "cu_cob"     => $data['cu_cob'],
        "rubis"      => $data['rubis'],
        "nom"        => $data['users']['firstName'],
        "tph"        => $data['users']['firstTph'],
        "debut"      => $data['timeData']['start'],
        "fin"        => $data['timeData']['end'],
        "date_debut" => $data['dates']['start'],
        "date_fin"   => $data['dates']['end'],
        "users"      => $data['users']['userDetails'],
        "serviceId"  => $data['serviceId'],
        "color"      => "",
        "memo"       => "",
        "invisible"  => 0,
        "id"         => null,
    ];
}

/**
 * Inserts or updates a timeline record in the database
 *
 * @param array $record The record to insert or update
 */
function insertTimelineRecord($record)
{
    global $sqlManager;

    $searchRecord = $record;
    unset($searchRecord["id"]);
    $sqlManager->insertOrUpdate("services_unites", $record, $searchRecord);
}

/**
 * Scrapes PAM data from the document and inserts it into the database.
 *
 * @param object $doc  The document object to scrape.
 * @param string $date The date for which to scrape the PAM data.
 */
/**
 * Scrapes PAM (Medical Assistance Post) data from an HTML document.
 * Processes each fieldset containing PAM information and extracts relevant details.
 *
 * @param object $doc HTML document object to scrape
 * @param string $date Date for which to scrape the PAM data
 */
function scrapPam($doc, $date)
{

    foreach ($doc->find("fieldset") as $fieldset) {
        $lgd = $fieldset->find('legend');
        if ($lgd != null) {
            $legend = $lgd->text();
            preg_match('/\((\d+)\)$/', $legend, $matches);
            $cu    = $matches[1];
            $table = $fieldset->find('.permanence');
            if ($table) {
                foreach ($table->find('tbody tr') as $tr) {
                    insertDetails($tr, $cu, $date);
                }
            }
        }
    }
}

/**
 * Inserts PAM details into the database.
 *
 * @param object $tr    The table row containing PAM details.
 * @param string $cu    The unit code.
 * @param string $date  The date for which to insert the details.
 */
function insertDetails($tr, $cu, $date)
{

    $tdHtml        = $tr->html();
    $pattern_td    = '/<td>(.*?)<\/td>/s';
    $pattern_br    = '/^(.*?)<br>/s';
    $pattern_class = '/<span class="perm-nuit-crew"[^>]*title="([^"]+)"[^>]*>([^<]+) \((\d+)\)<\/span>/';

    if (preg_match_all($pattern_td, $tdHtml, $matches_td)) {
        $type = '';

        if (isset($matches_td[1][0]) && preg_match($pattern_br, $matches_td[1][0], $match_type)) {
            $type = trim($match_type[1] ?? '');
        }

        if ($type == "PAM1") {
            processPamDetails($matches_td, $cu, $date, $pattern_class);
        }
    }
}

/**
 * Processes PAM details and inserts them into the database.
 *
 * @param array  $matches_td    Array of matched table cells.
 * @param string $cu            The unit code.
 * @param string $date          The date for which to insert the details.
 * @param string $pattern_class The regex pattern to match PAM class.
 */
/**
 * Processes PAM (Medical Assistance Post) details and inserts them into the database.
 * Handles different time periods (morning, afternoon, night) and creates corresponding records.
 *
 * @param array $matches_td Array of matched table cells containing PAM information
 * @param string $cu Center Unit identifier
 * @param string $date Date for which the PAM details are being processed
 * @param string $pattern_class Regex pattern to extract crew information
 */
function processPamDetails($matches_td, $cu, $date, $pattern_class)
{
    global $sqlManager, $logger;

    $times = ['matin' => 1, 'aprem' => 3, 'nuit' => 5];
    foreach ($times as $time => $index) {
        $tblSql = ["matin" => 0, "aprem" => 0, "nuit" => 0, "date" => $date];

        if (isset($matches_td[1][$index]) && preg_match($pattern_class, $matches_td[1][$index], $matches)) {
            $tblSql["nom"] = $matches[2];
            $tblSql["tph"] = $matches[3];
            $tblSql[$time] = 1;
            $tblSql["cu"]  = getCorrectCu($cu, $matches[1], $tblSql["tph"], 0);
            $sqlManager->insert("tph_pam", $tblSql);
        }
    }
}

/**
 * Extracts user details from a list of HTML elements containing user information.
 * Each element is expected to contain a name and TPH number in the format "Name (TPH)".
 *
 * @param array $corps Array of HTML elements containing user information
 * @param string $rubis The Rubis identifier to associate with the users
 * @return array Associative array containing:
 *               - firstName: Name of the first user found
 *               - firstTph: TPH number of the first user
 *               - userDetails: JSON encoded array of all users with their details
 */
function extractUsers($corps, $rubis)
{
    $first     = true;
    $firstName = '';
    $firstTph  = '';
    $users     = [];

    foreach ($corps as $li) {
        $li_text = trim($li->text());
        if (preg_match('/^([^()]+)\((\d+)\)$/', $li_text, $matches)) {
            $name = trim($matches[1]);
            $tph  = $matches[2];

            if ($first) {
                $first     = false;
                $firstName = $name;
                $firstTph  = $tph;
            }

            $users[] = [
                "name"  => $name,
                "tph"   => $tph,
                "rubis" => $rubis,
            ];
        }
    }

    return [
        'firstName'   => $firstName,
        'firstTph'    => $firstTph,
        'userDetails' => json_encode($users),
    ];
}

function fillNullCuFromCob()
{
    global $logger, $sqlManager;

    $sql  = "SELECT DISTINCT services_unites.cu_cob FROM services_unites WHERE services_unites.cu = 0";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    while ($resultat = $stmt->fetch()) {
        $sqlCu  = "SELECT cu, mergedWithCu,isCob FROM unites_ldap WHERE cu = :cu";
        $stmtCu = $sqlManager->prepare($sqlCu);
        $stmtCu->bindParam(":cu", $resultat['cu_cob'], PDO::PARAM_INT);
        $stmtCu->execute();
        $resultatCu = $stmtCu->fetch();
        if ($resultatCu['mergedWithCu'] > 0) {
            $newCu = $resultatCu['mergedWithCu'];
        } else {
            $newCu = $resultatCu['cu'];
        }
        $sqlManager->update("services_unites", ["cu" => $newCu], "cu=:cu AND cu_cob = :cu_cob", ["cu" => 0, "cu_cob" => $resultat['cu_cob']]);
    }
}

function fillNullCuFromLdap()
{
    global $logger, $sqlManager;

    foreach (["services_unites", "tph_pam"] as $tableName) {

        $sql  = sprintf("SELECT DISTINCT tph FROM %s WHERE cu=0", $tableName);
        $stmt = $sqlManager->prepare($sql);
        $stmt->execute();
        while ($resultat = $stmt->fetch()) {
            $ldapCu = getLdapCu($resultat['tph']); // Get CU information from LDAP
            if ($ldapCu) {
                $sqlManager->update($tableName, ["cu" => $ldapCu], "tph=:tph", ["tph" => $resultat["tph"]]);
                $logger->info("Updated CU for TPH", [
                    'tph' => $resultat['tph'],
                    'cu'  => $ldapCu,
                ]);
            } else {
                $logger->warning("No LDAP CU found for TPH", [
                    'tph' => $resultat['tph'],
                ]);
            }
        }
    }
}

/**
 * Retrieves the unit code via LDAP search.
 *
 * @param string $tph Phone number
 * @return string Corresponding unit code
 */
function getLdapCu($tph)
{
    $ldapManager = LdapManager::getInstance();
    $tph         = TphUtils::formatNumberWith33($tph);
    $search      = sprintf("(|(mobile=%s)(telephoneNEO=%s))", $tph, $tph);
    $info        = $ldapManager->searchPersons($search, ["codeUnite"], 1);

    return $info[0] ? $info[0]["codeunite"] : 0;
}
