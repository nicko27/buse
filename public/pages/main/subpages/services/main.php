<?php

if (!$rightsManager->isAdmin()) {
    exit(1);
}
// Récupération des services
$sql  = "SELECT * FROM services ORDER BY invisible ASC, name ASC";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['services_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
