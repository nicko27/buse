<?php

$sql  = "SELECT * FROM configuration";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['configuration_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
