<?php

namespace Commun\Utils;

class FileUtils
{
    /**
     * Crée un répertoire s'il n'existe pas
     */
    public static function makeDir(string $dir, int $rights = 0755): void
    {
        if (!is_dir($dir)) {
            mkdir($dir, $rights, true);
        }
    }

    /**
     * Nettoie les anciens fichiers en gardant un nombre spécifié
     */
    public static function cleanOlderFiles(string $dir, string $extension, int $keepedFiles): array
    {
        $ok = true;
        $msgError = "";

        try {
            $fichiers = glob($dir . "/*" . $extension);
            if (!empty($fichiers)) {
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
            $ok = false;
            $msgError = $e->getMessage();
            \Commun\Logger\Logger::getInstance()->error("Erreur lors du nettoyage des fichiers", [
                'directory' => $dir,
                'extension' => $extension,
                'error' => $msgError
            ]);
        }

        return [
            'ok' => $ok,
            'msgError' => $msgError
        ];
    }

    /**
     * Supprime les fichiers plus anciens qu'une date donnée
     */
    public static function deleteOldFiles(string $dir, \DateTime $beforeDate, array $extensions = []): array
    {
        $ok = true;
        $msgError = "";
        $deletedFiles = [];

        try {
            $timestamp = $beforeDate->getTimestamp();
            
            // Construire le pattern de recherche
            $pattern = empty($extensions) 
                ? $dir . "/*" 
                : $dir . "/*.{" . implode(",", $extensions) . "}";

            $files = glob($pattern, GLOB_BRACE);
            
            foreach ($files as $file) {
                if (is_file($file) && filemtime($file) < $timestamp) {
                    if (@unlink($file)) {
                        $deletedFiles[] = $file;
                    } else {
                        throw new \Exception("Impossible de supprimer : " . $file);
                    }
                }
            }
        } catch (\Exception $e) {
            $ok = false;
            $msgError = $e->getMessage();
            \Commun\Logger\Logger::getInstance()->error("Erreur lors de la suppression des anciens fichiers", [
                'directory' => $dir,
                'before_date' => $beforeDate->format('Y-m-d H:i:s'),
                'extensions' => $extensions,
                'error' => $msgError
            ]);
        }

        return [
            'ok' => $ok,
            'msgError' => $msgError,
            'deletedFiles' => $deletedFiles
        ];
    }
}
