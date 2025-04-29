<?php
require dirname(__DIR__) . "/unites_ldap/main.php";
                                              // Correction ici :
$dpt = $config->get("CITY_DEPARTMENT") . '%'; // Ajoute le % ici
$sql = "SELECT
    m.id AS maire_id,
    CASE
        WHEN c.old_name IS NOT NULL AND c.old_name != '' THEN c.old_name
        ELSE c.name
    END AS ville_utilisee,
    c.code_postal,
    m.maire,
    m.mail,
    m.unit_id,
    c.*  -- Ajout de tous les champs de la table cities
FROM
    mairies AS m
JOIN
    cities AS c
  ON m.name = CASE
                 WHEN c.old_name IS NOT NULL AND c.old_name != '' THEN c.old_name
                 ELSE c.name
              END
WHERE
    c.code_postal LIKE :dpt
ORDER BY
    ville_utilisee ASC;
";
$sql = "SELECT distinct cities.code_postal, cities.name, mairies.maire, mairies.mail, mairies.unit_id
FROM cities, mairies
WHERE mairies.insee = cities.insee
AND cities.code_postal LIKE :dpt
ORDER BY cities.name ASC";
$stmt = $sqlManager->prepare($sql);
$stmt->execute([
    ":dpt" => $dpt,
]);
$vars['cities_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
