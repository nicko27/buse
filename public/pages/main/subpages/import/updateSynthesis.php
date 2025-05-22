<?php
require_once __DIR__ . '/../../../commun/init.php';
use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;
use Commun\Utils\ExcelProcessor;

$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
try {
    $excelProcessor  = new ExcelProcessor();
    $fileInDirectory = $excelProcessor->getSpreadsheetFilesInDirectory($config->get("UPLOAD_DIR"));
    $tbl_results     = [];
    foreach ($fileInDirectory as $file) {
        $excelProcessor->processSpreadsheetFile($file);
        $totalCols    = explode("|", $config->get("COL_LIST"));
        $colsToSearch = [];
        foreach ($totalCols as $col) {
            $colsToSearch[$col] = $config->get($col);
        }
        $cols = $excelProcessor->getColsCoordinates($colsToSearch);

//        $cols = $excelProcessor->getColsCoordonates(explode("|", $config->get("TOTAL_COLS")));

        if (sizeof($cols) > 0) {
            $current_row = $cols["APPEL_COL"]["row"];
            $next_row    = $current_row + 1;
            $total_row   = $excelProcessor->getMaxRowCount();
            for ($row = $next_row; $row <= $total_row; $row += 1) {
                $rowContent = $excelProcessor->getRow($row);
                if (array_key_exists($cols["APPEL_COL"]["col"], $rowContent)) {
                    $date = $rowContent[$cols["APPEL_COL"]["col"]];
                    if (strlen($date) > 0) {
                        $datetime             = Commun\Utils\DateUtils::parseDate($date);
                        $tbl_results['date']  = $datetime->format('Y-m-d');
                        $tbl_results['heure'] = $datetime->format("H:i:s");
                        $colCategorie         = $cols["CATEGORIE_COL"]["col"];
                        $categorie            = $rowContent[$colCategorie];
                        $infos                = getInfosFromCategorie($categorie);
                        if ($infos != null) {
                            $tbl_results['categorie_id'] = $infos['id'];
                            $tbl_results['need_to_send'] = $infos['send'];
                        } else {
                            $tbl_categ                   = [];
                            $tbl_categ["id"]             = null;
                            $tbl_categ["niveau"]         = 1;
                            $tbl_categ["categorie"]      = $categorie;
                            $tbl_categ["nature"]         = "";
                            $tbl_categ["send"]           = 1;
                            $result                      = $sqlManager->insert("categories", $tbl_categ);
                            $tbl_results['categorie_id'] = $result["id"];
                            $tbl_results['need_to_send'] = 1;
                        }
                        $commune = $rowContent[$cols["COMMUNE_COL"]["col"]];
                        $infos   = getInfosFromCities($commune);
                        if ($infos != null) {
                            $tbl_results['commune_id'] = $infos['id'];
                        } else {
                            $tbl_city                  = [];
                            $tbl_city["id"]            = null;
                            $tbl_city["insee"]         = 0;
                            $tbl_city["code_postal"]   = 0;
                            $tbl_city["name"]          = $commune;
                            $tbl_city["old_name"]      = "";
                            $result                    = $sqlManager->insert("cities", $tbl_city);
                            $tbl_results['commune_id'] = $result['id'];
                        }
                        $tbl_results['premiers_elt']  = $rowContent[$cols["PREMIERS_ELTS_COL"]["col"]];
                        $tbl_results['unite_engagee'] = $rowContent[$cols["UNITE_ENGAGEE_COL"]["col"]];
                        $tbl_results['cro']           = $rowContent[$cols["CRO_COL"]["col"]];
                        $concat                       = $tbl_results['date'] . $tbl_results['heure'] . $commune;
                        $tbl_results['hash']          = sha1($concat);
                        $tbl_results['id']            = null;
                        $tbl_results["sent"]          = 0;
                        $tbl_results["need_to_send"]  = 1;
                        $logger->info(json_encode($tbl_results));
                        $sqlManager->insertIfAbsent("evenements", $tbl_results, ["hash" => $tbl_results['hash']]);
                    }
                }
            }
        }
    }
    echo trim(json_encode(["erreur" => 0]));
} catch (Exception $e) {
    $logger->error("Erreur lors du traitement des fichiers Excel", [
        'error' => $e->getMessage(),
    ]);

    $vars['excel_error'] = $e->getMessage();
}

function getInfosFromCategorie($categorie)
{
    global $sqlManager;
    $sql  = "select id,send from categories where upper(categorie) LIKE upper(:categorie)";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute([':categorie' => $categorie]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($results) > 0) {
        return $results[0];
    } else {
        return null;
    }
}

function getInfosFromCities($commune)
{
    global $sqlManager;
    global $config;
    $sql = "SELECT id FROM cities
WHERE
(
  UPPER(
    REPLACE(
      REPLACE(name, 'STE', 'SAINTE'),
      'ST', 'SAINT'
    )
  ) LIKE UPPER(
    REPLACE(
      REPLACE(:commune, 'STE', 'SAINTE'),
      'ST', 'SAINT'
    )
  )
OR
  UPPER(
    REPLACE(
      REPLACE(old_name, 'STE', 'SAINTE'),
      'ST', 'SAINT'
    )
  ) LIKE UPPER(
    REPLACE(
      REPLACE(:commune, 'STE', 'SAINTE'),
      'ST', 'SAINT'
    )
  )
)
AND insee LIKE :dpt;";
    $stmt = $sqlManager->prepare($sql);
    $dpt  = sprintf("%s___", $config->get("CITY_DEPARTMENT"));
    $stmt->execute([':commune' => $commune, ':dpt' => $dpt]);
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if (count($results) > 0) {
        return $results[0];
    } else {
        return null;
    }
}
