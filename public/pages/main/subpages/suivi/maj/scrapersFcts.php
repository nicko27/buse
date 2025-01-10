<?php
use Commun\Ldap\LdapManager;
use Commun\Utils\DateUtils;
use Commun\Utils\TphUtils;
use duzun\hQuery;
/**
 * Scrapes data from HTML files in a directory.
 *
 * @param string $directory Directory containing HTML files.
 * @throws InvalidArgumentException if the directory path is not valid.
 */
function processHtmlFilesInDirectory($directory)
{
    global $sqlManager, $logger;

    if (!is_dir($directory)) {
        throw new InvalidArgumentException("Le chemin spécifié n'est pas un dossier valide.");
    }

    $files          = scandir($directory);
    $filesToProcess = [];

    // Collecter tous les fichiers HTML dans un tableau
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'html') {
            $filePath  = $directory . DIRECTORY_SEPARATOR . $file;
            $doc       = hQuery::fromFile($filePath);
            $sousTitre = $doc->find('div#sousTitre');

            // Vérifier si le titre est 'Suivi opérationnel'
            if ($sousTitre && trim($sousTitre->text()) === 'Suivi opérationnel') {
                // Ajouter à la fin pour traiter en dernier
                $filesToProcess[] = $filePath;
            } else {
                // Ajouter au début pour traiter en premier
                array_unshift($filesToProcess, $filePath);
            }
        }
    }

    // Traiter les fichiers dans l'ordre collecté
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
                $tph  = $matches[2]; // Extract TPH number

                // Add TPH number to the list if not already present
                if (!in_array($tph, $tphList)) {
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
 * @param string $filePath Path to the HTML file.
 */
function scrap($filePath)
{
    global $sqlManager, $logger;

    $doc      = hQuery::fromFile($filePath);
    $dayInput = $doc->find('input[name="day"]');
    $date     = DateUtils::convertDate($dayInput->val());

    // Vérifier si le div avec l'ID 'sousTitre' et le texte 'Suivi opérationnel' existe
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
 * @param object $doc  The document object to scrape.
 * @param string $date The date for which to scrape the timeline.
 */
function scrapTimeLine($doc, $date)
{
    global $sqlManager, $logger;

    $sql  = "SELECT name FROM services WHERE 1 ORDER BY LENGTH(name) DESC";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $servicesTbl      = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $hui              = new DateTime($date);
    $demain           = $hui->modify('+1 day');
    $demain           = $demain->format('Y-m-d');
    $pattern_horaires = '/<span class="detail-heure">(.*?)<\/span>/';
    $pattern_pam      = '/<span class="pam_left">(.*?)<\/span>/';

    foreach ($doc->find("fieldset.boxUnite") as $fieldset) {
        $cu_cob = $fieldset->attr('id');

        $rows = $fieldset->find(".suivi table.planif tbody tr.moyen");

        foreach ($rows as $tr) {
            $rubis = $tr->find('.moyen-label')->text();
            if (strlen($rubis) > 7) {
                $rubis = "";
            }

            $timelines = $tr->find(".timeline");

            foreach ($timelines as $timeline) {
                $hiddenContents = $timeline->find(".hiddenContent");

                foreach ($hiddenContents as $hiddenContent) {
                    $timelineHtml = $hiddenContent->html();
                    preg_match_all($pattern_horaires, $timelineHtml, $matches);
                    $debut = $matches[1][0];
                    $fin   = $matches[1][1];
                    preg_match_all($pattern_pam, $timelineHtml, $matches);
                    $service = $hiddenContent->find(".corps")[0]->text();
                    $corps   = $hiddenContent->find(".corps ul li");
                    $users   = extractUsers($corps, $rubis);

                    $tblServices = ["id" => null, "name" => $service, "shortName" => "", "color" => "", "invisible" => 1];
                    $serviceId   = $sqlManager->insertIfAbsent("services", $tblServices, ["name" => $service])['id'];
                    // Utiliser une expression régulière pour extraire les dates et les heures
                    preg_match_all('/<span class="detail-heure">([^<]+)<\/span> le ([^<]+)/', $timelineHtml, $matches);
                    $date             = $matches[2][0];
                    $datetime         = DateTime::createFromFormat('d/m/Y', $date);
                    $valDateDebut     = $datetime->format('Y-m-d');
                    $valDateFin       = $valDateDebut;
                    $entry_debut_time = clone $datetime;
                    $entry_fin_time   = clone $datetime;
                    $entry_debut_time->setTime((int) substr($debut, 0, 2), (int) substr($debut, 3, 5));
                    $entry_fin_time->setTime((int) substr($fin, 0, 2), (int) substr($fin, 3, 5));
                    if ($entry_fin_time < $entry_debut_time) {
                        $demain     = $datetime->modify('+1 day');
                        $valDateFin = $demain->format('Y-m-d');
                    }
                    $tbl = [
                        "cu"         => 0,
                        "cu_cob"     => $cu_cob,
                        "rubis"      => $rubis,
                        "nom"        => $users['firstName'],
                        "tph"        => $users['firstTph'],
                        "debut"      => $debut,
                        "fin"        => $fin,
                        "date_debut" => $valDateDebut,
                        "date_fin"   => $valDateFin,
                        "users"      => $users['userDetails'],
                        "serviceId"  => $serviceId,
                        "color"      => "",
                        "memo"       => "",
                        "invisible"  => 0,
                        "id"         => null,
                    ];
                    $tblSearch = $tbl;
                    unset($tblSearch["id"]);
                    $sqlManager->insertOrUpdate("services_unites", $tbl, $tblSearch);
                }
            }
        }
    }
}

/**
 * Scrapes PAM data from the document and inserts it into the database.
 *
 * @param object $doc  The document object to scrape.
 * @param string $date The date for which to scrape the PAM data.
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
 * Extracts user details from a given list of elements.
 *
 * @param array $corps The list of elements containing user details.
 * @return array An associative array containing the first user details and a JSON-encoded list of all users.
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
            $users[] = ["name" => $name, "tph" => $tph, "rubis" => $rubis];
        }
    }

    return ['firstName' => $firstName, 'firstTph' => $firstTph, 'userDetails' => json_encode($users)];
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
 * Récupère le code unité via une recherche LDAP.
 *
 * @param string $tph Numéro de téléphone.
 * @return string Code unité correspondant.
 */
function getLdapCu($tph)
{
    $ldapManager = LdapManager::getInstance();
    $tph         = TphUtils::formatNumberWith33($tph);
    $recherche   = sprintf("(|(mobile=%s)(telephoneNEO=%s))", $tph, $tph);
    $info        = $ldapManager->searchPersons($recherche, ["codeUnite"], 1);
    if ($info[0]) {
        return $info[0]["codeunite"];
    } else {
        return 0;
    }

}
