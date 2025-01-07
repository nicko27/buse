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

    public function handleUpload(array $file, string $destination, array $allowedTypes = [], int $maxSize = 0): array
    {
        $error = 0;
        $msgError = "";
        $uploadedFile = "";

        try {
            // Vérifications de base
            if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
                throw new \Exception("Fichier invalide");
            }

            // Vérifier le type MIME
            if (!empty($allowedTypes)) {
                $finfo = finfo_open(FILEINFO_MIME_TYPE);
                $mimeType = finfo_file($finfo, $file['tmp_name']);
                finfo_close($finfo);

                if (!in_array($mimeType, $allowedTypes)) {
                    throw new \Exception("Type de fichier non autorisé");
                }
            }

            // Vérifier la taille
            if ($maxSize > 0 && $file['size'] > $maxSize) {
                throw new \Exception("Fichier trop volumineux");
            }

            // Créer le répertoire de destination si nécessaire
            FileUtils::makeDir(dirname($destination));

            $finalPath = $destination . '/' . basename($file['name']);

            // Déplacer le fichier
            if (!move_uploaded_file($file['tmp_name'], $finalPath)) {
                throw new \Exception("Erreur lors du déplacement du fichier");
            }

            $uploadedFile = $finalPath;

        } catch (\Exception $e) {
            $error = 1;
            $msgError = $e->getMessage();
            $this->logger->error("Erreur upload", [
                'file' => $file['name'],
                'destination' => $destination,
                'error' => $msgError
            ]);
        }

        return [
            'error' => $error,
            'msgError' => $msgError,
            'uploadedFile' => $uploadedFile
        ];
    }

    public function handleMultipleUploads(array $files, string $destinationDir, array $allowedTypes = [], int $maxSize = 0): array
    {
        $results = [];
        $error = 0;
        $msgError = "";

        foreach ($files['tmp_name'] as $key => $tmpName) {
            $file = [
                'name' => $files['name'][$key],
                'type' => $files['type'][$key],
                'tmp_name' => $tmpName,
                'error' => $files['error'][$key],
                'size' => $files['size'][$key]
            ];

            $destination = $destinationDir . '/' . $files['name'][$key];
            $result = $this->handleUpload($file, $destination, $allowedTypes, $maxSize);

            if ($result['error']) {
                $error = 1;
                $msgError .= $result['msgError'] . " ";
            }

            $results[] = $result;
        }

        return [
            'error' => $error,
            'msgError' => trim($msgError),
            'results' => $results
        ];
    }
}
