<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

$returnValue = updateSql("memos", ["invisible" => 1], "id=" . $_POST["memoId"]);
echo json_encode($returnValue);
