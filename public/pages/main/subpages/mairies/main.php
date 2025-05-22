<?php

if (!$rightsManager->isAdmin()) {
    exit(1);
}
require dirname(__DIR__) . "/unites_ldap/main.php";
$sql = 'SELECT
    mairies.id,
    cities.name,
    cities.old_name,
    cities.code_postal,
    mairies.maire,
    mairies.mail,
    mairies.unit_id
FROM
    mairies,cities
WHERE
    cities.insee LIKE :dpt AND cities.insee=mairies.insee AND cities.insee>0
ORDER BY
    cities.name ASC;';
$dpt  = sprintf("%s___", $config->get("CITY_DEPARTMENT"));
$stmt = $sqlManager->prepare($sql);
$stmt->execute([
    ":dpt" => $dpt,
]);
$vars['mairies_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
