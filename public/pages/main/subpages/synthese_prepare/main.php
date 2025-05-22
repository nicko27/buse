<?php

if ($rightsManager->getSynthesisViewLevel() == 0) {
    exit(1);
}
$cu = $rightsManager->getUserCu();
$logger->info("Synthese CU:" . $cu);
if ($rightsManager->getSynthesisViewLevel() == $config->get("SYNTHESIS_GLOBAL_VIEW_LEVEL")) {
    $logger->info("Mode global");
    $now = new \DateTime();
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
WHERE
    CONCAT(evenements.date, ' ', evenements.heure) >= :start
    AND CONCAT(evenements.date, ' ', evenements.heure) < :end
ORDER BY evenements.date, evenements.heure,cities.name
";
    $stmt  = $sqlManager->prepare($sql);
    $start = new \DateTime('yesterday 07:00');
    $end   = new \DateTime('today 07:00');
    $stmt->execute(["start" => $start->format('Y-m-d H:i:s'), "end" => $end->format('Y-m-d H:i:s')]);
    $logger->info($now->format('Y-m-d'));
    $vars["enable_mail"] = 0;
}
if ($rightsManager->getSynthesisViewLevel() == $config->get("SYNTHESIS_UNIT_VIEW_LEVEL")) {
    $sql     = "select * from unites_ldap where cu=:cu and isCob=1";
    $results = $sqlManager->query($sql, ["cu" => $cu]);
    if ($results['rowCount'] == 1) {
        $cu = $results["data"][0]["cuCob"];
    }
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
AND evenements.sent = 0
ORDER BY cities.name, evenements.date, evenements.heure
";
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute(["cu" => $cu]);
    $vars["enable_mail"] = 1;
}

$vars["evenements_tbl"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
