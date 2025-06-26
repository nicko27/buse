<?php
namespace Commun\Utils;

class FileUtils
{
    /**
     * Crée un répertoire s'il n'existe pas
     */
    public static function makeDir(string $dir, int $rights = 0755): void
    {
        if (! is_dir($dir)) {
            mkdir($dir, $rights, true);
        }
    }

    /**
     * Nettoie les anciens fichiers en gardant un nombre spécifié
     */
    public static function cleanOlderFiles(string $dir, string $extension, int $keepedFiles): array
    {
        $ok       = true;
        $msgError = "";

        try {
            $fichiers = glob($dir . "/*" . $extension);
            if (! empty($fichiers)) {
                array_multisort(array_map('filemtime', $fichiers), SORT_NUMERIC, SORT_DESC, $fichiers);
                $nb_fic = count($fichiers);

                if ($nb_fic >= $keepedFiles) {
                    for ($i = $keepedFiles; $i < $nb_fic; $i++) {
                        if (@unlink(realpath($fichiers[$i])) !== true) {
                            throw new \Exception('Impossible de supprimer ' . $fichiers[$i]);
                        }
                    }
                }
            }
        } catch (\Exception $e) {
            $ok       = false;
            $msgError = $e->getMessage();
            \Commun\Logger\Logger::getInstance()->error("Erreur lors du nettoyage des fichiers", [
                'directory' => $dir,
                'extension' => $extension,
                'error'     => $msgError,
            ]);
        }

        return [
            'ok'       => $ok,
            'msgError' => $msgError,
        ];
    }

    /**
     * Supprime les fichiers plus anciens qu'une date donnée
     *
     * @param string $dir Le répertoire contenant les fichiers à supprimer
     * @param \DateTime $beforeDate Date limite avant laquelle les fichiers seront supprimés
     * @param array $extensions Liste des extensions de fichiers à considérer (optionnel)
     * @return array Tableau associatif contenant le statut de l'opération et la liste des fichiers supprimés
     */
    public static function deleteOldFiles(string $dir, \DateTime $beforeDate, array $extensions = []): array
    {
        $ok           = true;
        $msgError     = "";
        $deletedFiles = [];

        try {
            // Validation du répertoire
            if (! is_dir($dir)) {
                throw new \Exception("Le répertoire n'existe pas : " . $dir);
            }

            if (! is_readable($dir)) {
                throw new \Exception("Le répertoire n'est pas lisible : " . $dir);
            }

            $timestamp = $beforeDate->getTimestamp();

            // Construire le pattern de recherche correctement
            if (empty($extensions)) {
                $pattern = $dir . "/*";
            } else {
                // Correction du pattern pour GLOB_BRACE
                $pattern = $dir . "/*.{" . implode(",", $extensions) . "}";
            }

            $files = glob($pattern, GLOB_BRACE);

            // Vérifier si glob() a retourné une erreur
            if ($files === false) {
                throw new \Exception("Erreur lors de la recherche des fichiers");
            }

            foreach ($files as $file) {
                if (is_file($file) && filemtime($file) < $timestamp) {
                    // Suppression du @ pour une meilleure gestion des erreurs
                    if (unlink($file)) {
                        $deletedFiles[] = $file;
                    } else {
                        throw new \Exception("Impossible de supprimer : " . $file);
                    }
                }
            }
        } catch (\Exception $e) {
            $ok       = false;
            $msgError = $e->getMessage();
            \Commun\Logger\Logger::getInstance()->error("Erreur lors de la suppression des anciens fichiers", [
                'directory'   => $dir,
                'before_date' => $beforeDate->format('Y-m-d H:i:s'),
                'extensions'  => $extensions,
                'error'       => $msgError,
            ]);
        }

        return [
            'ok'           => $ok,
            'msgError'     => $msgError,
            'deletedFiles' => $deletedFiles,
        ];
    }

    /**
     * Rend une chaîne arbitraire sûre pour un nom de fichier.
     *
     * - Translitère les caractères Unicode vers ASCII.
     * - Remplace les caractères interdits par un tiret bas.
     * - Remplace les espaces par un underscore.
     * - Supprime les points en début et fin de chaîne.
     * - Tronque à 255 caractères.
     * - Gère les noms réservés Windows.
     *
     * @param string $input Chaîne d'entrée
     * @return string Nom de fichier validé et nettoyé
     */
    public static function sanitizeFileName(string $input): string
    {
        // 1. Translittération Unicode → ASCII si possible
        if (\function_exists('transliterator_transliterate')) {
            $input = transliterator_transliterate('Any-Latin; Latin-ASCII', $input);
        } else {
            // Fallback rudimentaire : suppression des accents courants
            $accents = ['À', 'Á', 'Â', 'Ã', 'Ä', 'Å', 'Ç', 'È', 'É', 'Ê', 'Ë', 'Ì', 'Í', 'Î', 'Ï', 'Ñ', 'Ò', 'Ó', 'Ô', 'Õ', 'Ö', 'Ù', 'Ú', 'Û', 'Ü', 'Ý', 'à', 'á', 'â', 'ã', 'ä', 'å', 'ç', 'è', 'é', 'ê', 'ë', 'ì', 'í', 'î', 'ï', 'ñ', 'ò', 'ó', 'ô', 'õ', 'ö', 'ù', 'ú', 'û', 'ü', 'ý', 'ÿ'];
            $sans    = ['A', 'A', 'A', 'A', 'A', 'A', 'C', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I', 'N', 'O', 'O', 'O', 'O', 'O', 'U', 'U', 'U', 'U', 'Y', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i', 'n', 'o', 'o', 'o', 'o', 'o', 'u', 'u', 'u', 'u', 'y', 'y'];
            $input   = \str_replace($accents, $sans, $input);
        }

        // 2. Remplacer les espaces et tabulations par underscore
        $input = \preg_replace('/[\\s]+/u', '_', $input) ?? '';

        // 3. Supprimer ou remplacer les caractères interdits
        // Windows interdit \ / : * ? " < > | et les codes de contrôle < 32
        $input = \preg_replace('/[\\\\\\/\\:\\*\\?\\"\\<\\>\\|\\x00-\\x1F]+/', '_', $input) ?? '';

        // 4. Supprimer les points en début ou fin de chaîne
        $input = \trim($input, " .");

        // 5. Gérer les noms réservés Windows (CON, PRN, AUX, NUL, COM1…COM9, LPT1…LPT9)
        $upper    = \strtoupper($input);
        $reserved = [
            'CON', 'PRN', 'AUX', 'NUL',
            'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
            'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
        ];
        if (\in_array($upper, $reserved, true)) {
            $input = "_{$input}";
        }

        // 6. Tronquer la longueur à 255 caractères (sauf extension, si présente)
        $maxLength = 255;
        if (\strlen($input) > $maxLength) {
            // Si contient un point pour une extension
            if (false !== $pos = \strrpos($input, '.')) {
                $name      = \substr($input, 0, $pos);
                $extension = \substr($input, $pos);
                // Garder l'extension complète
                $name  = \substr($name, 0, $maxLength-\strlen($extension));
                $input = $name . $extension;
            } else {
                $input = \substr($input, 0, $maxLength);
            }
        }

        // 7. Si la chaîne est vide à ce stade, donner un nom par défaut
        if ($input === '') {
            $input = 'unnamed_file';
        }

        return $input;
    }
}
