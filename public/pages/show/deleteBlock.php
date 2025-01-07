<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

$returnValue = updateSql("services_unites", ["invisible" => 1], "id=" . $_POST["suId"]);
echo json_encode($returnValue);
