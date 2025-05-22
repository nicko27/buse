<?php

if (!$rightsManager->isSuperAdmin()) {
    exit(1);
}
$tables = ["pages_css", "pages_js_footer", "pages_js_header", "pages_twig_content", "pages_twig_footer", "pages_twig_header"];

foreach ($tables as $t) {
    $sql  = sprintf("SELECT DISTINCT * FROM %s", $t);
    $stmt = $sqlManager->prepare($sql);
    $stmt->execute();
    $vars[$t . '_tbl'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
}
