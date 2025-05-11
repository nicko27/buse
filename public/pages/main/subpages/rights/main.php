<?php

$sql  = "SELECT * FROM rights";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['rights_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
