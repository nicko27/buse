<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";


$id = $_POST['id'];
$table= $_POST['table'];

use Commun\Database\SqlManager;
use Commun\Logger\Logger;

// Initialisation
$logger = Logger::getInstance()->getLogger();
$sqlManager = SqlManager::getInstance();

try {
    if ($_POST['action'] == "delete") {
        $returnValue= $sqlManager->delete($table,"id=" . $id);
        echo json_encode($returnValue);
        return;
    }
    if ($_POST['action']== "addUpdate"){
        $data= $_POST;
        unset($data["action"]);
        unset($data["table"]);
        $returnValue = $sqlManager->insertOrUpdate($table,$data,["id"=>$id]);
        echo json_encode($returnValue);
        return;
    }
    
} catch (PDOException $e) {
    $logger->error("Error loading main data", [
        'error' => $e->getMessage(),
        'code' => $e->getCode()
    ]);
    throw $e;
}
