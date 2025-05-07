<?php
$cu = 14431;

if ($cu == 0) {
    $sql = "SELECT
    evenements.*,
    categories.niveau,
    categories.categorie,
    cities.name,
    cities.old_name
FROM evenements
JOIN categories      ON evenements.categorie_id = categories.id
JOIN cities          ON evenements.commune_id = cities.id
JOIN mairies         ON cities.insee = mairies.insee
JOIN unites_ldap     ON mairies.unit_id = unites_ldap.id
ORDER BY cities.name, evenements.date, evenements.heure
";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $vars["enable_mail"] = 0;
} else {
    $sql = "SELECT
    evenements.*,
    categories.niveau,
    categories.categorie,
    cities.name,
    cities.old_name
FROM evenements
JOIN categories      ON evenements.categorie_id = categories.id
JOIN cities          ON evenements.commune_id = cities.id
JOIN mairies         ON cities.insee = mairies.insee
JOIN unites_ldap     ON mairies.unit_id = unites_ldap.id
WHERE unites_ldap.cu = :cu
ORDER BY cities.name, evenements.date, evenements.heure
";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute(["cu" => $cu]);
    $vars["enable_mail"] = 1;
}

$vars["evenements_tbl"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
