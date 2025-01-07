<?php

namespace Commun\Utils;

class FileListUtils
{
    /**
     * Liste les fichiers d'un répertoire avec leurs dates et tailles
     */
    public static function listFiles(string $directory, array $extensions = ['html', 'ods']): array
    {
        $result = [
            'ok' => true,
            'msgError' => '',
            'files' => []
        ];

        try {
            if (!is_dir($directory)) {
                throw new \Exception("Le dossier spécifié n'existe pas");
            }

            // Récupérer la date d'aujourd'hui et d'hier
            $aujourdhui = new \DateTime('now', new \DateTimeZone('Europe/Paris'));
            $aujourdhuiStr = $aujourdhui->format('Y-m-d');

            $hier = clone $aujourdhui;
            $hier->sub(new \DateInterval('P1D'));
            $hierStr = $hier->format('Y-m-d');

            // Construire le pattern de recherche
            $pattern = $directory . "/*.{" . implode(",", $extensions) . "}";
            $files = glob($pattern, GLOB_BRACE);

            foreach ($files as $file) {
                if (is_file($file)) {
                    $fileName = basename($file);
                    $dateModif = filemtime($file);
                    $taille = filesize($file);
                    $dateModifDate = date('Y-m-d', $dateModif);
                    $dateModifHeure = date('H:i', $dateModif);

                    // Formater la taille du fichier
                    if ($taille < 1024) {
                        $tailleFormatee = $taille . " o";
                    } elseif ($taille < 1024 * 1024) {
                        $tailleFormatee = round($taille / 1024, 2) . " Ko";
                    } else {
                        $tailleFormatee = round($taille / (1024 * 1024), 2) . " Mo";
                    }

                    // Déterminer le libellé de la date
                    if ($dateModifDate == $aujourdhuiStr) {
                        $dateLabel = "aujourd'hui";
                    } elseif ($dateModifDate == $hierStr) {
                        $dateLabel = 'hier';
                    } else {
                        $dateObj = \DateTime::createFromFormat('Y-m-d', $dateModifDate);
                        $dateLabel = $dateObj->format('d/m/Y');
                    }

                    $result['files'][] = [
                        'nom' => $fileName,
                        'chemin' => $file,
                        'date' => $dateLabel,
                        'heure' => $dateModifHeure,
                        'taille' => $tailleFormatee,
                        'timestamp' => $dateModif
                    ];
                }
            }

            // Trier les fichiers par date de modification (plus récent en premier)
            usort($result['files'], function($a, $b) {
                return $b['timestamp'] - $a['timestamp'];
            });

        } catch (\Exception $e) {
            $result['ok'] = false;
            $result['msgError'] = $e->getMessage();
            \Commun\Logger\Logger::getInstance()->error("Erreur lors de la liste des fichiers", [
                'directory' => $directory,
                'extensions' => $extensions,
                'error' => $result['msgError']
            ]);
        }

        return $result;
    }

    /**
     * Supprime les fichiers plus vieux que X jours dans un répertoire
     * 
     * @param string $directory Chemin du répertoire
     * @param int $days Nombre de jours avant suppression
     * @param array $extensions Extensions de fichiers à traiter (par défaut html et ods)
     * @return array Résultat de l'opération avec les fichiers supprimés
     */
    public static function cleanOldFiles(string $directory, int $days, array $extensions = ['html', 'ods']): array
    {
        $result = [
            'ok' => true,
            'msgError' => '',
            'filesDeleted' => [],
            'countDeleted' => 0
        ];

        try {
            if (!is_dir($directory)) {
                throw new \Exception("Le dossier spécifié n'existe pas");
            }

            // Calculer la date limite
            $now = new \DateTime('now', new \DateTimeZone('Europe/Paris'));
            $limitDate = $now->sub(new \DateInterval("P{$days}D"));
            $limitTimestamp = $limitDate->getTimestamp();

            // Construire le pattern de recherche
            $pattern = $directory . "/*.{" . implode(",", $extensions) . "}";
            $files = glob($pattern, GLOB_BRACE);

            foreach ($files as $file) {
                if (is_file($file)) {
                    $dateModif = filemtime($file);
                    
                    // Si le fichier est plus vieux que la date limite
                    if ($dateModif < $limitTimestamp) {
                        $fileName = basename($file);
                        
                        // Tentative de suppression
                        if (unlink($file)) {
                            $result['filesDeleted'][] = [
                                'nom' => $fileName,
                                'chemin' => $file,
                                'date' => date('Y-m-d H:i:s', $dateModif)
                            ];
                            $result['countDeleted']++;
                        } else {
                            \Commun\Logger\Logger::getInstance()->warning("Impossible de supprimer le fichier", [
                                'file' => $file,
                                'date' => date('Y-m-d H:i:s', $dateModif)
                            ]);
                        }
                    }
                }
            }

        } catch (\Exception $e) {
            $result['ok'] = false;
            $result['msgError'] = $e->getMessage();
            \Commun\Logger\Logger::getInstance()->error("Erreur lors du nettoyage des vieux fichiers", [
                'directory' => $directory,
                'days' => $days,
                'extensions' => $extensions,
                'error' => $result['msgError']
            ]);
        }

        return $result;
    }
}
