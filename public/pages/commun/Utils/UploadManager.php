<?php
namespace Commun\Utils;

use Commun\Logger\Logger;

class UploadManager
{
    private static $instance = null;
    private $logger;

    private function __construct()
    {
        $this->logger = Logger::getInstance()->getLogger();
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    /**
     * Normalise un nom de fichier en supprimant les accents, espaces et caractères spéciaux
     *
     * @param string $filename Le nom de fichier à normaliser
     * @return string Le nom de fichier normalisé
     */
    private function normalizeFilename(string $filename): string
    {
        // Séparer le nom du fichier de son extension
        $pathInfo  = pathinfo($filename);
        $name      = $pathInfo['filename'];
        $extension = isset($pathInfo['extension']) ? '.' . $pathInfo['extension'] : '';

        // Translittération des caractères accentués
        $name = transliterator_transliterate('Any-Latin; Latin-ASCII; [:Nonspacing Mark:] Remove; [:Punctuation:] Remove; Lower()', $name);

        // Remplacer les espaces par des tirets
        $name = str_replace(' ', '-', $name);

        // Supprimer les caractères non alphanumériques restants
        $name = preg_replace('/[^a-z0-9\-_]/', '', $name);

        // Éviter les tirets multiples
        $name = preg_replace('/-+/', '-', $name);

        // Ajouter l'extension et retourner le nom normalisé
        return $name . $extension;
    }

    /**
     * Gère l'upload d'un fichier
     *
     * @param array $file Le fichier uploadé ($_FILES['file'])
     * @param string $destination Chemin de destination
     * @param array $allowedTypes Types MIME autorisés
     * @param int $maxSize Taille maximale en octets
     * @param bool $normalizeFilename Si vrai, normalise le nom du fichier
     * @return array Résultat de l'opération
     */
    public function handleUpload(array $file, string $destination, array $allowedTypes = [], int $maxSize = 0, bool $normalizeFilename = false): array
    {
        $error        = 0;
        $msgError     = "";
        $uploadedFile = "";

        try {
            // Vérifications de base
            if (! isset($file['tmp_name']) || ! is_uploaded_file($file['tmp_name'])) {
                throw new \Exception("Fichier invalide");
            }

            // Vérifier le type MIME
            if (! empty($allowedTypes)) {
                $finfo    = finfo_open(FILEINFO_MIME_TYPE);
                $mimeType = finfo_file($finfo, $file['tmp_name']);
                finfo_close($finfo);

                if (! in_array($mimeType, $allowedTypes)) {
                    throw new \Exception("Type de fichier non autorisé");
                }
            }

            // Vérifier la taille
            if ($maxSize > 0 && $file['size'] > $maxSize) {
                throw new \Exception("Fichier trop volumineux");
            }

            // Créer le répertoire de destination si nécessaire
            FileUtils::makeDir(dirname($destination));

            // Normaliser le nom du fichier si demandé
            $filename = $normalizeFilename ? $this->normalizeFilename($file['name']) : basename($file['name']);

            $finalPath = $destination . '/' . $filename;

            // Déplacer le fichier
            if (! move_uploaded_file($file['tmp_name'], $finalPath)) {
                throw new \Exception("Erreur lors du déplacement du fichier");
            }

            $uploadedFile = $finalPath;

        } catch (\Exception $e) {
            $error    = 1;
            $msgError = $e->getMessage();
            $this->logger->error("Erreur upload", [
                'file'        => $file['name'],
                'destination' => $destination,
                'error'       => $msgError,
            ]);
        }

        return [
            'error'        => $error,
            'msgError'     => $msgError,
            'uploadedFile' => $uploadedFile,
        ];
    }

    /**
     * Gère l'upload de plusieurs fichiers
     *
     * @param array $files Les fichiers uploadés ($_FILES['files'])
     * @param string $destinationDir Répertoire de destination
     * @param array $allowedTypes Types MIME autorisés
     * @param int $maxSize Taille maximale en octets
     * @param bool $normalizeFilename Si vrai, normalise les noms des fichiers
     * @return array Résultat de l'opération
     */
    public function handleMultipleUploads(array $files, string $destinationDir, array $allowedTypes = [], int $maxSize = 0, bool $normalizeFilename = false): array
    {
        $results  = [];
        $error    = 0;
        $msgError = "";

        foreach ($files['tmp_name'] as $key => $tmpName) {
            $file = [
                'name'     => $files['name'][$key],
                'type'     => $files['type'][$key],
                'tmp_name' => $tmpName,
                'error'    => $files['error'][$key],
                'size'     => $files['size'][$key],
            ];

            // Créer le chemin de destination
            $destination = $destinationDir;

            $result = $this->handleUpload($file, $destination, $allowedTypes, $maxSize, $normalizeFilename);

            if ($result['error']) {
                $error = 1;
                $msgError .= $result['msgError'] . " ";
            }

            $results[] = $result;
        }

        return [
            'error'    => $error,
            'msgError' => trim($msgError),
            'results'  => $results,
        ];
    }
}
