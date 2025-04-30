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
 * Classe pour traiter et analyser des fichiers Excel XLSX
 */
class ExcelProcessor
{
    private $logger;
    private $config;
    private $spreadsheet = null;
    private $worksheet   = null;
    private $filePath    = null;

    /**
     * Constructeur avec injection des dépendances
     */
    public function __construct()
    {
        $this->logger = Logger::getInstance()->getLogger();
        $this->config = Config::getInstance();
    }

    /**
     * Parcourt tous les fichiers .xlsx dans un répertoire donné.
     *
     * @param string $directory Chemin absolu ou relatif vers le dossier à analyser.
     * @return array Liste des chemins complets des fichiers .xlsx trouvés.
     * @throws InvalidArgumentException Si le répertoire n'existe pas
     */
    public function getXlsxFilesInDirectory(string $directory): array
    {
        $this->logger->info("Recherche des fichiers XLSX dans : {$directory}");

        if (! is_dir($directory)) {
            $this->logger->error("Répertoire inexistant : {$directory}");
            throw new InvalidArgumentException("Le dossier spécifié n'existe pas : {$directory}");
        }

        $xlsxFiles = [];
        $elements  = scandir($directory);

        foreach ($elements as $element) {
            $fullPath = $directory . DIRECTORY_SEPARATOR . $element;

            if (is_file($fullPath) && preg_match('/\.xlsx$/i', $element)) {
                $xlsxFiles[] = $fullPath;
                $this->logger->debug("Fichier XLSX trouvé : {$fullPath}");
            }
        }

        $this->logger->info("Nombre de fichiers XLSX trouvés : " . count($xlsxFiles));
        return $xlsxFiles;
    }

    /**
     * Calcule la cellule située juste en dessous d'une coordonnée donnée
     *
     * @param string $coordinate Coordonnée Excel (ex: "A1", "B3")
     * @return string Coordonnée de la cellule en dessous (ex: "A2", "B4")
     * @throws InvalidArgumentException Si la coordonnée est invalide
     */
    public function getCellBelow(string $coordinate): string
    {
        if (! preg_match('/^([A-Z]+)(\d+)$/i', $coordinate, $matches)) {
            $this->logger->error("Coordonnée Excel invalide : '{$coordinate}'");
            throw new InvalidArgumentException("Coordonnée Excel invalide : '{$coordinate}'");
        }

        $column = strtoupper($matches[1]);
        $row    = (int) $matches[2];
        $newRow = $row + 1;

        return $column . $newRow;
    }

