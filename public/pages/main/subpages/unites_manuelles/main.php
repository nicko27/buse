<?php
if (!$rightsManager->isAdmin()) {
    exit(1);
}
// Récupération des compagnies
$sql = "SELECT c.id, c.cu, ul.codeServiceRio, ul.newName, c.ordre, c.color
            FROM compagnies c
            JOIN unites_ldap ul ON c.cu = ul.cu
            WHERE isCie = 1
            ORDER BY ordre ASC";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['cies_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Récupération des unités manuelles
$sql  = "SELECT * FROM unites_manuelles ORDER BY name ASC";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['unites_manuelles_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
