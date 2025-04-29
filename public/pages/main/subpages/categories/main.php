<?php

$sql  = "SELECT * FROM categories ORDER BY niveau,categorie ASC";
$stmt = $sqlManager->prepare($sql);
$stmt->execute();
$vars['categories_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
