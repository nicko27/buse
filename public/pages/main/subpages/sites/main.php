<?php

// Récupération des sites
$sql  = "SELECT * FROM sites";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['sites_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
