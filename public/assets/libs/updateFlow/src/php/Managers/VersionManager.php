<?php
declare(strict_types=1);

namespace UpdateFlow\Managers;

use UpdateFlow\Utils\Logger;
use UpdateFlow\Exceptions\VersionException;

/**
 * Gestionnaire des versions
 */
class VersionManager
{
    public const FORMAT_JSON = 'json';
    public const FORMAT_TEXT = 'text';

    private string $versionPath;
    private string $versionFormat;
    private Logger $logger;
    private ?string $currentVersion = null;

    public function __construct(
        string $versionPath,
        string $versionFormat = self::FORMAT_JSON,
        Logger $logger
    ) {
        $this->versionPath = $versionPath;
        $this->versionFormat = $versionFormat;
        $this->logger = $logger;
    }

    /**
     * Récupère la version actuelle
     * 
     * @return string
     * @throws VersionException
     */
    public function getVersion(): string
    {
        if ($this->currentVersion !== null) {
            return $this->currentVersion;
        }

        if (!file_exists($this->versionPath)) {
            throw new VersionException("Version file not found: {$this->versionPath}");
        }

        $content = file_get_contents($this->versionPath);
        if ($content === false) {
            throw new VersionException("Failed to read version file");
        }

        if ($this->versionFormat === self::FORMAT_JSON) {
            $data = json_decode($content, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                throw new VersionException("Invalid JSON in version file");
            }
            if (!isset($data['version'])) {
                throw new VersionException("No version field in JSON");
            }
            $this->currentVersion = $data['version'];
        } else {
            $this->currentVersion = trim($content);
        }

        $this->logger->debug("Current version: {$this->currentVersion}");
        return $this->currentVersion;
    }

    /**
     * Met à jour la version
     * 
     * @param string $version
     * @return bool
     * @throws VersionException
     */
    public function updateVersion(string $version): bool
    {
        if ($this->versionFormat === self::FORMAT_JSON) {
            $content = json_encode(['version' => $version], JSON_PRETTY_PRINT);
        } else {
            $content = $version;
        }

        $result = file_put_contents($this->versionPath, $content);
        if ($result === false) {
            throw new VersionException("Failed to write version file");
        }

        $this->currentVersion = $version;
        $this->logger->info("Version updated to: {$version}");
        
        return true;
    }

    /**
     * Génère une nouvelle version
     * 
     * @param string $currentVersion
     * @param string $type
     * @return string
     */
    public function generateNewVersion(string $currentVersion, string $type): string
    {
        $parts = explode('.', $currentVersion);
        if (count($parts) !== 3) {
            $parts = ['0', '0', '0'];
        }

        [$major, $minor, $patch] = array_map('intval', $parts);

        switch ($type) {
            case 'major':
                $major++;
                $minor = 0;
                $patch = 0;
                break;
            case 'minor':
                $minor++;
                $patch = 0;
                break;
            case 'patch':
            default:
                $patch++;
                break;
        }

        return implode('.', [$major, $minor, $patch]);
    }

    /**
     * Compare deux versions
     * 
     * @param string $version1
     * @param string $version2
     * @return int
     */
    public function compareVersions(string $version1, string $version2): int
    {
        return version_compare($version1, $version2);
    }
}
