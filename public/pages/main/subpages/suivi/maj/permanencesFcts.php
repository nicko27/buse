<?php
use PhpOffice\PhpSpreadsheet\IOFactory;
use Commun\Database\SqlManager;


$sqlManager = SqlManager::getInstance();
/**
 * Fonction pour lire un fichier ODS et extraire les données des premières colonnes
 *
 * @param string $filePath Chemin vers le fichier ODS
 * @return array Tableau associatif contenant les données extraites
 */
function scrapOds($filePath)
{
    global $sqlManager;
    // Charger le fichier ODS
    $spreadsheet = IOFactory::load($filePath);

    // Obtenir la première feuille
    $sheet = $spreadsheet->getSheet(0);

    // Initialiser un tableau pour stocker les données
    $dataArray = [];

    // Parcourir les lignes de la feuille
    foreach ($sheet->getRowIterator() as $row) {
        $cellIterator = $row->getCellIterator();
        $cellIterator->setIterateOnlyExistingCells(false);

        $rowData = [];
        $pos     = 0;
        foreach ($cellIterator as $cell) {
            $pos++;
            if ($pos <= 3) {
                $rowData[] = $cell->getCalculatedValue();
            }
        }

        // Ajouter les trois premières colonnes au tableau de données
        if (count($rowData) >= 3) {
            if ((strlen($rowData[0]) > 0) && (strlen($rowData[1]) > 0) && (strlen($rowData[2]) > 0)) {
                $data = [
                    'poste' => $rowData[0],
                    'nom'   => $rowData[1],
                    'tph'   => $rowData[2],
                ];
                $sqlManager->insert("permanences", $data);
            }
        }
    }
}

/**
 * Fonction pour traiter tous les fichiers ODS dans un répertoire spécifié
 *
 * @param string $directory Chemin vers le répertoire contenant les fichiers ODS
 * @return array Tableau associatif contenant les données de tous les fichiers ODS
 */
function processOdsFilesInDirectory($directory)
{
    if (!is_dir($directory)) {
        throw new InvalidArgumentException("Le chemin spécifié n'est pas un dossier valide.");
    }

    $allData = [];
    $files   = scandir($directory);
    foreach ($files as $file) {
        if (pathinfo($file, PATHINFO_EXTENSION) === 'ods') {
            $filePath = $directory . DIRECTORY_SEPARATOR . $file;
            scrapOds($filePath);
        }
    }
}
