<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

$hui    = new DateTime();
$huiStr = $hui->format('Y-m-d');
$data   = [
    "nom"   => $_POST["nomPamMatin"],
    "tph"   => $_POST["tphPamMatin"],
    "date"  => $huiStr,
    "cu"    => $_POST["cu"],
    "matin" => 1,
    "aprem" => 0,
    "nuit"  => 0,
];
$returnValueMatin = insertOrUpdateSql("tph_pam", $data, ["matin" => 1, "date" => $huiStr, "cu" => $_POST["cu"]]);
$data             = [
    "nom"   => $_POST["nomPamAprem"],
    "tph"   => $_POST["tphPamAprem"],
    "date"  => $huiStr,
    "cu"    => $_POST["cu"],
    "matin" => 0,
    "aprem" => 1,
    "nuit"  => 0,
];
$returnValueAprem = insertOrUpdateSql("tph_pam", $data, ["aprem" => 1, "date" => $huiStr, "cu" => $_POST["cu"]]);
$data             = [
    "nom"   => $_POST["nomPamMatin"],
    "tph"   => $_POST["tphPamMatin"],
    "date"  => $huiStr,
    "cu"    => $_POST["cu"],
    "matin" => 0,
    "aprem" => 0,
    "nuit"  => 1,
];
$returnValueNuit = insertOrUpdateSql("tph_pam", $data, ["nuit" => 1, "date" => $huiStr, "cu" => $_POST["cu"]]);
$erreur          = $returnValueMatin['erreur'] && $returnValueAprem['erreur'] && $returnValueNuit['erreur'];
echo json_encode(["erreur" => $erreur]);
