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
        $data                     = $_POST;
        $send_data                = [];
        $send_data['code_postal'] = $data['code_postal'];
        $send_data['unit_id']     = $data['brigade'];
        $send_data['maire']       = $data['maire'];
        $send_data['mail']        = $data['mail'];
        $table                    = "mairies";
        $returnValue              = $sqlManager->update($table, $send_data, "code_postal=:cp", ["cp" => $send_data['code_postal']]);
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