    /**
     * Initialise l'accès à un fichier XLSX
     *
     * @param string $filePath Chemin vers le fichier XLSX
     * @return bool True si l'initialisation est réussie, false sinon
     * @throws Exception En cas d'erreur lors de l'initialisation
     */
    public function processXlsxFile(string $filePath): bool
    {
        try {
            $this->logger->info("Initialisation de l'accès au fichier : {$filePath}");

            $this->filePath    = $filePath;
            $this->spreadsheet = IOFactory::load($filePath);
            $this->worksheet   = $this->spreadsheet->getActiveSheet();

            $this->logger->info("Accès au fichier initialisé avec succès");
            return true;

        } catch (Exception $e) {
            $this->logger->error("Erreur lors de l'initialisation du fichier XLSX", [
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

    /**
     * Récupère la feuille de calcul active
     *
     * @return Worksheet|null La feuille de calcul active ou null si non initialisé
     */
    public function getWorksheet(): ?Worksheet
    {
        return $this->worksheet;
    }

    /**
     * Récupère le classeur complet
     *
     * @return Spreadsheet|null Le classeur ou null si non initialisé
     */
    public function getSpreadsheet(): ?Spreadsheet
    {
        return $this->spreadsheet;
    }

    /**
     * Récupère le chemin du fichier actuel
     *
     * @return string|null Le chemin du fichier ou null si non initialisé
     */
    public function getFilePath(): ?string
    {
        return $this->filePath;
    }

    public function getColsCoordonates(array $columnList)
    {
        $worksheet = $this->getWorksheet();

        if (! $worksheet) {
            $this->logger->error("Aucune feuille de calcul initialisée");
            throw new Exception("Aucune feuille de calcul initialisée");
        }

        $filePath = $this->getFilePath();
        $this->logger->info("Détection de colonnes dans le fichier : {$filePath}");

        $columnCount = 0;

        $results = [];

        // Parcourir les lignes et les colonnes
        foreach ($worksheet->getRowIterator() as $row) {
            $cellIterator = $row->getCellIterator();
            $cellIterator->setIterateOnlyExistingCells(false); // inclure les cellules vides

            foreach ($cellIterator as $cell) {
                $cellValue = $cell->getValue();

                foreach ($columnList as $key => $column) {
                    if (strcmp($cellValue, $column) == 0) {
                        if ($column != null) {
                            $coord         = $cell->getCoordinate();
                            $results[$key] = ["excel" => $coord, "col" => $this->getColumnLetter($coord), "row" => $this->getNumRow($coord)];
                            $columnCount++;
                        }
                    }

                    $this->logger->debug("Colonne trouvée : {$column} à la position {$cell->getCoordinate()}");
                }
            }
            // Si toutes les colonnes ont été trouvées, retourner les résultats
            if ($columnCount > 0) {
                $this->logger->info("Colonnes trouvées : {$columnCount} sur " . count($columnList));

                if ($columnCount == count($columnList)) {
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
     * Récupère toutes les cellules d'une ligne donnée (indexée par lettres de colonnes)
     *
     * @param int $rowNumber Numéro de ligne Excel (1-indexé)
     * @return array<string, mixed> Tableau associatif colonne => valeur
     * @throws Exception Si la feuille de calcul n'est pas initialisée
     */
    public function getRow(int $rowNumber): array
    {
        if (! $this->worksheet) {
            $this->logger->error("Aucune feuille de calcul initialisée pour lecture de ligne.");
            throw new Exception("Aucune feuille de calcul initialisée");
        }

        $highestColumn      = $this->worksheet->getHighestColumn($rowNumber);    // ex: 'G'
        $highestColumnIndex = Coordinate::columnIndexFromString($highestColumn); // ex: 7
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
        $columnLetter = Coordinate::stringFromColumnIndex($columnIndex); // ex: 2 → B
        return $columnLetter . $rowIndex;

    }

    /**
     * Retourne le nombre total de lignes contenant des données dans la feuille active
     *
     * @return int Numéro de la dernière ligne utilisée
     * @throws Exception Si la feuille de calcul n'est pas initialisée
     */
    public function getMaxRowCount(): int
    {
        if (! $this->worksheet) {
            $this->logger->error("Aucune feuille de calcul initialisée pour obtenir le nombre de lignes.");
            throw new Exception("Aucune feuille de calcul initialisée");
        }

        return $this->worksheet->getHighestRow();
    }

    /**
     * Extrait le numéro de ligne d'une coordonnée Excel (ex: "B12" → 12)
     *
     * @param string $coord Coordonnée Excel
     * @return int Numéro de ligne
     * @throws InvalidArgumentException Si la coordonnée est invalide
     */
    public function getNumRow(string $coord): int
    {
        if (! preg_match('/^[A-Z]+(\d+)$/i', $coord, $matches)) {
            $this->logger->error("Coordonnée invalide pour extraction de ligne : '$coord'");
            throw new InvalidArgumentException("Coordonnée Excel invalide : '$coord'");
        }

        return (int) $matches[1];
    }

    /**
     * Extrait la lettre de colonne d'une coordonnée Excel (ex: "B12" → "B")
     *
     * @param string $coord Coordonnée Excel
     * @return string Lettre(s) de la colonne
     * @throws InvalidArgumentException Si la coordonnée est invalide
     */
    public function getColumnLetter(string $coord): string
    {
        if (! preg_match('/^([A-Z]+)\d+$/i', $coord, $matches)) {
            $this->logger->error("Coordonnée invalide pour extraction de colonne : '$coord'");
            throw new InvalidArgumentException("Coordonnée Excel invalide : '$coord'");
        }

        return strtoupper($matches[1]);
    }

}
