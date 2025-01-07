<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";

$datetime         = DateTime::createFromFormat('d.m.Y', $_POST['date']);
$valDateDebut     = $datetime->format('Y-m-d');
$valDateFin       = $valDateDebut;
$entry_debut_time = clone $datetime;
$entry_fin_time   = clone $datetime;
$entry_debut_time->setTime((int) $_POST['start-hour'], (int) $_POST['start-minute']);
$entry_fin_time->setTime((int) $_POST['end-hour'], (int) $_POST['end-minute']);
if ($entry_fin_time < $entry_debut_time) {
    $demain     = $datetime->modify('+1 day');
    $valDateFin = $demain->format('Y-m-d');
}
$data = [
    "nom"        => "NO NAME",
    "tph"        => $_POST["tph"],
    "cu"         => $_POST["cu"],
    "cu_cob"     => $_POST["cu"],
    "debut"      => sprintf("%s:%s", $_POST['start-hour'], $_POST['start-minute']),
    "fin"        => sprintf("%s:%s", $_POST['end-hour'], $_POST['end-minute']),
    "date_debut" => $valDateDebut,
    "date_fin"   => $valDateFin,
    "users"      => $_POST["users"],
    "rubis"      => $_POST["rubis"],
    "serviceId"  => $_POST["service"],
    "color"      => $_POST["color"],
    "memo"       => $_POST["memo"],
    "invisible"  => 0,
];
$returnValue = insertSql("services_unites", $data);
echo json_encode($returnValue);
