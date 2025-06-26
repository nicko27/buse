<?php
namespace Commun\Utils;

use Commun\Config\Config;
use Commun\Logger\Logger;
use Exception;
use InvalidArgumentException;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Classe pour traiter et analyser des fichiers Excel (XLSX ou ODS)
 */
class ExcelProcessor
{
    private $logger;
    private $config;
    private $spreadsheet = null;
    private $worksheet   = null;
    private $filePath    = null;

    public function __construct()
    {
        $this->logger = Logger::getInstance()->getLogger();
        $this->config = Config::getInstance();
    }

    public function getSpreadsheetFilesInDirectory(string $directory): array
    {
        $this->logger->info("Recherche des fichiers XLSX ou ODS dans : {$directory}");

        if (! is_dir($directory)) {
            $this->logger->error("Répertoire inexistant : {$directory}");
            throw new InvalidArgumentException("Le dossier spécifié n'existe pas : {$directory}");
        }

        $spreadsheetFiles = [];
        $elements         = scandir($directory);

        foreach ($elements as $element) {
            $fullPath = $directory . DIRECTORY_SEPARATOR . $element;

            if (is_file($fullPath) && preg_match('/\.(xlsx|ods)$/i', $element)) {
                $spreadsheetFiles[] = $fullPath;
                $this->logger->debug("Fichier tableur trouvé : {$fullPath}");
            }
        }

        $this->logger->info("Nombre de fichiers tableur trouvés : " . count($spreadsheetFiles));
        return $spreadsheetFiles;
    }

    private function isOdsByExtension(string $filePath): bool
    {
        return strtolower(pathinfo($filePath, PATHINFO_EXTENSION)) === 'ods';
    }

    private function isXlsxByExtension(string $filePath): bool
    {
        return strtolower(pathinfo($filePath, PATHINFO_EXTENSION)) === 'xlsx';
    }

