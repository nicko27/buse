<?php
$sql  = "select evenements.*,niveau,categorie,name,old_name from evenements,categories,cities where cities.id=commune_id and categories.id=evenements.categorie_id";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars["evenements_tbl"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
