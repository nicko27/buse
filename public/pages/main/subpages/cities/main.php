<?php

if (!$rightsManager->isAdmin()) {
    exit(1);
}
require dirname(__DIR__) . "/unites_ldap/main.php";
// Correction ici :
$dpt = $config->get("CITY_DEPARTMENT") . '%'; // Ajoute le % ici
$sql = "SELECT * FROM cities WHERE insee REGEXP :dpt; ORDER BY cities.name ASC";

$stmt = $sqlManager->prepare($sql);
$dpt  = sprintf("^%s[0-9]{3}$", $config->get("CITY_DEPARTMENT"));
$stmt->execute([
    ":dpt" => $dpt,
]);
$vars['cities_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