    public function processSpreadsheetFile(string $filePath): bool
    {
        try {
            $this->logger->info("Initialisation de l'accès au fichier : {$filePath}");

            $this->filePath = $filePath;
            if ($this->isOdsByExtension($filePath)) {
                $reader            = new \PhpOffice\PhpSpreadsheet\Reader\Ods();
                $this->spreadsheet = $reader->load($filePath);
            } else {
                $this->spreadsheet = IOFactory::load($filePath);
            }

            // Utiliser la méthode directe qui fonctionne mieux avec ODS

            $this->worksheet = $this->spreadsheet->getSheet(0);

            $this->logger->info("Accès au fichier initialisé avec succès");
            return true;

        } catch (Exception $e) {
            $this->logger->error("Erreur lors de l'initialisation du fichier", [
                'file'  => $filePath,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            $this->spreadsheet = null;
            $this->worksheet   = null;
            $this->filePath    = null;
            throw $e;
        }
    }

    public function getWorksheet(): ?Worksheet
    {
        return $this->worksheet;
    }

    public function getSpreadsheet(): ?Spreadsheet
    {
        return $this->spreadsheet;
    }

    public function getFilePath(): ?string
    {
        return $this->filePath;
    }

    public function getColsCoordinates(array $columnList)
    {
        $worksheet = $this->getWorksheet();

        if (! $worksheet) {
            $this->logger->error("Aucune feuille de calcul initialisée");
            throw new Exception("Aucune feuille de calcul initialisée");
        }

        $filePath = $this->getFilePath();
        $this->logger->info("Détection de colonnes dans le fichier : {$filePath}");
        // Convertir chaque entrée en expression régulière
        $regexList = [];
        foreach ($columnList as $key => $searchString) {
            $regexList[$key] = $this->convertToRegex($searchString);
        }
        $columnCount = 0;
        $results     = [];

        foreach ($worksheet->getRowIterator() as $row) {
            $cellIterator = $row->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false);

            foreach ($cellIterator as $cell) {
                $coord     = $cell->getCoordinate();
                $cellValue = $cell->getCalculatedValue();

                if ($cellValue != null) {
                    foreach ($regexList as $key => $regex) {
                        if (preg_match($regex, $cellValue)) {

                            $results[$key] = [
                                "excel" => $coord,
                                "col"   => $this->getColumnLetter($coord),
                                "row"   => $this->getNumRow($coord),
                            ];
                            $columnCount++;
                            $this->logger->debug("Colonne trouvée avec alternative : {$columnList[$key]} à la position {$coord}");
                        }

                    }
                }

            }

            if ($columnCount > 0) {
                $this->logger->info("Colonnes trouvées : {$columnCount} sur " . count($columnList));

                if ($columnCount === count($columnList)) {
                    return $results;
                } else {
                    $this->logger->warning("Nombre incorrect de colonnes trouvées");
                    return [];
                }
            }
        }
        return [];
    }

    /**
     * Convertit une chaîne de recherche avec alternatives en expression régulière
     *
     * @param string $searchString Chaîne avec alternatives séparées par |
     * @return string Expression régulière
     */
    private function convertToRegex(string $searchString): string
    {
        // Échapper les caractères spéciaux regex, sauf le pipe (|)
        $escapedString = str_replace(
            ['\\', '.', '+', '*', '?', '[', '^', ']', '$', '(', ')', '{', '}', '=', '!', '<', '>', ':', '-'],
            ['\\\\', '\\.', '\\+', '\\*', '\\?', '\\[', '\\^', '\\]', '\\$', '\\(', '\\)', '\\{', '\\}', '\\=', '\\!', '\\<', '\\>', '\\:', '\\-'],
            $searchString
        );

        // Transformer les alternatives séparées par | en alternatives regex
        $alternatives        = explode('|', $escapedString);
        $escapedAlternatives = array_map('trim', $alternatives);

        // Construire l'expression régulière finale (insensible à la casse)
        return '/^(' . implode('|', $escapedAlternatives) . ')$/i';
    }

    public function getRow(int $rowNumber): array
    {
        if (! $this->worksheet) {
            $this->logger->error("Aucune feuille de calcul initialisée pour lecture de ligne.");
            throw new Exception("Aucune feuille de calcul initialisée");
        }

        $highestColumn      = $this->worksheet->getHighestColumn($rowNumber);
        $highestColumnIndex = Coordinate::columnIndexFromString($highestColumn);
        $result             = [];

        for ($col = 1; $col <= $highestColumnIndex; $col++) {
            $cell                  = $this->getCellByColumnAndRow($col, $rowNumber);
            $columnLetter          = Coordinate::stringFromColumnIndex($col);
            $result[$col]          = $this->worksheet->getCell($cell)->getFormattedValue();
            $result[$columnLetter] = $result[$col];
        }

        return $result;
    }

    public function getCellByColumnAndRow(int $columnIndex, int $rowIndex): string
    {
        $columnLetter = Coordinate::stringFromColumnIndex($columnIndex);
        return $columnLetter . $rowIndex;
    }

    public function getMaxRowCount(): int
    {
        if (! $this->worksheet) {
            $this->logger->error("Aucune feuille de calcul initialisée pour obtenir le nombre de lignes.");
            throw new Exception("Aucune feuille de calcul initialisée");
        }

        return $this->worksheet->getHighestRow();
    }

    public function getNumRow(string $coord): int
    {
        if (! preg_match('/^[A-Z]+(\d+)$/i', $coord, $matches)) {
            $this->logger->error("Coordonnée invalide pour extraction de ligne : '$coord'");
            throw new InvalidArgumentException("Coordonnée Excel invalide : '$coord'");
        }

        return (int) $matches[1];
    }

    public function getColumnLetter(string $coord): string
    {
        if (! preg_match('/^([A-Z]+)\d+$/i', $coord, $matches)) {
            $this->logger->error("Coordonnée invalide pour extraction de colonne : '$coord'");
            throw new InvalidArgumentException("Coordonnée Excel invalide : '$coord'");
        }

        return strtoupper($matches[1]);
    }
}
