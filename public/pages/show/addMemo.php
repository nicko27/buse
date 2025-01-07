<?php
include_once dirname(__DIR__, 1) . "/commun/init.php";
$permanent = (isset($_POST['permanent'])) ? $_POST['permanent'] : 0;

if ($permanent == 0) {
    $startDate          = (!isset($_POST['start-date'])) ? date('d.m.Y') : $_POST['start-date'];
    $datetime           = DateTime::createFromFormat('d.m.Y', $startDate);
    $formattedStartDate = $datetime->format('Y-m-d');
    $endDate            = (!isset($_POST['endDate'])) ? date('d.m.Y') : $_POST['end-date'];
    $datetime           = DateTime::createFromFormat('d.m.Y', $endDate);
    $formattedEndDate   = $datetime->format('Y-m-d');
    $alarm              = (isset($_POST['alarm'])) ? $_POST['alarm'] : 0;
} else {
    $formattedEndDate   = "";
    $formattedStartDate = "";
    $alarm              = "";
}
$data = [
    "startTime"      => sprintf("%s:%s", $_POST['start-hour'], $_POST['start-minute']),
    "endTime"        => sprintf("%s:%s", $_POST['end-hour'], $_POST['end-minute']),
    "startDate"      => $formattedStartDate,
    "permanent"      => isset($_POST['permanent']) ? $_POST['permanent'] : 0,
    "endDate"        => $formattedEndDate,
    "memo"           => $_POST["memo"],
    "alarm"          => $alarm,
    "alarmTriggered" => 0,
    "invisible"      => 0,
];
$returnValue = insertSql("memos", $data);
echo json_encode($returnValue);
