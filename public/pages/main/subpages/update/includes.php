<?php
// Inclure les fichiers UpdateFlow nécessaires
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Exceptions/UpdateFlowException.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Exceptions/GitException.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Exceptions/VersionException.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Utils/Response.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Utils/Logger.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Utils/Security.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Managers/GitManager.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/Managers/VersionManager.php';
require_once ASSETS_DIR . '/libs/updateFlow/src/php/UpdateFlow.php';
