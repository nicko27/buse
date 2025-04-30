<?php
require_once __DIR__ . '/../../../commun/init.php';
use Commun\Config\Config;
use Commun\Logger\Logger;
use Commun\Utils\FileListUtils;

$config = Config::getInstance();
$logger = Logger::getInstance()->getLogger();

$result = [
    'erreur'  => 0,
    'html'    => '',
    'message' => '',
];

try {
    $uploadDir = $config->get('UPLOAD_DIR');
    FileListUtils::cleanOldFiles($uploadDir, 1, ['html', 'ods']);
    $fileList = FileListUtils::listFiles($uploadDir);

    if (!$fileList['ok']) {
        throw new Exception($fileList['msgError']);
    }

    ob_start();
    if (!empty($fileList['files'])) {
        foreach ($fileList['files'] as $file) {
            $extension = strtolower(pathinfo($file['nom'], PATHINFO_EXTENSION));
            $icon      = $extension === 'html' ? 'fa-file-code' : 'fa-file-excel';
            ?>
            <div class="file__item">
                <div class="file__info">
                    <div class="file__name">
                        <i class="fas <?php echo $icon; ?>"></i>
                        <?php echo htmlspecialchars($file['nom']); ?>
                    </div>
                    <div class="file__details">
                        <span class="file__date"><?php echo $file['date'] . ' à ' . $file['heure']; ?></span>
                        <span class="file__size"><?php echo $file['taille']; ?></span>
                    </div>
                </div>
            </div>
            <?php
}
    } else {
        ?>
        <div class="no-files">
            Aucun fichier disponible
        </div>
        <?php
}
    $result['html'] = ob_get_clean();

} catch (Exception $e) {
    $result['erreur']  = 1;
    $result['message'] = $e->getMessage();
    $logger->error("Erreur dans la liste des fichiers", [
        'error' => $e->getMessage(),
    ]);
}

header('Content-Type: application/json');
echo json_encode($result);
