<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

$id    = $_POST['id'];
$table = $_POST['table'];
if ($id == "") {
    $id = null;
}

use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$logger     = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();

try {
    if ($_POST['action'] == "delete") {
        if ($id != null) {
            $returnValue = $sqlManager->delete($table, "id=" . $id);
        } else {
            $returnValue = ['error' => 0];
        }
        echo json_encode($returnValue);
        return;
    }
    if ($_POST['action'] == "addUpdate") {
        $data = $_POST;
        unset($data["action"]);
        unset($data["table"]);
        if (isset($data['id'])) {
            if ($data['id'] == "") {
                $data['id'] = null;
            }

        }
        $returnValue = $sqlManager->insertOrUpdate($table, $data, ["id" => $id]);
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
