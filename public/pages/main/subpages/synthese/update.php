<?php

require_once dirname(__DIR__, 4) . "/pages/commun/init.php";

use Commun\Config\Config;
use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$config     = Config::getInstance();
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();
try {
    if ($_POST['action'] == "addUpdate") {
        $data                      = $_POST;
        $send_data                 = [];
        $send_data['need_to_send'] = $data['need_to_send'];
        $table                     = "evenements";
        $returnValue               = $sqlManager->update($table, $send_data, "id=:id", ["id" => $data['id']]);
        echo json_encode($returnValue);
        return;
    }

} catch (PDOException $e) {
    $logger->error("Error loading main data", [
        'error' => $e->getMessage(),
        'code'  => $e->getCode(),
    ]);
    throw $e;
}
