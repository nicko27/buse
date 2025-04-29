<?php

use Commun\Config\Config;
use Commun\Logger\Logger;
use PhpOffice\PhpSpreadsheet\IOFactory;

$config = Config::getInstance();
$logger = Logger::getInstance()->getLogger();

/**
 * Parcourt tous les fichiers .xlsx dans un répertoire donné.
 *
 * @param string $dossier Chemin absolu ou relatif vers le dossier à analyser.
 * @return array Liste des chemins complets des fichiers .xlsx trouvés.
 */
function getXlsxFilesInDirectory(string $dossier): array
{
    $fichiersXlsx = [];

    // Vérifier que le dossier existe
    if (! is_dir($dossier)) {
        throw new InvalidArgumentException("Le dossier spécifié n'existe pas : $dossier");
    }

    // Lire le contenu du dossier
    $elements = scandir($dossier);

    foreach ($elements as $element) {
        $cheminComplet = $dossier . DIRECTORY_SEPARATOR . $element;

        // Vérifie que c'est un fichier et qu'il se termine par .xlsx (insensible à la casse)
        if (is_file($cheminComplet) && preg_match('/\.xlsx$/i', $element)) {
            $fichiersXlsx[] = $cheminComplet;
        }
    }

    return $fichiersXlsx;
}

function getUnderCell(string $coordonnee): string
{
    // Extraction des lettres (colonne) et des chiffres (ligne)
    if (! preg_match('/^([A-Z]+)(\d+)$/i', $coordonnee, $matches)) {
        throw new InvalidArgumentException("Coordonnée Excel invalide : '$coordonnee'");
    }

    $colonne = strtoupper($matches[1]); // ex: "B"
    $ligne   = (int) $matches[2];       // ex: 3

    $nouvelleLigne = $ligne + 1; // on descend d'une ligne

    return $colonne . $nouvelleLigne; // ex: "B4"
}

function processXlsxFile(string $file)
{
    $config            = Config::getInstance();
    $spreadsheet       = IOFactory::load($file);
    $columnCount       = 0;
    $totalColumnToFind = $config("TOTAL_COLS");
    // Accéder à la première feuille
    $feuille = $spreadsheet->getActiveSheet();
    $colList = explode("|", $config->get("COL_LIST"));
    $results = [];
    // Parcourir les lignes et les colonnes
    foreach ($feuille->getRowIterator() as $ligne) {
        $cellIterator = $ligne->getCellIterator();
        $cellIterator->setIterateOnlyExistingCells(false); // inclure les cellules vides
        foreach ($cellIterator as $cell) {
            foreach ($colList as $col) {
                if ($cell->getValue() == $config->get("DATE_COL")) {
                    $results[$col] = $cell->getCoordinate();
                    $columnCount += 1;
                }
            }
            if ($columnCount > 0) {
                if ($columnCount == sizeof($colList)) {
                    return $colList;
                } else {
                    return [];
                }

            } else {
                return [];
            }
        }

    }

}

function processXlsxFilesInDirectory(string $directory)
{
// Exemple d'utilisation
    try {
        $fichiers = getXlsxFilesInDirectory($directory);

        foreach ($fichiers as $fichier) {
            processXlsxFile($fichier);
        }
    } catch (Exception $e) {
        echo "Erreur : " . $e->getMessage();
    }
}

processXlsxFilesInDirectory($config->get("UPLOAD_DIR"));
