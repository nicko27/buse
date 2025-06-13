<?php

if (! $rightsManager->isAdmin()) {
    exit(1);
}
$sql  = "SELECT * FROM configuration";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['configuration_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
$sql                       = "SELECT * FROM configuration_types";
$stmt                      = $sqlManager->prepare($sql);
$stmt->execute();
$vars['configuration_types_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($vars['configuration_types_tbl'] as &$row) {
    // Prend les 3 premiers caractères de la description (ou moins si plus court)
    $desc = $row['description'] ?? '';
    $r    = isset($desc[0]) ? ord($desc[0]) : 50;
    $g    = isset($desc[1]) ? ord($desc[1]) : 100;
    $b    = isset($desc[2]) ? ord($desc[2]) : 150;
    // Limite à 0-255 pour chaque composante
    $r = $r % 256;
    $g = $g % 256;
    $b = $b % 256;
    // Assemble en hexadécimal
    $row['hex'] = sprintf("#%02x%02x%02x", $r, $g, $b);
}
unset($row);
