<?php

if ($rightsManager->getSynthesisViewLevel() != 1) {
    exit(1);
}
$cu      = $rightsManager->getUserCu();
$sql     = "select * from unites_ldap where cu=:cu and isCob=1";
$results = $sqlManager->query($sql, ["cu" => $cu]);
if ($results['rowCount'] == 1) {
    $cu = $results["data"][0]["cuCob"];
}

$sql = "SELECT
    cities.id,
    cities.name,
    cities.old_name,
    COUNT(*) AS nb_evenements_non_envoyes
FROM evenements
JOIN categories      ON evenements.categorie_id = categories.id
JOIN cities          ON evenements.commune_id = cities.id
JOIN mairies         ON cities.insee = mairies.insee
JOIN unites_ldap     ON mairies.unit_id = unites_ldap.id
WHERE unites_ldap.cu = :cu
  AND evenements.need_to_send = 1
  AND evenements.sent = 0
GROUP BY cities.id, cities.name, cities.old_name
ORDER BY cities.name;
";
$stmt = $sqlManager->prepare($sql);
$stmt->execute(["cu" => $cu]);
$vars["mails_tbl"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
